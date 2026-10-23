#!/usr/bin/env bash
# Make the dev CA, the leaf certificate for the four stack host names (ADR-005, B-T0-06, A-T1-01), and a second
# leaf for the two hosts of the acceptance profile (T2b, local-stack §3). The stack leaf does not change for it.
# Runs before any container starts (npm run gen-env / stack:up). npm run stack:reset does NOT delete them.
#   infra/.certs/ca.key     CA private key (mode 600). Never mounted into a container.
#   infra/.certs/root.crt   CA certificate. Moodle, Node (NODE_EXTRA_CA_CERTS) and Playwright trust it.
#   infra/.certs/stack.key  leaf private key (mode 600). Mounted into the proxy only.
#   infra/.certs/stack.crt  leaf certificate, SAN = the four host names.
#   infra/.certs/qa.key     acceptance leaf private key (mode 600). Mounted into the sink and qa-platform only.
#   infra/.certs/qa.crt     acceptance leaf certificate, SAN = evil.test, qa-platform.test.
# Limits (A-T1-01):
#   - The CA has nameConstraints "permitted;DNS:test": it can only sign names under .test. A certificate for
#     any other name (for example example.com) fails verification, even if a human trusts the CA.
#   - CA life 365 days. Leaf life 90 days, and never after the CA end date.
# Idempotent. A CA without the name constraint, with a life over 1 year, or with < 30 days left is replaced
# (with a new leaf). The leaf is re-issued if it is missing, expires in < 30 days, has other names, or does not
# chain to root.crt. Delete infra/.certs/ to force a new CA.
set -euo pipefail
source "$(dirname "$0")/lib.sh"

DIR="$INFRA_DIR/.certs"
NAMES=("${STACK_HOSTS[@]}")   # the four public host names (lib.sh, B-T1-10)
# M1 (M3 §3.1, §3.3): the simulator hosts and the transport gate share the QA leaf (acceptance profile only).
QA_NAMES=(evil.test qa-platform.test "${SIM_ALIASES[@]}" "$GATE_HOST")
CA_DAYS=365
LEAF_DAYS=90
RENEW_DAYS=30
mkdir -p "$DIR"
chmod 700 "$DIR"
umask 077
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

enddate_epoch() { # file -> notAfter as epoch seconds (macOS LibreSSL and GNU OpenSSL)
  local d; d="$(openssl x509 -in "$1" -noout -enddate | cut -d= -f2)"
  date -j -f '%b %e %T %Y %Z' "$d" +%s 2>/dev/null || date -d "$d" +%s
}
startdate_epoch() {
  local d; d="$(openssl x509 -in "$1" -noout -startdate | cut -d= -f2)"
  date -j -f '%b %e %T %Y %Z' "$d" +%s 2>/dev/null || date -d "$d" +%s
}

ca_reason="" # empty = CA is fine
if [[ ! -s "$DIR/ca.key" || ! -s "$DIR/root.crt" ]]; then
  ca_reason="missing"
elif ! openssl x509 -in "$DIR/root.crt" -noout -text | grep -A2 'X509v3 Name Constraints: critical' | grep -q 'DNS:test'; then
  ca_reason="no name constraint (old CA)"
elif (( $(enddate_epoch "$DIR/root.crt") - $(startdate_epoch "$DIR/root.crt") > 366 * 86400 )); then
  ca_reason="life over 1 year (old CA)"
elif ! openssl x509 -in "$DIR/root.crt" -noout -checkend $((RENEW_DAYS * 86400)) >/dev/null 2>&1; then
  ca_reason="expires in less than $RENEW_DAYS days"
fi

if [[ -n "$ca_reason" ]]; then
  cat > "$tmp/ca.cnf" <<CNF
