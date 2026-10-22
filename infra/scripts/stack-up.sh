#!/usr/bin/env bash
# Start the stack and wait until every service is healthy (at most 300 s). Then print the four URLs.
# It runs gen-env first (makes or updates .env and the certificates), so the CA exists before any container.
# Profile (local-stack §3): STACK_PROFILE=acceptance npm run stack:up adds the sink (evil.test) and qa-platform.test
# and their allowlist entries; npm run stack:up (no STACK_PROFILE) restores the default. Only changed services restart.
# ADR-012: SQLite lives on the project volumes ltidb/appdb. Order (§7, §10): the candidate guard, the operation lock
# (before the first Docker command), the host content folders (§4), the legacy scan (§10), the storage preflight
# `check --prepare` (a new one-shot container and runId), `up --wait`, `mark-started` while the pair is still pending,
# then the release (EXIT trap).
set -euo pipefail
source "$(dirname "$0")/lib.sh"
storage_compat_guard
storage_lock_acquire "stack:up"
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
elif [[ -n "$(dc --profile acceptance ps -aq sink qa-platform lms-sim lti-gate 2>/dev/null)" ]]; then
  echo "Profile default: removing the acceptance hosts (sink, qa-platform, lms-sim, lti-gate)."
  dc --profile acceptance rm -s -f sink qa-platform lms-sim lti-gate >/dev/null
fi
warn_knobs
check_public_port
mkdir -p "$INFRA_DIR/.secrets" "$INFRA_DIR/.secrets/app" "$INFRA_DIR/.data/fixtures" "$INFRA_DIR/.data/backups" "$LOGS_DIR"
chmod 700 "$INFRA_DIR/.secrets" "$INFRA_DIR/.secrets/app" "$LOGS_DIR"   # the Node services run as the host user (HOST_UID)
mkdir -p "$INFRA_DIR/.secrets/lti"; chmod 700 "$INFRA_DIR/.secrets/lti"   # LA-ADR-06 D6: key ring mount source (else Docker makes it as root)
# ADR-012 §4: the content folders (nested-bind sources) before any compose command that can start a service.
prepare_content_folders
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

# ADR-012 §10, §5: the legacy scan, then the storage preflight (journal gate, preparation, state table, lock probe).
legacy_scan || { echo "stack:up stopped before any container start (legacy scan, ADR-012 §10)." >&2; exit 1; }
preflight_out="$(mktemp "${TMPDIR:-/tmp}/storage-check.XXXXXX")"
if ! storage_preflight check --prepare > "$preflight_out"; then
  cat "$preflight_out"; rm -f "$preflight_out"
  echo "stack:up stopped: the storage preflight failed (see the storage_preflight lines above; ADR-012 §5, §6)." >&2
  exit 1
fi
cat "$preflight_out"
pair_state="$(node -e 'for (const l of require("fs").readFileSync(process.argv[1],"utf8").split(/\r?\n/)) { try { const d=JSON.parse(l); if (d.event==="storage_preflight" && d.folder==="lti") { console.log(d.state); break; } } catch {} }' "$preflight_out")"
rm -f "$preflight_out"

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
    dc up -d --no-deps --force-recreate --wait --wait-timeout 120 sink qa-platform lms-sim lti-gate
  fi
  echo "$qa_now" > "$qa_seen_file"
fi
# ADR-012 §6: the first start of the pair is complete once both services are healthy.
case "$pair_state" in
  FRESH|FRESH_INIT_PARTIAL|FIRST_START)
    if ! storage_preflight mark-started; then
      # The reason (mark_started_state:<§6 state>, or a probe error) is in the summary line above.
      echo "stack:up: the services are healthy, but mark-started failed (see the storage_preflight_summary line above). The first start is not complete. Run npm run stack:up again." >&2
      exit 1
    fi ;;
esac
start_build_runner || true   # the stack works without it; only .mbz builds wait (the message says why)
echo "Stack healthy in $(( $(date +%s) - start )) s (profile: $profile). Next: npm run seed"
print_urls
