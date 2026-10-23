# QA-4 (`tasks-lti`) — `K1-SIM` Consolidated Execution Plan (Lanes `L` and `L2`)

## 1. Scope & Slot Allocation

This runbook consolidates all pending **`K1-SIM`**, `MOODLE-LIVE`-free, and golden-free Docker acceptance tests owned by **QA-4** across lanes `L` and `L2` (`tests/ltiaas/tasks-lti/**`, 13 merged tasks on `main`) so that a single booked SIM Docker window can execute them in four deterministic batches without cross-suite interference.

- **Owner:** QA-4 (`tests/ltiaas/tasks-lti/**`)
- **Lanes:** `L` and `L2`
- **Compose project names:** `qa4-la-sim-r1` .. `qa4-la-sim-r4`
- **`PUBLIC_PORT`:** `9463`
- **`STACK_SUBNET`:** `172.22.0.0/16`
- **Scratch run root (`umask 077`):** `/Users/quangnguyen/cogniate-qa-runs/LA/sim-window-<SHA>`
- **Private Docker snapshot & log dir:** `/Users/quangnguyen/cogniate-qa-runs/LA/sim-window-<SHA>/logs`

---

## 2. Suite Execution Order & Time Budget

Suites are ordered by dependency and state isolation:

1. **Batch 1 (`qa4-la-sim-r1` — Standard `acceptance` stack, non-mutating / platform-isolated LTI protocol, Deep Linking, AGS/NRPS & logging suites):**
   Starts one clean `acceptance` stack and runs 9 suites sequentially. Each suite registers its own isolated Canvas/Blackboard/standard test platform (via `canvasPlatform` / `POST /api/platforms`) and cleans up its created platform records without changing global account status, rate-limit caps, or `lti-service` container env variables.
2. **Batch 2 (`qa4-la-sim-r2` — Standard `acceptance` stack, end-to-end launch/player/score-sync & simulator fault-injection suites):**
   Isolates `LA-E3-03` (which creates courses, publications, learner launches without `context`, and grade sync dispatch in `cogniate-app` + `lti-service`) and `LA-E5-14` (which arms and clears `POST https://canvas.sim.test/__sim/faults` throttling faults for `429` / `403 Rate Limit Exceeded`).
3. **Batch 3 (`qa4-la-sim-r3` — Operator account-status & registration session-cap mutation suite):**
   Isolates `LA-E5-06`, which mutates the `cogniate` tool account (`PATCH /operator/v1/accounts/cogniate` to `suspended`, `closed`, and `limits.registrationSessionsPerAddress = 3`, restoring `active` and `10` in `finally`). Running it in its own batch guarantees no other suite observes a transient `suspended`/`closed` account state.
4. **Batch 4 (`qa4-la-sim-r4` — `lti-service` env override recreate suite without `PUBLIC_MOODLE_URL`):**
   Isolates `LA-E1-05` (`AC-LA-E1-05-07` & `AC-LA-E1-05-08`), which writes `.tmp/compose.knobs.yaml` to set `PUBLIC_MOODLE_URL: null` and recreates `lti-service` mid-suite so `standard` (`issuerKind: 'per-tenant'`) can be verified without `PUBLIC_MOODLE_URL` alongside Canvas/Blackboard simulator privacy-floor launches.

