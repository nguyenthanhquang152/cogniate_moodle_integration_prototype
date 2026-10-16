#!/usr/bin/env bash
# Prove that Moodle's own HTTP client (curl security + CA trust) reaches the LTI service, and that the dev curl
# rules stay strict: four negative cases must be BLOCKED (exit 1 if one is ALLOWED).
# Usage: npm run stack:moodle-reach-check [-- <url>]   (default: $PUBLIC_LTI_URL/healthz)
set -euo pipefail
source "$(dirname "$0")/lib.sh"
require_env
require_running moodle
mphp /opt/cogniate/php/reach_check.php "${1:-$PUBLIC_LTI_URL/healthz}" --subnet="$STACK_SUBNET"
