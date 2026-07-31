#!/usr/bin/env bash
# Restore a plain SQL (or custom-format) dump into the local compose PostGIS db.
#
# Usage:
#   ./dockerfiles/restore-dump.sh tmp/dump.sql
#   make db-restore DUMP=tmp/dump.sql
#
# By default wipes public schema (keeps PostGIS extension) then loads the dump.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.dev.yml}"
DC=(docker compose -f "$COMPOSE_FILE")
DB_USER="${DB_USER:-sicksense}"
DB_NAME="${DB_NAME:-sicksense}"
DUMP="${1:-${DUMP:-}}"
WIPE_PUBLIC="${WIPE_PUBLIC:-1}"

if [ -z "$DUMP" ]; then
  echo "Usage: $0 path/to/dump.sql" >&2
  exit 1
fi
if [ ! -f "$DUMP" ]; then
  echo "ERROR: dump not found: $DUMP" >&2
  exit 1
fi

if ! "${DC[@]}" ps --status running --services 2>/dev/null | grep -qx db; then
  echo "db service is not running. Start with: make up" >&2
  exit 1
fi

echo "=== restore-dump ==="
echo "DUMP      : $DUMP"
echo "DB        : $DB_USER@$DB_NAME"
echo "WIPE_PUBLIC: $WIPE_PUBLIC"
echo

# Wait for ready
for i in $(seq 1 30); do
  if "${DC[@]}" exec -T db pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if [ "$WIPE_PUBLIC" = "1" ]; then
  echo "Wiping public schema (recreate + PostGIS)..."
  "${DC[@]}" exec -T db psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" <<'SQL'
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO public;
GRANT ALL ON SCHEMA public TO sicksense;
CREATE EXTENSION IF NOT EXISTS postgis;
SQL
fi

# Detect custom-format dump (PGDMP magic) vs plain SQL
if head -c 5 "$DUMP" | grep -q 'PGDMP'; then
  echo "Restoring custom-format dump via pg_restore..."
  # pg_restore returns 1 on many non-fatal warnings; capture and show tail.
  set +e
  "${DC[@]}" exec -T db pg_restore \
    -U "$DB_USER" -d "$DB_NAME" \
    --no-owner --no-acl --verbose \
    < "$DUMP"
  rc=$?
  set -e
  if [ "$rc" -gt 1 ]; then
    echo "pg_restore failed with exit $rc" >&2
    exit "$rc"
  fi
else
  echo "Restoring plain SQL dump via psql..."
  "${DC[@]}" exec -T db psql -v ON_ERROR_STOP=0 -U "$DB_USER" -d "$DB_NAME" < "$DUMP"
fi

echo
echo "Row counts (public):"
"${DC[@]}" exec -T db psql -U "$DB_USER" -d "$DB_NAME" -c "
SELECT relname AS table, n_live_tup AS est_rows
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC NULLS LAST
LIMIT 15;
"

echo "Restore finished."
