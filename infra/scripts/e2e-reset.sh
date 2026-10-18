#!/usr/bin/env bash
# T7: npm run e2e:reset — a clean stack for the E2E suite and the demo. Idempotent (run it as often as you like).
#   1. stack:reset (WARNING: deletes all stack data; keeps .env, infra/.certs, infra/.data/fixtures)
#   2. stack:up with the default profile and no knobs
#   3. seed (users, courses, tool accounts, portal users)
#   4. wait until every /healthz answers with "profile":"default" and "knobs":[] and the Moodle admin can log in
set -euo pipefail
source "$(dirname "$0")/lib.sh"
require_env
require_docker
start=$(date +%s)
echo "== e2e:reset 1/4 stack:reset"
"$INFRA_DIR/scripts/stack-reset.sh"
echo "== e2e:reset 2/4 stack:up (default profile, no knobs)"
STACK_PROFILE=default "$INFRA_DIR/scripts/stack-up.sh"
echo "== e2e:reset 3/4 seed"
"$INFRA_DIR/scripts/seed.sh"
echo "== e2e:reset 4/4 health and Moodle login"
"$INFRA_DIR/scripts/e2e-wait.sh"
echo "e2e:reset done in $(( $(date +%s) - start )) s."
