# Sicksense → Python + modern Postgres migration

## Goals (locked)

| Decision | Choice |
|----------|--------|
| API | **Faithful API parity** with current mobile/web contracts |
| Stack | **FastAPI + SQLAlchemy 2 + Alembic** |
| Clients | Existing mobile / consumers must keep working |
| Database | **PostgreSQL 16/17 + PostGIS**, migrate existing data |
| Outlets | **GFV / multi-outlet export in final codebase** (Phase B); live Django until then |
| Inventory branch | Full API surface inventory (docs only) |

## Documents

| File | Purpose |
|------|---------|
| [API_INVENTORY.md](./API_INVENTORY.md) | Endpoints: auth, inputs, outputs, notes |
| [RESPONSE_ENVELOPE.md](./RESPONSE_ENVELOPE.md) | Shared success/error JSON shapes |
| [DOMAIN_TABLES.md](./DOMAIN_TABLES.md) | Domains ↔ tables / PostGIS / triggers |
| [OPEN_QUESTIONS.md](./OPEN_QUESTIONS.md) | Blockers and product decisions |
| [REVIEW_SYNTHESIS.md](./REVIEW_SYNTHESIS.md) | A vs B + Fable/Codex consensus |
| [GLOBAL_FLU_VIEW.md](./GLOBAL_FLU_VIEW.md) | GFV topology + multi-outlet Phase B scope |
| [GFV_F1_CROSSTAB_VERIFY.md](./GFV_F1_CROSSTAB_VERIFY.md) | Prod SQL proof: crosstab symptom corruption (CONFIRMED) |
| [ADR-001-userReports-behavior.md](./ADR-001-userReports-behavior.md) | Global report list bug/behavior |
| [ADR-002-ili-rule.md](./ADR-002-ili-rule.md) | ILI any-of rule (Sails; GFV differs) |
| [ADR-003-gfv-history-reexport.md](./ADR-003-gfv-history-reexport.md) | Rebuild all GFV historical weeks (option A) |

## Consensus next steps

1. Golden wire fixtures (incl. **two users** for `userReports`).  
2. Schema/trigger dump → PG 16/17 characterization.  
3. Mobile FastAPI slices: auth → reports → dashboard → admin/cron (keep GFV Django alive).  
4. Cutover: main schema + GFV sync co-tenancy gates ([GLOBAL_FLU_VIEW.md](./GLOBAL_FLU_VIEW.md)).  
5. **Phase B:** port GFV into unified multi-outlet module; **replay all historical weeks** (ADR-003); retire dual-DB sync when safe; design for additional outlets.

## Explicit non-goals (until ADRs say otherwise)

- Dropping live `/globalfluview` before Phase B port is verified.  
- Dual-writing POSTs to old and new backends.  
- Blind major bumps (Sails 1 / Lodash 4) on the legacy Node app.  
- Creating DNS `api_globalfluview.sicksense.org` (NXDOMAIN; path is live; underscore unsuitable for public TLS).
