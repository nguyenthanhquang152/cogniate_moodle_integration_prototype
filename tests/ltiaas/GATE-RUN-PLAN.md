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
- **Compose Projects:** `qalead-la-10`, `qalead-la-11`, `qalead-la-12`, `qalead-la-13`, `qalead-la-14`, `qalead-la-15`
- **Port / Subnet:** `PUBLIC_PORT=9643`, `STACK_SUBNET=172.22.0.0/16` (or `9443` / `172.20.0.0/16` per `DOCKER-YES`)
- **Estimated Duration:** **`52 minutes` total**
  - Step 3B.1 (`qalead-la-10`): Candidate golden capture `G1–G4` + host compare with all 13 `LD-9` records — **`4 min`**
  - Step 3B.2 (`qalead-la-11` & `qalead-la-12`): `M1 --phase migration` (`35` rows) + `M1 --phase snapshot-upgrade` (`7` rows) — **`12 min`**
  - Step 3B.3 (`qalead-la-13`): combined `U1` SIM upgrade continuity from `1b17261` to `80133d6b` (`LA-E5-08` LTI + `LA-E5-22` app) — **`6 min` estimate**; executed as `qalead-la-13-80133d6b-2026-10-23T17-11-52-676Z` (43 summary entries: 37 PASS, 6 INFO; 17 PASS aggregate IDs).
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
# Step 3B.3: execution correction (combined U1 SIM; AC-LA-E7-08-04)
# The earlier separate-service commands were planned, not the executed record.
# One combined run covered LA-E5-08 and LA-E5-22 on build 80133d6b:
# qalead-la-13-80133d6b-2026-10-23T17-11-52-676Z
# Raw summary: /Users/quangnguyen/cogniate-qa-runs/LA/LA-E7-08/slot3b-80133d6b/artifacts/qalead-la-13-80133d6b-2026-10-23T17-11-52-676Z/summary.json
# Counts: 43 entries (37 PASS, 6 INFO); 17 PASS aggregate IDs.
# See QA section 5.1 item 4 and section 14.6 for the executed evidence.

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
| **Not Rerun in Slot 3C** | `M1 --phase migration` (`qalead-la-11`) and combined `U1` SIM (`LA-E5-08` + `LA-E5-22`, `qalead-la-13-80133d6b-2026-10-23T17-11-52-676Z`) | **`0 min` (carried from Slot 3B on `80133d6b`)** | **Why `M1 migration` and `U1` do not need to run again:**<br>1. **No new SQL migration or schema change after `80133d6b`:** `git diff --stat 80133d6b662dd4fb8e18a9eed62e3160d2b2a1c5..8fadb828088ffe1b4db02179ab0fa3ab2388a12a -- services/lti-service/src/db/migrations services/cogniate-app/src/domain/migrations` is **empty (`0` files changed)**; the migration ledgers remain `001_init.sql`..`021_registration_token_kind.sql` (`21` files in `lti-service`) and `001_init.sql`..`016_binding_authority.sql` (`16` files in `cogniate-app`).<br>2. **No change to `stack-data`, backup/restore, or `U1` key-sealing/backfill code after `80133d6b`:** None of `BD-A2-108` (`ecc19bbc`), `BD-A2-106` (`60230165`), or `BD-A2-109` touches migration SQL, backfill logic, key-provider sealing (`ltik1` / `cgk1`), or backup/restore scripts.<br>3. **Executed Slot 3B evidence (`docs/reviews/LA-E7-08/qa.md` §5.1 items 2 and 4):** `qalead-la-11` passed `12/12` `migration` manifest rows in `m1-case-results.json`, the combined run `qalead-la-13-80133d6b-2026-10-23T17-11-52-676Z` has **43 summary entries (37 PASS, 6 INFO), 17 PASS aggregate IDs** in `/Users/quangnguyen/cogniate-qa-runs/LA/LA-E7-08/slot3b-80133d6b/artifacts/qalead-la-13-80133d6b-2026-10-23T17-11-52-676Z/summary.json`. No separate per-service count is claimed. |

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

---

## 10. Re-gate after the B/C final merge (LD-29 & LD-31)


### Execution addendum: kit assembly finding and LD-32 (2026-10-24)

The original D3 kit invocation `qalead-la-141-4f10c5fd-2026-10-24T21-31-19-859Z` is **FAIL**: 8 host rows PASS and 2 FAIL (`SUITE`, `PASSRULE`), zero Vitest tests, and no `k1-kit-summary.json`. Its stack was removed. `WAVE` passed with D3's own 130/131/137 outputs.

The gate assembly at `5ee0ebd0`, retained in test SHA `794f649c`, replaced `tests/acceptance/run-api.mjs` with blob `6d0aef65`. This removed the committed K1 dispatcher (blob `5ee913e0`). The exact planned `QA_TASK=K1` command selected `acceptance/K1/**/*.test.ts`, which matched no test. `passWithNoTests` explains exit 0; it is not a kit PASS. QA and QA-K confirmed this cause independently. No kit file or frozen gate source is changed.

Before LD-32, the Lead also changed the remaining execution to one LA stack at a time: D3 M1 140 and D4 M1 recovery 162 run alone, and planned overlap #2 is cancelled. D3 T5a/T6 recovery 142 replaces the failed 136 invocation. The original failed attempts remain in the run records.

Lead decision LD-32 supersedes the kit commands for 141 and 161 in §10(c) and §10(d).7. Finish D4 Moodle 153..160 first. Then run **D3 recovery 144** alone on `9473` / `172.23.0.0/16`, followed by **D4 kit 161** alone on `9643` / `172.22.0.0/16`. Keep the failed 141 invocation in the D3 record.

Both kits use one fresh `git clone --no-hardlinks` of integration `99338e52db0a1f0e1512954482320d45a53e2d8f`, at `/Users/quangnguyen/cogniate-qa-runs/LA/REGATE/kit-src-99338e52`. Its diff against product `4f10c5fd` outside `tests/` and `docs/` is empty. Its kit tree is `d7e50b5dea56382f849b213f006b73bcf5eb71aa`. The dispatcher SHA-256 is `438b8cc1cc9afc95abb37aa51c26edc8eee661a98a47bfcf4979d01be4e31100`. Record these values before each run to prove LD-25 parity.

Before each kit run, without Docker, check that `tests/acceptance/run-api.mjs` contains `ltiaas/kit/vitest.config.mts`. Use the committed kit and dispatcher with no `--replace-tests` and no kit copy. The host runner uses the README command `QA_TASK=K1 QA_KIT_CHANNELS=all npm --prefix tests run acceptance:api` in the container; retries remain 0. Bind 144 to `wave-spec-d3.json` (130/131/137) and 161 to `wave-spec-d4.json` (154/153/160). The wave IDs remain `la-final-wave-4f10c5fd-d3` and `la-final-wave-4f10c5fd-d4`.

The `99338e52` host core rejects `qalead-*` project names. LD-32 therefore uses the byte-identical kit runner from `src-final-3` with its already approved host harness, while `--sha` and `--source` select the shared integration clone. Runner: `/Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-final-3/tests/ltiaas/kit/run-k1sim.mjs`; SHA-256: `17a9f34b64a27456d7676596364098a199a44585c9cee746fac9a535f7c45eb7`. Pass `--sha 99338e52db0a1f0e1512954482320d45a53e2d8f`, `--source /Users/quangnguyen/cogniate-qa-runs/LA/REGATE/kit-src-99338e52`, and a fresh work directory for each run. Do not pass `--replace-tests` or set `LA_K1_KIT_FROM`. This keeps the integration dispatcher and kit in both run clones without changing a file.

The D3/D4 non-kit runs stay on product `4f10c5fd` and frozen test SHA `794f649c`. The LD-32 exception changes only the kit execution source. Evidence and exact commands are recorded in LA-E7-08 QA §14 and `run-D4.md`.

The Lead also authorized one solo baseline T8 retry (`msg_b0e9e22a424c`, `2026-10-24T21:51:18Z`) after both kit runs. Use `qalead-la-170`, baseline product `78971b03`, source `src-baseline-3` at `1ae6716b`, and the same `run-t8.mjs --replace-tests --tests-from` invocation as R1 `129`, on `9543` / `172.21.0.0/16`. No other LA stack may be up. Keep the original `129` FAIL result. If `170` passes AC-T8-03/07, record `129` as a baseline flake and compare the candidate with the solo retry. If the retry fails, keep the baseline difference and its traces. Do not change a test.

D4 T5b run `158` failed AC-T5-30 at the immediate sync-status assertion after Moodle already showed 100. Lead message `msg_aafbba130845` (`2026-10-24T22:12:45Z`) permits one solo T5a/T5b recovery, `163`, only if the trace shows a timing signature and no wrong product result. The saved trace and service log show the same sync became `sent` about 14 ms after the failed `pending` snapshot. Recovery `163` uses the same D4 source, command, `9563` and `172.25.0.0/16`, after `158` completes teardown. If it passes, retain `158` as **WE-F14 (D4 T5b AC-T5-30, solo)** and use `163` for D4 comparison. If the case fails again, stop and escalate. This is separate from the earlier P5 finding WE-F12. No test change is authorized.

### (a) Context, Gate Sources, and Tree Proofs (`LA-H27` (a), `LD-25`, `LD-29`, `LD-31`)

The B/C milestone committed `11` non-doc commits after `G-BASE` `bd368ff39fb4c533fc105e7c5ee81a59e618d99a` (`main` `78971b0300ab171029e8ce94dbba30db37b23dea`, B/C tip `2a186086fb8fedc04e2d85ac7d3be7611ae92af3`: `18` non-doc files — `apps/player/src/html/tracker.ts`, `apps/player/src/html/tracker.test.ts`, `README.md`, `infra/README.md`, and `14` frozen-test files). The Lead merged `78971b03` into `quang/ltiaas-milestone` at `4f10c5fd9ca4dd0a5f636b34d7454e0db7b6849c` (`4f10c5fd`). Per `LA-H27` (a) and `LD-29`, `4f10c5fd` is the new final product SHA and `78971b03` is the new baseline product SHA.

Two fresh gate source clones (`git clone --no-hardlinks`, explicit commits, `0` amends) are staged in `/Users/quangnguyen/cogniate-qa-runs/LA/GATE/` with `LD-9` Addendum Round 8 (`docs/reviews/LA-E7-08/ld9-addendum-r8.md`, patch `/Users/quangnguyen/cogniate-qa-runs/LA/ld9-addendum-r8/ld9-addendum-r8.patch`, `3,366` bytes, SHA-256 `ddf3f1c3ff38c2e805fa0fdf668f7c0a05efe1dbb76a54c1d102b02c01e3c514`):

