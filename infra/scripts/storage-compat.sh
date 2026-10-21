#!/usr/bin/env bash
# The bounded storage-only compatibility override for exactly two old builds (ADR-012 §12).
# Candidate tree (npm run stack:storage-compat -- <sub>):
#   enable    under the lock: refuse when .tmp/compose.knobs.yaml exists; make the host content folders (§4); copy the
#             override to .tmp/compose.knobs.yaml and the probe, this runner and the lock helper to .tmp/storage-compat/;
#             check every hash against infra/compat/storage-compat.sha256
#   disable   under the lock: remove the override (only a file with the marker) and the copies
#   guard     exit 1 while the override is enabled (the candidate guard of every start or database command)
# Old checkout (the copies, without the candidate tree; old-only: HEAD must be one of the two marker revisions):
#   bash .tmp/storage-compat/storage-compat.sh run -- npm run stack:up | npm run test:acceptance …
#   bash .tmp/storage-compat/storage-compat.sh preflight | status | disable
# Self-contained on purpose: this file is one of the four hashed copies.
set -euo pipefail

MARKER=x-cogniate-storage-compat
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo="$(cd "$here/../.." && pwd)"
knobs="$repo/.tmp/compose.knobs.yaml"
copies="$repo/.tmp/storage-compat"

die() { echo "$1" >&2; exit 1; }
# M1 "Refuses <code>": one storage_refused JSON line on stdout before the human text (node escapes every value; fixed
# field names; no raw command output).   refusal_json <code> [<key> <value>]…
refusal_json() {
  node -e 'const [code, ...kv] = process.argv.slice(1);
const line = { event: "storage_refused", ts: new Date().toISOString(), command: "storage-compat", code };
for (let i = 0; i + 1 < kv.length; i += 2) line[kv[i]] = kv[i + 1];
process.stdout.write(JSON.stringify(line) + "\n");' "$@"
}
has_marker() { [[ -f "$knobs" ]] && node -e 'try{const d=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));process.exit(Object.hasOwn(d,process.argv[2])?0:1)}catch{process.exit(1)}' "$knobs" "$MARKER"; }
sha() { node -e 'process.stdout.write(require("crypto").createHash("sha256").update(require("fs").readFileSync(process.argv[1])).digest("hex"))' "$1"; }
# The expected SHA-256 of one of the four files, from a storage-compat.sha256 file (lines "<sha>  <path>").
expected() { awk -v f="$2" '$2 == f { print $1 }' "$1"; }

# Each copy and its source name in the hash file.
COPY_KNOBS="$knobs";                              SRC_KNOBS=infra/compat/storage-compat.knobs.json
COPY_PROBE="$copies/sqlite-lock-probe.mjs";       SRC_PROBE=infra/scripts/sqlite-lock-probe.mjs
COPY_RUNNER="$copies/storage-compat.sh";          SRC_RUNNER=infra/scripts/storage-compat.sh
COPY_LOCK="$copies/storage-oplock.sh";            SRC_LOCK=infra/scripts/storage-oplock.sh

check_hashes() { # <hash file>
  local list="$1" pair copy src want got bad=0
  [[ -f "$list" ]] || { echo "hash_mismatch: missing $list" >&2; return 1; }
  for pair in "$COPY_KNOBS|$SRC_KNOBS" "$COPY_PROBE|$SRC_PROBE" "$COPY_RUNNER|$SRC_RUNNER" "$COPY_LOCK|$SRC_LOCK"; do
    copy="${pair%%|*}"; src="${pair##*|}"; want="$(expected "$list" "$src")"
    got="$( [[ -f "$copy" ]] && sha "$copy" || echo missing)"
    if [[ -z "$want" || "$got" != "$want" ]]; then echo "hash_mismatch: $copy ($src) is $got, expected ${want:-?}" >&2; bad=1; fi
  done
  return "$bad"
}

# The project name: the same rule as lib.sh (.env wins).
project_name() {
  if [[ -z "${COMPOSE_PROJECT_NAME:-}" && -f "$repo/.env" ]]; then COMPOSE_PROJECT_NAME="$(sed -n 's/^COMPOSE_PROJECT_NAME=//p' "$repo/.env" | tail -1)"; fi
  export COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-cogniate-stack}"
}