| Order | Batch / Project | Task ID | Lane | Test File (`tests/ltiaas/tasks-lti/...`) | Pending `K1-SIM` ACs Covered (`MOODLE-LIVE`-free, Golden-free) | Stack Profile & Isolation Notes | Est. Min (Standalone) | Est. Min (Batched) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :---: | :---: |
| 1 | **Batch 1** (`qa4-la-sim-r1`) | `LA-E1-10` | `L` | `LA-E1-10/providers-and-texts.k1sim.test.ts` | `AC-LA-E1-10-02` (live `POST /api/platforms` admin-value vs fixed provider plan; plus live `LA_SIM_STACK=1` checks for `AC-LA-E1-10-01` & `AC-LA-E1-10-04`) | Standard `acceptance` stack (boot + build ~6 min once for Batch 1); cleans up created platforms in `finally` | 5 | 6 (boot) + 2 |
| 2 | **Batch 1** (`qa4-la-sim-r1`) | `LA-E3-01` | `L` | `LA-E3-01/platform-storage-login.k1sim.test.ts` | `AC-LA-E3-01-10` (`AP-05-01` `302` login regression without `lti_storage_target` / `null` trait; `AP-05-02` `200` storage login page with rule-3 CSP & matching `authUrl`) | Shares `qa4-la-sim-r1`; isolated per-test platform registrations | 5 | 2 |
| 3 | **Batch 1** (`qa4-la-sim-r1`) | `LA-E3-02` | `L` | `LA-E3-02/platform-storage-check.k1sim.test.ts` | `AC-LA-E3-02-01`, `02`, `03`, `05`, `06`, `07`, `10`, `11`, `12` (`storage-check` page, `POST /lti/launch/:account/storage-check`, `Origin`, single-use, `STATE_COOKIE_MISSING`, check-6 order, cookie-first priority, `suspended`/`closed` status gates on isolated test account) | Shares `qa4-la-sim-r1`; uses dedicated operator-created test account for status checks | 6 | 3 |
| 4 | **Batch 1** (`qa4-la-sim-r1`) | `LA-E3-04` | `L` | `LA-E3-04/deep-linking.k1sim.test.ts` | `AC-LA-E3-04-01`, `02`, `04`, `05` (+ `03`, `06`, `07` on SIM: empty `contentItems: []` cancel JWT, `accept_multiple: false`, `accept_lineitem: false`, `acceptLineItem` & `acceptMediaTypes` on `GET /api/idtoken`, `/form` & `/message`) | Shares `qa4-la-sim-r1`; isolated Canvas simulator Deep Linking launches | 5 | 2 |
| 5 | **Batch 1** (`qa4-la-sim-r1`) | `LA-E3-13` | `L2` | `LA-E3-13/deep-linking-per-type.k1sim.test.ts` | `AC-LA-E3-13-01`, `02`, `03`, `04` (per-type `link`/`file`/`image`/`html` validation `400 INVALID_CONTENT_ITEM` with index, signed JWT verification, `ltiResourceLink` regression) | Shares `qa4-la-sim-r1`; isolated Canvas simulator Deep Linking launches | 4 | 2 |
| 6 | **Batch 1** (`qa4-la-sim-r1`) | `LA-E3-06` | `L` | `LA-E3-06/nrps-scopes.k1sim.test.ts` | `AC-LA-E3-06-01`, `02`, `03`, `05`, `06` (+ `04` on SIM: Dynamic Registration `complete.scopes` custom list, default 5-scope fallback, unsupported scope `400`, `registration.complete` audit event with `scopes`, `/api/memberships` regression) | Shares `qa4-la-sim-r1`; uses ephemeral local HTTPS mock OpenID config server + simulator | 5 | 2 |
| 7 | **Batch 1** (`qa4-la-sim-r1`) | `LA-E3-11` | `L` | `LA-E3-11/ags-extras.k1sim.test.ts` | `AC-LA-E3-11-01`, `02`, `04` (+ `03`, `05` on SIM: AGS `submission.startedAt`/`submittedAt`, `scoringUserId`, HTTPS URL-keyed extension members on scores & line items, non-HTTPS drop, 9-key / >4 KB `400 INVALID_REQUEST`) | Shares `qa4-la-sim-r1`; isolated Canvas simulator AGS line items & scores | 4 | 2 |
| 8 | **Batch 1** (`qa4-la-sim-r1`) | `LA-E3-12` | `L` | `LA-E3-12/small-spec-gaps.k1sim.test.ts` | `AC-LA-E3-12-01`, `02`, `03` (+ `04`, `05` on SIM: `scoreGiven: null` parity with absent `scoreGiven`, NRPS `service_versions: ["1.0"]` -> `403 SERVICE_NOT_AVAILABLE`, `trustedAudiences` on `POST`/`PATCH /api/platforms` & launch check 5) | Shares `qa4-la-sim-r1`; isolated Canvas simulator platforms | 4 | 2 |
| 9 | **Batch 1** (`qa4-la-sim-r1`) | `LA-E5-18` | `L2` | `LA-E5-18/protocol-tenant-logs.k1sim.test.ts` | `AC-LA-E5-18-01`, `02`, `03` (+ `04`, `05` on SIM: `tool_account_id` and `platform_id` in `login_rejected`, `launch_check_failed`, `launch_claims_minimized`, `launch_accepted`; unknown account `404` omits `tool_account_id`) | Shares `qa4-la-sim-r1` + `docker compose logs lti-service` JSON verification + teardown (~1 min) | 4 | 2 + 1 (down) |
| 10 | **Batch 2** (`qa4-la-sim-r2`) | `LA-E3-03` | `L2` | `LA-E3-03/launch-without-context.k1sim.test.ts` | `AC-LA-E3-03-01`, `02`, `03`, `04`, `05`, `06` (learner launch without `context` with/without AGS opens `/play/...`, `GET /api/idtoken` `services.serviceKey` & absent `launch.context`, score dispatch to `lineitem` vs `"No gradebook column"`, placement deduplication per deployment, `MISSING_CLAIM` without `sub`) | Fresh `acceptance` stack (`qa4-la-sim-r2`, boot ~4 min cached); exercises `cogniate-app` + `lti-service` end-to-end | 6 | 4 (boot) + 3 |
| 11 | **Batch 2** (`qa4-la-sim-r2`) | `LA-E5-14` | `L` | `LA-E5-14/throttling.k1sim.test.ts` | `AC-LA-E5-14-01`, `02`, `03`, `04`, `05` (simulator `429` + `Retry-After: 120`, `403 Rate Limit Exceeded` -> `Retry-After: 60`, token `429` without `Retry-After`, memberships `429`, single outbound attempt + `platform_rate_limited` log event) | Shares `qa4-la-sim-r2`; clears `/__sim/faults` in `beforeEach`/`afterAll` + teardown (~1 min) | 5 | 2 + 1 (down) |
| 12 | **Batch 3** (`qa4-la-sim-r3`) | `LA-E5-06` | `L` | `LA-E5-06/protocol-wiring.k1sim.test.ts` | `AC-LA-E5-06-01`, `02`, `03`, `04`, `05`, `06`, `07`, `10` (operator `PATCH /operator/v1/accounts/cogniate` `suspended`/`closed` status gates on login, launch, register & JWKS; `registrationSessionsPerAddress = 3` cap; Moodle-shaped Dynamic Registration `protocolUrls`) | Dedicated stack (`qa4-la-sim-r3`, boot ~4 min cached) because it mutates `cogniate` account status & session limits; restores in `finally` + teardown (~1 min) | 6 | 4 (boot) + 3 + 1 (down) |
| 13 | **Batch 4** (`qa4-la-sim-r4`) | `LA-E1-05` | `L` | `LA-E1-05/profiles.k1sim.test.ts` | `AC-LA-E1-05-07`, `AC-LA-E1-05-08` (`lti-service` recreated with `PUBLIC_MOODLE_URL: null` via `.tmp/compose.knobs.yaml` serves Moodle-shaped launch on `standard` and `/healthz` allowlist; Canvas & Blackboard simulator launches enforce `privacyFloor: 'allowlist'` and Moodle-shaped launch keeps `'none'`) | Dedicated stack (`qa4-la-sim-r4`, boot ~4 min cached) because the test writes `.tmp/compose.knobs.yaml` and recreates `lti-service` without `PUBLIC_MOODLE_URL` + teardown (~1 min) | 7 | 4 (boot) + 3 + 1 (down) |

