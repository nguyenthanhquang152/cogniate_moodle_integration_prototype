# LTIAAS Wave-End Gate Run Plan (Host-Only Prepared Runbook)

- **Owner:** Lead QA (`task_7aeec40d57a9`, updated in `task_89732ab04e97` / `ctx_199692428d8b`)
- **Preparation Mode:** Host-only (`0` Docker containers, `0` volumes, `0` networks started during preparation)
- **Wave-End Candidate SHA:** `43d5073cd57c879c33aa97151848bf8d6890844b` (`43d5073c`, product code `5260eac5`; Lead check green: `3302` unit, `255` infra, `145` K0, F1 `0`, F5 `6` rules; `LD-9` round 8 approved by both Reviewer-A and Reviewer-B in `fd146062`)
- **Intake / `G-BASE` SHA:** `1b17261be97c4701b928fa9dc2fa74c6d23028f6` (`1b17261b`, product code `9f8ac62`)
- **Pre-Staged Host-Only Gate Assets (`/Users/quangnguyen/cogniate-qa-runs/LA/GATE`, mode `0700`):**
  - **Wave-End Test Source Repo (Slots 3B & 8):** `/Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end`
    - Product commit: `43d5073cd57c879c33aa97151848bf8d6890844b`
    - Committed test SHA (`--test-sha`): `625e923d458c0b59c13c3f6061624b7a512f7ab4`
    - Contains: `la-qa/tests` at `e664adb3` (including the 8 `LD-1` open-world files from `f0a7b306`), the 3 approved `LA-IC-04` frozen-test updates (`31-canvas-grants.test.ts:114-120`, `00-profiles.test.ts:104`, `T4b1/1-connect.spec.ts:118`), the 3 approved `LA-IC-14` frozen-test updates (`11-canvas-platforms.test.ts:218-265`), the `LA-IC-09` (`LD-6`) P5 fixture update (`storage-fixture-script.mjs:389-396` supporting `record_dispatch`), the open-world migration-ledger check in `m1-migration.mjs:331-338`, and the `qalead-la-<n>` project-prefix regex guard in `tests/host/{core,m1-control,storage-docker,storage-handoff,run-t1,run-t5,p5-fixture,host-control}.mjs` and `tests/e2e/host/run-t7.mjs`.
    - Verified host-only: `run-m2.mjs --harness-only` PASS (`64` M2 cases, typecheck exit `0`), `M1` Vitest discovery PASS (`392` API cases + `2` browser cases = `394` `sim` rows), `m1-migration.selftest.mjs` + `storage-fixture-script.selftest.mjs` PASS (`25/25`), `golden.k0.test.mjs` PASS (`12/12`).
  - **Slot 7 Test Source Repo (`LA-E0-02` + `LA-E0-04` `LD-1` parity on `1b17261`):** `/Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-slot7-1b17261`
    - Product commit: `1b17261be97c4701b928fa9dc2fa74c6d23028f6`
    - Committed test SHA (`--test-sha`): `357d17997b4d36dbfb6bde7568a4d87c0e3a14fc`
    - Contains: `1b17261`'s `tests/` tree plus **only** the 8 `LD-1` open-world files from `f0a7b306` (`B-LD9-13`) and the `qalead-la-<n>` project-prefix regex guard, preserving `1b17261`'s pre-`LA-IC-04`/`LA-IC-14`/`LA-IC-09` assertions.
    - Verified host-only: `run-m2.mjs --harness-only` PASS (`64` M2 cases, typecheck exit `0`), `M1` Vitest discovery PASS (`392` API cases + `2` browser cases = `394` `sim` rows).
  - **Course Fixtures (`COURSE_FIXTURES_DIR`):** `/Users/quangnguyen/cogniate-qa-runs/LA/GATE/course-fixtures` (mode `0700`, verified SHA-256 for both `Build Your First Website with AI_ The Zero-to-Hero Micro-Sprint-scorm-v2.zip` and `-html.zip`).
- **Execution Rule:** Do **not** run any Docker command below until the Lead sends an orchestration message starting with `DOCKER-YES:` naming the agent, the lane, the compose project name, the port, the subnet, and the start and end times.

---

## 1. Completed vs Remaining Gate Slots

