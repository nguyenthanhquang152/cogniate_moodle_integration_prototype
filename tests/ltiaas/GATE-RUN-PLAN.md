# LTIAAS Wave-End Gate Run Plan (Host-Only Prepared Runbook)

- **Owner:** Lead QA (`task_7aeec40d57a9`, updated in `task_7a15ccfad614`, `task_67cd3791548e`, `task_6aae0ea0cac1`, and `task_f58735a7596f` / `ctx_27248ee34e63`)
- **Preparation Mode:** Host-only (`0` Docker containers, `0` volumes, `0` networks started during preparation; Slot 3B executed `16:55Z–17:48Z`; Slot 7 executed `18:26Z–19:15Z`)
- **Wave-End Candidate SHA (Slot 3B):** `80133d6b662dd4fb8e18a9eed62e3160d2b2a1c5` (`80133d6b`, product code `02f5d420`). **Re-Gate Candidate SHA (Slot 3C & Slot 8):** `$WAVE_SHA_2` (to be named by the Lead after the `BD-A2-109` `WE-F4` stop-order fixes from lanes R and S1 merge and pass the full host check; also includes `BD-A2-108` `ecc19bbc` `admin` `1200/min`, burst `600` and `BD-A2-106` `60230165` hosted Canvas wizard help sentence).
- **Intake / `G-BASE` SHA:** `1b17261be97c4701b928fa9dc2fa74c6d23028f6` (`1b17261b`, product code `9f8ac62`)
- **Pre-Staged Host-Only Gate Assets (`/Users/quangnguyen/cogniate-qa-runs/LA/GATE`, mode `0700`):**
  - **Wave-End Test Source Repo (Slots 3B & 8):** `/Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end`
    - Product commit: `80133d6b662dd4fb8e18a9eed62e3160d2b2a1c5`
    - Committed test SHA (`--test-sha`): `8ad1292687431b05bad6b5c070ab722e67714526` (`la-gate-test-8ad12926`, active `HEAD`; proposed 2-hunk addendum tagged `la-proposed-addendum-r1` at `9e78fe3f87bd4672a9e37ace9efdacfd96f28474`, documented in `docs/reviews/LA-E7-08/ld9-addendum-r1.md`, not applied until approved and named by the Lead)
    - Contains: `80133d6b`'s `tests/` tree plus the 8 `LD-1` open-world files from `f0a7b306`, the 3 approved `LA-IC-04` frozen-test updates (`31-canvas-grants.test.ts:114-120`, `00-profiles.test.ts:104`, `T4b1/1-connect.spec.ts:118`), the 3 approved `LA-IC-14` frozen-test updates (`11-canvas-platforms.test.ts:218-265`), the `LA-IC-09` (`LD-6`) P5 fixture update (`storage-fixture-script.mjs:389-396` supporting `record_dispatch`), the open-world migration-ledger check in `m1-migration.mjs:331-338`, and the `qalead-la-<n>` project-prefix regex guard in `tests/host/{core,m1-control,storage-docker,storage-handoff,run-t1,run-t5,p5-fixture,host-control}.mjs` and `tests/e2e/host/run-t7.mjs`.
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
| **Slot 6 R1/R2** | QA-E2E | `LA-E7-09` (`R2-SIM` PASS), `LA-E3-16` (`PASS`), `LA-E7-07` (`K2` R3 next on `80133d6b`) | `qa-e2e-la-*` | `9643` / `172.22.0.0/16` | **`25 min`** | **R3 NEXT** |
| **LA-E5-13 SIM** | Lead QA | `LA-E5-13` `AC-01, -02, -03, -05` `K1-SIM` + `AC-06` `K0` on `fd146062` | `qalead-la-8..9` | `9443` / `172.20.0.0/16` | — | **DONE** (`43d5073c`) |
| **Slot 3B** | Lead QA | Wave-end SIM gate (`LA-E7-08`) on `80133d6b` (code `02f5d420`): Golden `G1–G4` capture & compare (`280/280` explained), `M1 migration` (`12/12 PASS` in `m1-case-results.json`), `snapshot-upgrade` (`M1-38.h1..h5` `5/5 PASS`; `ERROR` `FAIL`, `M1-41.common.j-snapshot` not run), `U1` SIM (`37 PASS, 6 INFO`), `M1 sim` (`376/394 PASS, 18 FAIL, 1 ERROR`), `M2` (`64/64 PASS` + `M3-06-M2` env note) | `qalead-la-10..15` | `9473` / `172.23.0.0/16` | **`51 min`** (`16:57Z–17:48Z`) | **DONE (`FAIL` — `WE-F1..F5`, `docs/reviews/LA-E7-08/qa.md` §5)** |
| **Slot 7** | Lead QA | Intake `1b17261` (`G-BASE`): `LA-E0-02` baseline + `LA-E0-04` `LD-1` parity with `357d1799` `--test-sha` (Run 7A `M1 sim` `394/394 PASS`, `M2` `64/64 PASS`, `M1 migration` `12/12 PASS`, `M1 snapshot-upgrade` `6/6 PASS`; Run 7B `T7×3` `3×17 PASS + 1 SKIP`; `WE-F4` baseline `7/7 PASS` with `8.2–8.4 s` restarts) | `qalead-la-16..20` | `9643` / `172.22.0.0/16` (7A SIM) then `9543` / `172.21.0.0/16` (7B Moodle) | **`48 min` actual** (`18:26Z–19:15Z`, one stack at a time) | **DONE (`PASS` — `56038618`, `docs/reviews/LA-E0-02/qa.md`)** |
| **Slot 3C** | Lead QA | Wave-end SIM re-gate (`LA-E7-08`) on `$WAVE_SHA_2` in `src-wave-end-2` (`--test-sha $WAVE_TEST_SHA_2` = `8ad12926` overlay commit + approved `ld9-addendum-r1.md` Round 2 commit): `M1 sim` (`394` rows, all `18` `WE` rows must `PASS`), `M1 snapshot-upgrade` (`6` rows incl. `M1-41.common.j-snapshot`), `M2` (`64` cases), `G1–G4` golden capture & compare (`U1` and `M1 migration` not rerun — `0` migrations changed since `80133d6b`) | `qalead-la-40..43` | `9473` / `172.23.0.0/16` | **`35 min` sequential** (`24m` `M1 sim` + `3m` `snapshot-upgrade` + `4m` `M2` + `4m` `G1–G4`) | **READY (Pending Lead `$WAVE_SHA_2` & Addendum R2 Approval)** |
| **Slot 8** | Lead QA + QA-E2E | Wave-end `MOODLE-LIVE` gate on `$WAVE_SHA_2` in `src-wave-end-2`: `T7×1` + `R2-lite` (`T2a..T8`, including `T4a`) + 6 frozen isolation ACs (`AC-T2-18`, `AC-T4-16`, `AC-T4-29`, `AC-T4-34`, `AC-T7-08`, `AC-T7-09`) + `AC-LA-E5-13-06` + all 12 task `MOODLE-LIVE` rows + QA-E2E `K2` `U1`/`U2` & `LA-E3-05` `AC-04, 11` | `qalead-la-30..36` | `9543` / `172.21.0.0/16` | **`57 min` Lead QA** (`+20 min` QA-E2E = **`77 min`**) | **READY** |