| Gate Source Clone | Product SHA (`--sha`) | Gate Test Commit & Runner Overlay Mechanism | Non-Test Diff Proof (`git diff --exit-code <product> <test> -- . ':!tests'`) | Test Tree & Self-Test Proofs |
| --- | --- | --- | --- | --- |
| **`/Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-baseline-3`** | `78971b0300ab171029e8ce94dbba30db37b23dea` (`tag: la-baseline-product-3`) | **`1ae6716b7353becc0f053b46fb65e0ba86ff7873`** (`tag: baseline-3`: Commit 1 `d854183f104a5573b83a56e280c088a6bc99c2d4` + explicit Commit 2 `1ae6716b7353becc0f053b46fb65e0ba86ff7873` adding `tests/ltiaas/golden/**` at tree `1909e58f79e5214e7bb349a92811255391aa191c` from `la-qa` `d1603f4d` / `5e2579a0`).<br>• `run-m1.mjs` / `run-m2.mjs`: `--test-sha 1ae6716b7353becc0f053b46fb65e0ba86ff7873 --source "$SRC_BASELINE_3"`<br>• `run-t7.mjs`: invoked from `"$SRC_BASELINE_3/tests/e2e/host/run-t7.mjs"` with `--replace-e2e`<br>• `run-t2/t3c/t4a/t4b/t5/t8.mjs`: `--source "$SRC_BASELINE_3" --replace-tests --tests-from "$SRC_BASELINE_3/tests"` | **`0` non-test files differ (`exit 0`)** | `78971b03` frozen tests + `LD-1` open-world overlay + `qalead-la` runner prefix guard + `r4`/`r6`/`r7`/`r8` + `tests/ltiaas/golden/**` from `d1603f4d` (`54 files changed, 16593 insertions(+), 63 deletions(-)`; `HEAD:tests` = `da790a4b2d75d0ebf1a27ee0de0fbe7c772291fa`; `HEAD:tests/ltiaas/golden` = `1909e58f79e5214e7bb349a92811255391aa191c`). Host self-tests: `37/37 PASS`; `run-m2.mjs --harness-only`: `4/4 PASS` (`64` M2 cases). |
| **`/Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-final-3`** (and `src-final-3-d4` for `D4`) | `4f10c5fd9ca4dd0a5f636b34d7454e0db7b6849c` (`tag: la-final-product-3`) | **`794f649c3ebacf1a1b3ac599cffffe338dd7373d`** (`tag: la-final-test-3`: Commit 1 `5ee0ebd0f34e398d04cca7788c22c8af6352e159` + Commit 2 `r8` `57b6a78c694e6244ffa0639957249c052345dca9` + explicit Commit 3 `794f649c3ebacf1a1b3ac599cffffe338dd7373d` updating `tests/ltiaas/golden/**` to tree `1909e58f79e5214e7bb349a92811255391aa191c` from `la-qa` `d1603f4d` / `5e2579a0`).<br>• `run-m1.mjs` / `run-m2.mjs`: `--test-sha 794f649c3ebacf1a1b3ac599cffffe338dd7373d --source "$SRC_FINAL_3"`<br>• `run-t7.mjs`: invoked from `"$SRC_FINAL_3/tests/e2e/host/run-t7.mjs"` with `--replace-e2e`<br>• `run-t2/t3c/t4a/t4b/t5/t8.mjs`, `run-golden.mjs`, `run-k1sim.mjs`, `run-k2.mjs`: `--source "$SRC_FINAL_3" --replace-tests --tests-from "$SRC_FINAL_3/tests"` | **`0` non-test files differ (`exit 0`)** | `4f10c5fd` tests + `LD-1` open-world overlay + addenda `r1–r8` + `LD-30` kit tree `d7e50b5dea56382f849b213f006b73bcf5eb71aa` from integration `a3953243` + `tests/ltiaas/golden/**` at tree `1909e58f79e5214e7bb349a92811255391aa191c` (`50 files changed, 8197 insertions(+), 543 deletions(-)`; `HEAD:tests` = `b202c3ee3ef21f6caa7e3a11ec5c8a6daf7aac86`). `golden.k0.test.mjs`: `12/12 PASS`; Host self-tests: `37/37 PASS`; `open-world.test.mjs`: `46/46 PASS`; `run-m2.mjs --harness-only`: `64` M2 cases; `run-k2.mjs --harness-only`: `7/7 PASS` (`12` K2 + `2` R2-sim cases). |

- **Golden v2 Gate-Tree Pinning (`A-LA-E7-08-LD9-R8-01` — CLOSED):** Both `src-baseline-3` (`baseline-3` = `1ae6716b7353becc0f053b46fb65e0ba86ff7873`, explicit Commit 2 on top of `d854183f104a5573b83a56e280c088a6bc99c2d4`) and `src-final-3` / `src-final-3-d4` (`la-final-test-3` = `794f649c3ebacf1a1b3ac599cffffe338dd7373d`, explicit Commit 3 on top of `57b6a78c694e6244ffa0639957249c052345dca9`) now contain the exact `tests/ltiaas/golden/**` tree `1909e58f79e5214e7bb349a92811255391aa191c` from `la-qa` `d1603f4d754aa9714c5229d947e65e74c5735f9e` (including the `LA-E0-03` golden v2 baseline `tests/ltiaas/golden/78971b0300ab171029e8ce94dbba30db37b23dea/` and restored `1b17261` v1 record from `5e2579a0c9f4f65dd57b88eda66b3181d356dfb1` plus the `LA-IC-01` +16 and `LA-IC-12` +1 Moodle expected deltas from `d1603f4d754aa9714c5229d947e65e74c5735f9e`).
- **`LD-25` Test-Content Parity Proof:** Across `tests/acceptance`, `tests/e2e` (excluding candidate-only `tests/e2e/ltiaas`), `tests/host`, `tests/fixtures`, and `tests/ltiaas/golden`, `D3` and `D4` use identical test content (`794f649c3ebacf1a1b3ac599cffffe338dd7373d`), and `baseline-3` (`1ae6716b7353becc0f053b46fb65e0ba86ff7873`) differs from `la-final-test-3` (`794f649c3ebacf1a1b3ac599cffffe338dd7373d`) only in the `12` candidate-only `LA-IC` / `LD-24` files (`11-canvas-platforms.test.ts`, `21-canvas-protocol.test.ts`, `31-canvas-grants.test.ts`, `00-profiles.test.ts`, `99-logs.test.ts`, `T4b1/1-connect.spec.ts`, `T6/2-connect.spec.ts`, `lib/portal.ts`, `run-api.mjs`, `e2e/lib/steps.ts`, `host/m1-migration.mjs`, `host/storage-fixture-script.mjs`; `0` files differ in `tests/ltiaas/golden`). All `5` overlapping B/C + LA files (`T8/2-shell.spec.ts`, `host/m1-control.mjs`, `T6/5-xss-a11y.spec.ts`, `e2e/host/run-t7.mjs`, `T6/3-courses.spec.ts`) are **100% byte-for-byte identical** between `baseline-3` and `la-final-test-3`.

---

### (b) Concurrency, `LD-31` Moodle-Stack Rule, Planned Overlaps, and Compose Project Allocation (`A-LA-E7-08-LD9-R8-02`)

1. **`LD-31` Moodle-Stack Rule for the Re-Gate (`docs/team/ltiaas/plan.md` §6.1):**
   - Every host runner (`run-m1.mjs`, `run-m2.mjs`, `run-golden.mjs`, `run-k1sim.mjs`, `run-k2.mjs`, `run-t7.mjs`, `run-t2/t3c/t4a/t4b/t5/t8.mjs`) runs `stack:up` and `seed`, which starts and seeds a `moodle` container in that compose project.
   - `LD-25`'s `"at most one Moodle stack at a time"` means **at most one active Moodle-lane workload at a time** — a suite that drives the real Moodle container (`T7 × 3` and the legacy `T2a–T8` groups).
   - A **non-`M2`/`K2` SIM-lane stack** (`G1–G4` golden capture, `M1 --phase sim --provider all`, `K1-SIM` kit) may run beside an active Moodle-lane stack (up to **`2` LA stacks total** across all sessions); its `moodle` container is started and seeded by `stack:up` + `seed`, but no suite drives it after seed.
   - **Browser suites `M2` (`run-m2.mjs`) and `K2` (`run-k2.mjs`) must run with no other stack starting, seeding, or tearing down at the same time** (preventing the `D2` `M2-11` concurrent startup + `.mbz` build flake). In the schedule below, **`M2` (`qalead-la-121`, `qalead-la-138`, `qalead-la-152`) and `K2` (`qa-e2e-la-sim-r11`) are scheduled solo (`0` other LA stacks active)**.
2. **Explicit Planned Overlaps & Flake Rerun Rule (`LD-31` & `TEST-STRATEGY.md` §2.6):**
   - Slots **R0**, **R1**, **R2a**, **R2b**, **R3-B**, and **R3-D** run **solo (`1` LA stack at a time, `0` overlaps)**.
   - Only **two** planned overlaps exist in the entire re-gate, both in Slot R3 between one active Moodle-lane workload and one non-`M2`/`K2` SIM-lane workload:

| Overlap ID | Slot / Phase & Duration | Active Moodle-Lane Stack (`1` driving Moodle) | Concurrent Non-`M2`/`K2` SIM-Lane Stack (`1` idle Moodle after `seed`) | Why Allowed Under `LD-31` & Flake Handling (`TEST-STRATEGY.md` §2.6) |
| --- | --- | --- | --- | --- |
| **Overlap #1** | **Phase R3-A** (`28 min` overlap within `66 min` phase) | **Lead QA 1 (`D3` Moodle):** `qalead-la-130..137` (`T7 × 3`, `T2a–T8`) on `PUBLIC_PORT=9543`, `STACK_SUBNET=172.21.0.0/16` (`66 min`) | **Lead QA 2 (`D4` SIM non-`M2`):** `qalead-la-150` (`golden v2`, `4 min`) and `qalead-la-151` (`M1 --phase sim --provider all`, `24 min`) on `PUBLIC_PORT=9643`, `STACK_SUBNET=172.22.0.0/16` (`28 min`) | `<= 2` LA stacks total; `1` active Moodle workload (`9543`) + `1` non-`M2`/`K2` SIM workload (`9643`). `D4`'s `M2` (`qalead-la-152`) is held until Phase R3-B so `M2` never overlaps stack startup/seed/teardown. Any failure under overlap is rerun alone and recorded as a flake finding, never silently `PASS`. |
| **Overlap #2** | **Phase R3-C** (`36 min` overlap within `66 min` phase) | **Lead QA 2 (`D4` Moodle):** `qalead-la-153..160` (`T7 × 3`, `T2a–T8`) on `PUBLIC_PORT=9563`, `STACK_SUBNET=172.25.0.0/16` (`66 min`) | **Lead QA 1 (`D3` SIM non-`M2`):** `qalead-la-139` (`golden v2`, `4 min`), `qalead-la-140` (`M1 --phase sim --provider all`, `24 min`), and `qalead-la-141` (`5`-channel `K1-SIM`, `8 min`, fed by `D3`'s completed `130`/`131`/`137` wave outputs) on `PUBLIC_PORT=9473`, `STACK_SUBNET=172.23.0.0/16` (`36 min`) | `<= 2` LA stacks total; `1` active Moodle workload (`9563`) + `1` non-`M2`/`K2` SIM workload (`9473`). `D3`'s `M2` (`qalead-la-138`) already ran solo in Phase R3-B, and `D4`'s `K1-SIM` (`qalead-la-161`) runs solo in Phase R3-D after `D4`'s `T8` (`160`) finishes. Any failure under overlap is rerun alone and recorded as a flake finding, never silently `PASS`. |

