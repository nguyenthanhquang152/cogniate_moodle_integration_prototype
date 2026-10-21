#!/usr/bin/env bash
# Upgrade, rollback and recovery maintenance (ADR-011 §14, ADR-012 §8–§10):
#   npm run stack:data-backup     -- --out <folder outside the checkout> [--source volume|legacy]
#   npm run stack:data-restore    -- --from <folder> [--stop-after <point> | --pause-after <point>]   (drills: STORAGE_DRILL=1)
#   npm run stack:data-restore    -- --recover
#   npm run stack:data-import     -- --from <folder of a legacy backup>
#   npm run stack:data-quarantine -- --out <folder outside the checkout>
# Every command: the candidate guard (§12), the operation lock (§7, before the first Docker command), and only a
# positively observed stop of cogniate-app and lti-service. The volume work runs in one storage container of this
# command's run (service `maintenance`, name <project>-storage-<runId>, label org.cogniate.storage.run=<runId>).
# WARNING: a restore loses every Cogniate write after the backup. Never edit a migration ledger row. A backup holds
# secrets: keep it outside the checkout. stack:reset is never a recovery step; quarantine is the exit (§9).
set -euo pipefail
source "$(dirname "$0")/lib.sh"
cmd="${1:-}"; shift || true
case "$cmd" in backup|restore|import|quarantine) ;; *) echo "Usage: stack-data.sh backup --out <folder> [--source volume|legacy] | restore --from <folder> | restore --recover | import --from <folder> | quarantine --out <folder>" >&2; exit 2 ;; esac
out=""; from=""; source_kind="volume"; recover=0; drill=()
while (( $# )); do
  case "$1" in
    --out) out="${2:-}"; shift 2 ;;
    --from) from="${2:-}"; shift 2 ;;
    --source) source_kind="${2:-}"; shift 2 ;;
    --recover) recover=1; shift ;;
    --stop-after|--pause-after) drill+=("$1" "${2:-}"); shift 2 ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
done
case "$source_kind" in volume|legacy) ;; *) echo "--source must be volume or legacy" >&2; exit 2 ;; esac

storage_compat_guard
storage_lock_acquire "stack:data-$cmd"
require_services_stopped
revision="$(git -C "$REPO_ROOT" rev-parse HEAD 2>/dev/null || echo unknown)"
logs_dir() { mkdir -p "$LOGS_DIR"; chmod 700 "$LOGS_DIR"; }
abs() { node -e 'process.stdout.write(require("path").resolve(process.argv[1]))' "$1"; }
# A new or empty folder outside the checkout, mode 0700 (it will hold secrets).
new_folder() {
  local dir; dir="$(abs "$1")"
  case "$dir/" in "$REPO_ROOT/"*) echo "The folder must be outside the checkout (it contains secrets). Nothing was changed." >&2; exit 1 ;; esac
  if [[ -e "$dir" ]] && [[ -n "$(ls -A "$dir" 2>/dev/null)" ]]; then echo "The folder $dir is not empty. Nothing was changed." >&2; exit 1; fi
  mkdir -p "$dir"; chmod 700 "$dir"
  echo "$dir"
}