> [!IMPORTANT]
> **Never reuse compose project numbers.** `qalead-la-1..3` (Slots 2 & 3A), `qalead-la-8..9` (`LA-E5-13` SIM), `qalead-la-10..15` (Slot 3B), and `qalead-la-16..20` (Slot 7) have already been used. **Slot 8** reserves **`qalead-la-30..36`**, and **Slot 3C** exclusively uses **`qalead-la-40..43`**.

---

## 2. Expected-Delta Set for Wave-End Gate (`LA-E7-08` `AC-03` & `AC-01`)

All **13 approved `LD-9` records** (`fd146062`, Round 8 APPROVE by both Reviewer-A and Reviewer-B) are committed in `tests/ltiaas/golden/expected/*.json` and passed to the golden comparator:

```text
LA-IC-01,LA-IC-03,LA-IC-04,LA-IC-12,LA-IC-13,LA-IC-14,LA-IC-15,LA-IC-16,LA-IC-17,LA-IC-18,LA-IC-19,LA-IC-20,LA-IC-21
```

| Record ID | Golden Path Deltas (`G1–G4` vs `G-BASE` `1b17261`) | Frozen Test Deltas (`1b17261..8ad12926`) | Notes on Wave-End SHA (`80133d6b` / code `02f5d420`) |
| --- | --- | --- | --- |
| **`LA-IC-01`** | **`259` exact-value paths** (`G1`, `G3`; `0` wildcards) | **`0` after `LD-1`** (`LA-E0-04` 8 files in `f0a7b306`) | Includes `lti-generic` `channelName: "LMS"` (`BD-A1-111`), `canvas` & `lti-generic` `setup.connectionCheck: true` (`LA-E6-04`), and `brightspace` `methods: ["dynamic", "manual"]` (`LA-E2-06`). |
| **`LA-IC-03`** | `0` | `0` | Moodle DR path-prefix & `LtiDeepLinkingRequest` (`LA-E2-02`). |
| **`LA-IC-04`** | **`3` paths in `G1`** (`canvasConfiguration["jwk=inline"].scopes[4]` removed, `canvasConfiguration["jwk=url"].scopes[4]` removed, `toolConfiguration.moodle[12].value` = `"Do not use this service"`) | **`3` files**: `31-canvas-grants.test.ts:114-120`, `00-profiles.test.ts:104`, `T4b1/1-connect.spec.ts:118` | **Now active on `80133d6b`** (`LA-E3-07`, 4 AGS scopes, no NRPS scope). |
| **`LA-IC-12`** | **`2` paths in `G4`** (`blackboard.pages.picker.text`, `canvas.pages.picker.text` + `" Cancel"`) | `0` | Deep Linking Cancel button & empty `contentItems` (`LA-E3-04`, `LA-E3-05`). |
| **`LA-IC-13`** | `0` | `0` | Could gaps (`scoreGiven: null`, NRPS `service_versions`, `trustedAudiences`) (`LA-E3-12`). |
| **`LA-IC-14`** | **`13` paths across `G1` (`12`) and `G3` (`1`)** (`capabilities.dynamicRegistration: true` and `methods[1]: "dynamic"` on Canvas) | **`1` file (`3` cases)**: `11-canvas-platforms.test.ts:218-265` (`M1-15.canvas.dto`, `M1-15.canvas.dynamic-refused`, `M1-15.canvas.lms-providers`) | **Now active on `80133d6b`** (`LA-E3-09`, `LA-E3-15`). |
| **`LA-IC-15`** | **`2` paths in `G3`** (`{blackboard,canvas}.publications.B-conflict.results[0].scoreSyncs[0].lastError`) | `0` | Channel-named 409 conflict text (`LA-E4-03`). |
| **`LA-IC-16`** | **`1` path in `G1`** (`acceptance.ltiHealth.outbound_allowlist` via `sim-hosts-allowlist` rule) | `0` | `.sim.test` hosts equal `tests/sim/hosts.json` union (`15` hosts); non-sim entries equal `G-BASE` (`BD-A1-36`). |
| **`LA-IC-17`** | `0` | `0` | Strict 6-key Moodle `PUT /app-api/connections/:id/platform` (`BD-A1-41`). |
| **`LA-IC-18`** | `0` | `0` | Portal `PublishDialog` channel name & `IntegrationLogo` colour/title (`BD-A1-50`). |
| **`LA-IC-19`** | `0` | `0` | Content-host `410 RUNTIME_EXPIRED` channel name (`BD-A1-57`). |
| **`LA-IC-20`** | `0` | `0` | `ChannelErrorNotice` 5-code error text fallback (`BD-A1-63`, `BD-A1-81`). |
| **`LA-IC-21`** | `0` | `0` | DR update preserves existing `active` state (`BD-A1-93`). |
| **Total** | **`280` explained entries (`267` distinct golden paths)** | **8 `LD-1` files + 4 `LA-IC-04/14` files + 1 `LA-IC-09` P5 fixture** | **`0` unexplained differences, `0` missing expected changes** |

---

## 3. Slot 3B: Wave-End SIM-Lane Gate (`LA-E7-08`) on `80133d6b` (Code `02f5d420`)

- **Target SHA:** `80133d6b662dd4fb8e18a9eed62e3160d2b2a1c5` (product code `02f5d420`)
- **Pre-Staged Source Repo:** `/Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end` (`--test-sha 8ad1292687431b05bad6b5c070ab722e67714526`)
- **Compose Projects:** `qalead-la-10`, `qalead-la-11`, `qalead-la-12`, `qalead-la-13`, `qalead-la-13b`, `qalead-la-14`, `qalead-la-15`
- **Port / Subnet:** `PUBLIC_PORT=9643`, `STACK_SUBNET=172.22.0.0/16` (or `9443` / `172.20.0.0/16` per `DOCKER-YES`)
- **Estimated Duration:** **`52 minutes` total**
  - Step 3B.1 (`qalead-la-10`): Candidate golden capture `G1–G4` + host compare with all 13 `LD-9` records — **`4 min`**
  - Step 3B.2 (`qalead-la-11` & `qalead-la-12`): `M1 --phase migration` (`35` rows) + `M1 --phase snapshot-upgrade` (`7` rows) — **`12 min`**
  - Step 3B.3 (`qalead-la-13` & `qalead-la-13b`): `U1` SIM upgrade continuity from `1b17261` to `80133d6b` (`LA-E5-08` LTI + `LA-E5-22` app) — **`6 min`**
  - Step 3B.4 (`qalead-la-14`): `M1 --phase sim --provider all` (`394` rows) — **`15 min`**
  - Step 3B.5 (`qalead-la-15`): `M2` browser suite (`64` cases) — **`15 min`**

