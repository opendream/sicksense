# GFV F1 Verification — single-arg `crosstab(text)` symptom mis-mapping

- **Task**: `gfv-f1-verify-fable` — read-only production verification of finding F1
- **Verdict**: **CONFIRMED**
- **Confidence**: **5 / 5**
- **Verified on**: 2026-07-31 (Asia/Bangkok), host `api.sicksense.org`, PostgreSQL 9.3.17
- **Method**: SELECT-only SQL over prod DBs `sicksense` and `globalfluview` (same cluster, user `sicksense`), executed via SSH with `SET default_transaction_read_only = on` as an extra guard. DB password was extracted on the remote host from `config/local.js` into `PGPASSWORD` inside the same remote shell; it was never printed, never left the host, and appears nowhere in this repo. No `CREATE EXTENSION` was run (`tablefunc 1.0` already installed — the sync itself installs it, see side findings). No PII beyond truncated symptom-name text in a ≤20-row sample; no lat/lon/email selected anywhere.

## TL;DR

The hypothesis is correct and now proven at both ends of the pipeline. PostgreSQL's single-arg `crosstab(text)` ignores the category (symptom-name) column and fills the declared output columns left-to-right. Because the sync feeds a constant `1` as the value, the stored "symptom" columns degrade into pure **symptom-count thresholds**:

| stored column | actually means |
|---|---|
| `sym_fever = 1` | report has **≥ 1** symptom row (of any kind) |
| `sym_cough = 1` | report has **≥ 2** symptom rows |
| `sym_headache = 1` | report has **≥ 4** symptom rows |
| `sym_sore_throat = 1` | report has **≥ 6** symptom rows |
| `is_ili = true` | report has **≥ 1** symptom row of any kind |

This held with **zero exceptions across 1,048,565 production reports** when running the sync's exact crosstab SQL (`mechanism_violations = 0`), and the **entire globalfluview dataset (102,880 surveys, 216 weeks)** is exactly threshold-shaped (`is_ili ≡ sym_fever`, `sore ⊆ headache ⊆ cough ⊆ fever`, 0 violations). ILI is inflated ~2.8× over all history (~4× in the current era); fever is inflated ~12×; more than half of true sore-throat reports are dropped. A second, independent defect was found: the live app has stopped using the 2014 catalog names — it writes Thai display-text symptom names — so even a label-correct pivot would miss ~90% of real symptoms today.

---

## 1. Mechanism (Q0 + real crosstab run)

### 1.1 Symptom catalog (Q0)

`symptoms` holds **14,021 rows**: ids 1–13 are the fixed catalog, everything above is user/free-text (Thai phrases, junk like `x`, `yyyjhf`, drug names). DB collation `en_US.UTF-8`. No duplicate names among the 13 catalog names.

| id | name | | id | name |
|---|---|---|---|---|
| 1 | fever | | 8 | jointache |
| 2 | cough | | 9 | diarrhea |
| 3 | nuasea | | 10 | dark-urine |
| 4 | headache | | 11 | bleeding |
| 5 | red-eye | | 12 | imfine |
| 6 | sore-throat | | 13 | aphthous |

The sync declares columns `(report_id, fever, cough, nuasea, headache, "red-eye", "sore-throat", rash, jointache, diarrhea, imfine)` — i.e. id order (1–9, 12) — while the inner query is `ORDER BY 1, 2`, i.e. **alphabetical by name** over all 14,021 names. Declaration order ≠ feed order, and single-arg `crosstab` never matches labels anyway: per the PostgreSQL docs it "fills the output value columns, left to right, with the value fields from these rows"; extra rows beyond 10 are silently dropped. Since every value is the constant `1`, which column receives `1` depends **only on how many symptom rows the report has** — thresholds 1/2/3/4/5/6/… for fever/cough/nuasea/headache/red-eye/sore-throat/…

`reportssymptoms` split: 207,352 rows reference catalog ids (≤13); 379,461 rows reference free-text ids (>13) — 65% of all symptom rows never had a corresponding output column even in theory.

