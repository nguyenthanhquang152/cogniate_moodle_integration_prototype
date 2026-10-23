#!/usr/bin/env bash
# Restart ONE service, optionally with test knobs (env overrides). QA hook H3.
#   npm run stack:restart -- <service> --env KEY=VALUE [--env KEY2=VALUE2]   set knobs for <service>
#   npm run stack:restart -- <service>                                     restore the defaults
# The overrides live in .tmp/compose.knobs.yaml (all later compose commands use it) until you restore the
# defaults or run stack:reset. Only registered knobs of that service are accepted (packages/shared/src/knobs.ts,
# A-T1-05): so /healthz and the test_knob_active log line always show every override.
# ADR-012 §7: guarded. The candidate guard, the operation lock (before the first Docker command), the host content
# folders (§4) and a storage preflight; a failed preflight exits 1 BEFORE `up --force-recreate`, so the running
# container keeps its id and start time.
set -euo pipefail
source "$(dirname "$0")/lib.sh"
storage_compat_guard
storage_lock_acquire "stack:restart $*"
require_env
svc="${1:-}"; shift || true
if [[ -z "$svc" ]]; then echo "Usage: npm run stack:restart -- <service> [--env KEY=VALUE ...]" >&2; exit 2; fi
services="$(dc config --services)"   # read first: "grep -q" in a pipe + pipefail can fail on SIGPIPE
if ! grep -qx -- "$svc" <<< "$services"; then echo "Unknown service '$svc'. Services: $(tr '\n' ' ' <<< "$services")" >&2; exit 2; fi
pairs=()
while (( $# )); do
  case "$1" in
    --env) [[ $# -ge 2 ]] || { echo "--env needs KEY=VALUE" >&2; exit 2; }; pairs+=("$2"); shift 2 ;;
    --env=*) pairs+=("${1#--env=}"); shift ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
done
for kv in "${pairs[@]+"${pairs[@]}"}"; do
  [[ "$kv" =~ ^[A-Z][A-Z0-9_]*=.*$ ]] || { echo "Bad --env value '$kv' (use KEY=VALUE, KEY in A-Z0-9_)" >&2; exit 2; }
done
# ADR-012 §4, §5: the content folders and the storage preflight come before the knobs file changes, so a refusal
# changes nothing (the knobs file, the running container and its start time stay as they are).
prepare_content_folders
if ! storage_preflight check --prepare; then
  echo "stack:restart stopped before the restart: the storage preflight failed (ADR-012 §5). Nothing was changed; $svc was not recreated." >&2
  exit 1
fi
mkdir -p "$(dirname "$KNOBS_FILE")"
# The file is JSON (valid YAML). "$" is escaped as "$$" so compose does not interpolate knob values.
node --input-type=module - "$KNOBS_FILE" "$svc" "$REPO_ROOT/packages/shared/src/knobs.ts" "${pairs[@]+"${pairs[@]}"}" <<'JS'
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
const [file, svc, registryPath, ...pairs] = process.argv.slice(2);
const { KNOB_REGISTRY } = await import(pathToFileURL(registryPath).href);
const valid = Object.entries(KNOB_REGISTRY).filter(([, k]) => k.service === svc).map(([n]) => n);
// M1 (AC-M1-35): the simulation gate of the LTI service is NOT a test knob (/healthz knobs stays []), but QA must
// restart it in the other combinations of STACK_PROFILE and LTI_PROVIDER_SIMULATION. Only these two, only lti-service.
const GATE_VARS = svc === 'lti-service' ? ['STACK_PROFILE', 'LTI_PROVIDER_SIMULATION'] : [];
for (const kv of pairs) {
  const name = kv.slice(0, kv.indexOf('='));
  const spec = KNOB_REGISTRY[name];
  if (GATE_VARS.includes(name)) continue;
  if (!spec || spec.service !== svc) {
    console.error(`${name} is not a registered knob of ${svc}. Valid knobs of ${svc}: ${valid.join(', ') || '(none)'}.`);
    console.error('Knobs are registered in packages/shared/src/knobs.ts (KNOB_REGISTRY).');
    process.exit(2);
  }
}
const doc = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { services: {} };
if (pairs.length === 0) {
  delete doc.services[svc];
} else {
  const environment = {};
  for (const kv of pairs) {
    const i = kv.indexOf('=');
    environment[kv.slice(0, i)] = kv.slice(i + 1).replaceAll('$', '$$$$');
  }
  doc.services[svc] = { environment };
}
if (Object.keys(doc.services).length === 0) fs.rmSync(file, { force: true });
else fs.writeFileSync(file, JSON.stringify(doc, null, 2) + '\n');
JS
if [[ ${#pairs[@]} -eq 0 ]]; then echo "Restoring defaults for $svc"; else echo "Restarting $svc with knobs: ${pairs[*]%%=*}"; fi
if ! dc up -d --no-deps --force-recreate --wait --wait-timeout 300 "$svc"; then
  echo "$svc did not become healthy. Last log lines:" >&2
  dc logs --no-log-prefix --tail 15 "$svc" >&2 || true
  echo "Restore the defaults with: npm run stack:restart -- $svc" >&2
  exit 1
fi
echo "$svc is healthy."
