#!/usr/bin/env bash
# Make or update <repo>/.env (mode 600), then the dev certificates (gen-certs.sh).
#  - Secrets: kept if present, generated if missing. Never printed.
#  - Public URLs: always derived from PUBLIC_PORT (default 443). They are the ONLY source of
#    public URLs for compose, scripts and code (packages/shared config). Change PUBLIC_PORT, then re-run.
# Safe to run again. Usage: npm run gen-env
set -euo pipefail
source "$(dirname "$0")/lib.sh"

SECRETS=(DB_PASS MOODLE_ADMIN_PASSWORD MOODLE_TEACHER_PASSWORD MOODLE_STUDENT_PASSWORD MOODLE_STUDENT2_PASSWORD LTI_MASTER_KEY APP_MASTER_KEY
  PORTAL_THANH_PASSWORD PORTAL_QAB_PASSWORD)   # PORTAL_*: mock login of the Cogniate app (T4a)
hex() { openssl rand -hex "$1"; }
# Moodle password policy: upper + lower + digit + non-alphanumeric, >= 8 chars.
pw() { echo "Pw-$(hex 8)-Q$(( RANDOM % 90 + 10 ))"; }
new_secret() {
  case "$1" in
    DB_PASS) hex 16 ;;
    *_MASTER_KEY) hex 32 ;;
    *) pw ;;
  esac
}

# lib.sh already loaded an existing .env (or the shell values / defaults on a first run).
port="$PUBLIC_PORT"
suffix=""; [[ "$port" == 443 ]] || suffix=":$port"
created=no; [[ -f "$ENV_FILE" ]] || created=yes

# B-T1-02: new secrets do not match an old database. Postgres reads its password only on the first start.
# B-T1-12: a NEW .env needs Docker, so this check can run. (Updating an existing .env works without Docker.)
if [[ "$created" == yes ]]; then
  if ! command -v docker >/dev/null 2>&1 || ! docker info >/dev/null 2>&1; then
    echo "Start Docker first: gen-env checks for old stack data before it makes a new .env." >&2
    exit 1
  fi
  require_own_project   # A-T1-09: never suggest a reset of another checkout's stack
  old="$(docker volume ls -q --filter "label=com.docker.compose.project=$COMPOSE_PROJECT_NAME" | tr '\n' ' ')"
  if [[ -n "${old// /}" ]]; then
    echo "This checkout has no .env, but project '$COMPOSE_PROJECT_NAME' still has Docker volumes: $old" >&2
    echo "A new .env would have new passwords that do not match the old database." >&2
    echo "If these volumes belong to another checkout: set COMPOSE_PROJECT_NAME to a new name for this checkout." >&2
    echo "If they are this checkout's old data: restore the old .env, or delete the data with:" >&2
    echo "  COMPOSE_PROJECT_NAME=$COMPOSE_PROJECT_NAME npm run stack:reset" >&2
    exit 1
  fi
fi

umask 077
tmp="$ENV_FILE.tmp.$$"
{
  echo "# Made by npm run gen-env. Dev only. Never commit this file. Re-run gen-env after you edit PUBLIC_PORT."
  echo "# --- secrets (generated; must never appear in a tracked file) ---"
  for name in "${SECRETS[@]}"; do
    value="${!name:-}"
    [[ -n "$value" ]] || value="$(new_secret "$name")"
    echo "$name=$value"
  done
  echo "# --- public config (not secret). Stack identity: one value per checkout. URLs: derived from PUBLIC_PORT ---"
  echo "COMPOSE_PROJECT_NAME=$COMPOSE_PROJECT_NAME"
  echo "STACK_SUBNET=$STACK_SUBNET"
  echo "PUBLIC_PORT=$port"
  echo "PUBLIC_MOODLE_URL=https://$MOODLE_HOST$suffix"
  echo "PUBLIC_LTI_URL=https://$LTI_HOST$suffix"
  echo "PUBLIC_APP_URL=https://$APP_HOST$suffix"
  echo "PUBLIC_CONTENT_URL=https://$CONTENT_HOST$suffix"
} > "$tmp"
chmod 600 "$tmp"
mv "$tmp" "$ENV_FILE"
if [[ "$created" == yes ]]; then echo "Wrote $ENV_FILE (mode 600)"; else echo "Updated $ENV_FILE (secrets kept)"; fi

# Public part only (no secrets), for the e2e container: it is mounted there as /repo/.env (A-T1-03).
write_public_env

"$INFRA_DIR/scripts/gen-certs.sh"
