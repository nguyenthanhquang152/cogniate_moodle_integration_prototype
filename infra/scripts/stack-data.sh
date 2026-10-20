#!/usr/bin/env bash
# Upgrade and rollback maintenance (ADR-011 §14):
#   npm run stack:data-backup  -- --out  <folder outside the checkout>
#   npm run stack:data-restore -- --from <folder>
# Both refuse to run unless cogniate-app and lti-service are KNOWN to be stopped (stop both first). The backup holds both
# databases and their sidecars with a verified manifest; the restore validates the whole backup before it changes any file.
# WARNING: a restore loses every Cogniate write after the backup. Never edit a migration ledger row.
set -euo pipefail
source "$(dirname "$0")/lib.sh"
cmd="${1:-}"; shift || true
case "$cmd" in backup|restore) ;; *) echo "Usage: stack-data.sh backup --out <folder> | restore --from <folder>" >&2; exit 2 ;; esac
# Only a positively observed stop permits maintenance (B-M1-02): Docker answers, `compose ps` succeeds, and each
# cogniate-app and lti-service container is stopped (exited, created or dead) or does not exist. An unknown state
# (no Docker, no answer, a failed ps, or any other state such as restarting or paused) refuses before the Node program.
refuse() { echo "$1 Nothing was changed." >&2; exit 1; }
command -v docker >/dev/null 2>&1 || refuse "Cannot check that cogniate-app and lti-service are stopped: docker is not installed."
docker info >/dev/null 2>&1 || refuse "Cannot check that cogniate-app and lti-service are stopped: Docker does not answer. Start Docker, then run the command again."
states="$(dc ps -a --format '{{.Service}} {{.State}}' 2>/dev/null)" || refuse "Cannot check that cogniate-app and lti-service are stopped: docker compose ps failed."
not_stopped=""
while read -r service state; do
  case "$service" in cogniate-app|lti-service) ;; *) continue ;; esac
  case "$state" in exited|created|dead) ;; *) not_stopped+="$service ($state) " ;; esac
done <<< "$states"
[[ -z "$not_stopped" ]] || refuse "Stop the services first: ${not_stopped}is not stopped. Use the stack's compose stop for cogniate-app and lti-service."
revision="$(git -C "$REPO_ROOT" rev-parse HEAD 2>/dev/null || echo unknown)"
exec node "$INFRA_DIR/scripts/stack-data.mjs" "$cmd" "$@" --data "$INFRA_DIR/.data" --project "$COMPOSE_PROJECT_NAME" --revision "$revision" --repo "$REPO_ROOT"
