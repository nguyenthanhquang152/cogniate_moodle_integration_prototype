#!/usr/bin/env bash
# WARNING: deletes all stack data: Moodle site, database, infra/.secrets/seed.json, infra/.logs/,
# infra/.data/backups/ and the test knobs (.tmp/compose.knobs.yaml).
# Keeps .env (same passwords), infra/.certs/ (same CA, so trust stays valid) and infra/.data/fixtures/.
# Next: npm run stack:up && npm run seed
set -euo pipefail
source "$(dirname "$0")/lib.sh"
dc --profile test down -v --remove-orphans
rm -f "$INFRA_DIR/.secrets/seed.json" "$INFRA_DIR/.secrets/moodle-ws.json" "$KNOBS_FILE"
rm -rf "$INFRA_DIR/.data/backups" "$LOGS_DIR"
echo "Stack data deleted. Kept: .env, infra/.certs/, infra/.data/fixtures/. Next: npm run stack:up && npm run seed"
