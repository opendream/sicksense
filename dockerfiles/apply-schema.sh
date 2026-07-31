#!/usr/bin/env bash
# Apply db/*.sql migrations in numeric order against the compose `db` service.
# Skips bulk data dumps and test helpers (locations.sql, procedure_test_cases.sql).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.dev.yml}"
DC=(docker compose -f "$COMPOSE_FILE")
DB_USER="${DB_USER:-sicksense}"
DB_NAME="${DB_NAME:-sicksense}"

cd "$ROOT"

if ! "${DC[@]}" ps --status running --services 2>/dev/null | grep -qx db; then
  echo "db service is not running. Start with: make up" >&2
  exit 1
fi

# Wait until Postgres accepts connections.
for i in $(seq 1 30); do
  if "${DC[@]}" exec -T db pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

apply_one() {
  local file="$1"
  echo "--> $file"
  # Some historical migrations re-add columns already present; do not hard-stop
  # the whole chain on a single statement error (log and continue).
  if ! "${DC[@]}" exec -T db psql -v ON_ERROR_STOP=0 -U "$DB_USER" -d "$DB_NAME" < "$file"; then
    echo "    (psql exited non-zero for $file — check output above)" >&2
  fi
}

# Numeric migration files only (1_, 2_, … 42_).
# Portable loop (macOS ships Bash 3.2 — no mapfile).
count=0
# shellcheck disable=SC2045
for f in $(ls -1 db/[0-9]*.sql 2>/dev/null | sort -V); do
  apply_one "$f"
  count=$((count + 1))
done

if [ "$count" -eq 0 ]; then
  echo "No db/[0-9]*.sql files found" >&2
  exit 1
fi

echo "Schema apply finished ($count files)."