case "$cmd" in
  backup)
    [[ -n "$out" ]] || { echo "Usage: stack:data-backup -- --out <folder> [--source volume|legacy]" >&2; exit 2; }
    logs_dir
    if [[ "$source_kind" == legacy ]]; then
      old_layout_check
      code=0
      # Host side: the legacy bind folders are only read.
      node "$INFRA_DIR/scripts/stack-data.mjs" backup --source legacy --out "$out" --data "$INFRA_DIR/.data" --project "$COMPOSE_PROJECT_NAME" --revision "$revision" --repo "$REPO_ROOT" || code=$?
      dir="$(abs "$out")"
    else
      prepare_content_folders
      dir="$(new_folder "$out")"
      STORAGE_RUN_OPTS=(-v "$dir:/backup")
      export STORAGE_MAINT_VOLUME_MODE=ro
      code=0
      storage_run maintenance backup --source volume --data /check --out /backup --project "$COMPOSE_PROJECT_NAME" --revision "$revision" || code=$?
    fi
    # §8 rule 1: the services are re-checked at the end; a change marks the folder INCOMPLETE.
    if [[ "$code" == 0 ]] && ! ( require_services_stopped ) 2>/dev/null; then
      : > "$dir/INCOMPLETE"
      echo "A service started during the backup: $dir is marked INCOMPLETE and is not a backup." >&2
      exit 1
    fi
    exit "$code"
    ;;
  restore|import)
    logs_dir
    prepare_content_folders
    export STORAGE_MAINT_VOLUME_MODE=rw
    if [[ "$cmd" == restore && "$recover" == 1 ]]; then
      [[ -z "$from" && ${#drill[@]} -eq 0 ]] || { echo "--recover takes no other option" >&2; exit 2; }
      code=0; storage_run maintenance recover --data /check --project "$COMPOSE_PROJECT_NAME" || code=$?
      exit "$code"
    fi
    [[ -n "$from" ]] || { echo "Usage: stack:data-$cmd -- --from <folder>" >&2; exit 2; }
    dir="$(abs "$from")"
    [[ -d "$dir" ]] || { echo "No backup folder $dir. No target changed." >&2; exit 1; }
    STORAGE_RUN_OPTS=(-v "$dir:/backup:ro")
    code=0
    # The content check reads the read-only packages bind of the maintenance service (/content/packages).
    storage_run maintenance "$cmd" --data /check --from /backup --content /content/packages --project "$COMPOSE_PROJECT_NAME" ${drill[@]+"${drill[@]}"} || code=$?
    exit "$code"
    ;;
  quarantine)
    [[ -n "$out" ]] || { echo "Usage: stack:data-quarantine -- --out <folder outside the checkout>" >&2; exit 2; }
    logs_dir
    dir="$(new_folder "$out")"
    # Step 1: copy every entry of both volumes (manifest last, verified) in one storage container of this run.
    STORAGE_RUN_OPTS=(-v "$dir:/backup")
    export STORAGE_MAINT_VOLUME_MODE=ro
    storage_run maintenance quarantine-copy --data /check --out /backup --project "$COMPOSE_PROJECT_NAME" || { echo "Quarantine stopped: the copy failed. Nothing was removed." >&2; exit 1; }
    copy_run="$STORAGE_RUN_ID"
    for id in $(docker ps -aq --filter "label=org.cogniate.storage.run=$copy_run"); do
      state="$(docker inspect -f '{{.State.Status}}' "$id")"
      case "$state" in created|exited|dead) docker rm "$id" >/dev/null ;; *) echo "Quarantine stopped: the copy container $id is $state. Nothing was removed." >&2; exit 1 ;; esac
    done
    [[ -z "$(docker ps -aq --filter "label=org.cogniate.storage.run=$copy_run")" ]] || { echo "Quarantine stopped: the copy container still exists. Nothing was removed." >&2; exit 1; }
    # Step 2: every container, in any state, that references a lane volume.
    users="$(for v in "${COMPOSE_PROJECT_NAME}_ltidb" "${COMPOSE_PROJECT_NAME}_appdb"; do docker ps -aq --no-trunc --filter "volume=$v"; done | sort -u)"
    allowed=()
    for id in $users; do
      # "|" keeps empty labels as empty fields.
      IFS='|' read -r name project service oneoff state < <(docker inspect -f '{{.Name}}|{{index .Config.Labels "com.docker.compose.project"}}|{{index .Config.Labels "com.docker.compose.service"}}|{{index .Config.Labels "com.docker.compose.oneoff"}}|{{.State.Status}}' "$id")
      if [[ "$project" == "$COMPOSE_PROJECT_NAME" && ( "$service" == lti-service || "$service" == cogniate-app ) && "$oneoff" != True && ( "$state" == exited || "$state" == created || "$state" == dead ) ]]; then
        allowed+=("$id|${name#/}|$service")
      else
        echo "volume_in_use: ${name#/} ($id, project ${project:-none}, service ${service:-none}, state $state) uses a lane volume. Nothing was removed; the verified copy is in $dir." >&2
        exit 1
      fi
    done
    # Step 3: the allowed users (never -f, never -v).
    removed="[]"
    for entry in ${allowed[@]+"${allowed[@]}"}; do
      IFS='|' read -r id name service <<< "$entry"
      docker rm "$id" >/dev/null
      removed="$(node -e 'const a=JSON.parse(process.argv[1]);a.push({name:process.argv[2],id:process.argv[3],service:process.argv[4]});process.stdout.write(JSON.stringify(a))' "$removed" "$name" "$id" "$service")"
    done
    # Step 4: the volumes.
    if ! docker volume rm "${COMPOSE_PROJECT_NAME}_ltidb" "${COMPOSE_PROJECT_NAME}_appdb" >/dev/null; then
      echo "Quarantine stopped at the volume removal (see the Docker message above). The copy and the volumes stay." >&2
      exit 1
    fi
    # Step 5: the record.
    msha="$(node -e 'process.stdout.write(require("crypto").createHash("sha256").update(require("fs").readFileSync(process.argv[1])).digest("hex"))' "$dir/manifest.json")"
    line="$(node -e 'process.stdout.write(JSON.stringify({event:"storage_quarantine",ts:new Date().toISOString(),project:process.argv[1],out:process.argv[2],manifestSha256:process.argv[3],removedContainers:JSON.parse(process.argv[4]),removedVolumes:[process.argv[1]+"_ltidb",process.argv[1]+"_appdb"]}))' "$COMPOSE_PROJECT_NAME" "$dir" "$msha" "$removed")"
    printf '%s\n' "$line" > "$dir/quarantine.json"; chmod 600 "$dir/quarantine.json"
    printf '%s\n' "$line" | tee -a "$LOGS_DIR/storage-maintenance.jsonl"
    echo "Quarantine done: the lane is FRESH. Restore a known backup into it, or import (ADR-012 §8, §9)."
    ;;
esac
