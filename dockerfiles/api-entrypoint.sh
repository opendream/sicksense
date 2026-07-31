#!/bin/sh
# Entrypoint for the Sicksense API container.
set -e

cd /app

if [ ! -f config/local.js ]; then
  if [ -f config/local.js.example ]; then
    echo "[entrypoint] config/local.js missing — copying config/local.js.example"
    cp config/local.js.example config/local.js
  else
    echo "[entrypoint] ERROR: config/local.js and config/local.js.example are both missing" >&2
    exit 1
  fi
fi

# Compose mounts a named volume over /app/node_modules. Seed it from the image
# copy so Sails 0.10 keeps nested deps (npm@3 flattens and breaks hardcoded paths).
if [ ! -f node_modules/sails/package.json ]; then
  if [ -d /opt/node_modules.image/sails ]; then
    echo "[entrypoint] Seeding node_modules from image..."
    cp -a /opt/node_modules.image/. node_modules/
  else
    echo "[entrypoint] node_modules incomplete and no image seed — npm install"
    npm install --unsafe-perm || npm install --unsafe-perm --no-optional
  fi
fi

# Idempotent: restore prod-like nested paths (incl. sails/node_modules/grunt-cli).
if [ -x /usr/local/bin/nest-sails-modules.sh ]; then
  /usr/local/bin/nest-sails-modules.sh /app
elif [ -x /app/dockerfiles/nest-sails-modules.sh ]; then
  /app/dockerfiles/nest-sails-modules.sh /app
fi

if ! node -e "require('sails')" 2>/tmp/sails-require.err; then
  echo "[entrypoint] ERROR: require('sails') failed:" >&2
  cat /tmp/sails-require.err >&2
  exit 1
fi

exec "$@"
