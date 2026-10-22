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

# The four public host names: the ONE place (B-T1-10). gen-env builds the URLs from them, gen-certs the certificate
# names, require_env the check, demo-browser the name mapping, and compose.yaml the proxy aliases (exported below;
# compose keeps the same values as defaults). The URLs add :PUBLIC_PORT when it is not 443.
MOODLE_HOST=moodle.test
LTI_HOST=lti.cogniate.test
APP_HOST=app.cogniate.test
CONTENT_HOST=content.cogniate-content.test
STACK_HOSTS=("$MOODLE_HOST" "$LTI_HOST" "$APP_HOST" "$CONTENT_HOST")
export MOODLE_HOST LTI_HOST APP_HOST CONTENT_HOST
public_url() { local suffix=""; [[ "$PUBLIC_PORT" == 443 ]] || suffix=":$PUBLIC_PORT"; printf 'https://%s%s\n' "$1" "$suffix"; }

# Stack profile (local-stack §3): "default" or "acceptance". Only stack-up.sh changes it (STACK_PROFILE in the shell)
# and saves it in .tmp/stack-profile.<project>. Every other command uses the saved value, so a restart, a seed or a
# QA run never switches the profile by mistake. The effective profile is ACTIVE_STACK_PROFILE (compose.yaml gives it
# to the services as STACK_PROFILE); it sets COMPOSE_PROFILES (the sink and qa-platform services) and
# ACCEPTANCE_ALLOWLIST_EXTRA (the QA hosts in OUTBOUND_PRIVATE_HOST_ALLOWLIST of both services).
# B-T2b-01: STACK_PROFILE itself is never set or exported here, so stack-up.sh sees only a real request.
REQUESTED_PROFILE="${REQUESTED_PROFILE-${STACK_PROFILE-}}"   # kept when stack-up.sh sources this file again
PROFILE_FILE="$REPO_ROOT/.tmp/stack-profile.$COMPOSE_PROJECT_NAME"
saved_profile() {
  local p; p="$(cat "$PROFILE_FILE" 2>/dev/null || true)"
  if [[ "$p" == acceptance ]]; then echo acceptance; else echo default; fi
}
# M1 (M3 §3.1, §3.3, LTI contract §9.13), acceptance only: the simulation profiles of the LTI service
# (LTI_PROVIDER_SIMULATION=on), the simulator hosts that the LTI service calls, and the app's /api/* route through the
# transport gate (LTI_API_URL, allowlisted for the app only). The default profile sets none of them.
SIM_LTI_HOSTS=(developer.blackboard.sim.test learn-a.blackboard.sim.test learn-b.blackboard.sim.test sso.canvas.sim.test
  school-a.canvas.sim.test school-b.canvas.sim.test canvas-self.sim.test api.canvas-self.sim.test)
SIM_ALIASES=(lms-sim.test "${SIM_LTI_HOSTS[@]}" canvas.school-a.sim.test)
GATE_HOST=lti-gate.test
apply_profile() {
  ACTIVE_STACK_PROFILE="$1"
  if [[ "$ACTIVE_STACK_PROFILE" == acceptance ]]; then
    COMPOSE_PROFILES=acceptance; ACCEPTANCE_ALLOWLIST_EXTRA=",qa-platform.test,evil.test"
    ACCEPTANCE_LTI_ALLOWLIST_EXTRA="$(printf ',%s' "${SIM_LTI_HOSTS[@]}")"
    ACCEPTANCE_APP_ALLOWLIST_EXTRA=",$GATE_HOST"
    ACCEPTANCE_LTI_SIMULATION=on
    ACCEPTANCE_LTI_API_URL="https://$GATE_HOST"
    ACCEPTANCE_OPERATOR_HOST=0.0.0.0   # LA-ADR-06 D3: the e2e container reaches http://lti-service:4110 (no proxy route)
  else
    COMPOSE_PROFILES=""; ACCEPTANCE_ALLOWLIST_EXTRA=""
    ACCEPTANCE_LTI_ALLOWLIST_EXTRA=""; ACCEPTANCE_APP_ALLOWLIST_EXTRA=""; ACCEPTANCE_LTI_SIMULATION=""; ACCEPTANCE_LTI_API_URL=""
    ACCEPTANCE_OPERATOR_HOST=""
  fi
  export ACTIVE_STACK_PROFILE COMPOSE_PROFILES ACCEPTANCE_ALLOWLIST_EXTRA ACCEPTANCE_LTI_ALLOWLIST_EXTRA ACCEPTANCE_APP_ALLOWLIST_EXTRA \
    ACCEPTANCE_LTI_SIMULATION ACCEPTANCE_LTI_API_URL ACCEPTANCE_OPERATOR_HOST
}
apply_profile "$(saved_profile)"

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
  local name want
  for name in PUBLIC_MOODLE_URL PUBLIC_LTI_URL PUBLIC_APP_URL PUBLIC_CONTENT_URL; do
    case "$name" in
      PUBLIC_MOODLE_URL) want="$(public_url "$MOODLE_HOST")" ;;
      PUBLIC_LTI_URL) want="$(public_url "$LTI_HOST")" ;;
      PUBLIC_APP_URL) want="$(public_url "$APP_HOST")" ;;
      PUBLIC_CONTENT_URL) want="$(public_url "$CONTENT_HOST")" ;;
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

