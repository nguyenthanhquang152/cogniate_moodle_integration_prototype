#!/usr/bin/env bash
# T4b2 dev helper: add (or update) one External tool activity in a Moodle course, without the Moodle UI.
#   npm run seed:lti-activity -- --type <typeId> --course <shortname> --name <name> --url <toolUrl>
# Idempotent by name in the course: a rerun with the same name updates the tool type and the tool URL
# (for example a new ?resource=<publication id>). Grade maximum 100, "accept grades" on.
# QA uses it for AC-T4-18 ("QA foreign" with another library's publication id). Output: one JSON line
# {cmid, instanceid, courseid, typeid, launchurl}.
set -euo pipefail
source "$(dirname "$0")/lib.sh"
require_env
require_running moodle

type_id="" course="" name="" url=""
while (( $# )); do
  case "$1" in
    --type) type_id="${2:-}"; shift 2 ;;
    --course) course="${2:-}"; shift 2 ;;
    --name) name="${2:-}"; shift 2 ;;
    --url) url="${2:-}"; shift 2 ;;
    -h|--help) sed -n 2,7p "$0"; exit 0 ;;
    *) echo "Unknown option: $1 (see --help)" >&2; exit 2 ;;
  esac
done
[[ "$type_id" =~ ^[0-9]+$ ]] || { echo "--type must be a Moodle tool type id (a number)" >&2; exit 2; }
[[ "$course" =~ ^[A-Za-z0-9_.-]{1,100}$ ]] || { echo "--course must be a course short name, for example COGNIATE-DEV-101" >&2; exit 2; }
[[ -n "$name" && ${#name} -le 255 ]] || { echo "--name must have 1 to 255 characters" >&2; exit 2; }
[[ "$url" == https://* ]] || { echo "--url must be an https tool URL, for example $PUBLIC_LTI_URL/lti/launch/cogniate?resource=pub_..." >&2; exit 2; }

# The values go to PHP as separate arguments (no shell evaluation in the container).
mphp /opt/cogniate/php/add_lti_activity.php --course="$course" --typeid="$type_id" --name="$name" --toolurl="$url"