[req]
distinguished_name = dn
prompt = no
[dn]
CN = Cogniate Dev Root CA (.test only, $(date -u +%Y-%m-%d))
O = Cogniate local dev (not trusted anywhere else)
[v3_ca]
basicConstraints = critical, CA:TRUE, pathlen:0
keyUsage = critical, keyCertSign, cRLSign
nameConstraints = critical, permitted;DNS:test
subjectKeyIdentifier = hash
CNF
  rm -f "$DIR/ca.key.new" "$DIR/root.crt.new"
  openssl req -x509 -new -nodes -newkey rsa:2048 -sha256 -days "$CA_DAYS" \
    -keyout "$DIR/ca.key.new" -out "$DIR/root.crt.new" -config "$tmp/ca.cnf" -extensions v3_ca 2>/dev/null
  mv "$DIR/ca.key.new" "$DIR/ca.key"
  mv "$DIR/root.crt.new" "$DIR/root.crt"
  rm -f "$DIR/stack.crt" "$DIR/stack.key" "$DIR/qa.crt" "$DIR/qa.key"   # a new CA needs new leaves
  echo "Made a new dev CA ($ca_reason): infra/.certs/root.crt (.test names only, $CA_DAYS days)."
  if [[ "$ca_reason" != missing ]]; then
    echo "CAUTION: the CA changed. Run npm run stack:up (recreates the containers that read it), then npm run seed"
    echo "         (rewrites Moodle's moodledata/moodleorgca.crt). If you trusted the old root.crt in a keychain, remove"
    echo "         that trust and trust the new file again. npm run demo:browser needs no change."
  fi
fi

# leaf_ok <base> <san>: infra/.certs/<base>.crt exists, has > RENEW_DAYS left, chains to root.crt, ends before the
# CA, and has exactly these names.
leaf_ok() {
  local base="$1" want="$2"
  [[ -s "$DIR/$base.crt" && -s "$DIR/$base.key" ]] || return 1
  openssl x509 -in "$DIR/$base.crt" -noout -checkend $((RENEW_DAYS * 86400)) >/dev/null 2>&1 || return 1
  openssl verify -CAfile "$DIR/root.crt" "$DIR/$base.crt" >/dev/null 2>&1 || return 1
  (( $(enddate_epoch "$DIR/$base.crt") <= $(enddate_epoch "$DIR/root.crt") )) || return 1
  local have; have="$(openssl x509 -in "$DIR/$base.crt" -noout -text | grep -A1 'Subject Alternative Name' | tail -1 | tr -d ' ')"
  [[ "$have" == "$want" ]] || return 1
}

# make_leaf <base> <san> <first name>: a new key and leaf signed by the CA. It ends at the earlier of
# now + LEAF_DAYS and the CA end date.
make_leaf() {
  local base="$1" want="$2" cn="$3"
  local ca_days_left=$(( ($(enddate_epoch "$DIR/root.crt") - $(date +%s)) / 86400 ))
  local days=$(( ca_days_left < LEAF_DAYS ? ca_days_left : LEAF_DAYS ))
  cat > "$tmp/$base.cnf" <<CNF
[req]
distinguished_name = dn
prompt = no
[dn]
CN = $cn
O = Cogniate local dev
[v3_leaf]
basicConstraints = critical, CA:FALSE
keyUsage = critical, digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = $want
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid
CNF
  openssl req -new -nodes -newkey rsa:2048 -sha256 -keyout "$tmp/$base.key" -out "$tmp/$base.csr" -config "$tmp/$base.cnf" 2>/dev/null
  openssl x509 -req -in "$tmp/$base.csr" -CA "$DIR/root.crt" -CAkey "$DIR/ca.key" -set_serial "0x$(openssl rand -hex 16)" \
    -sha256 -days "$days" -out "$tmp/$base.crt" -extfile "$tmp/$base.cnf" -extensions v3_leaf 2>/dev/null
  mv "$tmp/$base.key" "$DIR/$base.key"
  mv "$tmp/$base.crt" "$DIR/$base.crt"
  echo "Made a new leaf certificate: infra/.certs/$base.crt ($want, $days days)."
}

san="$(printf 'DNS:%s,' "${NAMES[@]}")"; san="${san%,}"
leaf_ok stack "$san" || make_leaf stack "$san" "${NAMES[0]}"
qa_san="$(printf 'DNS:%s,' "${QA_NAMES[@]}")"; qa_san="${qa_san%,}"
leaf_ok qa "$qa_san" || make_leaf qa "$qa_san" "${QA_NAMES[0]}"
chmod 600 "$DIR/ca.key" "$DIR/stack.key" "$DIR/qa.key"
chmod 644 "$DIR/root.crt" "$DIR/stack.crt" "$DIR/qa.crt"
openssl verify -CAfile "$DIR/root.crt" "$DIR/stack.crt" "$DIR/qa.crt" >/dev/null
echo "Certificates OK: infra/.certs/ (CA until $(openssl x509 -in "$DIR/root.crt" -noout -enddate | cut -d= -f2), leaf until $(openssl x509 -in "$DIR/stack.crt" -noout -enddate | cut -d= -f2))"
