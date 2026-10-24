# QA Report: LA-E4-04 (Progress record emission — no outbound dispatch)

Verdict: PASS
Round: 1
Integration SHA: `48c01495fd18d846577fc4782f52167b18e1c5a9` (product SHA `a8bbac538cfe1e305f410279d7879421d64a5a1f`, merged in `la-qa` with `6f666c01`)
Task Spec: [`docs/architecture/ltiaas/tasks/LA-E4-04.md`](../../architecture/ltiaas/tasks/LA-E4-04.md)
QA Test Suite: [`tests/ltiaas/tasks-qa/LA-E4-04/progress-no-dispatch.k1sim.test.ts`](../../../tests/ltiaas/tasks-qa/LA-E4-04/progress-no-dispatch.k1sim.test.ts)
Compose Project & Lane (`K1-SIM`): `qa3-la-e404-r1` (`PUBLIC_PORT=9473`, `STACK_SUBNET=172.23.0.0/16`)
Durable Evidence: `/Users/quangnguyen/cogniate-qa-runs/LA/qa3-la-e404-r1/` (`logs/`, `docker-records/`, `artifacts/qa3-la-e404-r1-48c01495-2026-10-24T15-09-38-141Z/`)

---

## 1. Executive Summary

- **Verdict:** **`PASS`** (`5/5` ACs `PASS`: `3` `UNIT` ACs + `2` `K1-SIM` ACs).
- **`UNIT` Verification (`AC-LA-E4-04-01`, `AC-LA-E4-04-03`, `AC-LA-E4-04-05`):**
  - `npx --no-install vitest run services/cogniate-app/src/kernel/records/records.test.ts --reporter=verbose` passed **`11/11` tests in `365 ms`** (`logs/e4-04-records-unit.log`), including all `7/7` `progress records (LA-E4-04)` cases.
  - Across all `services/cogniate-app/src/` unit test files (`logs/e4-04-unit-verbose.log`), **`59/59` files (`785 passed | 2 skipped` of `787` tests) passed in `14.13 s`**.
- **`K1-SIM` Live Stack Verification (`AC-LA-E4-04-02` on `qa3-la-e404-r1`):**
  - Wrote and ran [`tests/ltiaas/tasks-qa/LA-E4-04/progress-no-dispatch.k1sim.test.ts`](../../../tests/ltiaas/tasks-qa/LA-E4-04/progress-no-dispatch.k1sim.test.ts) via [`tests/ltiaas/tasks-qa/LA-E4-04/run-sim.mjs`](../../../tests/ltiaas/tasks-qa/LA-E4-04/run-sim.mjs) on `qa3-la-e404-r1` (`PUBLIC_PORT=9473`, `STACK_SUBNET=172.23.0.0/16`) using only public app, service, and simulator APIs.
  - Both a multi-commit SCORM 1.2 attempt (`3` `incomplete` commits with raw scores `20`, `50`, `70` followed by `finish` `passed` `85/100` on Blackboard SIM) and a multi-commit HTML attempt (`2` incomplete `progress` commits followed by `progress` `passed` `90/100` + repeated `unload` on Canvas SIM) emitted **`0` simulator AGS score POSTs** and **`0` `scoreSyncs` rows** during progress, and **exactly `1` simulator AGS score POST (`204`)** and **1 `scoreSyncs` row (`status: "sent"`)** for the final score (`PASS` in `11,000 ms`).
- **`K1-SIM` Golden `G3` Verification (`AC-LA-E4-04-04`):**
  - Verified in milestone-end runs **D1 (`qalead-la-72`, [`docs/reviews/LA-E7-08/qa.md`](../LA-E7-08/qa.md) §13.2 row 3)** and **D2 (`qalead-la-92`, [`docs/reviews/LA-E7-08/run-D2.md`](../LA-E7-08/run-D2.md) §4.1)** on `a8bbac53`: `9/9` host steps `PASS` (`8/8` unique IDs `PASS`, `129` secrets scanned / `0` hits), `compare.mjs` against `G-BASE` (`1b17261b`) exited `0` (`EQUAL: 280 differences (0 not explained), 0 expected changes missing`), and all `12` `G3` publication result sets (`A-sent`, `B-conflict`, `C-failed`, `C2-resend`, `D-superseded`, `E-pending` for `blackboard` and `canvas`) match the baseline.

---

## 2. Acceptance Criteria Matrix

