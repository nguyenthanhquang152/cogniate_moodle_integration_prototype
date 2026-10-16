#!/usr/bin/env bash
# Prove that the Node services trust the dev CA (NODE_EXTRA_CA_CERTS) and reach Moodle through the proxy.
# fetch($PUBLIC_MOODLE_URL/login/index.php) inside lti-service and cogniate-app must give 200.
# Usage: npm run stack:node-reach-check
set -euo pipefail
source "$(dirname "$0")/lib.sh"
require_env
rc=0
for svc in lti-service cogniate-app; do
  require_running "$svc"
  if dc exec -T "$svc" node -e '
    const url = process.env.PUBLIC_MOODLE_URL + "/login/index.php";
    fetch(url).then((r) => { console.log(`${process.argv[1]}: GET ${url} -> ${r.status}`); process.exit(r.status === 200 ? 0 : 1); },
      (e) => { console.log(`${process.argv[1]}: GET ${url} -> ${e.cause?.code ?? e.message}`); process.exit(1); });' "$svc"; then :; else rc=1; fi
done
exit "$rc"
