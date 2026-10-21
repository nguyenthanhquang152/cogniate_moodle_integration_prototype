#!/usr/bin/env bash
# WARNING: deletes all stack data: Moodle site, database, the LTI service database (infra/.data/lti-service/),
# the Cogniate app database and package store (infra/.data/cogniate-app/),
# infra/.secrets/seed.json and the LTI API key files, infra/.logs/, infra/.data/backups/ and the test knobs
# (.tmp/compose.knobs.yaml).
# Keeps .env (same passwords), infra/.certs/ (same CA, so trust stays valid) and infra/.data/fixtures/.
# Works without .env too (for example after .env was lost): it then removes the project by its Docker labels.
# Next: npm run stack:up && npm run seed
# ADR-012 §7: guarded by the operation lock only (it is never a recovery step: §9 quarantine is the exit). It also
# removes the volumes ltidb and appdb (down -v), the legacy bind folders and the content folders of this project.
set -euo pipefail
source "$(dirname "$0")/lib.sh"
storage_compat_guard
storage_lock_acquire "stack:reset"
require_docker
require_own_project   # A-T1-09: never delete another checkout's stack
stop_build_runner
# B-T8-01: interrupted builds leave cogniate-build-* containers, volumes and networks; remove them too (only this
# stack's: label org.cogniate.stack=$COMPOSE_PROJECT_NAME; other stacks on this Docker host keep their builds).
bash "$INFRA_DIR/scripts/build-runner.sh" sweep >/dev/null 2>&1 || true
if [[ -f "$ENV_FILE" ]]; then
  dc --profile test --profile acceptance down -v --remove-orphans
else
  # Without .env the project name must be given on purpose (the default could name another checkout's stack).
  if [[ -z "${_shell_COMPOSE_PROJECT_NAME:-}" ]]; then
    echo "No .env: set the project to delete on purpose, for example: COMPOSE_PROJECT_NAME=$COMPOSE_PROJECT_NAME npm run stack:reset" >&2
    exit 1
  fi
  label="label=com.docker.compose.project=$COMPOSE_PROJECT_NAME"
  ids="$(docker ps -aq --filter "$label")"; [[ -z "$ids" ]] || docker rm -f $ids >/dev/null
  vols="$(docker volume ls -q --filter "$label")"; [[ -z "$vols" ]] || docker volume rm $vols >/dev/null
  nets="$(docker network ls -q --filter "$label")"; [[ -z "$nets" ]] || docker network rm $nets >/dev/null
  echo "No .env: removed project '$COMPOSE_PROJECT_NAME' by its Docker labels."
fi
rm -f "$INFRA_DIR/.secrets/seed.json" "$INFRA_DIR/.secrets/moodle-ws.json" "$INFRA_DIR/.secrets"/lti-api-key.* "$KNOBS_FILE" \
  "$REPO_ROOT/.tmp/certs-in-use.$COMPOSE_PROJECT_NAME.sha256" "$REPO_ROOT/.tmp/qa-certs-in-use.$COMPOSE_PROJECT_NAME.sha256" "$PROFILE_FILE"
rm -rf "$INFRA_DIR/.secrets/app" "$INFRA_DIR/.data/build-queue" "$INFRA_DIR/.data/backups" "$INFRA_DIR/.data/lti-service" "$INFRA_DIR/.data/cogniate-app" "$LOGS_DIR"
echo "Stack data deleted. Kept: .env, infra/.certs/, infra/.data/fixtures/. Next: npm run stack:up && npm run seed"
