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

# A-T7-01: a JSON value goes to node on stdin (printf is a shell builtin), never on a command line: the connection
# answer holds the registration URL with its ref, and the registration start holds the registration token.
jget() { printf '%s' "$1" | node -e 'const o = JSON.parse(require("fs").readFileSync(0, "utf8")); console.log(String(process.argv[1].split(".").reduce((a, k) => a[k], o)))' "$2"; }
jsonline() { grep '^{' | tail -1 || true; }
# Text from a failed step, safe to show: no .env or seed secret, no JWT, no token/ref/password value in a URL.
redact() {
  node -e '
    const fs = require("fs");
    const [envFile, seedFile] = process.argv.slice(1);
    let text = fs.readFileSync(0, "utf8");
    const secrets = new Set();
    try {
      for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
        const m = /^\s*[A-Z0-9_]*(PASS|SECRET|KEY|TOKEN)[A-Z0-9_]*=(.*)$/.exec(line);
        if (m) secrets.add(m[2].trim().replace(/^["\x27]|["\x27]$/g, ""));
      }
    } catch {}
    try {
      JSON.stringify(JSON.parse(fs.readFileSync(seedFile, "utf8")), (k, v) => { if (typeof v === "string" && /pass|secret|token|key/i.test(k)) secrets.add(v); return v; });
    } catch {}
    for (const s of secrets) if (s.length >= 6) text = text.split(s).join("[redacted]");
    text = text.replace(/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]*/g, "[redacted JWT]")
      .replace(/((?:ref|registration_token|token|ltik|password|secret)=)[^&\s"\x27]+/gi, "$1[redacted]");
    process.stdout.write(text);' "$ENV_FILE" "$INFRA_DIR/.secrets/seed.json"
}
# B-T7-06: a step that gives no JSON line stops the script and shows the last lines of its output (redacted). Moodle
# writes its CLI errors to stdout, so the output is kept, not filtered away.
STEP=0
say() { STEP="$1"; echo "$1. $2"; }
step_failed() {  # step_failed <who said it> <output>
  # Without the Docker build and compose progress lines of the e2e container (they hide the real message).
  { echo "Step $STEP failed. $1 said:"
    printf '%s\n' "$2" | grep -vE '^[[:space:]]*$|^[[:space:]]*(#[0-9]+ |\[\+\] |(Container|Image|Network|Volume) [^ ]+ )' | tail -10 | redact | sed 's/^/   /'
  } >&2
  exit 1
}
# One step of infra/demo/prepare.mjs in the e2e container (stack network, dev CA): its JSON line.
step() {
  local out j
  out="$("$INFRA_DIR/scripts/e2e-run.sh" node /repo/infra/demo/prepare.mjs "$@" 2>&1)" || true
  j="$(printf '%s\n' "$out" | jsonline)"
  [[ -n "$j" ]] || step_failed "The portal step" "${out:-(no output)}"
  printf '%s\n' "$j"
}
# One Moodle CLI helper (stdin passes through): its JSON line.
mstep() {
  local out j
  out="$(mphp "$@" 2>&1)" || true
  j="$(printf '%s\n' "$out" | jsonline)"
  [[ -n "$j" ]] || step_failed "Moodle" "${out:-(no output)}"
  printf '%s\n' "$j"
}

say 1 "Thanh: connection \"Dev Moodle\" (dynamic registration)"
c="$(step connect)"
connection="$(jget "$c" connectionId)"
say 2 "Moodle admin: Add LTI Advantage, confirm page, Connect"
reg_start="$(jget "$c" registrationUrl | mstep /opt/cogniate/php/start_lti_registration.php --url=-)"
r="$(jget "$reg_start" url | step register -)"
client_id="$(jget "$r" clientId)"
echo "   registered: platform $(jget "$r" platformId)"
say 3 "Moodle admin: activate the tool, Show in activity chooser, New window"
t="$(mstep /opt/cogniate/php/activate_lti_tool.php --clientid="$client_id")"
type_id="$(jget "$t" typeid)"
echo "   tool type $type_id: $(jget "$t" name)"
say 4 "Thanh: upload and publish both courses"
p="$(step publish "$connection")"
say 5 "Moodle: activities in COGNIATE-DEV-101 (grade 100, completion \"Receive a grade\")"
activity() {
  mstep /opt/cogniate/php/add_lti_activity.php --course=COGNIATE-DEV-101 --typeid="$type_id" --name="$1" \
    --toolurl="$PUBLIC_LTI_URL/lti/launch/cogniate?resource=$2" --completion=grade
}
a1="$(activity "AI Website Sprint — SCORM" "$(jget "$p" scorm.publicationId)")"
a2="$(activity "AI Website Sprint — HTML" "$(jget "$p" html.publicationId)")"
cm1="$(jget "$a1" cmid)"; cm2="$(jget "$a2" cmid)"
if (( verify )); then
  say 6 "Check: cg_teacher opens both activities (preview)"
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
