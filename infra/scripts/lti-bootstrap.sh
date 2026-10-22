#!/usr/bin/env bash
# Bootstrap an LTI tool account (contract §7): npm run lti:bootstrap -w services/lti-service -- --account cogniate --name "Cogniate"
#   [--rotate-api-key] [--rotate-signing-key]
# Host-side options of this wrapper:
#   --ensure-key-file  make a new API key if infra/.secrets/lti-api-key.<account> is missing (seed uses it)
#   --quiet            do not print the API key (it is only written to the key file)
# The CLI runs inside the lti-service container (the database is there). A new or rotated API key is printed ONCE
# and written to infra/.secrets/lti-api-key.<account> (mode 600). Only its hash is stored in the database.
# First (LA-ADR-06 D3) it runs `lti:operator init --if-none` for the host's operator (OPERATOR_NAME, else the host
# user name): a new operator key is written once to infra/.secrets/lti-operator-key (mode 600); an existing key is kept.
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
# LA-ADR-06 D3: the first operator key, before the account. init --if-none changes nothing when an active key exists,
# so the next run on the same volume works. A new key is the only stdout line; it stays in this shell (printf is a
# builtin, so never on a command line). Mode 600, the same mode as seed.json, which the e2e container reads.
op_file="$INFRA_DIR/.secrets/lti-operator-key"
op_name="${OPERATOR_NAME:-$(id -un)}"
op_from="${OPERATOR_NAME:+OPERATOR_NAME}"; op_from="${op_from:-the host user name (id -un)}"
# Exit 2 = the CLI refused the name (its rule: store/operator-keys.ts OPERATOR_NAME); its own line comes first.
op_out="$(dc exec -T lti-service node src/cli/operator.ts init --if-none --name "$op_name")" || {
  rc=$?
  if (( rc == 2 )); then
    echo "The operator name '$op_name' comes from $op_from. Fix: set OPERATOR_NAME to a valid name, for example" >&2
    echo "  OPERATOR_NAME=alice npm run seed" >&2
  fi
  exit "$rc"
}
if [[ "$op_out" =~ ^ltio_[A-Za-z0-9_-]{43}$ ]]; then
  mkdir -p "$INFRA_DIR/.secrets"; chmod 700 "$INFRA_DIR/.secrets"
  ( umask 077; printf '%s\n' "$op_out" > "$op_file.tmp" ); mv "$op_file.tmp" "$op_file"
  echo "   new operator key (operator $op_name) written to infra/.secrets/lti-operator-key"
elif [[ "$op_out" == "operator key exists" ]]; then
  if [[ ! -s "$op_file" ]]; then
    echo "   WARNING: an operator key exists, but infra/.secrets/lti-operator-key is missing. Make a new one (it revokes the old):" >&2
    echo "            docker compose exec lti-service npm run lti:operator -- init --replace --name <you>, then write it to that file." >&2
  fi
else
  echo "lti:operator init gave no key and no 'operator key exists' line. Nothing was written." >&2
  exit 1
fi
op_out=""

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