### Summary of Estimated Minutes

- **Batch 1 (`qa4-la-sim-r1`, 9 suites):** **26 minutes** batched (vs 42 minutes standalone)
- **Batch 2 (`qa4-la-sim-r2`, 2 suites):** **10 minutes** batched (vs 11 minutes standalone)
- **Batch 3 (`qa4-la-sim-r3`, 1 suite):** **8 minutes** batched (vs 6 minutes standalone)
- **Batch 4 (`qa4-la-sim-r4`, 1 suite):** **8 minutes** batched (vs 7 minutes standalone)
- **Total Estimated Time (all 4 batches, 13 suites):** **52 minutes batched** (66 minutes if every suite booted its own stack standalone)

---

## 3. Rows Explicitly Excluded from This SIM Window

Per task brief rules, **`MOODLE-LIVE` rows**, **golden-only (`G1`–`G4` capture/compare) rows**, **Lead `R1` full regression**, and **QA-E2E (`tests/e2e/**`) `K2` browser suites** are kept out of this SIM-only window and tracked separately below:

| Task ID | Excluded AC(s) | Kind / Owner | Reason Excluded from This `K1-SIM` Window |
| :--- | :--- | :--- | :--- |
| `LA-E1-05` | `AC-LA-E1-05-01` .. `AC-LA-E1-05-06`, `AC-LA-E1-05-09` | Golden `G1`–`G4` (`LA-IC-01`) | Require a fresh post-E1 golden capture (`LA_GOLDEN_CAPTURE=<dir>`) compared against `G-BASE` (`1b17261be97c4701b928fa9dc2fa74c6d23028f6`). *(Note: `profiles.k1sim.test.ts` skips golden assertions unless `LA_GOLDEN_CAPTURE` is set.)* |
| `LA-E1-05` | `AC-LA-E1-05-10` | `R1` (Lead) | Full `R1` (`M1` 394 sim rows + `M2` 64 cases) is run once by Lead at the end of the phase. |
| `LA-E1-10` | `AC-LA-E1-10-01` (golden part), `AC-LA-E1-10-04` (golden part) | Golden `G1` & `G4` (`LA-IC-01`) | Golden capture/diff half requires `LA_GOLDEN_CAPTURE=<dir>`. The live SIM API/page assertions in `AC-LA-E1-10-01`, `02`, `04` DO run in Batch 1 with `LA_SIM_STACK=1`. |
| `LA-E1-10` | `AC-LA-E1-10-02` (`R1` summary half) | `R1` (Lead) | Full `R1` (`M1` sim + `M2`) is run once by Lead at the end of the phase. |
| `LA-E1-10` | `AC-LA-E1-10-03`, `AC-LA-E1-10-05`, `AC-LA-E1-10-06` | `K2` (`MOODLE-LIVE` / Playwright UI) | Owned by QA-E2E (`tests/e2e/**`); require browser / live Moodle window. |
| `LA-E3-01` | `AC-LA-E3-01-11` | `K2` (Playwright UI, QA-E2E) | Browser postMessage (`lti.put_data`) flow owned by QA-E2E (`tests/e2e/**`). |
| `LA-E3-02` | `AC-LA-E3-02-08`, `AC-LA-E3-02-09` | `K2` (Playwright UI, QA-E2E) | Third-party-cookie-blocked Chromium browser storage-check flows owned by QA-E2E (`tests/e2e/**`). |
| *(Unmerged)* `LA-E2-01` | `AC-LA-E2-01-03`, `AC-LA-E2-01-08` | Golden `G1` & `G2` (`LA-IC-02`) | `LA-E2-01` author code is not yet merged on `f2e340e`, and its `K1-SIM` rows are golden `G1`/`G2` comparisons (`LA-IC-02`). |