### 1.2 Empirical proof on production data

I ran the sync's **exact** crosstab SQL (same string, same declared columns) joined with the sync's exact join conditions (`reports ⋈ locations ⋈ users(birthYear>0) ⟕ ct`), against ground truth computed per report with `bool_or(s.name = '<symptom>')`, plus a per-row mechanism check `col_k = 1 ⇔ n_syms ≥ k` for k ∈ {1,2,4,6}:

- **`mechanism_violations = 0`** over all **1,048,399** joined reports (global) and all **166** reports of the test window. The count-threshold semantics is exact, not approximate.
- Cross-check identities (global): `ct_fever 238,536 = syms≥1 (119,867+51,231+27,606+25,164+14,668)`; `ct_headache 39,832 = syms≥4 (25,164+14,668)`; `ct_sore 14,668 = syms≥6` — the stored columns are literally the tail-sums of the symptom-count histogram.

## 2. Corruption magnitude (Q1)

### 2.1 Global — all history through the sync's joins (n = 1,048,399 reports; 809,863 have no symptom rows)

| measure | crosstab (what sync stores) | truth (by catalog name) | false pos | false neg | distortion |
|---|---:|---:|---:|---:|---|
| fever | 238,536 | 19,867 | 218,669 | 0 | **12.0× inflated** |
| cough | 118,669 | 33,278 | 93,414 | 8,023 | 3.6× inflated, 24% of true cough missed |
| headache | 39,832 | 42,420 | 25,608 | 28,196 | totals near parity but 64% of flags false and 66% of true missed |
| sore-throat | 14,668 | 30,244 | 9,925 | 25,501 | **halved**; 84% of true sore-throat missed |
| **is_ili** | **238,536 (22.8%)** | **84,424 (8.1%)** | **154,112** | **0** | **2.8× inflated; 64.6% of flagged ILI are false** |

`ili_false_neg = 0` and `fever_false_neg = 0` are structural: any report with a true ILI symptom has ≥1 symptom row, so it always gets `fever = 1` → flagged. Note the truth column is itself an *under*count for recent years (see §4), so real-era inflation is worse.

### 2.2 Test window — GFV week `20260719` (2026-07-19 00:00 → 2026-07-26 00:00 +07, inclusive, as the sync's `BETWEEN`)

| measure | recomputed crosstab (today) | GFV stored | truth (catalog name) | Thai-equivalent truth |
|---|---:|---:|---:|---:|
| reports | 166 | 159 | — | — |
| sym_fever | 27 | 23 | 0 | — |
| sym_cough | 12 | 10 | 0 | — |
| sym_headache | 1 | 1 | 1 | — |
| sym_sore_throat | 0 | 0 | 2 | — |
| is_ili | 27 | 23 | 3 (1.8%) | 7 (4.2%) |

**Exact reconciliation**: 7 of today's 166 in-window reports were created **after** the window closed (`createdAt ≥ 2026-07-27 00:00+07`, last one 2026-07-30 08:33) — i.e. after the sync ran. 166 − 7 = **159 = the stored GFV record_count exactly**; the aggregate deltas (+4 fever, +2 cough, +4 ili, +0 headache/sore) are consistent with those 7 late reports. The stored GFV week is reproduced by this pipeline to the row count.

Sample of mismatched reports in the window (LIMIT 20 run; excerpt; `st_*` = what sync stores, `t_*` = truth by name):

