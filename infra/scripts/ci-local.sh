#!/usr/bin/env bash
# Release checks for a clean clone. This script never starts a stack.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."
exec node infra/scripts/ci-local/run.mjs "$@"