| Slot | Owner | Scope | Compose Projects | Port / Subnet | Est. Minutes | Status |
| --- | --- | --- | --- | --- | --- | --- |
| **Slots 1, 1b, 1c** | QA-2 | `E5` SIM + Moodle `R2` regression (`LA-E5-01..23`) | `qa2-la-*` | `9443` / `172.20.0.0/16` | — | **DONE** (`5fdc9bd8`) |
| **Slot 2** | Lead QA | `LA-E0-03` Round 2 (`G-BASE` `1b17261` golden capture `G1–G4` + `U1` seed + `U2` backup) | `qalead-la-1..2` | `9643` / `172.22.0.0/16` | — | **DONE** (`b68bf4ef`) |
| **Slot 3A** | Lead QA | Candidate golden capture `G1–G4` & `LD-9` records (`LA-IC-01..21` approved in Round 8) | `qalead-la-3` | `9643` / `172.22.0.0/16` | — | **DONE** (`fd146062`) |
| **Slots 4, 4b** | QA-3 | `E1/E2/E3/E4/E6` SIM tasks (`31/31` PASS) | `qa3-la-*` | `9443` / `172.20.0.0/16` | — | **DONE** (`cd347224`) |
| **Slot 5** | QA-4 | `E1/E2/E3/E5/E7` LTI & sim tasks (`15` suites PASS) | `qa4-la-*` | `9443` / `172.20.0.0/16` | — | **DONE** (`a11268c5`) |
| **Slot 6 R1** | QA-E2E | `LA-E7-09` (`R2-SIM` PASS) + `LA-E7-07` (`K2` R1; `BD-A1-111/112` fixed in `5260eac5`) | `qa-e2e-la-*` | `9643` / `172.22.0.0/16` | — | **R2 IN PROGRESS** |
| **LA-E5-13 SIM** | Lead QA | `LA-E5-13` `AC-01, -02, -03, -05` `K1-SIM` + `AC-06` `K0` on `fd146062` | `qalead-la-8..9` | `9443` / `172.20.0.0/16` | — | **DONE** (`43d5073c`) |
| **Slot 3B** | Lead QA | Wave-end SIM gate (`LA-E7-08`) on `43d5073c` (code `5260eac5`): Golden `G1–G4` capture & compare (all 13 `LD-9` records), `M1 migration` + `snapshot-upgrade`, `U1` SIM continuity from `1b17261`, `M1 sim --provider all` (`394` rows), `M2` (`64` cases) | `qalead-la-10..15` | `9643` / `172.22.0.0/16` (or `9443` / `172.20.0.0/16`) | **`52 min`** | **READY** |
| **Slot 7** | Lead QA | Intake `1b17261` (`G-BASE`): `LA-E0-02` baseline + `LA-E0-04` `LD-1` parity with `f0a7b306` `--test-sha` (`M1 sim/migration/snapshot-upgrade`, `M2`, `T7×3`, optional legacy `T1–T8`, `rate-peaks.mjs`, `docker stats` peak) | `qalead-la-16..20` (`qalead-la-21..27` optional legacy) | `9643` / `172.22.0.0/16` (SIM) & `9543` / `172.21.0.0/16` (Moodle) | **`80 min` core** (`42m` SIM + `38m` `T7×3`; `+55m` if legacy `T1–T8` run) | **READY** |
| **Slot 8** | Lead QA + QA-E2E | Wave-end `MOODLE-LIVE` gate on `43d5073c` (code `5260eac5`): `T7×1` + `R2-lite` (`T2a..T8`) + 6 frozen isolation ACs (`AC-T2-18`, `AC-T4-16`, `AC-T4-29`, `AC-T4-34`, `AC-T7-08`, `AC-T7-09`) + `AC-LA-E5-13-06` + QA-E2E `K2` `U1`/`U2` | `qalead-la-30..39` | `9543` / `172.21.0.0/16` | **`55 min` Lead QA** (`+20 min` QA-E2E = **`75 min`**) | **READY** |

> [!IMPORTANT]
> **Never reuse compose project numbers.** `qalead-la-1..3` (Slots 2 & 3A) and `qalead-la-8..9` (`LA-E5-13` SIM) have already been used. Slots 3B, 7, and 8 exclusively use **`qalead-la-10..39`**.

---

## 2. Expected-Delta Set for Wave-End Gate (`LA-E7-08` `AC-03` & `AC-01`)

All **13 approved `LD-9` records** (`fd146062`, Round 8 APPROVE by both Reviewer-A and Reviewer-B) are committed in `tests/ltiaas/golden/expected/*.json` and passed to the golden comparator:

```text
LA-IC-01,LA-IC-03,LA-IC-04,LA-IC-12,LA-IC-13,LA-IC-14,LA-IC-15,LA-IC-16,LA-IC-17,LA-IC-18,LA-IC-19,LA-IC-20,LA-IC-21
```

| Record ID | Golden Path Deltas (`G1–G4` vs `G-BASE` `1b17261`) | Frozen Test Deltas (`1b17261..625e923d`) | Notes on Wave-End SHA (`43d5073c` / code `5260eac5`) |
| --- | --- | --- | --- |
| **`LA-IC-01`** | **`259` exact-value paths** (`G1`, `G3`; `0` wildcards) | **`0` after `LD-1`** (`LA-E0-04` 8 files in `f0a7b306`) | Includes `lti-generic` `channelName: "LMS"` (`BD-A1-111`), `canvas` & `lti-generic` `setup.connectionCheck: true` (`LA-E6-04`), and `brightspace` `methods: ["dynamic", "manual"]` (`LA-E2-06`). |
| **`LA-IC-03`** | `0` | `0` | Moodle DR path-prefix & `LtiDeepLinkingRequest` (`LA-E2-02`). |
| **`LA-IC-04`** | **`3` paths in `G1`** (`canvasConfiguration["jwk=inline"].scopes[4]` removed, `canvasConfiguration["jwk=url"].scopes[4]` removed, `toolConfiguration.moodle[12].value` = `"Do not use this service"`) | **`3` files**: `31-canvas-grants.test.ts:114-120`, `00-profiles.test.ts:104`, `T4b1/1-connect.spec.ts:118` | **Now active on `43d5073c`** (`LA-E3-07`, 4 AGS scopes, no NRPS scope). |
| **`LA-IC-12`** | **`2` paths in `G4`** (`blackboard.pages.picker.text`, `canvas.pages.picker.text` + `" Cancel"`) | `0` | Deep Linking Cancel button & empty `contentItems` (`LA-E3-04`, `LA-E3-05`). |
| **`LA-IC-13`** | `0` | `0` | Could gaps (`scoreGiven: null`, NRPS `service_versions`, `trustedAudiences`) (`LA-E3-12`). |
| **`LA-IC-14`** | **`13` paths across `G1` (`12`) and `G3` (`1`)** (`capabilities.dynamicRegistration: true` and `methods[1]: "dynamic"` on Canvas) | **`1` file (`3` cases)**: `11-canvas-platforms.test.ts:218-265` (`M1-15.canvas.dto`, `M1-15.canvas.dynamic-refused`, `M1-15.canvas.lms-providers`) | **Now active on `43d5073c`** (`LA-E3-09`, `LA-E3-15`). |
| **`LA-IC-15`** | **`2` paths in `G3`** (`{blackboard,canvas}.publications.B-conflict.results[0].scoreSyncs[0].lastError`) | `0` | Channel-named 409 conflict text (`LA-E4-03`). |
| **`LA-IC-16`** | **`1` path in `G1`** (`acceptance.ltiHealth.outbound_allowlist` via `sim-hosts-allowlist` rule) | `0` | `.sim.test` hosts equal `tests/sim/hosts.json` union (`15` hosts); non-sim entries equal `G-BASE` (`BD-A1-36`). |
| **`LA-IC-17`** | `0` | `0` | Strict 6-key Moodle `PUT /app-api/connections/:id/platform` (`BD-A1-41`). |
| **`LA-IC-18`** | `0` | `0` | Portal `PublishDialog` channel name & `IntegrationLogo` colour/title (`BD-A1-50`). |
| **`LA-IC-19`** | `0` | `0` | Content-host `410 RUNTIME_EXPIRED` channel name (`BD-A1-57`). |
| **`LA-IC-20`** | `0` | `0` | `ChannelErrorNotice` 5-code error text fallback (`BD-A1-63`, `BD-A1-81`). |
| **`LA-IC-21`** | `0` | `0` | DR update preserves existing `active` state (`BD-A1-93`). |
| **Total** | **`280` explained entries (`267` distinct golden paths)** | **8 `LD-1` files + 4 `LA-IC-04/14` files + 1 `LA-IC-09` P5 fixture** | **`0` unexplained differences, `0` missing expected changes** |

