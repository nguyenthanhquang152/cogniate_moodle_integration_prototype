#!/usr/bin/env bash
# T7: npm run demo:prepare [-- --no-verify] — Scenario A by API and CLI up to "the learner can open both activities"
# (AC-T7-15), so a human demo starts in about 2 minutes. Run it on a fresh stack: npm run e2e:reset first.
#   1. Thanh (portal API): connection "Dev Moodle", dynamic registration
#   2. Moodle admin: "Add LTI Advantage" (CLI: the registration token, as Moodle's start page makes it), then the tool
#      side of the registration and "Connect" over HTTPS (LTI service -> app confirm page -> POST /tool/register)
#   3. Moodle admin (CLI): activate the tool, "Show in activity chooser", "New window"
#   4. Thanh (portal API): upload both course zips and publish them
#   5. Moodle (CLI): both activities in COGNIATE-DEV-101 with grade 100 and completion "Receive a grade"
#   6. Check (headless): cg_teacher opens both activities and reaches the player (a preview: no learner data)
# The course zips are untrusted data: they are copied into a new empty folder (.tmp/demo/zips) and only uploaded.
set -euo pipefail
source "$(dirname "$0")/lib.sh"
verify=1
for a in "$@"; do
  case "$a" in
    --no-verify) verify=0 ;;
    -h|--help) sed -n 2,11p "$0"; exit 0 ;;
    *) echo "Unknown option: $a (see --help)" >&2; exit 2 ;;
  esac
done
require_env
for s in moodle proxy lti-service cogniate-app; do require_running "$s"; done
[[ -s "$INFRA_DIR/.secrets/seed.json" ]] || { echo "Missing infra/.secrets/seed.json. Run: npm run e2e:reset" >&2; exit 1; }
start=$(date +%s)
SRC="${COURSE_FIXTURES_DIR:-$REPO_ROOT/docs/raw/data/courses}"
SCORM_ZIP="$SRC/Build Your First Website with AI_ The Zero-to-Hero Micro-Sprint-scorm-v2.zip"
HTML_ZIP="$SRC/Build Your First Website with AI_ The Zero-to-Hero Micro-Sprint-html.zip"
for z in "$SCORM_ZIP" "$HTML_ZIP"; do [[ -s "$z" ]] || { echo "Missing course zip: $z (set COURSE_FIXTURES_DIR)" >&2; exit 1; }; done
D="$REPO_ROOT/.tmp/demo"
rm -rf "$D/zips" && mkdir -p "$D/zips"
cp "$SCORM_ZIP" "$D/zips/scorm.zip"
cp "$HTML_ZIP" "$D/zips/html.zip"

# One step of infra/demo/prepare.mjs in the e2e container (stack network, dev CA): its JSON line.
step() { "$INFRA_DIR/scripts/e2e-run.sh" node /repo/infra/demo/prepare.mjs "$@" | grep '^{' | tail -1; }
jget() { node -e 'const o = JSON.parse(process.argv[1]); console.log(String(process.argv[2].split(".").reduce((a, k) => a[k], o)))' "$1" "$2"; }
jsonline() { grep '^{' | tail -1; }

echo "1. Thanh: connection \"Dev Moodle\" (dynamic registration)"
c="$(step connect)"; [[ -n "$c" ]] || exit 1
connection="$(jget "$c" connectionId)"
echo "2. Moodle admin: Add LTI Advantage, confirm page, Connect"
reg_start="$(jget "$c" registrationUrl | mphp /opt/cogniate/php/start_lti_registration.php --url=- | jsonline)"
r="$(jget "$reg_start" url | step register -)"; [[ -n "$r" ]] || exit 1
client_id="$(jget "$r" clientId)"
echo "   registered: platform $(jget "$r" platformId)"
echo "3. Moodle admin: activate the tool, Show in activity chooser, New window"
t="$(mphp /opt/cogniate/php/activate_lti_tool.php --clientid="$client_id" | jsonline)"
type_id="$(jget "$t" typeid)"
echo "   tool type $type_id: $(jget "$t" name)"
echo "4. Thanh: upload and publish both courses"
p="$(step publish "$connection")"; [[ -n "$p" ]] || exit 1
echo "5. Moodle: activities in COGNIATE-DEV-101 (grade 100, completion \"Receive a grade\")"
activity() {
  mphp /opt/cogniate/php/add_lti_activity.php --course=COGNIATE-DEV-101 --typeid="$type_id" --name="$1" \
    --toolurl="$PUBLIC_LTI_URL/lti/launch/cogniate?resource=$2" --completion=grade | jsonline
}
a1="$(activity "AI Website Sprint — SCORM" "$(jget "$p" scorm.publicationId)")"
a2="$(activity "AI Website Sprint — HTML" "$(jget "$p" html.publicationId)")"
cm1="$(jget "$a1" cmid)"; cm2="$(jget "$a2" cmid)"
if (( verify )); then
  echo "6. Check: cg_teacher opens both activities (preview)"
  v="$(step verify "$cm1" "$cm2")"
  [[ "$(jget "$v" ok)" == true ]] || { echo "The player check failed: $v" >&2; exit 1; }
  echo "   both activities reach the player"
fi

cat <<TXT

Demo ready in $(( $(date +%s) - start )) s.
Moodle   $PUBLIC_MOODLE_URL   users: admin, cg_teacher, cg_student, cg_student2
Portal   $PUBLIC_APP_URL      user:  thanh@cogniate.test ("Thanh's Library")
         Passwords: .env and infra/.secrets/seed.json
Activities (COGNIATE-DEV-101, completion "Receive a grade"):
  AI Website Sprint — SCORM   $PUBLIC_MOODLE_URL/mod/lti/view.php?id=$cm1
  AI Website Sprint — HTML    $PUBLIC_MOODLE_URL/mod/lti/view.php?id=$cm2
Next: log in to Moodle as cg_student and open an activity (it opens in a new window).
TXT
