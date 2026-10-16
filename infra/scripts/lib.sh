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
# The Node containers run as the host user, so they can write infra/.logs (mode 700) on Linux too (A-T1-07).
HOST_UID="$(id -u)"; HOST_GID="$(id -g)"
export HOST_UID HOST_GID
PUBLIC_ENV_FILE="$REPO_ROOT/.tmp/public.env"

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

require_docker() {
  if ! command -v docker >/dev/null 2>&1; then echo "Docker is not installed. Install Docker Desktop, then run the command again." >&2; exit 1; fi
  if ! docker info >/dev/null 2>&1; then
    echo "Docker is not running. Start Docker Desktop, wait until it is ready, then run the command again." >&2
    exit 1
  fi
}

require_running() {
  require_docker
  local svc="$1" cid status
  cid="$(dc ps -q "$svc" 2>/dev/null || true)"
  status="$( [[ -n "$cid" ]] && docker inspect -f '{{.State.Health.Status}}' "$cid" 2>/dev/null || echo missing)"
  if [[ "$status" != healthy ]]; then
    echo "Service '$svc' is not healthy (status: $status). Run: npm run stack:up" >&2
    exit 1
  fi
}

# The public port must be free, or held by this project's own proxy (B-T1-03).
check_public_port() {
  if dc port proxy "$PUBLIC_PORT" >/dev/null 2>&1; then return 0; fi
  if (exec 3<>"/dev/tcp/127.0.0.1/$PUBLIC_PORT") 2>/dev/null; then
    echo "Port $PUBLIC_PORT on 127.0.0.1 is busy (another program or another stack uses it)." >&2
    echo "Fix: stop that program, or set another port: edit PUBLIC_PORT in .env (for example 8443)," >&2
    echo "     run npm run gen-env, then npm run stack:up. Every URL then ends in :<port>." >&2
    exit 1
  fi
}

# A-T1-09: the containers of a compose project carry the label working_dir. Stop if the project of this shell
# belongs to ANOTHER checkout (same COMPOSE_PROJECT_NAME), so no command here touches its data.
require_own_project() {
  local dirs other
  dirs="$(docker ps -a --filter "label=com.docker.compose.project=$COMPOSE_PROJECT_NAME" \
    --format '{{.Label "com.docker.compose.project.working_dir"}}' 2>/dev/null | sort -u)"
  other="$(grep -vx -- "$INFRA_DIR" <<< "$dirs" | grep -v '^$' || true)"
  if [[ -n "$other" ]]; then
    echo "Project '$COMPOSE_PROJECT_NAME' belongs to another checkout: $other" >&2
    echo "Set COMPOSE_PROJECT_NAME to a new name for this checkout (and PUBLIC_PORT, STACK_SUBNET if both run at once)." >&2
    exit 1
  fi
}

# Print a CAUTION line while test knobs are active (A-T1-05, B-T1-05).
warn_knobs() {
  [[ -f "$KNOBS_FILE" ]] || return 0
  local svcs
  svcs="$(node -e 'const d=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));for(const [s,v] of Object.entries(d.services||{}))console.log(s+": "+Object.keys(v.environment||{}).join(", "))' "$KNOBS_FILE" 2>/dev/null || echo "?")"
  echo "CAUTION: test knobs are active (.tmp/compose.knobs.yaml):" >&2
  echo "$svcs" | sed 's/^/  /' >&2
  echo "  Restore the defaults with: npm run stack:restart -- <service>" >&2
}

# Last log lines of every service that is not healthy (B-T1-02).
show_unhealthy_logs() {
  local svc cid status
  for svc in $(dc config --services); do
    cid="$(dc ps -q "$svc" 2>/dev/null || true)"
    status="$( [[ -n "$cid" ]] && docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$cid" 2>/dev/null || echo missing)"
    if [[ "$status" != healthy ]]; then
      echo "--- $svc is $status. Last log lines:" >&2
      dc logs --no-log-prefix --tail 20 "$svc" >&2 2>/dev/null || true
    fi
  done
}

# The public section of .env (no secrets), for the e2e container (A-T1-03).
write_public_env() {
  mkdir -p "$(dirname "$PUBLIC_ENV_FILE")"
  { echo "# Public part of .env (no secrets). Made by infra/scripts; mounted as /repo/.env in the e2e container."
    sed -n '/^# --- public config/,$p' "$ENV_FILE" | grep -E '^[A-Z_]+='; } > "$PUBLIC_ENV_FILE.tmp"
  mv "$PUBLIC_ENV_FILE.tmp" "$PUBLIC_ENV_FILE"
}

# Mount points of the e2e container (compose.yaml): QA's git-ignored output folders and the public .env.
prepare_e2e() {
  local d
  for d in tests/acceptance/artifacts tests/e2e/artifacts tests/test-results tests/playwright-report tests/.tmp tests/node_modules; do
    mkdir -p "$REPO_ROOT/$d"
  done
  write_public_env
  # Public certificates only, for /repo/infra/.certs in the e2e container (read-only, no keys).
  mkdir -p "$REPO_ROOT/.tmp/public-certs"
  find "$REPO_ROOT/.tmp/public-certs" -mindepth 1 -delete
  cp "$CERTS_DIR/root.crt" "$CERTS_DIR/stack.crt" "$REPO_ROOT/.tmp/public-certs/"
  chmod 644 "$REPO_ROOT/.tmp/public-certs/"*.crt
}

# H14: "-e NAME" for every QA_* variable of the caller, so the e2e container gets them (name only: the value is
# taken from this environment and never appears on a command line). Fills the array QA_ENV_ARGS.
qa_env_args() {
  QA_ENV_ARGS=()
  local name
  while IFS= read -r name; do
    [[ -n "$name" ]] && QA_ENV_ARGS+=(-e "$name")
  done < <(compgen -e | grep -E '^QA_[A-Za-z0-9_]*$' || true)
}

print_urls() {
  echo "Moodle:   ${PUBLIC_MOODLE_URL:-?}"
  echo "LTI:      ${PUBLIC_LTI_URL:-?}"
  echo "App:      ${PUBLIC_APP_URL:-?}"
  echo "Content:  ${PUBLIC_CONTENT_URL:-?}"
}