---

## 4. Pre-Window Host-Only Gate (`K0` + TypeScript Check)

Before booking or starting any Docker stack, run the host-only gate on the target integration SHA clone to verify that all 14 `tasks-lti` TypeScript projects compile cleanly (`tsc --noEmit`) and all 13 merged `K0` Vitest suites (including `F1` LMS-name checks, `F5` architecture/SQL-portability rules, and author unit/migration suites) pass.

### Gate Commands

```bash
umask 077
export TARGET_SHA="f2e340e0e5bce7e2071ca7d7dfecd92a40c12e5f"
export RUN_ROOT="/Users/quangnguyen/cogniate-qa-runs/LA/qa4-plan-f2e340e"
export CLONE="$RUN_ROOT/clone"
export LOGS="$RUN_ROOT/logs"

mkdir -p "$LOGS"
git -C "$CLONE" status --porcelain > "$LOGS/status-before.txt"

# 1. TypeScript check across all 14 tasks-lti suites
cd "$CLONE/tests"
for d in ltiaas/tasks-lti/LA-*; do
  npx tsc -p "$d/tsconfig.json" --noEmit
done

# 2. Host-only K0 Vitest gate across all 13 merged tasks-lti suites
for task in \
  LA-E1-05 LA-E1-10 LA-E3-01 LA-E3-02 LA-E3-03 LA-E3-04 \
  LA-E3-06 LA-E3-11 LA-E3-12 LA-E3-13 LA-E5-06 LA-E5-14 LA-E5-18; do
  LA_LEVEL=k0 QA_TASK="$task" QA_REPO_ROOT="$CLONE" LA_TARGET_ROOT="$CLONE" npm run acceptance:api
done

git -C "$CLONE" status --porcelain > "$LOGS/status-after.txt"
wc -c "$LOGS/status-before.txt" "$LOGS/status-after.txt"
```