---

## 3. Slot 3B: Wave-End SIM-Lane Gate (`LA-E7-08`) on `43d5073c` (Code `5260eac5`)

- **Target SHA:** `43d5073cd57c879c33aa97151848bf8d6890844b` (product code `5260eac5`)
- **Pre-Staged Source Repo:** `/Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end` (`--test-sha 625e923d458c0b59c13c3f6061624b7a512f7ab4`)
- **Compose Projects:** `qalead-la-10`, `qalead-la-11`, `qalead-la-12`, `qalead-la-13`, `qalead-la-14`, `qalead-la-15`
- **Port / Subnet:** `PUBLIC_PORT=9643`, `STACK_SUBNET=172.22.0.0/16` (or `9443` / `172.20.0.0/16` per `DOCKER-YES`)
- **Estimated Duration:** **`52 minutes` total**
  - Step 3B.1 (`qalead-la-10`): Candidate golden capture `G1–G4` + host compare with all 13 `LD-9` records — **`4 min`**
  - Step 3B.2 (`qalead-la-11` & `qalead-la-12`): `M1 --phase migration` (`35` rows) + `M1 --phase snapshot-upgrade` (`7` rows) — **`12 min`**
  - Step 3B.3 (`qalead-la-13` & `qalead-la-13b`): `U1` SIM upgrade continuity from `1b17261` to `43d5073c` (`LA-E5-08` LTI + `LA-E5-22` app) — **`6 min`**
  - Step 3B.4 (`qalead-la-14`): `M1 --phase sim --provider all` (`394` rows) — **`15 min`**
  - Step 3B.5 (`qalead-la-15`): `M2` browser suite (`64` cases) — **`15 min`**

### Exact Commands for Slot 3B

