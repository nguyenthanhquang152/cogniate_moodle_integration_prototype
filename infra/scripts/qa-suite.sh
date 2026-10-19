#!/usr/bin/env bash
# Run a QA suite in the e2e container (QA hook H8). QA owns tests/** as a separate npm project.
#   npm run test:acceptance [-- <args>]  ->  npm ci --prefix tests && npm --prefix tests run acceptance -- <args>
#   npm run test:e2e        [-- <args>]  ->  e2e:reset (T7), then npm ci --prefix tests && npm --prefix tests run e2e -- <args>
#     B-T7-01: the reset deletes all stack data. In a terminal it asks for "yes"; `-- --yes` or E2E_CONFIRM=1 skips the
#     question (QA runners and CI). Without a terminal and without the flag it stops (A-T7-04). --yes is not passed on
#     to the suite. E2E_RESET=0 skips the reset (debugging only).
# test:acceptance (local-stack §3): (1) STACK_PROFILE=acceptance stack:up, (2) the suite, (3) stack:up with the default
# profile, also when the suite fails or is stopped with Ctrl+C. A run that is killed (SIGKILL) leaves the profile on;
# /healthz then shows "profile": "acceptance", and npm run stack:up restores the default.
set -euo pipefail
source "$(dirname "$0")/lib.sh"
suite="${1:?usage: qa-suite.sh acceptance|e2e [args]}"; shift
case "$suite" in acceptance|e2e) ;; *) echo "Unknown suite '$suite' (acceptance|e2e)" >&2; exit 2 ;; esac
# --yes confirms the data delete of test:e2e (B-T7-01); every other argument goes to the suite.
confirmed=0; args=()
for a in "$@"; do if [[ "$a" == --yes ]]; then confirmed=1; else args+=("$a"); fi; done
set -- ${args[@]+"${args[@]}"}
if [[ ! -f "$REPO_ROOT/tests/package.json" ]]; then
  echo "tests/package.json is missing. QA owns tests/ (a separate npm project with an \"$suite\" script)." >&2
  echo "Nothing to run yet. Ask QA, or check out a commit that has tests/." >&2
  exit 1
fi
if [[ ! -f "$REPO_ROOT/tests/package-lock.json" ]]; then
  echo "tests/package-lock.json is missing; npm ci needs it. Ask QA to commit it." >&2
  exit 1
fi
require_env
# B-T7-01: ask before anything runs, and before the exit trap (a "no" stops with nothing done).
if [[ "$suite" == e2e && "${E2E_RESET:-1}" != 0 ]]; then confirm_stack_delete "$confirmed" "npm run test:e2e"; fi
# The suite container has a known name. On exit (also after Ctrl+C) it is removed: without a TTY, docker compose
# run does not stop its container on SIGINT, so the suite would go on running in the background.
run_name="${COMPOSE_PROJECT_NAME}-qa-${suite}-$$"
cleanup() {
  local rc=$?
  trap - EXIT INT TERM
  docker rm -f "$run_name" >/dev/null 2>&1 || true
  if [[ "$suite" == e2e ]]; then
    # AC-T7-13: at the end of the run every /healthz still shows the default profile and no knobs.
    WAIT_SECONDS=20 "$INFRA_DIR/scripts/e2e-wait.sh" >/dev/null 2>&1 || { echo "WARNING: after the run the stack is not clean (profile or knobs, or Moodle login)." >&2; [[ $rc -ne 0 ]] || rc=1; }
    echo "test:e2e: artifacts in tests/e2e/artifacts/"
  fi
  if [[ "$suite" == acceptance ]]; then
    echo "test:acceptance: restoring the default profile (npm run stack:up)..."
    if ! STACK_PROFILE=default "$INFRA_DIR/scripts/stack-up.sh" >/dev/null; then
      echo "WARNING: the default profile was not restored. Run: npm run stack:up" >&2
      [[ $rc -ne 0 ]] || rc=1
    fi
  fi
  exit "$rc"
}
trap cleanup EXIT
trap 'exit 130' INT TERM
if [[ "$suite" == acceptance ]]; then
  echo "test:acceptance: starting the acceptance profile (STACK_PROFILE=acceptance npm run stack:up)..."
  STACK_PROFILE=acceptance "$INFRA_DIR/scripts/stack-up.sh"
  apply_profile acceptance
fi
if [[ "$suite" == e2e ]]; then
  # T7: a clean stack (default profile, no knobs) for every run. E2E_RESET=0 skips the reset (debugging only).
  if [[ "${E2E_RESET:-1}" != 0 ]]; then
    E2E_CONFIRM=1 "$INFRA_DIR/scripts/e2e-reset.sh"   # confirmed above: no second question
  else
    echo "test:e2e: E2E_RESET=0, no reset (debugging only; AC-T7-01 needs the reset)."
    "$INFRA_DIR/scripts/e2e-wait.sh"
  fi
  apply_profile default
fi
require_running proxy
warn_knobs
prepare_e2e
qa_env_args
status=0
dc --profile test run --rm --name "$run_name" --build "${QA_ENV_ARGS[@]+"${QA_ENV_ARGS[@]}"}" e2e sh -c \
  'npm ci --prefix tests --no-audit --no-fund && npm --prefix tests run "$0" -- "$@"' "$suite" "$@" || status=$?
exit "$status"
