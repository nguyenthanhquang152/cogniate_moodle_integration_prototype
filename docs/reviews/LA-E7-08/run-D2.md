# Milestone-End Full Run D2 of 2 on Final SHA `a8bbac53` (`AC-LA-E7-09-05`)

Verdict: PENDING (Phase 1 on `la-final-test-1` complete for `G1–G4` and `T2a..T8`; awaiting `la-final-test-2` `GO` for `M1 sim`, `M2`, and `T7 × 3` rerun)
Round: D2 (Run 2 of 2 for `AC-LA-E7-09-05`)
Product SHA: `a8bbac538cfe1e305f410279d7879421d64a5a1f` (`tag: la-final-product-1`)
Test SHA (Phase 1): `la-final-test-1` (`85ddf97332063f75bdc5636cb410fc0d6ee25099`)
Test SHA (Phase 2): `la-final-test-2` (`la-final-test-1` + `ld9-addendum-r6` + `ld9-addendum-r7`, pending `GO`)

---

## 1. Run D2 Context, Source Verification & Scope

| Item | Value |
| --- | --- |
| Role & Session | Lead QA Helper (Antigravity session, Orca task `task_41f5dfae682a`, dispatch `ctx_87a16c192840`) |
| Final Product SHA (`$FINAL_SHA`) | `a8bbac538cfe1e305f410279d7879421d64a5a1f` (`Merge la-p 0eedb055: LA-E1-11 follow-up (BD-A1-119): data-channel-id on every channel card`) |
| Phase 1 Gate Source Clone (`src-final-1-d2`) | `/Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-final-1-d2` (cloned with `git clone --no-hardlinks /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-final-1 /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-final-1-d2` at tag `la-final-test-1` = `85ddf97332063f75bdc5636cb410fc0d6ee25099`) |
| Source Proofs (`src-final-1-d2`) | • `git -C /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-final-1-d2 rev-parse HEAD` = `85ddf97332063f75bdc5636cb410fc0d6ee25099`<br>• `git -C /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-final-1-d2 status --short` = empty (clean tree)<br>• `git -C /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-final-1-d2 diff --exit-code a8bbac538cfe1e305f410279d7879421d64a5a1f HEAD -- . ':!tests'` = exit `0` (`0` non-test files differ) |
| Owned Compose Prefix & Lanes | `qalead-la-90..99` only (one stack at a time for D2):<br>• **SIM lane:** `PUBLIC_PORT=9643`, `STACK_SUBNET=172.22.0.0/16` (`qalead-la-90..92`)<br>• **Moodle lane:** `PUBLIC_PORT=9563`, `STACK_SUBNET=172.25.0.0/16` (`qalead-la-93..99`)<br>• Never used D1 ports (`9473`/`9543`) or D1 subnets (`172.23.0.0/16`/`172.21.0.0/16`); never touched `qalead-la-70..80` or `sto-*` resources |
| Phase 1 Window & Timestamps | `before-timestamp.txt`: `2026-10-24T10:30:00Z`; Phase 1 (`qalead-la-92..99`) ran `2026-10-24T10:30:37Z` to `2026-10-24T11:42:31Z` (`71.9 min`) |
| Durable Evidence Root | `/Users/quangnguyen/cogniate-qa-runs/LA/RUN-D2/` (`docker-records/`, `logs/`, `artifacts/`, `golden-capture-a8bbac538cfe1e305f410279d7879421d64a5a1f/`, `golden-capture-a8bbac538cfe1e305f410279d7879421d64a5a1f-port9443/`) |

---

## 2. Environment Events & Gate Findings Recorded During D1 / D2 (`la-final-test-1`)

Per `tests/ltiaas/TEST-STRATEGY.md` §2.6 and the Lead's instructions (`msg_607463d233fc` at `10:29Z` and `msg_6579dd26e017` at `12:14Z`), the following environment events and gate findings are recorded as non-`PASS` events for their respective runs:

1. **Host Docker Desktop Update at `2026-10-24T09:20:06Z` & D1 `qalead-la-70` Environment Aborts (`BD-A2-113` / `ld9-addendum-r6`):**
   - At `2026-10-24T09:20:06Z`, `/Applications/Docker.app` updated on the host from Docker CLI `29.9.1` / Compose `v5.6.0` to Docker CLI `29.9.2` (`sha256: 6bbc39e9f2950720216f64c22d6e38afdd86a4672eee0d4e4389263c40ebd3e3`) and Compose `v5.6.1` (`sha256: 31664b8ce83f3900ed3c52b8c2276706832793a0a379d9661defd6f88b386def`).
   - D1's first `qalead-la-70` (`M1 --phase sim --provider all`, started `09:11:51Z`) had passed `253/253` executed cases (`0` failed) when the Docker daemon restarted at `09:20:06Z` and dropped the stack; D1's second `qalead-la-70` (`09:24:35Z`) aborted at preflight with `FAIL G1-IDENTITY` because `tests/host/storage-docker.mjs:173` `BOUND_IDENTITY` was pinned to `29.9.1` / `5.6.0`. Both `qalead-la-70` runs are recorded as environment events (never `PASS`).
   - The `ADR-012` §17 `G-1` diagnostic passed (`G-1` result 2, `BD-A2-113`), and QA-3's `ld9-addendum-r6` updates `BOUND_IDENTITY` to `29.9.2` / `5.6.1` for `la-final-test-2`.
