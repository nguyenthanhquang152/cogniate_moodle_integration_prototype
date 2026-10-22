# QA-2 K1-SIM Execution Plan (Provisional Window `14:00–16:00Z`)

- **Lane / Role**: `QA-2` (`tests/ltiaas/tasks-ops/**`, lanes S1 and S2)
- **Provisional Docker Window**: `14:00–16:00Z` (120 minutes total; **not granted yet** — do not run any Docker command until the Lead issues an explicit `DOCKER-YES` grant)
- **Compose Project Naming**: `COMPOSE_PROJECT_NAME=qa2-la-sim-<n>` (`qa2-la-sim-r1` .. `qa2-la-sim-r4`)
- **Default Port & Subnet**: `PUBLIC_PORT=9443`, `STACK_SUBNET=172.20.0.0/16` (if co-scheduled with another lane on the host, use the slot-assigned port/subnet from the Lead grant)

---

## 1. Suite Execution Order & Time Budget

The 12 QA-2 suites run in the exact dependency and state-isolation order below:

| Order | Task ID | Batch | Project (`COMPOSE_PROJECT_NAME`) | K0 / K1-SIM Tests | Est. Standalone Min | Est. Batched Min | Why This Order |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `LA-E5-01` | Batch 1a | `qa2-la-sim-r1` | 10 `K1-SIM` (+ 2 host rows) | 6 min | 6 min | Verifies operator listener (`:4110`), `lti:operator init`, `--if-none` (second `seed`), and `--replace` before any other operator API suite runs. |
| 2 | `LA-E5-08` | Batch 1b | `qa2-la-sim-r1` | 4 `K1-SIM` (U1 old + new) | 8 min | 8 min | Runs the two-build upgrade path (`--old-sha` -> `--sha`) on its own volume to prove `local-keyring` opens generation-0 rows and keeps service keys byte-identical. |
| 3 | `LA-E5-02` | Batch 2 | `qa2-la-sim-r2` | 1 `K0` + 7 `K1-SIM` | 5 min | 3 min | Verifies LTI `audit_event` writer, query filters, and secret scan across tenant/operator actions. |
| 4 | `LA-E5-04` | Batch 2 | `qa2-la-sim-r2` | 9 `K1-SIM` | 6 min | 4 min | Verifies `POST`/`PATCH /operator/v1/accounts`, account status (`active`/`suspended`/`closed`), custom `launchUrl`, `claimPolicy`, and shared-platform API. Restores `qa-second` to `active`. |
| 5 | `LA-E5-10` | Batch 2 | `qa2-la-sim-r2` | 7 `K1-SIM` | 6 min | 4 min | Verifies signing-key lifecycle (`next` -> `active` -> `retired` -> `removed`), lead-time `409`, `{force: true}` rotation, JWKS order, Deep Linking, and pre-rotation service-key score POST. |
| 6 | `LA-E5-07` | Batch 2 | `qa2-la-sim-r2` | 8 `K1-SIM` | 5 min | 3 min | Verifies API key issue/revoke, 2-key cap (`409 API_KEY_LIMIT`), `launch` vs `admin` scopes (`403 API_KEY_SCOPE_MISSING`), `expiresAt` bounds, and `BD-A2-12` (`409 ACCOUNT_CLOSED` on issue; idempotent `200` on revoke). |
| 7 | `LA-E5-03` | Batch 2 | `qa2-la-sim-r2` | 9 `K1-SIM` | 6 min | 4 min | Verifies rate-limit classes, `Retry-After` + `details.retryAfter` (`BD-A2-16..19`), `registrationSessionsPerAddress` (`1..1000 | null`, `BD-A2-18/20`), soft limits, and trusted-proxy `X-Forwarded-For`. Restores `/operator/v1/rate-limits` in `afterAll`. |
| 8 | `LA-E5-19` | Batch 2 | `qa2-la-sim-r2` | 3 `K1-SIM` | 5 min | 3 min | Verifies `job_run` startup lines (`retention`, `signing-key-cleanup`) and clean `npm run stack:restart -- lti-service` with zero `job_instance_conflict`. |
| 9 | `LA-E5-05` | Batch 3a | `qa2-la-sim-r3` | 8 `K1-SIM` | 6 min | 6 min | Verifies `lti:bootstrap` (fresh before `seed`, `--rotate-api-key`, `--rotate-signing-key` with waiting `next` key per `BD-A2-14`, missing operator key file form (e), double `seed` idempotence) and `lti:shared-platform`. |
| 10 | `LA-E5-11` | Batch 2 (or 3b) | `qa2-la-sim-r2` | 1 `K1-SIM` | 4 min | 2 min | Verifies `docker compose exec cogniate-app npm run app:audit -- list` on a fresh stack exits `0`, prints no CLI line, and writes no event. |
| 11 | `LA-E5-09` | Batch 3b | `qa2-la-sim-r3` | 5 `K1-SIM` | 6 min | 6 min | Verifies `GET /operator/v1/key-provider` (`legacy` `derivedCount`), QA form (a) `infra/.secrets/lti/keyring.json` rotation to `k2`, `POST /operator/v1/key-provider/rewrap`, post-rewrap launch/DL/token/score POST, `job_run {job: "key-rewrap"}` + 2 `key_provider.rewrap` audit events (`BD-A2-36/38/42/43`: `outcome: "complete"`, `rewrapped`, `skippedChanged`, `notReached`, `unreadable`, `legacyBlobsRefused: true`), and keyring restore in `finally`. |
| 12 | `LA-E7-03` | Batch 4 | `qa2-la-sim-r4` | 1 `K0` + 3 `K1-SIM` | 8 min | 8 min | Verifies `tests/sim/hosts.json` manifest wiring across `acceptance` and `default` profiles, dynamic provider addition (`zz-qa2-sim`), and `/healthz` golden `G1` match. |
| 13 | `LA-E5-15` | Batch 2 | `qa2-la-sim-r2` | 6 `K1-SIM` | 5 min | 3 min | Verifies `POST /api/service-keys/revoke` (`200 { revoked: n }`, `404 UNREGISTERED_PLATFORM`, `200 { revoked: 0 }` per `BD-A2-47`), `resourceLinkId` filter, `issue_epoch` re-issue on next launch, `serviceKeyWriteScope: "resource-link"` (`403 SERVICE_KEY_SCOPE` on cross-resource-link write, `204` on own `lineitem`, `204` on `LTIK-AUTH-V2`), `403 API_KEY_SCOPE_MISSING` for `launch`-only key, and `service_key.revoke` audit events. |
| 14 | `LA-E5-16` | Batch 2 | `qa2-la-sim-r2` | 5 `K1-SIM` | 5 min | 3 min | Verifies `Idempotency-Key` on `POST /api/lineitems`, `POST /api/platforms`, and `POST /api/platforms/:id/deployments`: stored `201` replay with single simulator create, `422 IDEMPOTENCY_KEY_REUSED` on body mismatch, tenant isolation (`cogniate` vs `qa-second`), `400 INVALID_REQUEST` on invalid header grammar, and unchanged behaviour without the header. |
| 15 | `LA-E5-17` | Batch 2 | `qa2-la-sim-r2` | 5 `K1-SIM` | 4 min | 2 min | Verifies `GET http://lti-service:4110/metrics` (`200` OpenMetrics text with `lti_http_requests_total`, `lti_rate_limited_total`, `lti_launch_total`, `lti_ready`), `404` on public `GET /metrics`, `200 {"status":"ready"}` with no `reasons` on public `GET /readyz`, `acceptance` `/healthz` golden `G1` match, and `tool_account_id: "cogniate"` in `http_request` with zero PII (`name`, `email`, `sub`) in logs or metrics. |
| 16 | `LA-E5-21` | Batch 3c | `qa2-la-sim-r3` | 2 `K1-SIM` | 5 min | 4 min | Verifies tasks README §2 form (f) (`docker compose run --rm -e STACK_PROFILE=production -e <knob>=<value> lti-service npm start` exits `1` with `config_refused {reason: "test_knob_active"}`) and that `default` and `acceptance` profiles start with today's env values and match `G1` `/healthz`. |
| **Total** | **16 suites** | **4 batches** | `qa2-la-sim-r1..r4` | **2 `K0` + 92 `K1-SIM`** | **~90 min** | **~69 min** | Fits inside the 120-minute `14:00–16:00Z` window with >45 min margin when batched. |