| AC | Level | Description | Proving Test Cases / Runs & Artifacts | Status |
| --- | --- | --- | --- | --- |
| **`AC-LA-E4-04-01`** | `UNIT` | An attempt from launch to a final result writes `attempt.started`, `attempt.progressed`, `attempt.submitted`, and `attempt.final` in `outcome_record` with the right payloads (`D1`). | `services/cogniate-app/src/kernel/records/records.test.ts` (`11/11 PASS` in `365 ms`, `logs/e4-04-records-unit.log`):<br>1. `progress records (LA-E4-04) > AC-LA-E4-04-01, AC-LA-E4-04-03: a SCORM attempt from launch to a final result writes started, progressed, submitted and final` (`4 ms`)<br>2. `progress records (LA-E4-04) > AC-LA-E4-04-01, AC-LA-E4-04-03: an HTML attempt writes one record set; a repeated unload writes none` (`4 ms`)<br>3. `progress records (LA-E4-04) > AC-LA-E4-04-01: a resumed session of the same attempt writes no second started record` (`4 ms`)<br>4. `progress records (LA-E4-04) > previews write no progress record` (`3 ms`) | **`PASS`** |
| **`AC-LA-E4-04-02`** | `K1-SIM` | One attempt with several progress commits, then a final result: the simulator AGS score records and the results API show only the final score of the attempt, and no progress dispatch row. | `tests/ltiaas/tasks-qa/LA-E4-04/progress-no-dispatch.k1sim.test.ts` (`1/1 PASS` in `11,000 ms` on `qa3-la-e404-r1`, `artifacts/qa3-la-e404-r1-48c01495-2026-10-24T15-09-38-141Z/`):<br>• `AC-LA-E4-04-02: one attempt with several progress commits, then a final result: simulator AGS score records and results API show only the final score and no progress dispatch row` (verifies both SCORM 1.2 on Blackboard SIM and HTML on Canvas SIM; see §3.2). | **`PASS`** |
| **`AC-LA-E4-04-03`** | `UNIT` | The payload of `attempt.final` has `attemptStartedAt` and `attemptSubmittedAt`. | `services/cogniate-app/src/kernel/records/records.test.ts` (`11/11 PASS` in `365 ms`, `logs/e4-04-records-unit.log`):<br>1. `progress records (LA-E4-04) > AC-LA-E4-04-01, AC-LA-E4-04-03: a SCORM attempt from launch to a final result writes started, progressed, submitted and final` (`4 ms`)<br>2. `progress records (LA-E4-04) > AC-LA-E4-04-01, AC-LA-E4-04-03: an HTML attempt writes one record set; a repeated unload writes none` (`4 ms`)<br>3. `progress records (LA-E4-04) > AC-LA-E4-04-03: an attempt that started and was submitted before progress records existed uses the nearest known times` (`4 ms`) | **`PASS`** |
| **`AC-LA-E4-04-04`** | `K1-SIM` | Golden `G3` equals the baseline. | Milestone-end runs **D1 (`qalead-la-72`)** and **D2 (`qalead-la-92`)** on `a8bbac53` ([`docs/reviews/LA-E7-08/qa.md`](../LA-E7-08/qa.md) §13.2 row 3 & [`docs/reviews/LA-E7-08/run-D2.md`](../LA-E7-08/run-D2.md) §4.1):<br>• `summary.json` (`9/9 PASS`, `8/8` unique IDs `PASS` in both runs).<br>• `compare.mjs` vs `G-BASE` (`1b17261b`): `EQUAL: 280 differences (0 not explained), 0 expected changes missing` (`G3` publication `attempts`, `best`, and `scoreSyncs` shapes are 100% preserved; see §3.3). | **`PASS`** |
| **`AC-LA-E4-04-05`** | `UNIT` | A legacy final attempt without records takes its stored `updated_at` as the submission time, and keeps it (`D1`). | `services/cogniate-app/src/kernel/records/records.test.ts` (`11/11 PASS` in `365 ms`, `logs/e4-04-records-unit.log`):<br>1. `progress records (LA-E4-04) > AC-LA-E4-04-05: a legacy final attempt without records takes its stored updated_at as the submission time, and keeps it` (`4 ms`)<br>2. `progress records (LA-E4-04) > AC-LA-E4-04-05: the first commit writes the legacy submission even when it changes nothing else` (`4 ms`) | **`PASS`** |

---

## 3. Detailed Verification Evidence

### 3.1 `UNIT` Test Suite Accounting (`AC-LA-E4-04-01`, `AC-LA-E4-04-03`, `AC-LA-E4-04-05`)

- **Command (`logs/e4-04-records-unit.log`):**
  ```sh
  npx --no-install vitest run services/cogniate-app/src/kernel/records/records.test.ts --reporter=verbose
  ```
