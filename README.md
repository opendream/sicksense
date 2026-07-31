# Sicksense API

Sails.js API for community symptom reporting and ILI (influenza-like illness) surveillance.

## Tech stack

| Layer | Technology |
| ----- | ---------- |
| API | [Sails.js](https://sailsjs.com/) 0.10 |
| Database | PostgreSQL + PostGIS |
| Auth | Access tokens, optional shared tokens, onetime tokens |
| Mail / push | Mailgun, APNs, GCM (configure via local config; not required for basic local lift) |
| API docs | `apiary.apib` (Apiary Blueprint) |
| Local run | Docker Compose + Makefile (layout similar to epicore2) |

## Repository structure

| Path | Description |
| ---- | ----------- |
| `api/` | Controllers, services, models, policies |
| `config/` | Sails config; **`config/local.js` is gitignored** |
| `db/` | SQL migrations and location seed assets |
| `assets/` | Email templates, static assets, Grunt inputs |
| `test/` | Mocha controller/service tests |
| `docker-compose.dev.yml` | Local stack |
| `Makefile` | Local Docker workflow |
| `dockerfiles/` | Images and local helper scripts ([detail](dockerfiles/README.md)) |
| `tmp/` | Local dump files only (gitignored; never commit) |
| `apiary.apib` | HTTP API blueprint |

## Prerequisites

- **Docker** (with Compose)
- **Make**

On Apple Silicon, amd64 images may run via emulation.

## Local development

### Quick start

```bash
# From repo root
make up

# Optional: empty schema from db/*.sql
make db-schema

curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:1337/
# expect 200
```

`make up` creates `config/local.js` from `config/local.js.example` if it is missing.

### Load a SQL dump (optional)

If you already have a dump file on your machine:

```bash
make up
make db-restore DUMP=tmp/dump.sql
```

- Prefer files under **`tmp/`** (gitignored).
- Do not commit dumps. They may contain personal data.

### Services

| Service | URL / port | Purpose |
| ------- | ---------- | ------- |
| API (Sails) | http://localhost:1337 | HTTP API + homepage |
| PostgreSQL + PostGIS | `localhost:25432` | User `sicksense`, password `sicksense`, database `sicksense` |

Inside Compose, the API reaches the DB as host **`db`** (see `config/local.js.example`).

### Makefile targets

| Target | Description |
| ------ | ----------- |
| `make up` | Build and start `db` + `api` |
| `make down` | Stop containers |
| `make down-v` | Stop and remove volumes (wipes local DB) |
| `make build` | Build images only |
| `make logs` | Follow logs |
| `make ps` | List containers |
| `make db-shell` | `psql` into the local database |
| `make db-schema` | Apply empty schema from `db/[0-9]*.sql` |
| `make db-locations` | Load `db/locations.sql` |
| `make db-restore DUMP=…` | Wipe `public` and restore a dump (keeps PostGIS) |
| `make db-load DUMP=…` | Load SQL with `psql` (no wipe) |
| `make db-reset` | Wipe volumes, start stack; restore `DUMP_FILE` if present, else schema |
| `make api-shell` | Shell in the API container |

### Verify the database has data

```bash
docker compose -f docker-compose.dev.yml exec -T db \
  psql -U sicksense -d sicksense -c "
SELECT
  (SELECT count(*) FROM users)     AS users,
  (SELECT count(*) FROM reports)   AS reports,
  (SELECT count(*) FROM locations) AS locations;
"
```

Spot-check:

```bash
docker compose -f docker-compose.dev.yml exec -T db \
  psql -U sicksense -d sicksense -c \
  "SELECT id, email FROM users ORDER BY id DESC LIMIT 5;"
```

Confirm the API points at the Compose DB:

```bash
docker compose -f docker-compose.dev.yml exec -T api \
  node -e "var c=require('./config/local.js').connections.postgresql; console.log(c.host, c.database);"
# expect: db sicksense
```

## Configuration

| File | Role |
| ---- | ---- |
| `config/local.js.example` | Safe local defaults for Docker (committed) |
| `config/local.js` | Machine-local overrides (gitignored; created on `make up`) |
| `.sailsrc` | Sails rc (hooks / generators) |

To run the API on the host against the published Postgres port, set `host: '127.0.0.1'` and `port: 25432` in `config/local.js`.

## API documentation

- Blueprint: [`apiary.apib`](apiary.apib)
- Routes: [`config/routes.js`](config/routes.js)

## Tests

```bash
npm test
```

Tests target the legacy Node runtime and need a configured test database. The Docker stack here is aimed at running the API, not the test suite.

## More detail

- Docker images and scripts: **[dockerfiles/README.md](dockerfiles/README.md)**
- Python rewrite / API I/O inventory: **[docs/migration/](docs/migration/)**
- Multi-agent orchestration notes: **[AGENTS.md](AGENTS.md)**

## License

MIT — see [LICENSE](LICENSE).
