#!/usr/bin/env bash
# T7 (AC-T7-13): wait until the stack is ready for an E2E run, and check that it is clean:
#   - /healthz of the LTI service, the app and the content origin: 200, "profile":"default", "knobs":[]
#   - Moodle: the login page answers and the admin can log in (password from .env, through a 0600 temp file)
# Exit 1 with the reason after WAIT_SECONDS (default 120).
set -euo pipefail
source "$(dirname "$0")/lib.sh"
require_env
deadline=$(( $(date +%s) + ${WAIT_SECONDS:-120} ))
# HTTPS to a public URL from the host: the dev CA, and the host name resolved to the local proxy.
https() {
  local url="$1"; shift
  local host; host="$(sed -E 's#^https://([^/:]+).*#\1#' <<< "$url")"
  curl -sS --max-time 10 --cacert "$CERTS_DIR/root.crt" --resolve "$host:$PUBLIC_PORT:127.0.0.1" "$@" "$url"
}
until_ok() {
  local what="$1"; shift
  local last=""
  while :; do
    if last="$("$@" 2>&1)"; then echo "   ok: $what"; return 0; fi
    if (( $(date +%s) > deadline )); then echo "Not ready: $what. Last answer: ${last:0:300}" >&2; exit 1; fi
    sleep 2
  done
}
clean_health() {
  local body; body="$(https "$1/healthz" -f)" || return 1
  [[ "$body" == *'"status":"ok"'* && "$body" == *'"profile":"default"'* && "$body" == *'"knobs":[]'* ]] || { echo "$body"; return 1; }
}
moodle_login() {
  local jar pw token final
  jar="$(mktemp)"; pw="$(mktemp)"; chmod 600 "$jar" "$pw"
  printf '%s' "$MOODLE_ADMIN_PASSWORD" > "$pw"
  token="$(https "$PUBLIC_MOODLE_URL/login/index.php" -f -c "$jar" -b "$jar" | sed -n 's/.*name="logintoken" value="\([^"]*\)".*/\1/p' | head -1)"
  final="$(https "$PUBLIC_MOODLE_URL/login/index.php" -f -L -o /dev/null -w '%{url_effective}' -c "$jar" -b "$jar" \
    --data-urlencode "username=admin" --data-urlencode "password@$pw" --data-urlencode "logintoken=$token")" || true
  rm -f "$jar" "$pw"
  [[ -n "$token" && -n "$final" && "$final" != *"/login/index.php"* ]] || { echo "login did not leave the login page (final URL: ${final:-none})"; return 1; }
}
until_ok "LTI service /healthz (default profile, no knobs)" clean_health "$PUBLIC_LTI_URL"
until_ok "Cogniate app /healthz (default profile, no knobs)" clean_health "$PUBLIC_APP_URL"
until_ok "content origin /healthz (default profile, no knobs)" clean_health "$PUBLIC_CONTENT_URL"
until_ok "Moodle login page" https "$PUBLIC_MOODLE_URL/login/index.php" -f -o /dev/null
until_ok "Moodle admin login" moodle_login
