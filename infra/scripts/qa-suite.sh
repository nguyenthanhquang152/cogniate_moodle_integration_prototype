#!/usr/bin/env bash
# Run a QA suite in the e2e container (QA hook H8). QA owns tests/** as a separate npm project.
#   npm run test:acceptance [-- <args>]  ->  npm ci --prefix tests && npm --prefix tests run acceptance -- <args>
#   npm run test:e2e        [-- <args>]  ->  npm ci --prefix tests && npm --prefix tests run e2e -- <args>
set -euo pipefail
source "$(dirname "$0")/lib.sh"
suite="${1:?usage: qa-suite.sh acceptance|e2e [args]}"; shift
case "$suite" in acceptance|e2e) ;; *) echo "Unknown suite '$suite' (acceptance|e2e)" >&2; exit 2 ;; esac
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
require_running proxy
dc --profile test run --rm --build e2e sh -c \
  'npm ci --prefix tests --no-audit --no-fund && npm --prefix tests run "$0" -- "$@"' "$suite" "$@"