2. **D1 `qalead-la-80` (`T8`) `AC-T8-10` `FAIL` = Finding `WE-F13` (Option Race; Fix in `ld9-addendum-r7`):**
   - In D1's `qalead-la-80` (`T8` on `la-final-test-1`), `AC-T8-10` failed due to a connection-option load race in the `T8` test (`WE-F13`). Per `TEST-STRATEGY.md` §2.6, `qalead-la-80` is recorded as a `FAIL` finding (`WE-F13`, never a `PASS`), fixed in `ld9-addendum-r7` (`la-final-test-2`), and `T8` is re-run on `la-final-test-2`.
3. **D2 `qalead-la-93` (`T7 × 3`) Run 2 `B4 AC-T7-08` & `B6 AC-T7-09` `FAIL` = Flake Finding Under Dual Moodle Stack Load:**
   - In D2's `qalead-la-93` (`T7 × 3` on `la-final-test-1`, `10:32:47Z–10:43:08Z`), Run 1 (`194 s`, `17 PASS, 0 FAIL, 1 SKIP`) and Run 3 (`216 s`, `17 PASS, 0 FAIL, 1 SKIP`) passed, while Run 2 (`202 s`, `15 PASS, 2 FAIL, 1 SKIP`) failed when `B4 AC-T7-08` timed out (`15000 ms`) clicking `Save and return to course` (`#id_submitbutton2`) while two Moodle stacks (`qalead-la-73` in D1 and `qalead-la-93` in D2) were running simultaneously on the host, causing dependent `B6 AC-T7-09 AC-T7-07` to fail with `Error: Needs B4 (activity B) from an earlier step`.
   - Per `TEST-STRATEGY.md` §2.6, a flake is a finding and never a `PASS` for its run: `qalead-la-93` is recorded as **`FAIL (flake finding under dual Moodle stack load)`**, and D2 re-runs `T7 × 3` on `la-final-test-2` while D1 is on the SIM lane (at most one Moodle stack at a time across D1 and D2).
4. **Disclosed D2 Runner Invocation Events Before Test Execution (`qalead-la-96` First Call & `qalead-la-97` Preflight Abort):**
   - `qalead-la-96-a8bbac53-2026-10-24T10-58-57-151Z` (`run-t4a.mjs` first call): invoked without `COURSE_FIXTURES_DIR`; failed at host step `FIXTURES` (`5 PASS, 1 FAIL`, `0` tests executed) and tore down cleanly (`0` containers/volumes/networks left).
   - `qalead-la-97-a8bbac53-2026-10-24T10-59-25-216Z` (`run-t4b.mjs` first call): started before `qalead-la-96` first call finished `TEARDOWN`; aborted immediately at `PRE` (`0 PASS, 1 FAIL` on `127.0.0.1:9563 is busy; STACK_SUBNET overlaps: qalead-la-96_default 172.25.0.0/16`) with `0` Docker resources created.
   - Both suites were then run sequentially with `COURSE_FIXTURES_DIR=/Users/quangnguyen/cogniate-qa-runs/LA/GATE/course-fixtures` (`qalead-la-96-a8bbac53-2026-10-24T11-00-22-727Z` `19/19 PASS` and `qalead-la-97-a8bbac53-2026-10-24T11-02-34-317Z` `48/48 PASS`). All artifact folders are preserved and accounted for in §3 below.

---

## 3. Phase 1 Summary Table (`la-final-test-1` = `85ddf97332063f75bdc5636cb410fc0d6ee25099`)

