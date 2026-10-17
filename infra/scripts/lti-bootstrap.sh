#!/usr/bin/env bash
# Bootstrap an LTI tool account (contract §7): npm run lti:bootstrap -w services/lti-service -- --account cogniate --name "Cogniate"
#   [--rotate-api-key] [--rotate-signing-key]
# Host-side options of this wrapper:
#   --ensure-key-file  make a new API key if infra/.secrets/lti-api-key.<account> is missing (seed uses it)
#   --quiet            do not print the API key (it is only written to the key file)
# The CLI runs inside the lti-service container (the database is there). A new or rotated API key is printed ONCE
# and written to infra/.secrets/lti-api-key.<account> (mode 600). Only its hash is stored in the database.
set -euo pipefail
source "$(dirname "$0")/lib.sh"
require_env
require_running lti-service
account=""; ensure=no; quiet=no; pass=()
while (( $# )); do
  case "$1" in
    --account) account="${2:-}"; pass+=("$1" "${2:-}"); shift 2 ;;
    --ensure-key-file) ensure=yes; shift ;;
    --quiet) quiet=yes; shift ;;
    *) pass+=("$1"); shift ;;
  esac
done
[[ "$account" =~ ^[a-z0-9][a-z0-9-]{0,62}$ ]] || { echo "Usage: lti-bootstrap.sh --account <id> [--name <name>] [--rotate-api-key] [--rotate-signing-key]" >&2; exit 2; }
key_file="$INFRA_DIR/.secrets/lti-api-key.$account"
if [[ "$ensure" == yes && ! -s "$key_file" ]]; then pass+=(--rotate-api-key); fi
out="$(dc exec -T lti-service node src/cli/bootstrap.ts "${pass[@]}")"
# A-T2a-05: the CLI output (it can hold the new API key) goes to node on stdin, never on a command line (ps).
api_key="$(printf '%s' "$out" | node -e 'const o=JSON.parse(require("fs").readFileSync(0, "utf8")); process.stdout.write(o.apiKey ?? "")')"
summary="$(printf '%s' "$out" | node -e 'const o=JSON.parse(require("fs").readFileSync(0, "utf8")); console.log(`account=${o.account} created=${o.created} kid=${o.kid}`)')"
if [[ -n "$api_key" ]]; then
  mkdir -p "$INFRA_DIR/.secrets"; chmod 700 "$INFRA_DIR/.secrets"
  ( umask 077; printf '%s\n' "$api_key" > "$key_file.tmp" ); mv "$key_file.tmp" "$key_file"
  echo "   $summary; new API key written to infra/.secrets/lti-api-key.$account"
  [[ "$quiet" == yes ]] || echo "   API key (shown once): $api_key"
else
  echo "   $summary; API key unchanged (infra/.secrets/lti-api-key.$account)"
  [[ -s "$key_file" ]] || echo "   WARNING: the key file is missing. Rotate the key: add --rotate-api-key (or --ensure-key-file)." >&2
fi
# Least privilege (T4b1): cogniate-app sees only its own key, in infra/.secrets/app/ (compose mounts that folder
# read-only). Keep the copy equal to the key file, also when the key did not change. Atomic: write, then rename.
if [[ "$account" == cogniate && -s "$key_file" ]]; then
  app_dir="$INFRA_DIR/.secrets/app"
  mkdir -p "$app_dir"; chmod 700 "$app_dir"
  if ! cmp -s "$key_file" "$app_dir/lti-api-key"; then
    ( umask 077; cp "$key_file" "$app_dir/lti-api-key.tmp" ); mv "$app_dir/lti-api-key.tmp" "$app_dir/lti-api-key"
  fi
fi
