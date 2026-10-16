#!/usr/bin/env bash
# Start the stack and wait until every service is healthy. Then print the four URLs.
# It runs gen-env first (makes or updates .env and the certificates), so the CA exists before any container.
set -euo pipefail
source "$(dirname "$0")/lib.sh"
"$INFRA_DIR/scripts/gen-env.sh"
source "$(dirname "$0")/lib.sh"   # load the new .env
require_env
mkdir -p "$INFRA_DIR/.secrets" "$INFRA_DIR/.data/fixtures" "$INFRA_DIR/.data/backups" "$LOGS_DIR"
chmod 700 "$INFRA_DIR/.secrets"
chmod 777 "$LOGS_DIR"   # the Node containers (user node, uid 1000) append <service>.jsonl here
start=$(date +%s)
dc up -d --wait --wait-timeout 900
echo "Stack healthy in $(( $(date +%s) - start )) s. Next: npm run seed"
print_urls
