#!/usr/bin/env bash
# QA owns tests/compat/run.py. COMPAT_TESTS_DIR can mount an external smoke runner, for example /tmp/t3c-compat.
# Credentials: LTI_API_KEY_FILE=/run/secrets/lti-api-key.cogniate; SEED_FILE=/run/secrets/seed.json.
# QA_* environment variables are passed by name, so tokens do not appear on the command line.
set -euo pipefail
source "$(dirname "$0")/lib.sh"
require_env
require_running proxy
require_own_project
qa_env_args
run_name="${COMPOSE_PROJECT_NAME}-compat-$$"
trap 'docker rm -f "$run_name" >/dev/null 2>&1 || true' EXIT
trap 'exit 130' INT TERM
dc --profile compat run --rm --no-deps --name "$run_name" --build "${QA_ENV_ARGS[@]+"${QA_ENV_ARGS[@]}"}" compat "$@"