### Recorded Pre-Window Gate Result on `f2e340e` (code as `19d6dc4`)

- **Executed at:** `2026-10-23T08:48:41+07:00` .. `2026-10-23T08:50:30+07:00`
- **Target SHA:** `f2e340e0e5bce7e2071ca7d7dfecd92a40c12e5f` (code identical to `19d6dc4`)
- **Scratch clone:** `/Users/quangnguyen/cogniate-qa-runs/LA/qa4-plan-f2e340e/clone`
- **Gate log:** `/Users/quangnguyen/cogniate-qa-runs/LA/qa4-plan-f2e340e/logs/pre-window-gate.log`
- **Git cleanliness:** `status-before.txt` = `0` bytes; `status-after.txt` = `0` bytes
- **TypeScript (`tsc --noEmit`):** **14 / 14 passed** (`LA-E1-05`, `LA-E1-10`, `LA-E2-01`, `LA-E3-01`, `LA-E3-02`, `LA-E3-03`, `LA-E3-04`, `LA-E3-06`, `LA-E3-11`, `LA-E3-12`, `LA-E3-13`, `LA-E5-06`, `LA-E5-14`, `LA-E5-18`) — `0` errors
- **Vitest `K0` suites (13 merged tasks):** **13 / 13 test files passed (`38 / 38` tests passed)** in ~96.5s total:

| Task ID | `K0` Test File | Tests Passed | Duration |Result |
| :--- | :--- | :---: | :---: | :---: |
| `LA-E1-05` | `LA-E1-05/profiles.k0.test.ts` | `2 / 2` | `4.60s` | **PASS** |
| `LA-E1-10` | `LA-E1-10/providers-and-texts.k0.test.ts` | `1 / 1` | `7.02s` | **PASS** |
| `LA-E3-01` | `LA-E3-01/platform-storage-login.k0.test.ts` | `5 / 5` | `5.32s` | **PASS** |
| `LA-E3-02` | `LA-E3-02/platform-storage-check.k0.test.ts` | `5 / 5` | `12.24s` | **PASS** |
| `LA-E3-03` | `LA-E3-03/launch-without-context.k0.test.ts` | `3 / 3` | `9.83s` | **PASS** |
| `LA-E3-04` | `LA-E3-04/deep-linking.k0.test.ts` | `1 / 1` | `7.55s` | **PASS** |
| `LA-E3-06` | `LA-E3-06/nrps-scopes.k0.test.ts` | `3 / 3` | `7.94s` | **PASS** |
| `LA-E3-11` | `LA-E3-11/ags-extras.k0.test.ts` | `3 / 3` | `6.78s` | **PASS** |
| `LA-E3-12` | `LA-E3-12/small-spec-gaps.k0.test.ts` | `3 / 3` | `8.82s` | **PASS** |
| `LA-E3-13` | `LA-E3-13/deep-linking-per-type.k0.test.ts` | `3 / 3` | `4.48s` | **PASS** |
| `LA-E5-06` | `LA-E5-06/protocol-wiring.k0.test.ts` | `5 / 5` | `7.88s` | **PASS** |
| `LA-E5-14` | `LA-E5-14/throttling.k0.test.ts` | `1 / 1` | `6.86s` | **PASS** |
| `LA-E5-18` | `LA-E5-18/protocol-tenant-logs.k0.test.ts` | `3 / 3` | `4.12s` | **PASS** |