- **Output (`1/1` file, `11/11` tests `PASS` in `365 ms`):**
  ```text
   ✓ |node| services/cogniate-app/src/kernel/records/records.test.ts > final records > AC-LA-E4-02-03: T5a best-result sequence keeps the golden dispatch rows and writes immutable facts only on improvement 8ms
   ✓ |node| services/cogniate-app/src/kernel/records/records.test.ts > final records > AC-LA-E4-02-03: T5b HTML completion and repeated unload keep one golden dispatch; previews keep none 9ms
   ✓ |node| services/cogniate-app/src/kernel/records/records.test.ts > final records > AC-LA-E4-02-11: a placement without context shows the course name dash 6ms
   ✓ |node| services/cogniate-app/src/kernel/records/records.test.ts > progress records (LA-E4-04) > AC-LA-E4-04-01, AC-LA-E4-04-03: a SCORM attempt from launch to a final result writes started, progressed, submitted and final 4ms
   ✓ |node| services/cogniate-app/src/kernel/records/records.test.ts > progress records (LA-E4-04) > AC-LA-E4-04-01, AC-LA-E4-04-03: an HTML attempt writes one record set; a repeated unload writes none 4ms
   ✓ |node| services/cogniate-app/src/kernel/records/records.test.ts > progress records (LA-E4-04) > AC-LA-E4-04-01: a resumed session of the same attempt writes no second started record 4ms
   ✓ |node| services/cogniate-app/src/kernel/records/records.test.ts > progress records (LA-E4-04) > AC-LA-E4-04-03: an attempt that started and was submitted before progress records existed uses the nearest known times 4ms
   ✓ |node| services/cogniate-app/src/kernel/records/records.test.ts > progress records (LA-E4-04) > AC-LA-E4-04-05: a legacy final attempt without records takes its stored updated_at as the submission time, and keeps it 4ms
   ✓ |node| services/cogniate-app/src/kernel/records/records.test.ts > progress records (LA-E4-04) > AC-LA-E4-04-05: the first commit writes the legacy submission even when it changes nothing else 4ms
   ✓ |node| services/cogniate-app/src/kernel/records/records.test.ts > progress records (LA-E4-04) > previews write no progress record 3ms
   ✓ |node| services/cogniate-app/src/kernel/records/records.test.ts > B-LA-E4-02-01/02, B-LA-E4-03-02: one registration call; the reporter instance prepares, partitions and delivers 5ms

   Test Files  1 passed (1)
        Tests  11 passed (11)
     Duration  365ms
  ```
- **Full `services/cogniate-app/src/` Unit Pass (`logs/e4-04-unit-verbose.log`):**
  - `Test Files: 59 passed (59)`, `Tests: 785 passed | 2 skipped (787)`, `Duration: 14.13s`.

---

### 3.2 `K1-SIM` Run on `qa3-la-e404-r1` (`AC-LA-E4-04-02`)

- **Run ID & Artifact Folder:** `/Users/quangnguyen/cogniate-qa-runs/LA/qa3-la-e404-r1/artifacts/qa3-la-e404-r1-48c01495-2026-10-24T15-09-38-141Z/` (`summary.json`, `container-LA-E4-04/vitest-results.json`, `container-LA-E4-04/service-logs/lms-sim.jsonl`).
- **Host Step Accounting (`summary.json` `results`: `9/9 PASS`, `0 FAIL`):**
  1. `PRE` (`PASS`): `["node 24.21.0, docker 29.9.2, compose 5.6.1", "project qa3-la-e404-r1, PUBLIC_PORT 9473, STACK_SUBNET 172.23.0.0/16", "other containers on this Docker host: 0 (not touched by QA)"]`.
  2. `CLONE` (`PASS`): `["using existing checkout /Users/quangnguyen/cogniate-qa-runs/LA/qa3-la-e404-r1/clone (no clean-clone guarantee)", "HEAD 48c01495fd18d846577fc4782f52167b18e1c5a9 Lead: evidence-review briefs for 5 tasks with no review record (LA-E0-01..03, LA-E5-13, LA-E7-07)", "clone /Users/quangnguyen/cogniate-qa-runs/LA/qa3-la-e404-r1/clone"]`.
  3. `H1` (`PASS`): `["services: cogniate-app, lti-service, moodle, postgres, proxy"]`.
  4. `SETUP` (`PASS`): `["npm ci 0, gen-env 0, stack:up 0, seed 0"]`.
  5. `SUITE` (`PASS`): `["exit 0; tests reported: 1; failed: 0; skipped: 0"]`.
  6. `UNMAPPED` (`PASS`): `[LA-E4-04] AC-LA-E4-04-02: one attempt with several progress commits, then a final result: simulator AGS score records and results API show only the final score and no progress dispatch row`.
  7. `AC-LA-E4-04-02` (`PASS`): `["10999.895171 ms"]`.
  8. `HOSTCTL` (`PASS`): `["2026-10-24T15:10:34.501Z m1-cli: exit 0 in 377 ms", "2026-10-24T15:10:40.010Z m1-cli: exit 0 in 311 ms"]`.
  9. `TEARDOWN` (`PASS`): `["npm run stack:down exit 0", "left after cleanup: 0 containers, 0 volumes (exact lane names included), 0 networks", "other projects' containers that stopped or restarted: none (information)"]`.