| report_id | n_syms | actual symptoms (alphabetical, as crosstab feeds them) | stored | truth |
|---|---|---|---|---|
| 1131326 | 1 | มีไข้ (fever, Thai) | fever=1 | all false |
| 1131283 | 1 | migraine | fever=1 | all false |
| 1131270 | 4 | ไอ \| มีไข้ \| เจ็บคอ \| คัดจมูก (cough, fever, sore throat, stuffy nose — Thai) | fever=1, cough=1, headache=1 | all false |
| 1131241 | 3 | ปวดหลัง ปวดเอว \| allergic-whether \| sore-throat | fever=1, cough=1, sore=NULL | sore-throat=true |
| 1131208 | 3 | allergic-whether \| runny-nose \| sore-throat | fever=1, cough=1, sore=NULL | sore-throat=true |
| 1131184 | 2 | ความดันต่ำ... \| headache | fever=1, cough=1, headache=NULL | headache=true |
| 1131238 | 1 | ท้องผูก (constipation) | fever=1 | all false |

Report 1131241/1131208 show the label inversion crisply: an actual `sore-throat` row is stored as `fever=1, cough=1, sore_throat=NULL`.

## 3. globalfluview stored data (Q2)

Accessible with the same credentials on the same cluster. Coverage: **216 weeks, `20210829` → `20260719`** (with a sync outage gap between `20250720` and `20260503`), 102,880 surveys.

Whole-dataset structural check (all 102,880 rows):

| check | violations |
|---|---:|
| `is_ili <> (sym_fever IS TRUE)` | **0** |
| `sym_cough` without `sym_fever` | **0** |
| `sym_headache` without `sym_cough` | **0** |
| `sym_sore_throat` without `sym_headache` | **0** |

Totals: ili = fever = 17,541 (17.1%); cough = 9,357; headache = 3,966; sore-throat = 1,714. Real epidemiological data could not produce a perfect `sore ⊆ headache ⊆ cough ⊆ fever` chain with `is_ili ≡ sym_fever` across five years and 102,880 rows; count-threshold semantics forces it. **Every stored GFV week since 2021 is corrupted.** Recent per-week aggregates (e.g. 20260719: n=159, fever=23=ili, cough=10, headache=1, sore=0) all show `ili_1 = fever_1` and the monotone chain.

## 4. Additional findings beyond F1

1. **Vocabulary drift (new, high impact for migration).** Since at least the 2026 restart era, the app writes Thai display-text symptom names (top names since 2026-05-03: ผื่นคัน 89, ปวดหลัง ปวดเอว 74, ปวดศีรษะ 50, ท้องเสีย 44, ท้องผูก 38, ไอ 34, คลื่นไส้ 33, เจ็บคอ 26 …) plus some new English slugs (`runny-nose`, `allergic-whether`, `stomachache`, `migraine`). Catalog names are nearly dead (`sore-throat` 7, `fever` 4, `headache` 4 rows). Modern era (since 2026-05-03, n=1,964 synced-shape reports): stored-ILI-equivalent 351 (17.9%), strict-catalog-name ILI 11 (0.6%), Thai-equivalent ILI ≈ 85 (4.3%, using {fever,cough,headache,sore-throat, มีไข้, ไข้, ตัวร้อน, ไอ, เจ็บคอ, ปวดศีรษะ, ปวดหัว}; slight undercount — variants like "ปวดศีรษะ (ปวดหัว)" not matched). **Even a label-correct pivot would miss ~90% of real symptoms today.** The export layer must map the live vocabulary, not the 2014 catalog.
2. **"imfine" inflation sub-path refuted.** Healthy check-ins set `reports."isFine"` and write **no** `reportssymptoms` rows (808,762 of the 809,863 zero-symptom reports have `isFine = true`; `imfine_counted_as_ili = 0`; zero `isFine` reports have any symptom row). They are stored with NULL symptom flags and `is_ili = false` — correct by accident. The inflation comes from non-ILI *symptomatic* reports, not from "I'm fine" reports.
3. **The sync mutates the source DB**: `fetch_report()` executes `CREATE EXTENSION IF NOT EXISTS tablefunc` on the production sicksense DB every run (which is why `tablefunc 1.0` is installed). A read path should not carry DDL.
4. **Full-table pivot every run**: the crosstab subquery has no date filter — it pivots all 586,813 `reportssymptoms` rows weekly to extract ~160 reports.
5. **Join drops ~83k reports silently**: `users."birthYear" > 0` plus the `locations` inner join exclude 82,999 of 1,131,398 reports (7.3%) from GFV entirely. A migration should make this exclusion policy explicit.
6. **`BETWEEN` is inclusive on both ends**: a report at exactly Sunday 00:00:00+07 lands in two consecutive weeks. Minor, but worth fixing at port time.
7. **Late-arriving reports are permanently missed**: reports for a window created after the Monday sync (7 in the test week, some as late as +4 days) never reach GFV, since each week is synced once.

