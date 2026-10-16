#!/usr/bin/env bash
# Restart ONE service, optionally with test knobs (env overrides). QA hook H3.
#   npm run stack:restart -- <service> --env KEY=VALUE [--env KEY2=VALUE2]   set knobs for <service>
#   npm run stack:restart -- <service>                                     restore the defaults
# The overrides live in .tmp/compose.knobs.yaml (all later compose commands use it) until you restore the
# defaults or run stack:reset. Registered knobs (packages/shared/src/knobs.ts) with a non-default value are
# reported by the service: test_knob_active log line + "knobs" in /healthz. Other keys work but are not reported.
set -euo pipefail
source "$(dirname "$0")/lib.sh"
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
mkdir -p "$(dirname "$KNOBS_FILE")"
# The file is JSON (valid YAML). "$" is escaped as "$$" so compose does not interpolate knob values.
node --input-type=module - "$KNOBS_FILE" "$svc" "$REPO_ROOT/packages/shared/src/knobs.ts" "${pairs[@]+"${pairs[@]}"}" <<'JS'
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
const [file, svc, registryPath, ...pairs] = process.argv.slice(2);
const { KNOB_REGISTRY } = await import(pathToFileURL(registryPath).href);
for (const kv of pairs) {
  const name = kv.slice(0, kv.indexOf('='));
  const spec = KNOB_REGISTRY[name];
  if (!spec) console.error(`WARNING: ${name} is not a registered knob; ${svc} will not report it in /healthz.`);
  else if (spec.service !== svc) console.error(`WARNING: ${name} is a knob of ${spec.service}, not of ${svc}.`);
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
