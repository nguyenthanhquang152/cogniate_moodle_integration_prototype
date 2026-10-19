#!/usr/bin/env bash
# T8 Build Runner, HOST SIDE (ADR-007). Turns one SCORM course version into a Moodle backup (.mbz) with a throwaway
# Moodle in its own compose project (infra/build-runner/compose.yaml).
#
# Why on the host: building needs Docker. The Docker socket is root on the host, so it is NEVER mounted into the
# internet-facing cogniate-app container. The app gets a narrow, file-based interface instead:
#   infra/.data/build-queue/requests/  the app writes one small JSON request per build (read-write for the app)
#   infra/.data/build-queue/status/    this runner writes the build status and runner.json (read-only for the app)
#   infra/.data/build-queue/out/       this runner writes the .mbz (read-only for the app)
#   infra/.data/build-queue/hold/      BUILD_RUNNER_HOLD: the build waits before teardown until its file is removed
# Every request field is checked (infra/build-runner/queue.mjs); the package zip is taken from the app's upload store
# by its sha256, copied into a new empty folder and mounted read-only.
#
# Robustness (B-T8-01, B-T8-02):
#  - TERM/INT during a build (stack:down, Ctrl+C): the build project is torn down and the build is marked failed.
#  - At start (and `sweep`, used by stack:reset): interrupted builds are marked failed, their work folders are
#    removed, and the leftover cogniate-build-* containers, volumes and networks OF THIS STACK are removed (label
#    org.cogniate.stack=<COMPOSE_PROJECT_NAME>; other stacks on the same Docker host are never touched).
#  - One runner per queue (lock file build-queue/.runner.pid); a second `watch`, `once` or `sweep` is refused.
#  - status/runner.json is a heartbeat {pid, startedAt, lastSeenAt, image}; the app uses it for its hints.
#  - Log: JSON lines on stdout (stack:up writes them to infra/.logs/build-runner.jsonl), like the services.
#
#   npm run build-runner           watch the queue in the foreground (stack:up also starts it in the background)
#   build-runner.sh once <file>    one build
#   build-runner.sh image          build the image only
#   build-runner.sh sweep          clean up interrupted builds and leftover projects
set -euo pipefail
source "$(dirname "$0")/lib.sh"
require_docker
QUEUE="$INFRA_DIR/.data/build-queue"
UPLOADS="$INFRA_DIR/.data/cogniate-app/uploads"
COMPOSE_FILE_BUILD="$INFRA_DIR/build-runner/compose.yaml"
Q="$INFRA_DIR/build-runner/queue.mjs"
BUILD_IMAGE=cogniate-build-moodle:v5.2.4
# The owning stack (lib.sh: one COMPOSE_PROJECT_NAME per checkout). Build projects get the label
# org.cogniate.stack=$STACK; the sweep removes only projects with this label (other stacks on this host keep theirs).
STACK="$COMPOSE_PROJECT_NAME"
STOPPED_REASON="The Build Runner stopped during the build. Start it again (npm run stack:up) and build again."
mkdir -p "$QUEUE/requests" "$QUEUE/processing" "$QUEUE/status" "$QUEUE/out" "$QUEUE/hold"
# The log goes to fd 3 (a copy of stdout): a trap that runs inside a redirected command (for example
# `bg dcb up ... >/dev/null`) still writes its log lines to the log file.
exec 3>&1
BOOT_ID="runner-$(openssl rand -hex 6)"
STARTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
IMAGE_STATE=missing
jget() { node -e 'const o = JSON.parse(process.argv[1]); const v = o[process.argv[2]]; console.log(v === undefined ? "" : String(v))' "$1" "$2"; }