# Print a CAUTION line while test knobs are active (A-T1-05, B-T1-05), or while the acceptance profile is on (A-T2b-02).
warn_knobs() {
  if [[ "$ACTIVE_STACK_PROFILE" == acceptance ]]; then
    echo "CAUTION: the acceptance profile is on (evil.test sink, qa-platform.test). Back to default: npm run stack:up" >&2
  fi
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
  # T2b: QA's qa-platform.test files (writable in e2e, served read-only by qa-platform). Another folder: QA_PLATFORM_DIR.
  [[ -n "${QA_PLATFORM_DIR:-}" ]] || mkdir -p "$REPO_ROOT/tests/fixtures/qa-platform"
  write_public_env
  # Public certificates only, for /repo/infra/.certs in the e2e container (read-only, no keys).
  mkdir -p "$REPO_ROOT/.tmp/public-certs"
  find "$REPO_ROOT/.tmp/public-certs" -mindepth 1 -delete
  cp "$CERTS_DIR/root.crt" "$CERTS_DIR/stack.crt" "$REPO_ROOT/.tmp/public-certs/"
  [[ -s "$CERTS_DIR/qa.crt" ]] && cp "$CERTS_DIR/qa.crt" "$REPO_ROOT/.tmp/public-certs/"
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

# B-T7-01: test:e2e and e2e:reset delete ALL stack data (stack-reset.sh). Print what goes; in a terminal, ask for
# "yes" unless the run is confirmed with --yes or E2E_CONFIRM=1. A-T7-04: without a terminal and without the flag it
# stops (fail closed, never hangs): QA host runners and CI pass --yes or E2E_CONFIRM=1. No data yet: no question.
#   confirm_stack_delete <confirmed 0|1> <command name>
confirm_stack_delete() {
  local confirmed="${1:-0}" cmd="${2:-this command}" ans=""
  if [[ ! -s "$INFRA_DIR/.secrets/seed.json" && ! -d "$INFRA_DIR/.data/cogniate-app" && ! -d "$INFRA_DIR/.data/lti-service" ]] \
    && [[ -z "$(docker volume ls -q --filter "label=com.docker.compose.project=$COMPOSE_PROJECT_NAME" 2>/dev/null)" ]]; then
    return 0
  fi
  echo "WARNING: $cmd deletes ALL stack data: the Moodle site (courses, activities, grades), the portal data (connections," >&2
  echo "         uploaded and published courses), the LTI service data, the seed users and API keys, and infra/.logs/." >&2
  echo "         It keeps .env, infra/.certs/ and infra/.data/fixtures/." >&2
  [[ "$confirmed" == 1 || "${E2E_CONFIRM:-0}" == 1 ]] && return 0
  if [[ -t 0 && -t 2 ]]; then
    read -r -p "Type yes to delete the data and go on (or run it with -- --yes, or E2E_CONFIRM=1): " ans || true
    [[ "$ans" == yes ]] && return 0
    echo "Stopped. Nothing was deleted." >&2
    exit 1
  fi
  echo "No terminal to ask. Run it with -- --yes, or E2E_CONFIRM=1. Nothing was deleted." >&2
  exit 1
}

print_urls() {
  if [[ "$ACTIVE_STACK_PROFILE" == acceptance ]]; then
    echo "Profile:  acceptance (evil.test sink, qa-platform.test). Back to default: npm run stack:up"
    [[ -z "${STACK_PROFILE:-}" ]] || echo "          STACK_PROFILE=$STACK_PROFILE is set in this shell: run 'unset STACK_PROFILE' first, or it starts acceptance again."
  fi
  echo "Moodle:   ${PUBLIC_MOODLE_URL:-?}"
  echo "LTI:      ${PUBLIC_LTI_URL:-?}"
  echo "App:      ${PUBLIC_APP_URL:-?}"
  echo "Content:  ${PUBLIC_CONTENT_URL:-?}"
}

# ---- T8 Build Runner (host side; infra/scripts/build-runner.sh). The app container never gets the Docker socket.
BUILD_QUEUE_DIR="$INFRA_DIR/.data/build-queue"
BUILD_RUNNER_PID_FILE="$REPO_ROOT/.tmp/build-runner.${COMPOSE_PROJECT_NAME:-cogniate-stack}.pid"
# A1: the pid file survives a reboot, and its pid may then be another program. The runner runs only when that pid is
# alive AND is build-runner.sh (same rule as the lock in build-runner.sh), so stack:down never signals another program.
build_runner_running() {
  local pid; pid="$(cat "$BUILD_RUNNER_PID_FILE" 2>/dev/null || true)"
  [[ "$pid" =~ ^[0-9]+$ ]] && ps -p "$pid" -o command= 2>/dev/null | grep -q 'build-runner\.sh'
}
# B-T8-02: report "started" only when the runner really runs: the process is alive and its heartbeat
# (infra/.data/build-queue/status/runner.json) appears. Its log is JSON lines: infra/.logs/build-runner.jsonl.
start_build_runner() {
  mkdir -p "$BUILD_QUEUE_DIR/requests" "$BUILD_QUEUE_DIR/status" "$BUILD_QUEUE_DIR/out" "$BUILD_QUEUE_DIR/hold" "$LOGS_DIR" "$REPO_ROOT/.tmp"
  if build_runner_running; then return 0; fi
  rm -f "$BUILD_QUEUE_DIR/status/runner.json"
  # ADR-012 §7: the runner gets its OWN process group (set -m for this one job), so it never keeps a storage lock
  # record live after stack:up ends. (A plain `nohup … &` job would stay in the command's group.)
  ( set -m; nohup bash "$INFRA_DIR/scripts/build-runner.sh" watch >> "$LOGS_DIR/build-runner.jsonl" 2>> "$LOGS_DIR/build-runner.err.log" &
    echo $! > "$BUILD_RUNNER_PID_FILE" )
  local i
  for i in $(seq 1 15); do
    sleep 1
    if ! build_runner_running; then
      echo "ERROR: the Build Runner did not start (it stopped at once). .mbz builds will wait. Last log lines:" >&2
      tail -5 "$LOGS_DIR/build-runner.jsonl" "$LOGS_DIR/build-runner.err.log" 2>/dev/null >&2
      echo "Fix the cause, then run: npm run stack:up (or npm run build-runner to see it in the foreground)." >&2
      rm -f "$BUILD_RUNNER_PID_FILE"
      return 1
    fi
    if [[ -s "$BUILD_QUEUE_DIR/status/runner.json" ]]; then
      echo "Build Runner started (host side, pid $(cat "$BUILD_RUNNER_PID_FILE"); log infra/.logs/build-runner.jsonl)."
      return 0
    fi
  done
  echo "WARNING: the Build Runner runs (pid $(cat "$BUILD_RUNNER_PID_FILE")) but wrote no heartbeat in 15 s. See infra/.logs/build-runner.jsonl." >&2
  return 1
}
# B-T8-01: TERM lets the runner tear down a running build and mark it failed; wait for that, then KILL if needed.
stop_build_runner() {
  if build_runner_running; then
    local pid i; pid="$(cat "$BUILD_RUNNER_PID_FILE")"
    kill "$pid" 2>/dev/null || true
    for i in $(seq 1 60); do kill -0 "$pid" 2>/dev/null || break; sleep 1; done
    kill -0 "$pid" 2>/dev/null && kill -9 "$pid" 2>/dev/null || true
    echo "Build Runner stopped."
  fi
  rm -f "$BUILD_RUNNER_PID_FILE"
}

# ---- ADR-012: SQLite on the project-scoped named volumes ltidb and appdb, under the operation lock of §7.
# shellcheck source=storage-oplock.sh
source "$INFRA_DIR/scripts/storage-oplock.sh"   # storage_lock_acquire, storage_lock_release, storage_lock_add_container, storage_run_id

# M1 "Refuses <code>": the code in the command's JSON output. One storage_refused line on stdout, next to the human
# text on stderr (which stays as it is). node builds the line, so every value is JSON-escaped; the fields are fixed
# names and safe values only (a path relative to the checkout, a container name and id), never raw command output.
#   storage_refusal_json <code> [<key> <value>]…
storage_refusal_json() {
  local command="${STORAGE_COMMAND:-$(basename "$0" .sh | sed 's/^stack-/stack:/')}"
  node -e 'const [code, command, runId, ...kv] = process.argv.slice(1);
const line = { event: "storage_refused", ts: new Date().toISOString(), command, code };
if (runId) line.runId = runId;
for (let i = 0; i + 1 < kv.length; i += 2) line[kv[i]] = kv[i + 1];
process.stdout.write(JSON.stringify(line) + "\n");' "$1" "$command" "${STORAGE_LOCK_RUN_ID:-}" "${@:2}"
}

# Candidate guard (ADR-012 §12): every candidate command that can start a container or touch the databases refuses
# while .tmp/compose.knobs.yaml holds the storage-compatibility marker.
storage_compat_guard() { bash "$INFRA_DIR/scripts/storage-compat.sh" guard; }

# §4 host side: infra/.data/cogniate-app and its packages/ and uploads/ (the nested-bind sources). Each one that
# exists must be a directory of the host user and not a symbolic link (else content_path_unsafe, nothing changes);
# each one that is absent is made as the host user with mode 0700. The scripts never chown a host folder.
prepare_content_folders() {
  local base="$INFRA_DIR/.data/cogniate-app" d
  mkdir -p "$INFRA_DIR/.data"
  for d in "$base" "$base/packages" "$base/uploads"; do
    if [[ -L "$d" ]] || { [[ -e "$d" ]] && { [[ ! -d "$d" ]] || [[ ! -O "$d" ]]; }; }; then
      storage_refusal_json content_path_unsafe path "${d#"$REPO_ROOT"/}"
      echo "content_path_unsafe: $d is a symbolic link, not a directory, or not owned by $(id -un). Nothing was changed." >&2
      return 1
    fi
  done
  for d in "$base" "$base/packages" "$base/uploads"; do
    [[ -d "$d" ]] || mkdir -m 700 "$d"
  done
}

# One storage container (§7): a new runId, the name <project>-storage-<runId> (recorded in the lock record BEFORE the
# container exists) and the label org.cogniate.storage.run=<runId>. A foreground child: it stays in this group.
#   storage_run <service> <args …>      (sets STORAGE_RUN_ID)
#   STORAGE_RUN_OPTS=(-v <host>:<container>…)  extra `run` options (for example the backup folder)
storage_run() {
  local service="$1"; shift
  STORAGE_RUN_ID="$(storage_run_id)"
  local name="$COMPOSE_PROJECT_NAME-storage-$STORAGE_RUN_ID"
  storage_lock_add_container "$name"
  dc --profile storage run --rm -T --name "$name" --label "org.cogniate.storage.run=$STORAGE_RUN_ID" \
    ${STORAGE_RUN_OPTS[@]+"${STORAGE_RUN_OPTS[@]}"} "$service" "$@"
}

# B-M1-02 / ADR-012 §8: only a positively observed stop permits maintenance. Docker answers, `compose ps` succeeds,
# and each cogniate-app and lti-service container is exited, created or dead, or absent. Else exit 1 (nothing changed).
require_services_stopped() {
  local states not_stopped="" service state
  _stopped_refuse() { echo "$1 Nothing was changed." >&2; exit 1; }
  command -v docker >/dev/null 2>&1 || _stopped_refuse "Cannot check that cogniate-app and lti-service are stopped: docker is not installed."
  docker info >/dev/null 2>&1 || _stopped_refuse "Cannot check that cogniate-app and lti-service are stopped: Docker does not answer. Start Docker, then run the command again."
  states="$(dc ps -a --format '{{.Service}} {{.State}}' 2>/dev/null)" || _stopped_refuse "Cannot check that cogniate-app and lti-service are stopped: docker compose ps failed."
  while read -r service state; do
    case "$service" in cogniate-app|lti-service) ;; *) continue ;; esac
    case "$state" in exited|created|dead) ;; *) not_stopped+="$service ($state) " ;; esac
  done <<< "$states"
  [[ -z "$not_stopped" ]] || _stopped_refuse "Stop the services first: ${not_stopped}is not stopped. Use the stack's compose stop for cogniate-app and lti-service."
}

