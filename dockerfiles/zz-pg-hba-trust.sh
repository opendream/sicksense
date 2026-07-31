#!/bin/bash
# Local-dev only: allow passwordless TCP auth inside the compose network.
# md5 auth from Node's `pg` client failed against this PostGIS 9.3 image under
# OrbStack; trust is acceptable for an isolated local stack (not for production).
set -e
if [ -n "$PGDATA" ] && [ -f "$PGDATA/pg_hba.conf" ]; then
  sed -i 's/^\(host all all all\) md5$/\1 trust/' "$PGDATA/pg_hba.conf"
  # Ensure a catch-all trust line exists.
  if ! grep -qE '^host all all all trust$' "$PGDATA/pg_hba.conf"; then
    echo 'host all all all trust' >> "$PGDATA/pg_hba.conf"
  fi
  echo "zz-pg-hba-trust: configured host all all all trust"
fi
