# Review synthesis: inventory A vs independent report B

**Date:** 2026-07-31  
**Reviewers:** Independent Grok report (B); Fable Max; Codex Sol Ultra; this inventory (A).

## Verdict

| Artifact | Role |
|----------|------|
| **A (`docs/migration/*`)** | Better **structure** for contracts (routes, policies, envelope). Required fixes applied below. |
| **B (independent report)** | Better **risk radar** (userReports leak, GFV question, cutover narrative). Some claims wrong (ILI formula). |
| **Neither alone** | Sufficient for coding FastAPI without golden fixtures + prod nginx truth. |

## Agreement (keep)

- Legacy Sails 0.10 / PostGIS / explicit routes / blueprints off.
- Query-param auth; dual device + sicksense identity.
- Target: FastAPI + SQLAlchemy 2 + Alembic + PG 16/17 PostGIS; client parity.
- Unrouted anomalies: login / reports index (and dashboard index).

## Corrections applied to A

1. **`userReports`** documents **global** page + count (not filtered by user). See ADR-001.  
2. **ILI** is **any-of** `{fever, cough, sore-throat}`. See ADR-002. Reject B’s “fever + respiratory” wording.  
3. **Registration** required fields corrected (`email`/`password` required; uuid/demographics optional in validate).  
4. **GFV** section: originally “not in repo / verify ops” — **ops verified 2026-07-31** (see below).  
5. **Cutover:** prefer single writer + shadow validation over nginx dual-write of POSTs (Codex).

## Divergences resolved

| Topic | Winner | Note |
|-------|--------|------|
| userReports SQL | B + code | Privacy + parity decision |
| ILI formula | Code (not B’s prose) | Any ILI symptom (Sails) |
| GFV in this app | **Separate service** | Path-mounted Django; not Sails |
| Contract field detail | A (fixed) | B lacked field matrices |
| Migration phases | Merge | A inventory → B phases without dual-write |

## GFV multi-review (2026-07-31)

**Reviewers:** Grok + Fable Max + Codex Sol Ultra (independent).  
**Doc:** [GLOBAL_FLU_VIEW.md](./GLOBAL_FLU_VIEW.md)

| Topic | Review consensus | Owner update (same day) |
|-------|------------------|-------------------------|
| Topology | Separate Django/uWSGI under `api.sicksense.org/globalfluview/*`; own DB; weekly sync | Confirmed |
| Historical DNS | Intent half-met; name NXDOMAIN | **Never fulfilled**; leave closed (path is live) |
| Credentials / owner | Unknown | **Owner holds Basic** |
| Mobile early phases | Keep separate; cutover dependency | Keep live Django during mobile rewrite |
| Final codebase | Default “keep separate” | **Override:** GFV **in** unified multi-outlet Python service (Phase B) |
| Highest risks | `crosstab` mis-map; privacy; EOL stack | **F1 CONFIRMED** (2.8× ILI inflate; all weeks corrupted) + vocab drift |

## Gaps still open

See [OPEN_QUESTIONS.md](./OPEN_QUESTIONS.md): remaining Sails prod routes, password bit-compat, week/TZ, trigger dump, golden wires; GFV F1 data-quality + Phase B outlet design.