| Compose Project | Lane (`PORT` / `SUBNET`) | Suite / Scope | Run ID (Artifact Folder) | Start–End (UTC) | Duration | Status Counts (`summary.json`) | Non-`PASS` IDs | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **`qalead-la-92`** | SIM (`9643` / `172.22.0.0/16`) | `G1–G4` Golden Capture & `compare.mjs` | `qalead-la-92-a8bbac53-2026-10-24T10-30-37-065Z` | `10:30:37Z–10:32:29Z` | `1.9 min` | `9/9 PASS` (`8/8` unique IDs `PASS`, `0 FAIL`); `compare.mjs` exit `0` (`280` diffs, `0` unexplained) | None (`0`) | **`PASS`** |
| **`qalead-la-93`** | Moodle (`9563` / `172.25.0.0/16`) | `T7 × 3` (`run-t7.mjs --runs 3`) | `qalead-la-93-a8bbac53-2026-10-24T10-32-47-040Z` | `10:32:47Z–10:43:08Z` | `10.4 min` | Host steps: `7 OK, 1 FAIL` (`run 2`); Runs 1 & 3: `17 PASS, 0 FAIL, 1 SKIP`; Run 2: `15 PASS, 2 FAIL, 1 SKIP` | Run 2: `B4 AC-T7-08`, `B6 AC-T7-09 AC-T7-07` (`DEMO AC-T7-15` `SKIP` × 3 expected) | **`FAIL` (flake finding — load; rerun in Phase 2)** |
| **`qalead-la-94`** | Moodle (`9563` / `172.25.0.0/16`) | `T2a, T2b, T3a, T3b` (`run-t2.mjs`) | `qalead-la-94-a8bbac53-2026-10-24T10-44-53-643Z` | `10:44:53Z–10:55:13Z` | `10.3 min` | `76/76 PASS` (`64/64` unique IDs `PASS`, `0 FAIL`) | None (`0`) | **`PASS`** |
| **`qalead-la-95`** | Moodle (`9563` / `172.25.0.0/16`) | `T3c` (`run-t3c.mjs`) | `qalead-la-95-a8bbac53-2026-10-24T10-56-00-915Z` | `10:56:00Z–10:58:27Z` | `2.5 min` | `28/28 PASS` (`28/28` unique IDs `PASS`, `0 FAIL`) | None (`0`) | **`PASS`** |
| `qalead-la-96` (attempt 1) | Moodle (`9563` / `172.25.0.0/16`) | `T4a` (missing `COURSE_FIXTURES_DIR` env) | `qalead-la-96-a8bbac53-2026-10-24T10-58-57-151Z` | `10:58:57Z–11:00:08Z` | `1.2 min` | `5 PASS, 1 FAIL` (`6` unique IDs; `0` tests ran) | `FIXTURES` (`not found`) | Invocation error (disclosed; `0` tests ran) |
| `qalead-la-97` (attempt 1) | Moodle (`9563` / `172.25.0.0/16`) | `T4b1, T4b2` (started during `96` teardown) | `qalead-la-97-a8bbac53-2026-10-24T10-59-25-216Z` | `10:59:25Z–10:59:26Z` | `0.0 min` | `0 PASS, 1 FAIL` (`1` unique ID; `0` Docker resources created) | `PRE` (`9563` busy / subnet overlap) | Preflight abort (disclosed; `0` resources created) |
| **`qalead-la-96`** | Moodle (`9563` / `172.25.0.0/16`) | `T4a` (`run-t4a.mjs`) | `qalead-la-96-a8bbac53-2026-10-24T11-00-22-727Z` | `11:00:22Z–11:02:20Z` | `2.0 min` | `19/19 PASS` (`15/15` unique IDs `PASS`, `0 FAIL`) | None (`0`) | **`PASS`** |
| **`qalead-la-97`** | Moodle (`9563` / `172.25.0.0/16`) | `T4b1, T4b2` (`run-t4b.mjs`) | `qalead-la-97-a8bbac53-2026-10-24T11-02-34-317Z` | `11:02:34Z–11:08:47Z` | `6.2 min` | `48/48 PASS` (`40/40` unique IDs `PASS`, `0 FAIL`) | None (`0`) | **`PASS`** |
| **`qalead-la-98`** | Moodle (`9563` / `172.25.0.0/16`) | `T5a, T5b, T6` (`run-t5.mjs`) | `qalead-la-98-a8bbac53-2026-10-24T11-09-07-105Z` | `11:09:07Z–11:32:25Z` | `23.3 min` | `79/79 PASS` (`63/63` unique IDs `PASS`, `0 FAIL`: `21/21` `T5a`, `16/16` `T5b` / `24/24` tests, `14/14` `T6` / `18/18` tests) | None (`0`) | **`PASS`** |
| **`qalead-la-99`** | Moodle (`9563` / `172.25.0.0/16`) | `T8` (`run-t8.mjs`) | `qalead-la-99-a8bbac53-2026-10-24T11-32-48-203Z` | `11:32:48Z–11:42:31Z` | `9.7 min` | `36/36 PASS` (`23/23` unique IDs `PASS`, `0 FAIL`) | None (`0`) | **`PASS`** |

---

## 4. Phase 1 Detailed Accounting per Run (`qalead-la-92..99`)

### 4.1 `qalead-la-92` (`G1–G4` Golden Capture & Compare on SIM Lane `9643` / `172.22.0.0/16`)

- **Run ID & Artifact:** `/Users/quangnguyen/cogniate-qa-runs/LA/RUN-D2/artifacts/qalead-la-92-a8bbac53-2026-10-24T10-30-37-065Z/summary.json` (`logs/qalead-la-92-golden-capture.log`).
- **Start / End Time:** `2026-10-24T10:30:37Z` – `2026-10-24T10:32:29Z` (`112 s` / `1.9 min`).
- **Command:**
  `COMPOSE_PROJECT_NAME=qalead-la-92 PUBLIC_PORT=9643 STACK_SUBNET="172.22.0.0/16" /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-final-1-d2/tests/ltiaas/golden/run-golden.sh --sha a8bbac538cfe1e305f410279d7879421d64a5a1f --source /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-final-1-d2 --out /Users/quangnguyen/cogniate-qa-runs/LA/RUN-D2/golden-capture-a8bbac538cfe1e305f410279d7879421d64a5a1f`
