#!/usr/bin/env bash
# npm run stack:doctor — check the computer and the stack before (or when) something does not work (B-T1-03).
# One line per check: OK, FIX (with the exact fix on the next line) or INFO. Exit 1 if one check needs a fix.
# It changes nothing.
set -uo pipefail
source "$(dirname "$0")/lib.sh"
fixes=0
ok()   { printf '  OK    %s\n' "$1"; }
info() { printf '  INFO  %s\n' "$1"; }
fix()  { printf '  FIX   %s\n        -> %s\n' "$1" "$2"; fixes=$((fixes + 1)); }
echo "stack:doctor for project $COMPOSE_PROJECT_NAME (port $PUBLIC_PORT, subnet $STACK_SUBNET)"

# 1. Docker
if ! command -v docker >/dev/null 2>&1; then
  fix "Docker is not installed." "Install Docker Desktop, start it, then run npm run stack:doctor again."
  docker_up=0
elif ! docker info >/dev/null 2>&1; then
  fix "Docker is not running." "Start Docker Desktop, wait until it says it is running, then run npm run stack:doctor again."
  docker_up=0
else
  docker_up=1
  # A2: compare bytes. Docker Desktop set to 6 GB reports a bit less than 6 GiB (the VM kernel keeps some), so the
  # limit is 5.5 GiB; the shown value is rounded to 0.1 GB.
  mem=$(docker info --format '{{.MemTotal}}' 2>/dev/null || echo 0); [[ "$mem" =~ ^[0-9]+$ ]] || mem=0
  gb="$(( mem / 1073741824 )).$(( mem % 1073741824 * 10 / 1073741824 ))"
  cpus=$(docker info --format '{{.NCPU}}' 2>/dev/null || echo '?')
  if (( mem < 5905580032 )); then fix "Docker has only ${gb} GB of memory (Moodle, Postgres, the services and the test browser need about 6 GB)." "Docker Desktop > Settings > Resources > Memory: set 6 GB or more, then Apply & restart."
  else ok "Docker is running ($cpus CPUs, ${gb} GB memory)"; fi
fi

# 2. Node and the npm packages on the host
nodev="$(node -v 2>/dev/null || true)"
if [[ -z "$nodev" ]]; then fix "Node.js is not installed." "Install Node.js 24 (24.11 or later), then run npm ci."
elif ! node -e 'const [a,b]=process.versions.node.split(".").map(Number); process.exit(a>24||(a===24&&b>=11)?0:1)'; then fix "Node.js $nodev is too old." "Install Node.js 24 (24.11 or later)."
else ok "Node.js $nodev"; fi
if [[ -d "$REPO_ROOT/node_modules/fastify" ]]; then ok "npm packages are installed"; else fix "The npm packages are not installed." "Run: npm ci"; fi