---

## 5. Exact SIM Window Commands (`docs/architecture/ltiaas/tasks/README.md` §2 Forms)

### 5.0 Scratch Clone & Pre-Window Docker Snapshot (`umask 077`)

```bash
umask 077
export TARGET_SHA="<integration-sha>"
export RUN_ROOT="/Users/quangnguyen/cogniate-qa-runs/LA/sim-window-${TARGET_SHA}"
export CLONE="$RUN_ROOT/clone"
export LOGS="$RUN_ROOT/logs"
export LA_QA="/Users/quangnguyen/orca/workspaces/cogniate_moodle_integration_prototype/la-qa"

mkdir -p "$LOGS"

# Clone detached at TARGET_SHA without hardlinks; disable push
git clone --no-hardlinks --no-checkout "$LA_QA" "$CLONE"
git -C "$CLONE" remote set-url --push origin DISABLED
git -C "$CLONE" checkout --detach "$TARGET_SHA"

# Overlay QA-4 test files from la-qa into the scratch clone for execution
rsync -a "$LA_QA/tests/ltiaas/tasks-lti/" "$CLONE/tests/ltiaas/tasks-lti/"

# Install dependencies and generate local certs/secrets
cd "$CLONE"
npm ci
npm --prefix tests ci
npm run certs:generate
npm run secrets:generate

# Record pre-window Docker state (tasks README §2)
docker ps -a      > "$LOGS/docker-ps-before.txt"
docker network ls > "$LOGS/docker-net-before.txt"
docker volume ls  > "$LOGS/docker-vol-before.txt"
```

---

### 5.1 Batch 1 (`qa4-la-sim-r1` — 9 Suites on Standard `acceptance` Stack, ~26 min)

Covers: `LA-E1-10`, `LA-E3-01`, `LA-E3-02`, `LA-E3-04`, `LA-E3-13`, `LA-E3-06`, `LA-E3-11`, `LA-E3-12`, `LA-E5-18`.