- **Status Counts (`summary.json` `results`):** **`9/9` step entries `PASS`, `8/8` unique IDs `PASS`, `0 FAIL`**:
  1. `PRE` (`PASS`): `["node 24.21.0, docker 29.9.2, compose 5.6.1", "project qalead-la-92, PUBLIC_PORT 9643, STACK_SUBNET 172.22.0.0/16", "other containers on this Docker host: 1 (not touched by QA)"]`.
  2. `CLONE` (`PASS`): `["HEAD a8bbac538cfe1e305f410279d7879421d64a5a1f Merge la-p 0eedb055: LA-E1-11 follow-up (BD-A1-119): data-channel-id on every channel card", "clone /Users/quangnguyen/cogniate-qa-runs/qalead-la-92-a8bbac53-2026-10-24T10-30-37-065Z", "tests/ replaced (--replace-tests): copied from /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-final-1-d2/tests; diff vs SHA: 68 files changed, 2201 insertions(+), 9171 deletions(-); new files not in the SHA: none"]`.
  3. `H1` (`PASS`, default profile): `["services: cogniate-app, lti-service, moodle, postgres, proxy"]`.
  4. `GOLDEN-DEFAULT` (`PASS`): `["profiles 8; lms moodle,canvas,blackboard,lti-generic,brightspace"]`.
  5. `H1` (`PASS`, acceptance profile): `["services: cogniate-app, lms-sim, lti-gate, lti-service, moodle, postgres, proxy, qa-platform, sink"]`.
  6. `GOLDEN-CAPTURE` (`PASS`): `["exit 0; 54 s; log host/artifacts/qalead-la-92-a8bbac53-2026-10-24T10-30-37-065Z/cmd/09-golden-capture.log"]`.
  7. `GOLDEN-SECRET-SCAN` (`PASS`): `["values 129; hits 0"]`.
  8. `GOLDEN-OUT` (`PASS`): `["capture 54 s"]`.
  9. `TEARDOWN` (`PASS`): `["npm run stack:down exit 0", "left after cleanup: 0 containers, 0 volumes (exact lane names included), 0 networks", "other projects' containers that stopped or restarted: /sto-it-mq-4f7d08311988 (information)"]`.
- **Golden Compare Result (`logs/qalead-la-92-golden-compare-port-aligned.txt` after normalizing `:9643` → `:9443` in `golden-capture-a8bbac538cfe1e305f410279d7879421d64a5a1f-port9443`):**
  ```text
  EQUAL: 280 differences (0 not explained), 0 expected changes missing; expected-delta files: LA-IC-01, LA-IC-03, LA-IC-04, LA-IC-12, LA-IC-13, LA-IC-14, LA-IC-15, LA-IC-16, LA-IC-17, LA-IC-18, LA-IC-19, LA-IC-20, LA-IC-21; 22 ms
  ```
- **Non-`PASS` IDs:** **None (`0`)**.

---

### 4.2 `qalead-la-93` (`T7 × 3` on Moodle Lane `9563` / `172.25.0.0/16` — Flake Finding Under Load)

- **Run ID & Artifact:** `/Users/quangnguyen/cogniate-qa-runs/LA/RUN-D2/artifacts/qalead-la-93-a8bbac53-2026-10-24T10-32-47-040Z/summary.json` (`logs/qalead-la-93-t7x3.log`).
- **Start / End Time:** `2026-10-24T10:32:47Z` – `2026-10-24T10:43:08Z` (`621 s` / `10.4 min`).
- **Command:**
  `COMPOSE_PROJECT_NAME=qalead-la-93 PUBLIC_PORT=9563 STACK_SUBNET="172.25.0.0/16" COURSE_FIXTURES_DIR="/Users/quangnguyen/cogniate-qa-runs/LA/GATE/course-fixtures" node /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-final-1-d2/tests/e2e/host/run-t7.mjs --sha a8bbac538cfe1e305f410279d7879421d64a5a1f --runs 3 --replace-e2e`
