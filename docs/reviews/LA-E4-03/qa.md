Verdict: PASS (host-only K0 + UNIT; K1-SIM and MOODLE-LIVE pending: Docker window)
Round: 1

# LA-E4-03 The `lti-ags` record reporter, throttling and the read-back guard: QA verification

Tester: QA-3 (Orca task `task_bdc23b632bbb`, dispatch `ctx_da00a2da9dd0`), 2026-10-23. Spec: `docs/architecture/ltiaas/tasks/LA-E4-03.md` (with `LA-IC-11`, `LA-IC-15`, `BD-A1-27`). Suite: `tests/ltiaas/tasks-core/LA-E4-03/` (QA-3 test-first).

Independence: QA-3 did not read product source (`services/**`, `packages/**`, `apps/**`), Author notes or reviewer files. QA-3 verified all K0 and UNIT ACs in an isolated `--no-hardlinks` clone of `d40826d`.

| Item | Value |
| --- | --- |
| SHA | `d40826d765649b5ece01e23d26e53ccd2df7a14b` (integration `d40826d`; holds `LA-E4-03` merge `a285bdb` over base `3b14a84`) |
| Lane and slot | lane R; no Docker (HOST-ONLY; K1-SIM and MOODLE-LIVE rows marked `pending: Docker window`) |
| Clone | `~/cogniate-qa-runs/LA/LA-E4-03/r1/clone`: `git clone --no-hardlinks --no-checkout`, detached at `d40826d765649b5ece01e23d26e53ccd2df7a14b`, push URL `DISABLED`, `npm ci` at root |
| Environment | macOS arm64, Node 24.21.0, npm 11.19.0 |
| Artifacts | private run folder `~/cogniate-qa-runs/LA/LA-E4-03/r1/` (umask 077): `npm-ci.log`, `k0-vitest.log`, `unit-rows-by-id.log`, `unit-rows-files.log`, `k0/e4-03-check-clean.log`, `k0/e4-03-unit-rows.log`, `status-after.txt` |

## Acceptance criteria

| AC | Result | Test id | Command | Evidence |
| --- | --- | --- | --- | --- |
| AC-LA-E4-03-01 | PASS (UNIT + K0) | `reporter.k0.test.ts` + `services/cogniate-app/src/drivers/lti-ags/reporter.test.ts > AC-LA-E4-03-01: AGS transport mapping` (28 tests) + `services/cogniate-app/src/drivers/lti-ags/connection-state.test.ts > moodle/canvas/blackboard uses its 409 name and keeps the frozen learner fallback` + `services/cogniate-app/src/kernel/records/throttling.test.ts > partition throttling (LA-ADR-03 D7)` (3 tests) + `packages/tracking/src/tracking.test.ts` | `LA_LEVEL=k0 LA_SCRATCH_CLONE=$PWD LA_RUN_DIR=~/cogniate-qa-runs/LA/LA-E4-03/r1/k0 npx --no-install vitest run --config tests/ltiaas/tasks-core/LA-E4-03/vitest.config.mts --reporter=verbose` | `200`/`201`/`204`/`299` → `accepted` (with prepared AGS body and `beginSend` marker first); `409` → `conflict` with per-channel `"{LMS} has a grade with a newer time"` (`Moodle`, `Canvas`, `Blackboard`, plus neutral fallback for unknown channel; `LA-IC-15`, `BD-A1-27`); `400`, `403`, `404`, `422` → `rejected`; `0`, `401`, `500`, `502`, `503`, `504` → `retryable` (`uncertain` only for no answer or `5xx` after POST began); `429` with `PLATFORM_RATE_LIMITED` or `RATE_LIMITED` → `throttled` with `retryAt` normalized from `Retry-After` (`[1, 3600]` s, default `60` s) without counting a try or introducing uncertainty. `k0/e4-03-unit-rows.log`, `unit-rows-files.log` |
| AC-LA-E4-03-02 | pending: Docker window (K1-SIM) | `reporter.k1sim.test.ts > AC-LA-E4-03-02` | QA-3 SIM slot (`qa3-la-sim-r<n>`, `PUBLIC_PORT` 9443, `STACK_SUBNET` 172.20.0.0/16) | Pending Docker window. |
| AC-LA-E4-03-03 | pending: Docker window (K1-SIM) | `reporter.k1sim.test.ts > AC-LA-E4-03-03` | QA-3 SIM slot | Pending Docker window. |
| AC-LA-E4-03-04 | pending: Docker window (K1-SIM) | `reporter.k1sim.test.ts > AC-LA-E4-03-04` | QA-3 SIM slot | Pending Docker window. |
| AC-LA-E4-03-05 | pending: Docker window (K1-SIM) | `reporter.k1sim.test.ts > AC-LA-E4-03-05` | QA-3 SIM slot | Pending Docker window. |
| AC-LA-E4-03-06 | PASS (UNIT + K0) | `reporter.k0.test.ts` + `services/cogniate-app/src/app/results.test.ts > results guards and read-back > AC-LA-E4-03-06: no read-back capability or implementation gives 409 (false, true)` + `AC-LA-E4-03-06: no read-back capability or implementation gives 409 (true, false)` + `AC-LA-E4-03-06: the baseline reporter reads only the learner result and stores it` (3 tests) | as AC-01 | `POST …/results/refresh` returns `409 CAPABILITY_NOT_SUPPORTED` with `details.capability = "records.readBack"` when the channel lacks `records.readBack` or the reporter lacks `readBack`; baseline channels (`moodle`, `canvas`, `blackboard`) declare `records.readBack: true` and read/store only the learner result as before. `k0/e4-03-unit-rows.log` |
| AC-LA-E4-03-07 | PASS (UNIT + K0) | `reporter.k0.test.ts` + `services/cogniate-app/src/app/results.test.ts > results guards and read-back > AC-LA-E4-03-07: a disabled operator-grant connection refuses refresh and Resend before remote calls` + `services/cogniate-app/src/drivers/lti-ags/connection-state.test.ts` (10 tests: `AC-LA-E1-06-06`, `B-M1-01`) | as AC-01 | On a disabled `operatorGrant` connection, due rows become `failed` with `CONNECTION_DISABLED` and no POST (while `self` connections still send), and Resend and refresh return `409 CONNECTION_NOT_READY` before any remote call. `k0/e4-03-unit-rows.log`, `unit-rows-files.log` |
| AC-LA-E4-03-08 | PASS (UNIT + K0) | `reporter.k0.test.ts` + `services/cogniate-app/src/kernel/records/throttling.test.ts > partition throttling (LA-ADR-03 D7) > AC-LA-E4-03-08: refuses everyRecord at outbox registration` | as AC-01 | Outbox registration refuses any reporter whose `policy` is not `bestResult` (`everyRecord` is reserved for LC). `k0/e4-03-unit-rows.log` |
| AC-LA-E4-03-09 | pending: Docker window (MOODLE-LIVE) | Lead QA / QA-E2E Moodle slot (T5a, T5b, T7 × 1) | Moodle slot | Pending Docker window. |