# One JSON log line: jlog <level> <event> <trace_id> [key=value ...] (values are strings; bytes is a number).
jlog() {
  node -e '
    const [level, event, trace, ...kv] = process.argv.slice(1);
    const line = { ts: new Date().toISOString(), level, service: "build-runner", event, trace_id: trace };
    for (const p of kv) { const i = p.indexOf("="); const k = p.slice(0, i); const v = p.slice(i + 1); line[k] = k === "bytes" ? Number(v) : v; }
    process.stdout.write(JSON.stringify(line) + "\n");' "$@" >&3
}
heartbeat() {
  node -e 'const fs = require("fs"); const [f, pid, started, image] = process.argv.slice(1);
    fs.writeFileSync(f + ".tmp", JSON.stringify({ pid: Number(pid), startedAt: started, lastSeenAt: new Date().toISOString(), image }));
    fs.renameSync(f + ".tmp", f);' "$QUEUE/status/runner.json" "$$" "$STARTED_AT" "$IMAGE_STATE"
}

# One runner per queue (a second runner's start-up sweep would tear down the first runner's build). The lock file
# holds the pid; a dead pid, or a pid that is now another program (after a reboot), does not count.
LOCK="$QUEUE/.runner.pid"
other_runner() {
  local other; other="$(cat "$LOCK" 2>/dev/null || true)"
  [[ "$other" =~ ^[0-9]+$ && "$other" != "$$" ]] && ps -p "$other" -o command= 2>/dev/null | grep -q 'build-runner\.sh' && echo "$other"
}
check_lock() {
  local other; other="$(other_runner || true)"
  [[ -z "$other" ]] && return 0
  echo "Another Build Runner is running (pid $other). Stop it first: npm run stack:down." >&2
  jlog error runner_refused "$BOOT_ID" "other_pid=$other"
  exit 1
}
take_lock() { check_lock; echo "$$" > "$LOCK.$$"; mv -f "$LOCK.$$" "$LOCK"; }
drop_lock() { [[ "$(cat "$LOCK" 2>/dev/null || true)" == "$$" ]] && rm -f "$LOCK"; return 0; }

# Run a long command as a background job and wait for it: a TERM/INT trap then runs at once (bash runs traps only
# between foreground commands, and `wait` returns when a signal arrives).
bg() { "$@" & wait $!; }

ensure_image() {
  if docker image inspect "$BUILD_IMAGE" >/dev/null 2>&1; then IMAGE_STATE=ready; return 0; fi
  IMAGE_STATE=building; heartbeat
  jlog info image_build "$BOOT_ID" "image=$BUILD_IMAGE"
  # Output to a file, not $(...): a command substitution would delay the TERM/INT trap until it ends.
  local log="$QUEUE/.image-build.log"
  if bg docker build -q -t "$BUILD_IMAGE" "$INFRA_DIR/build-runner" > "$log" 2>&1; then IMAGE_STATE=ready; heartbeat; return 0; fi
  IMAGE_STATE=failed; heartbeat
  jlog error image_build_failed "$BOOT_ID" "image=$BUILD_IMAGE" "detail=$(tail -1 "$log" | cut -c1-200)"
  return 1
}

# Interrupted builds: requests in processing/ get a failed status; leftover cogniate-build-* items are removed.
sweep() {
  local f id step
  for f in $(ls "$QUEUE/processing" 2>/dev/null | grep -E '^bld_[0-9a-f]{24}\.json$' || true); do
    id="${f%.json}"
    step="$(node -e 'try { console.log(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).step ?? "") } catch { console.log("") }' "$QUEUE/status/$id.json")"
    node "$Q" status "$QUEUE/status/$id.json" status=failed "reason=$STOPPED_REASON"
    rm -f "$QUEUE/processing/$f" "$QUEUE/hold/$id"
    jlog warn build_failed "$id" "step=${step:-start}" "reason=$STOPPED_REASON"
  done
  # Work folders (a copy of the package zip) of interrupted builds. No build is active while the sweep runs.
  for f in $(ls "$REPO_ROOT/.tmp/build" 2>/dev/null | grep -E '^[0-9a-f]{24}$' || true); do
    rm -rf "${REPO_ROOT:?}/.tmp/build/$f"
  done
  # Only this stack's build projects (label org.cogniate.stack=$STACK): another stack's build may be running.
  local projects p own="label=org.cogniate.stack=$STACK" fmt='{{.Label "com.docker.compose.project"}}'
  projects="$( { docker ps -a --filter "$own" --format "$fmt"; docker volume ls --filter "$own" --format "$fmt"; \
    docker network ls --filter "$own" --format "$fmt"; } 2>/dev/null | grep -E '^cogniate-build-[0-9a-f]{24}$' | sort -u || true)"
  for p in $projects; do
    BUILD_IN=/tmp BUILD_DB_PASS=x BUILD_ADMIN_PASS=x docker compose -p "$p" -f "$COMPOSE_FILE_BUILD" down -v --remove-orphans >/dev/null 2>&1 || true
    jlog warn build_leftover_removed "$BOOT_ID" "project=$p" "stack=$STACK"
  done
}

