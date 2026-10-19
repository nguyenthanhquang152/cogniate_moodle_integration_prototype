#!/usr/bin/env bash
# T7: npm run e2e:reset — a clean stack for the E2E suite and the demo. Idempotent (run it as often as you like).
#   0. build the front-ends (player and portal) from the current code, so a run never tests an old build
#   1. stack:reset (WARNING: deletes all stack data; keeps .env, infra/.certs, infra/.data/fixtures)
#   2. stack:up with the default profile and no knobs
#   3. seed (users, courses, tool accounts, portal users)
#   4. wait until every /healthz answers with "profile":"default" and "knobs":[] and the Moodle admin can log in
# B-T7-01: it prints the warning first; in a terminal it asks for "yes" (skip the question: -- --yes or E2E_CONFIRM=1).
set -euo pipefail
source "$(dirname "$0")/lib.sh"
confirmed=0
for a in "$@"; do
  case "$a" in
    --yes) confirmed=1 ;;
    -h|--help) sed -n 2,9p "$0"; exit 0 ;;
    *) echo "Unknown option: $a (only --yes)" >&2; exit 2 ;;
  esac
done
require_env
require_docker
confirm_stack_delete "$confirmed" "npm run e2e:reset"
start=$(date +%s)
echo "== e2e:reset 0/4 build the player and the portal"
(cd "$REPO_ROOT" && npm run -s build -w @cogniate/player >/dev/null && { [[ ! -f apps/portal/package.json ]] || npm run -s build -w @cogniate/portal >/dev/null; })
echo "== e2e:reset 1/4 stack:reset (deletes all stack data)"
"$INFRA_DIR/scripts/stack-reset.sh"
echo "== e2e:reset 2/4 stack:up (default profile, no knobs)"
STACK_PROFILE=default "$INFRA_DIR/scripts/stack-up.sh"
echo "== e2e:reset 3/4 seed"
"$INFRA_DIR/scripts/seed.sh"
echo "== e2e:reset 4/4 health and Moodle login"
"$INFRA_DIR/scripts/e2e-wait.sh"
echo "e2e:reset done in $(( $(date +%s) - start )) s."
