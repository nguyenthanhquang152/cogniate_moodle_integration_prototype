#!/usr/bin/env bash
# Start the stack and wait until every service is healthy (at most 300 s). Then print the four URLs.
# It runs gen-env first (makes or updates .env and the certificates), so the CA exists before any container.
set -euo pipefail
source "$(dirname "$0")/lib.sh"
require_docker
"$INFRA_DIR/scripts/gen-env.sh"
source "$(dirname "$0")/lib.sh"   # load the new .env
require_env
warn_knobs
check_public_port
mkdir -p "$INFRA_DIR/.secrets" "$INFRA_DIR/.data/fixtures" "$INFRA_DIR/.data/backups" "$INFRA_DIR/.data/lti-service" "$LOGS_DIR"
chmod 700 "$INFRA_DIR/.secrets" "$LOGS_DIR" "$INFRA_DIR/.data/lti-service"   # the Node services run as the host user (HOST_UID)

# The certificate files are bind-mounted one by one. A container keeps the old file after gen-certs replaces
# it, so recreate the containers when the certificates changed since the last start.
certs_now="$(cat "$CERTS_DIR/root.crt" "$CERTS_DIR/stack.crt" | openssl dgst -sha256 | awk '{print $NF}')"
certs_seen_file="$REPO_ROOT/.tmp/certs-in-use.$COMPOSE_PROJECT_NAME.sha256"
recreate=()
if [[ -n "$(dc ps -q 2>/dev/null)" && "$(cat "$certs_seen_file" 2>/dev/null || true)" != "$certs_now" ]]; then
  echo "The certificates changed since the last start: recreating the containers."
  recreate=(--force-recreate)
fi

start=$(date +%s)
if ! dc up -d --wait --wait-timeout 300 "${recreate[@]+"${recreate[@]}"}"; then
  show_unhealthy_logs
  echo "The stack is not healthy after $(( $(date +%s) - start )) s. See the log lines above." >&2
  echo "Common fixes: npm run stack:logs -- <service>; a new .env with old data needs npm run stack:reset." >&2
  exit 1
fi
mkdir -p "$(dirname "$certs_seen_file")"; echo "$certs_now" > "$certs_seen_file"
echo "Stack healthy in $(( $(date +%s) - start )) s. Next: npm run seed"
print_urls
