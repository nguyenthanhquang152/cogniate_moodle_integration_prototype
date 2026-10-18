#!/usr/bin/env bash
# QA owns tests/compat/run.py. COMPAT_TESTS_DIR can mount an external smoke runner, for example /tmp/t3c-compat.
# Credentials: LTI_API_KEY_FILE=/run/secrets/lti-api-key.cogniate. No seed passwords enter this container.
# Optional COMPAT_INPUT_FILE mounts QA's captured launch inputs at /run/compat/input.json, read-only.
# QA_* environment variables are passed by name, so tokens do not appear on the command line.
set -euo pipefail
source "$(dirname "$0")/lib.sh"
tests_dir="${COMPAT_TESTS_DIR:-$REPO_ROOT/tests/compat}"
# Match compose: relative bind sources are relative to infra/.
[[ "$tests_dir" == /* ]] || tests_dir="$INFRA_DIR/$tests_dir"
if [[ ! -f "$tests_dir/run.py" ]]; then
  echo "QA has not written tests/compat/run.py yet; ask QA or set COMPAT_TESTS_DIR to a folder with run.py." >&2
  exit 1
fi
input_args=()
if [[ -n "${COMPAT_INPUT_FILE:-}" ]]; then
  if [[ ! -f "$COMPAT_INPUT_FILE" || ! -r "$COMPAT_INPUT_FILE" ]]; then
    echo "Compat: COMPAT_INPUT_FILE must name a readable QA input JSON file." >&2
    exit 1
  fi
  input_file="$(cd "$(dirname "$COMPAT_INPUT_FILE")" && pwd)/$(basename "$COMPAT_INPUT_FILE")"
  input_args=(-v "$input_file:/run/compat/input.json:ro" -e COMPAT_INPUT_FILE=/run/compat/input.json)
fi
require_env
require_running proxy
require_own_project
if [[ ! -s "$INFRA_DIR/.secrets/lti-api-key.cogniate" ]]; then
  echo "Compat: the Cogniate API key is missing; run npm run seed first." >&2
  exit 1
fi
qa_env_args
run_name="${COMPOSE_PROJECT_NAME}-compat-$$"
build_log="$(mktemp)"
trap 'rm -f "$build_log"; docker rm -f "$run_name" >/dev/null 2>&1 || true' EXIT
trap 'exit 130' INT TERM
if ! dc --profile compat build compat >"$build_log" 2>&1; then
  echo "Compat: the SDK could not be installed; check Docker and PyPI access, or ask QA for the T3c fallback client." >&2
  exit 1
fi
dc --profile compat run --rm --no-deps --name "$run_name" "${QA_ENV_ARGS[@]+"${QA_ENV_ARGS[@]}"}" "${input_args[@]+"${input_args[@]}"}" compat "$@"
