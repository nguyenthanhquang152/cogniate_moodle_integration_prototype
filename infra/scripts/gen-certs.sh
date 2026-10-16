#!/usr/bin/env bash
# Make the dev CA and ONE leaf certificate for the four stack host names (ADR-005, B-T0-06).
# Runs before any container starts (npm run gen-env / stack:up). npm run stack:reset does NOT delete them.
#   infra/.certs/ca.key     CA private key (mode 600). Never mounted into a container.
#   infra/.certs/root.crt   CA certificate. Moodle, Node (NODE_EXTRA_CA_CERTS) and Playwright trust it.
#   infra/.certs/stack.key  leaf private key (mode 600). Mounted into the proxy only.
#   infra/.certs/stack.crt  leaf certificate, SAN = the four host names, 397 days.
# Idempotent. It re-issues the leaf only if it is missing, expires in < 30 days, has other names,
# or is not signed by root.crt. Delete infra/.certs/ to start a new CA (then trust it again).
set -euo pipefail
source "$(dirname "$0")/lib.sh"

DIR="$INFRA_DIR/.certs"
NAMES=(moodle.test lti.cogniate.test app.cogniate.test content.cogniate-content.test)
mkdir -p "$DIR"
chmod 700 "$DIR"
umask 077
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

if [[ ! -s "$DIR/ca.key" || ! -s "$DIR/root.crt" ]]; then
  cat > "$tmp/ca.cnf" <<CNF
[req]
distinguished_name = dn
prompt = no
[dn]
CN = Cogniate Dev Root CA ($(hostname -s 2>/dev/null || echo local) $(date -u +%Y-%m-%d))
O = Cogniate local dev (not trusted anywhere else)
[v3_ca]
basicConstraints = critical, CA:TRUE, pathlen:0
keyUsage = critical, keyCertSign, cRLSign
subjectKeyIdentifier = hash
CNF
  openssl req -x509 -new -nodes -newkey rsa:2048 -sha256 -days 3650 \
    -keyout "$DIR/ca.key" -out "$DIR/root.crt" -config "$tmp/ca.cnf" -extensions v3_ca 2>/dev/null
  rm -f "$DIR/stack.crt" "$DIR/stack.key"   # a new CA needs a new leaf
  echo "Made a new dev CA: infra/.certs/root.crt"
fi

san="$(printf 'DNS:%s,' "${NAMES[@]}")"; san="${san%,}"
leaf_ok() {
  [[ -s "$DIR/stack.crt" && -s "$DIR/stack.key" ]] || return 1
  openssl x509 -in "$DIR/stack.crt" -noout -checkend $((30 * 86400)) >/dev/null 2>&1 || return 1
  openssl verify -CAfile "$DIR/root.crt" "$DIR/stack.crt" >/dev/null 2>&1 || return 1
  local have; have="$(openssl x509 -in "$DIR/stack.crt" -noout -text | grep -A1 'Subject Alternative Name' | tail -1 | tr -d ' ')"
  [[ "$have" == "$san" ]] || return 1
}

if ! leaf_ok; then
  cat > "$tmp/leaf.cnf" <<CNF
[req]
distinguished_name = dn
prompt = no
[dn]
CN = ${NAMES[0]}
O = Cogniate local dev
[v3_leaf]
basicConstraints = critical, CA:FALSE
keyUsage = critical, digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = $san
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid
CNF
  openssl req -new -nodes -newkey rsa:2048 -sha256 -keyout "$DIR/stack.key" -out "$tmp/stack.csr" -config "$tmp/leaf.cnf" 2>/dev/null
  openssl x509 -req -in "$tmp/stack.csr" -CA "$DIR/root.crt" -CAkey "$DIR/ca.key" -set_serial "0x$(openssl rand -hex 16)" \
    -sha256 -days 397 -out "$DIR/stack.crt" -extfile "$tmp/leaf.cnf" -extensions v3_leaf 2>/dev/null
  echo "Made a new leaf certificate: infra/.certs/stack.crt ($san)"
fi
chmod 600 "$DIR/ca.key" "$DIR/stack.key"
chmod 644 "$DIR/root.crt" "$DIR/stack.crt"
openssl verify -CAfile "$DIR/root.crt" "$DIR/stack.crt" >/dev/null
echo "Certificates OK: infra/.certs/ (leaf valid until $(openssl x509 -in "$DIR/stack.crt" -noout -enddate | cut -d= -f2))"
