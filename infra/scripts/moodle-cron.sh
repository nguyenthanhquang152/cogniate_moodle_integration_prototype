#!/usr/bin/env bash
# T7 (H13, fallback only): run the Moodle cron once, for example when a report or the completion state waits for it.
# Usage: npm run moodle:cron
set -euo pipefail
source "$(dirname "$0")/lib.sh"
require_env
require_running moodle
start=$(date +%s)
mphp /var/www/html/admin/cli/cron.php --keep-alive=0 | tail -5
echo "Moodle cron done in $(( $(date +%s) - start )) s."