```bash
umask 077
export GATE_DIR="/Users/quangnguyen/cogniate-qa-runs/LA/GATE"
export SRC_WAVE="$GATE_DIR/src-wave-end"
export COURSE_FIXTURES_DIR="$GATE_DIR/course-fixtures"
export WAVE_SHA="43d5073cd57c879c33aa97151848bf8d6890844b"
export WAVE_TEST_SHA="625e923d458c0b59c13c3f6061624b7a512f7ab4"
export INTAKE_SHA="1b17261be97c4701b928fa9dc2fa74c6d23028f6"
export PUBLIC_PORT=9643
export STACK_SUBNET="172.22.0.0/16"

# ----------------------------------------------------------------------
# Step 3B.0: Pre-run Docker hygiene check (<1 min)
# ----------------------------------------------------------------------
docker ps --format '{{.Names}}\t{{.Status}}\t{{.Ports}}'
docker network ls --format '{{.Name}}' | xargs -n1 docker network inspect --format '{{.Name}}: {{range .IPAM.Config}}{{.Subnet}}{{end}}' 2>/dev/null
docker system df

# ----------------------------------------------------------------------
# Step 3B.1 (qalead-la-10, est. 4 min): Candidate Golden Capture G1-G4 + Compare (AC-LA-E7-08-03)
# ----------------------------------------------------------------------
COMPOSE_PROJECT_NAME=qalead-la-10 PUBLIC_PORT=$PUBLIC_PORT STACK_SUBNET=$STACK_SUBNET \
  node "$SRC_WAVE/tests/ltiaas/golden/run-golden.mjs" \
  --sha "$WAVE_SHA" \
  --source "$SRC_WAVE" \
  --workdir "$GATE_DIR/qalead-la-10-golden" \
  --replace-tests --tests-from "$SRC_WAVE/tests" \
  --out "$GATE_DIR/golden-capture-$WAVE_SHA" \
  > "$GATE_DIR/logs/slot3b-1-golden-capture.log" 2>&1

# Host-only compare with ALL 13 approved LD-9 records (<5 s, 0 Docker):
node "$SRC_WAVE/tests/ltiaas/golden/compare-golden.mjs" \
  --base "$SRC_WAVE/tests/ltiaas/golden/$INTAKE_SHA" \
  --candidate "$GATE_DIR/golden-capture-$WAVE_SHA" \
  --expected "LA-IC-01,LA-IC-03,LA-IC-04,LA-IC-12,LA-IC-13,LA-IC-14,LA-IC-15,LA-IC-16,LA-IC-17,LA-IC-18,LA-IC-19,LA-IC-20,LA-IC-21" \
  --expected-dir "$SRC_WAVE/tests/ltiaas/golden/expected" \
  --json > "$GATE_DIR/logs/slot3b-1-golden-compare.json"

# ----------------------------------------------------------------------
# Step 3B.2 (qalead-la-11 & qalead-la-12, est. 12 min): M1 migration + snapshot-upgrade (AC-LA-E7-08-04)
# ----------------------------------------------------------------------
COMPOSE_PROJECT_NAME=qalead-la-11 PUBLIC_PORT=$PUBLIC_PORT STACK_SUBNET=$STACK_SUBNET \
  COURSE_FIXTURES_DIR="$COURSE_FIXTURES_DIR" \
  node "$SRC_WAVE/tests/host/run-m1.mjs" \
  --phase migration \
  --provider all \
  --sha "$WAVE_SHA" \
  --test-sha "$WAVE_TEST_SHA" \
  --source "$SRC_WAVE" \
  > "$GATE_DIR/logs/slot3b-2a-m1-migration.log" 2>&1

COMPOSE_PROJECT_NAME=qalead-la-12 PUBLIC_PORT=$PUBLIC_PORT STACK_SUBNET=$STACK_SUBNET \
  node "$SRC_WAVE/tests/host/run-m1.mjs" \
  --phase snapshot-upgrade \
  --provider all \
  --sha "$WAVE_SHA" \
  --test-sha "$WAVE_TEST_SHA" \
  --source "$SRC_WAVE" \
  > "$GATE_DIR/logs/slot3b-2b-m1-snapshot-upgrade.log" 2>&1

# ----------------------------------------------------------------------
# Step 3B.3 (qalead-la-13 & qalead-la-13b, est. 6 min): U1 SIM Upgrade Continuity 1b17261 -> 43d5073c (AC-LA-E7-08-04)
# ----------------------------------------------------------------------
# 3B.3a: LTI service U1 continuity (connections, deployments, resource links, pending DR session, tool keys, service keys)
COMPOSE_PROJECT_NAME=qalead-la-13 PUBLIC_PORT=$PUBLIC_PORT STACK_SUBNET=$STACK_SUBNET \
  node "$SRC_WAVE/tests/ltiaas/tasks-ops/LA-E5-08/run.mjs" \
  --sha "$WAVE_SHA" \
  --old-sha "$INTAKE_SHA" \
  --source "$SRC_WAVE" \
  --workdir "$GATE_DIR/qalead-la-13-u1-lti" \
  > "$GATE_DIR/logs/slot3b-3a-u1-lti.log" 2>&1

# 3B.3b: App U1 continuity (connections, deployments, resource links, picker sessions, Deep Linking pick, launch, score dispatch)
COMPOSE_PROJECT_NAME=qalead-la-13b PUBLIC_PORT=$PUBLIC_PORT STACK_SUBNET=$STACK_SUBNET \
  node "$SRC_WAVE/tests/ltiaas/tasks-ops/LA-E5-22/run.mjs" \
  --sha "$WAVE_SHA" \
  --old-sha "$INTAKE_SHA" \
  --source "$SRC_WAVE" \
  --workdir "$GATE_DIR/qalead-la-13b-u1-app" \
  > "$GATE_DIR/logs/slot3b-3b-u1-app.log" 2>&1

# ----------------------------------------------------------------------
# Step 3B.4 (qalead-la-14, est. 15 min): M1 --phase sim --provider all (394 rows, AC-LA-E7-08-01)
# ----------------------------------------------------------------------
COMPOSE_PROJECT_NAME=qalead-la-14 PUBLIC_PORT=$PUBLIC_PORT STACK_SUBNET=$STACK_SUBNET \
  node "$SRC_WAVE/tests/host/run-m1.mjs" \
  --phase sim \
  --provider all \
  --sha "$WAVE_SHA" \
  --test-sha "$WAVE_TEST_SHA" \
  --source "$SRC_WAVE" \
  > "$GATE_DIR/logs/slot3b-4-m1-sim.log" 2>&1

# ----------------------------------------------------------------------
# Step 3B.5 (qalead-la-15, est. 15 min): M2 Browser Suite (64 cases, AC-LA-E7-08-01)
# ----------------------------------------------------------------------
COMPOSE_PROJECT_NAME=qalead-la-15 PUBLIC_PORT=$PUBLIC_PORT STACK_SUBNET=$STACK_SUBNET \
  COURSE_FIXTURES_DIR="$COURSE_FIXTURES_DIR" \
  node "$SRC_WAVE/tests/e2e/host/run-m2.mjs" \
  --sha "$WAVE_SHA" \
  --test-sha "$WAVE_TEST_SHA" \
  --source "$SRC_WAVE" \
  > "$GATE_DIR/logs/slot3b-5-m2.log" 2>&1

# ----------------------------------------------------------------------
# Step 3B.6: Post-slot teardown verification (<1 min)
# ----------------------------------------------------------------------
docker ps -a --filter "name=qalead-la-"
docker volume ls --filter "name=qalead-la-"
docker network ls --filter "name=qalead-la-"
```

### Host-Only `K0` Verification Already Proven for `LA-E7-08` (`AC-LA-E7-08-05` & `AC-LA-E7-08-06`)

- **`AC-LA-E7-08-05` (`PASS`, `K0`):**
  - `git -C "$SRC_WAVE" diff --stat 1b17261be97c4701b928fa9dc2fa74c6d23028f6..625e923d458c0b59c13c3f6061624b7a512f7ab4 -- tests/acceptance tests/e2e tests/host tests/sim tests/fixtures` shows `47` files:
    1. **8 `LD-1` open-world files** (`LA-E0-04`, `f0a7b306`): `tests/acceptance/lib/open-world.{mjs,d.mts}`, `00-profiles.test.ts:1-29`, `90-simulation-gates.test.ts:19`, `11-canvas-platforms.test.ts:255`, `tests/host/run-m1.mjs:297,302`, `tests/e2e/host/run-m2.mjs:124`, `tests/e2e/M2/01-cards.m2.ts:11-21`.
    2. **3 `LA-IC-04` frozen test files** (`LA-E3-07`, approved in `fd146062`): `tests/acceptance/M1/canvas/31-canvas-grants.test.ts:114-120`, `tests/acceptance/M1/common/00-profiles.test.ts:104`, `tests/acceptance/T4b1/1-connect.spec.ts:118`.
    3. **1 `LA-IC-14` frozen test file** (`LA-E3-09`/`LA-E3-15`, approved in `fd146062`): `tests/acceptance/M1/canvas/11-canvas-platforms.test.ts:218-265`.
    4. **1 `LA-IC-09` (`LD-6`) P5 fixture file** (`LA-E4-03` / migration `014`): `tests/host/storage-fixture-script.mjs:389-396`.
    5. **Runner-only changes (`0` frozen assertion changes):** `tests/acceptance/run-api.mjs` (LA task Vitest config routing), `tests/host/m1-migration.mjs:331-338` (open-world candidate migration ledger check in `snapshotMigrationRun`), and `tests/host/{core,m1-control,storage-docker,storage-handoff,run-t1,run-t5,p5-fixture,host-control}.mjs` + `tests/e2e/host/run-t7.mjs` (`qalead-la-<n>` project prefix regex).
    6. **13 additive `K2` browser suite files:** `tests/e2e/ltiaas/**` (`LA-E7-07`, `LA-E7-09`).
    7. **13 additive simulator files:** `tests/sim/**` (`LA-E7-01`, `LA-E7-02`, `LA-E7-05`).
