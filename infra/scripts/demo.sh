#!/usr/bin/env bash
# One command for a human demo: install (if needed), gen-env, build, stack:up, seed.
# Prints the URLs and user names. Passwords stay in .env. Next: npm run demo:browser
set -euo pipefail
source "$(dirname "$0")/lib.sh"
require_docker   # B-T1-12: before gen-env, so its old-data check can run
cd "$REPO_ROOT"
[[ -d node_modules ]] || npm ci --no-audit --no-fund
"$INFRA_DIR/scripts/gen-env.sh"
npm run --silent build
"$INFRA_DIR/scripts/stack-up.sh"
"$INFRA_DIR/scripts/seed.sh"
echo
echo "Demo ready. Open it with: npm run demo:browser   (passwords: .env)"