### R0 `npm run check` counts at `d40826d` (`k0/e4-03-check-clean.log`)

| Suite | LA-E0-01 baseline (`1b17261`) | At `d40826d` |
| --- | --- | --- |
| Vitest (`test:unit`) | 97 files; 1,351 passed, 5 skipped | 155 files; 2,498 passed, 5 skipped |
| Infra (`test:infra`, `node --test`) | 197 pass, 0 fail | 243 pass, 0 fail |
| K0 (`test:k0`) | — | 3 files; 121 passed |
| F1 (`fitness:lms-names`) | — | `F1 PASS: 20 files with hits, 74 hits` |
| F5 (`fitness:rules`) | — | `F5 PASS: 6 rules (audit-event-delete, channel-sql-tables, connection-lms, no-score-sync, protocol-urls, sql-portability), 0 hits` |

## Other checks

- **File scope and layout (`3b14a84..a285bdb`):** `services/cogniate-app/src/drivers/lti-ags/` is created (`index.ts`, `line-item.ts`, `reporter.test.ts`, `connection-state.test.ts`); `services/cogniate-app/src/worker/` is completely removed (`0` tracked files in git and directory absent on disk); `services/cogniate-app/src/kernel/records/**`, `services/cogniate-app/src/app/results*.ts`, `services/cogniate-app/src/clients/lti-client.ts`, `packages/tracking/src/{outcome,index,tracking.test}.ts`, and `infra/scripts/fitness/**` (split legacy table detection in `no-score-sync.mjs`) are updated. Neither `packages/tracking/src/status-text.ts`, `packages/tracking/src/html.ts`, nor `services/lti-service/**` were edited. Note: `a285bdb` also adapted test imports in `services/cogniate-app/src/{testkit,tool-pages/play}.ts` after removing `worker/score-sync.ts`.
- **Clone cleanliness:** `git status --porcelain` in `~/cogniate-qa-runs/LA/LA-E4-03/r1/clone` is empty after the run (`status-after.txt`, 0 bytes).

## Regression and time

R0 (`npm run check` on the clean clone): PASS. K1-SIM (`AC-02` to `AC-05`) and MOODLE-LIVE (`AC-09`): `pending: Docker window`. Measured time of `reporter.k0.test.ts`: `99.69s` (`R0 & file layout` `7ms`, `UNIT rows` `7.02s`, `npm run check` in `beforeAll` `92.6s`).