---

## 2. Pre-Window Host-Only Gate (`0` Docker, Run Before `14:00Z`)

Run these host-only checks before starting the Docker window:

```sh
# 1. Typecheck all 16 QA-2 suites
for t in LA-E5-01 LA-E5-08 LA-E5-02 LA-E5-04 LA-E5-10 LA-E5-07 LA-E5-03 LA-E5-19 LA-E5-05 LA-E5-11 LA-E5-09 LA-E7-03 LA-E5-15 LA-E5-16 LA-E5-17 LA-E5-21; do
  npx --prefix tests tsc --noEmit -p "tests/ltiaas/tasks-ops/$t/tsconfig.json" || exit 1
done

# 2. Run K0-only checks (no Docker)
node --test tests/ltiaas/tasks-ops/LA-E5-01/cli-output.selftest.mjs
LA_LEVEL=k0 npx --prefix tests vitest run --config tests/ltiaas/tasks-ops/LA-E5-02/vitest.config.mts
LA_LEVEL=k0 npx --prefix tests vitest run --config tests/ltiaas/tasks-ops/LA-E7-03/vitest.config.mts
```

---

## 3. Commands Per Batch (During Granted Window)

Set the integration SHA and baseline old SHA (`G-BASE` / pre-E5 SHA provided by the Lead):

