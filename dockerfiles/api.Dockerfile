# Sicksense API image for local development.
#
# Node 6 is used locally because:
#   1. OrbStack injects `node -r /proc/.p` which Node 0.10/0.12 cannot parse.
#   2. Current npm registry pulls transitive deps needing ES6 (`let`/`const`/arrows).
#   3. Node 6 is the oldest LTS that runs under OrbStack and loads a fresh install.
#
# npm@3 flattens deps; Sails 0.10 hardcodes nested module paths — see nest-sails-modules.sh.
# Build context is the repo root (see docker-compose.dev.yml).
FROM node:6

LABEL org.opencontainers.image.title="sicksense-api" \
      org.opencontainers.image.description="Sicksense Sails API (local/dev)"

WORKDIR /app

COPY package.json ./

COPY dockerfiles/nest-sails-modules.sh /usr/local/bin/nest-sails-modules.sh
RUN chmod +x /usr/local/bin/nest-sails-modules.sh

# Install once into the image. Keep a pristine copy for empty named volumes
# (compose mounts a volume over /app/node_modules for host bind-mounts).
RUN npm install --unsafe-perm \
 || npm install --unsafe-perm --no-optional \
 && /usr/local/bin/nest-sails-modules.sh \
 && cp -a node_modules /opt/node_modules.image

COPY . .

RUN if [ ! -f config/local.js ] && [ -f config/local.js.example ]; then \
      cp config/local.js.example config/local.js; \
    fi

EXPOSE 1337

COPY dockerfiles/api-entrypoint.sh /usr/local/bin/api-entrypoint.sh
RUN chmod +x /usr/local/bin/api-entrypoint.sh

ENTRYPOINT ["/usr/local/bin/api-entrypoint.sh"]
CMD ["node", "app.js"]
