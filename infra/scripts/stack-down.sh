#!/usr/bin/env bash
# Stop the stack. Keep the data volumes (Moodle site, database, CA).
set -euo pipefail
source "$(dirname "$0")/lib.sh"
dc --profile test down --remove-orphans
