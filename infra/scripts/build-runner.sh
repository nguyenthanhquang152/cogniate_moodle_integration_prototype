#!/usr/bin/env bash
# T8 Build Runner, HOST SIDE (ADR-007). Turns one SCORM course version into a Moodle backup (.mbz) with a throwaway
# Moodle in its own compose project (infra/build-runner/compose.yaml).
#
# Why on the host: building needs Docker. The Docker socket is root on the host, so it is NEVER mounted into the
# internet-facing cogniate-app container. The app gets a narrow, file-based interface instead:
#   infra/.data/build-queue/requests/  the app writes one small JSON request per build (read-write for the app)
#   infra/.data/build-queue/status/    this runner writes the build status (read-only for the app)
#   infra/.data/build-queue/out/       this runner writes the .mbz (read-only for the app)
#   infra/.data/build-queue/hold/      BUILD_RUNNER_HOLD: the build waits before teardown until its file is removed
# Every request field is checked (infra/build-runner/queue.mjs); the package zip is taken from the app's upload store
# by its sha256, copied into a new empty folder and mounted read-only.
#
#   npm run build-runner           watch the queue in the foreground (stack:up also starts it in the background)
#   build-runner.sh once <file>    one build (the watcher uses it)
set -euo pipefail
source "$(dirname "$0")/lib.sh"
require_docker
QUEUE="$INFRA_DIR/.data/build-queue"
UPLOADS="$INFRA_DIR/.data/cogniate-app/uploads"
COMPOSE_FILE_BUILD="$INFRA_DIR/build-runner/compose.yaml"
Q="$INFRA_DIR/build-runner/queue.mjs"
mkdir -p "$QUEUE/requests" "$QUEUE/processing" "$QUEUE/status" "$QUEUE/out" "$QUEUE/hold"
jget() { node -e 'const o = JSON.parse(process.argv[1]); const v = o[process.argv[2]]; console.log(v === undefined ? "" : String(v))' "$1" "$2"; }
log() { echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) build-runner: $*"; }

build_one() {
  local req="$1" job id hex project work step="start" failat hold sha
  if ! job="$(node "$Q" validate "$req" 2>&1)"; then log "rejected request $(basename "$req"): $job"; return 0; fi
  id="$(jget "$job" buildId)"; hex="$(jget "$job" hex)"; failat="$(jget "$job" failAt)"; hold="$(jget "$job" hold)"; sha="$(jget "$job" packageSha256)"
  project="cogniate-build-$hex"
  work="$REPO_ROOT/.tmp/build/$hex"
  local st="$QUEUE/status/$id.json"
  status() { node "$Q" status "$st" "$@"; }
  dcb() { BUILD_IN="$work/in" BUILD_OUT="$work/out" BUILD_DB_PASS="${db_pass:-x}" BUILD_ADMIN_PASS="${admin_pass:-x}" \
    docker compose -p "$project" -f "$COMPOSE_FILE_BUILD" "$@"; }
  teardown() {
    if [[ "$hold" == true ]]; then
      : > "$QUEUE/hold/$id"
      status "holdFile=infra/.data/build-queue/hold/$id"
      log "$id: HOLD (BUILD_RUNNER_HOLD=1) before teardown; remove infra/.data/build-queue/hold/$id to go on"
      while [[ -e "$QUEUE/hold/$id" ]]; do sleep 2; done
    fi
    dcb down -v --remove-orphans >/dev/null 2>&1 || true
    rm -rf "$work"
  }
  # The failed status is written AFTER the teardown (as `ready` is): when the app shows the failure, no build
  # container, volume or network is left (AC-T8-07).
  failed() {
    log "$id: FAILED at $step: $1"
    teardown
    status status=failed "step=$step" "reason=$1"
  }
  knob_stop() { [[ "$failat" == "$1" ]] && { failed "Test knob BUILD_RUNNER_FAIL_AT=$1: the build stopped at step $1."; return 0; }; return 1; }

  log "$id: start (course $(jget "$job" courseId), version $(jget "$job" versionId))"
  status status=running step=start reason=
  knob_stop start && return 0
  rm -rf "$work"; mkdir -p "$work/in" "$work/out"; chmod 777 "$work/out"
  # Untrusted data: a copy in a new empty folder, mounted read-only into the build Moodle.
  [[ -s "$UPLOADS/$sha.zip" ]] || { failed "The package zip is not in the upload store."; return 0; }
  cp "$UPLOADS/$sha.zip" "$work/in/package.zip"
  node "$Q" jobfile "$req" > "$work/in/job.json"
  db_pass="$(openssl rand -hex 16)"; admin_pass="Aa1-$(openssl rand -hex 12)"
  if ! dcb up -d --wait --wait-timeout 300 >/dev/null 2>&1; then failed "The build Moodle did not start."; return 0; fi
  local out
  for step in course scorm backup; do
    status "step=$step"
    knob_stop "$step" && return 0
    if ! out="$(dcb exec -T moodle php /opt/cogniate/php/build_course.php --step="$step" 2>&1)"; then
      failed "Step $step failed: $(tail -1 <<< "$out" | tr -d '\r' | cut -c1-200)"; return 0
    fi
    log "$id: $step: $(tail -1 <<< "$out" | cut -c1-200)"
  done
  step=copy; status step=copy
  knob_stop copy && return 0
  [[ -s "$work/out/course.mbz" ]] || { failed "The backup file is missing."; return 0; }
  cp "$work/out/course.mbz" "$QUEUE/out/.$id.tmp" && mv "$QUEUE/out/.$id.tmp" "$QUEUE/out/$id.mbz"
  local bytes; bytes="$(wc -c < "$QUEUE/out/$id.mbz" | tr -d ' ')"
  teardown
  status status=ready step=done "bytes=$bytes" reason=
  log "$id: READY ($bytes bytes)"
}

# The build image (infra/build-runner/Dockerfile): built once, with internet, before any build. The build containers
# themselves never have internet.
BUILD_IMAGE=cogniate-build-moodle:v5.2.4
ensure_image() {
  docker image inspect "$BUILD_IMAGE" >/dev/null 2>&1 && return 0
  log "building the image $BUILD_IMAGE (once; composer dependencies)"
  docker build -q -t "$BUILD_IMAGE" "$INFRA_DIR/build-runner" >/dev/null
}

case "${1:-watch}" in
  image) ensure_image ;;
  once) ensure_image; build_one "${2:?build-runner.sh once <request.json>}" ;;
  watch)
    ensure_image
    log "watching $QUEUE/requests (one build at a time)"
    while :; do
      for f in $(ls -tr "$QUEUE/requests" 2>/dev/null | grep -E '^bld_[0-9a-f]{24}\.json$' || true); do
        mv "$QUEUE/requests/$f" "$QUEUE/processing/$f" 2>/dev/null || continue
        build_one "$QUEUE/processing/$f" || log "build error: $f"
        rm -f "$QUEUE/processing/$f"
      done
      sleep 2
    done ;;
  *) echo "Usage: build-runner.sh [watch | once <request.json>]" >&2; exit 2 ;;
esac
