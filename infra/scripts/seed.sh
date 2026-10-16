#!/usr/bin/env bash
# Provision Moodle in the running stack. Idempotent: run it as often as you like.
#  1. CA trust: moodledata/moodleorgca.crt = Alpine CA bundle + dev root (Moodle reads it first)
#  2. Dev-only network settings (curl security) and noemailever
#  3. Users cg_teacher, cg_student, cg_student2; courses COGNIATE-DEV-101/102 with completion; enrolments
#  4. REST web services: product service (9 functions) and the dev/test-only QA oracle service
#  5. LTI tool accounts cogniate and qa-second (keys in infra/.secrets/lti-api-key.<account>)
#  6. infra/.secrets/seed.json (mode 600): users + passwords + ids, course ids, WS tokens, LTI key files (format: infra/README.md)
set -euo pipefail
source "$(dirname "$0")/lib.sh"
require_env
require_running moodle
require_running proxy
require_running lti-service
warn_knobs
P=/opt/cogniate/php
SECRETS="$INFRA_DIR/.secrets"
start=$(date +%s)

echo "1. CA trust for Moodle"
dc exec -T moodle sh -c 'set -e; test -s /certs/root.crt
  cat /etc/ssl/certs/ca-certificates.crt /certs/root.crt > /var/www/moodledata/moodleorgca.crt.tmp
  mv /var/www/moodledata/moodleorgca.crt.tmp /var/www/moodledata/moodleorgca.crt
  echo "   wrote /var/www/moodledata/moodleorgca.crt"'

echo "2. Dev network settings"
mphp $P/setup_dev_network.php --subnet="$STACK_SUBNET" --publicport="$PUBLIC_PORT"

echo "3. Users (admin password from .env too), courses, enrolments"
# Passwords go on stdin, not on the command line.
moodle_json="$(printf '{"admin":"%s","cg_teacher":"%s","cg_student":"%s","cg_student2":"%s"}' \
  "$MOODLE_ADMIN_PASSWORD" "$MOODLE_TEACHER_PASSWORD" "$MOODLE_STUDENT_PASSWORD" "$MOODLE_STUDENT2_PASSWORD" \
  | mphp $P/setup_users_courses.php)"

echo "4. Web services (product + QA oracle)"
product_json="$(mphp $P/setup_webservices.php --profile=product)"
oracle_json="$(mphp $P/setup_webservices.php --profile=qa_oracle)"

echo "5. LTI tool accounts"
"$INFRA_DIR/scripts/lti-bootstrap.sh" --account cogniate --name "Cogniate" --ensure-key-file --quiet
"$INFRA_DIR/scripts/lti-bootstrap.sh" --account qa-second --name "QA second (test account)" --ensure-key-file --quiet
lti_json='{"apiKeyFiles":{"cogniate":"infra/.secrets/lti-api-key.cogniate","qa-second":"infra/.secrets/lti-api-key.qa-second"}}'

echo "6. infra/.secrets/seed.json"
mkdir -p "$SECRETS"; chmod 700 "$SECRETS"
rm -f "$SECRETS/moodle-ws.json"   # replaced by seed.json
printf '{"moodle":%s,"ws":{"product":%s,"qa_oracle":%s},"lti":%s}' "$moodle_json" "$product_json" "$oracle_json" "$lti_json" \
  | node "$INFRA_DIR/scripts/seed-json.mjs" "$SECRETS/seed.json"
echo "   wrote infra/.secrets/seed.json (mode $(stat -f %Lp "$SECRETS/seed.json" 2>/dev/null || stat -c %a "$SECRETS/seed.json"))"

echo "Seed done in $(( $(date +%s) - start )) s."
print_urls
echo "Users:    admin, cg_teacher, cg_student, cg_student2 (passwords in .env and infra/.secrets/seed.json)"
echo "Courses:  COGNIATE-DEV-101, COGNIATE-DEV-102"