# §4 host side (the same rule as lib.sh prepare_content_folders; the old lib.sh does not have it).
content_folders() {
  local base="$repo/infra/.data/cogniate-app" d
  mkdir -p "$repo/infra/.data"
  for d in "$base" "$base/packages" "$base/uploads"; do
    if [[ -L "$d" ]] || { [[ -e "$d" ]] && { [[ ! -d "$d" ]] || [[ ! -O "$d" ]]; }; }; then
      refusal_json content_path_unsafe path "${d#"$repo"/}"
      die "content_path_unsafe: $d is a symbolic link, not a directory, or not owned by $(id -un). Nothing was changed."
    fi
  done
  for d in "$base" "$base/packages" "$base/uploads"; do [[ -d "$d" ]] || mkdir -m 700 "$d"; done
}

old_only() {
  has_marker || { refusal_json wrapper_old_only reason override_not_enabled; die "wrapper_old_only: the storage-compatibility override is not enabled (.tmp/compose.knobs.yaml)."; }
  local head; head="$(git -C "$repo" rev-parse HEAD 2>/dev/null || echo unknown)"
  node -e 'const d=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));process.exit((d[process.argv[2]].revisions||[]).includes(process.argv[3])?0:1)' "$knobs" "$MARKER" "$head" \
    || { refusal_json wrapper_old_only reason head_not_old head "$head"; die "wrapper_old_only: HEAD $head is not one of the old builds of the override. A candidate command takes its own lock; run it without this wrapper."; }
}

# The old dc() (the old lib.sh of this checkout), so every compose call has the old arguments plus the knobs file.
load_old_lib() { # shellcheck source=/dev/null
  source "$repo/infra/scripts/lib.sh"
}

preflight_check() {
  local rid name
  rid="$(storage_run_id)"; name="$COMPOSE_PROJECT_NAME-storage-$rid"
  storage_lock_add_container "$name"
  dc --profile storage run --rm -T --name "$name" --label "org.cogniate.storage.run=$rid" storage-preflight check --prepare \
    --run-id "$rid" --project "$COMPOSE_PROJECT_NAME" --folder lti=/check/lti-service --folder app=/check/cogniate-app
}

# The mount check (§12): /data is the project volume, the app has the two nested binds, no bind at /data, and the
# knobs file still has its frozen hash.
status_check() {
  local list="$copies/storage-compat.sha256" bad=0 svc id mounts
  [[ "$(sha "$knobs")" == "$(expected "$list" "$SRC_KNOBS")" ]] || { echo "status: the knobs file changed (hash)." >&2; bad=1; }
  for svc in lti-service cogniate-app; do
    id="$(dc ps -aq "$svc" 2>/dev/null | head -1)"
    if [[ -z "$id" ]]; then echo "status: no $svc container." >&2; bad=1; continue; fi
    mounts="$(docker inspect -f '{{range .Mounts}}{{.Type}}|{{.Name}}|{{.Source}}|{{.Destination}}{{println}}{{end}}' "$id")"
    local vol="$COMPOSE_PROJECT_NAME"_ltidb; [[ "$svc" == cogniate-app ]] && vol="$COMPOSE_PROJECT_NAME"_appdb
    grep -qx "volume|$vol|.*|/data" <<< "$mounts" || { echo "status: $svc /data is not the volume $vol." >&2; bad=1; }
    if grep -q '^bind|.*|/data$' <<< "$mounts"; then echo "status: $svc has a bind at /data." >&2; bad=1; fi
    if [[ "$svc" == cogniate-app ]]; then
      grep -q '^bind|.*|/data/packages$' <<< "$mounts" || { echo "status: cogniate-app has no bind at /data/packages." >&2; bad=1; }
      grep -q '^bind|.*|/data/uploads$' <<< "$mounts" || { echo "status: cogniate-app has no bind at /data/uploads." >&2; bad=1; }
    fi
  done
  [[ "$bad" == 0 ]] && echo "storage-compat status: OK (volumes $COMPOSE_PROJECT_NAME""_ltidb, $COMPOSE_PROJECT_NAME""_appdb; nested binds; knobs hash)."
  return "$bad"
}