### Exact Commands for Slot 3B

```bash
umask 077
export GATE_DIR="/Users/quangnguyen/cogniate-qa-runs/LA/GATE"
export SRC_WAVE="$GATE_DIR/src-wave-end"
export COURSE_FIXTURES_DIR="$GATE_DIR/course-fixtures"
export WAVE_SHA="80133d6b662dd4fb8e18a9eed62e3160d2b2a1c5"
export WAVE_TEST_SHA="8ad1292687431b05bad6b5c070ab722e67714526"
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
# Step 3B.3 (qalead-la-13 & qalead-la-13b, est. 6 min): U1 SIM Upgrade Continuity 1b17261 -> 80133d6b (AC-LA-E7-08-04)
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
  - `git -C "$SRC_WAVE" diff --stat 1b17261be97c4701b928fa9dc2fa74c6d23028f6..8ad1292687431b05bad6b5c070ab722e67714526 -- tests/acceptance tests/e2e tests/host tests/sim tests/fixtures` shows `47` files:
    1. **8 `LD-1` open-world files** (`LA-E0-04`, `f0a7b306`): `tests/acceptance/lib/open-world.{mjs,d.mts}`, `00-profiles.test.ts:1-29`, `90-simulation-gates.test.ts:19`, `11-canvas-platforms.test.ts:255`, `tests/host/run-m1.mjs:297,302`, `tests/e2e/host/run-m2.mjs:124`, `tests/e2e/M2/01-cards.m2.ts:11-21`.
    2. **3 `LA-IC-04` frozen test files** (`LA-E3-07`, approved in `fd146062`): `tests/acceptance/M1/canvas/31-canvas-grants.test.ts:114-120`, `tests/acceptance/M1/common/00-profiles.test.ts:104`, `tests/acceptance/T4b1/1-connect.spec.ts:118`.
    3. **1 `LA-IC-14` frozen test file** (`LA-E3-09`/`LA-E3-15`, approved in `fd146062`): `tests/acceptance/M1/canvas/11-canvas-platforms.test.ts:218-265`.
    4. **1 `LA-IC-09` (`LD-6`) P5 fixture file** (`LA-E4-03` / migration `014`): `tests/host/storage-fixture-script.mjs:389-396`.
    5. **Runner-only changes (`0` frozen assertion changes):** `tests/acceptance/run-api.mjs` (LA task Vitest config routing), `tests/host/m1-migration.mjs:331-338` (open-world candidate migration ledger check in `snapshotMigrationRun`), and `tests/host/{core,m1-control,storage-docker,storage-handoff,run-t1,run-t5,p5-fixture,host-control}.mjs` + `tests/e2e/host/run-t7.mjs` (`qalead-la-<n>` project prefix regex).
    6. **13 additive `K2` browser suite files:** `tests/e2e/ltiaas/**` (`LA-E7-07`, `LA-E7-09`).
    7. **13 additive simulator files:** `tests/sim/**` (`LA-E7-01`, `LA-E7-02`, `LA-E7-05`).
- **`AC-LA-E7-08-06` (`PASS`, `K0`):**
  - `git -C "$SRC_WAVE" diff --stat 1b17261be97c4701b928fa9dc2fa74c6d23028f6..80133d6b662dd4fb8e18a9eed62e3160d2b2a1c5 -- infra/scripts/stack-data.sh infra/scripts/stack-data.mjs infra/scripts/storage-compat.sh infra/compat/` produces **empty output (`0` files changed, exit `0`)**.

---

## 3C. Slot 3C: Wave-End SIM-Lane Re-Gate (`LA-E7-08`) on New Candidate SHA (`$WAVE_SHA_2`)

- **Target Candidate SHA (`$WAVE_SHA_2`):** The integration commit after the `WE-F4` stop-order fixes from lanes **R** and **S1** (`BD-A2-109`) merge and pass the full host check (named by the Lead). Also includes `BD-A2-108` (`ecc19bbc`: `lti-service` `admin` default `1200/min`, burst `600`) and `BD-A2-106` (`60230165`: hosted Canvas wizard help sentence).
- **New Gate Source Repo:** `/Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end-2` (never editing `/Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end`, which stays frozen at `8ad1292687431b05bad6b5c070ab722e67714526`).
- **Compose Projects:** `qalead-la-40`, `qalead-la-41`, `qalead-la-42`, `qalead-la-43` (`qalead-la-30..36` stay reserved for Slot 8).
- **Port / Subnet:** `PUBLIC_PORT=9473`, `STACK_SUBNET=172.23.0.0/16` (one LA stack at a time).
- **Estimated Duration:** **`35 minutes` total** (`24m` `qalead-la-40` `M1 sim` + `3m` `qalead-la-41` `M1 snapshot-upgrade` + `4m` `qalead-la-42` `M2` + `4m` `qalead-la-43` `G1–G4` golden capture & compare).

### (a) How `src-wave-end-2` Is Built (Two Explicit Commits on Top of `$WAVE_SHA_2` — Never an Amend)

Once the Lead names `$WAVE_SHA_2` and both reviewers approve Round 2 of `docs/reviews/LA-E7-08/ld9-addendum-r1.md`, QA builds `/Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end-2` on the host (`0` Docker) and records all three 40-character SHAs (`$WAVE_SHA_2`, `$BASE_OVERLAY_SHA`, `$WAVE_TEST_SHA_2`):

```bash
umask 077
export GATE_DIR="/Users/quangnguyen/cogniate-qa-runs/LA/GATE"
export INTEG_REPO="/Users/quangnguyen/orca/workspaces/cogniate_moodle_integration_prototype/ltiaas-milestone"
export SRC_WAVE="$GATE_DIR/src-wave-end"
export SRC_WAVE_2="$GATE_DIR/src-wave-end-2"
export WAVE_SHA_2="<40-char integration SHA named by the Lead>"

# 1. Fresh clone --no-hardlinks at $WAVE_SHA_2:
git clone --quiet --no-hardlinks "$INTEG_REPO" "$SRC_WAVE_2"
git -C "$SRC_WAVE_2" checkout --quiet --detach "$WAVE_SHA_2"
git -C "$SRC_WAVE_2" tag la-wave-end-product-2 "$WAVE_SHA_2"

# 2. Commit 1: Apply the exact 8ad12926 test overlay from src-wave-end as one commit:
git -C "$SRC_WAVE" fetch --quiet "$SRC_WAVE" 8ad1292687431b05bad6b5c070ab722e67714526
git -C "$SRC_WAVE_2" fetch --quiet "$SRC_WAVE" 8ad1292687431b05bad6b5c070ab722e67714526
git -C "$SRC_WAVE_2" checkout 8ad1292687431b05bad6b5c070ab722e67714526 -- tests
git -C "$SRC_WAVE_2" diff --exit-code 8ad1292687431b05bad6b5c070ab722e67714526 -- tests
git -C "$SRC_WAVE_2" commit -m "QA gate test overlay: 8ad12926 base on $WAVE_SHA_2"
export BASE_OVERLAY_SHA=$(git -C "$SRC_WAVE_2" rev-parse HEAD)
git -C "$SRC_WAVE_2" tag la-gate-test-base-c1 "$BASE_OVERLAY_SHA"

# 3. Commit 2: Apply the approved 3-file LD-9 Addendum Round 2 patch as a second commit (NEVER git commit --amend):
python3 - << 'EOF' > "$GATE_DIR/addendum-r2.patch"
import re
doc = open("/Users/quangnguyen/orca/workspaces/cogniate_moodle_integration_prototype/la-qa/docs/reviews/LA-E7-08/ld9-addendum-r1.md").read()
r2 = doc.split("## Round 2", 1)[1]
blocks = re.findall(r"```diff\n(.*?\n)```", r2, flags=re.S)
assert len(blocks) == 4
print(blocks[3], end="")
EOF
git -C "$SRC_WAVE_2" apply --check "$GATE_DIR/addendum-r2.patch"
git -C "$SRC_WAVE_2" apply --index "$GATE_DIR/addendum-r2.patch"
git -C "$SRC_WAVE_2" commit -m "QA gate test addendum r2: LA-IC-14 ref regex, LA-IC-22 99-logs, m1-migration path"
export WAVE_TEST_SHA_2=$(git -C "$SRC_WAVE_2" rev-parse HEAD)
git -C "$SRC_WAVE_2" tag la-gate-test-addendum-r2 "$WAVE_TEST_SHA_2"

# 4. Verify SHAs, clean status, and K0 diff stat (AC-LA-E7-08-05 & AC-LA-E7-08-06):
echo "WAVE_SHA_2=$WAVE_SHA_2"
echo "BASE_OVERLAY_SHA=$BASE_OVERLAY_SHA"
echo "WAVE_TEST_SHA_2=$WAVE_TEST_SHA_2"
git -C "$SRC_WAVE_2" status --short
git -C "$SRC_WAVE_2" diff --stat "$BASE_OVERLAY_SHA".."$WAVE_TEST_SHA_2"
git -C "$SRC_WAVE_2" diff --stat 1b17261be97c4701b928fa9dc2fa74c6d23028f6.."$WAVE_SHA_2" -- \
  infra/scripts/stack-data.sh infra/scripts/stack-data.mjs infra/scripts/storage-compat.sh infra/compat/
```

### (b) Slot 3C Run Set & Reason for Each Suite (Including Why `U1` and `M1 migration` Are Not Rerun)

| Compose Project | Suite | Est. Minutes | Reason & Required Outcome |
| --- | --- | --- | --- |
| **`qalead-la-40`** | `M1 --phase sim --provider all` (`394` manifest rows) | **`24 min`** | Closes `AC-LA-E7-08-01` and proves all **`18` Slot 3B non-PASS rows now `PASS`** (`394/394` manifest rows `PASS`, `0` missing, `0` `ERROR` rows):<br>• **9 `WE-F1` rows** (`M1-13.blackboard.inactive`, `M1-25.blackboard.site-metadata`, `M1-14.blackboard.claims`, `M1-36.blackboard.{origin,path,query,encoded-dot,encoded-slash}`, `M1-08.canvas.login-redirect`) after the S1 `admin` default rate-limit fix (`1200/min`, burst `600`, `BD-A2-108` / `ecc19bbc`);<br>• **7 `WE-F4` rows** (`M1-37.blackboard.{d,o,v5}`, `M1-37.canvas.{d,s-dead,v4,v6}`) after the lanes R + S1 stop-order fix (`BD-A2-109`: listeners stop at once, HTTP cut after `3 s`, runner drain only), with `m1-restart cogniate-app` wall times recorded from `host-actions/*.json`;<br>• **1 `WE-F3` row** (`M1-15.canvas.dynamic-refused`) with Addendum Hunk 1 (`LA-IC-14` required `?ref=` 43-char regex);<br>• **1 `WE-F2` row** (`M1-24.common.event-shapes`) with Addendum Hunk 3 (`LA-IC-22` `launch_claims_minimized` `tool_account_id`). |
| **`qalead-la-41`** | `M1 --phase snapshot-upgrade --provider all` (`6` manifest rows) | **`3 min`** | Closes `AC-LA-E7-08-04` and **`WE-F5`** (Addendum Hunk 2: `services/lti-service/src/db/migrations` in `tests/host/m1-migration.mjs:332`), proving all **`6/6` manifest rows `PASS`** (`M1-38.common.h1..h5` plus host qualification row **`M1-41.common.j-snapshot`** in `m1-case-results.json`, `0` `ERROR` rows in `summary.json`, and exact 21-file candidate migration ledger equality). |
| **`qalead-la-42`** | `M2` browser suite (`64` manifest cases) | **`4 min`** | Closes `AC-LA-E7-08-01` (`64/64` `M2` cases `PASS`) on `$WAVE_SHA_2` because `cogniate-app` and the portal UI changed after `80133d6b`: specifically `LA-E3-16` hosted Canvas wizard help sentence (`BD-A2-106`, merged in `60230165`, touching the Canvas wizard tested by `M2-02`) and the `BD-A2-109` stop-order changes in `cogniate-app` and `lti-service`. |
| **`qalead-la-43`** | Candidate golden capture `G1–G4` & host compare (`280` expected entries across `LA-IC-01..21`) | **`4 min`** | Closes `AC-LA-E7-08-03` (`LA-E0-03` golden comparison) on `$WAVE_SHA_2` because product code changed after `80133d6b` in three places: (1) `lti-service` `admin` default rate limit `1200/min`, burst `600` (`BD-A2-108`, `ecc19bbc`), (2) hosted Canvas wizard help text (`BD-A2-106`, `60230165`), and (3) `cogniate-app` + `lti-service` stop order (`BD-A2-109`). Confirms `280/280` explained golden entries, `0` unexplained differences, and `0` missing expected changes on `$WAVE_SHA_2`. |
| **Not Rerun in Slot 3C** | `M1 --phase migration` (`qalead-la-11`) and `U1` SIM (`LA-E5-08` `qalead-la-13`, `LA-E5-22` `qalead-la-13b`) | **`0 min` (carried from Slot 3B on `80133d6b`)** | **Why `M1 migration` and `U1` do not need to run again:**<br>1. **No new SQL migration or schema change after `80133d6b`:** `git diff --stat 80133d6b662dd4fb8e18a9eed62e3160d2b2a1c5..$WAVE_SHA_2 -- services/lti-service/src/db/migrations services/cogniate-app/src/domain/migrations` is **empty (`0` files changed)**; the migration ledgers remain `001_init.sql`..`021_registration_token_kind.sql` (`21` files in `lti-service`) and `001_init.sql`..`016_binding_authority.sql` (`16` files in `cogniate-app`).<br>2. **No change to `stack-data`, backup/restore, or `U1` key-sealing/backfill code after `80133d6b`:** None of `BD-A2-108` (`ecc19bbc`), `BD-A2-106` (`60230165`), or `BD-A2-109` (`89f72196`) touches migration SQL, backfill logic, key-provider sealing (`ltik1` / `cgk1`), or backup/restore scripts (QA verifies `git diff --stat 80133d6b..$WAVE_SHA_2` on those paths before starting Slot 3C).<br>3. **Already proven 100% `PASS` in Slot 3B (`docs/reviews/LA-E7-08/qa.md` §5.1 items 2, 4a, 4b):** `qalead-la-11` passed `12/12` `migration` manifest rows in `m1-case-results.json`, `qalead-la-13` passed `19/19` LTI `U1` assertions, and `qalead-la-13b` passed `18/18` app `U1` assertions. |

### (c) Exact Commands for Slot 3C (`qalead-la-40..43`, `PUBLIC_PORT=9473`, `STACK_SUBNET=172.23.0.0/16`, Est. `35 min` Sequential)

```bash
umask 077
export GATE_DIR="/Users/quangnguyen/cogniate-qa-runs/LA/GATE"
export SLOT3C_DIR="/Users/quangnguyen/cogniate-qa-runs/LA/SLOT3C"
export SRC_WAVE_2="$GATE_DIR/src-wave-end-2"
export COURSE_FIXTURES_DIR="$GATE_DIR/course-fixtures"
export WAVE_SHA_2="<40-char integration SHA named by the Lead>"
export WAVE_TEST_SHA_2=$(git -C "$SRC_WAVE_2" rev-parse la-gate-test-addendum-r2)
export INTAKE_SHA="1b17261be97c4701b928fa9dc2fa74c6d23028f6"
export PUBLIC_PORT=9473
export STACK_SUBNET="172.23.0.0/16"

mkdir -p "$SLOT3C_DIR/logs" "$SLOT3C_DIR/docker-records" "$SLOT3C_DIR/artifacts"

# ----------------------------------------------------------------------
# Step 3C.1 (qalead-la-40, est. 24 min): M1 --phase sim --provider all (394 rows; all 18 WE rows must PASS)
# ----------------------------------------------------------------------
COMPOSE_PROJECT_NAME=qalead-la-40 PUBLIC_PORT=$PUBLIC_PORT STACK_SUBNET=$STACK_SUBNET \
  node "$SRC_WAVE_2/tests/host/run-m1.mjs" \
  --phase sim \
  --provider all \
  --sha "$WAVE_SHA_2" \
  --test-sha "$WAVE_TEST_SHA_2" \
  --source "$SRC_WAVE_2" \
  > "$SLOT3C_DIR/logs/qalead-la-40-m1-sim.log" 2>&1
mv "$SRC_WAVE_2"/tests/host/artifacts/qalead-la-40-* "$SLOT3C_DIR/artifacts/"

# ----------------------------------------------------------------------
# Step 3C.2 (qalead-la-41, est. 3 min): M1 --phase snapshot-upgrade --provider all (6 rows incl. M1-41.common.j-snapshot)
# ----------------------------------------------------------------------
COMPOSE_PROJECT_NAME=qalead-la-41 PUBLIC_PORT=$PUBLIC_PORT STACK_SUBNET=$STACK_SUBNET \
  node "$SRC_WAVE_2/tests/host/run-m1.mjs" \
  --phase snapshot-upgrade \
  --provider all \
  --sha "$WAVE_SHA_2" \
  --test-sha "$WAVE_TEST_SHA_2" \
  --source "$SRC_WAVE_2" \
  > "$SLOT3C_DIR/logs/qalead-la-41-m1-snapshot-upgrade.log" 2>&1
mv "$SRC_WAVE_2"/tests/host/artifacts/qalead-la-41-* "$SLOT3C_DIR/artifacts/"

# ----------------------------------------------------------------------
# Step 3C.3 (qalead-la-42, est. 4 min): M2 Browser Suite (64 cases)
# ----------------------------------------------------------------------
COMPOSE_PROJECT_NAME=qalead-la-42 PUBLIC_PORT=$PUBLIC_PORT STACK_SUBNET=$STACK_SUBNET \
  COURSE_FIXTURES_DIR="$COURSE_FIXTURES_DIR" \
  node "$SRC_WAVE_2/tests/e2e/host/run-m2.mjs" \
  --sha "$WAVE_SHA_2" \
  --test-sha "$WAVE_TEST_SHA_2" \
  --source "$SRC_WAVE_2" \
  > "$SLOT3C_DIR/logs/qalead-la-42-m2.log" 2>&1
mv "$SRC_WAVE_2"/tests/host/artifacts/qalead-la-42-* "$SLOT3C_DIR/artifacts/"

# ----------------------------------------------------------------------
# Step 3C.4 (qalead-la-43, est. 4 min): Candidate Golden Capture G1-G4 + Compare (280 entries, 0 unexplained)
# ----------------------------------------------------------------------
COMPOSE_PROJECT_NAME=qalead-la-43 PUBLIC_PORT=$PUBLIC_PORT STACK_SUBNET=$STACK_SUBNET \
  node "$SRC_WAVE_2/tests/ltiaas/golden/run-golden.mjs" \
  --sha "$WAVE_SHA_2" \
  --source "$SRC_WAVE_2" \
  --workdir "$SLOT3C_DIR/qalead-la-43-golden" \
  --replace-tests --tests-from "$SRC_WAVE_2/tests" \
  --out "$SLOT3C_DIR/golden-capture-$WAVE_SHA_2" \
  > "$SLOT3C_DIR/logs/qalead-la-43-golden-capture.log" 2>&1

node "$SRC_WAVE_2/tests/ltiaas/golden/compare-golden.mjs" \
  --base "$SRC_WAVE_2/tests/ltiaas/golden/$INTAKE_SHA" \
  --candidate "$SLOT3C_DIR/golden-capture-$WAVE_SHA_2" \
  --expected "LA-IC-01,LA-IC-03,LA-IC-04,LA-IC-12,LA-IC-13,LA-IC-14,LA-IC-15,LA-IC-16,LA-IC-17,LA-IC-18,LA-IC-19,LA-IC-20,LA-IC-21" \
  --expected-dir "$SRC_WAVE_2/tests/ltiaas/golden/expected" \
  --json > "$SLOT3C_DIR/logs/qalead-la-43-golden-compare.json"
```

---

## 4. Slot 7: Intake `1b17261` (`G-BASE`) Baseline (`LA-E0-02`) + `LD-1` Parity (`LA-E0-04`) — DONE (`56038618`)

- **Target SHA:** `1b17261be97c4701b928fa9dc2fa74c6d23028f6` (`G-BASE`)
- **Pre-Staged Source Repo:** `/Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-slot7-1b17261` (`--test-sha 357d17997b4d36dbfb6bde7568a4d87c0e3a14fc`)
  - Holds `1b17261` + **only** the 8 `LD-1` open-world files (`f0a7b306`, `B-LD9-13`) and the `qalead-la-<n>` runner prefix guard.
  - Because `1b17261` has only the 3 baseline channels (`moodle`, `canvas`, `blackboard`) and 8 baseline profiles, a single run with `src-slot7-1b17261` (`--test-sha 357d17997b4d36dbfb6bde7568a4d87c0e3a14fc` / `--replace-tests --tests-from "$SRC_SLOT7/tests"`) simultaneously records the `LA-E0-02` baseline (`AC-LA-E0-02-01..06`) **and** proves `LA-E0-04` `LD-1` open-world parity on `G-BASE`.
- **Compose Projects (One LA Stack at a Time — Never Parallel):**
  - **Run 7A (SIM lane, `PUBLIC_PORT=9643`, `STACK_SUBNET=172.22.0.0/16`):** `qalead-la-16`, `qalead-la-17`, `qalead-la-18`, `qalead-la-19` (one stack at a time).
  - **Run 7B (Moodle 5.2 lane, `PUBLIC_PORT=9543`, `STACK_SUBNET=172.21.0.0/16`, started only after Run 7A is fully down):** `qalead-la-20` (`T7×3` core). Legacy `T1–T8` are not in this window.
- **Estimated Duration (Sequential, One Stack at a Time):**
  - **Run 7A (SIM lane):** **`42 minutes`** (`M1 sim` `15 min` + `M2` `15 min` + `M1 migration` & `snapshot-upgrade` `12 min`)
  - **Run 7B (Moodle 5.2 lane, after Run 7A is down):** **`38 minutes` (`T7×3`)**
  - **Combined Slot 7 Total:** **`80 minutes` sequential** (`42 min` Run 7A SIM, then `38 min` Run 7B Moodle `T7×3`).

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
node "/Users/quangnguyen/orca/workspaces/cogniate_moodle_integration_prototype/la-qa/tests/ltiaas/baseline/rate-peaks.mjs" \
  --logs "$M1_SIM_ART/service-logs" \
  --suite m1-sim > "$GATE_DIR/logs/slot7a-rate-peaks.json"
```

### Exact Commands for Slot 7 — Run 7B (Moodle 5.2 Lane on `1b17261`, Est. `38 min`, After Run 7A Is Fully Down; No Legacy `T1–T8`)

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
  --runs 3 \
  > "$GATE_DIR/logs/slot7b-1-t7x3.log" 2>&1

# 3. Stop stats sampler and compute rate-peaks (AC-LA-E0-02-04):
touch "$GATE_DIR/logs/stop-slot7b-stats"
wait "$STATS_7B_PID" 2>/dev/null || true

T7_ART=$(ls -td "$SRC_SLOT7/tests/e2e/artifacts/runs/qalead-la-20-"* | head -n1)
node "/Users/quangnguyen/orca/workspaces/cogniate_moodle_integration_prototype/la-qa/tests/ltiaas/baseline/rate-peaks.mjs" \
  --logs "$T7_ART/run1/service-logs" \
  --suite t7 > "$GATE_DIR/logs/slot7b-rate-peaks.json"
```

---

## 5. Slot 8: Wave-End `MOODLE-LIVE` Gate on `80133d6b` (Code `02f5d420`) with QA-E2E

- **Target SHA:** `80133d6b662dd4fb8e18a9eed62e3160d2b2a1c5` (product code `02f5d420`)
- **Pre-Staged Source Repo:** `/Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end` (`--test-sha 8ad1292687431b05bad6b5c070ab722e67714526` until the Lead names a new test SHA)
- **Compose Projects:** `qalead-la-30..36` (Lead QA) + QA-E2E project (`qa-e2e-la-*`)
- **Port / Subnet:** `PUBLIC_PORT=9543`, `STACK_SUBNET=172.21.0.0/16`
- **Scope Covered:**
  1. **`T7 × 1` (`qalead-la-30`, `12 min`, Lead QA):** `run-t7.mjs --runs 1 --no-demo` (`17` browser cases, including frozen isolation ACs **`AC-T7-08`** and **`AC-T7-09`**).
  2. **`R2-lite` Moodle Suites (`qalead-la-31..36`, `45 min`, Lead QA):**
     - `qalead-la-31` (`8 min`): `run-t2.mjs --tasks T2a,T2b,T3a,T3b` (covers frozen isolation AC **`AC-T2-18`** in `T2a/jwt-validation.test.ts` and Moodle Dynamic Registration `T3b`).
     - `qalead-la-32` (`5 min`): `run-t3c.mjs` (`T3c` compatibility & endpoints).
     - `qalead-la-33` (`10 min`): `run-t4b.mjs --tasks T4b1,T4b2` (covers frozen isolation ACs **`AC-T4-16`**, **`AC-T4-29`**, **`AC-T4-34`** in `T4b1/2-isolation.spec.ts`, `T4b1/3-security.spec.ts`, `T4b1/4-adoption.spec.ts`, plus `LA-IC-04` Moodle row 13 in `T4b1/1-connect.spec.ts:118`).
     - `qalead-la-34` (`12 min`): `run-t5.mjs --tasks T5a,T5b,T6` (covers `LA-IC-09` / `LD-6` `record_dispatch` P5 fixture in `T5b/4-conflict-resend.spec.ts` and `T6` portal Moodle flows).
     - `qalead-la-35` (`5 min`): `run-t8.mjs` (`T8` course shell export/publish).
     - `qalead-la-36` (`5 min`): `run-t4a.mjs` (`T4a` Deep Linking picker API/protocol checks for `LA-E3-05` `AC-LA-E3-05-11`).
  3. **`LA-E5-13` `AC-LA-E5-13-06` (`<1 min` log verification, Lead QA):** Confirms all 6 frozen isolation ACs (`AC-T2-18`, `AC-T4-16`, `AC-T4-29`, `AC-T4-34`, `AC-T7-08`, `AC-T7-09`) passed in steps 1–2 (`AC-LA-E5-13-01..05` `K1-SIM` already passed on `qalead-la-8..9`).
  4. **QA-E2E's Part (`20 min`, QA-E2E):** `LA-E7-09` live Moodle `K2` (`U1`/`U2` continuity + `LA-E3-05` `AC-LA-E3-05-04, -11` Moodle picker Cancel Playwright check + `LA-E4-03` `AC-LA-E4-03-09` browser part).
- **Estimated Duration:** **`57 minutes` (Lead QA, `qalead-la-30..36`)** + **`20 minutes` (QA-E2E, `qa-e2e-la-*`)** = **`77 minutes` total**.

### Complete Mapping of All Pending Task Rows into Slot 3B (Done) and Slot 8 (`MOODLE-LIVE`)

| Task | Pending Row(s) in `docs/reviews/LA-*/qa.md` | Covering Slot & Compose Project(s) | Owner | Minutes (Shared in Suite Budget) | How Covered |
| --- | --- | --- | --- | --- | --- |
| **`LA-E1-05`** | `AC-LA-E1-05-10` (`R2-lite` `MOODLE-LIVE`: `T7 × 1` and `T2a, T2b, T3a, T3b, T3c`) | **Slot 8** (`qalead-la-30`, `qalead-la-31`, `qalead-la-32`) | **Lead QA** | `25 min` (`12m` `T7×1` + `8m` `T2/T3ab` + `5m` `T3c`, shared) | `run-t7.mjs --runs 1 --no-demo`, `run-t2.mjs --tasks T2a,T2b,T3a,T3b`, `run-t3c.mjs` on `80133d6b`. |
| **`LA-E1-07`** | `AC-LA-E1-07-07` (`R1` SIM) & `AC-LA-E1-07-08` (`R2-lite` `MOODLE-LIVE`: `T7 × 1`, `T4b1`, `T4b2`) | `AC-07`: **Slot 3B (DONE)** (`qalead-la-10, 14, 15`); `AC-08`: **Slot 8** (`qalead-la-30`, `qalead-la-33`) + QA-E2E Slot 6 (`R2-sim` DONE) | **Lead QA** | `22 min` in Slot 8 (`12m` `T7×1` + `10m` `T4b`, shared) | `AC-07` completed in Slot 3B (`G1–G4` + `M1 sim` + `M2` `64/64`). `AC-08` live Moodle covered by `qalead-la-30` (`T7×1`) and `qalead-la-33` (`T4b1, T4b2`). |
| **`LA-E1-08`** | `AC-LA-E1-08-01` (golden `G1`–`G4`), `AC-LA-E1-08-07` (`R1` `M1 sim` + `M2`), `AC-LA-E1-08-08` (`R2-lite` `MOODLE-LIVE`: `T7 × 1` + `T8`) | `AC-01, -07`: **Slot 3B (DONE)** (`qalead-la-10, 14, 15`); `AC-08`: **Slot 8** (`qalead-la-30`, `qalead-la-35`) | **Lead QA** | `17 min` in Slot 8 (`12m` `T7×1` + `5m` `T8`, shared) | `AC-01` (`G1–G4` compare `280/280`) and `AC-07` (`M1 sim` + `M2` `64/64`) completed in Slot 3B. `AC-08` live Moodle covered by `qalead-la-30` (`T7×1`) and `qalead-la-35` (`T8`). |
| **`LA-E1-09`** | `AC-LA-E1-09-05` (`R2-lite` `MOODLE-LIVE`: `T7 × 1`, `T4b2`, `T5a`, `T6`) | **Slot 8** (`qalead-la-30`, `qalead-la-33`, `qalead-la-34`) + QA-E2E Slot 6 (`R2-sim` DONE) | **Lead QA** | `34 min` (`12m` `T7×1` + `10m` `T4b` + `12m` `T5/T6`, shared) | `run-t7.mjs`, `run-t4b.mjs --tasks T4b1,T4b2`, `run-t5.mjs --tasks T5a,T5b,T6` on `80133d6b`. |
| **`LA-E1-10`** | `AC-LA-E1-10-06` (`R2-lite` `MOODLE-LIVE`) | **Slot 8** (`qalead-la-30`, `qalead-la-31`, `qalead-la-32`) | **Lead QA** | `25 min` (`12m` `T7×1` + `8m` `T2/T3ab` + `5m` `T3c`, shared) | `run-t7.mjs`, `run-t2.mjs --tasks T2a,T2b,T3a,T3b`, `run-t3c.mjs` on `80133d6b`. |
| **`LA-E2-01`** | `AC-LA-E2-01-10` (`R2-lite` `MOODLE-LIVE`: `T7 × 1` + LTI service group) | **Slot 8** (`qalead-la-30`, `qalead-la-31`, `qalead-la-32`) | **Lead QA** | `25 min` (`12m` `T7×1` + `8m` `T2/T3ab` + `5m` `T3c`, shared) | `run-t7.mjs`, `run-t2.mjs --tasks T2a,T2b,T3a,T3b`, `run-t3c.mjs` on `80133d6b`. |
| **`LA-E2-02`** | `AC-LA-E2-02-08` (`MOODLE-LIVE`: `T3b` and `T7 × 1`) | **Slot 8** (`qalead-la-30`, `qalead-la-31`) | **Lead QA** | `20 min` (`12m` `T7×1` + `8m` `T2/T3ab`, shared) | `run-t7.mjs` and `run-t2.mjs --tasks T2a,T2b,T3a,T3b` (`T3b` live Moodle Dynamic Registration) on `80133d6b`. |
| **`LA-E3-05`** | `AC-LA-E3-05-04` (Moodle picker Cancel button & return) & `AC-LA-E3-05-11` (`R2-lite`: `T4a` and picker Playwright case) | **Slot 8**: `T4a` on `qalead-la-36` (**Lead QA**) + Moodle picker Playwright check on `qa-e2e-la-*` (**QA-E2E**) | **Lead QA** (`5 min`) + **QA-E2E** (within `20 min` K2 share) | `5 min` Lead QA (`qalead-la-36` `run-t4a.mjs`) + QA-E2E `20 min` share | Lead QA runs `run-t4a.mjs` (`qalead-la-36`); QA-E2E runs the live Moodle picker Cancel Playwright check in its `20 min` Slot 8 K2 window. |
| **`LA-E3-07`** | `AC-LA-E3-07-03` (`MOODLE-LIVE` part: Moodle tool-configuration row 13 `"Do not use this service"` and live Moodle DR 4 scopes) | **Slot 8** (`qalead-la-31`, `qalead-la-33`) | **Lead QA** | `18 min` (`8m` `T2/T3ab` + `10m` `T4b`, shared) | `run-t4b.mjs --tasks T4b1,T4b2` (`tests/acceptance/T4b1/1-connect.spec.ts:118` asserts Moodle row 13 `"Do not use this service"` under `LA-IC-04`) and `run-t2.mjs` (`T3b` live Moodle DR). |
| **`LA-E4-02`** | `AC-LA-E4-02-06, -07, -09` (`K1-SIM` `U1`, `M1 migration/snapshot-upgrade`, `R1`) & `AC-LA-E4-02-10` (`R2-lite` `MOODLE-LIVE`) | `AC-06, -07, -09`: **Slot 3B (DONE)** (`qalead-la-11..15`); `AC-10`: **Slot 8** (`qalead-la-30`, `qalead-la-34`) + QA-E2E Slot 6 (`R2-sim` DONE) | **Lead QA** | `24 min` in Slot 8 (`12m` `T7×1` + `12m` `T5/T6`, shared) | `AC-06, -07, -09` completed in Slot 3B. `AC-10` live Moodle covered by `qalead-la-30` (`T7×1`) and `qalead-la-34` (`T5a, T5b, T6`). |
| **`LA-E4-03`** | `AC-LA-E4-03-09` (`MOODLE-LIVE`: `T5a`, `T5b`, `T7 × 1` + QA-E2E Moodle K2) | **Slot 8**: `qalead-la-30`, `qalead-la-34` (**Lead QA**) + `qa-e2e-la-*` (**QA-E2E**) | **Lead QA** (`24 min` shared) + **QA-E2E** (within `20 min` K2 share) | `24 min` Lead QA (`12m` `T7×1` + `12m` `T5/T6`, shared) + QA-E2E `20 min` share | Lead QA runs `run-t7.mjs` (`qalead-la-30`) and `run-t5.mjs --tasks T5a,T5b,T6` (`qalead-la-34`, including `T5b/4-conflict-resend.spec.ts` with `LA-IC-09` `record_dispatch` P5 fixture); QA-E2E runs `LA-E7-09` Moodle K2. |
| **`LA-E5-22`** | `AC-LA-E5-22-06` (`MOODLE-LIVE` / `A-LAB-09`: live Moodle lane with app key provider `"cgk1"` sealed values and `U1`/`U2` continuity) | **Slot 8**: `qalead-la-30..36` (**Lead QA**) + `qa-e2e-la-*` (**QA-E2E** Moodle `U1`/`U2` continuity) | **Lead QA** (`57 min` shared) + **QA-E2E** (within `20 min` K2 share) | Shared across Lead QA `57 min` + QA-E2E `20 min` | Live Moodle stack in `qalead-la-30..36` seals and unseals `connection.ws_token_encrypted`, `connection.ref_token_encrypted`, `resource_link.service_key_encrypted`, and `picker_session.ltik_encrypted` with `"cgk1"` AAD binding; QA-E2E runs live Moodle `U1`/`U2` continuity in its `20 min` Slot 8 share. |
| **`LA-E5-13`** | `AC-LA-E5-13-06` (`MOODLE-LIVE`: 6 frozen isolation ACs `AC-T2-18`, `AC-T4-16`, `AC-T4-29`, `AC-T4-34`, `AC-T7-08`, `AC-T7-09`) | **Slot 8** (`qalead-la-30`, `qalead-la-31`, `qalead-la-33`) | **Lead QA** | `30 min` (`12m` `T7×1` + `8m` `T2/T3ab` + `10m` `T4b`, shared) | Verified in `slot8-1-t7x1.log`, `slot8-2-t2-t3ab.log`, and `slot8-4-t4b.log` (`Step 8.8` grep below). |

### Exact Commands for Slot 8 (Lead QA Part, Est. `57 min`)

```bash
umask 077
export GATE_DIR="/Users/quangnguyen/cogniate-qa-runs/LA/GATE"
export SRC_WAVE="$GATE_DIR/src-wave-end"
export COURSE_FIXTURES_DIR="$GATE_DIR/course-fixtures"
export WAVE_SHA="80133d6b662dd4fb8e18a9eed62e3160d2b2a1c5"
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
# Step 8.2 (qalead-la-31, est. 8 min): T2a, T2b, T3a, T3b (covers AC-T2-18, LA-E2-02 AC-08)
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
# Step 8.4 (qalead-la-33, est. 10 min): T4b1, T4b2 (covers AC-T4-16, AC-T4-29, AC-T4-34, and LA-IC-04 / LA-E3-07 AC-03 row 13)
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
# Step 8.5 (qalead-la-34, est. 12 min): T5a, T5b, T6 (covers LA-IC-09 record_dispatch P5 fixture, LA-E4-02 AC-10, LA-E4-03 AC-09)
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
# Step 8.6 (qalead-la-35, est. 5 min): T8 (covers LA-E1-08 AC-08 Moodle-only features)
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
# Step 8.7 (qalead-la-36, est. 5 min): T4a (covers LA-E3-05 AC-LA-E3-05-11 Deep Linking API/picker part)
# ----------------------------------------------------------------------
COMPOSE_PROJECT_NAME=qalead-la-36 PUBLIC_PORT=$PUBLIC_PORT STACK_SUBNET=$STACK_SUBNET \
  node "$SRC_WAVE/tests/host/run-t4a.mjs" \
  --sha "$WAVE_SHA" \
  --source "$SRC_WAVE" \
  --workdir "$GATE_DIR/qalead-la-36-t4a" \
  --replace-tests --tests-from "$SRC_WAVE/tests" \
  > "$GATE_DIR/logs/slot8-7-t4a.log" 2>&1

# ----------------------------------------------------------------------
# Step 8.8: Verify all 6 frozen isolation ACs for AC-LA-E5-13-06 + teardown check (<1 min)
# ----------------------------------------------------------------------
grep -E "AC-T7-08|AC-T7-09" "$GATE_DIR/logs/slot8-1-t7x1.log"
grep -E "AC-T2-18" "$GATE_DIR/logs/slot8-2-t2-t3ab.log"
grep -E "AC-T4-16|AC-T4-29|AC-T4-34" "$GATE_DIR/logs/slot8-4-t4b.log"
docker ps -a --filter "name=qalead-la-"
docker volume ls --filter "name=qalead-la-"
docker network ls --filter "name=qalead-la-"
```