- **Host Step Counts (`summary.json` `steps`):** **`8` total (`7 OK`, `1 FAIL` on `run 2`)**:
  1. `preflight (free project, port, subnet)` (`OK`): `["project qalead-la-93, PUBLIC_PORT 9563, STACK_SUBNET 172.25.0.0/16"]`.
  2. `clone the SHA into a new folder` (`OK`): `["HEAD a8bbac538cfe1e305f410279d7879421d64a5a1f Merge la-p 0eedb055: LA-E1-11 follow-up (BD-A1-119): data-channel-id on every channel card", "clone /Users/quangnguyen/cogniate-qa-runs/qalead-la-93-a8bbac53-2026-10-24T10-32-47-040Z", "tests/e2e copied from the working copy (--replace-e2e):  12 files changed, 67 insertions(+), 4189 deletions(-); untracked: 0"]`.
  3. `course zips into the clone (tests/fixtures/courses, SHA-256 checked)` (`OK`): `["Build Your First Website with AI_ The Zero-to-Hero Micro-Sprint-scorm-v2.zip: OK", "Build Your First Website with AI_ The Zero-to-Hero Micro-Sprint-html.zip: OK"]`.
  4. `npm ci, gen-env, compose project name` (`OK`): `["npm ci 0, gen-env 0, compose name \"qalead-la-93\""]`.
  5. `run 1: npm run test:e2e exit 0 in 194 s (e2e:reset 45 s); 17 pass, 0 fail, 1 skip` (`OK`): `[]`.
  6. `run 2: npm run test:e2e exit 1 in 202 s (e2e:reset 48 s); 15 pass, 2 fail, 1 skip` (**`FAIL` — flake finding under dual Moodle stack load**):
     - **`B4 AC-T7-08`** (`2-scenario-b.spec.ts`, **`FAIL`**): `TimeoutError: locator.click: Timeout 15000ms exceeded. Call log: - waiting for getByRole('button', { name: 'Save and return to course', exact: true }) - locator resolved to <input type="submit" name="submitbutton2" id="id_submitbutton2" value="Save and return to course" class="btn btn-primary"/> - attempting click action 2 × waiting for element to be visible, enabled and stable`.
     - **`B6 AC-T7-09 AC-T7-07`** (`2-scenario-b.spec.ts`, **`FAIL`**): `Error: Needs B4 (activity B) from an earlier step (that step failed or did not run). at lib/e2e.ts:116`.
  7. `run 3: npm run test:e2e exit 0 in 216 s (e2e:reset 59 s); 17 pass, 0 fail, 1 skip` (`OK`): `[]`.
  8. `teardown: stack qalead-la-93 removed with its volumes and networks` (`OK`): `["stack:down exit 0; left: 0 containers, 0 volumes, 0 networks"]`.
- **Expected Skip Across Runs 1, 2, 3:** `DEMO AC-T7-15 after demo:prepare, cg_student opens both activities in COGNIATE-DEV-101 and reaches the player` (`demo-check.spec.ts`, `SKIP`: `["skip: runs only in the demo pass (QA_E2E_DEMO=1)"]`, matching Slot 7 baseline `qalead-la-20`).

---

### 4.3 `qalead-la-94` (`T2a, T2b, T3a, T3b` on Moodle Lane `9563` / `172.25.0.0/16`)

- **Run ID & Artifact:** `/Users/quangnguyen/cogniate-qa-runs/LA/RUN-D2/artifacts/qalead-la-94-a8bbac53-2026-10-24T10-44-53-643Z/summary.json` (`logs/qalead-la-94-t2-t3ab.log`).
- **Start / End Time:** `2026-10-24T10:44:53Z` – `2026-10-24T10:55:13Z` (`620 s` / `10.3 min`).
- **Command:**
  `COMPOSE_PROJECT_NAME=qalead-la-94 PUBLIC_PORT=9563 STACK_SUBNET="172.25.0.0/16" node /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-final-1-d2/tests/host/run-t2.mjs --sha a8bbac538cfe1e305f410279d7879421d64a5a1f --source /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-final-1-d2 --replace-tests --tests-from /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-final-1-d2/tests --tasks T2a,T2b,T3a,T3b`
- **Status Counts (`summary.json` `results`):** **`76/76` step entries `PASS`, `64/64` unique IDs `PASS`, `0 FAIL`**:
  - All `T2a`, `T2b`, `T3a`, and `T3b` ACs (`AC-T2-01..25`, `AC-T3-01..28`), host/setup steps (`PRE`, `CLONE`, `SETUP`, `H1`, `SUITE`, `KNOB`, `HOSTCTL`), and `TEARDOWN` passed `100%`.
  - `TEARDOWN` (`PASS`): `["npm run stack:down exit 0", "left after cleanup: 0 containers, 0 volumes (exact lane names included), 0 networks", "other projects' containers that stopped or restarted: /sto-it-mq-029b531ea3a1, /sto-it-3938f001209b, /sto-it-mq-3ee9a32d3da1, /qalead-la-74-moodle-1, /qalead-la-74-cogniate-app-1, /qalead-la-74-lti-service-1, /qalead-la-74-postgres-1, /qalead-la-74-proxy-1 (information)"]`.
- **Non-`PASS` IDs:** **None (`0`)**.

---

### 4.4 `qalead-la-95` (`T3c` on Moodle Lane `9563` / `172.25.0.0/16`)

- **Run ID & Artifact:** `/Users/quangnguyen/cogniate-qa-runs/LA/RUN-D2/artifacts/qalead-la-95-a8bbac53-2026-10-24T10-56-00-915Z/summary.json` (`logs/qalead-la-95-t3c.log`).
- **Start / End Time:** `2026-10-24T10:56:00Z` – `2026-10-24T10:58:27Z` (`147 s` / `2.5 min`).
- **Command:**
  `COMPOSE_PROJECT_NAME=qalead-la-95 PUBLIC_PORT=9563 STACK_SUBNET="172.25.0.0/16" node /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-final-1-d2/tests/host/run-t3c.mjs --sha a8bbac538cfe1e305f410279d7879421d64a5a1f --source /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-final-1-d2 --replace-tests --tests-from /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-final-1-d2/tests`