- **`AC-LA-E7-08-06` (`PASS`, `K0`):**
  - `git -C "$SRC_WAVE" diff --stat 1b17261be97c4701b928fa9dc2fa74c6d23028f6..43d5073cd57c879c33aa97151848bf8d6890844b -- infra/scripts/stack-data.sh infra/scripts/stack-data.mjs infra/scripts/storage-compat.sh infra/compat/` produces **empty output (`0` files changed, exit `0`)**.

---

## 4. Slot 7: Intake `1b17261` (`G-BASE`) Baseline (`LA-E0-02`) + `LD-1` Parity (`LA-E0-04`)

- **Target SHA:** `1b17261be97c4701b928fa9dc2fa74c6d23028f6` (`G-BASE`)
- **Pre-Staged Source Repo:** `/Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-slot7-1b17261` (`--test-sha 357d17997b4d36dbfb6bde7568a4d87c0e3a14fc`)
  - Holds `1b17261` + **only** the 8 `LD-1` open-world files (`f0a7b306`, `B-LD9-13`) and the `qalead-la-<n>` runner prefix guard.
  - Because `1b17261` has only the 3 baseline channels (`moodle`, `canvas`, `blackboard`) and 8 baseline profiles, a single run with `src-slot7-1b17261` (`--test-sha 357d17997b4d36dbfb6bde7568a4d87c0e3a14fc` / `--replace-tests --tests-from "$SRC_SLOT7/tests"`) simultaneously records the `LA-E0-02` baseline (`AC-LA-E0-02-01..06`) **and** proves `LA-E0-04` `LD-1` open-world parity on `G-BASE`.
- **Compose Projects:**
  - **Run 7A (SIM lane, `PUBLIC_PORT=9643`, `STACK_SUBNET=172.22.0.0/16`):** `qalead-la-16`, `qalead-la-17`, `qalead-la-18`, `qalead-la-19`
  - **Run 7B (Moodle 5.2 lane, `PUBLIC_PORT=9543`, `STACK_SUBNET=172.21.0.0/16`):** `qalead-la-20` (`T7×3` core) + `qalead-la-21..27` (legacy `T1–T8` groups if scheduled)
- **Estimated Duration:**
  - **Run 7A (SIM lane):** **`42 minutes`** (`M1 sim` `15 min` + `M2` `15 min` + `M1 migration` & `snapshot-upgrade` `12 min`)
  - **Run 7B (Moodle 5.2 lane):** **`38 minutes` core (`T7×3`)** (or **`93 minutes`** if all 7 legacy Moodle runners `run-t1..run-t8` are also run in the same window)
  - **Combined Slot 7 Total:** **`80 minutes` core** (`42 min` SIM + `38 min` Moodle `T7×3`, or **`42 min` wall-clock** if Run 7A and Run 7B run in parallel across the SIM and Moodle lanes) / **`135 minutes` sequential with full legacy `T1–T8`**.

### Exact Commands for Slot 7 — Run 7A (SIM Lane on `1b17261`, Est. `42 min`)

```bash
umask 077
export GATE_DIR="/Users/quangnguyen/cogniate-qa-runs/LA/GATE"
export SRC_SLOT7="$GATE_DIR/src-slot7-1b17261"
export COURSE_FIXTURES_DIR="$GATE_DIR/course-fixtures"
export INTAKE_SHA="1b17261be97c4701b928fa9dc2fa74c6d23028f6"
export SLOT7_TEST_SHA="357d17997b4d36dbfb6bde7568a4d87c0e3a14fc"
export PUBLIC_PORT=9643
export STACK_SUBNET="172.22.0.0/16"

# 1. Start background docker stats peak memory sampler (AC-LA-E0-02-05):
(
  while [ ! -f "$GATE_DIR/logs/stop-slot7a-stats" ]; do
    ts=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    docker stats --no-stream --format "{\"ts\":\"$ts\",\"name\":\"{{.Name}}\",\"mem\":\"{{.MemUsage}}\",\"cpu\":\"{{.CPUPerc}}\"}" \
      >> "$GATE_DIR/logs/slot7a-docker-stats.jsonl" 2>/dev/null || true
    sleep 5
  done
) &
STATS_7A_PID=$!

# 2. M1 --phase sim --provider all (394 rows, qalead-la-16, est. 15 min):
COMPOSE_PROJECT_NAME=qalead-la-16 PUBLIC_PORT=$PUBLIC_PORT STACK_SUBNET=$STACK_SUBNET \
  node "$SRC_SLOT7/tests/host/run-m1.mjs" \
  --phase sim \
  --provider all \
  --sha "$INTAKE_SHA" \
  --test-sha "$SLOT7_TEST_SHA" \
  --source "$SRC_SLOT7" \
  > "$GATE_DIR/logs/slot7a-1-m1-sim.log" 2>&1

# 3. M2 browser suite (64 cases, qalead-la-17, est. 15 min):
COMPOSE_PROJECT_NAME=qalead-la-17 PUBLIC_PORT=$PUBLIC_PORT STACK_SUBNET=$STACK_SUBNET \
  COURSE_FIXTURES_DIR="$COURSE_FIXTURES_DIR" \
  node "$SRC_SLOT7/tests/e2e/host/run-m2.mjs" \
  --sha "$INTAKE_SHA" \
  --test-sha "$SLOT7_TEST_SHA" \
  --source "$SRC_SLOT7" \
  > "$GATE_DIR/logs/slot7a-2-m2.log" 2>&1

# 4. M1 --phase migration (35 rows, qalead-la-18, est. 7 min):
COMPOSE_PROJECT_NAME=qalead-la-18 PUBLIC_PORT=$PUBLIC_PORT STACK_SUBNET=$STACK_SUBNET \
  COURSE_FIXTURES_DIR="$COURSE_FIXTURES_DIR" \
  node "$SRC_SLOT7/tests/host/run-m1.mjs" \
  --phase migration \
  --provider all \
  --sha "$INTAKE_SHA" \
  --test-sha "$SLOT7_TEST_SHA" \
  --source "$SRC_SLOT7" \
  > "$GATE_DIR/logs/slot7a-3-m1-migration.log" 2>&1

# 5. M1 --phase snapshot-upgrade (7 rows, qalead-la-19, est. 5 min):
COMPOSE_PROJECT_NAME=qalead-la-19 PUBLIC_PORT=$PUBLIC_PORT STACK_SUBNET=$STACK_SUBNET \
  node "$SRC_SLOT7/tests/host/run-m1.mjs" \
  --phase snapshot-upgrade \
  --provider all \
  --sha "$INTAKE_SHA" \
  --test-sha "$SLOT7_TEST_SHA" \
  --source "$SRC_SLOT7" \
  > "$GATE_DIR/logs/slot7a-4-m1-snapshot-upgrade.log" 2>&1

# 6. Stop stats sampler and compute rate-peaks (AC-LA-E0-02-04):
touch "$GATE_DIR/logs/stop-slot7a-stats"
wait "$STATS_7A_PID" 2>/dev/null || true

M1_SIM_ART=$(ls -td "$SRC_SLOT7/tests/host/artifacts/qalead-la-16-"* | head -n1)
node "/Users/quangnguyen/orca/workspaces/cogniate_moodle_integration_prototype/la-qa/tests/ltiaas/perf/rate-peaks.mjs" \
  --logs "$M1_SIM_ART/logs" \
  --json > "$GATE_DIR/logs/slot7a-rate-peaks.json"
```

