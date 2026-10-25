# Milestone-End Full Run D2 of 2 on Final SHA `a8bbac53` (`AC-LA-E7-09-05` / `LD-25`)

Verdict: PASS
Round: D2 (Run 2 of 2 for `AC-LA-E7-09-05` per `LD-25`)
Product SHA: `a8bbac538cfe1e305f410279d7879421d64a5a1f` (`tag: la-final-product-1`)
Test SHA (Phase 1): `la-final-test-1` (`85ddf97332063f75bdc5636cb410fc0d6ee25099`)
Test SHA (Phase 2): `la-final-test-2` (`68b2e9091d1300114187d329f2dcb45740227e6d` = `la-final-test-1` + `ld9-addendum-r6` + `ld9-addendum-r7`)

---

## 1. Run D2 Context, Source Verification & Scope (`LD-25`)

| Item | Value |
| --- | --- |
| Role & Session | Lead QA Helper (Antigravity session, Orca task `task_41f5dfae682a`, dispatch `ctx_87a16c192840`) |
| Final Product SHA (`$FINAL_SHA`) | `a8bbac538cfe1e305f410279d7879421d64a5a1f` (`Merge la-p 0eedb055: LA-E1-11 follow-up (BD-A1-119): data-channel-id on every channel card`) |
| Phase 1 Gate Source Clone (`src-final-1-d2`) | `/Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-final-1-d2` (cloned with `git clone --no-hardlinks /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-final-1 /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-final-1-d2` at tag `la-final-test-1` = `85ddf97332063f75bdc5636cb410fc0d6ee25099`; `git status --short` empty; `git diff --exit-code a8bbac538cfe1e305f410279d7879421d64a5a1f HEAD -- . ':!tests'` exit `0`) |
| Phase 2 Gate Source Clone (`src-final-2-d2`) | `/Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-final-2-d2` (cloned with `git clone --no-hardlinks /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-final-2 /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-final-2-d2` at tag `la-final-test-2` = `68b2e9091d1300114187d329f2dcb45740227e6d`; `git status --short` empty; `git diff --stat la-final-test-1 la-final-test-2` = `3 files changed, 8 insertions(+), 7 deletions(-)` in `tests/host/storage-docker.mjs`, `tests/host/storage-docker.selftest.mjs`, `tests/acceptance/T8/2-shell.spec.ts`; `git diff --exit-code a8bbac538cfe1e305f410279d7879421d64a5a1f HEAD -- . ':!tests'` exit `0`) |
| Owned Compose Prefix & Lanes | `qalead-la-92..105` (one stack at a time for D2):<br>• **SIM lane:** `PUBLIC_PORT=9643`, `STACK_SUBNET=172.22.0.0/16` (`qalead-la-92`, `qalead-la-101..104`)<br>• **Moodle lane:** `PUBLIC_PORT=9563`, `STACK_SUBNET=172.25.0.0/16` (`qalead-la-93..100`, `qalead-la-105`)<br>• Never used D1 ports (`9473`/`9543`) or D1 subnets (`172.23.0.0/16`/`172.21.0.0/16`); never touched `qalead-la-70..83`, `qa4-la-*`, or `sto-*` resources |
| Start & End Time (UTC) | `before-timestamp.txt`: `2026-10-24T10:30:00Z` → `after-timestamp.txt`: `2026-10-24T13:42:23Z` (`"lead QA D2 stack down"` sent at `2026-10-24T13:43:52Z` in `msg_d45c2cb8bb32`) |
| Durable Evidence Root | `/Users/quangnguyen/cogniate-qa-runs/LA/RUN-D2/` (`docker-records/`, `logs/`, `artifacts/qalead-la-92..105-*`, `golden-capture-a8bbac538cfe1e305f410279d7879421d64a5a1f/`, `golden-capture-a8bbac538cfe1e305f410279d7879421d64a5a1f-port9443/`) |

---

## 2. Environment Events & Gate Findings Recorded During D1 / D2 (`LD-25` & `TEST-STRATEGY.md` §2.6)

Per `tests/ltiaas/TEST-STRATEGY.md` §2.6 and `docs/team/ltiaas/plan.md` `LD-25`, every environment event, failure, or flake is recorded as a finding and never counts as a `PASS` for that run; any suite with a `FAIL` or flake is re-run on the final tag (`la-final-test-2`):

1. **Host Docker Desktop Update at `2026-10-24T09:20:06Z` & D1 `qalead-la-70` Environment Aborts (`BD-A2-113` / `ld9-addendum-r6`):**
   - At `2026-10-24T09:20:06Z`, `/Applications/Docker.app` updated on the host from Docker CLI `29.9.1` / Compose `v5.6.0` to Docker CLI `29.9.2` (`sha256: 6bbc39e9f2950720216f64c22d6e38afdd86a4672eee0d4e4389263c40ebd3e3`) and Compose `v5.6.1` (`sha256: 31664b8ce83f3900ed3c52b8c2276706832793a0a379d9661defd6f88b386def`).
   - D1's first `qalead-la-70` (`M1 --phase sim --provider all`, started `09:11:51Z`) had passed `253/253` executed cases (`0` failed) when the Docker daemon restarted at `09:20:06Z` and dropped the stack; D1's second `qalead-la-70` (`09:24:35Z`) aborted at preflight with `FAIL G1-IDENTITY` because `tests/host/storage-docker.mjs:173` `BOUND_IDENTITY` was pinned to `29.9.1` / `5.6.0`. Both `qalead-la-70` runs are recorded as environment events (never `PASS`).
   - The `ADR-012` §17 `G-1` diagnostic passed (`G-1` result 2, `BD-A2-113`), and QA-3's `ld9-addendum-r6` (`7dc9d9dc`) updated `BOUND_IDENTITY` to `29.9.2` / `5.6.1`. In Phase 2 (`qalead-la-101`), `G1-IDENTITY` passed on `29.9.2` / `5.6.1` and `M1 --phase sim --provider all` passed `394/394` manifest cases.