- **Status Counts (`summary.json` `results`):** **`28/28` step entries `PASS`, `28/28` unique IDs `PASS`, `0 FAIL`**:
  - All `T3c` ACs (`AC-T3-06..24`, `AC-T3-27`), host/setup steps (`PRE`, `CLONE`, `SETUP`, `H1`, `SUITE`, `KNOB`), and `TEARDOWN` passed `100%`.
  - `TEARDOWN` (`PASS`): `["npm run stack:down exit 0", "left after cleanup: 0 containers, 0 volumes (exact lane names included), 0 networks", "other projects' containers that stopped or restarted: /qalead-la-75-qa-acceptance-73180, /sto-it-2f38976d4a8c, /qalead-la-75-cogniate-app-1, /qalead-la-75-lti-service-1, /qalead-la-75-lti-gate-1, /qalead-la-75-lms-sim-1, /qalead-la-75-sink-1, /qalead-la-75-qa-platform-1, /qalead-la-75-moodle-1, /qalead-la-75-postgres-1, /qalead-la-75-proxy-1 (information)"]`.
- **Non-`PASS` IDs:** **None (`0`)**.

---

### 4.5 `qalead-la-96` (`T4a` on Moodle Lane `9563` / `172.25.0.0/16`)

1. **Disclosed Attempt 1 (`qalead-la-96-a8bbac53-2026-10-24T10-58-57-151Z`, `10:58:57Z–11:00:08Z`, `logs/qalead-la-96-t4a.log`):**
   - Invoked without `COURSE_FIXTURES_DIR`; `summary.json` recorded `6` entries (`5 PASS`: `PRE`, `CLONE`, `SETUP`, `H1`, `TEARDOWN`; `1 FAIL`: `FIXTURES` with notes `["Build Your First Website with AI_ The Zero-to-Hero Micro-Sprint-scorm-v2.zip: not found", "Build Your First Website with AI_ The Zero-to-Hero Micro-Sprint-html.zip: not found"]`). No test suite ran and `TEARDOWN` removed all resources (`0` containers, `0` volumes, `0` networks; foreign containers noted: `/sto-it-mq-ba83e1f52f2e, /sto-it-40f2e5127bd6`).
2. **Completed Run (`qalead-la-96-a8bbac53-2026-10-24T11-00-22-727Z`, `11:00:22Z–11:02:20Z`, `118 s` / `2.0 min`, `logs/qalead-la-96-t4a-r2.log`):**
   - **Command:**
     `COMPOSE_PROJECT_NAME=qalead-la-96 PUBLIC_PORT=9563 STACK_SUBNET="172.25.0.0/16" COURSE_FIXTURES_DIR="/Users/quangnguyen/cogniate-qa-runs/LA/GATE/course-fixtures" node /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-final-1-d2/tests/host/run-t4a.mjs --sha a8bbac538cfe1e305f410279d7879421d64a5a1f --source /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-final-1-d2 --replace-tests --tests-from /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-final-1-d2/tests`
   - **Status Counts (`summary.json` `results`):** **`19/19` step entries `PASS`, `15/15` unique IDs `PASS`, `0 FAIL`** (all `T4a` ACs, `PRE`, `CLONE`, `SETUP`, `H1`, `FIXTURES`, `SUITE`, `KNOB`, `TEARDOWN`).
   - `TEARDOWN` (`PASS`): `["npm run stack:down exit 0", "left after cleanup: 0 containers, 0 volumes (exact lane names included), 0 networks", "other projects' containers that stopped or restarted: /qalead-la-76-qa-acceptance-25829, /sto-it-mq-411b497de839, /sto-it-45baf253bd03, /qalead-la-76-cogniate-app-1, /qalead-la-76-lti-service-1, /qalead-la-76-lti-gate-1, /qalead-la-76-lms-sim-1, /qalead-la-76-qa-platform-1, /qalead-la-76-sink-1, /sto-it-mq-3e35bed5eef1, /sto-it-590d108a0e76, /qalead-la-76-moodle-1, /qalead-la-76-postgres-1, /qalead-la-76-proxy-1 (information)"]`.
   - **Non-`PASS` IDs:** **None (`0`)**.

---

### 4.6 `qalead-la-97` (`T4b1, T4b2` on Moodle Lane `9563` / `172.25.0.0/16`)

1. **Disclosed Attempt 1 (`qalead-la-97-a8bbac53-2026-10-24T10-59-25-216Z`, `10:59:25Z–10:59:26Z`, `logs/qalead-la-97-t4b.log`):**
   - Started while `qalead-la-96` attempt 1 was still tearing down; `summary.json` recorded `1` entry (`0 PASS, 1 FAIL`: `PRE` with notes `["node 24.21.0, docker 29.9.2, compose 5.6.1", "project qalead-la-97, PUBLIC_PORT 9563, STACK_SUBNET 172.25.0.0/16", "127.0.0.1:9563 is busy", "STACK_SUBNET overlaps: qalead-la-96_default 172.25.0.0/16", "other containers on this Docker host: 14 (not touched by QA)"]`). Created `0` containers, volumes, or networks.
