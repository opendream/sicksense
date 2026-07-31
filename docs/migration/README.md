# Sicksense → Python + modern Postgres migration

## Goals (locked)

| Decision | Choice |
|----------|--------|
| API | **Faithful API parity** with current mobile/web contracts |
| Stack | **FastAPI + SQLAlchemy 2 + Alembic** |
| Clients | Existing mobile / consumers must keep working |
| Database | **PostgreSQL 16/17 + PostGIS**, migrate existing data |
| Inventory branch | Full API surface inventory (docs only) |

## Documents

| File | Purpose |
|------|---------|
| [API_INVENTORY.md](./API_INVENTORY.md) | Endpoints: auth, inputs, outputs, notes |
| [RESPONSE_ENVELOPE.md](./RESPONSE_ENVELOPE.md) | Shared success/error JSON shapes |
| [DOMAIN_TABLES.md](./DOMAIN_TABLES.md) | Domains ↔ tables / PostGIS / triggers |
| [OPEN_QUESTIONS.md](./OPEN_QUESTIONS.md) | Blockers and product decisions |
| [REVIEW_SYNTHESIS.md](./REVIEW_SYNTHESIS.md) | A vs B + Fable/Codex consensus |
| [ADR-001-userReports-behavior.md](./ADR-001-userReports-behavior.md) | Global report list bug/behavior |
| [ADR-002-ili-rule.md](./ADR-002-ili-rule.md) | ILI any-of rule |

## Consensus next steps

1. Prod nginx/route map (resolves unrouted paths + GFV ownership).  
2. Golden wire fixtures (incl. **two users** for `userReports`).  
3. Schema/trigger dump → PG 16/17 characterization.  
4. Per-endpoint OpenAPI from inventory + fixtures.  
5. FastAPI skeleton; slices: auth → reports → dashboard → admin/cron.

## Explicit non-goals (until ADRs say otherwise)

- Inventing Global Flu View routes without ops proof.  
- Dual-writing POSTs to old and new backends.  
- Blind major bumps (Sails 1 / Lodash 4) on the legacy Node app.
