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
| **Slot 3C** | Lead QA | Wave-end SIM re-gate (`LA-E7-08`) on `8fadb828` in `src-wave-end-3` (`--test-sha e46bb27c`): `M1 sim` (`393/394 PASS`, `1 FAIL` `WE-F6` `M1-08.canvas.login-redirect`), `M1 snapshot-upgrade` (`6/6 PASS` incl. `M1-41.common.j-snapshot`), `M2` (`64/64 PASS`), `G1–G4` golden capture & compare (`280/280` explained) | `qalead-la-40..43` | `9473` / `172.23.0.0/16` | **`31.8 min` actual** (`21:00Z–21:32Z`) | **DONE (`FAIL` — `WE-F6`, `docs/reviews/LA-E7-08/qa.md` §6)** |
| **Slot 8** | Lead QA + QA-E2E | Wave-end `MOODLE-LIVE` gate on `8fadb828` in `src-wave-end-3`: `T7×1` + `R2-lite` (`T2a..T8`, including `T4a`) + 6 frozen isolation ACs + `AC-LA-E5-13-06` + all 12 task `MOODLE-LIVE` rows (`WE-F7..F10`) | `qalead-la-30..36` | `9543` / `172.21.0.0/16` | **`54.4 min` Lead QA** (`21:37Z–22:31Z`) | **Lead QA DONE (`docs/reviews/LA-E7-08/qa.md` §7)** |
| **Slot 3D** | Lead QA | (1) `M1 --phase sim --provider all` (`394` rows) on `8fadb828` (`qalead-la-44`, `--test-sha 6ce8ffaf`, `src-wave-end-4`); (2) `WE-F10` `T5b` baseline on `1b17261` (`src-slot7-1b17261`, `357d1799`) × 2 (`qalead-la-45..46`) + `T6` baseline (`qalead-la-48`) + `T8` baseline (`qalead-la-49`); (3) wave-end `T5b` × 1 (`qalead-la-47`, `src-wave-end-4`) | `qalead-la-44..49` | `9473` / `172.23.0.0/16` (44) then `9543` / `172.21.0.0/16` (45..49) | **`100 min` window** | **READY (`src-wave-end-4` built at `6ce8ffaf`, waiting for `"GO slot 3D"`)** |

