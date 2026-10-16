#!/usr/bin/env bash
# Read or set a Moodle setting. Example: infra/scripts/moodle-cfg.sh --name=wwwroot
set -euo pipefail
source "$(dirname "$0")/lib.sh"
mcfg "$@"