2. **Completed Run (`qalead-la-97-a8bbac53-2026-10-24T11-02-34-317Z`, `11:02:34Z–11:08:47Z`, `373 s` / `6.2 min`, `logs/qalead-la-97-t4b-r2.log`):**
   - **Command:**
     `COMPOSE_PROJECT_NAME=qalead-la-97 PUBLIC_PORT=9563 STACK_SUBNET="172.25.0.0/16" COURSE_FIXTURES_DIR="/Users/quangnguyen/cogniate-qa-runs/LA/GATE/course-fixtures" node /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-final-1-d2/tests/host/run-t4b.mjs --sha a8bbac538cfe1e305f410279d7879421d64a5a1f --source /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-final-1-d2 --replace-tests --tests-from /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-final-1-d2/tests --tasks T4b1,T4b2`
   - **Status Counts (`summary.json` `results`):** **`48/48` step entries `PASS`, `40/40` unique IDs `PASS`, `0 FAIL`** (all `T4b1` and `T4b2` ACs including `AC-T4-10`, `AC-T4-16`, `AC-T4-29`, `AC-T4-34`, plus `PRE`, `CLONE`, `SETUP`, `H1`, `FIXTURES`, `SUITE`, `KNOB`, `HOSTCTL`, `TEARDOWN`).
   - `TEARDOWN` (`PASS`): `["npm run stack:down exit 0", "left after cleanup: 0 containers, 0 volumes (exact lane names included), 0 networks", "other projects' containers that stopped or restarted: /sto-it-mq-555aaec42cff, /sto-it-bdb431b01305, /sto-it-mq-534993d4c848, /sto-it-73982a40c569, /qalead-la-77-moodle-1, /qalead-la-77-cogniate-app-1, /qalead-la-77-lti-service-1, /qalead-la-77-postgres-1, /qalead-la-77-proxy-1 (information)"]`.
   - **Non-`PASS` IDs:** **None (`0`)**.

---

### 4.7 `qalead-la-98` (`T5a, T5b, T6` on Moodle Lane `9563` / `172.25.0.0/16`)

- **Run ID & Artifact:** `/Users/quangnguyen/cogniate-qa-runs/LA/RUN-D2/artifacts/qalead-la-98-a8bbac53-2026-10-24T11-09-07-105Z/summary.json` (`logs/qalead-la-98-t5-t6.log`).
- **Start / End Time:** `2026-10-24T11:09:07Z` – `2026-10-24T11:32:25Z` (`1,398 s` / `23.3 min`).
- **Command:**
  `COMPOSE_PROJECT_NAME=qalead-la-98 PUBLIC_PORT=9563 STACK_SUBNET="172.25.0.0/16" COURSE_FIXTURES_DIR="/Users/quangnguyen/cogniate-qa-runs/LA/GATE/course-fixtures" node /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-final-1-d2/tests/host/run-t5.mjs --sha a8bbac538cfe1e305f410279d7879421d64a5a1f --source /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-final-1-d2 --replace-tests --tests-from /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-final-1-d2/tests --tasks T5a,T5b,T6`
- **Status Counts (`summary.json` `results`):** **`79/79` step entries `PASS`, `63/63` unique IDs `PASS`, `0 FAIL`**:
  - **All `21/21` `T5a` ACs (`PASS`):** `AC-T5-01..08`, `AC-T5-12`, `AC-T5-13`, `AC-T5-15` (`2` entries: main + `knob-PLAY_TTL_SECONDS`), `AC-T5-16`, `AC-T5-17`, `AC-T5-20..24`, `AC-T5-34`, `AC-T5-35`, `AC-T5-37`.
  - **All `16/16` `T5b` ACs/probes (`24/24` `T5b` Playwright tests `PASS`):** `SETUP-T5b`, `AC-T5-09`, **`AC-T5-36` (`PASS`)**, `AC-T5-10` (`2` entries), `AC-T5-11`, `AC-T5-27`, `AC-T5-28`, `AC-T5-29`, `AC-T5-14`, `AC-T5-30` (`3` entries: outage order, `P2`, `P2 in flight and restart`), `AC-T5-31`, `AC-T5-32` (`2` entries), `AC-T5-33`, `AC-T5-07 (P11)`, `P11` (`2` entries: `pending` and `failed`), **`P5` (`PASS`)**, `AC-T5-18` (`2` entries), `AC-T5-19`.
  - **All `14/14` `T6` ACs (`18/18` `T6` Playwright tests `PASS`):** `AC-T6-01..14` (including `AC-T6-01` & `AC-T6-09` on `Integrations.tsx` with `data-channel-id`, `AC-T6-07` `WE-F11`, `AC-T6-12` `WE-F7`, `AC-T6-13` `WE-F8`).
  - **All `12/12` host/setup IDs (`PASS`):** `PRE`, `CLONE`, `SETUP`, `H1`, `FIXTURES`, `SUITE` (`4/4` entries `PASS`), `SETUP-T5a`, `KNOB` (`2/2`), `SETUP-T5b`, `SETUP-T6` (`4/4`), `HOSTCTL` (`14/14` host actions exit `0`), `TEARDOWN` (`["npm run stack:down exit 0", "left after cleanup: 0 containers, 0 volumes (exact lane names included), 0 networks", "other projects' containers that stopped or restarted: /sto-drill-a-8429f19428fc, /sto-it-mq-088caa975fc3, /sto-it-88110fca2d34, /qalead-la-78-moodle-1, /qalead-la-78-cogniate-app-1, /qalead-la-78-lti-service-1, /qalead-la-78-postgres-1, /qalead-la-78-proxy-1 (information)"]`).
