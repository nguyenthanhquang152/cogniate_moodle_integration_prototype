#!/usr/bin/env bash
# Course backup (.mbz) with admin/cli/backup.php. Output: infra/.data/backups/.
# Usage: infra/scripts/moodle-backup.sh <courseid> [--nousers]   (--nousers: no user data)
set -euo pipefail
source "$(dirname "$0")/lib.sh"
require_running moodle
cid="$1"; nousers="${2:-}"
mkdir -p "$INFRA_DIR/.data/backups"
if [[ "$nousers" == "--nousers" ]]; then
  mcfg --component=backup --name=backup_general_users --set=0
  trap 'mcfg --component=backup --name=backup_general_users --set=1' EXIT
fi
mphp /var/www/html/admin/cli/backup.php --courseid="$cid" --destination=/opt/cogniate/backups
ls -l "$INFRA_DIR/.data/backups"/*.mbz