```bash
umask 077
cd "$CLONE"
export COMPOSE_PROJECT_NAME=qa4-la-sim-r1
export PUBLIC_PORT=9463
export STACK_SUBNET=172.22.0.0/16

# 1. Boot the acceptance SIM stack once for Batch 1
npm run stack:acceptance:up 2>&1 | tee "$LOGS/r1-stack-up.log"

# 2. LA-E1-10 (AC-LA-E1-10-02 + live LA_SIM_STACK=1 checks for AC-LA-E1-10-01 & AC-LA-E1-10-04)
docker compose -p "$COMPOSE_PROJECT_NAME" --profile acceptance --profile test run --rm \
  -e QA_TASK=LA-E1-10 -e LA_LEVEL=k1sim -e LA_SIM_STACK=1 \
  e2e npm --prefix tests run acceptance:api 2>&1 | tee "$LOGS/r1-LA-E1-10.log"

# 3. LA-E3-01 (AC-LA-E3-01-10)
QA_TASK=LA-E3-01 npm run stack:test 2>&1 | tee "$LOGS/r1-LA-E3-01.log"

# 4. LA-E3-02 (AC-LA-E3-02-01, 02, 03, 05, 06, 07, 10, 11, 12)
QA_TASK=LA-E3-02 npm run stack:test 2>&1 | tee "$LOGS/r1-LA-E3-02.log"

# 5. LA-E3-04 (AC-LA-E3-04-01, 02, 04, 05 + 03, 06, 07 on SIM)
QA_TASK=LA-E3-04 npm run stack:test 2>&1 | tee "$LOGS/r1-LA-E3-04.log"

# 6. LA-E3-13 (AC-LA-E3-13-01 .. AC-LA-E3-13-04)
QA_TASK=LA-E3-13 npm run stack:test 2>&1 | tee "$LOGS/r1-LA-E3-13.log"

# 7. LA-E3-06 (AC-LA-E3-06-01, 02, 03, 05, 06 + 04 on SIM)
QA_TASK=LA-E3-06 npm run stack:test 2>&1 | tee "$LOGS/r1-LA-E3-06.log"

# 8. LA-E3-11 (AC-LA-E3-11-01, 02, 04 + 03, 05 on SIM)
QA_TASK=LA-E3-11 npm run stack:test 2>&1 | tee "$LOGS/r1-LA-E3-11.log"

# 9. LA-E3-12 (AC-LA-E3-12-01, 02, 03 + 04, 05 on SIM)
QA_TASK=LA-E3-12 npm run stack:test 2>&1 | tee "$LOGS/r1-LA-E3-12.log"

# 10. LA-E5-18 (AC-LA-E5-18-01 .. AC-LA-E5-18-05) + lti-service structured log capture
QA_TASK=LA-E5-18 npm run stack:test 2>&1 | tee "$LOGS/r1-LA-E5-18.log"
docker compose -p "$COMPOSE_PROJECT_NAME" logs --no-color lti-service > "$LOGS/r1-lti-service.log"

# 11. Teardown Batch 1
npm run stack:acceptance:down 2>&1 | tee "$LOGS/r1-stack-down.log"
```

---

### 5.2 Batch 2 (`qa4-la-sim-r2` — 2 Suites on App + Simulator Fault-Injection Stack, ~10 min)

Covers: `LA-E3-03` (`launch-without-context.k1sim.test.ts`), `LA-E5-14` (`throttling.k1sim.test.ts`).

```bash
umask 077
cd "$CLONE"
export COMPOSE_PROJECT_NAME=qa4-la-sim-r2
export PUBLIC_PORT=9463
export STACK_SUBNET=172.22.0.0/16

# 1. Boot the acceptance SIM stack for Batch 2
npm run stack:acceptance:up 2>&1 | tee "$LOGS/r2-stack-up.log"

# 2. LA-E3-03 (AC-LA-E3-03-01 .. AC-LA-E3-03-06)
QA_TASK=LA-E3-03 npm run stack:test 2>&1 | tee "$LOGS/r2-LA-E3-03.log"

# 3. LA-E5-14 (AC-LA-E5-14-01 .. AC-LA-E5-14-05) + lti-service platform_rate_limited log capture
QA_TASK=LA-E5-14 npm run stack:test 2>&1 | tee "$LOGS/r2-LA-E5-14.log"
docker compose -p "$COMPOSE_PROJECT_NAME" logs --no-color lti-service > "$LOGS/r2-lti-service.log"

# 4. Teardown Batch 2
npm run stack:acceptance:down 2>&1 | tee "$LOGS/r2-stack-down.log"
```

---

### 5.3 Batch 3 (`qa4-la-sim-r3` — 1 Suite Mutating Operator Account Status & Session Caps, ~8 min)

Covers: `LA-E5-06` (`protocol-wiring.k1sim.test.ts`: `AC-LA-E5-06-01` .. `AC-LA-E5-06-07`, `AC-LA-E5-06-10`).

