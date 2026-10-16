#!/bin/sh
# e2e container entrypoint: trust the stack CA in the browser NSS database, then run the command.
# Only the browser (NSS) and Node (NODE_EXTRA_CA_CERTS) trust the CA. The system store does not,
# so "curl https://moodle.test" without --cacert /certs/root.crt still fails (on purpose).
set -eu
CA=/certs/root.crt
if [ ! -s "$CA" ]; then echo "Missing $CA. Run: npm run stack:up" >&2; exit 1; fi
DB="$HOME/.pki/nssdb"
mkdir -p "$DB"
[ -f "$DB/cert9.db" ] || certutil -d "sql:$DB" -N --empty-password
certutil -d "sql:$DB" -D -n cogniate-dev-ca >/dev/null 2>&1 || true
certutil -d "sql:$DB" -A -t "C,," -n cogniate-dev-ca -i "$CA"
exec "$@"
