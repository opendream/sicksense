# Local Docker workflow (epicore2-style).
COMPOSE_FILE := docker-compose.dev.yml
DC := docker compose -f $(COMPOSE_FILE)
DB_USER := sicksense
DB_NAME := sicksense
# Optional dump path for db-load / db-restore (files under tmp/ are gitignored).
DUMP ?=
DUMP_FILE := $(if $(DUMP),$(DUMP),tmp/dump.sql)

.PHONY: up down down-v build logs ps \
	db-shell db-schema db-locations db-load db-restore db-reset \
	api-shell local-config

up: local-config
	$(DC) up --build -d

down:
	$(DC) down

down-v:
	$(DC) down -v

build:
	$(DC) build

logs:
	$(DC) logs -f

ps:
	$(DC) ps

local-config:
	@if [ ! -f config/local.js ]; then \
		cp config/local.js.example config/local.js; \
		echo "Created config/local.js from config/local.js.example"; \
	fi

db-shell:
	$(DC) exec db psql -U $(DB_USER) -d $(DB_NAME)

## Empty schema from repo migrations.
db-schema:
	@./dockerfiles/apply-schema.sh

db-locations:
	@$(DC) exec -T db psql -U $(DB_USER) -d $(DB_NAME) < db/locations.sql

## Simple load (no wipe). Pass DUMP=path/to/dump.sql
db-load:
	@if [ ! -f "$(DUMP_FILE)" ]; then \
		echo "Usage: make db-load DUMP=path/to/dump.sql"; \
		echo "Missing: $(DUMP_FILE)"; \
		exit 1; \
	fi
	$(DC) exec -T db psql -U $(DB_USER) -d $(DB_NAME) < "$(DUMP_FILE)"

## Wipe public schema and restore DUMP (PostGIS kept).
db-restore:
	@if [ -z "$(DUMP)" ] && [ ! -f "$(DUMP_FILE)" ]; then \
		echo "Usage: make db-restore DUMP=path/to/dump.sql"; \
		exit 1; \
	fi
	@./dockerfiles/restore-dump.sh "$(DUMP_FILE)"

## Wipe volumes and start fresh. Loads DUMP_FILE if present, else empty schema.
db-reset: down-v up
	@echo "Waiting for db to be ready..."
	@until $(DC) exec db pg_isready -U $(DB_USER) -d $(DB_NAME) > /dev/null 2>&1; do sleep 1; done
	@if [ -f "$(DUMP_FILE)" ]; then \
		$(MAKE) db-restore DUMP="$(DUMP_FILE)"; \
	else \
		$(MAKE) db-schema; \
		echo "No $(DUMP_FILE); applied empty schema."; \
	fi
	@echo "Database reset finished."

api-shell:
	$(DC) exec api /bin/bash