2. **D1 `qalead-la-80` (`T8`) `AC-T8-10` `FAIL` = Finding `WE-F13` (Option Race; Fix in `ld9-addendum-r7`):**
   - In D1's `qalead-la-80` (`T8` on `la-final-test-1`), `AC-T8-10` failed due to a connection-option load race in `tests/acceptance/T8/2-shell.spec.ts` (`WE-F13`). Per `TEST-STRATEGY.md` §2.6, `qalead-la-80` is recorded as a `FAIL` finding (`WE-F13`, never a `PASS`), fixed in `ld9-addendum-r7` (`68b2e909` / `la-final-test-2`), and `T8` passed `36/36` (`23/23` unique IDs) on `la-final-test-2` in both D1 (`qalead-la-83`) and D2 (`qalead-la-105`, as well as `qalead-la-99` on `la-final-test-1`).
3. **D2 `qalead-la-93` (`T7 × 3`) Run 2 `B4 AC-T7-08` & `B6 AC-T7-09` `FAIL` = Flake Finding Under Dual Moodle Stack Load:**
   - In D2's `qalead-la-93` (`T7 × 3` on `la-final-test-1`, `10:32:47Z–10:43:08Z`), Run 1 (`194 s`, `17 PASS, 0 FAIL, 1 SKIP`) and Run 3 (`216 s`, `17 PASS, 0 FAIL, 1 SKIP`) passed, while Run 2 (`202 s`, `15 PASS, 2 FAIL, 1 SKIP`) failed when `B4 AC-T7-08` timed out (`15000 ms`) clicking `Save and return to course` (`#id_submitbutton2`) while two Moodle stacks (`qalead-la-73` in D1 and `qalead-la-93` in D2) were running simultaneously on the host, causing dependent `B6 AC-T7-09 AC-T7-07` to fail with `Error: Needs B4 (activity B) from an earlier step`.
   - Per `TEST-STRATEGY.md` §2.6, `qalead-la-93` is recorded as **`FAIL (flake finding — dual Moodle stack load)`** and never counts as `PASS`. In Phase 2 (`qalead-la-100` on `la-final-test-2`, run while D1 was on its SIM lane so only one Moodle stack ran), `T7 × 3` passed `3 × 17 PASS, 0 FAIL, 1 SKIP` (`8/8` host steps `OK`).
