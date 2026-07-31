# Global Flu View (GFV) — topology + migration scope

Independent reviews (2026-07-31): **Grok**, **Claude Fable max**, **Codex Sol ultra**.  
F1 live SQL verification: **CONFIRMED** — [GFV_F1_CROSSTAB_VERIFY.md](./GFV_F1_CROSSTAB_VERIFY.md) (Fable Max, 2026-07-31).  
Evidence packet (local): `.grok/orchestration/packets/gfv-evidence-20260731.md`  
Sibling repo (local): `../sicksense_globalfluview`  
Remote: `git@bitbucket.org:opendream/sicksense_globalfluview.git`

## Product decisions (owner)

| Decision | Choice | Date |
|----------|--------|------|
| GFV / IWOPS data owner | Project owner (holds Django Basic credentials) | 2026-07-31 |
| Historical DNS `api_globalfluview.sicksense.org` | **Not fulfilled** (still NXDOMAIN); path deploy is live; leave closed unless a **hyphenated** hostname is explicitly needed later | 2026-07-31 |
| Final migration target | GFV **is in scope** for the new Python codebase as a **multi-outlet export API** (IWOPS/GFV first; other outlets later) — not left on eternal separate Django | 2026-07-31 |
| Interim (during mobile rewrite) | Keep live Django path working; do not break cron/sync; port GFV into unified service **after or in a late phase** of main API migration | 2026-07-31 |
| Historical data after fix | **Option A** — recompute and republish **all** historical GFV weeks from raw `sicksense` data (not forward-only). See [ADR-003](./ADR-003-gfv-history-reexport.md) | 2026-07-31 |

## Current production verdict

| Question | Answer |
|----------|--------|
| In sicksense Sails tree? | **No** |
| What is it today? | Separate **Django 3.2** app (Python 3.6.15 + uWSGI + supervisor) |
| Live URL | `https://api.sicksense.org/globalfluview/api/...` (path mount) |
| Planned DNS `api_globalfluview.sicksense.org` | **NXDOMAIN** (request from years ago never completed as DNS; subpath used instead) |
| Same host as main API? | **Yes** — `128.199.146.179` |

## Production topology (today)

```
api.sicksense.org (nginx)
  location /globalfluview*  → unix:/tmp/globalfluview.sock → Django GFV
  location /                → forever Sails cluster
DB: globalfluview (Django)  ← weekly sync_from_sicksense ← DB: sicksense
Cron (opendream): Mon 09:00  manage.py sync_from_sicksense
```

Auth on GFV paths is **Django HTTP Basic** (`BASIC_AUTH_REALM = sicksense`), not nginx host-wide basic (nginx basic wraps only `location = /`).

## Endpoints (Iwops v2 wire contract)

| Method | Path | Auth | Notes |
|--------|------|------|--------|
| GET | `/globalfluview/api/weeks/` | HTTP Basic | Week list |
| GET | `/globalfluview/api/surveys/{week_id}/` | HTTP Basic | lat/lon, symptoms, IsILI |
| GET | `/globalfluview/api/participants/{week_id}/` | HTTP Basic | gender, birthYear |
| — | `/globalfluview/admin/` | Django admin | Not part of public outlet contract |

Wire format: `{ "Iwops": "v2", "Resource": "...", "Data": [...] }` — **not** Sails `{meta, response}`.

Live field quirks (freeze via golden fixtures when porting): `WeekId`/`SubmitDate` strings; `IsILI`/`IsVax` booleans; `IsFinal` always 1; `BirthMonth` always 1; `CountryCode` always `"TH"`; `IsVax` always false from sync.

## Historical DNS chat

Request (paraphrase, long ago): add `api_globalfluview.sicksense.org` → same IP as `api.sicksense.org` for separate deploy.

| Intent | Outcome |
|--------|---------|
| Separate process / deploy | **Done** (supervisor + own DB) |
| Same IP | **Done** (path co-host) |
| Dedicated DNS name | **Not done** (NXDOMAIN) — effectively superseded by path mount |

**Policy:** do **not** create the underscored name for public HTTPS (invalid for normal public cert SANs). Path URL is the live contract. Optional later: `api-globalfluview.sicksense.org` only with cert + vhost plan.

## Migration plan (revised)

### Phase A — Mobile API rewrite (early/mid)

- Implement Sails parity in FastAPI for mobile/web contracts.
- **Do not drop** GFV: keep Django process + nginx `/globalfluview` + weekly sync until Phase B.
- Cutover checklist must include: main schema still readable by sync; `tablefunc` if still used; host co-tenancy.

### Phase B — Multi-outlet export in unified codebase (late / end state)

Fold GFV into the **same** new Python service (or a tightly versioned module) as an **outlet**:

| Concern | Approach |
|---------|----------|
| Routes | Preserve `/globalfluview/api/...` (or versioned equivalent with redirect) |
| Auth | Basic for IWOPS; design for **multiple outlet credentials / scopes** later |
| Envelope | Keep Iwops v2 for GFV outlet; other outlets may use different shapes |
| Data path | Prefer **in-process / shared DB** or versioned export views — retire fragile dual-DB weekly `crosstab` sync when safe |
| Symptom / ILI | Explicit outlet policy (see risks); do not silently match mobile ADR-002 without owner decision |
| Expansion | Second system outlet = new adapter + auth + contract tests, not a third long-lived Django app |

### Non-goals until Phase B

- Re-implementing GFV inside mobile-only OpenAPI without multi-outlet design.
- Dual-writing health POSTs through GFV.

## Risks (pre-port)

1. **crosstab(text) pivot — CONFIRMED** on prod (Fable Max): single-arg crosstab stores **symptom-count thresholds**, not named symptoms. Effective: `sym_fever`/`is_ili` ⇔ ≥1 any symptom; ILI ~**2.8×** inflated historically; all **216** stored GFV weeks structurally threshold-shaped. See [GFV_F1_CROSSTAB_VERIFY.md](./GFV_F1_CROSSTAB_VERIFY.md).
2. **Vocabulary drift — CONFIRMED**: modern reports use Thai free-text / new slugs; catalog names nearly dead. Even a label-correct pivot would miss most current symptoms without a mapping table.
3. **ILI definitions** — Sails ADR-002 vs GFV intended (+headache) vs stored effective **any symptom**.
4. **Privacy** — exact lat/lon (home-address fallback), postal code, stable internal `users.id` as ParticipantId.
5. **EOL stack** — Ubuntu 14.04 / Django 3.2 / Python 3.6 on shared box.
6. **Sync ops** — weekly DDL `CREATE EXTENSION` on primary; full-table pivot; late reports missed; cron 09:00 vs docs 10:00.

## Phase B port requirements (from F1)

- Replace crosstab with conditional aggregation / Python mapping — **do not port crosstab**.
- Symptom vocabulary map (Thai + legacy English + free-text policy).
- Explicit outlet `is_ili` policy (owner decision).
- Historical **backfill of all weeks** from raw `sicksense` (**ADR-003 option A**): replay job + staged swap, not last-week-only cron.
- No DDL on read path; half-open week intervals; optional late-arrival re-sync.

## Still open (product)

- Exact ILI + Thai/English symptom mapping table for replay (must be fixed **before** bulk re-export).
- Pseudonymize ParticipantId / reduce coordinate precision for new outlets.
- Path-only forever vs optional hyphenated hostname.
