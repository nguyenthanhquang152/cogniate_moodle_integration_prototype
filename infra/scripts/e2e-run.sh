#!/usr/bin/env bash
# Run a command in the e2e container (Playwright 1.56.0) on the stack network, repo mounted at /repo.
# The browser trusts the stack CA (NSS), Node trusts it (NODE_EXTRA_CA_CERTS).
# Usage: infra/scripts/e2e-run.sh npx playwright test -c tests/acceptance
set -euo pipefail
source "$(dirname "$0")/lib.sh"
require_env
require_running proxy
if [[ ! -d "$REPO_ROOT/node_modules/@playwright/test" ]]; then echo "Run npm ci first." >&2; exit 1; fi
dc --profile test run --rm --build e2e "$@"