sub="${1:-}"; shift || true
case "$sub" in
  guard)
    if has_marker; then
      echo "The storage-compatibility override is enabled (.tmp/compose.knobs.yaml has $MARKER). Run \`npm run stack:storage-compat -- disable\` first." >&2
      exit 1
    fi
    exit 0 ;;
  enable)
    [[ "$here" == "$repo/infra/scripts" ]] || die "enable runs from the candidate tree: npm run stack:storage-compat -- enable"
    project_name
    # shellcheck source=storage-oplock.sh
    source "$here/storage-oplock.sh"
    storage_lock_acquire "stack:storage-compat enable"
    [[ ! -e "$knobs" ]] || die "test knobs are active: restore the defaults first (.tmp/compose.knobs.yaml exists; nothing was changed)."
    content_folders
    mkdir -p "$copies"
    cp "$repo/$SRC_KNOBS" "$COPY_KNOBS"
    cp "$repo/$SRC_PROBE" "$COPY_PROBE"; cp "$repo/$SRC_RUNNER" "$COPY_RUNNER"; cp "$repo/$SRC_LOCK" "$COPY_LOCK"
    cp "$repo/infra/compat/storage-compat.sha256" "$copies/storage-compat.sha256"
    if ! check_hashes "$repo/infra/compat/storage-compat.sha256"; then
      rm -rf "$copies"; rm -f "$knobs"
      die "enable: a hash does not match infra/compat/storage-compat.sha256; the override was removed again."
    fi
    echo "storage-compat enabled: .tmp/compose.knobs.yaml and .tmp/storage-compat/ (hashes checked). Old start commands run only through: bash .tmp/storage-compat/storage-compat.sh run -- <command>"
    ;;
  disable)
    project_name
    # shellcheck source=storage-oplock.sh
    source "$here/storage-oplock.sh"
    storage_lock_acquire "stack:storage-compat disable"
    if [[ -e "$knobs" ]] && ! has_marker; then die "disable: .tmp/compose.knobs.yaml holds test knobs, not the storage override; nothing was removed."; fi
    rm -f "$knobs"
    # This file may be the copy itself: bash keeps the open file, so removing the folder is safe here.
    rm -rf "$copies"
    echo "storage-compat disabled."
    ;;
  run|preflight|status)
    cmdline=""
    old_only
    if [[ "$sub" == run ]]; then
      [[ "${1:-}" == "--" ]] && shift
      cmdline="$*"
      if [[ "$cmdline" != "npm run stack:up" && "$cmdline" != "npm run test:acceptance" && "$cmdline" != "npm run test:acceptance "* ]]; then
        refusal_json wrapper_command_not_allowed
        die "wrapper_command_not_allowed: only 'npm run stack:up' and 'npm run test:acceptance …' run through the wrapper (got: $cmdline)."
      fi
    fi
    # A read-only check first, so a changed copy of the lock helper is never sourced; then the §12 check under the lock.
    check_hashes "$copies/storage-compat.sha256" || die "stop now: the storage-compatibility files changed (hash)."
    load_old_lib
    set -euo pipefail
    # shellcheck source=storage-oplock.sh
    source "$copies/storage-oplock.sh"
    storage_lock_acquire "storage-compat $sub${cmdline:+ -- $cmdline}"
    check_hashes "$copies/storage-compat.sha256" || die "stop now: the storage-compatibility files changed (hash)."
    content_folders
    case "$sub" in
      preflight) preflight_check ;;
      status) status_check || die "stop now: the mount check failed." ;;
      run)
        preflight_check || die "stop now: the storage preflight failed."
        set +e
        "$@"
        code=$?
        set -e
        status_check || die "stop now: the mount check failed after the command (command exit $code)."
        exit "$code"
        ;;
    esac
    ;;
  *) echo "Usage: storage-compat.sh enable | disable | guard | run -- <old command> | preflight | status" >&2; exit 2 ;;
esac