### Exact Commands for Slot 7 — Run 7B (Moodle 5.2 Lane on `1b17261`, Est. `38 min` Core / `93 min` Full)

```bash
umask 077
export GATE_DIR="/Users/quangnguyen/cogniate-qa-runs/LA/GATE"
export SRC_SLOT7="$GATE_DIR/src-slot7-1b17261"
export COURSE_FIXTURES_DIR="$GATE_DIR/course-fixtures"
export INTAKE_SHA="1b17261be97c4701b928fa9dc2fa74c6d23028f6"
export PUBLIC_PORT=9543
export STACK_SUBNET="172.21.0.0/16"

# 1. Start background docker stats peak memory sampler (AC-LA-E0-02-05):
(
  while [ ! -f "$GATE_DIR/logs/stop-slot7b-stats" ]; do
    ts=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    docker stats --no-stream --format "{\"ts\":\"$ts\",\"name\":\"{{.Name}}\",\"mem\":\"{{.MemUsage}}\",\"cpu\":\"{{.CPUPerc}}\"}" \
      >> "$GATE_DIR/logs/slot7b-docker-stats.jsonl" 2>/dev/null || true
    sleep 5
  done
) &
STATS_7B_PID=$!

# 2. T7 x 3 consecutive passes + demo skip (qalead-la-20, est. 38 min, AC-LA-E0-02-03):
COMPOSE_PROJECT_NAME=qalead-la-20 PUBLIC_PORT=$PUBLIC_PORT STACK_SUBNET=$STACK_SUBNET \
  COURSE_FIXTURES_DIR="$COURSE_FIXTURES_DIR" \
  node "$SRC_SLOT7/tests/e2e/host/run-t7.mjs" \
  --sha "$INTAKE_SHA" \
  --source "$SRC_SLOT7" \
  --workdir "$GATE_DIR/qalead-la-20-t7x3" \
  --replace-tests --tests-from "$SRC_SLOT7/tests" \
  --runs 3 \
  > "$GATE_DIR/logs/slot7b-1-t7x3.log" 2>&1

# 3. Optional / full legacy Moodle acceptance groups T1-T8 (qalead-la-21..27, est. +55 min, AC-LA-E0-02-02):
COMPOSE_PROJECT_NAME=qalead-la-21 PUBLIC_PORT=$PUBLIC_PORT STACK_SUBNET=$STACK_SUBNET \
  node "$SRC_SLOT7/tests/host/run-t1.mjs" \
  --sha "$INTAKE_SHA" --source "$SRC_SLOT7" --workdir "$GATE_DIR/qalead-la-21-t1" \
  --replace-tests --tests-from "$SRC_SLOT7/tests" \
  > "$GATE_DIR/logs/slot7b-2-t1.log" 2>&1

COMPOSE_PROJECT_NAME=qalead-la-22 PUBLIC_PORT=$PUBLIC_PORT STACK_SUBNET=$STACK_SUBNET \
  node "$SRC_SLOT7/tests/host/run-t2.mjs" \
  --sha "$INTAKE_SHA" --source "$SRC_SLOT7" --workdir "$GATE_DIR/qalead-la-22-t2" \
  --replace-tests --tests-from "$SRC_SLOT7/tests" --tasks T2a,T2b,T3a,T3b \
  > "$GATE_DIR/logs/slot7b-3-t2-t3ab.log" 2>&1

COMPOSE_PROJECT_NAME=qalead-la-23 PUBLIC_PORT=$PUBLIC_PORT STACK_SUBNET=$STACK_SUBNET \
  node "$SRC_SLOT7/tests/host/run-t3c.mjs" \
  --sha "$INTAKE_SHA" --source "$SRC_SLOT7" --workdir "$GATE_DIR/qalead-la-23-t3c" \
  --replace-tests --tests-from "$SRC_SLOT7/tests" \
  > "$GATE_DIR/logs/slot7b-4-t3c.log" 2>&1

COMPOSE_PROJECT_NAME=qalead-la-24 PUBLIC_PORT=$PUBLIC_PORT STACK_SUBNET=$STACK_SUBNET \
  node "$SRC_SLOT7/tests/host/run-t4a.mjs" \
  --sha "$INTAKE_SHA" --source "$SRC_SLOT7" --workdir "$GATE_DIR/qalead-la-24-t4a" \
  --replace-tests --tests-from "$SRC_SLOT7/tests" \
  > "$GATE_DIR/logs/slot7b-5-t4a.log" 2>&1

COMPOSE_PROJECT_NAME=qalead-la-25 PUBLIC_PORT=$PUBLIC_PORT STACK_SUBNET=$STACK_SUBNET \
  node "$SRC_SLOT7/tests/host/run-t4b.mjs" \
  --sha "$INTAKE_SHA" --source "$SRC_SLOT7" --workdir "$GATE_DIR/qalead-la-25-t4b" \
  --replace-tests --tests-from "$SRC_SLOT7/tests" --tasks T4b1,T4b2 \
  > "$GATE_DIR/logs/slot7b-6-t4b.log" 2>&1

COMPOSE_PROJECT_NAME=qalead-la-26 PUBLIC_PORT=$PUBLIC_PORT STACK_SUBNET=$STACK_SUBNET \
  COURSE_FIXTURES_DIR="$COURSE_FIXTURES_DIR" \
  node "$SRC_SLOT7/tests/host/run-t5.mjs" \
  --sha "$INTAKE_SHA" --source "$SRC_SLOT7" --workdir "$GATE_DIR/qalead-la-26-t5-t6" \
  --replace-tests --tests-from "$SRC_SLOT7/tests" --tasks T5a,T5b,T6 \
  > "$GATE_DIR/logs/slot7b-7-t5-t6.log" 2>&1

COMPOSE_PROJECT_NAME=qalead-la-27 PUBLIC_PORT=$PUBLIC_PORT STACK_SUBNET=$STACK_SUBNET \
  COURSE_FIXTURES_DIR="$COURSE_FIXTURES_DIR" \
  node "$SRC_SLOT7/tests/host/run-t8.mjs" \
  --sha "$INTAKE_SHA" --source "$SRC_SLOT7" --workdir "$GATE_DIR/qalead-la-27-t8" \
  --replace-tests --tests-from "$SRC_SLOT7/tests" \
  > "$GATE_DIR/logs/slot7b-8-t8.log" 2>&1

# 4. Stop stats sampler and compute rate-peaks (AC-LA-E0-02-04):
touch "$GATE_DIR/logs/stop-slot7b-stats"
wait "$STATS_7B_PID" 2>/dev/null || true

T7_ART=$(ls -td "$SRC_SLOT7/tests/host/artifacts/qalead-la-20-"* | head -n1)
node "/Users/quangnguyen/orca/workspaces/cogniate_moodle_integration_prototype/la-qa/tests/ltiaas/perf/rate-peaks.mjs" \
  --logs "$T7_ART/logs" \
  --json > "$GATE_DIR/logs/slot7b-rate-peaks.json"
```

