# ADR-003: GFV historical re-export (option A)

**Status:** Accepted  
**Date:** 2026-07-31  
**Owner:** project owner  

## Context

Production GFV weekly snapshots are corrupted by single-arg `crosstab` misuse (see [GFV_F1_CROSSTAB_VERIFY.md](./GFV_F1_CROSSTAB_VERIFY.md)): stored symptom flags and `is_ili` are count-thresholds, not named symptoms. Raw `sicksense` tables still hold enough data to recompute correct weeks.

Two strategies after a fixed extractor ships:

| Option | Meaning |
|--------|---------|
| **A** | Rebuild **all** historical weeks from raw data and publish corrected history |
| **B** | Leave old weeks as-is; only new weeks use fixed logic |

## Decision

**Plan for A** — historical **re-export / backfill** of all GFV weeks from raw `sicksense` data when the multi-outlet export (Phase B) is ready.

## Consequences

- Phase B must include a **replay job** (all week windows since first GFV week ≈ 2021-08), not only a cron for “last week”.
- Need explicit **ILI + symptom vocabulary** policy before replay (catalog English + Thai free-text mapping); otherwise rebuilt history is still wrong for modern reports.
- Cutover should **stage** corrected weeks (shadow compare → swap) so a bad replay does not wipe the live feed without rollback.
- Consumers of old weeks (if any) will see **changed** SurveyCount / IsILI / symptom flags after republish — document as intentional correction, not silent drift.
- Mobile API rewrite (Phase A) is **not** blocked; replay runs in Phase B.

## Non-goals

- Fixing production Django sync before Phase B (optional hot-fix is separate and not required by this ADR).
- Changing the public path `/globalfluview/api/...` as part of A.