# The storage preflight (§5) of both volumes: storage_preflight <report|check|mark-started> [--prepare]
storage_preflight() {
  local mode="$1"; shift
  STORAGE_RUN_ID="$(storage_run_id)"
  local name="$COMPOSE_PROJECT_NAME-storage-$STORAGE_RUN_ID"
  storage_lock_add_container "$name"
  dc --profile storage run --rm -T --name "$name" --label "org.cogniate.storage.run=$STORAGE_RUN_ID" storage-preflight "$mode" \
    --run-id "$STORAGE_RUN_ID" --project "$COMPOSE_PROJECT_NAME" --folder lti=/check/lti-service --folder app=/check/cogniate-app "$@"
}

# §10 step 1: a container of this project that still mounts a legacy bind folder at /data.
old_layout_check() {
  local id line lti app
  lti="$(cd "$INFRA_DIR/.data" 2>/dev/null && pwd -P)/lti-service"; app="$(cd "$INFRA_DIR/.data" 2>/dev/null && pwd -P)/cogniate-app"
  for id in $(docker ps -aq --filter "label=com.docker.compose.project=$COMPOSE_PROJECT_NAME"); do
    while IFS='|' read -r dest src; do
      [[ "$dest" == /data ]] || continue
      if [[ "$src" == "$lti" || "$src" == "$app" || "$src" == "$INFRA_DIR/.data/lti-service" || "$src" == "$INFRA_DIR/.data/cogniate-app" ]]; then
        local name; name="$(docker inspect -f '{{.Name}}' "$id" | sed 's#^/##')"
        storage_refusal_json old_layout_container container "$name" id "$id" mount "infra/.data/$(basename "$src")"
        echo "old_layout_container: container $name ($id) still mounts $src at /data. Remove the old containers first (npm run stack:down). Nothing was changed." >&2
        return 1
      fi
    done < <(docker inspect -f '{{range .Mounts}}{{.Destination}}|{{.Source}}{{println}}{{end}}' "$id")
  done
}

# §10: the legacy scan of stack-up.sh, under the lock and before `check`. The first matching row L1–L7 decides.
legacy_scan() {
  old_layout_check || return 1
  local report rc=0
  report="$(mktemp "${TMPDIR:-/tmp}/storage-report.XXXXXX")"
  # The decision comes from the report lines (a refused state also exits 1); a run without a summary line refuses.
  storage_preflight report > "$report" || true
  cat "$report"
  node "$INFRA_DIR/scripts/stack-data.mjs" legacy-decide --data "$INFRA_DIR/.data" --report "$report" || rc=$?
  rm -f "$report"
  return "$rc"
}