---

## 5. Slot 8: Wave-End `MOODLE-LIVE` Gate on `43d5073c` (Code `5260eac5`) with QA-E2E

- **Target SHA:** `43d5073cd57c879c33aa97151848bf8d6890844b` (product code `5260eac5`)
- **Pre-Staged Source Repo:** `/Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end` (`--test-sha 625e923d458c0b59c13c3f6061624b7a512f7ab4`)
- **Compose Projects:** `qalead-la-30..36` (Lead QA) + QA-E2E project (`qa-e2e-la-*`)
- **Port / Subnet:** `PUBLIC_PORT=9543`, `STACK_SUBNET=172.21.0.0/16`
- **Scope Covered:**
  1. **`T7 × 1` (`qalead-la-30`, `12 min`):** `run-t7.mjs --runs 1 --no-demo` (`17` browser cases, including frozen isolation ACs **`AC-T7-08`** and **`AC-T7-09`**).
  2. **`R2-lite` Moodle Suites (`qalead-la-31..35`, `40 min`):**
     - `qalead-la-31` (`8 min`): `run-t2.mjs --tasks T2a,T2b,T3a,T3b` (covers frozen isolation AC **`AC-T2-18`** in `T2a/jwt-validation.test.ts`).
     - `qalead-la-32` (`5 min`): `run-t3c.mjs` (`T3c` compatibility & endpoints).
     - `qalead-la-33` (`10 min`): `run-t4b.mjs --tasks T4b1,T4b2` (covers frozen isolation ACs **`AC-T4-16`**, **`AC-T4-29`**, **`AC-T4-34`** in `T4b1/2-isolation.spec.ts`, `T4b1/3-security.spec.ts`, `T4b1/4-adoption.spec.ts`, plus `LA-IC-04` Moodle row 13 in `T4b1/1-connect.spec.ts:118`).
     - `qalead-la-34` (`12 min`): `run-t5.mjs --tasks T5a,T5b,T6` (covers `LA-IC-09` / `LD-6` `record_dispatch` P5 fixture in `T5b/4-conflict-resend.spec.ts` and `T6` portal Moodle flows).
     - `qalead-la-35` (`5 min`): `run-t8.mjs` (`T8` course shell export/publish).
  3. **`LA-E5-13` `AC-LA-E5-13-06` (`qalead-la-36`, `3 min`):** Confirms all 6 frozen isolation ACs (`AC-T2-18`, `AC-T4-16`, `AC-T4-29`, `AC-T4-34`, `AC-T7-08`, `AC-T7-09`) passed in steps 1–2 and runs `two-tenant-isolation.k1sim.test.ts` (`AC-LA-E5-13-01..06`).
  4. **QA-E2E's Part (`20 min`):** `K2` Moodle `U1`/`U2` + `LA-E3-05` `AC-04, 11`.
- **Estimated Duration:** **`55 minutes` (Lead QA)** + **`20 minutes` (QA-E2E)** = **`75 minutes` total**.

### Exact Commands for Slot 8 (Lead QA Part, Est. `55 min`)