3. **Zero `COMPOSE_PROJECT_NAME` Reuse (`qalead-la-1..105` retired):**
   - **`qalead-la-110..112`**: `Lead QA 2` (`golden v2` capture × 2 on `78971b03` + dry-run on `4f10c5fd`, SIM lane `PUBLIC_PORT=9643`, `STACK_SUBNET=172.22.0.0/16`, executed solo).
   - **`qa4-la-walk-r2`**: `QA-K` (6-channel walk-clone `K1-SIM` on `la-walk` `d6196d52` + kit tree `d7e50b5d` + `acme-lms.json`, SIM lane `PUBLIC_PORT=9443`, `STACK_SUBNET=172.20.0.0/16`, **DONE** solo in `7.4 min` at `9b10f07c`, `234/234 PASS`).
   - **`qa-e2e-la-sim-r11`**: `QA-E2E` (`K2` `U1–U4` on `4f10c5fd` / `src-final-3`, SIM lane `PUBLIC_PORT=9443`, `STACK_SUBNET=172.20.0.0/16`, runs **solo** per `LD-31` with `0` other stacks starting/seeding/tearing down).
   - **`qalead-la-120..129`**: `Lead QA 1` (`baseline-3` runs on `78971b03`, SIM lane `PUBLIC_PORT=9473` / `172.23.0.0/16` and Moodle lane `PUBLIC_PORT=9543` / `172.21.0.0/16`, executed sequentially `1` stack at a time, with `qalead-la-121` `M2` solo per `LD-31`).
   - **`qalead-la-130..141`**: `Lead QA 1` (`D3` full run on `4f10c5fd` / `la-final-test-3`: Moodle `qalead-la-130..137` on `9543` / `172.21.0.0/16` in Phase R3-A; solo `M2` `qalead-la-138` on `9473` / `172.23.0.0/16` in Phase R3-B; non-`M2` SIM `qalead-la-139..141` on `9473` / `172.23.0.0/16` in Phase R3-C).
   - **`qalead-la-150..161`**: `Lead QA 2` (`D4` full run on `4f10c5fd` / `la-final-test-3`: non-`M2` SIM `qalead-la-150..151` on `9643` / `172.22.0.0/16` in Phase R3-A; solo `M2` `qalead-la-152` on `9643` / `172.22.0.0/16` in Phase R3-B; Moodle `qalead-la-153..160` on `9563` / `172.25.0.0/16` in Phase R3-C; solo `K1-SIM` `qalead-la-161` on `9643` / `172.22.0.0/16` in Phase R3-D after `qalead-la-160` `T8` completes).

---

### (c) Complete Re-Gate Run List, Owners, Slots, Ports, Subnets, Time Estimates, and Reasons