```bash
umask 077
cd "$CLONE"
export COMPOSE_PROJECT_NAME=qa4-la-sim-r3
export PUBLIC_PORT=9463
export STACK_SUBNET=172.22.0.0/16

# 1. Boot the acceptance SIM stack for Batch 3
npm run stack:acceptance:up 2>&1 | tee "$LOGS/r3-stack-up.log"

# 2. LA-E5-06 (AC-LA-E5-06-01 .. AC-LA-E5-06-07, AC-LA-E5-06-10)
QA_TASK=LA-E5-06 npm run stack:test 2>&1 | tee "$LOGS/r3-LA-E5-06.log"

# 3. Teardown Batch 3
npm run stack:acceptance:down 2>&1 | tee "$LOGS/r3-stack-down.log"
```

---

### 5.4 Batch 4 (`qa4-la-sim-r4` — 1 Suite Recreating `lti-service` Without `PUBLIC_MOODLE_URL`, ~8 min)

Covers: `LA-E1-05` (`profiles.k1sim.test.ts`: `AC-LA-E1-05-07` & `AC-LA-E1-05-08`).
Note: `profiles.k1sim.test.ts` runs from the host against `https://lti.cogniate.test:9463` and `https://app.cogniate.test:9463` because `AC-LA-E1-05-07` writes `.tmp/compose.knobs.yaml` (`PUBLIC_MOODLE_URL: null`) and runs `docker compose ... up -d --no-deps --force-recreate lti-service` mid-test.

```bash
umask 077
cd "$CLONE"
export COMPOSE_PROJECT_NAME=qa4-la-sim-r4
export PUBLIC_PORT=9463
export STACK_SUBNET=172.22.0.0/16

# 1. Boot the acceptance SIM stack for Batch 4
npm run stack:acceptance:up 2>&1 | tee "$LOGS/r4-stack-up.log"

# 2. LA-E1-05 (AC-LA-E1-05-07 & AC-LA-E1-05-08)
LA_LEVEL=k1sim QA_TASK=LA-E1-05 QA_REPO_ROOT="$CLONE" LA_RUN_DIR="$LOGS/r4-artifacts" \
  npm --prefix "$CLONE/tests" run acceptance:api 2>&1 | tee "$LOGS/r4-LA-E1-05.log"

# 3. Teardown Batch 4
rm -f "$CLONE/.tmp/compose.knobs.yaml"
npm run stack:acceptance:down 2>&1 | tee "$LOGS/r4-stack-down.log"
```

---

## 6. Owned-Only Cleanup & Post-Window Docker Verification

Never run `docker system prune`, `docker volume prune`, or `docker network prune`. Clean up **only** resources labeled with `com.docker.compose.project=qa4-la-sim-r<n>` (`n` in `1..4`) and verify that `docker-ps-after.txt`, `docker-net-after.txt`, and `docker-vol-after.txt` contain zero `qa4-la-sim-r*` resources and match the pre-window baseline.

```bash
umask 077
for p in qa4-la-sim-r1 qa4-la-sim-r2 qa4-la-sim-r3 qa4-la-sim-r4; do
  cids="$(docker ps -aq --filter "label=com.docker.compose.project=${p}")"
  if [ -n "$cids" ]; then docker rm -f $cids; fi

  nids="$(docker network ls -q --filter "label=com.docker.compose.project=${p}")"
  if [ -n "$nids" ]; then docker network rm $nids; fi

  vids="$(docker volume ls -q --filter "label=com.docker.compose.project=${p}")"
  if [ -n "$vids" ]; then docker volume rm $vids; fi
done

# Restore scratch clone working tree and record post-window git + Docker state
git -C "$CLONE" checkout -- tests/ltiaas/tasks-lti
git -C "$CLONE" status --porcelain > "$LOGS/status-after.txt"

docker ps -a      > "$LOGS/docker-ps-after.txt"
docker network ls > "$LOGS/docker-net-after.txt"
docker volume ls  > "$LOGS/docker-vol-after.txt"

diff -u "$LOGS/docker-ps-before.txt"  "$LOGS/docker-ps-after.txt"  || true
diff -u "$LOGS/docker-net-before.txt" "$LOGS/docker-net-after.txt" || true
diff -u "$LOGS/docker-vol-before.txt" "$LOGS/docker-vol-after.txt" || true
```