- **What `progress-no-dispatch.k1sim.test.ts` Verified (`container-LA-E4-04/service-logs/lms-sim.jsonl`):**
  1. **SCORM 1.2 Attempt on Blackboard SIM (`learn-a.blackboard.sim.test`):**
     - Sent `3` progress commits (`event: "commit"`, `lesson_status: "incomplete"`, `score.raw: "20"`, `"50"`, `"70"`, `suspend_data: "progress-step-1..3"`) and waited `3,000 ms`.
     - Verified `0` simulator AGS `score` records (`/__sim/records`) and `0` `scoreSyncs` rows in `GET /app-api/publications/:id/results` while `attempts[0].outcome === "in_progress"`.
     - Sent `1` final commit (`event: "finish"`, `lesson_status: "passed"`, `score: { raw: "85", min: "0", max: "100" }`), waited for `waitSync(..., "sent")` + `1,500 ms`.
     - Verified **exactly `1` simulator AGS score POST** (`15:10:38.076Z POST /learn/api/v1/lti/courses/course-1/lineItems/pub_xHPgYzSBd5kEwEXbtkAS6A/scores` → `204`, `scoreGiven: 85`, `scoreMaximum: 100`, `activityProgress: "Completed"`, `gradingProgress: "FullyGraded"`) and **exactly `1` `scoreSyncs` row** (`status: "sent"`, `scoreGiven: 85`, `scoreMaximum: 100`, `tries: 1`).
  2. **HTML Attempt on Canvas SIM (`school-a.canvas.sim.test`):**
     - Sent `2` incomplete progress commits (`event: "progress"`, `seenPages: []`, `3` then `6` answers) and waited `3,000 ms`.
     - Verified `0` simulator AGS `score` records (`/__sim/records`) and `0` `scoreSyncs` rows in `GET /app-api/publications/:id/results` while `attempts[0].outcome === "in_progress"`.
     - Sent `1` final completion commit (`event: "progress"`, `seenPages: ["index"]`, `9/10` correct answers → `90/100`) followed by `1` repeated `event: "unload"`, waited for `waitSync(..., "sent")` + `1,500 ms`.
     - Verified **exactly `1` simulator AGS score POST** (`15:10:43.474Z POST /api/lti/courses/course-1/line_items/pub_Vx2zNOQ4nTrmz_tUnHV3Xw/scores` → `204`, `scoreGiven: 90`, `scoreMaximum: 100`, `activityProgress: "Completed"`, `gradingProgress: "FullyGraded"`) and **exactly `1` `scoreSyncs` row** (`status: "sent"`, `scoreGiven: 90`, `scoreMaximum: 100`, `tries: 1`).

---

### 3.3 Golden `G3` Verification in Runs D1 and D2 on `a8bbac53` (`AC-LA-E4-04-04`)

