#!/usr/bin/env bash
# Open the demo in a NEW, throwaway Chrome/Chromium profile (.tmp/demo-browser-profile).
# Nothing changes on the Mac: no /etc/hosts edit, no keychain change.
#  - --host-resolver-rules maps the stack names to 127.0.0.1 in this browser only.
#  - --ignore-certificate-errors-spki-list trusts ONLY the stack leaf key (infra/.certs/stack.crt),
#    and only in this profile. Other certificate errors still show.
# Usage: npm run demo:browser [-- <extra chrome flags>]   Env: CHROME_BIN=/path/to/chrome
set -euo pipefail
source "$(dirname "$0")/lib.sh"
require_env
find_chrome() {
  local c
  for c in "${CHROME_BIN:-}" \
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
    "/Applications/Chromium.app/Contents/MacOS/Chromium" \
    "$(command -v google-chrome 2>/dev/null || true)" "$(command -v chromium 2>/dev/null || true)" \
    "$(command -v chromium-browser 2>/dev/null || true)"; do
    [[ -n "$c" && -x "$c" ]] && { echo "$c"; return; }
  done
  echo "No Chrome or Chromium found. Set CHROME_BIN=/path/to/chrome" >&2; exit 1
}
chrome="$(find_chrome)"
spki="$(openssl x509 -in "$CERTS_DIR/stack.crt" -noout -pubkey | openssl pkey -pubin -outform der | openssl dgst -sha256 -binary | openssl enc -base64)"
profile="$REPO_ROOT/.tmp/demo-browser-profile"
mkdir -p "$profile"
echo "Chrome:  $chrome"
echo "Profile: $profile (delete it any time)"
print_urls
exec "$chrome" --user-data-dir="$profile" --no-first-run --no-default-browser-check \
  --host-resolver-rules="MAP *.test 127.0.0.1, MAP *.cogniate-content.test 127.0.0.1" \
  --ignore-certificate-errors-spki-list="$spki" \
  "$@" "$PUBLIC_MOODLE_URL/login/index.php" "$PUBLIC_APP_URL/healthz"
