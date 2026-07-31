# Local Docker (Sicksense API)

> Project guide: [../README.md](../README.md)

Layout similar to epicore2: root compose + Makefile + this directory.

| Path | Role |
|------|------|
| `../docker-compose.dev.yml` | Dev stack (`db` + `api`) |
| `../Makefile` | Local lifecycle only |
| `postgis-9.3.Dockerfile` | PostGIS image (+ local trust init) |
| `api.Dockerfile` | Sails API image |
| helper scripts | entrypoint, nest modules, schema apply, dump restore |

## Quick start

```bash
# from repo root
make up
make db-schema                    # empty schema
# or: make db-restore DUMP=tmp/dump.sql
curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:1337/
make logs
```

| Service | Host port |
|---------|-----------|
| `api` | `1337` |
| `db` | `25432` |

## Makefile

See root README. Targets only manage the **local** stack and optional local dump files under `tmp/` (gitignored).

## Config

| File | Role |
|------|------|
| `config/local.js.example` | Committed local defaults |
| `config/local.js` | Gitignored; created on first `make up` |

## Notes

- Grunt stays enabled; `nest-sails-modules.sh` restores nested module paths Sails expects.
- Local DB uses trust auth inside the compose network only (`zz-pg-hba-trust.sh`).