- **Cited Runs (`a8bbac538cfe1e305f410279d7879421d64a5a1f`):**
  1. **Run D1 (`qalead-la-72`, [`docs/reviews/LA-E7-08/qa.md`](../LA-E7-08/qa.md) §13.2 row 3):**
     - `summary.json`: `/Users/quangnguyen/cogniate-qa-runs/LA/RUN-D1/artifacts/qalead-la-72-a8bbac53-2026-10-24T10-30-33-115Z/summary.json` (`9/9` step entries `PASS`, `8/8` unique IDs `PASS`: `PRE`, `CLONE`, `H1`, `GOLDEN-DEFAULT`, `GOLDEN-CAPTURE` `47 s`, `GOLDEN-SECRET-SCAN` `129` values / `0` hits, `GOLDEN-OUT`, `TEARDOWN`).
     - `compare.mjs` log (`/Users/quangnguyen/cogniate-qa-runs/LA/RUN-D1/logs/qalead-la-72-golden-compare-port-aligned.txt`):
       `EQUAL: 280 differences (0 not explained), 0 expected changes missing; expected-delta files: LA-IC-01, LA-IC-03, LA-IC-04, LA-IC-12, LA-IC-13, LA-IC-14, LA-IC-15, LA-IC-16, LA-IC-17, LA-IC-18, LA-IC-19, LA-IC-20, LA-IC-21; 94 ms`.
  2. **Run D2 (`qalead-la-92`, [`docs/reviews/LA-E7-08/run-D2.md`](../LA-E7-08/run-D2.md) §4.1):**
     - `summary.json`: `/Users/quangnguyen/cogniate-qa-runs/LA/RUN-D2/artifacts/qalead-la-92-a8bbac53-2026-10-24T10-30-37-065Z/summary.json` (`9/9` step entries `PASS`, `8/8` unique IDs `PASS`: `PRE`, `CLONE`, `H1`, `GOLDEN-DEFAULT`, `GOLDEN-CAPTURE` `50 s`, `GOLDEN-SECRET-SCAN` `129` values / `0` hits, `GOLDEN-OUT`, `TEARDOWN`).
     - `compare.mjs` log (`/Users/quangnguyen/cogniate-qa-runs/LA/RUN-D2/logs/qalead-la-92-golden-compare-port-aligned.txt`):
       `EQUAL: 280 differences (0 not explained), 0 expected changes missing; expected-delta files: LA-IC-01, LA-IC-03, LA-IC-04, LA-IC-12, LA-IC-13, LA-IC-14, LA-IC-15, LA-IC-16, LA-IC-17, LA-IC-18, LA-IC-19, LA-IC-20, LA-IC-21; 22 ms`.
- **`G3` Rows Checked Across D1 and D2 (`G3.json` in `RUN-D1` and `RUN-D2`, 100% byte-identical):**
  - Across both `G3.blackboard.publications` and `G3.canvas.publications`, all `6` publication result scenarios (`A-sent`, `B-conflict`, `C-failed`, `C2-resend`, `D-superseded`, `E-pending`) match `G-BASE` (`1b17261b`) with `0` unexplained differences:
    - `A-sent`: `1` attempt (`outcome: "failed"`, `scoreGiven: 7`, `scoreMaximum: 10`), `1` `scoreSyncs` row (`status: "sent"`, `tries: 1`).
    - `B-conflict`: `1` attempt (`outcome: "failed"`, `scoreGiven: 7`, `scoreMaximum: 10`), `1` `scoreSyncs` row (`status: "conflict"`, `tries: 1`, `lastError` explained by `LA-IC-15`).
    - `C-failed`: `1` attempt (`outcome: "failed"`, `scoreGiven: 7`, `scoreMaximum: 10`), `1` `scoreSyncs` row (`status: "failed"`).
    - `C2-resend`: `1` attempt (`outcome: "failed"`, `scoreGiven: 7`, `scoreMaximum: 10`), `1` `scoreSyncs` row (`status: "sent"`).
    - `D-superseded`: `1` attempt (`outcome: "passed"`, `scoreGiven: 90`, `scoreMaximum: 100`), `2` `scoreSyncs` rows (`status: "superseded"` `60/100` and `status: "sent"` `90/100`).
    - `E-pending`: `1` attempt (`outcome: "failed"`, `scoreGiven: 7`, `scoreMaximum: 10`), `1` `scoreSyncs` row (`status: "pending"`).

---

## 4. Docker Boundary & Hygiene Verification (`qa3-la-e404-r1`)

- **Records Folder (`umask 077`):** `/Users/quangnguyen/cogniate-qa-runs/LA/qa3-la-e404-r1/docker-records/`
- **Window:** `before-timestamp.txt` (`2026-10-24T15:09:03Z`) → `after-timestamp.txt` (`2026-10-24T15:11:15Z`).
- **Owned Resources After Teardown (`qa3-la-e404-r1`):**
  - `after-owned-containers.txt`: `0`
  - `after-owned-volumes.txt`: `0`
  - `after-owned-networks.txt`: `0`
- **Protected Persistent Volumes (`before-32-volumes-inspect.json` vs `after-32-volumes-inspect.json`):**
  - `diff-32-volumes.txt`: **`0` bytes** (`32/32` protected non-`sto-*` persistent volumes 100% byte-identical in `docker volume inspect` JSON).
- **Foreign Resources:** Never touched any `qa4-la-k1-*`, `qalead-la-*`, `qa-e2e-*`, `la-g1-diag-*`, or `sto-*` container, volume, or network.
