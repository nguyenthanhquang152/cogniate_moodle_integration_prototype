#!/usr/bin/env bash
# Run a command in the e2e container (Playwright 1.56.0) on the stack network, repo mounted at /repo.
# The browser trusts the stack CA (NSS), Node trusts it (NODE_EXTRA_CA_CERTS).
# Usage: infra/scripts/e2e-run.sh npx playwright test -c tests/acceptance
set -euo pipefail
source "$(dirname "$0")/lib.sh"
require_env
require_running proxy
if [[ ! -d "$REPO_ROOT/node_modules/@playwright/test" ]]; then echo "Run npm ci first." >&2; exit 1; fi
warn_knobs
prepare_e2e
qa_env_args
# Named container, removed on exit: without a TTY, docker compose run does not stop it on Ctrl+C.
run_name="${COMPOSE_PROJECT_NAME}-e2e-run-$$"
trap 'docker rm -f "$run_name" >/dev/null 2>&1 || true' EXIT
trap 'exit 130' INT TERM
dc --profile test run --rm --name "$run_name" --build "${QA_ENV_ARGS[@]+"${QA_ENV_ARGS[@]}"}" e2e "$@"