4. **D2 `qalead-la-102` & `qalead-la-103` (`M2`) `M2-11.blackboard-keyboard` `FAIL` = Flake Finding Under Concurrent Host Load:**
   - In `qalead-la-102` (`13:12:28Z–13:17:42Z`, while D1's `qalead-la-83` `T8` + `.mbz` Build Runner ran concurrently) and `qalead-la-103` (`13:18:14Z–13:21:33Z`, while `qa4-la-k1-r2` started up concurrently), `63/64` `M2` manifest cases passed and `M2-11.blackboard-keyboard` (`06-keyboard-axe.m2.ts:75`) timed out (`20,000 ms`) at `pendingWizard` (`page.waitForURL(/\/integrations\/blackboard\/con_[^/?#]+$/)`) when `tabTo` tabbed and pressed `Enter` on `Next` while the Blackboard connect page was under load.
   - Per `TEST-STRATEGY.md` §2.6 and `LD-25`, `qalead-la-102` and `qalead-la-103` are recorded as **`FAIL (flake finding — load)`** and never count as `PASS`. On rerun in `qalead-la-104` (`13:29:27Z–13:32:25Z` on `la-final-test-2`), `M2` passed **`64/64` manifest cases (`0 FAIL`), including `M2-11.blackboard-keyboard` `PASS`**.
5. **Disclosed D2 Runner Invocation Events Before Test Execution (`qalead-la-96` Attempt 1 & `qalead-la-97` Attempt 1):**
   - `qalead-la-96-a8bbac53-2026-10-24T10-58-57-151Z` (`run-t4a.mjs` attempt 1): invoked without `COURSE_FIXTURES_DIR`; failed at host step `FIXTURES` (`5 PASS, 1 FAIL`, `0` tests executed) and tore down cleanly (`0` resources left).
   - `qalead-la-97-a8bbac53-2026-10-24T10-59-25-216Z` (`run-t4b.mjs` attempt 1): invoked while `qalead-la-96` attempt 1 was still tearing down; aborted immediately at `PRE` (`0 PASS, 1 FAIL` on `127.0.0.1:9563 is busy`) with `0` Docker resources created.

---

## 3. Master Summary Table Across All D2 Runs (`qalead-la-92..105`)

| Compose Project | Phase & Test Tag | Lane (`PORT` / `SUBNET`) | Suite / Scope | Run ID (Artifact Folder) | Start–End (UTC) | Duration | Status Counts (`summary.json` & Case Ledger) | Non-`PASS` IDs (Excluding `M3` Global-State Environment Notes) | Run Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **`qalead-la-92`** | Phase 1 (`la-final-test-1` `85ddf973`) | SIM (`9643` / `172.22.0.0/16`) | `G1–G4` Golden Capture & `compare.mjs` | `qalead-la-92-a8bbac53-2026-10-24T10-30-37-065Z` | `10:30:37Z–10:32:29Z` | `1.9 min` | `9/9 PASS` (`8/8` unique IDs `PASS`, `0 FAIL`); `compare.mjs` exit `0` (`280` diffs, `0` unexplained) | None (`0`) | **`PASS`** |
| `qalead-la-93` | Phase 1 (`la-final-test-1` `85ddf973`) | Moodle (`9563` / `172.25.0.0/16`) | `T7 × 3` (`run-t7.mjs --runs 3`) | `qalead-la-93-a8bbac53-2026-10-24T10-32-47-040Z` | `10:32:47Z–10:43:08Z` | `10.4 min` | Host steps: `7 OK, 1 FAIL` (`run 2`); Runs 1 & 3: `17 PASS, 0 FAIL, 1 SKIP`; Run 2: `15 PASS, 2 FAIL, 1 SKIP` | Run 2: `B4 AC-T7-08`, `B6 AC-T7-09 AC-T7-07` | **`FAIL` (flake finding — dual Moodle stack load; re-run in `qalead-la-100`)** |
| **`qalead-la-94`** | Phase 1 (`la-final-test-1` `85ddf973`) | Moodle (`9563` / `172.25.0.0/16`) | `T2a, T2b, T3a, T3b` (`run-t2.mjs`) | `qalead-la-94-a8bbac53-2026-10-24T10-44-53-643Z` | `10:44:53Z–10:55:13Z` | `10.3 min` | `76/76 PASS` (`64/64` unique IDs `PASS`, `0 FAIL`) | None (`0`) | **`PASS`** |
| **`qalead-la-95`** | Phase 1 (`la-final-test-1` `85ddf973`) | Moodle (`9563` / `172.25.0.0/16`) | `T3c` (`run-t3c.mjs`) | `qalead-la-95-a8bbac53-2026-10-24T10-56-00-915Z` | `10:56:00Z–10:58:27Z` | `2.5 min` | `28/28 PASS` (`28/28` unique IDs `PASS`, `0 FAIL`) | None (`0`) | **`PASS`** |
| `qalead-la-96` (attempt 1) | Phase 1 (`la-final-test-1` `85ddf973`) | Moodle (`9563` / `172.25.0.0/16`) | `T4a` (missing `COURSE_FIXTURES_DIR`) | `qalead-la-96-a8bbac53-2026-10-24T10-58-57-151Z` | `10:58:57Z–11:00:08Z` | `1.2 min` | `5 PASS, 1 FAIL` (`0` tests ran) | `FIXTURES` (`not found`) | Disclosed invocation error (`0` tests ran) |
| `qalead-la-97` (attempt 1) | Phase 1 (`la-final-test-1` `85ddf973`) | Moodle (`9563` / `172.25.0.0/16`) | `T4b1, T4b2` (started during `96` teardown) | `qalead-la-97-a8bbac53-2026-10-24T10-59-25-216Z` | `10:59:25Z–10:59:26Z` | `0.0 min` | `0 PASS, 1 FAIL` (`0` Docker resources created) | `PRE` (`9563` busy / subnet overlap) | Disclosed preflight abort (`0` resources created) |
| **`qalead-la-96`** | Phase 1 (`la-final-test-1` `85ddf973`) | Moodle (`9563` / `172.25.0.0/16`) | `T4a` (`run-t4a.mjs`) | `qalead-la-96-a8bbac53-2026-10-24T11-00-22-727Z` | `11:00:22Z–11:02:20Z` | `2.0 min` | `19/19 PASS` (`15/15` unique IDs `PASS`, `0 FAIL`) | None (`0`) | **`PASS`** |
| **`qalead-la-97`** | Phase 1 (`la-final-test-1` `85ddf973`) | Moodle (`9563` / `172.25.0.0/16`) | `T4b1, T4b2` (`run-t4b.mjs`) | `qalead-la-97-a8bbac53-2026-10-24T11-02-34-317Z` | `11:02:34Z–11:08:47Z` | `6.2 min` | `48/48 PASS` (`40/40` unique IDs `PASS`, `0 FAIL`) | None (`0`) | **`PASS`** |
| **`qalead-la-98`** | Phase 1 (`la-final-test-1` `85ddf973`) | Moodle (`9563` / `172.25.0.0/16`) | `T5a, T5b, T6` (`run-t5.mjs`) | `qalead-la-98-a8bbac53-2026-10-24T11-09-07-105Z` | `11:09:07Z–11:32:25Z` | `23.3 min` | `79/79 PASS` (`63/63` unique IDs `PASS`, `0 FAIL`: `21/21` `T5a`, `16/16` `T5b` / `24/24` tests, `14/14` `T6` / `18/18` tests) | None (`0`) | **`PASS`** |
| **`qalead-la-99`** | Phase 1 (`la-final-test-1` `85ddf973`) | Moodle (`9563` / `172.25.0.0/16`) | `T8` (`run-t8.mjs`) | `qalead-la-99-a8bbac53-2026-10-24T11-32-48-203Z` | `11:32:48Z–11:42:31Z` | `9.7 min` | `36/36 PASS` (`23/23` unique IDs `PASS`, `0 FAIL`) | None (`0`) | **`PASS`** |
| **`qalead-la-100`** | Phase 2 (`la-final-test-2` `68b2e909`) | Moodle (`9563` / `172.25.0.0/16`) | `T7 × 3` (`run-t7.mjs --runs 3`) | `qalead-la-100-a8bbac53-2026-10-24T12-37-35-212Z` | `12:37:35Z–12:47:20Z` | `9.8 min` | Host steps: `8/8 OK, 0 FAIL`; Runs 1, 2, 3: `3 × (17 PASS, 0 FAIL, 1 SKIP)` in `191 s`, `193 s`, `192 s` (`51 PASS, 0 FAIL, 3 SKIP`) | None (`0`; `DEMO AC-T7-15` `SKIP` × 3 expected) | **`PASS`** |
| **`qalead-la-101`** | Phase 2 (`la-final-test-2` `68b2e909`) | SIM (`9643` / `172.22.0.0/16`) | `M1 --phase sim --provider all` | `qalead-la-101-a8bbac53-2026-10-24T12-48-07-766Z` | `12:48:07Z–13:12:07Z` | `24.0 min` | `m1-case-results.json`: **`394/394 PASS` (`0 FAIL`)**; `G1-IDENTITY`: **`PASS`** (`29.9.2` / `5.6.1`); `summary.json`: `399 PASS, 1 FAIL` (`M3-ISOLATION` environment note) | None (`0` functional; `M3-ISOLATION` noted D1 `qalead-la-81` & `sto-*`) | **`PASS`** |
| `qalead-la-102` | Phase 2 (`la-final-test-2` `68b2e909`) | SIM (`9643` / `172.22.0.0/16`) | `M2` browser suite (`run-m2.mjs`) | `qalead-la-102-a8bbac53-2026-10-24T13-12-28-449Z` | `13:12:28Z–13:17:42Z` | `5.2 min` | `m2-case-results.json`: `63 PASS, 1 FAIL`; `summary.json`: `69 PASS, 3 FAIL` | `M2-11.blackboard-keyboard` (`ERROR` wrapper) | **`FAIL` (flake finding — load; re-run in `qalead-la-104`)** |
| `qalead-la-103` | Phase 2 (`la-final-test-2` `68b2e909`) | SIM (`9643` / `172.22.0.0/16`) | `M2` browser suite (`run-m2.mjs`) | `qalead-la-103-a8bbac53-2026-10-24T13-18-14-845Z` | `13:18:14Z–13:21:33Z` | `3.3 min` | `m2-case-results.json`: `63 PASS, 1 FAIL`; `summary.json`: `69 PASS, 3 FAIL` | `M2-11.blackboard-keyboard` (`ERROR` wrapper) | **`FAIL` (flake finding — load; re-run in `qalead-la-104`)** |
| **`qalead-la-104`** | Phase 2 (`la-final-test-2` `68b2e909`) | SIM (`9643` / `172.22.0.0/16`) | `M2` browser suite (`run-m2.mjs`) | `qalead-la-104-a8bbac53-2026-10-24T13-29-27-799Z` | `13:29:27Z–13:32:25Z` | `3.0 min` | `m2-case-results.json`: **`64/64 PASS` (`0 FAIL`)**; `summary.json`: `70 PASS, 1 FAIL` (`M3-06-M2` environment note) | None (`0` functional; `M3-06-M2` noted `qa4-la-k1-r2` & `sto-*`) | **`PASS`** |
| **`qalead-la-105`** | Phase 2 (`la-final-test-2` `68b2e909`) | Moodle (`9563` / `172.25.0.0/16`) | `T8` (`run-t8.mjs` per `LD-25`) | `qalead-la-105-a8bbac53-2026-10-24T13-32-48-725Z` | `13:32:48Z–13:41:57Z` | `9.2 min` | `36/36 PASS` (`23/23` unique IDs `PASS`, `0 FAIL`) | None (`0`) | **`PASS`** |

---

## 4. Detailed Accounting per Run: Phase 1 (`la-final-test-1` = `85ddf97332063f75bdc5636cb410fc0d6ee25099`)

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
- **Host Step Counts (`summary.json` `steps`):** **`8` total (`7 OK`, `1 FAIL` on `run 2`)**:
  - `run 1`: `npm run test:e2e exit 0 in 194 s (e2e:reset 45 s); 17 pass, 0 fail, 1 skip` (`OK`).
  - `run 2`: `npm run test:e2e exit 1 in 202 s (e2e:reset 48 s); 15 pass, 2 fail, 1 skip` (**`FAIL` — flake finding under dual Moodle stack load**):
    - **`B4 AC-T7-08`** (`2-scenario-b.spec.ts`, **`FAIL`**): `TimeoutError: locator.click: Timeout 15000ms exceeded. Call log: - waiting for getByRole('button', { name: 'Save and return to course', exact: true }) - locator resolved to <input type="submit" name="submitbutton2" id="id_submitbutton2" value="Save and return to course" class="btn btn-primary"/> - attempting click action 2 × waiting for element to be visible, enabled and stable`.
    - **`B6 AC-T7-09 AC-T7-07`** (`2-scenario-b.spec.ts`, **`FAIL`**): `Error: Needs B4 (activity B) from an earlier step (that step failed or did not run). at lib/e2e.ts:116`.
  - `run 3`: `npm run test:e2e exit 0 in 216 s (e2e:reset 59 s); 17 pass, 0 fail, 1 skip` (`OK`).
  - `teardown`: `stack:down exit 0; left: 0 containers, 0 volumes, 0 networks` (`OK`).
- **Run Verdict:** **`FAIL (flake finding — load)`** (never a `PASS` per `TEST-STRATEGY.md` §2.6; re-run in Phase 2 `qalead-la-100` where all 3 runs passed `3 × 17 PASS, 0 FAIL, 1 SKIP`).

---

### 4.3 `qalead-la-94` (`T2a, T2b, T3a, T3b` on Moodle Lane `9563` / `172.25.0.0/16`)

- **Run ID & Artifact:** `/Users/quangnguyen/cogniate-qa-runs/LA/RUN-D2/artifacts/qalead-la-94-a8bbac53-2026-10-24T10-44-53-643Z/summary.json` (`logs/qalead-la-94-t2-t3ab.log`).
- **Start / End Time:** `2026-10-24T10:44:53Z` – `2026-10-24T10:55:13Z` (`620 s` / `10.3 min`).
- **Status Counts (`summary.json` `results`):** **`76/76` step entries `PASS`, `64/64` unique IDs `PASS`, `0 FAIL`** (all `T2a`, `T2b`, `T3a`, `T3b` ACs `AC-T2-01..25`, `AC-T3-01..28`, `PRE`, `CLONE`, `SETUP`, `H1`, `SUITE`, `KNOB`, `HOSTCTL`, `TEARDOWN`).
- **Non-`PASS` IDs:** **None (`0`)**.

---

### 4.4 `qalead-la-95` (`T3c` on Moodle Lane `9563` / `172.25.0.0/16`)

- **Run ID & Artifact:** `/Users/quangnguyen/cogniate-qa-runs/LA/RUN-D2/artifacts/qalead-la-95-a8bbac53-2026-10-24T10-56-00-915Z/summary.json` (`logs/qalead-la-95-t3c.log`).
- **Start / End Time:** `2026-10-24T10:56:00Z` – `2026-10-24T10:58:27Z` (`147 s` / `2.5 min`).
- **Status Counts (`summary.json` `results`):** **`28/28` step entries `PASS`, `28/28` unique IDs `PASS`, `0 FAIL`** (all `T3c` ACs `AC-T3-06..24`, `AC-T3-27`, `PRE`, `CLONE`, `SETUP`, `H1`, `SUITE`, `KNOB`, `TEARDOWN`).
- **Non-`PASS` IDs:** **None (`0`)**.

---

### 4.5 `qalead-la-96` (`T4a` on Moodle Lane `9563` / `172.25.0.0/16`)

1. **Disclosed Attempt 1 (`qalead-la-96-a8bbac53-2026-10-24T10-58-57-151Z`, `10:58:57Z–11:00:08Z`, `logs/qalead-la-96-t4a.log`):**
   - Invoked without `COURSE_FIXTURES_DIR`; failed at `FIXTURES` (`5 PASS, 1 FAIL`, `0` tests executed) and tore down cleanly (`0` resources left).
2. **Completed Run (`qalead-la-96-a8bbac53-2026-10-24T11-00-22-727Z`, `11:00:22Z–11:02:20Z`, `118 s` / `2.0 min`, `logs/qalead-la-96-t4a-r2.log`):**
   - **Status Counts (`summary.json` `results`):** **`19/19` step entries `PASS`, `15/15` unique IDs `PASS`, `0 FAIL`** (all `T4a` ACs, `PRE`, `CLONE`, `SETUP`, `H1`, `FIXTURES`, `SUITE`, `KNOB`, `TEARDOWN`).
   - **Non-`PASS` IDs:** **None (`0`)**.

---

### 4.6 `qalead-la-97` (`T4b1, T4b2` on Moodle Lane `9563` / `172.25.0.0/16`)

1. **Disclosed Attempt 1 (`qalead-la-97-a8bbac53-2026-10-24T10-59-25-216Z`, `10:59:25Z–10:59:26Z`, `logs/qalead-la-97-t4b.log`):**
   - Started while `qalead-la-96` attempt 1 was tearing down; aborted at `PRE` (`0 PASS, 1 FAIL` on `127.0.0.1:9563 is busy`) with `0` Docker resources created.
2. **Completed Run (`qalead-la-97-a8bbac53-2026-10-24T11-02-34-317Z`, `11:02:34Z–11:08:47Z`, `373 s` / `6.2 min`, `logs/qalead-la-97-t4b-r2.log`):**
   - **Status Counts (`summary.json` `results`):** **`48/48` step entries `PASS`, `40/40` unique IDs `PASS`, `0 FAIL`** (all `T4b1` and `T4b2` ACs including `AC-T4-10`, `AC-T4-16`, `AC-T4-29`, `AC-T4-34`, plus `PRE`, `CLONE`, `SETUP`, `H1`, `FIXTURES`, `SUITE`, `KNOB`, `HOSTCTL`, `TEARDOWN`).
   - **Non-`PASS` IDs:** **None (`0`)**.

---

### 4.7 `qalead-la-98` (`T5a, T5b, T6` on Moodle Lane `9563` / `172.25.0.0/16`)

- **Run ID & Artifact:** `/Users/quangnguyen/cogniate-qa-runs/LA/RUN-D2/artifacts/qalead-la-98-a8bbac53-2026-10-24T11-09-07-105Z/summary.json` (`logs/qalead-la-98-t5-t6.log`).
- **Start / End Time:** `2026-10-24T11:09:07Z` – `2026-10-24T11:32:25Z` (`1,398 s` / `23.3 min`).
- **Status Counts (`summary.json` `results`):** **`79/79` step entries `PASS`, `63/63` unique IDs `PASS`, `0 FAIL`**:
  - **All `21/21` `T5a` ACs (`PASS`):** `AC-T5-01..08`, `AC-T5-12`, `AC-T5-13`, `AC-T5-15` (`2` entries: main + `knob-PLAY_TTL_SECONDS`), `AC-T5-16`, `AC-T5-17`, `AC-T5-20..24`, `AC-T5-34`, `AC-T5-35`, `AC-T5-37`.
  - **All `16/16` `T5b` ACs/probes (`24/24` `T5b` Playwright tests `PASS`):** `SETUP-T5b`, `AC-T5-09`, **`AC-T5-36` (`PASS`)**, `AC-T5-10` (`2` entries), `AC-T5-11`, `AC-T5-27`, `AC-T5-28`, `AC-T5-29`, `AC-T5-14`, `AC-T5-30` (`3` entries), `AC-T5-31`, `AC-T5-32` (`2` entries), `AC-T5-33`, `AC-T5-07 (P11)`, `P11` (`2` entries), **`P5` (`PASS`)**, `AC-T5-18` (`2` entries), `AC-T5-19`.
  - **All `14/14` `T6` ACs (`18/18` `T6` Playwright tests `PASS`):** `AC-T6-01..14` (including `AC-T6-01` & `AC-T6-09` on `Integrations.tsx` with `data-channel-id`, `AC-T6-07` `WE-F11`, `AC-T6-12` `WE-F7`, `AC-T6-13` `WE-F8`).
  - **All `12/12` host/setup IDs (`PASS`):** `PRE`, `CLONE`, `SETUP`, `H1`, `FIXTURES`, `SUITE` (`4/4`), `SETUP-T5a`, `KNOB` (`2/2`), `SETUP-T5b`, `SETUP-T6` (`4/4`), `HOSTCTL` (`14/14`), `TEARDOWN`.
- **Non-`PASS` IDs:** **None (`0`)**.

---

### 4.8 `qalead-la-99` (`T8` on Moodle Lane `9563` / `172.25.0.0/16`)

- **Run ID & Artifact:** `/Users/quangnguyen/cogniate-qa-runs/LA/RUN-D2/artifacts/qalead-la-99-a8bbac53-2026-10-24T11-32-48-203Z/summary.json` (`logs/qalead-la-99-t8.log`).
- **Start / End Time:** `2026-10-24T11:32:48Z` – `2026-10-24T11:42:31Z` (`583 s` / `9.7 min`).
- **Status Counts (`summary.json` `results`):** **`36/36` step entries `PASS`, `23/23` unique IDs `PASS`, `0 FAIL`** (`AC-T8-02..10`, `C-T8-01` `2/2`, `C-T8-02`, `PRE`, `CLONE`, `DOCTOR`, `SETUP`, `H1`, `FIXTURES`, `SETUP-T5a`, `SETUP-T8`, `SUITE` `5/5`, `HOSTCTL` `5/5`, `KNOB` `4/4`, `TEARDOWN`).
- **Non-`PASS` IDs:** **None (`0`)**.

---

## 5. Detailed Accounting per Run: Phase 2 (`la-final-test-2` = `68b2e9091d1300114187d329f2dcb45740227e6d`)

### 5.1 `qalead-la-100` (`T7 × 3` on Moodle Lane `9563` / `172.25.0.0/16` — `ALL OK`)

- **Run ID & Artifact:** `/Users/quangnguyen/cogniate-qa-runs/LA/RUN-D2/artifacts/qalead-la-100-a8bbac53-2026-10-24T12-37-35-212Z/summary.json` (`logs/qalead-la-100-t7x3.log`).
- **Start / End Time:** `2026-10-24T12:37:35Z` – `2026-10-24T12:47:20Z` (`585 s` / `9.8 min`, run while D1 was on its SIM lane so only one Moodle stack ran).
- **Command:**
  `COMPOSE_PROJECT_NAME=qalead-la-100 PUBLIC_PORT=9563 STACK_SUBNET="172.25.0.0/16" COURSE_FIXTURES_DIR="/Users/quangnguyen/cogniate-qa-runs/LA/GATE/course-fixtures" node /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-final-2-d2/tests/e2e/host/run-t7.mjs --sha a8bbac538cfe1e305f410279d7879421d64a5a1f --runs 3 --replace-e2e`
- **Host Step Accounting (`summary.json` `steps`: `8/8 OK`, `0 FAIL`):**
  1. `preflight (free project, port, subnet)` (`OK`): `["project qalead-la-100, PUBLIC_PORT 9563, STACK_SUBNET 172.25.0.0/16"]`.
  2. `clone the SHA into a new folder` (`OK`): `["HEAD a8bbac538cfe1e305f410279d7879421d64a5a1f Merge la-p 0eedb055: LA-E1-11 follow-up (BD-A1-119): data-channel-id on every channel card", "clone /Users/quangnguyen/cogniate-qa-runs/qalead-la-100-a8bbac53-2026-10-24T12-37-35-212Z", "tests/e2e copied from the working copy (--replace-e2e):  12 files changed, 67 insertions(+), 4189 deletions(-); untracked: 0"]`.
  3. `course zips into the clone (tests/fixtures/courses, SHA-256 checked)` (`OK`): `["Build Your First Website with AI_ The Zero-to-Hero Micro-Sprint-scorm-v2.zip: OK", "Build Your First Website with AI_ The Zero-to-Hero Micro-Sprint-html.zip: OK"]`.
  4. `npm ci, gen-env, compose project name` (`OK`): `["npm ci 0, gen-env 0, compose name \"qalead-la-100\""]`.
  5. `run 1: npm run test:e2e exit 0 in 191 s (e2e:reset 45 s); 17 pass, 0 fail, 1 skip` (`OK`): `[]`.
  6. `run 2: npm run test:e2e exit 0 in 193 s (e2e:reset 52 s); 17 pass, 0 fail, 1 skip` (`OK`): `[]`.
  7. `run 3: npm run test:e2e exit 0 in 192 s (e2e:reset 48 s); 17 pass, 0 fail, 1 skip` (`OK`): `[]`.
  8. `teardown: stack qalead-la-100 removed with its volumes and networks` (`OK`): `["stack:down exit 0; left: 0 containers, 0 volumes, 0 networks"]`.
- **Playwright Test Counts Across 3 Runs:** **`3 × 17 PASS` (`51 PASS`), `0 FAIL`, `3 × 1 SKIP` (`DEMO AC-T7-15`)**, matching Slot 7 baseline `qalead-la-20` and D1 `qalead-la-73`. In all 3 runs (`run1..3/evidence/health-start.json` & `health-end.json`), `/healthz` of `lti-service`, `cogniate-app`, and `cogniate-content` showed `"profile": "default"` and `"knobs": []`, and `0` `test_knob_active` events appeared in `infra/.logs/*.jsonl` (`AC-T7-13` / `AC-LA-E7-09-03`).

---

### 5.2 `qalead-la-101` (`M1 --phase sim --provider all` on SIM Lane `9643` / `172.22.0.0/16`)

- **Run ID & Artifact:** `/Users/quangnguyen/cogniate-qa-runs/LA/RUN-D2/artifacts/qalead-la-101-a8bbac53-2026-10-24T12-48-07-766Z/summary.json` and `m1-case-results.json` (`logs/qalead-la-101-m1-sim.log`).
- **Start / End Time:** `2026-10-24T12:48:07Z` – `2026-10-24T13:12:07Z` (`1,440 s` / `24.0 min`).
- **Command:**
  `COMPOSE_PROJECT_NAME=qalead-la-101 PUBLIC_PORT=9643 STACK_SUBNET="172.22.0.0/16" node /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-final-2-d2/tests/host/run-m1.mjs --phase sim --provider all --sha a8bbac538cfe1e305f410279d7879421d64a5a1f --test-sha 68b2e9091d1300114187d329f2dcb45740227e6d --source /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-final-2-d2`
- **Manifest Case Ledger (`m1-case-results.json`):** **`394/394 PASS` (`0 FAIL`, `0` missing IDs)** across `common`, `blackboard`, and `canvas` (including all `18/18` `WE` rows `M1-37.*`, `M1-08.canvas.login-redirect`, `M1-15.canvas.dynamic-refused`, `M1-24.common.event-shapes`, `M1-38.*`, `M1-39.*`, `M1-40.*`).
- **`G1-IDENTITY` (`ADR-012` §17 / `BD-A2-113`):** **`PASS`** (`"Host OS, Docker CLI and Compose plugin equal the G-1 bound identities (ADR-012 §17)"`, notes `["bound identities match"]` on `node 24.21.0, docker 29.9.2, compose 5.6.1`).
- **`summary.json` Counts:** `400` total (`399 PASS`, `1 FAIL` on global-state `M3-ISOLATION` environment note):
  - `M3-ISOLATION` (`Existing non-QA-run containers and volumes remain unchanged`, `FAIL` — environment note per `TEST-STRATEGY.md` §5.4): notes `["containers changed: 12; volumes changed: 7d5cc0381f48b094fe95e36bc55038e4bad3823e5c195cae73735529bb3a6b11, ec228d503d027c051cb0195c9ead1839a96c461140872b0a97b3c7067d75ad76, qalead-la-81_appdb, qalead-la-81_e2e_tests_node_modules, qalead-la-81_ltidb, qalead-la-81_moodledata, qalead-la-81_pgdata"]` (D1's `qalead-la-81` SIM stack tore down while `qalead-la-101` was running).
  - `TEARDOWN` (`PASS`): `["npm run stack:down exit 0", "left after cleanup: 0 containers, 0 volumes (exact lane names included), 0 networks", "other projects' containers that stopped or restarted: /qalead-la-81-cogniate-app-1, /sto-it-mq-a062b5dd8dd9, /sto-it-d7f1945cb1be, /qalead-la-81-lti-service-1, /qalead-la-81-qa-acceptance-61828, /qalead-la-81-lms-sim-1, /qalead-la-81-lti-gate-1, /qalead-la-81-qa-platform-1, /qalead-la-81-sink-1, /qalead-la-81-moodle-1, /qalead-la-81-postgres-1, /qalead-la-81-proxy-1 (information)"]`.

---

### 5.3 `qalead-la-102` & `qalead-la-103` (`M2` Browser Suite Flake Findings Under Load) and `qalead-la-104` (`M2` Rerun — `64/64 PASS`)

1. **`qalead-la-102` (`13:12:28Z–13:17:42Z`, `5.2 min`, `artifacts/qalead-la-102-a8bbac53-2026-10-24T13-12-28-449Z/`) & `qalead-la-103` (`13:18:14Z–13:21:33Z`, `3.3 min`, `artifacts/qalead-la-103-a8bbac53-2026-10-24T13-18-14-845Z/`):**
   - **Manifest Case Ledger (`m2-case-results.json`):** `63 PASS, 1 FAIL` (`M2-11.blackboard-keyboard`: `TimeoutError: page.waitForURL: Timeout 20000ms exceeded` at `pendingWizard` `/repo/tests/e2e/M2/lib/m2.ts:188:14` from `06-keyboard-axe.m2.ts:75:22`).
   - **`summary.json` Non-`PASS` Entries (`3`):** `M2-11.blackboard-keyboard` (`FAIL`), `M3-06-M2` (`FAIL` — global-state environment note: `volumes 37 → 32; containers 5 → 0` in `qalead-la-102` as D1 `qalead-la-83` tore down; `volumes 32 → 34; containers 0 → 2` in `qalead-la-103` as `sto-*` / `qa4-la-k1-r2` started), and `ERROR` (`AssertionError [ERR_ASSERTION]: Required case is not PASS: M2-11.blackboard-keyboard (FAIL)`).
   - **Verdict:** Both `qalead-la-102` and `qalead-la-103` are recorded as **`FAIL (flake finding — load)`** per `TEST-STRATEGY.md` §2.6.
2. **`qalead-la-104` (`M2` Rerun on SIM Lane `9643` / `172.22.0.0/16`, `13:29:27Z–13:32:25Z`, `3.0 min`, `artifacts/qalead-la-104-a8bbac53-2026-10-24T13-29-27-799Z/`):**
   - **Command:**
     `COMPOSE_PROJECT_NAME=qalead-la-104 PUBLIC_PORT=9643 STACK_SUBNET="172.22.0.0/16" COURSE_FIXTURES_DIR="/Users/quangnguyen/cogniate-qa-runs/LA/GATE/course-fixtures" node /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-final-2-d2/tests/e2e/host/run-m2.mjs --sha a8bbac538cfe1e305f410279d7879421d64a5a1f --test-sha 68b2e9091d1300114187d329f2dcb45740227e6d --source /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-final-2-d2`
   - **Manifest Case Ledger (`m2-case-results.json`):** **`64/64 PASS` (`0 FAIL`, `0` missing IDs)** — including `M2-01.cards`, `M2-01.isolated-newest`, `M2-01.moodle-card` (`BD-A1-119` `article[data-channel-id]` oracle), `M2-11.canvas-keyboard`, **`M2-11.blackboard-keyboard` (`PASS`)**, `M2-11.add-deployment-keyboard`, `M2-11.axe-canvas`, `M2-11.axe-blackboard`, `M2-11.axe-canvas-detail`, `M2-12.canvas`, `M2-12.blackboard`, and `M2-13.*`.
   - **`summary.json` Counts:** `71` total (`70 PASS`, `1 FAIL` on global-state `M3-06-M2` environment note: `["volumes 39 → 34; containers 12 → 2"]` due to concurrent `qa4-la-k1-r2` and `sto-*` containers; `M3-07-M2` secret scan **`PASS`** `["values 74, files 66, hits 0"]`; `TEARDOWN` **`PASS`** `["npm run stack:down exit 0", "left after cleanup: 0 containers, 0 volumes (exact lane names included), 0 networks", "other projects' containers that stopped or restarted: /qa4-la-k1-r2-lti-service-1, /sto-it-mq-e79013af688b, /sto-it-af0383d4a799, /qa4-la-k1-r2-qa-k1-8718, /qa4-la-k1-r2-cogniate-app-1, /qa4-la-k1-r2-lti-gate-1, /qa4-la-k1-r2-qa-platform-1, /qa4-la-k1-r2-lms-sim-1, /qa4-la-k1-r2-sink-1, /qa4-la-k1-r2-moodle-1, /qa4-la-k1-r2-postgres-1, /qa4-la-k1-r2-proxy-1 (information)"]`).

---

### 5.4 `qalead-la-105` (`T8` on Moodle Lane `9563` / `172.25.0.0/16` with `la-final-test-2` per `LD-25`)

- **Run ID & Artifact:** `/Users/quangnguyen/cogniate-qa-runs/LA/RUN-D2/artifacts/qalead-la-105-a8bbac53-2026-10-24T13-32-48-725Z/summary.json` (`logs/qalead-la-105-t8.log`).
- **Start / End Time:** `2026-10-24T13:32:48Z` – `2026-10-24T13:41:57Z` (`549 s` / `9.2 min`).
- **Command:**
  `COMPOSE_PROJECT_NAME=qalead-la-105 PUBLIC_PORT=9563 STACK_SUBNET="172.25.0.0/16" COURSE_FIXTURES_DIR="/Users/quangnguyen/cogniate-qa-runs/LA/GATE/course-fixtures" node /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-final-2-d2/tests/host/run-t8.mjs --sha a8bbac538cfe1e305f410279d7879421d64a5a1f --source /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-final-2-d2 --replace-tests --tests-from /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-final-2-d2/tests`
- **Status Counts (`summary.json` `results`):** **`36/36` step entries `PASS`, `23/23` unique IDs `PASS`, `0 FAIL`**:
  - All `T8` ACs and concurrency probes (`AC-T8-02..10` including `AC-T8-10` no-token and with-token with the `ld9-addendum-r7` `WE-F13` option wait, `C-T8-01` `2/2`, `C-T8-02`) and all `12/12` host/setup IDs (`PRE`, `CLONE`, `DOCTOR`, `SETUP`, `H1`, `FIXTURES`, `SETUP-T5a`, `SETUP-T8`, `SUITE` `5/5`, `HOSTCTL` `5/5`, `KNOB` `4/4`, `TEARDOWN`) passed `100%`.
  - `TEARDOWN` (`PASS`): `["npm run stack:down exit 0", "left after cleanup: 0 containers, 0 volumes (exact lane names included), 0 networks", "other projects' containers that stopped or restarted: /sto-it-mq-709d0b79f63e (information)"]`.
- **Non-`PASS` IDs:** **None (`0`)**.

---

## 6. `M3` Global-State Environment Notes (`TEST-STRATEGY.md` §5.4) & Docker Boundary Records

- **Foreign Container Classes Observed During Run D2 (`sto-*`, D1 `qalead-la-7x/8x`, and `qa4-la-k1-r2` Listed Apart):**
  1. **Savoy (`sto-*`):** Concurrent `sto-it-*` and `sto-drill-*` containers ran on the shared Docker host throughout `10:30:00Z–13:42:23Z`; D2 never touched any `sto-*` container, volume, or network.
  2. **Lead QA D1 (`qalead-la-70..83`):** Concurrent D1 stacks ran on D1's dedicated ports (`9473`/`9543`) and subnets (`172.23.0.0/16`/`172.21.0.0/16`) and are listed apart in `docker-records/` and in the `M3` / `TEARDOWN` notes of `qalead-la-94..99`, `qalead-la-101`, and `qalead-la-102`; D2 never touched any `qalead-la-70..83` resource.
  3. **QA-4 Kit Run (`qa4-la-k1-r2`):** Ran concurrently during `qalead-la-103..105` on its own compose prefix and port; D2 never touched any `qa4-la-*` resource.
- **Per-Run `M3` Global-State Rows (`TEST-STRATEGY.md` §5.4 Environment Notes):**
  - `qalead-la-101` (`M1 sim`): `M3-ISOLATION` recorded `containers changed: 12; volumes changed: ... qalead-la-81_*` because D1's `qalead-la-81` SIM stack tore down while `qalead-la-101` was running.
  - `qalead-la-102`, `qalead-la-103`, `qalead-la-104` (`M2`): `M3-07-M2` (secret scan) was **`PASS`** in all three runs (`0` hits across `65–66` files); `M3-06-M2` recorded foreign container/volume count deltas from D1 `qalead-la-83`, `qa4-la-k1-r2`, and `sto-*`.
- **Before / After Docker Boundary Verification (`/Users/quangnguyen/cogniate-qa-runs/LA/RUN-D2/docker-records/`, `umask 077`):**
  - `before-timestamp.txt`: `2026-10-24T10:30:00Z` → `after-timestamp.txt`: `2026-10-24T13:42:23Z`.
  - **Owned D2 Resources Remaining (`qalead-la-9x` / `qalead-la-10x`):** **`0` containers** (`after-d2-containers.txt`), **`0` volumes**, **`0` networks**.
  - **32 Protected Persistent Volume `inspect` Comparison (`before-32-volumes-inspect.json` vs `after-32-volumes-inspect.json`):** **`diff-32-volumes.txt` is `0` bytes** — all **`32/32` protected non-`sto-*` persistent volumes** are **100% byte-identical in `docker volume inspect` JSON** (and `diff-slot3f-to-d2-before-32-volumes.txt` is also `0` bytes).
  - **Read-Only Host Watchers:** `docker-events-watch.jsonl` (`133,982` lines) and `host-ps-watcher.log` (`15,866` lines) confirmed at most one D2 stack (`qalead-la-92..105`) ran at any time.
