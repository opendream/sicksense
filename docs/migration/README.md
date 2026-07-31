# Sicksense → Python + modern Postgres migration

## Goals (locked)

| Decision | Choice |
|----------|--------|
| API | **Faithful parity** with current mobile/web contracts |
| Stack | **FastAPI + SQLAlchemy 2 + Alembic** |
| Clients | Existing mobile / consumers must keep working |
| Database | **PostgreSQL 16/17 + PostGIS**, migrate existing data |
| This branch | **Full API surface inventory only** (no Python app yet) |

## Documents

| File | Purpose |
|------|---------|
| [API_INVENTORY.md](./API_INVENTORY.md) | Every endpoint: auth, inputs, outputs, notes |
| [RESPONSE_ENVELOPE.md](./RESPONSE_ENVELOPE.md) | Shared success/error JSON shapes |
| [DOMAIN_TABLES.md](./DOMAIN_TABLES.md) | High-level data domains vs tables (for PG migrate) |
| [OPEN_QUESTIONS.md](./OPEN_QUESTIONS.md) | Ambiguities found while sweeping |

## Next (not this PR)

1. OpenAPI 3 draft generated from inventory + tests.
2. Scaffold FastAPI service + Alembic against PG 16/17 PostGIS.
3. Slice-by-slice parity (auth → users → reports → dashboard → admin/cron).