```sh
export SHA="<integration-sha>"
export OLD_SHA="bd368ff"
export PUBLIC_PORT=9443
export STACK_SUBNET="172.20.0.0/16"
```

### Batch 1 (`COMPOSE_PROJECT_NAME=qa2-la-sim-r1`, ~14 min): `LA-E5-01` & `LA-E5-08`

`LA-E5-01` tests profile bind switching (`default` vs `acceptance`) and `lti:operator init --replace`. `LA-E5-08` tests the two-SHA U1 upgrade path (`--old-sha` -> `--sha`). Each runner manages its own clone, lifecycle, and label-scoped teardown on `qa2-la-sim-r1`:

```sh
# 1. LA-E5-01 (~6 min)
COMPOSE_PROJECT_NAME=qa2-la-sim-r1 PUBLIC_PORT=$PUBLIC_PORT STACK_SUBNET=$STACK_SUBNET \
  node tests/ltiaas/tasks-ops/LA-E5-01/run.mjs --sha "$SHA" --replace-tests

# 2. LA-E5-08 (~8 min)
COMPOSE_PROJECT_NAME=qa2-la-sim-r1 PUBLIC_PORT=$PUBLIC_PORT STACK_SUBNET=$STACK_SUBNET \
  node tests/ltiaas/tasks-ops/LA-E5-08/run.mjs --sha "$SHA" --old-sha "$OLD_SHA"
```

### Batch 2 (`COMPOSE_PROJECT_NAME=qa2-la-sim-r2`, ~23–31 min): `LA-E5-02`, `LA-E5-04`, `LA-E5-10`, `LA-E5-07`, `LA-E5-03`, `LA-E5-19`, `LA-E5-11`

Each suite in Batch 2 leaves the `acceptance` stack clean and restores any modified setting (`qa-second` status in `LA-E5-04`, `/operator/v1/rate-limits` in `LA-E5-03`).

**Option A — Standalone self-contained `run.mjs` per suite (~34 min total, zero cross-suite state):**

```sh
for t in LA-E5-02 LA-E5-04 LA-E5-10 LA-E5-07 LA-E5-03 LA-E5-19 LA-E5-11; do
  COMPOSE_PROJECT_NAME=qa2-la-sim-r2 PUBLIC_PORT=$PUBLIC_PORT STACK_SUBNET=$STACK_SUBNET \
    node "tests/ltiaas/tasks-ops/$t/run.mjs" --sha "$SHA" --replace-tests || break
done
```

