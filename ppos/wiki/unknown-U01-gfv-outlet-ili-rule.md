# Unknown U01 — GFV / multi-outlet ILI rule

**Status:** open  
**Must confirm before:** Phase B GFV port and historical re-export (ADR-003 option A)  
**Not blocking:** mobile FastAPI Phase A (Sails parity uses ADR-002)

## Question

Which **ILI set** should the GFV / multi-outlet export use when recomputing `IsILI`?

## Known facts (do not treat as the outlet decision)

| Source | Rule | Status |
|--------|------|--------|
| Sails mobile API | `isILI` = any of `{fever, cough, sore-throat}` by **slug** | Code truth; [docs/migration/ADR-002-ili-rule.md](../../docs/migration/ADR-002-ili-rule.md) |
| GFV sync **code intent** | `is_ili` = any of `{fever, cough, headache, sore-throat}` by pivot columns | Differs: **includes headache**; ignores `reports.isILI` |
| GFV **stored data today** | Effective ≈ “any symptom ≥ 1” | Bug (crosstab); [docs/migration/GFV_F1_CROSSTAB_VERIFY.md](../../docs/migration/GFV_F1_CROSSTAB_VERIFY.md) |

## Options (for later confirmation)

1. Match mobile ADR-002: `{fever, cough, sore-throat}` only  
2. Keep GFV code intent: add `headache`  
3. Other (e.g. classic fever + respiratory) — would need explicit product write-up  

## Resolution

- [ ] Owner confirms option  
- [ ] Linked from Phase B plan / outlet contract tests  
- [ ] Applied in re-export replay job  

**Resolved:** _not yet_