## 5. Implication for the migration (GFV as multi-outlet export layer)

- **Do not port the crosstab.** Replace with plain conditional aggregation, e.g. `bool_or(s.name = ANY(mapping))` / `max(CASE WHEN s.name IN (...) THEN 1 END)` grouped by report — or aggregate in Python. No extension needed, no label ambiguity.
- **Build a symptom-vocabulary mapping table** (current Thai display names + legacy slugs + free-text policy) → GFV fields. Without it, a "fixed" pivot still exports near-zero symptom signal (finding 4.1).
- **Decide `is_ili` semantics explicitly** (strict fever/cough/headache/sore-throat by mapped vocabulary; today's stored definition is "any symptom at all").
- **Plan a backfill**: all 216 stored GFV weeks are corrupted; after the port, recompute historical weeks from sicksense raw data (raw tables retain everything needed; this verification recomputed a stored week exactly).
- Fix the side issues at port time: no DDL in sync, date-filter the aggregation, half-open week intervals, explicit exclusion policy, and consider a late-arrival re-sync window.

## 6. Exact SQL run (credentials excluded)

All statements ran under `SET default_transaction_read_only = on; SET statement_timeout = '540s';` as user `sicksense` via `psql -v ON_ERROR_STOP=1` on the prod host. Password handling: `export PGPASSWORD="$(node -e '...read config/local.js, print connections.postgresql.password...')"` executed on the remote host only.

### 6.1 Smoke / catalog (DB `sicksense`)

```sql
SELECT current_database(), current_user, inet_server_addr(), version();
SELECT datname FROM pg_database WHERE NOT datistemplate ORDER BY 1;
SELECT extname, extversion FROM pg_extension WHERE extname = 'tablefunc';   -- Q3: exists (1.0); nothing created
SELECT count(*) AS crosstab_functions FROM pg_proc WHERE proname = 'crosstab';
SELECT (SELECT count(*) FROM reports)         AS reports,
       (SELECT count(*) FROM reportssymptoms) AS reportssymptoms,
       (SELECT count(*) FROM symptoms)        AS symptoms,
       (SELECT count(*) FROM users)           AS users,
       (SELECT count(*) FROM locations)       AS locations;
SELECT id, name FROM symptoms ORDER BY id;      -- Q0a
SELECT id, name FROM symptoms ORDER BY name;    -- Q0b
SELECT min("startedAt" AT TIME ZONE 'Asia/Bangkok'), max("startedAt" AT TIME ZONE 'Asia/Bangkok') FROM reports;
SHOW lc_collate;
SELECT name, count(*) AS n_ids, min(id), max(id) FROM symptoms
WHERE name IN ('fever','cough','nuasea','headache','red-eye','sore-throat','rash','jointache','diarrhea','imfine','dark-urine','bleeding','aphthous')
GROUP BY name HAVING count(*) > 1 ORDER BY 1;
SELECT sum(CASE WHEN "symptomId" <= 13 THEN 1 ELSE 0 END) AS catalog_rows,
       sum(CASE WHEN "symptomId" >  13 THEN 1 ELSE 0 END) AS freetext_rows
FROM reportssymptoms;
```

### 6.2 Main verification — real crosstab vs truth, window + global (DB `sicksense`, Q1)

```sql
WITH ct AS (SELECT * FROM crosstab(
    'SELECT rs."reportId", s.name AS symptom_name, 1 AS value
    FROM symptoms s, reportssymptoms rs
    WHERE s.id = rs."symptomId"
    ORDER BY 1, 2'
) AS ct(report_id int, fever int, cough int, nuasea int, headache int, "red-eye" int,
        "sore-throat" int, rash int, jointache int, diarrhea int, imfine int)),
truth AS (
  SELECT rs."reportId" AS report_id,
         count(*) AS n_syms,
         bool_or(s.name = 'fever')       AS t_fever,
         bool_or(s.name = 'cough')       AS t_cough,
         bool_or(s.name = 'headache')    AS t_headache,
         bool_or(s.name = 'sore-throat') AS t_sore,
         bool_or(s.id = 12)              AS t_imfine
  FROM reportssymptoms rs JOIN symptoms s ON s.id = rs."symptomId"
  GROUP BY rs."reportId"
),
base AS (
  SELECT r.id,
         (r."startedAt" BETWEEN '2026-07-19 00:00:00+07' AND '2026-07-26 00:00:00+07') AS in_win,
         coalesce(r."isFine", false) AS is_fine,
         ct.fever AS c_fever, ct.cough AS c_cough, ct.headache AS c_headache, ct."sore-throat" AS c_sore,
         coalesce(ct.fever = 1 OR ct.cough = 1 OR ct.headache = 1 OR ct."sore-throat" = 1, false) AS c_ili,
         coalesce(t.n_syms, 0) AS n_syms,
         coalesce(t.t_fever, false)    AS t_fever,
         coalesce(t.t_cough, false)    AS t_cough,
         coalesce(t.t_headache, false) AS t_headache,
         coalesce(t.t_sore, false)     AS t_sore,
         coalesce(t.t_imfine, false)   AS t_imfine,
         (coalesce(t.t_fever,false) OR coalesce(t.t_cough,false) OR coalesce(t.t_headache,false) OR coalesce(t.t_sore,false)) AS t_ili
  FROM reports r
  JOIN locations l ON r.location_id = l.id
  JOIN users u ON r."userId" = u.id AND u."birthYear" > 0
  LEFT JOIN ct ON r.id = ct.report_id
  LEFT JOIN truth t ON r.id = t.report_id
)
SELECT in_win, count(*) AS n_reports,
       sum(CASE WHEN c_fever = 1 THEN 1 ELSE 0 END)    AS ct_fever,
       sum(CASE WHEN c_cough = 1 THEN 1 ELSE 0 END)    AS ct_cough,
       sum(CASE WHEN c_headache = 1 THEN 1 ELSE 0 END) AS ct_headache,
       sum(CASE WHEN c_sore = 1 THEN 1 ELSE 0 END)     AS ct_sore,
       sum(CASE WHEN c_ili THEN 1 ELSE 0 END)          AS ct_ili,
       sum(CASE WHEN t_fever THEN 1 ELSE 0 END)    AS true_fever,
       sum(CASE WHEN t_cough THEN 1 ELSE 0 END)    AS true_cough,
       sum(CASE WHEN t_headache THEN 1 ELSE 0 END) AS true_headache,
       sum(CASE WHEN t_sore THEN 1 ELSE 0 END)     AS true_sore,
       sum(CASE WHEN t_ili THEN 1 ELSE 0 END)      AS true_ili,
       sum(CASE WHEN c_fever = 1 AND NOT t_fever THEN 1 ELSE 0 END)                  AS fever_false_pos,
       sum(CASE WHEN c_fever IS DISTINCT FROM 1 AND t_fever THEN 1 ELSE 0 END)       AS fever_false_neg,
       sum(CASE WHEN c_cough = 1 AND NOT t_cough THEN 1 ELSE 0 END)                  AS cough_false_pos,
       sum(CASE WHEN c_cough IS DISTINCT FROM 1 AND t_cough THEN 1 ELSE 0 END)       AS cough_false_neg,
       sum(CASE WHEN c_headache = 1 AND NOT t_headache THEN 1 ELSE 0 END)            AS headache_false_pos,
       sum(CASE WHEN c_headache IS DISTINCT FROM 1 AND t_headache THEN 1 ELSE 0 END) AS headache_false_neg,
       sum(CASE WHEN c_sore = 1 AND NOT t_sore THEN 1 ELSE 0 END)                    AS sore_false_pos,
       sum(CASE WHEN c_sore IS DISTINCT FROM 1 AND t_sore THEN 1 ELSE 0 END)         AS sore_false_neg,
       sum(CASE WHEN c_ili AND NOT t_ili THEN 1 ELSE 0 END) AS ili_false_pos,
       sum(CASE WHEN NOT c_ili AND t_ili THEN 1 ELSE 0 END) AS ili_false_neg,
       sum(CASE WHEN c_ili AND t_imfine AND NOT t_ili THEN 1 ELSE 0 END) AS imfine_counted_as_ili,
       sum(CASE WHEN is_fine THEN 1 ELSE 0 END) AS isfine_flag_true,
       sum(CASE WHEN is_fine AND c_ili THEN 1 ELSE 0 END) AS isfine_flag_counted_ili,
       sum(CASE WHEN (c_fever IS NOT DISTINCT FROM 1) <> (n_syms >= 1)
              OR (c_cough IS NOT DISTINCT FROM 1) <> (n_syms >= 2)
              OR (c_headache IS NOT DISTINCT FROM 1) <> (n_syms >= 4)
              OR (c_sore IS NOT DISTINCT FROM 1) <> (n_syms >= 6)
             THEN 1 ELSE 0 END) AS mechanism_violations,
       sum(CASE WHEN n_syms = 0 THEN 1 ELSE 0 END) AS syms_0,
       sum(CASE WHEN n_syms = 1 THEN 1 ELSE 0 END) AS syms_1,
       sum(CASE WHEN n_syms = 2 THEN 1 ELSE 0 END) AS syms_2,
       sum(CASE WHEN n_syms = 3 THEN 1 ELSE 0 END) AS syms_3,
       sum(CASE WHEN n_syms IN (4,5) THEN 1 ELSE 0 END) AS syms_4_5,
       sum(CASE WHEN n_syms >= 6 THEN 1 ELSE 0 END) AS syms_6_plus
FROM base GROUP BY in_win ORDER BY in_win;
```

Sample queries (window-restricted, `LIMIT 20` / `LIMIT 8`) reused the `truth` CTE with
`array_to_string(array_agg(substr(s.name,1,30) ORDER BY s.name), ' | ')` and filters
`(n_syms>=1) <> t_fever OR (n_syms>=2) <> t_cough OR (n_syms>=4) <> t_headache OR (n_syms>=6) <> t_sore`
and `t_imfine AND NOT (t_fever OR t_cough OR t_headache OR t_sore)` (the latter returned 0 rows).

### 6.3 Vocabulary / reconciliation (DB `sicksense`)

```sql
SELECT substr(s.name,1,40) AS name, (s.id <= 13) AS catalog_sym, count(*) AS n
FROM reportssymptoms rs
JOIN symptoms s ON s.id = rs."symptomId"
JOIN reports r ON r.id = rs."reportId"
WHERE r."startedAt" >= '2026-05-03 00:00:00+07'
GROUP BY 1, 2 ORDER BY n DESC LIMIT 30;

SELECT (r."startedAt" BETWEEN '2026-07-19 00:00:00+07' AND '2026-07-26 00:00:00+07') AS in_win_20260719,
       count(*) AS n,
       sum(CASE WHEN t.n_syms >= 1 THEN 1 ELSE 0 END) AS stored_ili_eq_any_symptom,
       sum(CASE WHEN t.strict_ili THEN 1 ELSE 0 END)  AS strict_name_ili,
       sum(CASE WHEN t.thai_ili THEN 1 ELSE 0 END)    AS thai_equiv_ili
FROM reports r
JOIN locations l ON r.location_id = l.id
JOIN users u ON r."userId" = u.id AND u."birthYear" > 0
LEFT JOIN (SELECT rs."reportId" AS id, count(*) AS n_syms,
             bool_or(s.name IN ('fever','cough','headache','sore-throat')) AS strict_ili,
             bool_or(s.name IN ('fever','cough','headache','sore-throat',
                                'มีไข้','ไข้','ตัวร้อน','ไอ','เจ็บคอ','ปวดศีรษะ','ปวดหัว')) AS thai_ili
           FROM reportssymptoms rs JOIN symptoms s ON s.id = rs."symptomId"
           GROUP BY rs."reportId") t ON t.id = r.id
WHERE r."startedAt" >= '2026-05-03 00:00:00+07'
GROUP BY 1 ORDER BY 1;

SELECT count(*) AS in_win_total,
       sum(CASE WHEN r."createdAt" >= '2026-07-27 00:00:00+07' THEN 1 ELSE 0 END) AS created_after_win_end,
       min(r."createdAt" AT TIME ZONE 'Asia/Bangkok') AS first_created,
       max(r."createdAt" AT TIME ZONE 'Asia/Bangkok') AS last_created
FROM reports r
JOIN locations l ON r.location_id = l.id
JOIN users u ON r."userId" = u.id AND u."birthYear" > 0
WHERE r."startedAt" BETWEEN '2026-07-19 00:00:00+07' AND '2026-07-26 00:00:00+07';
```

### 6.4 globalfluview checks (DB `globalfluview`, Q2)

```sql
SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY 1;
SELECT id, from_date, through_date, record_count FROM sicksense_week ORDER BY id DESC LIMIT 15;
SELECT count(*) FROM sicksense_survey;
SELECT s.week_id, count(*) AS n,
       sum(CASE WHEN s.sym_fever       THEN 1 ELSE 0 END) AS fever_1,
       sum(CASE WHEN s.sym_fever IS NULL THEN 1 ELSE 0 END) AS fever_null,
       sum(CASE WHEN s.sym_cough       THEN 1 ELSE 0 END) AS cough_1,
       sum(CASE WHEN s.sym_headache    THEN 1 ELSE 0 END) AS headache_1,
       sum(CASE WHEN s.sym_sore_throat THEN 1 ELSE 0 END) AS sore_1,
       sum(CASE WHEN s.is_ili          THEN 1 ELSE 0 END) AS ili_1
FROM sicksense_survey s GROUP BY s.week_id ORDER BY s.week_id DESC LIMIT 12;

SELECT count(*) AS surveys,
       sum(CASE WHEN is_ili THEN 1 ELSE 0 END)           AS ili_1,
       sum(CASE WHEN sym_fever THEN 1 ELSE 0 END)        AS fever_1,
       sum(CASE WHEN sym_cough THEN 1 ELSE 0 END)        AS cough_1,
       sum(CASE WHEN sym_headache THEN 1 ELSE 0 END)     AS headache_1,
       sum(CASE WHEN sym_sore_throat THEN 1 ELSE 0 END)  AS sore_1,
       sum(CASE WHEN is_ili <> (sym_fever IS TRUE) THEN 1 ELSE 0 END)                            AS viol_ili_ne_fever,
       sum(CASE WHEN (sym_cough IS TRUE) AND NOT (sym_fever IS TRUE) THEN 1 ELSE 0 END)          AS viol_cough_wo_fever,
       sum(CASE WHEN (sym_headache IS TRUE) AND NOT (sym_cough IS TRUE) THEN 1 ELSE 0 END)       AS viol_headache_wo_cough,
       sum(CASE WHEN (sym_sore_throat IS TRUE) AND NOT (sym_headache IS TRUE) THEN 1 ELSE 0 END) AS viol_sore_wo_headache
FROM sicksense_survey;
SELECT min(id) AS first_week, max(id) AS last_week, count(*) AS n_weeks FROM sicksense_week;
```
