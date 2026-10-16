#!/usr/bin/env bash
# Follow the logs. Optional: service names, for example: npm run stack:logs -- moodle proxy
set -euo pipefail
source "$(dirname "$0")/lib.sh"
dc logs -f --tail 200 "$@"