# 3. .env and the public URLs
if [[ ! -f "$ENV_FILE" ]]; then fix ".env is missing." "Run: npm run gen-env (npm run stack:up also runs it)"
else
  bad=""
  for pair in "PUBLIC_MOODLE_URL:$MOODLE_HOST" "PUBLIC_LTI_URL:$LTI_HOST" "PUBLIC_APP_URL:$APP_HOST" "PUBLIC_CONTENT_URL:$CONTENT_HOST"; do
    name="${pair%%:*}"; want="$(public_url "${pair#*:}")"
    [[ "${!name:-}" == "$want" ]] || bad="$bad $name"
  done
  if [[ -n "$bad" ]]; then fix ".env has old URLs:$bad (they must match PUBLIC_PORT=$PUBLIC_PORT)." "Run: npm run gen-env"; else ok ".env is present and its URLs match PUBLIC_PORT"; fi
fi

# 4. Certificates (days left, names)
if [[ ! -s "$CERTS_DIR/root.crt" || ! -s "$CERTS_DIR/stack.crt" || ! -s "$CERTS_DIR/stack.key" ]]; then
  fix "Certificates are missing in infra/.certs/." "Run: npm run gen-env"
else
  leaf_ok=1
  for h in "${STACK_HOSTS[@]}"; do openssl x509 -in "$CERTS_DIR/stack.crt" -noout -text 2>/dev/null | grep -q "DNS:$h" || leaf_ok=0; done
  if ! openssl x509 -in "$CERTS_DIR/stack.crt" -noout -checkend $(( 14 * 86400 )) >/dev/null 2>&1; then
    fix "The stack certificate ends in less than 14 days." "Delete infra/.certs/stack.crt and infra/.certs/stack.key, run npm run gen-env, then npm run stack:up."
  elif (( ! leaf_ok )); then
    fix "The stack certificate does not name all four hosts (${STACK_HOSTS[*]})." "Delete infra/.certs/stack.crt and infra/.certs/stack.key, run npm run gen-env, then npm run stack:up."
  else
    end="$(openssl x509 -in "$CERTS_DIR/stack.crt" -noout -enddate | cut -d= -f2)"
    ok "Certificates are present (stack certificate until $end)"
  fi
fi

# 5. Port and subnet
if (( docker_up )) && dc port proxy "$PUBLIC_PORT" >/dev/null 2>&1; then ok "Port $PUBLIC_PORT is used by this stack's proxy"
elif (exec 3<>"/dev/tcp/127.0.0.1/$PUBLIC_PORT") 2>/dev/null; then
  fix "Port $PUBLIC_PORT is busy (another program or another stack uses it)." "Stop that program, or set PUBLIC_PORT in .env (for example 8443), run npm run gen-env, then npm run stack:up. Every URL then ends in :<port>."
else ok "Port $PUBLIC_PORT is free"; fi
if (( docker_up )); then
  clash=""
  for net in $(docker network ls -q 2>/dev/null); do
    proj="$(docker network inspect -f '{{index .Labels "com.docker.compose.project"}}' "$net" 2>/dev/null)"
    [[ "$proj" == "$COMPOSE_PROJECT_NAME" ]] && continue
    for sub in $(docker network inspect -f '{{range .IPAM.Config}}{{.Subnet}} {{end}}' "$net" 2>/dev/null); do
      [[ "$sub" == "$STACK_SUBNET" ]] && clash="$clash $(docker network inspect -f '{{.Name}}' "$net")"
    done
  done
  if [[ -n "$clash" ]]; then fix "Subnet $STACK_SUBNET is used by another Docker network:$clash." "Set STACK_SUBNET in .env to a free range (for example 172.29.0.0/16), run npm run gen-env, then npm run stack:up."
  else ok "Subnet $STACK_SUBNET is free (or used by this stack)"; fi
fi

# 6. Images (the first npm run stack:up downloads about 2.3 GB)
if (( docker_up )); then
  missing=""
  for img in caddy:2.11.7-alpine postgres:16-alpine erseco/alpine-moodle:v5.2.4 node:24.22.0-alpine3.24 mcr.microsoft.com/playwright:v1.56.0-noble; do
    docker image inspect "$img" >/dev/null 2>&1 || missing="$missing $img"
  done
  if [[ -n "$missing" ]]; then fix "Images not downloaded yet:$missing." "Run: npm run stack:up (the first time it downloads about 2.3 GB; the test image comes with the first test run)."
  else ok "All base images are present"; fi
  if docker image inspect cogniate-build-moodle:v5.2.4 >/dev/null 2>&1; then ok "The Build Runner image is present (cogniate-build-moodle:v5.2.4)"
  else info "The Build Runner image is not built yet. The Build Runner builds it at its first start (about 20 s), or run: bash infra/scripts/build-runner.sh image"; fi
fi

# 7. Course fixtures (the two zips are not in git)
fx=0
for z in "Build Your First Website with AI_ The Zero-to-Hero Micro-Sprint-scorm-v2.zip" "Build Your First Website with AI_ The Zero-to-Hero Micro-Sprint-html.zip"; do
  [[ -s "$COURSE_FIXTURES_DIR/$z" ]] && fx=$((fx + 1))
done
if (( fx == 2 )); then ok "Both course zips are present ($COURSE_FIXTURES_DIR)"
else fix "The two course zips are not in $COURSE_FIXTURES_DIR ($fx of 2 found)." "Make the folder: mkdir -p \"${COURSE_FIXTURES_DIR#"$REPO_ROOT"/}\". Copy the two course zips into it (see infra/README.md, fixtures), or set COURSE_FIXTURES_DIR. Check with: npm run fixtures:check"; fi

# 8. The running stack (only if it is up)
if (( docker_up )) && [[ -n "$(dc ps -q 2>/dev/null)" ]]; then
  for svc in proxy postgres moodle lti-service cogniate-app; do
    cid="$(dc ps -q "$svc" 2>/dev/null)"; st="$( [[ -n "$cid" ]] && docker inspect -f '{{.State.Health.Status}}' "$cid" 2>/dev/null || echo missing)"
    if [[ "$st" == healthy ]]; then ok "Service $svc is healthy"; else fix "Service $svc is $st." "Run: npm run stack:up (logs: npm run stack:logs -- $svc)"; fi
  done
  if build_runner_running; then ok "The Build Runner is running (host side)"; else fix "The Build Runner is not running (needed for .mbz builds only)." "Run: npm run stack:up (it starts the runner), or npm run build-runner"; fi
  if [[ -s "$KNOBS_FILE" ]] && grep -q '"environment"' "$KNOBS_FILE"; then fix "Test knobs are active (tests only)." "Run: npm run stack:restart -- <service> for each service in .tmp/compose.knobs.yaml"; else ok "No test knobs are active"; fi
  [[ "$ACTIVE_STACK_PROFILE" == default ]] && ok "Profile: default" || fix "The acceptance profile is on (tests only)." "Run: npm run stack:up (without STACK_PROFILE)"
  [[ -s "$INFRA_DIR/.secrets/seed.json" ]] && ok "The stack is seeded" || fix "The stack is not seeded yet." "Run: npm run seed"
else
  info "The stack is not running. Start it with: npm run stack:up, then npm run seed"
fi

# 9. Browsing the stack names
if [[ "$(dscacheutil -q host -a name "$MOODLE_HOST" 2>/dev/null | awk '/ip_address/ {print $2; exit}')" == 127.0.0.1 ]] || grep -q "$MOODLE_HOST" /etc/hosts 2>/dev/null; then
  ok "$MOODLE_HOST resolves on this computer"
else
  info "The stack names do not resolve in your normal browser. Use: npm run demo:browser (no change to the computer), or add to /etc/hosts: 127.0.0.1 ${STACK_HOSTS[*]}"
fi

echo
if (( fixes == 0 )); then echo "Result: all checks OK."; exit 0; fi
echo "Result: $fixes check(s) need a fix (see FIX above)."
exit 1
