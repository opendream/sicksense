# Local PostGIS (PostgreSQL 9.3 + PostGIS 2.x), epicore2 dockerfiles/ pattern.
FROM mdillon/postgis:9.3

# Local-only: allow passwordless TCP auth inside the compose network.
# Node's old `pg` client failed MD5 auth against this image under OrbStack.
COPY zz-pg-hba-trust.sh /docker-entrypoint-initdb.d/zz-pg-hba-trust.sh
RUN chmod +x /docker-entrypoint-initdb.d/zz-pg-hba-trust.sh