> [!IMPORTANT]
> **Never reuse compose project numbers.** `qalead-la-1..3` (Slots 2 & 3A), `qalead-la-8..9` (`LA-E5-13` SIM), `qalead-la-10..15` (Slot 3B), `qalead-la-16..20` (Slot 7), `qalead-la-30..36` (Slot 8), and `qalead-la-40..43` (Slot 3C) have already been used. **Slot 3D** exclusively uses **`qalead-la-44..49`**.

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
    5. **1 `M1-41.common.j-snapshot` migration-ledger assertion file (`BD-A2-108` / `LD-24` / `WE-F5`; `A-LA-E0-04-02` fixed in `docs/reviews/LA-E7-08/ld9-addendum-r5.md`):** `tests/host/m1-migration.mjs:331-341` (calls `checkMigrationLedgers(oldLedger, newLedger, { expectedLtiLedger, expectedAppLedger })`: verifies that `oldLedger` is a non-empty prefix of `newLedger`, `'012_connection_provider_snapshot.sql'` is present in `cogniate-app/cogniate.db`, and `newLedger` equals the candidate's sorted migration files).
    6. **10 runner-only changes (`0` frozen assertion changes):** `tests/acceptance/run-api.mjs` (LA task Vitest config routing), and `tests/host/{core,m1-control,storage-docker,storage-handoff,run-t1,run-t5,p5-fixture,host-control}.mjs` + `tests/e2e/host/run-t7.mjs` (`qalead-la-<n>` project prefix regex).
    7. **13 additive `K2` browser suite files:** `tests/e2e/ltiaas/**` (`LA-E7-07`, `LA-E7-09`).
    8. **13 additive simulator files:** `tests/sim/**` (`LA-E7-01`, `LA-E7-02`, `LA-E7-05`).
- **`AC-LA-E7-08-06` (`PASS`, `K0`):**
  - `git -C "$SRC_WAVE" diff --stat 1b17261be97c4701b928fa9dc2fa74c6d23028f6..80133d6b662dd4fb8e18a9eed62e3160d2b2a1c5 -- infra/scripts/stack-data.sh infra/scripts/stack-data.mjs infra/scripts/storage-compat.sh infra/compat/` produces **empty output (`0` files changed, exit `0`)**.

---

## 3C. Slot 3C: Wave-End SIM-Lane Re-Gate (`LA-E7-08`) on New Candidate SHA (`$WAVE_SHA_3` = `8fadb828`)

- **Target Candidate SHA (`$WAVE_SHA_3`):** `8fadb828088ffe1b4db02179ab0fa3ab2388a12a` (`8fadb828`, `Merge la-s1 a2c99731: LA-E5-19 WE-F4 round 1 (A-LA-E5-19-04: a failed listener close exits 1)`; Lead full check green with caches deleted: `3315` unit, `255` infra, `145` `K0`, `F1 0`, `F5 6`). Includes `BD-A2-109` (`WE-F4` stop-order and error-path fixes from lanes **R** and **S1**), `BD-A2-108` (`ecc19bbc`: `lti-service` `admin` default `1200/min`, burst `600`), and `BD-A2-106` (`60230165`: hosted Canvas wizard help sentence).
- **New Gate Source Repo:** `/Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end-3` (never editing `/Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end` at `8ad1292687431b05bad6b5c070ab722e67714526` or superseded `/Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end-2` at `bf8153404449dbfef47698ceb82fa0262e9d9c48`, both kept for the record).
- **Recorded Gate Source SHAs:**
  - **`$WAVE_SHA_3` (Product Base):** `8fadb828088ffe1b4db02179ab0fa3ab2388a12a` (`tag: la-wave-end-product-3`)
  - **`$BASE_OVERLAY_SHA_3` (Commit 1 — Exact `8ad12926` `tests/` Tree Restored on `8fadb828`, DONE):** `e00b9651e29d835e1980732ba7037273f641ac7a` (`tag: la-gate-test-base-c1-3`, `tests/` git tree `f42d4150b7b11ba2b2e63898ee317e6dea3f9430` identical to `8ad12926:tests`, `0` non-test diff from `8fadb828`)
  - **`$WAVE_TEST_SHA_3` (Commit 2 — Approved LD-9 Addendum Round 2 on `e00b9651`, DONE):** `e46bb27c9487d332f40fcefd4dd880304d1d31f1` (`tag: la-gate-test-3`, `tag: la-gate-test-addendum-r2`, `3 files changed, 3 insertions(+), 3 deletions(-)` over `e00b9651`, `0` non-test diff from `8fadb828`)
- **Compose Projects:** `qalead-la-40`, `qalead-la-41`, `qalead-la-42`, `qalead-la-43` (`qalead-la-30..36` stay reserved for Slot 8).
- **Port / Subnet:** `PUBLIC_PORT=9473`, `STACK_SUBNET=172.23.0.0/16` (one LA stack at a time).
- **Estimated Duration:** **`35 minutes` total** (`24m` `qalead-la-40` `M1 sim` + `3m` `qalead-la-41` `M1 snapshot-upgrade` + `4m` `qalead-la-42` `M2` + `4m` `qalead-la-43` `G1–G4` golden capture & compare).

### (a) How `src-wave-end-3` Is Built (Two Explicit Commits on Top of `$WAVE_SHA_3` — Never an Amend; Fail-Fast with `set -euo pipefail` and Separate SHA Assignment/Export)

Both Commit 1 (`$BASE_OVERLAY_SHA_3` = `e00b9651e29d835e1980732ba7037273f641ac7a`) and Commit 2 (`$WAVE_TEST_SHA_3` = `e46bb27c9487d332f40fcefd4dd880304d1d31f1`) are built and verified on the host (`0` Docker) under `set -euo pipefail`, using `git restore --source=8ad1292687431b05bad6b5c070ab722e67714526 --staged --worktree -- tests` (`A-LA-E7-08-03`) and assigning each SHA to a variable before `export` (`A-LA-E7-08-04`):

```bash
set -euo pipefail
umask 077
export GATE_DIR="/Users/quangnguyen/cogniate-qa-runs/LA/GATE"
export INTEG_REPO="/Users/quangnguyen/orca/workspaces/cogniate_moodle_integration_prototype/ltiaas-milestone"
export SRC_WAVE="$GATE_DIR/src-wave-end"
export SRC_WAVE_3="$GATE_DIR/src-wave-end-3"

WAVE_SHA_3=$(git -C "$INTEG_REPO" rev-parse --verify '8fadb828^{commit}')
export WAVE_SHA_3

# 1. Fresh clone --no-hardlinks at $WAVE_SHA_3 (DONE):
git clone --quiet --no-hardlinks "$INTEG_REPO" "$SRC_WAVE_3"
git -C "$SRC_WAVE_3" checkout --quiet --detach "$WAVE_SHA_3"
git -C "$SRC_WAVE_3" tag la-wave-end-product-3 "$WAVE_SHA_3"

# 2. Commit 1 (DONE): Restore the exact 8ad12926 test tree and prove 0 diff on tests/ and 0 non-test diff from $WAVE_SHA_3 (A-LA-E7-08-03):
git -C "$SRC_WAVE_3" fetch --quiet "$SRC_WAVE" 8ad1292687431b05bad6b5c070ab722e67714526
git -C "$SRC_WAVE_3" restore --source=8ad1292687431b05bad6b5c070ab722e67714526 --staged --worktree -- tests
git -C "$SRC_WAVE_3" diff --exit-code 8ad1292687431b05bad6b5c070ab722e67714526 -- tests
git -C "$SRC_WAVE_3" diff --cached --exit-code 8ad1292687431b05bad6b5c070ab722e67714526 -- tests
git -C "$SRC_WAVE_3" diff --exit-code "$WAVE_SHA_3" -- . ':!tests'
git -C "$SRC_WAVE_3" diff --cached --exit-code "$WAVE_SHA_3" -- . ':!tests'
git -C "$SRC_WAVE_3" commit -m "QA gate test overlay: 8ad12926 base on $WAVE_SHA_3"

TESTS_TREE_SHA=$(git -C "$SRC_WAVE_3" rev-parse --verify HEAD:tests)
export TESTS_TREE_SHA
test "$TESTS_TREE_SHA" = "f42d4150b7b11ba2b2e63898ee317e6dea3f9430"
git -C "$SRC_WAVE_3" diff --exit-code 8ad1292687431b05bad6b5c070ab722e67714526 -- tests
git -C "$SRC_WAVE_3" diff --exit-code "$WAVE_SHA_3" HEAD -- . ':!tests'

BASE_OVERLAY_SHA_3=$(git -C "$SRC_WAVE_3" rev-parse --verify 'HEAD^{commit}')
export BASE_OVERLAY_SHA_3
# BASE_OVERLAY_SHA_3=e00b9651e29d835e1980732ba7037273f641ac7a
git -C "$SRC_WAVE_3" tag la-gate-test-base-c1-3 "$BASE_OVERLAY_SHA_3"

# 3. Commit 2 (DONE): Apply the approved 3-file LD-9 Addendum Round 2 patch as a second commit (NEVER git commit --amend):
python3 - << 'EOF' > "$GATE_DIR/addendum-r2.patch"
import re
doc = open("/Users/quangnguyen/orca/workspaces/cogniate_moodle_integration_prototype/la-qa/docs/reviews/LA-E7-08/ld9-addendum-r1.md").read()
r2 = doc.split("## Round 2", 1)[1]
blocks = re.findall(r"```diff\n(.*?\n)```", r2, flags=re.S)
assert len(blocks) == 4
print(blocks[3], end="")
EOF
git -C "$SRC_WAVE_3" apply --check -v "$GATE_DIR/addendum-r2.patch"
git -C "$SRC_WAVE_3" apply --index "$GATE_DIR/addendum-r2.patch"
git -C "$SRC_WAVE_3" commit -m "QA gate test addendum r2: LA-IC-14 ref regex, LA-IC-22 99-logs, m1-migration path"

WAVE_TEST_SHA_3=$(git -C "$SRC_WAVE_3" rev-parse --verify 'HEAD^{commit}')
export WAVE_TEST_SHA_3
# WAVE_TEST_SHA_3=e46bb27c9487d332f40fcefd4dd880304d1d31f1
git -C "$SRC_WAVE_3" tag la-gate-test-3 "$WAVE_TEST_SHA_3"
git -C "$SRC_WAVE_3" tag la-gate-test-addendum-r2 "$WAVE_TEST_SHA_3"

# 4. Verify SHAs, clean status, Commit 1 -> Commit 2 diff, and K0 diff stat (AC-LA-E7-08-05 & AC-LA-E7-08-06):
echo "WAVE_SHA_3=$WAVE_SHA_3"
echo "BASE_OVERLAY_SHA_3=$BASE_OVERLAY_SHA_3"
echo "WAVE_TEST_SHA_3=$WAVE_TEST_SHA_3"
git -C "$SRC_WAVE_3" status --short
git -C "$SRC_WAVE_3" diff --stat "$BASE_OVERLAY_SHA_3" "$WAVE_TEST_SHA_3"
git -C "$SRC_WAVE_3" diff --exit-code "$WAVE_SHA_3" "$WAVE_TEST_SHA_3" -- . ':!tests'
git -C "$SRC_WAVE_3" diff --stat 1b17261be97c4701b928fa9dc2fa74c6d23028f6.."$WAVE_SHA_3" -- \
  infra/scripts/stack-data.sh infra/scripts/stack-data.mjs infra/scripts/storage-compat.sh infra/compat/
```

#### Step (a) Recorded Verification Output for `src-wave-end-3` (`$WAVE_SHA_3` = `8fadb828088ffe1b4db02179ab0fa3ab2388a12a` → `$BASE_OVERLAY_SHA_3` = `e00b9651e29d835e1980732ba7037273f641ac7a` → `$WAVE_TEST_SHA_3` = `e46bb27c9487d332f40fcefd4dd880304d1d31f1`)

- **Commit History, Exact `tests/` Tree Match at Commit 1, and Exact 3-File Addendum Diff at Commit 2 (`A-LA-E7-08-03` & `A-LA-E7-08-04` closed):**
  ```text
  $ git -C "$SRC_WAVE_3" log -n 3 --oneline --decorate
  e46bb27c (HEAD, tag: la-gate-test-addendum-r2, tag: la-gate-test-3) QA gate test addendum r2: LA-IC-14 ref regex, LA-IC-22 99-logs, m1-migration path
  e00b9651 (tag: la-gate-test-base-c1-3) QA gate test overlay: 8ad12926 base on 8fadb828088ffe1b4db02179ab0fa3ab2388a12a
  8fadb828 (tag: la-wave-end-product-3) Merge la-s1 a2c99731: LA-E5-19 WE-F4 round 1 (A-LA-E5-19-04: a failed listener close exits 1)

  $ git -C "$SRC_WAVE" rev-parse 8ad1292687431b05bad6b5c070ab722e67714526:tests
  f42d4150b7b11ba2b2e63898ee317e6dea3f9430
  $ git -C "$SRC_WAVE_3" rev-parse e00b9651e29d835e1980732ba7037273f641ac7a:tests
  f42d4150b7b11ba2b2e63898ee317e6dea3f9430

  $ git -C "$SRC_WAVE_3" diff --exit-code 8ad1292687431b05bad6b5c070ab722e67714526 e00b9651e29d835e1980732ba7037273f641ac7a -- tests
  (empty output, exit code 0)

  $ git -C "$SRC_WAVE_3" diff --exit-code 8fadb828088ffe1b4db02179ab0fa3ab2388a12a e46bb27c9487d332f40fcefd4dd880304d1d31f1 -- . ':!tests'
  (empty output, exit code 0)

  $ git -C "$SRC_WAVE_3" diff --stat e00b9651e29d835e1980732ba7037273f641ac7a e46bb27c9487d332f40fcefd4dd880304d1d31f1
   tests/acceptance/M1/canvas/11-canvas-platforms.test.ts | 2 +-
   tests/acceptance/M1/common/99-logs.test.ts             | 2 +-
   tests/host/m1-migration.mjs                            | 2 +-
   3 files changed, 3 insertions(+), 3 deletions(-)
  ```
- **Pre-Verified `AC-LA-E7-08-06` and Migration Diff on `8fadb828088ffe1b4db02179ab0fa3ab2388a12a`:**
  - `git -C "$SRC_WAVE_3" diff --stat 1b17261be97c4701b928fa9dc2fa74c6d23028f6..8fadb828088ffe1b4db02179ab0fa3ab2388a12a -- infra/scripts/stack-data.sh infra/scripts/stack-data.mjs infra/scripts/storage-compat.sh infra/compat/` → **empty (`0` files changed, exit `0`)**.
  - `git -C "$SRC_WAVE_3" diff --stat 80133d6b662dd4fb8e18a9eed62e3160d2b2a1c5..8fadb828088ffe1b4db02179ab0fa3ab2388a12a -- services/lti-service/src/db/migrations services/cogniate-app/src/domain/migrations` → **empty (`0` files changed, exit `0`)**.

### (b) Slot 3C Run Set & Reason for Each Suite (Including Why `U1` and `M1 migration` Are Not Rerun)

| Compose Project | Suite | Est. Minutes | Reason & Required Outcome |
| --- | --- | --- | --- |
| **`qalead-la-40`** | `M1 --phase sim --provider all` (`394` manifest rows) | **`24 min`** | Closes `AC-LA-E7-08-01` and proves all **`18` Slot 3B non-PASS rows now `PASS`** (`394/394` manifest rows `PASS`, `0` missing, `0` `ERROR` rows):<br>• **9 `WE-F1` rows** (`M1-13.blackboard.inactive`, `M1-25.blackboard.site-metadata`, `M1-14.blackboard.claims`, `M1-36.blackboard.{origin,path,query,encoded-dot,encoded-slash}`, `M1-08.canvas.login-redirect`) after the S1 `admin` default rate-limit fix (`1200/min`, burst `600`, `BD-A2-108` / `ecc19bbc`);<br>• **7 `WE-F4` rows** (`M1-37.blackboard.{d,o,v5}`, `M1-37.canvas.{d,s-dead,v4,v6}`) after the lanes R + S1 stop-order & error-path fixes (`BD-A2-109`: listeners stop at once, HTTP cut after `3 s`, runner drain only, failed listener close exits `1`), with `m1-restart cogniate-app` wall times recorded from `host-actions/*.json`;<br>• **1 `WE-F3` row** (`M1-15.canvas.dynamic-refused`) with Addendum Hunk 1 (`LA-IC-14` required `?ref=` 43-char regex);<br>• **1 `WE-F2` row** (`M1-24.common.event-shapes`) with Addendum Hunk 3 (`LA-IC-22` `launch_claims_minimized` `tool_account_id`). |
| **`qalead-la-41`** | `M1 --phase snapshot-upgrade --provider all` (`6` manifest rows) | **`3 min`** | Closes `AC-LA-E7-08-04` and **`WE-F5`** (Addendum Hunk 2: `services/lti-service/src/db/migrations` in `tests/host/m1-migration.mjs:332`), proving all **`6/6` manifest rows `PASS`** (`M1-38.common.h1..h5` plus host qualification row **`M1-41.common.j-snapshot`** in `m1-case-results.json`, `0` `ERROR` rows in `summary.json`, and exact 21-file candidate migration ledger equality). |
| **`qalead-la-42`** | `M2` browser suite (`64` manifest cases) | **`4 min`** | Closes `AC-LA-E7-08-01` (`64/64` `M2` cases `PASS`) on `$WAVE_SHA_3` (`8fadb828088ffe1b4db02179ab0fa3ab2388a12a`) because `cogniate-app` and the portal UI changed after `80133d6b`: specifically `LA-E3-16` hosted Canvas wizard help sentence (`BD-A2-106`, merged in `60230165`, touching the Canvas wizard tested by `M2-02`) and the `BD-A2-109` stop-order changes in `cogniate-app` and `lti-service`. |
| **`qalead-la-43`** | Candidate golden capture `G1–G4` & host compare (`280` expected entries across `LA-IC-01..21`) | **`4 min`** | Closes `AC-LA-E7-08-03` (`LA-E0-03` golden comparison) on `$WAVE_SHA_3` (`8fadb828088ffe1b4db02179ab0fa3ab2388a12a`) because product code changed after `80133d6b` in three places: (1) `lti-service` `admin` default rate limit `1200/min`, burst `600` (`BD-A2-108`, `ecc19bbc`), (2) hosted Canvas wizard help text (`BD-A2-106`, `60230165`), and (3) `cogniate-app` + `lti-service` stop order (`BD-A2-109`). Confirms `280/280` explained golden entries, `0` unexplained differences, and `0` missing expected changes on `$WAVE_SHA_3`. |
| **Not Rerun in Slot 3C** | `M1 --phase migration` (`qalead-la-11`) and `U1` SIM (`LA-E5-08` `qalead-la-13`, `LA-E5-22` `qalead-la-13b`) | **`0 min` (carried from Slot 3B on `80133d6b`)** | **Why `M1 migration` and `U1` do not need to run again:**<br>1. **No new SQL migration or schema change after `80133d6b`:** `git diff --stat 80133d6b662dd4fb8e18a9eed62e3160d2b2a1c5..8fadb828088ffe1b4db02179ab0fa3ab2388a12a -- services/lti-service/src/db/migrations services/cogniate-app/src/domain/migrations` is **empty (`0` files changed)**; the migration ledgers remain `001_init.sql`..`021_registration_token_kind.sql` (`21` files in `lti-service`) and `001_init.sql`..`016_binding_authority.sql` (`16` files in `cogniate-app`).<br>2. **No change to `stack-data`, backup/restore, or `U1` key-sealing/backfill code after `80133d6b`:** None of `BD-A2-108` (`ecc19bbc`), `BD-A2-106` (`60230165`), or `BD-A2-109` touches migration SQL, backfill logic, key-provider sealing (`ltik1` / `cgk1`), or backup/restore scripts.<br>3. **Already proven 100% `PASS` in Slot 3B (`docs/reviews/LA-E7-08/qa.md` §5.1 items 2, 4a, 4b):** `qalead-la-11` passed `12/12` `migration` manifest rows in `m1-case-results.json`, `qalead-la-13` passed `19/19` LTI `U1` assertions, and `qalead-la-13b` passed `18/18` app `U1` assertions. |

### (c) Exact Commands for Slot 3C (`qalead-la-40..43`, `PUBLIC_PORT=9473`, `STACK_SUBNET=172.23.0.0/16`, Est. `35 min` Sequential)

```bash
set -euo pipefail
umask 077
export GATE_DIR="/Users/quangnguyen/cogniate-qa-runs/LA/GATE"
export SLOT3C_DIR="/Users/quangnguyen/cogniate-qa-runs/LA/SLOT3C"
export SRC_WAVE_3="$GATE_DIR/src-wave-end-3"
export COURSE_FIXTURES_DIR="$GATE_DIR/course-fixtures"
WAVE_SHA_3=$(git -C "$SRC_WAVE_3" rev-parse --verify 'la-wave-end-product-3^{commit}')
export WAVE_SHA_3
BASE_OVERLAY_SHA_3=$(git -C "$SRC_WAVE_3" rev-parse --verify 'la-gate-test-base-c1-3^{commit}')
export BASE_OVERLAY_SHA_3
WAVE_TEST_SHA_3=$(git -C "$SRC_WAVE_3" rev-parse --verify 'la-gate-test-3^{commit}')
export WAVE_TEST_SHA_3
export INTAKE_SHA="1b17261be97c4701b928fa9dc2fa74c6d23028f6"
export PUBLIC_PORT=9473
export STACK_SUBNET="172.23.0.0/16"

mkdir -p "$SLOT3C_DIR/logs" "$SLOT3C_DIR/docker-records" "$SLOT3C_DIR/artifacts"

# ----------------------------------------------------------------------
# Step 3C.1 (qalead-la-40, est. 24 min): M1 --phase sim --provider all (394 rows; all 18 WE rows must PASS)
# ----------------------------------------------------------------------
COMPOSE_PROJECT_NAME=qalead-la-40 PUBLIC_PORT=$PUBLIC_PORT STACK_SUBNET=$STACK_SUBNET \
  node "$SRC_WAVE_3/tests/host/run-m1.mjs" \
  --phase sim \
  --provider all \
  --sha "$WAVE_SHA_3" \
  --test-sha "$WAVE_TEST_SHA_3" \
  --source "$SRC_WAVE_3" \
  > "$SLOT3C_DIR/logs/qalead-la-40-m1-sim.log" 2>&1
mv "$SRC_WAVE_3"/tests/host/artifacts/qalead-la-40-* "$SLOT3C_DIR/artifacts/"

# ----------------------------------------------------------------------
# Step 3C.2 (qalead-la-41, est. 3 min): M1 --phase snapshot-upgrade --provider all (6 rows incl. M1-41.common.j-snapshot)
# ----------------------------------------------------------------------
COMPOSE_PROJECT_NAME=qalead-la-41 PUBLIC_PORT=$PUBLIC_PORT STACK_SUBNET=$STACK_SUBNET \
  node "$SRC_WAVE_3/tests/host/run-m1.mjs" \
  --phase snapshot-upgrade \
  --provider all \
  --sha "$WAVE_SHA_3" \
  --test-sha "$WAVE_TEST_SHA_3" \
  --source "$SRC_WAVE_3" \
  > "$SLOT3C_DIR/logs/qalead-la-41-m1-snapshot-upgrade.log" 2>&1
mv "$SRC_WAVE_3"/tests/host/artifacts/qalead-la-41-* "$SLOT3C_DIR/artifacts/"

# ----------------------------------------------------------------------
# Step 3C.3 (qalead-la-42, est. 4 min): M2 Browser Suite (64 cases)
# ----------------------------------------------------------------------
COMPOSE_PROJECT_NAME=qalead-la-42 PUBLIC_PORT=$PUBLIC_PORT STACK_SUBNET=$STACK_SUBNET \
  COURSE_FIXTURES_DIR="$COURSE_FIXTURES_DIR" \
  node "$SRC_WAVE_3/tests/e2e/host/run-m2.mjs" \
  --sha "$WAVE_SHA_3" \
  --test-sha "$WAVE_TEST_SHA_3" \
  --source "$SRC_WAVE_3" \
  > "$SLOT3C_DIR/logs/qalead-la-42-m2.log" 2>&1
mv "$SRC_WAVE_3"/tests/host/artifacts/qalead-la-42-* "$SLOT3C_DIR/artifacts/"

# ----------------------------------------------------------------------
# Step 3C.4 (qalead-la-43, est. 4 min): Candidate Golden Capture G1-G4 + Compare (280 entries, 0 unexplained)
# ----------------------------------------------------------------------
COMPOSE_PROJECT_NAME=qalead-la-43 PUBLIC_PORT=$PUBLIC_PORT STACK_SUBNET=$STACK_SUBNET \
  node "$SRC_WAVE_3/tests/ltiaas/golden/run-golden.mjs" \
  --sha "$WAVE_SHA_3" \
  --source "$SRC_WAVE_3" \
  --workdir "$SLOT3C_DIR/qalead-la-43-golden" \
  --replace-tests --tests-from "$SRC_WAVE_3/tests" \
  --out "$SLOT3C_DIR/golden-capture-$WAVE_SHA_3" \
  > "$SLOT3C_DIR/logs/qalead-la-43-golden-capture.log" 2>&1

cp -R "$SLOT3C_DIR/golden-capture-$WAVE_SHA_3" "$SLOT3C_DIR/golden-capture-$WAVE_SHA_3-port9443"
python3 - << 'EOF'
import glob
for p in glob.glob("/Users/quangnguyen/cogniate-qa-runs/LA/SLOT3C/golden-capture-*-port9443/G*.json"):
    s = open(p).read().replace(":9473", ":9443")
    open(p, "w").write(s)
EOF

node "$SRC_WAVE_3/tests/ltiaas/golden/compare.mjs" \
  --base "$SRC_WAVE_3/tests/ltiaas/golden/$INTAKE_SHA" \
  --candidate "$SLOT3C_DIR/golden-capture-$WAVE_SHA_3-port9443" \
  --expected "LA-IC-01,LA-IC-03,LA-IC-04,LA-IC-12,LA-IC-13,LA-IC-14,LA-IC-15,LA-IC-16,LA-IC-17,LA-IC-18,LA-IC-19,LA-IC-20,LA-IC-21" \
  --expected-dir "$SRC_WAVE_3/tests/ltiaas/golden/expected" \
  > "$SLOT3C_DIR/logs/qalead-la-43-golden-compare-port-aligned.txt"
```

---

## 3D. Slot 3D: Wave-End `M1 --phase sim` Re-Gate on `src-wave-end-4` (`WE-F6` / `LA-IC-06`) + `WE-F10` (`T5b` `AC-T5-36`) Baseline

- **Gate Source Repo (`src-wave-end-4`):** `/Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end-4` (fresh `git clone --no-hardlinks` of `src-wave-end-3` at tag `la-gate-test-3` = `e46bb27c9487d332f40fcefd4dd880304d1d31f1`, with one new commit applying the approved Round 2 patch from `docs/reviews/LA-E7-08/ld9-addendum-r2.md` for `WE-F6` / `LA-IC-06` `M1-08.canvas.login-redirect`; `src-wave-end-3` untouched).
- **Recorded Gate Source SHAs (`src-wave-end-4`):**
  - **`$WAVE_SHA_3` (Product Base):** `8fadb828088ffe1b4db02179ab0fa3ab2388a12a` (`tag: la-wave-end-product-3`)
  - **`$BASE_OVERLAY_SHA_3` (Commit 1):** `e00b9651e29d835e1980732ba7037273f641ac7a` (`tag: la-gate-test-base-c1-3`)
  - **`$WAVE_TEST_SHA_3` (Commit 2):** `e46bb27c9487d332f40fcefd4dd880304d1d31f1` (`tag: la-gate-test-3`)
  - **`$WAVE_TEST_SHA_4` (Commit 3 — Approved `ld9-addendum-r2.md` Round 2 on `la-gate-test-3`):** `6ce8ffafb9da767aa73dbcd5fb38e9844c543ff1` (`tag: la-gate-test-4`; `git diff --stat la-gate-test-3 HEAD` shows only `tests/acceptance/M1/canvas/21-canvas-protocol.test.ts | 25 ++++++++++++++++++----`, `1 file changed, 21 insertions(+), 4 deletions(-)`; `git diff --exit-code 8fadb828088ffe1b4db02179ab0fa3ab2388a12a HEAD -- . ':!tests'` exits `0` with `0` non-test files changed).
- **Compose Projects & Order (`100 min` window after `"GO slot 3D"`, one stack at a time):**
  1. **`qalead-la-44` (`SIM` lane, `PUBLIC_PORT=9473`, `STACK_SUBNET=172.23.0.0/16`):** `M1 --phase sim --provider all` (`394` rows) on `--sha 8fadb828088ffe1b4db02179ab0fa3ab2388a12a --test-sha 6ce8ffafb9da767aa73dbcd5fb38e9844c543ff1 --source /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end-4`.
  2. **`qalead-la-45` & `qalead-la-46` (`Moodle` lane, `PUBLIC_PORT=9543`, `STACK_SUBNET=172.21.0.0/16`):** `WE-F10` baseline — `T5b` on intake `1b17261be97c4701b928fa9dc2fa74c6d23028f6` from `/Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-slot7-1b17261` (`--test-sha 357d17997b4d36dbfb6bde7568a4d87c0e3a14fc`), run twice (`qalead-la-45`, then `qalead-la-46`).
  3. **`qalead-la-48` & `qalead-la-49` (`Moodle` lane, `PUBLIC_PORT=9543`, `STACK_SUBNET=172.21.0.0/16`):** `WE-F7` / `WE-F8` (`BD-A1-115`) baseline — `T6` (`qalead-la-48`, `run-t5.mjs --tasks T5a,T6`) and `T8` (`qalead-la-49`, `run-t8.mjs`) on intake `1b17261be97c4701b928fa9dc2fa74c6d23028f6` from `/Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-slot7-1b17261` (`--test-sha 357d17997b4d36dbfb6bde7568a4d87c0e3a14fc`).
  4. **`qalead-la-47` (`Moodle` lane, `PUBLIC_PORT=9543`, `STACK_SUBNET=172.21.0.0/16`):** `T5b` once more on wave-end `8fadb828088ffe1b4db02179ab0fa3ab2388a12a` from `/Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end-4` (`--test-sha 6ce8ffafb9da767aa73dbcd5fb38e9844c543ff1`).
  - Report `AC-T5-36` per run (`status`, `grade wait time`, and `outside requests held`), plus `AC-T6-07, -09, -12, -13` and `AC-T8-08, -10` per run.

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

---

## 8b. Slot 8b — Live Moodle Rerun of `T7 × 1`, `T6`, and `T8` on `8fadb828088ffe1b4db02179ab0fa3ab2388a12a` (`la-gate-test-5`)

### (a) Candidate Clone `/Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end-5`

- **Base Clone (`src-wave-end-4` at `la-gate-test-4`):** `$WAVE_TEST_SHA_4` = `6ce8ffafb9da767aa73dbcd5fb38e9844c543ff1` (product tree identical to `$WAVE_SHA_3` = `8fadb828088ffe1b4db02179ab0fa3ab2388a12a`).
- **Commit A (`LD-9` Addendum R3 — `WE-F7` under `LA-IC-23` & `WE-F8` under `M2` approval `AC-M3-02(b)`):**
  - `$COMMIT_A_SHA` = `70dc83a3d91dad5f92687a5af20c17be79025f52` (`docs/reviews/LA-E7-08/ld9-addendum-r3.md` / `/Users/quangnguyen/cogniate-qa-runs/LA/qa3-ld9-addendum-r3/ld9-addendum-r3.patch`, `6` files changed, `+54 / -17`):
    - `tests/acceptance/T6/2-connect.spec.ts`
    - `tests/acceptance/T6/3-courses.spec.ts`
    - `tests/acceptance/T6/5-xss-a11y.spec.ts`
    - `tests/acceptance/T8/2-shell.spec.ts`
    - `tests/acceptance/lib/portal.ts`
    - `tests/e2e/lib/steps.ts`
- **Commit B (`WE-F9` — `c48b76dcd783346e16e52348bef40c12cb27ad0c` rename of `r2-moodle-sim.spec.ts` to `.r2sim.ts`):**
  - `$COMMIT_B_SHA` = `$WAVE_TEST_SHA_5` = `0700b3962ec063c4c2c3f36cf0ca27a25c97e82e` (tagged `la-gate-test-5`, `3` files changed, `+51 / -12`):
    - `tests/e2e/ltiaas/r2-moodle-sim.spec.ts` → `tests/e2e/ltiaas/r2-moodle-sim.r2sim.ts`
    - `tests/e2e/ltiaas/playwright.r2-sim.config.ts`
    - `tests/e2e/ltiaas/run-k2.mjs`
- **Diff & Selection Proofs:**
  - `git diff --stat la-gate-test-4 la-gate-test-5`: `9 files changed, 105 insertions(+), 29 deletions(-)` (only the 6 Addendum R3 files + the 3 `WE-F9` files).
  - `git diff --exit-code 8fadb828088ffe1b4db02179ab0fa3ab2388a12a la-gate-test-5 -- . ':!tests'`: `0` non-test files differ from `8fadb828088ffe1b4db02179ab0fa3ab2388a12a`.
  - `QA_SUITE=e2e npx playwright test -c playwright.config.ts --list`: `Total: 18 tests in 6 files` — `diff -u` against `1b17261` (`src-slot7-1b17261`) is empty (`0` lines differ).

### (b) Slot 8b Run Set & Exact Commands (`qalead-la-50..52`, `PUBLIC_PORT=9543`, `STACK_SUBNET=172.21.0.0/16`, `50 min` Window)

| Compose Project | Suite | Est. Minutes | Purpose |
| --- | --- | --- | --- |
| **`qalead-la-50`** | `T7 × 1` (`run-t7.mjs --runs 1`) | **`13 min`** | Proves `WE-F7`, `WE-F8`, and `WE-F9` on live Moodle (`18/18` `T7` cases including `AC-T7-08` and `AC-T7-09` for `AC-LA-E5-13-06` and `DEMO AC-T7-15`). |
| **`qalead-la-51`** | `T6` (`run-t5.mjs --tasks T5a,T6`) | **`8 min`** | Proves `WE-F7` and `WE-F8` across all `T6` spec files (`AC-T6-07/-09/-12/-13` and full `T5a,T6` run) on `8fadb828088ffe1b4db02179ab0fa3ab2388a12a`. |
| **`qalead-la-52`** | `T8` (`run-t8.mjs`) | **`9 min`** | Proves `WE-F7` and `WE-F8` across all `T8` spec files (`AC-T8-08/-09/-10` and full `T5a,T8` run under `umask 022`) on `8fadb828088ffe1b4db02179ab0fa3ab2388a12a`. |

```bash
set -euo pipefail
export GATE_DIR="/Users/quangnguyen/cogniate-qa-runs/LA/GATE"
export SLOT8B_DIR="/Users/quangnguyen/cogniate-qa-runs/LA/SLOT8B"
export SRC_WAVE_5="$GATE_DIR/src-wave-end-5"
export COURSE_FIXTURES_DIR="$GATE_DIR/course-fixtures"
WAVE_SHA_3="8fadb828088ffe1b4db02179ab0fa3ab2388a12a"
export WAVE_SHA_3
WAVE_TEST_SHA_5="0700b3962ec063c4c2c3f36cf0ca27a25c97e82e"
export WAVE_TEST_SHA_5
export PUBLIC_PORT=9543
export STACK_SUBNET="172.21.0.0/16"

# Run under umask 022 so container pwuser (1000:1000) can read host-mounted infra/.logs and infra/.data
umask 022

# 1. qalead-la-50: T7 x 1
COMPOSE_PROJECT_NAME=qalead-la-50 PUBLIC_PORT=$PUBLIC_PORT STACK_SUBNET=$STACK_SUBNET \
  COURSE_FIXTURES_DIR="$COURSE_FIXTURES_DIR" \
  node "$SRC_WAVE_5/tests/e2e/host/run-t7.mjs" \
  --sha "$WAVE_SHA_3" \
  --runs 1 --replace-e2e \
  > "$SLOT8B_DIR/logs/qalead-la-50-t7x1.log" 2>&1

# 2. qalead-la-51: T6 (via run-t5.mjs --tasks T5a,T6)
COMPOSE_PROJECT_NAME=qalead-la-51 PUBLIC_PORT=$PUBLIC_PORT STACK_SUBNET=$STACK_SUBNET \
  COURSE_FIXTURES_DIR="$COURSE_FIXTURES_DIR" \
  node "$SRC_WAVE_5/tests/host/run-t5.mjs" \
  --sha "$WAVE_SHA_3" \
  --source "$SRC_WAVE_5" \
  --workdir "$SLOT8B_DIR/qalead-la-51-t6" \
  --replace-tests --tests-from "$SRC_WAVE_5/tests" \
  --tasks T5a,T6 \
  > "$SLOT8B_DIR/logs/qalead-la-51-t6.log" 2>&1

# 3. qalead-la-52: T8 (via run-t8.mjs)
COMPOSE_PROJECT_NAME=qalead-la-52 PUBLIC_PORT=$PUBLIC_PORT STACK_SUBNET=$STACK_SUBNET \
  COURSE_FIXTURES_DIR="$COURSE_FIXTURES_DIR" \
  node "$SRC_WAVE_5/tests/host/run-t8.mjs" \
  --sha "$WAVE_SHA_3" \
  --source "$SRC_WAVE_5" \
  --workdir "$SLOT8B_DIR/qalead-la-52-t8" \
  --replace-tests --tests-from "$SRC_WAVE_5/tests" \
  > "$SLOT8B_DIR/logs/qalead-la-52-t8.log" 2>&1
```

---

## 8c. Slot 8c — Live Moodle Rerun of `T6` and `T5b × 2` on `8fadb828088ffe1b4db02179ab0fa3ab2388a12a` (`la-gate-test-6`)

### (a) Candidate Clone `/Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end-6`

- **Base Clone (`src-wave-end-5` at `la-gate-test-5`):** `$WAVE_TEST_SHA_5` = `0700b3962ec063c4c2c3f36cf0ca27a25c97e82e` (product tree identical to `$WAVE_SHA_3` = `8fadb828088ffe1b4db02179ab0fa3ab2388a12a`).
- **Commit (`LD-9` Addendum R4 — `WE-F10` under `BD-A1-116` & `WE-F11` under `BD-A1-117`):**
  - `$WAVE_TEST_SHA_6` = `9de014298fbe133ebbd8d40365da84988ccabf5d` (`tag: la-gate-test-6`, `docs/reviews/LA-E7-08/ld9-addendum-r4.md` / `/Users/quangnguyen/cogniate-qa-runs/LA/qa3-ld9-addendum-r4/ld9-addendum-r4.patch`, `2 files changed, 3 insertions(+)`):
    - `tests/acceptance/T5b/1-html.spec.ts` (`AC-T5-36` wait for `runtimeState(player.token)` `seenPages` to contain `'index'` before `driveCourse`)
    - `tests/acceptance/T6/3-courses.spec.ts` (`AC-T6-07` wait for `dialog.getByText('Loading…')` count `0` before `dialog.innerText()`)
- **Diff Proofs:**
  - `git diff --stat la-gate-test-5 la-gate-test-6`: `2 files changed, 3 insertions(+)` (only `tests/acceptance/T5b/1-html.spec.ts` and `tests/acceptance/T6/3-courses.spec.ts`).
  - `git diff --exit-code 8fadb828088ffe1b4db02179ab0fa3ab2388a12a la-gate-test-6 -- . ':!tests'`: `0` non-test files differ from `8fadb828088ffe1b4db02179ab0fa3ab2388a12a`.

### (b) Slot 8c Run Set & Exact Commands (`qalead-la-53..55`, `PUBLIC_PORT=9543`, `STACK_SUBNET=172.21.0.0/16`, `45 min` Window)

| Compose Project | Suite | Est. Minutes | Purpose |
| --- | --- | --- | --- |
| **`qalead-la-53`** | `T6` (`run-t5.mjs --tasks T5a,T6`) | **`7 min`** | Proves `WE-F11` (`BD-A1-117`) in `AC-T6-07` (`14/14` `T6` ACs and `21/21` `T5a` ACs `PASS`) on `8fadb828088ffe1b4db02179ab0fa3ab2388a12a`. |
| **`qalead-la-54`** | `T5b` #1 (`run-t5.mjs --tasks T5a,T5b`) | **`17 min`** | Proves `WE-F10` (`BD-A1-116`) in `AC-T5-36` (`15/15` `T5b` ACs / `24/24` `T5b` tests `PASS`, pass 1 of 2) on `8fadb828088ffe1b4db02179ab0fa3ab2388a12a`. |
| **`qalead-la-55`** | `T5b` #2 (`run-t5.mjs --tasks T5a,T5b`) | **`17 min`** | Proves `WE-F10` (`BD-A1-116`) in `AC-T5-36` (`15/15` `T5b` ACs / `24/24` `T5b` tests `PASS`, pass 2 of 2) on `8fadb828088ffe1b4db02179ab0fa3ab2388a12a`. |

```bash
set -euo pipefail
export GATE_DIR="/Users/quangnguyen/cogniate-qa-runs/LA/GATE"
export SLOT8C_DIR="/Users/quangnguyen/cogniate-qa-runs/LA/SLOT8C"
export SRC_WAVE_6="$GATE_DIR/src-wave-end-6"
export COURSE_FIXTURES_DIR="$GATE_DIR/course-fixtures"
WAVE_SHA_3="8fadb828088ffe1b4db02179ab0fa3ab2388a12a"
export WAVE_SHA_3
WAVE_TEST_SHA_6="9de014298fbe133ebbd8d40365da84988ccabf5d"
export WAVE_TEST_SHA_6
export PUBLIC_PORT=9543
export STACK_SUBNET="172.21.0.0/16"

umask 022

# 1. qalead-la-53: T6 (via run-t5.mjs --tasks T5a,T6)
COMPOSE_PROJECT_NAME=qalead-la-53 PUBLIC_PORT=$PUBLIC_PORT STACK_SUBNET=$STACK_SUBNET \
  COURSE_FIXTURES_DIR="$COURSE_FIXTURES_DIR" \
  node "$SRC_WAVE_6/tests/host/run-t5.mjs" \
  --sha "$WAVE_SHA_3" \
  --source "$SRC_WAVE_6" \
  --workdir "$SLOT8C_DIR/qalead-la-53-t6" \
  --replace-tests --tests-from "$SRC_WAVE_6/tests" \
  --tasks T5a,T6 \
  > "$SLOT8C_DIR/logs/qalead-la-53-t6.log" 2>&1

# 2. qalead-la-54: T5b #1 (via run-t5.mjs --tasks T5a,T5b)
COMPOSE_PROJECT_NAME=qalead-la-54 PUBLIC_PORT=$PUBLIC_PORT STACK_SUBNET=$STACK_SUBNET \
  COURSE_FIXTURES_DIR="$COURSE_FIXTURES_DIR" \
  node "$SRC_WAVE_6/tests/host/run-t5.mjs" \
  --sha "$WAVE_SHA_3" \
  --source "$SRC_WAVE_6" \
  --workdir "$SLOT8C_DIR/qalead-la-54-t5b-1" \
  --replace-tests --tests-from "$SRC_WAVE_6/tests" \
  --tasks T5a,T5b \
  > "$SLOT8C_DIR/logs/qalead-la-54-t5b-1.log" 2>&1

# 3. qalead-la-55: T5b #2 (via run-t5.mjs --tasks T5a,T5b)
COMPOSE_PROJECT_NAME=qalead-la-55 PUBLIC_PORT=$PUBLIC_PORT STACK_SUBNET=$STACK_SUBNET \
  COURSE_FIXTURES_DIR="$COURSE_FIXTURES_DIR" \
  node "$SRC_WAVE_6/tests/host/run-t5.mjs" \
  --sha "$WAVE_SHA_3" \
  --source "$SRC_WAVE_6" \
  --workdir "$SLOT8C_DIR/qalead-la-55-t5b-2" \
  --replace-tests --tests-from "$SRC_WAVE_6/tests" \
  --tasks T5a,T5b \
  > "$SLOT8C_DIR/logs/qalead-la-55-t5b-2.log" 2>&1
```

---

## 8d. Slot 8d — Live Moodle `T7 × 3` on `8fadb828088ffe1b4db02179ab0fa3ab2388a12a` (`la-gate-test-6`, `AC-LA-E7-09-01`)

- **Purpose (`AC-LA-E7-09-01` & `AC-LA-E7-09-03`):** `AC-LA-E7-09-01` requires `"T7: 3 runs × 17 PASS plus the demo skip, as in the baseline"` (baseline: Slot 7 `qalead-la-20` on `1b17261`, `3 × 17 PASS + 1 skip`). Slot 8b (`qalead-la-50`) ran `T7 × 1` only.
- **Candidate Clone:** `/Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end-6` at `la-gate-test-6` (`9de014298fbe133ebbd8d40365da84988ccabf5d`), product SHA `8fadb828088ffe1b4db02179ab0fa3ab2388a12a`.
- **Compose Project & Network:** `qalead-la-56`, `PUBLIC_PORT=9543`, `STACK_SUBNET=172.21.0.0/16` (~`11 min` for `3` consecutive `npm run test:e2e` runs with `e2e:reset`).
- **Command:**
  ```bash
  COMPOSE_PROJECT_NAME=qalead-la-56 PUBLIC_PORT=9543 STACK_SUBNET="172.21.0.0/16" \
    COURSE_FIXTURES_DIR="/Users/quangnguyen/cogniate-qa-runs/LA/GATE/course-fixtures" \
    node "/Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end-6/tests/e2e/host/run-t7.mjs" \
    --sha "8fadb828088ffe1b4db02179ab0fa3ab2388a12a" \
    --runs 3 --replace-e2e \
    > "/Users/quangnguyen/cogniate-qa-runs/LA/SLOT8D/logs/qalead-la-56-t7x3.log" 2>&1
  ```

---

## 9. `LD-1` & `LD-9` Gate Overlay Fix Rounds 1–3 (`docs/reviews/LA-E7-08/ld9-addendum-r5.md` on `la-gate-test-6`)

- **Base Gate Test Tag / SHA:** `la-gate-test-6` = `9de014298fbe133ebbd8d40365da84988ccabf5d` (`/Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end-6`).
- **Patch & Report:** `/Users/quangnguyen/cogniate-qa-runs/LA/ld1-overlay-fix-r1/ld9-addendum-r5.patch` (`SHA256 = e6b0c719c4bb7a83762df45b46382012070ebbf70acec16735cab986bb289aec`) and `docs/reviews/LA-E7-08/ld9-addendum-r5.md` (`8 files changed`; `git apply --check -v` on `src-wave-end-6` exits `0`).
- **Findings Closed:**
  1. **`A-LA-E0-04-01 = B-LA-E0-04-01` (BLOCKER, CLOSED in Round 2), `A-LA-E0-04-05` (BLOCKER, Round 3), `B-LA-E0-04-02` (MAJOR, Round 3), `B-LA-E0-04-03` (BLOCKER, Round 3) — `LD-1` Row 6 Card Membership Oracle (`BD-A1-119`):** Rewrote the LD-1 card membership oracle to `BD-A1-119` (`article[data-channel-id]`), removing every text-based card identity path (setup-notice regex, title suffix word stripping, `notReadyLms` guessing, `href`/`id` fallback). `extraChannelNames(lmsProviders)` (`open-world.mjs`) returns the non-baseline `channel` ids (`entry.channel ?? entry.lms`) of `GET /app-api/lms-providers`. `lmsCardTexts(page)` (`01-cards.m2.ts`) extracts `{ text, channel, loading }` where `channel` is read strictly from `article[data-channel-id]`. `checkCards` checks the 3 baseline cards in order (and asserts `cardChannel(card) === BASELINE_LMS[i]` when extracted from the DOM), requires every card without `data-channel-id` (`channel === null`) to be one of the frozen static cards (`BASELINE_OTHER_CARDS`, each at most once), and asserts that the non-baseline `data-channel-id` values have no duplicates and equal the exact set of registered non-baseline channel ids (`allowed`), so both unknown `data-channel-id` and missing registered channel cards fail. Verified by the `BD-A1-119` DOM probes in `tests/ltiaas/k0/ld1/open-world.test.{mjs,ts}` (`46/46` K0 `ld1` tests `PASS`).
  2. **`A-LA-E0-04-02` (MAJOR, CLOSED in Round 2 and ratified as `LD-24` — `M1-41.common.j-snapshot` Migration-Ledger Prefix + Candidate Check & Classification):** `snapshotMigrationRun` (`tests/host/m1-migration.mjs:338-341`) calls `checkMigrationLedgers(oldLedger, newLedger, { expectedLtiLedger, expectedAppLedger })`, restoring the independent check that `oldLedger[db]` is a non-empty prefix of `newLedger[db]` while keeping exact equality with the candidate's sorted migration files (`BD-A2-108` / `LD-24` / `WE-F5`). Explicitly classified above under `AC-LA-E7-08-05` item 5 as an assertion change on `M1-41.common.j-snapshot`.
  3. **`A-LA-E0-04-03` (MAJOR, CLOSED in Round 3 — Wait for `/connections` Card Loading to Settle in `M2-01.cards`):** `lmsCardTexts(page)` (`tests/e2e/M2/01-cards.m2.ts`) marks cards without a `Connect`/`Manage` control or with `Loading…` as `loading: true` and polls via `await expect.poll(...)` until `cards.length > 0 && cards.every((c) => !c.loading)`, and `checkCards` (`open-world.mjs`) rejects any unsettled loading card.
  4. **`A-LA-E0-04-04` (MINOR, CLOSED in Round 3 — Cite `LD-24` and `18` App Migrations in `cogniate.db`):** Replaced `LA-H21` with `LD-24` across `open-world.mjs`, `open-world.test.{mjs,ts}`, and the review/plan docs, and updated `cogniate.db` migration count on `8fadb828` to `18` in `ld9-addendum-r5.md`.
- **Re-Gate Rows (Slot 3F below):**
  - `M2` (`01-cards.m2.ts`): `M2-01.cards`, `M2-01.isolated-newest`, `M2-01.moodle-card`.
  - `M1` (`m1-migration.mjs`): `snapshot-upgrade` (`M1-38.common.h1..h5`, `M1-41.common.j-snapshot`) and `migration` (`M1-23.common.baseline`, `M1-23.common.upgrade`, `M1-30.common.postwrite`, `M1-30.common.rollback`).

---

## 3F. Slot 3F — Final Gate Sources & Re-Gate on Final Product SHA `a8bbac53` (`la-final-test-1` & `la-slot7-test-2`)

### (a) Recorded Gate Source SHAs (`set -euo pipefail`, assign then `export`)

- **Final Product SHA (`$FINAL_SHA`):** `a8bbac538cfe1e305f410279d7879421d64a5a1f` (`tag: la-final-product-1`; `8fadb828` + lane P `data-channel-id={item.channel}` on channel cards under `BD-A1-119`).
- **Final Test Tree (`src-wave-end-7`, `tag: la-gate-test-7`):** `$WAVE_TEST_SHA_7` = `a675ee243f00780a4f9eaf79be2f4c717a1d8e11` (`src-wave-end-6` at `la-gate-test-6` `9de014298fbe133ebbd8d40365da84988ccabf5d` + approved `ld9-addendum-r5.patch`; `8 files changed, 1625 insertions(+), 62 deletions(-)`; `tests/` git tree `ac9f1e650f5cd7222691a9727837bb51c8835e1a`).
- **Final Candidate Gate Clone (`src-final-1`, `tag: la-final-test-1`):** `$FINAL_TEST_SHA_1` = `85ddf97332063f75bdc5636cb410fc0d6ee25099` (`a8bbac538cfe1e305f410279d7879421d64a5a1f` with `tests/` restored from `la-gate-test-7`; `git rev-parse la-final-test-1:tests` = `ac9f1e650f5cd7222691a9727837bb51c8835e1a` = `la-gate-test-7:tests`; `git diff --exit-code a8bbac538cfe1e305f410279d7879421d64a5a1f la-final-test-1 -- . ':!tests'` exit `0`).
- **Baseline `1b17261` LD-1 Parity Clone (`src-slot7-r2`, `tag: la-slot7-test-2`):** `$SLOT7_TEST_SHA_2` = `38de1c38815df53f9a39b1fa60427ef60416475d` (`src-slot7-1b17261` at `357d17997b4d36dbfb6bde7568a4d87c0e3a14fc` + only the 3 LD-1 oracle files of `ld9-addendum-r5.patch`: `tests/acceptance/lib/open-world.d.mts`, `tests/acceptance/lib/open-world.mjs`, `tests/e2e/M2/01-cards.m2.ts`; `3 files changed, 171 insertions(+), 25 deletions(-)`; `0` non-test diff from `1b17261be97c4701b928fa9dc2fa74c6d23028f6`).

### (b) Slot 3F Run Set & Exact Commands (`qalead-la-60..66`, `90 min` Window, One Stack at a Time)

| Compose Project | Lane / Port / Subnet | Product SHA | Test SHA & Source | Suite & Purpose |
| --- | --- | --- | --- | --- |
| **`qalead-la-60`** | SIM (`9473`, `172.23.0.0/16`) | `a8bbac538cfe1e305f410279d7879421d64a5a1f` | `la-final-test-1` (`85ddf973`), `src-final-1` | `M2` (`64` cases; proves `BD-A1-119` `data-channel-id` on `/connections` cards & `LD-1` Round 3 oracle on `M2-01.cards`, `M2-01.isolated-newest`, `M2-01.moodle-card`). |
| **`qalead-la-61`** | SIM (`9473`, `172.23.0.0/16`) | `a8bbac538cfe1e305f410279d7879421d64a5a1f` | `la-final-test-1` (`85ddf973`), `src-final-1` | `M1 --phase migration --provider all` (`12` manifest rows; proves `LD-24` / `m1-migration.mjs` on `M1-23.common.{baseline,upgrade}` & `M1-30.common.{postwrite,rollback}`). |
| **`qalead-la-62`** | SIM (`9473`, `172.23.0.0/16`) | `a8bbac538cfe1e305f410279d7879421d64a5a1f` | `la-final-test-1` (`85ddf973`), `src-final-1` | `M1 --phase snapshot-upgrade --provider all` (`6` manifest rows: `M1-38.common.h1..h5` & `M1-41.common.j-snapshot`; proves `checkMigrationLedgers` `LD-24`). |
| **`qalead-la-63`** | SIM (`9473`, `172.23.0.0/16`) | `a8bbac538cfe1e305f410279d7879421d64a5a1f` | `la-final-test-1` (`85ddf973`), `src-final-1` | `G1–G4` golden capture (`run-golden.mjs`) & `compare.mjs` against `G-BASE` (`1b17261be97c4701b928fa9dc2fa74c6d23028f6`) with `expected/LA-IC-*.json` (`AC-LA-E7-08-03`). |
| **`qalead-la-64`** | SIM (`9473`, `172.23.0.0/16`) | `1b17261be97c4701b928fa9dc2fa74c6d23028f6` | `la-slot7-test-2` (`38de1c38`), `src-slot7-r2` | `M2` on `1b17261` (`64` cases; proves `LD-1` unattributed baseline parity on `G-BASE`). |
| **`qalead-la-65`** | Moodle (`9543`, `172.21.0.0/16`) | `a8bbac538cfe1e305f410279d7879421d64a5a1f` | `la-final-test-1` (`85ddf973`), `src-final-1` | `T6` (via `run-t5.mjs --tasks T5a,T6`; proves lane P `/connections` `data-channel-id` change on live Moodle portal integration cards `AC-T6-01..14`). |
| **`qalead-la-66`** | Moodle (`9543`, `172.21.0.0/16`) | `a8bbac538cfe1e305f410279d7879421d64a5a1f` | `la-final-test-1` (`85ddf973`), `src-final-1` | `T7 × 1` (`run-t7.mjs --runs 1 --replace-e2e`; proves lane P `/connections` `data-channel-id` change on live Moodle end-to-end `T7` `17 PASS + 1 SKIP`). |




