#!/usr/bin/env bash
# WARNING: deletes all stack data: Moodle site, database, infra/.secrets/seed.json, infra/.logs/,
# infra/.data/backups/ and the test knobs (.tmp/compose.knobs.yaml).
# Keeps .env (same passwords), infra/.certs/ (same CA, so trust stays valid) and infra/.data/fixtures/.
# Works without .env too (for example after .env was lost): it then removes the project by its Docker labels.
# Next: npm run stack:up && npm run seed
set -euo pipefail
source "$(dirname "$0")/lib.sh"
require_docker
if [[ -f "$ENV_FILE" ]]; then
  dc --profile test down -v --remove-orphans
else
  label="label=com.docker.compose.project=$COMPOSE_PROJECT_NAME"
  ids="$(docker ps -aq --filter "$label")"; [[ -z "$ids" ]] || docker rm -f $ids >/dev/null
  vols="$(docker volume ls -q --filter "$label")"; [[ -z "$vols" ]] || docker volume rm $vols >/dev/null
  nets="$(docker network ls -q --filter "$label")"; [[ -z "$nets" ]] || docker network rm $nets >/dev/null
  echo "No .env: removed project '$COMPOSE_PROJECT_NAME' by its Docker labels."
fi
rm -f "$INFRA_DIR/.secrets/seed.json" "$INFRA_DIR/.secrets/moodle-ws.json" "$KNOBS_FILE" \
  "$REPO_ROOT/.tmp/certs-in-use.$COMPOSE_PROJECT_NAME.sha256"
rm -rf "$INFRA_DIR/.data/backups" "$LOGS_DIR"
echo "Stack data deleted. Kept: .env, infra/.certs/, infra/.data/fixtures/. Next: npm run stack:up && npm run seed"
