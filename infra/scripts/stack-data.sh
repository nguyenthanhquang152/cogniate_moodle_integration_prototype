#!/usr/bin/env bash
# Upgrade and rollback maintenance (ADR-011 §14):
#   npm run stack:data-backup  -- --out  <folder outside the checkout>
#   npm run stack:data-restore -- --from <folder>
# Both refuse to run while cogniate-app or lti-service runs (stop both first). The backup holds both databases and
# their sidecars with a verified manifest; the restore validates the whole backup before it changes any file.
# WARNING: a restore loses every Cogniate write after the backup. Never edit a migration ledger row.
set -euo pipefail
source "$(dirname "$0")/lib.sh"
cmd="${1:-}"; shift || true
case "$cmd" in backup|restore) ;; *) echo "Usage: stack-data.sh backup --out <folder> | restore --from <folder>" >&2; exit 2 ;; esac
running=""
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  running="$(dc ps --status running --services 2>/dev/null | grep -Ex 'cogniate-app|lti-service' || true)"
fi
if [[ -n "$running" ]]; then
  echo "Stop the services first: $(tr '\n' ' ' <<< "$running")is running. Use the stack's compose stop for cogniate-app and lti-service." >&2
  exit 1
fi
revision="$(git -C "$REPO_ROOT" rev-parse HEAD 2>/dev/null || echo unknown)"
exec node "$INFRA_DIR/scripts/stack-data.mjs" "$cmd" "$@" --data "$INFRA_DIR/.data" --project "$COMPOSE_PROJECT_NAME" --revision "$revision" --repo "$REPO_ROOT"
