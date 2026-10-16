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
api_key="$(node -e 'const o=JSON.parse(process.argv[1]); process.stdout.write(o.apiKey ?? "")' "$out")"
summary="$(node -e 'const o=JSON.parse(process.argv[1]); console.log(`account=${o.account} created=${o.created} kid=${o.kid}`)' "$out")"
if [[ -n "$api_key" ]]; then
  mkdir -p "$INFRA_DIR/.secrets"; chmod 700 "$INFRA_DIR/.secrets"
  ( umask 077; printf '%s\n' "$api_key" > "$key_file.tmp" ); mv "$key_file.tmp" "$key_file"
  echo "   $summary; new API key written to infra/.secrets/lti-api-key.$account"
  [[ "$quiet" == yes ]] || echo "   API key (shown once): $api_key"
else
  echo "   $summary; API key unchanged (infra/.secrets/lti-api-key.$account)"
  [[ -s "$key_file" ]] || echo "   WARNING: the key file is missing. Rotate the key: add --rotate-api-key (or --ensure-key-file)." >&2
fi
