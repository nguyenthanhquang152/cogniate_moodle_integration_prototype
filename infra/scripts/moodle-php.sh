#!/usr/bin/env bash
# Run PHP in the Moodle container. Example: infra/scripts/moodle-php.sh /opt/cogniate/php/setup_lti_tool.php --help
set -euo pipefail
source "$(dirname "$0")/lib.sh"
mphp "$@"