| Slot / Phase | Compose Project | Owner | Lane / Port / Subnet | Product SHA & Gate Source | Suite & Post-Run Step | Est. Time & Overlap Status | Reason for Rerun / Not-Rerun |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Slot R0** (Golden v2) | `qalead-la-110` | **Lead QA 2** | SIM (`9643`, `172.22.0.0/16`) | `78971b03` (`la-qa`) | `golden v2` baseline capture #1 (`G1–G4` incl. Moodle segment) | `4 min` (solo, executed) | Closes `LA-E0-03` Fix Round 1 (`A-LA-E0-03-01..03`, `B-LA-E0-03-01..02`): re-captures `G1–G4` on `78971b03` with the live Moodle SIM segment into `tests/ltiaas/golden/78971b0300ab171029e8ce94dbba30db37b23dea/`. |
| **Slot R0** (Golden v2) | `qalead-la-111` | **Lead QA 2** | SIM (`9643`, `172.22.0.0/16`) | `78971b03` (`la-qa`) | `golden v2` baseline capture #2 + `0`-drift diff vs. #1 | `4 min` (solo, executed) | Proves `0` non-deterministic drift between two independent `78971b03` `golden v2` captures (`AC-LA-E0-03-01`). |
| **Slot R0** (Golden v2) | `qalead-la-112` | **Lead QA 2** | SIM (`9643`, `172.22.0.0/16`) | `4f10c5fd` (`la-qa`) | `golden v2` candidate dry-run capture + `compare.mjs` vs. `78971b03` | `5 min` (solo, executed) | Verifies that every `78971b03 -> 4f10c5fd` golden difference (`29` entries incl. `LA-IC-01` & `LA-IC-12` Moodle deltas) is explained by an `LA-IC-*` expected file (`0` unexplained, `0` missing expected). |
| **Slot R2a** (Walk-Clone 6-Channel Kit `K1-SIM` — **DONE**) | `qa4-la-walk-r2` | **QA-K** | SIM (`9443`, `172.20.0.0/16`) | `la-walk` `d6196d52` + kit tree `d7e50b5d` (`a3953243`) + `acme-lms.json` (kit tree `3c82b609`) | `LA_K1_KIT_FROM="$WALK_CLONE/tests/ltiaas/kit" LA_K1_WAVE_SPEC=.../wave-spec-r8.json node tests/ltiaas/kit/run-k1sim.mjs --sha d6196d52...` (no `--replace-tests`; the runner copied the kit only) (`6` channels, `234/234 PASS`) | `7.4 min` (**DONE** solo at `9b10f07c`, `0` overlaps) | Closes `F-LA-E7-06-WALK-02` (`LD-30`) and `LA-E8-02` (`docs/reviews/LA-E8-02/qa.md` Round 3, `234/234 PASS` + `6/6` host checks `PASS`). Reproducible invocation in §10(d).8 below. |
| **Slot R2b** (`K2` `U1–U4`, solo per `LD-31`) | `qa-e2e-la-sim-r11` | **QA-E2E** | SIM (`9443`, `172.20.0.0/16`) | `4f10c5fd`, `src-final-3` (`la-final-test-3`) | `node "$SRC_FINAL_3/tests/e2e/ltiaas/run-k2.mjs" --suite k2 --sha 4f10c5fd... --source "$SRC_FINAL_3" --replace-tests --tests-from "$SRC_FINAL_3/tests"` (`12` `K2` `U1–U4` cases) | `4 min` (**solo per `LD-31`**, `0` overlaps) | Closes `AC-LA-E7-09-04` (`K2` `U1–U4` browser journeys) on `4f10c5fd` (`docs/team/ltiaas/briefs/p4/QA-E2E-k2r6.md`). Runs solo with no other stack starting, seeding, or tearing down (`LD-31`). |
| **Slot R1** (`baseline-3` SIM) | `qalead-la-120` | **Lead QA 1** | SIM (`9473`, `172.23.0.0/16`) | `78971b03`, `src-baseline-3` (`baseline-3`) | `M1 --phase sim --provider all` (`394` rows) + `rate-peaks.mjs --suite m1-sim` | `24 min` (solo, `0` overlaps) | Re-captures `M1 sim` baseline on `78971b03` (includes B/C `9eb504f5` `M1-37` dead-handler tests + `4008afb9` player tracker fix) and records `app`/`LTI` rate peaks (`AC-LA-E0-02-01, -05, -07`). |
| **Slot R1** (`baseline-3` SIM, solo per `LD-31`) | `qalead-la-121` | **Lead QA 1** | SIM (`9473`, `172.23.0.0/16`) | `78971b03`, `src-baseline-3` (`baseline-3`) | `M2` browser suite (`64` cases) + `rate-peaks.mjs --suite m2` | `4 min` (**solo per `LD-31`**, `0` overlaps) | Re-captures `M2` baseline on `78971b03` (includes B/C `5561e8f7` `06-keyboard-axe.m2.ts` `routeFocusSettled`) with `0` other stacks starting/seeding/tearing down (`AC-LA-E0-02-02, -05, -07`). |
| **Slot R1** (`baseline-3` Moodle) | `qalead-la-122` | **Lead QA 1** | Moodle (`9543`, `172.21.0.0/16`) | `78971b03`, `src-baseline-3` (`baseline-3`) | `T7 × 3` (`run-t7.mjs --runs 3 --replace-e2e`) + `rate-peaks.mjs --suite t7-run1` & `t7-all3runs` | `11 min` (solo, `0` overlaps) | Re-captures `T7 × 3` (`3 × 17 PASS + 1 SKIP`) on `78971b03` (includes B/C `97b68af4` `isCloneEnvSecret`) and records `app`/`LTI` rate peaks (`AC-LA-E0-02-04, -06, -07`). |
| **Slot R1** (`baseline-3` Moodle) | `qalead-la-123` | **Lead QA 1** | Moodle (`9543`, `172.21.0.0/16`) | `78971b03`, `src-baseline-3` (`baseline-3`) | `T2a, T2b, T3a, T3b` (`run-t2.mjs --tasks T2a,T2b,T3a,T3b`) + `rate-peaks.mjs --suite t2-t3ab` | `10 min` (solo, `0` overlaps) | Closes `A-LA-E0-02-01` & `B-LA-E0-02-01`: records baseline result, wall time, and `app`/`LTI` rate peaks for legacy group `T2a, T2b, T3a, T3b` on `78971b03`. |
| **Slot R1** (`baseline-3` Moodle) | `qalead-la-124` | **Lead QA 1** | Moodle (`9543`, `172.21.0.0/16`) | `78971b03`, `src-baseline-3` (`baseline-3`) | `T3c` (`run-t3c.mjs`) + `rate-peaks.mjs --suite t3c` | `3 min` (solo, `0` overlaps) | Closes `A-LA-E0-02-01` & `B-LA-E0-02-01`: records baseline result, wall time, and `app`/`LTI` rate peaks for legacy group `T3c` on `78971b03`. |
| **Slot R1** (`baseline-3` Moodle) | `qalead-la-125` | **Lead QA 1** | Moodle (`9543`, `172.21.0.0/16`) | `78971b03`, `src-baseline-3` (`baseline-3`) | `T4a` (`run-t4a.mjs`) + `rate-peaks.mjs --suite t4a` | `2 min` (solo, `0` overlaps) | Closes `A-LA-E0-02-01` & `B-LA-E0-02-01`: records baseline result, wall time, and `app`/`LTI` rate peaks for legacy group `T4a` on `78971b03`. |
| **Slot R1** (`baseline-3` Moodle) | `qalead-la-126` | **Lead QA 1** | Moodle (`9543`, `172.21.0.0/16`) | `78971b03`, `src-baseline-3` (`baseline-3`) | `T4b1, T4b2` (`run-t4b.mjs --tasks T4b1,T4b2`) + `rate-peaks.mjs --suite t4b` | `6 min` (solo, `0` overlaps) | Closes `A-LA-E0-02-01` & `B-LA-E0-02-01`: records baseline result, wall time, and `app`/`LTI` rate peaks for legacy group `T4b1, T4b2` on `78971b03`. |
| **Slot R1** (`baseline-3` Moodle) | `qalead-la-127` | **Lead QA 1** | Moodle (`9543`, `172.21.0.0/16`) | `78971b03`, `src-baseline-3` (`baseline-3`) | `T5a, T5b` (`run-t5.mjs --tasks T5a,T5b`) + `rate-peaks.mjs --suite t5a-t5b` | `17 min` (solo, `0` overlaps) | Closes `A-LA-E0-02-01` & `B-LA-E0-02-01`: records baseline result, wall time, and `app`/`LTI` rate peaks for `T5a, T5b` on `78971b03` (includes B/C `4008afb9` player fix + `r4` `seenPages` wait). |
| **Slot R1** (`baseline-3` Moodle) | `qalead-la-128` | **Lead QA 1** | Moodle (`9543`, `172.21.0.0/16`) | `78971b03`, `src-baseline-3` (`baseline-3`) | `T5a, T6` (`run-t5.mjs --tasks T5a,T6`) + `rate-peaks.mjs --suite t5a-t6` | `8 min` (solo, `0` overlaps) | Closes `A-LA-E0-02-01` & `B-LA-E0-02-01`: records clean `PASS` baseline result, wall time, and `app`/`LTI` rate peaks for `T6` on `78971b03` (includes B/C `e1a057be`+`620c03d0`+`5561e8f7` + `r4`/`r8`). |
| **Slot R1** (`baseline-3` Moodle) | `qalead-la-129` | **Lead QA 1** | Moodle (`9543`, `172.21.0.0/16`) | `78971b03`, `src-baseline-3` (`baseline-3`) | `T8` (`run-t8.mjs`) + `rate-peaks.mjs --suite t8` | `9 min` (solo, `0` overlaps) | Closes `A-LA-E0-02-01` & `B-LA-E0-02-01`: records clean `PASS` baseline result, wall time, and `app`/`LTI` rate peaks for `T8` on `78971b03` (includes B/C `e1a057be`+`620c03d0` + `r7`/`r8`). |
| **Phase R3-A** (`D3` Moodle #1) | `qalead-la-130` | **Lead QA 1** (`D3`) | Moodle (`9543`, `172.21.0.0/16`) | `4f10c5fd`, `src-final-3` (`la-final-test-3`) | `T7 × 3` (`run-t7.mjs --runs 3 --replace-e2e`) | `11 min` (**Overlap #1** with `150..151`) | `D3` (run 1 of double full run on `4f10c5fd`, `LD-29` / `AC-LA-E7-09-01, -05`). Wave output `$SRC_FINAL_3/tests/e2e/artifacts/runs/qalead-la-130-*/summary.json` (`suite: "T7"`) feeds `D3` `K1-SIM` (`qalead-la-141`). |
| **Phase R3-A** (`D3` Moodle #2) | `qalead-la-131` | **Lead QA 1** (`D3`) | Moodle (`9543`, `172.21.0.0/16`) | `4f10c5fd`, `src-final-3` (`la-final-test-3`) | `T2a, T2b, T3a, T3b` (`run-t2.mjs --tasks T2a,T2b,T3a,T3b`) | `10 min` (**Overlap #1** with `151`) | `D3` legacy Moodle LTI core & Dynamic Registration (`AC-LA-E7-09-02, -05`). Wave output `$SRC_FINAL_3/tests/host/artifacts/qalead-la-131-*/summary.json` (`suite: "T3b"`) feeds `D3` `K1-SIM` (`qalead-la-141`). |
| **Phase R3-A** (`D3` Moodle #3) | `qalead-la-132` | **Lead QA 1** (`D3`) | Moodle (`9543`, `172.21.0.0/16`) | `4f10c5fd`, `src-final-3` (`la-final-test-3`) | `T3c` (`run-t3c.mjs`) | `3 min` (**Overlap #1** with `151`) | `D3` legacy Moodle compatibility (`AC-LA-E7-09-02, -05`). |
| **Phase R3-A** (`D3` Moodle #4) | `qalead-la-133` | **Lead QA 1** (`D3`) | Moodle (`9543`, `172.21.0.0/16`) | `4f10c5fd`, `src-final-3` (`la-final-test-3`) | `T4a` (`run-t4a.mjs`) | `2 min` (**Overlap #1** with `151`) | `D3` legacy Moodle Deep Linking API (`AC-LA-E7-09-02, -05`). |
| **Phase R3-A** (`D3` Moodle #5) | `qalead-la-134` | **Lead QA 1** (`D3`) | Moodle (`9543`, `172.21.0.0/16`) | `4f10c5fd`, `src-final-3` (`la-final-test-3`) | `T4b1, T4b2` (`run-t4b.mjs --tasks T4b1,T4b2`) | `6 min` (**Overlap #1** with `151` first `2m`, then solo) | `D3` legacy Moodle connect/isolation/adoption (`AC-LA-E7-09-02, -05`). |
| **Phase R3-A** (`D3` Moodle #6) | `qalead-la-135` | **Lead QA 1** (`D3`) | Moodle (`9543`, `172.21.0.0/16`) | `4f10c5fd`, `src-final-3` (`la-final-test-3`) | `T5a, T5b` (`run-t5.mjs --tasks T5a,T5b`) | `17 min` (solo after `151` finishes) | `D3` legacy Moodle SCORM/HTML player & conflict resend (`AC-LA-E7-09-02, -05`; tests `4008afb9` + `r4` `WE-F10`). |
| **Phase R3-A** (`D3` Moodle #7) | `qalead-la-136` | **Lead QA 1** (`D3`) | Moodle (`9543`, `172.21.0.0/16`) | `4f10c5fd`, `src-final-3` (`la-final-test-3`) | `T5a, T6` (`run-t5.mjs --tasks T5a,T6`) | `8 min` (solo) | `D3` legacy Moodle portal & courses (`AC-LA-E7-09-02, -05`; tests `r8` combined `T6/3-courses.spec.ts` & `T6/5-xss-a11y.spec.ts`). |
| **Phase R3-A** (`D3` Moodle #8) | `qalead-la-137` | **Lead QA 1** (`D3`) | Moodle (`9543`, `172.21.0.0/16`) | `4f10c5fd`, `src-final-3` (`la-final-test-3`) | `T8` (`run-t8.mjs`) | `9 min` (solo) | `D3` legacy Moodle course shell (`AC-LA-E7-09-02, -05`; tests `r8` combined `T8/2-shell.spec.ts`). Wave output `$SRC_FINAL_3/tests/host/artifacts/qalead-la-137-*/summary.json` (`suite: "T8"`) feeds `D3` `K1-SIM` (`qalead-la-141`). |
| **Phase R3-A** (`D4` SIM #1, non-`M2` overlap) | `qalead-la-150` | **Lead QA 2** (`D4`) | SIM (`9643`, `172.22.0.0/16`) | `4f10c5fd`, `src-final-3-d4` (`la-final-test-3` w/ golden v2) | `G1–G4` `golden v2` capture + `compare.mjs` vs. `78971b03` (`tests/ltiaas/golden/78971b0300ab171029e8ce94dbba30db37b23dea`) | `4 min` (**Overlap #1** with `130`) | `D4` golden v2 capture & compare against `78971b03`: every difference names its `LA-IC` expected file (`0` unexplained, `0` missing expected; `AC-LA-E0-01-04`, `AC-LA-E7-08-03`). |
| **Phase R3-A** (`D4` SIM #2, non-`M2` overlap) | `qalead-la-151` | **Lead QA 2** (`D4`) | SIM (`9643`, `172.22.0.0/16`) | `4f10c5fd`, `src-final-3-d4` (`la-final-test-3`) | `M1 --phase sim --provider all` (`394` rows) | `24 min` (**Overlap #1** with `130..134`) | `D4` `M1 sim` (`394/394 PASS` incl. B/C `9eb504f5` `M1-37` dead-handler rows & `r8` `m1-control.mjs`, `AC-LA-E7-08-01`). |
| **Phase R3-B** (`D3` SIM `M2`, solo per `LD-31`) | `qalead-la-138` | **Lead QA 1** (`D3`) | SIM (`9473`, `172.23.0.0/16`) | `4f10c5fd`, `src-final-3` (`la-final-test-3`) | `M2` browser suite (`64` cases) | `4 min` (**solo per `LD-31`**, `0` overlaps) | `D3` `M2` (`64/64 PASS` incl. B/C `5561e8f7` `06-keyboard-axe.m2.ts`, `AC-LA-E7-08-01`). Runs solo after `137` and `151` are torn down so no other stack starts, seeds, or tears down during `M2` (`LD-31`). |
| **Phase R3-B** (`D4` SIM `M2`, solo per `LD-31`) | `qalead-la-152` | **Lead QA 2** (`D4`) | SIM (`9643`, `172.22.0.0/16`) | `4f10c5fd`, `src-final-3-d4` (`la-final-test-3`) | `M2` browser suite (`64` cases) | `4 min` (**solo per `LD-31`**, `0` overlaps) | `D4` `M2` (`64/64 PASS` incl. B/C `5561e8f7` `06-keyboard-axe.m2.ts`, `AC-LA-E7-08-01`). Runs solo immediately after `qalead-la-138` tears down (`LD-31`). |
| **Phase R3-C** (`D4` Moodle #1) | `qalead-la-153` | **Lead QA 2** (`D4`) | Moodle (`9563`, `172.25.0.0/16`) | `4f10c5fd`, `src-final-3-d4` (`la-final-test-3`) | `T7 × 3` (`run-t7.mjs --runs 3 --replace-e2e`) | `11 min` (**Overlap #2** with `139..140`) | `D4` (run 2 of double full run on `4f10c5fd`, `LD-29` / `AC-LA-E7-09-01, -05`). Wave output `$SRC_FINAL_3_D4/tests/e2e/artifacts/runs/qalead-la-153-*/summary.json` (`suite: "T7"`) feeds `D4` `K1-SIM` (`qalead-la-161`). |
| **Phase R3-C** (`D4` Moodle #2) | `qalead-la-154` | **Lead QA 2** (`D4`) | Moodle (`9563`, `172.25.0.0/16`) | `4f10c5fd`, `src-final-3-d4` (`la-final-test-3`) | `T2a, T2b, T3a, T3b` (`run-t2.mjs --tasks T2a,T2b,T3a,T3b`) | `10 min` (**Overlap #2** with `140`) | `D4` legacy Moodle LTI core & Dynamic Registration (`AC-LA-E7-09-02, -05`). Wave output `$SRC_FINAL_3_D4/tests/host/artifacts/qalead-la-154-*/summary.json` (`suite: "T3b"`) feeds `D4` `K1-SIM` (`qalead-la-161`). |
| **Phase R3-C** (`D4` Moodle #3) | `qalead-la-155` | **Lead QA 2** (`D4`) | Moodle (`9563`, `172.25.0.0/16`) | `4f10c5fd`, `src-final-3-d4` (`la-final-test-3`) | `T3c` (`run-t3c.mjs`) | `3 min` (**Overlap #2** with `140`) | `D4` legacy Moodle compatibility (`AC-LA-E7-09-02, -05`). |
| **Phase R3-C** (`D4` Moodle #4) | `qalead-la-156` | **Lead QA 2** (`D4`) | Moodle (`9563`, `172.25.0.0/16`) | `4f10c5fd`, `src-final-3-d4` (`la-final-test-3`) | `T4a` (`run-t4a.mjs`) | `2 min` (**Overlap #2** with `140`) | `D4` legacy Moodle Deep Linking API (`AC-LA-E7-09-02, -05`). |
| **Phase R3-C** (`D4` Moodle #5) | `qalead-la-157` | **Lead QA 2** (`D4`) | Moodle (`9563`, `172.25.0.0/16`) | `4f10c5fd`, `src-final-3-d4` (`la-final-test-3`) | `T4b1, T4b2` (`run-t4b.mjs --tasks T4b1,T4b2`) | `6 min` (**Overlap #2** with `140..141`) | `D4` legacy Moodle connect/isolation/adoption (`AC-LA-E7-09-02, -05`). |
| **Phase R3-C** (`D4` Moodle #6) | `qalead-la-158` | **Lead QA 2** (`D4`) | Moodle (`9563`, `172.25.0.0/16`) | `4f10c5fd`, `src-final-3-d4` (`la-final-test-3`) | `T5a, T5b` (`run-t5.mjs --tasks T5a,T5b`) | `17 min` (**Overlap #2** with `141` first `4m`, then solo) | `D4` legacy Moodle SCORM/HTML player & conflict resend (`AC-LA-E7-09-02, -05`). |
| **Phase R3-C** (`D4` Moodle #7) | `qalead-la-159` | **Lead QA 2** (`D4`) | Moodle (`9563`, `172.25.0.0/16`) | `4f10c5fd`, `src-final-3-d4` (`la-final-test-3`) | `T5a, T6` (`run-t5.mjs --tasks T5a,T6`) | `8 min` (solo) | `D4` legacy Moodle portal & courses (`AC-LA-E7-09-02, -05`). |
| **Phase R3-C** (`D4` Moodle #8) | `qalead-la-160` | **Lead QA 2** (`D4`) | Moodle (`9563`, `172.25.0.0/16`) | `4f10c5fd`, `src-final-3-d4` (`la-final-test-3`) | `T8` (`run-t8.mjs`) | `9 min` (solo) | `D4` legacy Moodle course shell (`AC-LA-E7-09-02, -05`). Wave output `$SRC_FINAL_3_D4/tests/host/artifacts/qalead-la-160-*/summary.json` (`suite: "T8"`) feeds `D4` `K1-SIM` (`qalead-la-161`). |
| **Phase R3-C** (`D3` SIM #1, non-`M2` overlap) | `qalead-la-139` | **Lead QA 1** (`D3`) | SIM (`9473`, `172.23.0.0/16`) | `4f10c5fd`, `src-final-3` (`la-final-test-3` w/ golden v2) | `G1–G4` `golden v2` capture + `compare.mjs` vs. `78971b03` (`tests/ltiaas/golden/78971b0300ab171029e8ce94dbba30db37b23dea`) | `4 min` (**Overlap #2** with `153`) | `D3` golden v2 capture & compare against `78971b03`: every difference names its `LA-IC` expected file (`0` unexplained, `0` missing expected; `AC-LA-E0-01-04`, `AC-LA-E7-08-03`). |
| **Phase R3-C** (`D3` SIM #2, non-`M2` overlap) | `qalead-la-140` | **Lead QA 1** (`D3`) | SIM (`9473`, `172.23.0.0/16`) | `4f10c5fd`, `src-final-3` (`la-final-test-3`) | `M1 --phase sim --provider all` (`394` rows) | `24 min` (**Overlap #2** with `153..157`) | `D3` `M1 sim` (`394/394 PASS` incl. B/C `9eb504f5` `M1-37` dead-handler rows & `r8` `m1-control.mjs`, `AC-LA-E7-08-01`). |
| **Phase R3-C** (`D3` SIM #3, non-`M2` overlap) | `qalead-la-141` | **Lead QA 1** (`D3`) | SIM (`9473`, `172.23.0.0/16`) | `4f10c5fd`, `src-final-3` (`la-final-test-3`, kit tree `d7e50b5d`) | `LA_K1_KIT_FROM="$SRC_FINAL_3/tests/ltiaas/kit" LA_K1_WAVE_SPEC="$REGATEDIR/wave-spec-d3.json" node "$SRC_FINAL_3/tests/ltiaas/kit/run-k1sim.mjs" --sha 4f10c5fd... --source "$SRC_FINAL_3" --replace-tests --tests-from "$SRC_FINAL_3/tests"` (`5` shipped channels, `195` cases) | `8 min` (**Overlap #2** with `157..158`) | `D3` `K1-SIM` kit run on integration `4f10c5fd` (`5` channels, kit tree `d7e50b5dea56382f849b213f006b73bcf5eb71aa`, bound to `D3`'s own `qalead-la-130`/`131`/`137` `summary.json` wave outputs; `LD-30` / `AC-LA-E7-08-02`). |
| **Phase R3-D** (`D4` SIM `K1-SIM`, solo after `160`) | `qalead-la-161` | **Lead QA 2** (`D4`) | SIM (`9643`, `172.22.0.0/16`) | `4f10c5fd`, `src-final-3-d4` (`la-final-test-3`, kit tree `d7e50b5d`) | `LA_K1_KIT_FROM="$SRC_FINAL_3_D4/tests/ltiaas/kit" LA_K1_WAVE_SPEC="$REGATEDIR/wave-spec-d4.json" node "$SRC_FINAL_3_D4/tests/ltiaas/kit/run-k1sim.mjs" --sha 4f10c5fd... --source "$SRC_FINAL_3_D4" --replace-tests --tests-from "$SRC_FINAL_3_D4/tests"` (`5` shipped channels, `195` cases) | `8 min` (solo after `160` finishes, `0` overlaps) | `D4` `K1-SIM` kit run on integration `4f10c5fd` (`5` channels, kit tree `d7e50b5dea56382f849b213f006b73bcf5eb71aa`, bound to `D4`'s own completed `qalead-la-153`/`154`/`160` `summary.json` wave outputs; `LD-30` / `AC-LA-E7-08-02`). |
| **Not Rerun** (Carried) | `qalead-la-18`, `qalead-la-19` (Slot 7) & `qalead-la-61`, `qalead-la-62` (Slot 3F) | **Lead QA 1** | SIM (carried) | `1b17261` / `78971b03` & `a8bbac53` / `4f10c5fd` | `M1 --phase migration` (`12/12 PASS`) & `M1 --phase snapshot-upgrade` (`6/6 PASS`) | `0 min` (carried) | **Why not rerun:** `git diff --stat bd368ff..78971b03 -- services/lti-service/src/db/migrations services/cogniate-app/src/domain/migrations infra/scripts/stack-data* infra/compat/ tests/host/m1-migration.mjs` is **empty (`0` files changed)**, and `git diff --stat a8bbac53..4f10c5fd -- services/lti-service services/cogniate-app infra/scripts/stack-data* infra/compat/ tests/host/m1-migration.mjs` is **empty (`0` files changed)**. Only `infra/README.md` (`1` doc file, `0` executable infrastructure changes) and `apps/player/src/html/tracker.ts` (`4008afb9`) changed outside `tests/`. |
| **Not Rerun** (Carried) | `qalead-la-13-80133d6b-2026-10-23T17-11-52-676Z` (combined `LA-E5-08` + `LA-E5-22`) and `qa-e2e-la-s8b-r1-a7bd110e-2026-10-24T01-31-21-479Z` (Slot 8b live `LA-E7-09`) | **Lead QA 1** / **QA-E2E** | SIM & Moodle (carried) | SIM build `80133d6b662dd4fb8e18a9eed62e3160d2b2a1c5` (product `02f5d4200e3f27d5eca9530a5aa39840124156ed`); live test build `a7bd110e9c6d504c69a6c0608cbdeef80feff942` (product `8fadb828088ffe1b4db02179ab0fa3ab2388a12a`) | `U1`/`U2` continuity: combined SIM summary `/Users/quangnguyen/cogniate-qa-runs/LA/LA-E7-08/slot3b-80133d6b/artifacts/qalead-la-13-80133d6b-2026-10-23T17-11-52-676Z/summary.json` has **43 entries: 37 PASS, 6 INFO; 17 PASS aggregate IDs**. Live summary `/Users/quangnguyen/orca/workspaces/cogniate_moodle_integration_prototype/la-qa/tests/host/artifacts/qa-e2e-la-s8b-r1-a7bd110e-2026-10-24T01-31-21-479Z/summary.json` has **16/16 PASS entries and aggregate IDs**, including preparation, restart and continuity rows. No separate app run or final-SHA live execution is claimed. | `0 min` (carried) | **Why not rerun (`B-LA-E7-08-LD9-R8-02`):** `git diff --stat a8bbac53..4f10c5fd -- services/lti-service services/cogniate-app packages/` is empty (`0` files changed); only `infra/README.md` changed under `infra/`. The same service/package diff is empty from the actual live product `8fadb828`. The actual SIM source `80133d6b` has an empty schema/key-provider/sealing/storage diff for the explicit paths in [QA §14.6](../../docs/reviews/LA-E7-08/qa.md#146-carried-checks-and-frozenstorage-audits). |
| **Not Rerun** (Carried) | `qa-e2e-la-drill-r2` (`LA-E5-24`) | **QA-E2E** | SIM `K1-SIM` (carried) | `5603861886909667a03d2aaf7843a9b17a4020ed` | `LA-E5-24` pilot backup and restore drill (`10/10 PASS` — `6/6` ACs `AC-LA-E5-24-01..06` + `4/4` host rows in `docs/reviews/LA-E5-24/qa.md:96`, artifacts in `/Users/quangnguyen/cogniate-qa-runs/LA/LA-E5-24/r2/artifacts/qa-e2e-la-drill-r2-56038618-2026-10-23T20-36-36-947Z/`) | `0 min` (carried) | **Why not rerun (`A-LA-E7-08-LD9-R8-05` & `B-LA-E7-08-LD9-R8-02`):** `git diff --stat 5603861886909667a03d2aaf7843a9b17a4020ed..4f10c5fd9ca4dd0a5f636b34d7454e0db7b6849c -- infra/scripts/stack-data* services/lti-service/src/db services/cogniate-app/src/domain` shows **`0` backup/restore script changes**; under `infra/`, only `infra/README.md` changed in the B/C merge (`0` executable infrastructure changes). |

---

### (d) Runner-Specific Reproducible Invocation & Kit Wave-Input Bindings (`A-LA-E7-08-LD9-R8-03..04` & `B-LA-E7-08-LD9-R8-01..03`)

Every run in §10(c) is reproduced from the exact shell variable definitions, runner flags, and environment bindings below (no implicit working-tree assumptions):

0. **Shared Environment Variables (initialized once at the top of every session):**
   ```bash
   export GATE_DIR="/Users/quangnguyen/cogniate-qa-runs/LA/GATE"
   export COURSE_FIXTURES_DIR="$GATE_DIR/course-fixtures"
   export REGATEDIR="/Users/quangnguyen/cogniate-qa-runs/LA/REGATE"
   export SRC_BASELINE_3="$GATE_DIR/src-baseline-3"
   export SRC_FINAL_3="$GATE_DIR/src-final-3"
   export SRC_FINAL_3_D4="$GATE_DIR/src-final-3-d4"
   export BASELINE_PRODUCT_SHA="78971b0300ab171029e8ce94dbba30db37b23dea"
   export BASELINE_3_SHA="1ae6716b7353becc0f053b46fb65e0ba86ff7873"
   export FINAL_PRODUCT_SHA="4f10c5fd9ca4dd0a5f636b34d7454e0db7b6849c"
   export FINAL_TEST_3_SHA="794f649c3ebacf1a1b3ac599cffffe338dd7373d"
   export LA_QA="/Users/quangnguyen/orca/workspaces/cogniate_moodle_integration_prototype/la-qa"
   mkdir -p "$REGATEDIR/rate-peaks"
   ```

1. **`M1` (`run-m1.mjs` — `qalead-la-120`, `qalead-la-140`, `qalead-la-151`):**
   - Uses `--sha <PRODUCT_SHA> --test-sha <GATE_TEST_SHA> --source <GATE_SRC_CLONE>`, which checks out `<PRODUCT_SHA>` and overlays `tests/` from `<GATE_TEST_SHA>` inside `<GATE_SRC_CLONE>`, and writes artifacts to `<GATE_SRC_CLONE>/tests/host/artifacts/<PROJECT>-*/`.
   ```bash
   COMPOSE_PROJECT_NAME=qalead-la-120 PUBLIC_PORT=9473 STACK_SUBNET="172.23.0.0/16" \
     node "$SRC_BASELINE_3/tests/host/run-m1.mjs" \
     --phase sim --provider all \
     --sha "$BASELINE_PRODUCT_SHA" \
     --test-sha "$BASELINE_3_SHA" \
     --source "$SRC_BASELINE_3"
   node "$LA_QA/tests/ltiaas/baseline/rate-peaks.mjs" \
     --logs "$(ls -d "$SRC_BASELINE_3"/tests/host/artifacts/qalead-la-120-*/service-logs | tail -n 1)" \
     --suite m1-sim > "$REGATEDIR/rate-peaks/qalead-la-120-m1-sim.json"
   ```

2. **`M2` (`run-m2.mjs` — `qalead-la-121`, `qalead-la-138`, `qalead-la-152`, always solo per `LD-31`):**
   - Uses `--sha <PRODUCT_SHA> --test-sha <GATE_TEST_SHA> --source <GATE_SRC_CLONE>` and `COURSE_FIXTURES_DIR="$COURSE_FIXTURES_DIR"`, with `0` other LA stacks running, starting, seeding, or tearing down, and writes artifacts to `<GATE_SRC_CLONE>/tests/host/artifacts/<PROJECT>-*/`.
   ```bash
   COMPOSE_PROJECT_NAME=qalead-la-121 PUBLIC_PORT=9473 STACK_SUBNET="172.23.0.0/16" \
     COURSE_FIXTURES_DIR="$COURSE_FIXTURES_DIR" \
     node "$SRC_BASELINE_3/tests/e2e/host/run-m2.mjs" \
     --sha "$BASELINE_PRODUCT_SHA" \
     --test-sha "$BASELINE_3_SHA" \
     --source "$SRC_BASELINE_3"
   node "$LA_QA/tests/ltiaas/baseline/rate-peaks.mjs" \
     --logs "$(ls -d "$SRC_BASELINE_3"/tests/host/artifacts/qalead-la-121-*/service-logs | tail -n 1)" \
     --suite m2 > "$REGATEDIR/rate-peaks/qalead-la-121-m2.json"
   ```

3. **`T7 × 3` (`run-t7.mjs` — `qalead-la-122`, `qalead-la-130`, `qalead-la-153`):**
   - Invoked directly from `"$GATE_SRC_CLONE/tests/e2e/host/run-t7.mjs"` with `--sha <PRODUCT_SHA> --runs 3 --replace-e2e` (`--replace-e2e` copies `tests/e2e/` from `$GATE_SRC_CLONE/tests/e2e` into the cloned product worktree before running), and writes artifacts to `"$GATE_SRC_CLONE/tests/e2e/artifacts/runs/<PROJECT>-*/"`.
   ```bash
   COMPOSE_PROJECT_NAME=qalead-la-122 PUBLIC_PORT=9543 STACK_SUBNET="172.21.0.0/16" \
     COURSE_FIXTURES_DIR="$COURSE_FIXTURES_DIR" \
     node "$SRC_BASELINE_3/tests/e2e/host/run-t7.mjs" \
     --sha "$BASELINE_PRODUCT_SHA" \
     --runs 3 --replace-e2e
   T7_122_DIR=$(ls -d "$SRC_BASELINE_3"/tests/e2e/artifacts/runs/qalead-la-122-* | tail -n 1)
   node "$LA_QA/tests/ltiaas/baseline/rate-peaks.mjs" \
     --logs "$T7_122_DIR/run1/service-logs" \
     --suite t7-run1 > "$REGATEDIR/rate-peaks/qalead-la-122-t7-run1.json"
   mkdir -p "$REGATEDIR/rate-peaks/t7-122-all3runs-logs"
   for s in cogniate-app.jsonl lti-service.jsonl; do
     cat "$T7_122_DIR"/run{1,2,3}/service-logs/"$s" > "$REGATEDIR/rate-peaks/t7-122-all3runs-logs/$s"
   done
   node "$LA_QA/tests/ltiaas/baseline/rate-peaks.mjs" \
     --logs "$REGATEDIR/rate-peaks/t7-122-all3runs-logs" \
     --suite t7-all3runs > "$REGATEDIR/rate-peaks/qalead-la-122-t7-all3runs.json"
   ```

4. **Legacy Moodle Suites `T2a–T8` (`run-t2.mjs`, `run-t3c.mjs`, `run-t4a.mjs`, `run-t4b.mjs`, `run-t5.mjs`, `run-t8.mjs` — `qalead-la-123..129`, `qalead-la-131..137`, `qalead-la-154..160`):**
   - Run under `umask 022` (so container `pwuser` `1000:1000` can read host-mounted `infra/.logs` and `infra/.data`), pass `--sha <PRODUCT_SHA> --source "$GATE_SRC_CLONE" --workdir <WORKDIR> --replace-tests --tests-from "$GATE_SRC_CLONE/tests"`, and write artifacts to `"$GATE_SRC_CLONE/tests/host/artifacts/<PROJECT>-*/"`.
   ```bash
   umask 022
   COMPOSE_PROJECT_NAME=qalead-la-123 PUBLIC_PORT=9543 STACK_SUBNET="172.21.0.0/16" \
     node "$SRC_BASELINE_3/tests/host/run-t2.mjs" \
     --sha "$BASELINE_PRODUCT_SHA" \
     --source "$SRC_BASELINE_3" \
     --workdir "$REGATEDIR/qalead-la-123-t2-t3ab" \
     --replace-tests --tests-from "$SRC_BASELINE_3/tests" \
     --tasks T2a,T2b,T3a,T3b
   node "$LA_QA/tests/ltiaas/baseline/rate-peaks.mjs" \
     --logs "$(ls -d "$SRC_BASELINE_3"/tests/host/artifacts/qalead-la-123-*/service-logs | tail -n 1)" \
     --suite t2-t3ab > "$REGATEDIR/rate-peaks/qalead-la-123-t2-t3ab.json"
   ```

5. **`Golden v2` Capture & Compare (`run-golden.mjs` & `compare.mjs` — `qalead-la-139` in `D3` and `qalead-la-150` in `D4`, `A-LA-E7-08-LD9-R8-03` & `B-LA-E7-08-LD9-R8-03`):**
   - Executed on the rebuilt `la-final-test-3` tree (containing the approved `LA-E0-03` golden v2 files and `LA-IC-01`/`LA-IC-12` Moodle expected deltas, `A-LA-E7-08-LD9-R8-01`). For `D3` (`PUBLIC_PORT=9473`), atomic port normalization reads each `G*.json` file into memory first, verifies non-empty valid JSON with `json.loads()`, writes to `.json.tmp`, and replaces the target via `os.replace()` before running `compare.mjs` against `tests/ltiaas/golden/78971b0300ab171029e8ce94dbba30db37b23dea/G*.json` (captured on `:9643`):
   ```bash
   COMPOSE_PROJECT_NAME=qalead-la-139 PUBLIC_PORT=9473 STACK_SUBNET="172.23.0.0/16" \
     node "$SRC_FINAL_3/tests/ltiaas/golden/run-golden.mjs" \
     --sha "$FINAL_PRODUCT_SHA" \
     --source "$SRC_FINAL_3" \
     --workdir "$REGATEDIR/qalead-la-139-golden" \
     --replace-tests --tests-from "$SRC_FINAL_3/tests" \
     --out "$REGATEDIR/d3-golden-4f10c5fd"
   rm -rf "$REGATEDIR/d3-golden-4f10c5fd-port9643"
   cp -R "$REGATEDIR/d3-golden-4f10c5fd" "$REGATEDIR/d3-golden-4f10c5fd-port9643"
   python3 - "$REGATEDIR/d3-golden-4f10c5fd-port9643" <<'PY'
   import json, os, pathlib, sys
   folder = pathlib.Path(sys.argv[1])
   files = sorted(folder.glob("G*.json"))
   assert len(files) == 4, f"Expected 4 G*.json files in {folder}, got {len(files)}"
   for p in files:
       raw = p.read_text(encoding="utf-8")
       assert len(raw) > 0, f"Empty file: {p}"
       updated = raw.replace(":9473", ":9643")
       json.loads(updated)
       tmp = p.with_suffix(".json.tmp")
       tmp.write_text(updated, encoding="utf-8")
       os.replace(tmp, p)
   PY
   node "$SRC_FINAL_3/tests/ltiaas/golden/compare.mjs" \
     --base "$SRC_FINAL_3/tests/ltiaas/golden/78971b0300ab171029e8ce94dbba30db37b23dea" \
     --candidate "$REGATEDIR/d3-golden-4f10c5fd-port9643" \
     --expected "LA-IC-01,LA-IC-03,LA-IC-04,LA-IC-12,LA-IC-13,LA-IC-14,LA-IC-15,LA-IC-16,LA-IC-17,LA-IC-18,LA-IC-19,LA-IC-20,LA-IC-21" \
     --expected-dir "$SRC_FINAL_3/tests/ltiaas/golden/expected"
   ```

6. **`K2` `U1–U4` (`run-k2.mjs` — `qa-e2e-la-sim-r11` in Slot R2b, solo per `LD-31` — DONE):**
   ```bash
   COMPOSE_PROJECT_NAME=qa-e2e-la-sim-r11 PUBLIC_PORT=9443 STACK_SUBNET="172.20.0.0/16" \
     COURSE_FIXTURES_DIR="$COURSE_FIXTURES_DIR" \
     node "$SRC_FINAL_3/tests/e2e/ltiaas/run-k2.mjs" \
     --suite k2 \
     --sha "$FINAL_PRODUCT_SHA" \
     --source "$SRC_FINAL_3" \
     --replace-tests --tests-from "$SRC_FINAL_3/tests"
   ```

7. **5-Channel Integration `K1-SIM` Kit (`run-k1sim.mjs` — `qalead-la-141` in `D3` and `qalead-la-161` in `D4`, `LD-30`, `A-LA-E7-08-LD9-R8-04` & `B-LA-E7-08-LD9-R8-01`):**
   - **Reviewed Kit Tree Proof:** `git -C "$SRC_FINAL_3" rev-parse HEAD:tests/ltiaas/kit` = `d7e50b5dea56382f849b213f006b73bcf5eb71aa` (`5` shipped channels in `tests/ltiaas/kit/channels/`: `blackboard.json`, `brightspace.json`, `canvas.json`, `lti-generic.json`, `moodle.json` -> `5 × 39 = 195` cases; **no `--channels` CLI flag is passed** because `run-k1sim.mjs` discovers all channel JSON files in `LA_K1_KIT_FROM/channels`).
   - **Wave-Input Schema & Artifact Paths (`tests/ltiaas/kit/lib/wave-producer.mjs`):** `writeWaveEvidence({ specs, runDir, waveId, repoRoot })` requires `specs` to be a **JSON array of `{ "suite": "T3b" | "T7" | "T8", "file": "<absolute path to host summary.json>" }` entries** (matching `/Users/quangnguyen/cogniate-qa-runs/LA/LA-E7-06/wave-spec-r8.json`):
     - **`T7` (`run-t7.mjs`, `e2e-summary`):** writes `summary.json` under `"$SRC_FINAL_3/tests/e2e/artifacts/runs/qalead-la-130-*/summary.json"` for `D3` (and `"$SRC_FINAL_3_D4/tests/e2e/artifacts/runs/qalead-la-153-*/summary.json"` for `D4`).
     - **`T3b` (`run-t2.mjs`, `host-summary`):** writes `summary.json` under `"$SRC_FINAL_3/tests/host/artifacts/qalead-la-131-*/summary.json"` for `D3` (and `"$SRC_FINAL_3_D4/tests/host/artifacts/qalead-la-154-*/summary.json"` for `D4`).
     - **`T8` (`run-t8.mjs`, `host-summary`):** writes `summary.json` under `"$SRC_FINAL_3/tests/host/artifacts/qalead-la-137-*/summary.json"` for `D3` (and `"$SRC_FINAL_3_D4/tests/host/artifacts/qalead-la-160-*/summary.json"` for `D4`).
     - Before starting `run-k1sim.mjs`, the operator runs a pure host preflight through `writeWaveEvidence()` on `$REGATEDIR/wave-spec-d3.json` (and `wave-spec-d4.json`) and asserts `res.ok === true`.
   ```bash
   # 1. Verify kit tree hash on src-final-3 and src-final-3-d4:
   test "$(git -C "$SRC_FINAL_3" rev-parse HEAD:tests/ltiaas/kit)" = "d7e50b5dea56382f849b213f006b73bcf5eb71aa"
   test "$(git -C "$SRC_FINAL_3_D4" rev-parse HEAD:tests/ltiaas/kit)" = "d7e50b5dea56382f849b213f006b73bcf5eb71aa"

   # 2. Write D3 wave-spec JSON array from D3's completed qalead-la-131 (T3b), qalead-la-130 (T7), and qalead-la-137 (T8) summary.json files:
   T3B_D3_SUMMARY=$(ls "$SRC_FINAL_3"/tests/host/artifacts/qalead-la-131-*/summary.json | tail -n 1)
   T7_D3_SUMMARY=$(ls "$SRC_FINAL_3"/tests/e2e/artifacts/runs/qalead-la-130-*/summary.json | tail -n 1)
   T8_D3_SUMMARY=$(ls "$SRC_FINAL_3"/tests/host/artifacts/qalead-la-137-*/summary.json | tail -n 1)
   cat > "$REGATEDIR/wave-spec-d3.json" <<EOF
   [
     { "suite": "T3b", "file": "$T3B_D3_SUMMARY" },
     { "suite": "T7",  "file": "$T7_D3_SUMMARY" },
     { "suite": "T8",  "file": "$T8_D3_SUMMARY" }
   ]
   EOF

   # 3. Preflight wave-spec-d3.json through writeWaveEvidence() before starting Docker:
   rm -rf "$REGATEDIR/wave-preflight-d3" && mkdir -p "$REGATEDIR/wave-preflight-d3"
   node --input-type=module -e '
     import fs from "node:fs";
     import { writeWaveEvidence } from "'"$SRC_FINAL_3"'/tests/ltiaas/kit/lib/wave-producer.mjs";
     const specs = JSON.parse(fs.readFileSync("'"$REGATEDIR"'/wave-spec-d3.json", "utf8"));
     const res = writeWaveEvidence({
       specs,
       runDir: "'"$REGATEDIR"'/wave-preflight-d3",
       waveId: "la-final-wave-4f10c5fd-d3",
       repoRoot: "'"$SRC_FINAL_3"'",
     });
     if (!res.ok) { console.error(res); process.exit(1); }
   '

   # 4. Run D3 5-channel K1-SIM (195 cases):
   COMPOSE_PROJECT_NAME=qalead-la-141 PUBLIC_PORT=9473 STACK_SUBNET="172.23.0.0/16" \
     COURSE_FIXTURES_DIR="$COURSE_FIXTURES_DIR" \
     LA_WAVE_ID="la-final-wave-4f10c5fd-d3" \
     LA_K1_WAVE_SPEC="$REGATEDIR/wave-spec-d3.json" \
     LA_K1_KIT_FROM="$SRC_FINAL_3/tests/ltiaas/kit" \
     node "$SRC_FINAL_3/tests/ltiaas/kit/run-k1sim.mjs" \
     --sha "$FINAL_PRODUCT_SHA" \
     --source "$SRC_FINAL_3" \
     --workdir "$REGATEDIR/qalead-la-141-k1sim" \
     --replace-tests --tests-from "$SRC_FINAL_3/tests"
   ```
   *(And identically for `D4` `qalead-la-161` on `PUBLIC_PORT=9643`, `STACK_SUBNET="172.22.0.0/16"` using `$SRC_FINAL_3_D4`, `LA_WAVE_ID="la-final-wave-4f10c5fd-d4"`, and `$REGATEDIR/wave-spec-d4.json` built from `qalead-la-154` `T3b`, `qalead-la-153` `T7`, and `qalead-la-160` `T8` under `$SRC_FINAL_3_D4`.)*

8. **6-Channel Walk-Clone `K1-SIM` Kit (`qa4-la-walk-r2` in Slot R2a — DONE `9b10f07c`, `234/234 PASS` in `docs/reviews/LA-E8-02/qa.md` Round 3, `B-LA-E7-08-LD9-R8-01`):**
   - **Walk-Clone Construction (`$WALK_CLONE` = `/Users/quangnguyen/cogniate-qa-runs/LA/LA-E7-06/walk2/clone`):** Fresh `git clone --no-hardlinks` of `la-walk` detached at `d6196d5242863e33f76a0b7d06c45554463bec6b`, overlaid in the working tree (preserving `HEAD = d6196d5242863e33f76a0b7d06c45554463bec6b` for `run-k1sim.mjs`'s `git checkout --force <sha>`) with `tests/ltiaas/kit` from `a395324341e89eb0df1c49075fd7fd52ef85dc0a` (`d7e50b5dea56382f849b213f006b73bcf5eb71aa`) plus `tests/ltiaas/kit/channels/acme-lms.json` from `d6196d5242863e33f76a0b7d06c45554463bec6b`, yielding the 6-channel kit tree `3c82b60928d8b5f7c5e94cb834314a2a97c91cdb` (`6 × 39 = 234` cases).
   - **Wave-Input Binding:** `LA_WAVE_ID="la-final-wave-a8bbac53"` and `LA_K1_WAVE_SPEC="/Users/quangnguyen/cogniate-qa-runs/LA/LA-E7-06/wave-spec-r8.json"` (referencing `qalead-la-31` `T3b`, `qalead-la-66` `T7`, and `qalead-la-52` `T8`).
   ```bash
   export WALK_CLONE="/Users/quangnguyen/cogniate-qa-runs/LA/LA-E7-06/walk2/clone"
   git clone --no-hardlinks /Users/quangnguyen/orca/workspaces/cogniate_moodle_integration_prototype/la-walk "$WALK_CLONE"
   git -C "$WALK_CLONE" checkout --force d6196d5242863e33f76a0b7d06c45554463bec6b
   rm -rf "$WALK_CLONE/tests/ltiaas/kit"
   git -C "$LA_QA" archive a395324341e89eb0df1c49075fd7fd52ef85dc0a tests/ltiaas/kit | tar -x -C "$WALK_CLONE"
   git -C "$WALK_CLONE" checkout d6196d5242863e33f76a0b7d06c45554463bec6b -- tests/ltiaas/kit/channels/acme-lms.json

   COMPOSE_PROJECT_NAME=qa4-la-walk-r2 PUBLIC_PORT=9443 STACK_SUBNET="172.20.0.0/16" \
     COURSE_FIXTURES_DIR="$COURSE_FIXTURES_DIR" \
     LA_WAVE_ID="la-final-wave-a8bbac53" \
     LA_K1_WAVE_SPEC="/Users/quangnguyen/cogniate-qa-runs/LA/LA-E7-06/wave-spec-r8.json" \
     LA_K1_KIT_FROM="$WALK_CLONE/tests/ltiaas/kit" \
     node "$WALK_CLONE/tests/ltiaas/kit/run-k1sim.mjs" \
     --sha d6196d5242863e33f76a0b7d06c45554463bec6b \
     --source "$WALK_CLONE" \
     --workdir "/Users/quangnguyen/cogniate-qa-runs/LA/LA-E7-06/walk2/r2/run-clone"
   ```

   Record correction (LD-32): the actual `walk2/r2/runner.log` has no `--replace-tests` copy. The run used the committed dispatcher at `d6196d52` and copied only the kit through `LA_K1_KIT_FROM`. The earlier command above incorrectly showed a full tests replacement.

9. **Host Dry-Run Verification Matrix (`/Users/quangnguyen/cogniate-qa-runs/LA/REGATE/dry-run-r2/logs/`):**
   - Every command in §10(d).0–8 was dry-run on the host with `0` Docker calls using disposable copies of real prior outputs (`RUN-D1` `summary.json`, `m1-case-results.json`, `m2-case-results.json`, and `service-logs`; `Slot R0` `golden-cand-4f10c5fd` `G1–G4.json`; `Slot R2b` `k2-case-results.json`; and `LA-E7-06` `wave-spec-r8.json`) and verified to fail closed on mutated/invalid input:

| Step | §10(d) Command Group | Positive Dry-Run Proof (`exit 0`, expected output written) | Negative Control Proof (`exit != 0`, fails closed on wrong input) | Log Files (`/Users/quangnguyen/cogniate-qa-runs/LA/REGATE/dry-run-r2/logs/`) |
| --- | --- | --- | --- | --- |
| `0` | §10(b)/(c)/(d).0 Env vars, gate trees (`1ae6716b`, `794f649c`), product SHAs (`78971b03`, `4f10c5fd`), non-test diffs (`exit 0`), & `LA-E5-24` drill SHA (`5603861886909667a03d2aaf7843a9b17a4020ed`) + artifact | All `git rev-parse`, `git cat-file -e`, `git diff --exit-code ... -- . ':!tests'`, and artifact `test -f` checks pass (`POS_00_OK`). | Old invalid SHA `5603861829dd7da4...` and old path `/Users/quangnguyen/cogniate-qa-runs/LA/LA-E5-24-r2` fail closed (`NEG_00A`, `NEG_00B`). | `00-env-and-tree-proofs.pos.log`, `00-env-and-tree-proofs.neg.log` |
| `1` | §10(d).1 `run-m1.mjs` CLI + `verifyResults` (`394` `sim` rows from `qalead-la-81`) + `rate-peaks.mjs --suite m1-sim` | `run-m1.mjs --help` parses on `src-baseline-3` & `src-final-3`; `verifyResults` passes `394/394` rows; `rate-peaks.mjs` writes `qalead-la-120-rate-peaks.json` (`launch.perMinute=28`, `lti.admin.perMinute=399`). | `run-m1.mjs --sha deadbeef` throws `AssertionError`; `rate-peaks.mjs` without `--logs` exits `2` (`NEG_01A`, `NEG_01B`). | `01-m1-and-rate-peaks.pos.log`, `01-m1-and-rate-peaks.neg.log` |
| `2` | §10(d).2 `run-m2.mjs` CLI + `verifyResults` (`64` `M2` rows from `qalead-la-82`) + `rate-peaks.mjs --suite m2` | `run-m2.mjs --help` verifies `productSha` & `testSha` git objects and clean `tests/` on `src-baseline-3` & `src-final-3`; `verifyResults` passes `64/64` rows; `rate-peaks.mjs` writes `qalead-la-121-rate-peaks.json` (`launch.perMinute=3`, `lti.protocol.perMinute=10`). | `run-m2.mjs --sha deadbeef` throws `AssertionError`; dropping 1 row (`M2-13.cross-library`) from `m2-case-results.json` throws `AssertionError: Missing result: M2-13.cross-library` (`NEG_02A`, `NEG_02B`). | `02-m2-and-rate-peaks.pos.log`, `02-m2-and-rate-peaks.neg.log` |
| `3` | §10(d).3 `run-t7.mjs` CLI + `judgeWaveSource({ suite: "T7" })` (`qalead-la-73` `summary.json`) + `rate-peaks.mjs --suite t7-run1` & `t7-all3runs` | `run-t7.mjs --help` passes on `src-baseline-3` & `src-final-3`; `judgeWaveSource` returns `outcome: "PASS", notes: []`; `rate-peaks.mjs` writes `t7-run1` and `t7-all3runs` JSON (`launch.perMinute=3`). | `run-t7.mjs --test-sha ...` throws `ERR_PARSE_ARGS_UNKNOWN_OPTION`; mutating `runs[1].fail = 1` in `T7` `summary.json` returns `outcome: "FAIL"` (`NEG_03A`, `NEG_03B`). | `03-t7-and-rate-peaks.pos.log`, `03-t7-and-rate-peaks.neg.log` |
| `4` | §10(d).4 Legacy `run-t2/t3c/t4a/t4b/t5/t8.mjs` CLIs + `judgeWaveSource` (`T3b` `qalead-la-74`, `T8` `qalead-la-83`) + `rate-peaks.mjs` across all 7 legacy suites (`t2-t3ab`..`t8`) | All 14 runner invocations (`src-baseline-3` & `src-final-3`) parse; `judgeWaveSource` returns `PASS` on `qalead-la-74` (`T3b`) and `qalead-la-83` (`T8`); all 7 `rate-peaks-*.json` files parse cleanly. | `run-t2.mjs --test-sha ...` throws `ERR_PARSE_ARGS_UNKNOWN_OPTION`; mutating `aggregate["AC-T3-30"] = "FAIL"` in `T3b` `summary.json` returns `outcome: "FAIL" ["AC-T3-30: FAIL"]` (`NEG_04A`, `NEG_04B`). | `04-legacy-t2-t8-and-rate-peaks.pos.log`, `04-legacy-t2-t8-and-rate-peaks.neg.log` |
| `5` | §10(d).5 `run-golden.mjs` CLI + atomic Python port normalizer (`:9473` -> `:9643`) + `compare.mjs` vs `78971b03` with 13 `LA-IC` files | Normalizer atomically updates all 4 `G1–G4.json` files (`106,073 B`, `53,070 B`, `59,628 B`, `28,601 B`) and validates JSON; `compare.mjs` exits `0` (`EQUAL: 297 differences (0 not explained), 0 expected changes missing`). | Truncating `G1.json` to `0` bytes raises `AssertionError: Empty file`; mutating `G1.acceptance.unexpectedField` makes `compare.mjs` exit `1` (`DIFFERENT: 298 differences (1 not explained)`) (`NEG_05A`, `NEG_05B`). | `05-golden-v2-norm-and-compare.pos.log`, `05-golden-v2-norm-and-compare.neg.log` |
| `6` | §10(d).6 `run-k2.mjs` CLI + `loadManifest` / `verifyK2Coverage` on `qa-e2e-la-sim-r11` `k2-case-results.json` | `run-k2.mjs --help` resolves `--sha 4f10c5fd...`; `k2-case-results.json` (`12/12 passed`) and `verifyK2Coverage` (`ok: true`) pass. | `run-k2.mjs --sha deadbeef` throws `AssertionError: Could not resolve --sha deadbeef`; `verifyK2Coverage({ suites: [] })` fails with `12` missing cases (`NEG_06A`, `NEG_06B`). | `06-k2-runner.pos.log`, `06-k2-runner.neg.log` |
| `7` | §10(d).7 `run-k1sim.mjs` CLI + `wave-spec-d3.json` & `wave-spec-d4.json` array generation + `writeWaveEvidence()` preflight | `wave-spec-d3.json` and `wave-spec-d4.json` resolve `$MOCK_SRC/tests/{host/artifacts/qalead-la-131-*,e2e/artifacts/runs/qalead-la-130-*,host/artifacts/qalead-la-137-*}/summary.json` (and `154`/`153`/`160`); `writeWaveEvidence()` returns `ok: true` and writes `wave/{T3b,T7,T8}/result.json` + `wave-evidence.json`. | Passing `{ "waveId": ..., "sources": [...] }` object throws `Error: wave spec: a non-empty array is required`; pointing `T8` to failed `qalead-la-80` `summary.json` (`AC-T8-10: FAIL`) returns `ok: false`; passing `--channels` to `run-k1sim.mjs` throws `ERR_PARSE_ARGS_UNKNOWN_OPTION` (`NEG_07A..C`). | `07-k1sim-wave-d3-d4.pos.log`, `07-k1sim-wave-d3-d4.neg.log` |
| `8` | §10(d).8 6-channel walk-clone construction (`d6196d5242863e33f76a0b7d06c45554463bec6b` + `a395324341e89eb0df1c49075fd7fd52ef85dc0a` kit + `acme-lms.json`) + `writeWaveEvidence()` on `wave-spec-r8.json` | Clones `la-walk` at `d6196d5242863e33f76a0b7d06c45554463bec6b`, overlays kit `a395324341e89eb0df1c49075fd7fd52ef85dc0a` + `acme-lms.json` (`6` channels), parses `run-k1sim.mjs --help`, and verifies `wave-spec-r8.json` (`qalead-la-31` `T3b`, `qalead-la-66` `T7`, `qalead-la-52` `T8` all `PASS`). | Duplicating the `T7` entry in `wave-spec-r8.json` throws `Error: wave spec: suite T7 appears twice` (`NEG_08`). | `08-walk-clone-k1sim.pos.log`, `08-walk-clone-k1sim.neg.log` |

---

### (e) Recomputed Critical-Path Time Summary (`A-LA-E7-08-LD9-R8-02` & `B-LA-E7-08-LD9-R8-01`)

- **Slot R0 (`golden v2` capture × 2 on `78971b03` + dry-run on `4f10c5fd`, Lead QA 2, solo)**: **`13 min`** (**DONE**; `0 min` remaining wall time).
- **Slot R2a (`QA-K` 6-channel walk-clone `K1-SIM` `qa4-la-walk-r2` on `9443`, solo)**: **`7.4 min`** (**DONE** at `9b10f07c`, `234/234 PASS`; `0 min` remaining wall time).
- **Slot R2b (`QA-E2E` `K2` `U1–U4` `qa-e2e-la-sim-r11` on `9443`, solo per `LD-31`)**: **`4 min`** (**DONE** in `SLOT-R2B-R6-QA-E2E`, `12/12 PASS`; `0 min` overlap with any other stack).
- **Slot R1 (`baseline-3` runs on `78971b03`, Lead QA 1, `qalead-la-120..129`, sequential `1` stack at a time, `0` overlaps)**: **`94 min` planned / `104.1 min` actual wall time** (**DONE** `2026-10-24T17:12:27Z–18:56:34Z`, recorded in `docs/reviews/LA-E0-02/qa.md` §8 and the corrected R1 record in `docs/reviews/LA-E7-08/qa.md` (the new §14 records D3); `0 min` remaining wall time).
- **Slot R3 (`D3` + `D4` double full run on `4f10c5fd` / `la-final-test-3` under `LD-31`, Lead QA 1 & Lead QA 2)**: **`148 min` (`2 h 28 min`) wall time** across four phases:
  1. **Phase R3-A (`66 min` wall time — Planned Overlap #1):** `Lead QA 1` runs `D3` Moodle `qalead-la-130..137` (`66 min` on `9543`) while `Lead QA 2` runs `D4` non-`M2` SIM `qalead-la-150..151` (`golden v2` `4 min` + `M1 sim` `24 min` = `28 min` on `9643`).
  2. **Phase R3-B (`8 min` wall time — Solo `M2` Window per `LD-31`, `0` Overlaps):** `Lead QA 1` runs `D3` `M2` `qalead-la-138` (`4 min` solo on `9473`), then `Lead QA 2` runs `D4` `M2` `qalead-la-152` (`4 min` solo on `9643`), with no other stack starting, seeding, or tearing down.
  3. **Phase R3-C (`66 min` wall time — Planned Overlap #2):** `Lead QA 2` runs `D4` Moodle `qalead-la-153..160` (`66 min` on `9563`) while `Lead QA 1` runs `D3` non-`M2` SIM `qalead-la-139..141` (`golden v2` `4 min` + `M1 sim` `24 min` + `D3` 5-channel `K1-SIM` `8 min` = `36 min` on `9473`).
  4. **Phase R3-D (`8 min` wall time — Solo `D4` `K1-SIM` after `qalead-la-160` `T8` finishes, `0` Overlaps):** `Lead QA 2` runs `D4` 5-channel `K1-SIM` `qalead-la-161` (`8 min` solo on `9643`, fed by `D4`'s completed `153`/`154`/`160` wave outputs).
- **Total Re-Gate Critical-Path Wall Time**:
  - **Planned critical-path wall time (`R1` `94 min` + `R3-A..D` `148 min`)**: **`242 min` (`4 h 02 min`)** (with Slot R1 **DONE**, **`148 min` (`2 h 28 min`)** remaining for Slot R3 `D3` + `D4`).
  - **Cumulative re-gate critical-path wall time (including `R0` `13 min` + `R2a` `7.4 min` + `R2b` `4 min`)**: **`266.4 min` (`4 h 26 min`) planned** (`330.4 min` sum of active container suite durations across all 4 sessions: `13 + 7.4 + 4 + 94 + 66 + 28 + 8 + 66 + 36 + 8 = 330.4 min`).