- **Non-`PASS` IDs:** **None (`0`)**.

---

### 4.8 `qalead-la-99` (`T8` on Moodle Lane `9563` / `172.25.0.0/16`)

- **Run ID & Artifact:** `/Users/quangnguyen/cogniate-qa-runs/LA/RUN-D2/artifacts/qalead-la-99-a8bbac53-2026-10-24T11-32-48-203Z/summary.json` (`logs/qalead-la-99-t8.log`).
- **Start / End Time:** `2026-10-24T11:32:48Z` – `2026-10-24T11:42:31Z` (`583 s` / `9.7 min`).
- **Command:**
  `COMPOSE_PROJECT_NAME=qalead-la-99 PUBLIC_PORT=9563 STACK_SUBNET="172.25.0.0/16" COURSE_FIXTURES_DIR="/Users/quangnguyen/cogniate-qa-runs/LA/GATE/course-fixtures" node /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-final-1-d2/tests/host/run-t8.mjs --sha a8bbac538cfe1e305f410279d7879421d64a5a1f --source /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-final-1-d2 --replace-tests --tests-from /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-final-1-d2/tests`
- **Status Counts (`summary.json` `results`):** **`36/36` step entries `PASS`, `23/23` unique IDs `PASS`, `0 FAIL`**:
  - All `T8` ACs and concurrency probes (`AC-T8-02..10`, `C-T8-01` `2/2`, `C-T8-02`) and all `12/12` host/setup IDs (`PRE`, `CLONE`, `DOCTOR`, `SETUP`, `H1`, `FIXTURES`, `SETUP-T5a`, `SETUP-T8`, `SUITE` `5/5`, `HOSTCTL` `5/5`, `KNOB` `4/4`, `TEARDOWN`) passed `100%`.
  - `TEARDOWN` (`PASS`): `["npm run stack:down exit 0", "left after cleanup: 0 containers, 0 volumes (exact lane names included), 0 networks", "other projects' containers that stopped or restarted: /sto-it-mq-3385bf5efd26, /sto-it-mq-a9e8280419d9, /sto-it-25dc8f97fcfc, /sto-it-b03c0bd16658, /qalead-la-79-qa-acceptance-90658, /qalead-la-79-cogniate-app-1, /qalead-la-79-lti-service-1, /qalead-la-79-lti-gate-1, /qalead-la-79-qa-platform-1, /qalead-la-79-sink-1, /qalead-la-79-lms-sim-1, /qalead-la-79-moodle-1, /qalead-la-79-postgres-1, /qalead-la-79-proxy-1 (information)"]`.
- **Non-`PASS` IDs:** **None (`0`)**.

---

## 5. Phase 2 Runs on `la-final-test-2` (`M1 sim`, `M2`, and `T7 × 3` Rerun)

- **Status:** `pending: awaiting la-final-test-2 GO from Lead` (`qalead-la-90` `M1 --phase sim --provider all`, `qalead-la-91` `M2`, and `T7 × 3` rerun on `la-final-test-2`).

---

## 6. `M3` Global-State Environment Notes (`TEST-STRATEGY.md` §5.4) & Docker Boundary Records

- **Foreign Container Classes Observed During Phase 1 (`sto-*` and D1 `qalead-la-7x` Listed Apart):**
  1. **Savoy (`sto-*`):** Concurrent `sto-it-*` and `sto-drill-*` containers ran on the shared Docker host throughout `10:30:00Z–11:42:31Z`; D2 never touched any `sto-*` container, volume, or network.
  2. **Lead QA D1 (`qalead-la-70..80`):** Concurrent D1 stacks ran on D1's dedicated ports (`9473`/`9543`) and subnets (`172.23.0.0/16`/`172.21.0.0/16`) and are listed apart in `docker-records/` and in the `TEARDOWN` informational notes of `qalead-la-94..99`; D2 never touched any `qalead-la-70..80` resource.
- **`before` Docker Boundary Records (`/Users/quangnguyen/cogniate-qa-runs/LA/RUN-D2/docker-records/`, `umask 077`):**
  - `before-timestamp.txt`: `2026-10-24T10:30:00Z`.
  - `before-sto-containers.txt`: `1` (`sto-it-mq-4f7d08311988`); `before-d1-containers.txt`: `0` (between D1 runs at `10:30:00Z`); `before-non-sto-d1-containers.txt`: `0`.
  - `before-networks.txt`: `3` (`bridge`, `host`, `none`).
  - `before-32-volumes-inspect.json`: All **`32/32` protected non-`sto-*` persistent volumes** verified `100%` byte-identical to Slot 3F's `after-32-volumes-inspect.json` (`diff-slot3f-to-d2-before-32-volumes.txt` is `0` bytes).
- **`after` Docker Boundary Records:** Will be recorded immediately after Phase 2 (`la-final-test-2`) teardown and before `"lead QA D2 stack down"`.