# The build in progress (for the TERM/INT trap).
CUR_ID=""; CUR_PROJECT=""; CUR_WORK=""; CUR_STEP=""; CUR_REQ=""

on_stop() {
  trap - TERM INT
  if [[ -n "$CUR_ID" ]]; then
    BUILD_IN=/tmp BUILD_DB_PASS=x BUILD_ADMIN_PASS=x docker compose -p "$CUR_PROJECT" -f "$COMPOSE_FILE_BUILD" down -v --remove-orphans >/dev/null 2>&1 || true
    rm -rf "$CUR_WORK" "$QUEUE/hold/$CUR_ID"
    node "$Q" status "$QUEUE/status/$CUR_ID.json" status=failed "step=$CUR_STEP" "reason=$STOPPED_REASON"
    [[ -z "$CUR_REQ" ]] || rm -f "$CUR_REQ"
    jlog warn build_failed "$CUR_ID" "step=$CUR_STEP" "reason=$STOPPED_REASON"
  fi
  jlog info runner_stopping "$BOOT_ID"
  rm -f "$QUEUE/status/runner.json"
  drop_lock
  exit 143
}

build_one() {
  local req="$1" job id hex project work step="start" failat hold sha
  if ! job="$(node "$Q" validate "$req" 2>&1)"; then jlog warn request_rejected "$BOOT_ID" "file=$(basename "$req")" "detail=$job"; return 0; fi
  id="$(jget "$job" buildId)"; hex="$(jget "$job" hex)"; failat="$(jget "$job" failAt)"; hold="$(jget "$job" hold)"; sha="$(jget "$job" packageSha256)"
  project="cogniate-build-$hex"
  work="$REPO_ROOT/.tmp/build/$hex"
  CUR_ID="$id"; CUR_PROJECT="$project"; CUR_WORK="$work"; CUR_REQ="$req"
  local st="$QUEUE/status/$id.json"
  status() { node "$Q" status "$st" "$@"; }
  setstep() { step="$1"; CUR_STEP="$1"; status "step=$1"; jlog info build_step "$id" "step=$1"; }
  dcb() { BUILD_STACK="$STACK" BUILD_IN="$work/in" BUILD_DB_PASS="${db_pass:-x}" BUILD_ADMIN_PASS="${admin_pass:-x}" \
    docker compose -p "$project" -f "$COMPOSE_FILE_BUILD" "$@"; }
  teardown() {
    if [[ "$hold" == true ]]; then
      : > "$QUEUE/hold/$id"
      status "holdFile=infra/.data/build-queue/hold/$id"
      jlog info build_hold "$id" "hold_file=infra/.data/build-queue/hold/$id"
      local n=0
      while [[ -e "$QUEUE/hold/$id" ]]; do
        heartbeat; n=$((n + 1))
        (( n % 15 )) || status "holdFile=infra/.data/build-queue/hold/$id"   # every 30 s: the app sees progress, not a stale build
        sleep 2 & wait $!
      done
    fi
    bg dcb down -v --remove-orphans >/dev/null 2>&1 || true
    rm -rf "$work"
  }
  # The failed status is written AFTER the teardown (as `ready` is): when the app shows the failure, no build
  # container, volume or network is left (AC-T8-07).
  failed() {
    teardown
    status status=failed "step=$step" "reason=$1"
    jlog warn build_failed "$id" "step=$step" "reason=$1"
    CUR_ID=""
  }
  knob_stop() { [[ "$failat" == "$1" ]] && { failed "Test knob BUILD_RUNNER_FAIL_AT=$1: the build stopped at step $1."; return 0; }; return 1; }

  jlog info build_started "$id" "course_id=$(jget "$job" courseId)" "version_id=$(jget "$job" versionId)"
  status status=running step=start reason=
  CUR_STEP=start
  knob_stop start && return 0
  rm -rf "$work"; mkdir -p "$work/in" "$work/copy"
  # Untrusted data: a copy in a new empty folder, mounted read-only into the build Moodle.
  [[ -s "$UPLOADS/$sha.zip" ]] || { failed "The package zip is not in the upload store."; return 0; }
  cp "$UPLOADS/$sha.zip" "$work/in/package.zip"
  node "$Q" jobfile "$req" > "$work/in/job.json"
  db_pass="$(openssl rand -hex 16)"; admin_pass="Aa1-$(openssl rand -hex 12)"
  local last
  if ! bg dcb up -d --wait --wait-timeout 300 > "$work/up.log" 2>&1; then
    last="$(grep -v '^ *$' "$work/up.log" | tail -1 | tr -d '\r' | cut -c1-200)"
    failed "The build Moodle did not start (${last:-no detail}). Build again."; return 0
  fi
  for s in course scorm backup; do
    setstep "$s"
    knob_stop "$s" && return 0
    if ! bg dcb exec -T moodle php /opt/cogniate/php/build_course.php --step="$s" > "$work/step.log" 2>&1; then
      last="$(tail -1 "$work/step.log" | tr -d '\r' | cut -c1-200)"
      failed "Step $s failed: $last"; return 0
    fi
  done
  setstep copy
  knob_stop copy && return 0
  # A-T8-01: `docker cp` copies a symlink as a symlink (it never follows it), into a new empty folder; then the backup
  # must be a regular file with the gzip magic bytes, and it goes into out/ with exclusive create.
  local cid; cid="$(dcb ps -q moodle)"
  if ! bg docker cp "$cid:/var/www/moodledata/cogniate-out/course.mbz" "$work/copy/course.mbz" >/dev/null 2>&1; then failed "The backup file is missing."; return 0; fi
  if ! node "$Q" publish "$work/copy/course.mbz" "$QUEUE/out/$id.mbz" > "$work/publish.log" 2>&1; then
    # A-T8-04: queue.mjs writes one readable line (for example: out/ already has a file for this build).
    last="$(tail -1 "$work/publish.log" | tr -d '\r' | cut -c1-200)"
    failed "The backup was refused: ${last:-unknown reason}. Build again."; return 0
  fi
  local bytes; bytes="$(wc -c < "$QUEUE/out/$id.mbz" | tr -d ' ')"
  teardown
  status status=ready step=done "bytes=$bytes" reason=
  jlog info build_ready "$id" "bytes=$bytes"
  CUR_ID=""
}

