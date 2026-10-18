#!/usr/bin/env bash
# Start the stack and wait until every service is healthy (at most 300 s). Then print the four URLs.
# It runs gen-env first (makes or updates .env and the certificates), so the CA exists before any container.
# Profile (local-stack §3): STACK_PROFILE=acceptance npm run stack:up adds the sink (evil.test) and qa-platform.test
# and their allowlist entries; npm run stack:up (no STACK_PROFILE) restores the default. Only changed services restart.
set -euo pipefail
source "$(dirname "$0")/lib.sh"
require_docker
"$INFRA_DIR/scripts/gen-env.sh"
source "$(dirname "$0")/lib.sh"   # load the new .env
require_env
profile="${REQUESTED_PROFILE:-default}"
case "$profile" in default|acceptance) ;; *) echo "STACK_PROFILE must be default or acceptance, got '$profile'" >&2; exit 2 ;; esac
apply_profile "$profile"
mkdir -p "$(dirname "$PROFILE_FILE")"; echo "$profile" > "$PROFILE_FILE"
if [[ "$profile" == acceptance ]]; then
  for f in qa.crt qa.key; do [[ -s "$CERTS_DIR/$f" ]] || { echo "Missing infra/.certs/$f. Run: npm run gen-env" >&2; exit 1; }; done
  [[ -n "${QA_PLATFORM_DIR:-}" ]] || mkdir -p "$REPO_ROOT/tests/fixtures/qa-platform"
elif [[ -n "$(dc --profile acceptance ps -aq sink qa-platform 2>/dev/null)" ]]; then
  echo "Profile default: removing the acceptance hosts (sink, qa-platform)."
  dc --profile acceptance rm -s -f sink qa-platform >/dev/null
fi
warn_knobs
check_public_port
mkdir -p "$INFRA_DIR/.secrets" "$INFRA_DIR/.secrets/app" "$INFRA_DIR/.data/fixtures" "$INFRA_DIR/.data/backups" "$INFRA_DIR/.data/lti-service" "$INFRA_DIR/.data/cogniate-app" "$LOGS_DIR"
chmod 700 "$INFRA_DIR/.secrets" "$INFRA_DIR/.secrets/app" "$LOGS_DIR" "$INFRA_DIR/.data/lti-service" "$INFRA_DIR/.data/cogniate-app"   # the Node services run as the host user (HOST_UID)
# T8: the Build Runner queue folders exist before compose mounts them (else Docker makes them as root).
mkdir -p "$BUILD_QUEUE_DIR/requests" "$BUILD_QUEUE_DIR/status" "$BUILD_QUEUE_DIR/out" "$BUILD_QUEUE_DIR/hold"
# cogniate-app serves the front-end builds (mounted read-only): the player (apps/player/dist, T5a) and the portal
# (apps/portal/dist, T6). Build a missing one once; npm run dev:web rebuilds both on every change.
if [[ ! -s "$REPO_ROOT/apps/player/dist/runtime.js" ]]; then
  echo "Building the player (apps/player/dist)."
  (cd "$REPO_ROOT" && npm run -s build -w @cogniate/player >/dev/null)
fi
if [[ -f "$REPO_ROOT/apps/portal/package.json" && ! -s "$REPO_ROOT/apps/portal/dist/index.html" ]]; then
  echo "Building the portal (apps/portal/dist)."
  (cd "$REPO_ROOT" && npm run -s build -w @cogniate/portal >/dev/null)
fi

# The certificate files are bind-mounted one by one. A container keeps the old file after gen-certs replaces
# it, so recreate the containers when the certificates changed since the last start.
certs_now="$(cat "$CERTS_DIR/root.crt" "$CERTS_DIR/stack.crt" | openssl dgst -sha256 | awk '{print $NF}')"
certs_seen_file="$REPO_ROOT/.tmp/certs-in-use.$COMPOSE_PROJECT_NAME.sha256"
recreate=()
if [[ -n "$(dc ps -q 2>/dev/null)" && "$(cat "$certs_seen_file" 2>/dev/null || true)" != "$certs_now" ]]; then
  echo "The certificates changed since the last start: recreating the containers."
  recreate=(--force-recreate)
fi

start=$(date +%s)
if ! dc up -d --wait --wait-timeout 300 "${recreate[@]+"${recreate[@]}"}"; then
  show_unhealthy_logs
  echo "The stack is not healthy after $(( $(date +%s) - start )) s. See the log lines above." >&2
  echo "Common fixes: npm run stack:logs -- <service>; a new .env with old data needs npm run stack:reset." >&2
  exit 1
fi
mkdir -p "$(dirname "$certs_seen_file")"; echo "$certs_now" > "$certs_seen_file"
# The acceptance hosts read qa.crt: recreate them (only them) when it changed since their last start.
if [[ "$profile" == acceptance ]]; then
  qa_now="$(openssl dgst -sha256 < "$CERTS_DIR/qa.crt" | awk '{print $NF}')"
  qa_seen_file="$REPO_ROOT/.tmp/qa-certs-in-use.$COMPOSE_PROJECT_NAME.sha256"
  if [[ -f "$qa_seen_file" && "$(cat "$qa_seen_file")" != "$qa_now" ]]; then
    dc up -d --no-deps --force-recreate --wait --wait-timeout 120 sink qa-platform
  fi
  echo "$qa_now" > "$qa_seen_file"
fi
start_build_runner
echo "Stack healthy in $(( $(date +%s) - start )) s (profile: $profile). Next: npm run seed"
print_urls
