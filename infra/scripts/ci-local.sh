#!/usr/bin/env bash
# Release checks for a clean clone. This script never starts a stack.
# Allow-list requests: send RQ-1 through the Lead to lane R, which owns
# infra/scripts/ci-local/allow-list.mjs. Give one exact file, rule, value digest,
# and a reason that names the public fixture or test purpose. The Lead routes
# the change to the task reviewers for approval before merge; no wildcard paths.
# Hash the exact matched token: for secret_assignment use literalValue() with
# the secret names from .env.example (outer quotes removed, defaults resolved,
# no evaluation or unescaping); other rules use the whole matched text/block.
# To hash known fake/public text from stdin without adding a newline:
# node -e 'process.stdout.write(require("node:crypto").createHash("sha256").update(require("node:fs").readFileSync(0)).digest("base64") + "\n")'
# Do not send real credentials in an RQ. Owners reword key-shaped review prose;
# it does not get an exception. Re-run the scan after each merge and remove stale
# entries. Normal output never shows values or digests; private logs stay local.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."
exec node infra/scripts/ci-local/run.mjs "$@"