case "${1:-watch}" in
  image) ensure_image ;;
  sweep) check_lock; sweep ;;
  once)
    take_lock
    trap on_stop TERM INT
    ensure_image || { echo "The build image could not be made (see the log)." >&2; drop_lock; exit 1; }
    rc=0; build_one "${2:?build-runner.sh once <request.json>}" || rc=$?
    drop_lock; exit "$rc" ;;
  watch)
    take_lock
    trap on_stop TERM INT
    jlog info runner_started "$BOOT_ID" "pid=$$" "queue=infra/.data/build-queue"
    heartbeat
    sweep
    ensure_image || true
    while :; do
      heartbeat
      if [[ "$IMAGE_STATE" != ready ]]; then
        # Retry the image every minute (for example after the network comes back); requests wait in requests/.
        sleep 60 & wait $!
        ensure_image || true
        continue
      fi
      for f in $(ls -tr "$QUEUE/requests" 2>/dev/null | grep -E '^bld_[0-9a-f]{24}\.json$' || true); do
        mv "$QUEUE/requests/$f" "$QUEUE/processing/$f" 2>/dev/null || continue
        build_one "$QUEUE/processing/$f" || jlog error build_error "$BOOT_ID" "file=$f"
        rm -f "$QUEUE/processing/$f"
        heartbeat
      done
      sleep 2 & wait $!
    done ;;
  *) echo "Usage: build-runner.sh [watch | once <request.json> | image | sweep]" >&2; exit 2 ;;
esac