**Option B — Single stack bring-up on `qa2-la-sim-r2` (~23 min total, if time is tight):**
Run `LA-E5-11` first (while `cogniate-app` `audit_event` is empty), then `LA-E5-02`, `LA-E5-04`, `LA-E5-10`, `LA-E5-07`, `LA-E5-03`, and `LA-E5-19` (`LA-E5-19` restarts `lti-service` once at the end of the batch).

### Batch 3 (`COMPOSE_PROJECT_NAME=qa2-la-sim-r3`, ~12 min): `LA-E5-05` & `LA-E5-09`

`LA-E5-05` tests pre-seed `lti:bootstrap` on a brand-new stack and double `npm run seed`. `LA-E5-09` (run once S2 merges `LA-E5-09`) writes `infra/.secrets/lti/keyring.json`, restarts `lti-service`, re-wraps all blobs to `k2`, and restores in `finally`:

```sh
# 9. LA-E5-05 (~6 min)
COMPOSE_PROJECT_NAME=qa2-la-sim-r3 PUBLIC_PORT=$PUBLIC_PORT STACK_SUBNET=$STACK_SUBNET \
  node tests/ltiaas/tasks-ops/LA-E5-05/run.mjs --sha "$SHA" --replace-tests

# 11. LA-E5-09 (~6 min, run when LA-E5-09 is merged on integration)
COMPOSE_PROJECT_NAME=qa2-la-sim-r3 PUBLIC_PORT=$PUBLIC_PORT STACK_SUBNET=$STACK_SUBNET \
  node tests/ltiaas/tasks-ops/LA-E5-09/run.mjs --sha "$SHA" --replace-tests
```

### Batch 4 (`COMPOSE_PROJECT_NAME=qa2-la-sim-r4`, ~8 min): `LA-E7-03`

`LA-E7-03` tests `tests/sim/hosts.json` manifest wiring across `acceptance` and `default` compose profiles:

```sh
# 12. LA-E7-03 (~8 min)
COMPOSE_PROJECT_NAME=qa2-la-sim-r4 PUBLIC_PORT=$PUBLIC_PORT STACK_SUBNET=$STACK_SUBNET \
  node tests/ltiaas/tasks-ops/LA-E7-03/run.mjs --sha "$SHA" --replace-tests
```

---

## 4. Owned-Only Cleanup Commands (`TEST-STRATEGY §5.4`)

Every `run.mjs` runner automatically tears down its own project (`qa2-la-sim-r1`..`qa2-la-sim-r4`) in `finally`. Before exiting the Docker window (or after any interrupted run), run this owned-only cleanup sweep to guarantee zero leftover `qa2-la-sim-*` containers, networks, or volumes without touching any other lane's resources (`docker system prune` and `docker volume prune` are **forbidden**):

```sh
for proj in qa2-la-sim-r1 qa2-la-sim-r2 qa2-la-sim-r3 qa2-la-sim-r4; do
  # 1. Remove containers owned by $proj
  cids=$(docker ps -aq --filter "label=com.docker.compose.project=${proj}")
  if [ -n "$cids" ]; then
    docker rm -f $cids
  fi

  # 2. Remove networks owned by $proj
  nids=$(docker network ls -q --filter "label=com.docker.compose.project=${proj}")
  if [ -n "$nids" ]; then
    docker network rm $nids
  fi

  # 3. Remove volumes owned by $proj
  vids=$(docker volume ls -q --filter "label=com.docker.compose.project=${proj}")
  if [ -n "$vids" ]; then
    docker volume rm -f $vids
  fi
done

# 4. Verify zero qa2-la-sim-* resources remain
docker ps -a --filter "name=qa2-la-sim-"
docker network ls --filter "name=qa2-la-sim-"
docker volume ls --filter "name=qa2-la-sim-"
```