```bash
umask 077
export GATE_DIR="/Users/quangnguyen/cogniate-qa-runs/LA/GATE"
export SRC_WAVE="$GATE_DIR/src-wave-end"
export COURSE_FIXTURES_DIR="$GATE_DIR/course-fixtures"
export WAVE_SHA="43d5073cd57c879c33aa97151848bf8d6890844b"
export PUBLIC_PORT=9543
export STACK_SUBNET="172.21.0.0/16"

# ----------------------------------------------------------------------
# Step 8.1 (qalead-la-30, est. 12 min): T7 x 1 (covers AC-T7-08, AC-T7-09)
# ----------------------------------------------------------------------
COMPOSE_PROJECT_NAME=qalead-la-30 PUBLIC_PORT=$PUBLIC_PORT STACK_SUBNET=$STACK_SUBNET \
  COURSE_FIXTURES_DIR="$COURSE_FIXTURES_DIR" \
  node "$SRC_WAVE/tests/e2e/host/run-t7.mjs" \
  --sha "$WAVE_SHA" \
  --source "$SRC_WAVE" \
  --workdir "$GATE_DIR/qalead-la-30-t7x1" \
  --replace-tests --tests-from "$SRC_WAVE/tests" \
  --runs 1 --no-demo \
  > "$GATE_DIR/logs/slot8-1-t7x1.log" 2>&1

# ----------------------------------------------------------------------
# Step 8.2 (qalead-la-31, est. 8 min): T2a, T2b, T3a, T3b (covers AC-T2-18)
# ----------------------------------------------------------------------
COMPOSE_PROJECT_NAME=qalead-la-31 PUBLIC_PORT=$PUBLIC_PORT STACK_SUBNET=$STACK_SUBNET \
  node "$SRC_WAVE/tests/host/run-t2.mjs" \
  --sha "$WAVE_SHA" \
  --source "$SRC_WAVE" \
  --workdir "$GATE_DIR/qalead-la-31-t2-t3ab" \
  --replace-tests --tests-from "$SRC_WAVE/tests" \
  --tasks T2a,T2b,T3a,T3b \
  > "$GATE_DIR/logs/slot8-2-t2-t3ab.log" 2>&1

# ----------------------------------------------------------------------
# Step 8.3 (qalead-la-32, est. 5 min): T3c
# ----------------------------------------------------------------------
COMPOSE_PROJECT_NAME=qalead-la-32 PUBLIC_PORT=$PUBLIC_PORT STACK_SUBNET=$STACK_SUBNET \
  node "$SRC_WAVE/tests/host/run-t3c.mjs" \
  --sha "$WAVE_SHA" \
  --source "$SRC_WAVE" \
  --workdir "$GATE_DIR/qalead-la-32-t3c" \
  --replace-tests --tests-from "$SRC_WAVE/tests" \
  > "$GATE_DIR/logs/slot8-3-t3c.log" 2>&1

# ----------------------------------------------------------------------
# Step 8.4 (qalead-la-33, est. 10 min): T4b1, T4b2 (covers AC-T4-16, AC-T4-29, AC-T4-34, and LA-IC-04 row 13)
# ----------------------------------------------------------------------
COMPOSE_PROJECT_NAME=qalead-la-33 PUBLIC_PORT=$PUBLIC_PORT STACK_SUBNET=$STACK_SUBNET \
  node "$SRC_WAVE/tests/host/run-t4b.mjs" \
  --sha "$WAVE_SHA" \
  --source "$SRC_WAVE" \
  --workdir "$GATE_DIR/qalead-la-33-t4b" \
  --replace-tests --tests-from "$SRC_WAVE/tests" \
  --tasks T4b1,T4b2 \
  > "$GATE_DIR/logs/slot8-4-t4b.log" 2>&1

# ----------------------------------------------------------------------
# Step 8.5 (qalead-la-34, est. 12 min): T5a, T5b, T6 (covers LA-IC-09 record_dispatch P5 fixture)
# ----------------------------------------------------------------------
COMPOSE_PROJECT_NAME=qalead-la-34 PUBLIC_PORT=$PUBLIC_PORT STACK_SUBNET=$STACK_SUBNET \
  COURSE_FIXTURES_DIR="$COURSE_FIXTURES_DIR" \
  node "$SRC_WAVE/tests/host/run-t5.mjs" \
  --sha "$WAVE_SHA" \
  --source "$SRC_WAVE" \
  --workdir "$GATE_DIR/qalead-la-34-t5-t6" \
  --replace-tests --tests-from "$SRC_WAVE/tests" \
  --tasks T5a,T5b,T6 \
  > "$GATE_DIR/logs/slot8-5-t5-t6.log" 2>&1

# ----------------------------------------------------------------------
# Step 8.6 (qalead-la-35, est. 5 min): T8
# ----------------------------------------------------------------------
COMPOSE_PROJECT_NAME=qalead-la-35 PUBLIC_PORT=$PUBLIC_PORT STACK_SUBNET=$STACK_SUBNET \
  COURSE_FIXTURES_DIR="$COURSE_FIXTURES_DIR" \
  node "$SRC_WAVE/tests/host/run-t8.mjs" \
  --sha "$WAVE_SHA" \
  --source "$SRC_WAVE" \
  --workdir "$GATE_DIR/qalead-la-35-t8" \
  --replace-tests --tests-from "$SRC_WAVE/tests" \
  > "$GATE_DIR/logs/slot8-6-t8.log" 2>&1

# ----------------------------------------------------------------------
# Step 8.7: Verify all 6 frozen isolation ACs for AC-LA-E5-13-06 + teardown check (<1 min)
# ----------------------------------------------------------------------
grep -E "AC-T7-08|AC-T7-09" "$GATE_DIR/logs/slot8-1-t7x1.log"
grep -E "AC-T2-18" "$GATE_DIR/logs/slot8-2-t2-t3ab.log"
grep -E "AC-T4-16|AC-T4-29|AC-T4-34" "$GATE_DIR/logs/slot8-4-t4b.log"
docker ps -a --filter "name=qalead-la-"
docker volume ls --filter "name=qalead-la-"
docker network ls --filter "name=qalead-la-"
```
