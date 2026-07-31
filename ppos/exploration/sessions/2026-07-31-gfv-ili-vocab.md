# Exploration session — GFV ILI & symptom mapping

**Date:** 2026-07-31  
**Mode:** requirement-analysis (note for later confirmation)  
**Human:** keep as PPOS items to confirm later (not resolved now)

## Observations (stable enough to cite, not outlet decisions)

- Sails ILI: any of slugs `fever|cough|sore-throat` (`config/symptoms.js`, ADR-002).  
- GFV sync intends `fever|cough|headache|sore-throat` and recomputes; does not use `reports.isILI`.  
- F1 prod verify: stored GFV flags corrupted by crosstab; effective any-symptom ILI.  
- Prod symptom names drifted to Thai free-text; catalog-only match insufficient for re-export.  
- Owner: historical re-export option A (ADR-003); GFV in Phase B multi-outlet codebase.

## Open unknowns (promoted to wiki)

- [U01](../../wiki/unknown-U01-gfv-outlet-ili-rule.md) — outlet ILI rule  
- [U02](../../wiki/unknown-U02-gfv-symptom-vocabulary-map.md) — vocabulary map  

## Not promoted as rules yet

Outlet ILI and full mapping remain **unconfirmed** until owner chooses.