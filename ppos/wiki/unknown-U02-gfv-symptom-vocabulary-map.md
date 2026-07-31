# Unknown U02 — GFV symptom vocabulary mapping

**Status:** open  
**Must confirm before:** Phase B GFV re-export of all historical weeks (ADR-003)  
**Depends on:** [unknown-U01-gfv-outlet-ili-rule.md](./unknown-U01-gfv-outlet-ili-rule.md) (ILI set uses mapped flags)

## Question

How do live `symptoms.name` values (English catalog slugs **and** Thai free-text **and** new slugs) map to GFV export flags?

GFV fields that need a yes/no (or null) per survey:

- `SymFever`, `SymCough`, `SymSoreThroat`, `SymHeadache`
- (and any future outlet symptom fields)
- plus `IsILI` once U01 is set, via mapped flags

## Known facts

1. **App config catalog** (`config/symptoms.js`): English **slug** + Thai **title** for predefined list; mobile ILI matches **slugs** only.  
2. **Prod DB:** ~14k `symptoms` names; majority of `reportssymptoms` rows are free-text (id > 13), not the fixed catalog.  
3. **Modern clients** often store Thai display text (e.g. `มีไข้`, `ไอ`, `เจ็บคอ`) instead of slugs `fever` / `cough` / `sore-throat`.  
4. Matching **only** English catalog names undercounts modern data (~90% miss risk per F1).  
5. Crosstab bug is separate; fixing labels without a vocab map is still insufficient.

## Mapping table to confirm later

| GFV flag | Provisional seed (not approved) | Confirm / extend |
|----------|----------------------------------|------------------|
| fever | `fever`, `มีไข้`, `ไข้`, `ตัวร้อน`, … | [ ] |
| cough | `cough`, `ไอ`, … | [ ] |
| sore-throat | `sore-throat`, `เจ็บคอ`, … | [ ] |
| headache | `headache`, `ปวดหัว`, `ปวดศีรษะ`, … | [ ] |
| ignore / other | free-text junk, drug names, `imfine` path, … | [ ] |

Also confirm:

- [ ] Case / punctuation / parenthetical variants (e.g. `ปวดศีรษะ (ปวดหัว)`)  
- [ ] Policy for unmapped free-text (drop vs “other” vs fail closed)  
- [ ] Whether main mobile create path still writes **slugs** while GFV reads **names** (dual-path consistency)

## Evidence / links

- [docs/migration/GLOBAL_FLU_VIEW.md](../../docs/migration/GLOBAL_FLU_VIEW.md)  
- [docs/migration/GFV_F1_CROSSTAB_VERIFY.md](../../docs/migration/GFV_F1_CROSSTAB_VERIFY.md)  
- [docs/migration/ADR-003-gfv-history-reexport.md](../../docs/migration/ADR-003-gfv-history-reexport.md)  
- Sibling GFV: `../sicksense_globalfluview` `sync_from_sicksense.py`  

## Resolution

- [ ] Owner-approved mapping table (versioned in repo)  
- [ ] Fixture tests for Thai + English + junk  
- [ ] Used by historical replay (option A)  

**Resolved:** _not yet_
