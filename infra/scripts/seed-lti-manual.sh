#!/usr/bin/env bash
# T2a dev seed: npm run seed:lti-manual (idempotent; run after npm run seed).
#  1. Moodle (PHP CLI, lti_add_type): tool "Cogniate (seed)" with the LTI service URLs of account cogniate,
#     new window (launchcontainer 4), activity chooser (coursevisible 2), deep linking on, AGS 2, NRPS 1, no name/email.
#  2. Activities "Seed activity" (COGNIATE-DEV-101) and "Seed activity 102" (COGNIATE-DEV-102), tool URL
#     {PUBLIC_LTI_URL}/lti/launch/cogniate?resource=seed, accept grades on, maximum grade 100.
#  3. The platform in the LTI service with POST /api/platforms (deployment id = tool type id). H9: a deleted platform
#     is made again on the next run.
#  4. seed.json key ltiSeed = { typeId, clientId, deploymentId, cmids: { <course shortname>: cmid }, platformId }.
set -euo pipefail
source "$(dirname "$0")/lib.sh"
require_env
require_running moodle
require_running proxy
require_running lti-service
warn_knobs
SEED="$INFRA_DIR/.secrets/seed.json"
KEY_FILE="$INFRA_DIR/.secrets/lti-api-key.cogniate"
[[ -s "$SEED" ]] || { echo "Missing $SEED. Run: npm run seed" >&2; exit 1; }
[[ -s "$KEY_FILE" ]] || { echo "Missing $KEY_FILE. Run: npm run seed" >&2; exit 1; }
P=/opt/cogniate/php
LTI="$PUBLIC_LTI_URL"
jget() { node -e 'const o=JSON.parse(process.argv[1]); console.log(String(process.argv[2].split(".").reduce((a,k)=>a[k],o)))' "$1" "$2"; }

echo "1. Moodle tool \"Cogniate (seed)\""
tool="$(mphp $P/setup_lti_tool.php --name="Cogniate (seed)" --toolbase="$LTI" \
  --launchpath=/lti/launch/cogniate --loginpath=/lti/login/cogniate --jwkspath=/lti/keys/cogniate \
  --deeplinkpath=/lti/launch/cogniate --redirectpaths=/lti/launch/cogniate \
  --coursevisible=2 --launchcontainer=4 --sendname=0 --sendemail=0)"
type_id="$(jget "$tool" typeid)"; client_id="$(jget "$tool" client_id)"
echo "   type id $type_id, client id $client_id"

echo "2. Activities"
a101="$(mphp $P/add_lti_activity.php --course=COGNIATE-DEV-101 --typeid="$type_id" --name="Seed activity" --toolurl="$LTI/lti/launch/cogniate?resource=seed")"
a102="$(mphp $P/add_lti_activity.php --course=COGNIATE-DEV-102 --typeid="$type_id" --name="Seed activity 102" --toolurl="$LTI/lti/launch/cogniate?resource=seed")"
cm101="$(jget "$a101" cmid)"; cm102="$(jget "$a102" cmid)"
echo "   Seed activity: cmid $cm101 (COGNIATE-DEV-101); Seed activity 102: cmid $cm102 (COGNIATE-DEV-102)"

echo "3. Platform in the LTI service (POST /api/platforms)"
# The API key goes on stdin (never on a command line).
reg="$(node -e '
  const fs = require("fs");
  const [keyFile, moodle, clientId, typeId] = process.argv.slice(1);
  process.stdout.write(JSON.stringify({ apiKey: fs.readFileSync(keyFile, "utf8").trim(), platform: {
    url: moodle, clientId, name: "Moodle (seed)", authenticationEndpoint: `${moodle}/mod/lti/auth.php`,
    accesstokenEndpoint: `${moodle}/mod/lti/token.php`, authConfig: { method: "JWK_SET", key: `${moodle}/mod/lti/certs.php` },
    deploymentIds: [typeId] } }));' "$KEY_FILE" "$PUBLIC_MOODLE_URL" "$client_id" "$type_id" \
  | dc exec -T lti-service node src/cli/register-platform.ts)"
platform_id="$(jget "$reg" platformId)"
echo "   platform $platform_id (created: $(jget "$reg" created))"

echo "4. seed.json ltiSeed"
node -e 'const [t,c,p,a,b]=process.argv.slice(1); process.stdout.write(JSON.stringify({ typeId: Number(t), clientId: c, deploymentId: t,
  cmids: { "COGNIATE-DEV-101": Number(a), "COGNIATE-DEV-102": Number(b) }, platformId: p }))' \
  "$type_id" "$client_id" "$platform_id" "$cm101" "$cm102" | node "$INFRA_DIR/scripts/seed-json-set.mjs" "$SEED" ltiSeed
echo "   wrote ltiSeed to infra/.secrets/seed.json"
echo "Seed launch: log in as cg_student, open \"Seed activity\" in COGNIATE-DEV-101 ($PUBLIC_MOODLE_URL/mod/lti/view.php?id=$cm101)."
