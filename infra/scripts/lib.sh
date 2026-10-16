# Shared helpers for infra/scripts/*.sh. Source it from bash: source "$(dirname "$0")/lib.sh"
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
INFRA_DIR="$REPO_ROOT/infra"
ENV_FILE="$REPO_ROOT/.env"
CERTS_DIR="$INFRA_DIR/.certs"
LOGS_DIR="$INFRA_DIR/.logs"
KNOBS_FILE="$REPO_ROOT/.tmp/compose.knobs.yaml"   # written by stack-restart.sh
COURSE_FIXTURES_DIR="${COURSE_FIXTURES_DIR:-$REPO_ROOT/docs/raw/data/courses}"

# Stack identity. On the first gen-env these come from the shell (or the defaults); gen-env then saves them
# in .env, and .env wins. A shell value that differs from .env is an error, so a command never runs
# against another checkout's stack by mistake.
# (bash 3.2 compatible: macOS /bin/bash has no associative arrays.)
STACK_VARS=(COMPOSE_PROJECT_NAME STACK_SUBNET PUBLIC_PORT)
for _v in "${STACK_VARS[@]}"; do printf -v "_shell_$_v" '%s' "${!_v-}"; done

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
  for _v in "${STACK_VARS[@]}"; do
    _s="_shell_$_v"
    if [[ -n "${!_s}" && -n "${!_v-}" && "${!_s}" != "${!_v}" ]]; then
      echo "$_v=${!_s} is set in your shell, but .env has $_v=${!_v}." >&2
      echo "Unset it in the shell, or edit .env and run npm run gen-env." >&2
      exit 1
    fi
  done
fi

COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-cogniate-stack}"
STACK_SUBNET="${STACK_SUBNET:-172.28.0.0/16}"
PUBLIC_PORT="${PUBLIC_PORT:-443}"
export COMPOSE_PROJECT_NAME STACK_SUBNET PUBLIC_PORT

if ! [[ "$COMPOSE_PROJECT_NAME" =~ ^[a-z0-9][a-z0-9_-]*$ ]]; then
  echo "COMPOSE_PROJECT_NAME must be lower case letters, digits, '-' or '_', got '$COMPOSE_PROJECT_NAME'" >&2
  exit 1
fi
if ! [[ "$STACK_SUBNET" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}/[0-9]{1,2}$ ]]; then
  echo "STACK_SUBNET must be an IPv4 CIDR such as 172.28.0.0/16, got '$STACK_SUBNET'" >&2
  exit 1
fi
if ! [[ "$PUBLIC_PORT" =~ ^[0-9]+$ ]] || (( PUBLIC_PORT < 1 || PUBLIC_PORT > 65535 )); then
  echo "PUBLIC_PORT must be a port number, got '$PUBLIC_PORT'" >&2
  exit 1
fi

# docker compose for this stack: project $COMPOSE_PROJECT_NAME, env from the repo root .env,
# plus the test-knob override file if stack:restart made one.
dc() {
  local args=(--project-directory "$INFRA_DIR" -p "$COMPOSE_PROJECT_NAME" -f "$INFRA_DIR/compose.yaml")
  [[ -f "$KNOBS_FILE" ]] && args+=(-f "$KNOBS_FILE")
  [[ -f "$ENV_FILE" ]] && args+=(--env-file "$ENV_FILE")
  docker compose "${args[@]}" "$@"
}

# PHP inside the Moodle container (user nobody). Code root /var/www/html, web root /var/www/html/public.
mphp() { dc exec -T moodle php "$@"; }
mcfg() { mphp /var/www/html/admin/cli/cfg.php "$@"; }

# .env, the four public URLs and the certificates must exist and agree with PUBLIC_PORT.
require_env() {
  if [[ ! -f "$ENV_FILE" ]]; then echo "Missing $ENV_FILE. Run: npm run gen-env" >&2; exit 1; fi
  local suffix=""; [[ "$PUBLIC_PORT" == 443 ]] || suffix=":$PUBLIC_PORT"
  local name want
  for name in PUBLIC_MOODLE_URL PUBLIC_LTI_URL PUBLIC_APP_URL PUBLIC_CONTENT_URL; do
    case "$name" in
      PUBLIC_MOODLE_URL) want="https://moodle.test$suffix" ;;
      PUBLIC_LTI_URL) want="https://lti.cogniate.test$suffix" ;;
      PUBLIC_APP_URL) want="https://app.cogniate.test$suffix" ;;
      PUBLIC_CONTENT_URL) want="https://content.cogniate-content.test$suffix" ;;
    esac
    if [[ "${!name:-}" != "$want" ]]; then
      echo "$name is '${!name:-}', expected '$want' for PUBLIC_PORT=$PUBLIC_PORT. Run: npm run gen-env" >&2
      exit 1
    fi
  done
  local f
  for f in root.crt stack.crt stack.key; do
    [[ -s "$CERTS_DIR/$f" ]] || { echo "Missing infra/.certs/$f. Run: npm run gen-env" >&2; exit 1; }
  done
}

require_running() {
  local svc="$1" cid status
  cid="$(dc ps -q "$svc" 2>/dev/null || true)"
  status="$( [[ -n "$cid" ]] && docker inspect -f '{{.State.Health.Status}}' "$cid" 2>/dev/null || echo missing)"
  if [[ "$status" != healthy ]]; then
    echo "Service '$svc' is not healthy (status: $status). Run: npm run stack:up" >&2
    exit 1
  fi
}

print_urls() {
  echo "Moodle:   ${PUBLIC_MOODLE_URL:-?}"
  echo "LTI:      ${PUBLIC_LTI_URL:-?}"
  echo "App:      ${PUBLIC_APP_URL:-?}"
  echo "Content:  ${PUBLIC_CONTENT_URL:-?}"
}
