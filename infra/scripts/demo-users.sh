#!/usr/bin/env bash
# npm run demo:users — the demo URLs, the user names and where their passwords are (B-T1-11).
# It never prints a password: they are in .env (variable names below) and in infra/.secrets/seed.json.
set -euo pipefail
source "$(dirname "$0")/lib.sh"
require_env
cat <<TXT
Cogniate x Moodle demo (project $COMPOSE_PROJECT_NAME)

Web addresses
  Moodle                 $PUBLIC_MOODLE_URL
  Cogniate portal        $PUBLIC_APP_URL
  LTI service            $PUBLIC_LTI_URL        (no page to open; Moodle uses it)
  Course content         $PUBLIC_CONTENT_URL    (no page to open; the player uses it)
  Open them with: npm run demo:browser (it maps the names; nothing changes on the computer)

Moodle users                         password in .env
  admin        site administrator    MOODLE_ADMIN_PASSWORD
  cg_teacher   teacher               MOODLE_TEACHER_PASSWORD
  cg_student   student               MOODLE_STUDENT_PASSWORD
  cg_student2  student               MOODLE_STUDENT2_PASSWORD
  Courses: COGNIATE-DEV-101, COGNIATE-DEV-102 (the teacher and both students are enrolled in both)

Cogniate portal users                password in .env
  thanh@cogniate.test   "Thanh's Library"   PORTAL_THANH_PASSWORD
  qa-b@cogniate.test    "QA Library B"      PORTAL_QAB_PASSWORD

The same passwords are in infra/.secrets/seed.json (moodle.users, portal.users).
TXT
# The Cogniate activities (for example from npm run demo:prepare), when the stack is running.
if docker info >/dev/null 2>&1 && [[ -n "$(dc ps -q moodle 2>/dev/null)" ]]; then
  acts="$(mphp -r 'define("CLI_SCRIPT", true); require("/var/www/html/config.php");
    foreach ($DB->get_records_sql("SELECT cm.id, l.name, c.shortname FROM {lti} l JOIN {course_modules} cm ON cm.instance = l.id JOIN {modules} m ON m.id = cm.module AND m.name = ? JOIN {course} c ON c.id = l.course ORDER BY cm.id", ["lti"]) as $a)
      echo "  " . str_pad($a->shortname, 18) . str_pad($a->name, 30) . " " . $CFG->wwwroot . "/mod/lti/view.php?id=" . $a->id . "\n";' 2>/dev/null || true)"
  if [[ -n "$acts" ]]; then printf '\nCogniate activities in Moodle\n%s\n' "$acts"; else printf '\nNo Cogniate activity in Moodle yet. Make the demo set-up with: npm run demo:prepare\n'; fi
fi
