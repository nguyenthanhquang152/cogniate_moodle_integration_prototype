Verdict: PASS (host-only K0 + UNIT; K1-SIM R2 regression pending: Docker window)
Round: 1

# LA-E5-23 Async store port in the LTI service (`LtiStore`): QA verification

## Round 1 (host-only at `195930c1`, merge `81d3a8f4`)

- **SHA verified:** `195930c1` (includes `LA-E5-23` merge `81d3a8f4` and QA probe-path update `b885fb95`)
- **Clone path:** `/Users/quangnguyen/cogniate-qa-runs/LA/LA-E5-23/r1/clone` (`git clone --no-hardlinks`, `npm ci` at root and `tests/`, `node_modules/.vitest-cache` deleted before every Vitest run)
- **Private evidence folder (mode `0700`):** `/Users/quangnguyen/cogniate-qa-runs/LA/LA-E5-23/r1/evidence/`
- **Docker:** None (host-only rule enforced; zero Docker or `stack:*` commands executed). `AC-LA-E5-23-04` and the R2 LTI service area stack regression (`T2a`, `T2b`, `T3a`, `T3b`, `T3c`, `M1` `sim` phase, goldens `G1–G4`) are `pending: Docker window`.
- **Independence disclosure:** During the prior dispatch (`task_0c65ea795b6b`, mechanical probe-path update for `LA-E5-23`), QA-2 read `services/lti-service/src/jobs/audit-retention.ts` and `services/lti-service/src/store/audit-retention.ts` (and `git show --stat` on `b08ee870` / `7ac78243`) to verify why `fitness-audit-event-delete.test.mjs` failed before `store/audit-retention.ts` landed, and read `*.test.ts` files (`port-boundary.test.ts`, `port.test.ts`, `audit.test.ts`, `settings.test.ts`). QA-2 authored `tests/ltiaas/tasks-ops/LA-E5-23/` from `docs/architecture/ltiaas/tasks/LA-E5-23.md`, `LA-ADR-06` D4 (T0–T2) and D13 (items 1–4), and `BD-A2-96`.

## Acceptance criteria

| AC | Status | Test id | Command | Evidence / notes |
| --- | --- | --- | --- | --- |
| AC-LA-E5-23-01 | PASS (`UNIT` + `K0`) | `tests/ltiaas/tasks-ops/LA-E5-23/async-store.k0.test.ts > AC-LA-E5-23-01` + `LA-ADR-06 D13 item 3 & D4 T0-T2: atomic audited operations` + `services/lti-service/src/store/port-boundary.test.ts` + `services/lti-service/src/store/port.test.ts` | `LA_LEVEL=k0 LA_SCRATCH_CLONE="$PWD" LA_RUN_DIR=~/cogniate-qa-runs/LA/LA-E5-23/r1/evidence ./tests/node_modules/.bin/vitest run -c tests/ltiaas/tasks-ops/LA-E5-23/vitest.config.mts --reporter=verbose` | `store/port-boundary.test.ts` passes on the clean tree (`0` hits) and fails when a planted scratch file (`services/lti-service/src/http/zz-qa2-e523-planted-probe.ts`, removed in `finally`) calls `db.prepare('SELECT 1')`. QA-2's independent AST scanner in `async-store.k0.test.ts` scans all `46` non-test runtime `.ts` files outside `store/**` and `db/**` for `prepare`, `exec`, `transaction`, `afterCommit`, `node:sqlite` / `DatabaseSync`, synchronous `Db`-first-parameter `store/` imports, and raw SQL literals (`0` hits; negative controls catch all 6 planted forms). Atomic audited store operations (`BD-A2-96`, `LA-ADR-06` D4 T0–T2) roll back the data change, the `ok` `audit_event` row, and `afterCommit` callbacks together when a failure occurs after the write (`qa2-e523-k0.log`, `la-e5-23-ac01-boundary.log`). |
| AC-LA-E5-23-02 | PASS (`UNIT` + `K0`) | `tests/ltiaas/tasks-ops/LA-E5-23/async-store.k0.test.ts > AC-LA-E5-23-02 & F5 rules` + `infra/scripts/fitness-sql-portability.test.mjs` + `infra/scripts/fitness-audit-event-delete.test.mjs` | same + `npm run fitness:rules` | `npm run fitness:rules` exits `0` (`F5 PASS: 6 rules (audit-event-delete, channel-sql-tables, connection-lms, no-score-sync, protocol-urls, sql-portability), 0 hits`). In `--stdin --as` mode, `sql-portability` fails on probes with `rowid` (both in `store/accounts.ts` and a new migration `099_qa2_probe.sql`), `X''` blob literals, and `unixepoch('subsec')`, and passes on portable SQL; `audit-event-delete` allows `DELETE FROM audit_event` at `services/lti-service/src/store/audit-retention.ts` and rejects it at `services/lti-service/src/jobs/audit-retention.ts` and `services/lti-service/src/store/audit.ts` (`la-e5-23-ac02-f5.log`). |
| AC-LA-E5-23-03 | PASS (`UNIT` + `K0`) | `tests/ltiaas/tasks-ops/LA-E5-23/async-store.k0.test.ts > AC-LA-E5-23-03` + `services/lti-service/src/store/port-boundary.test.ts > AC-03` | same | `services/lti-service/src/store/index.ts` lists all four in-memory states of `LA-ADR-06` D13 item 4 (`score clock`, `platform token cache`, `platform JWKS cache`, `rate-limit buckets`) (`la-e5-23-ac03-store-index.log`). |
| AC-LA-E5-23-04 | `pending: Docker window` (`K1-SIM`) | R2 LTI service area (`T2a`, `T2b`, `T3a`, `T3b`, `T3c`, `M1` `sim` phase, goldens `G1–G4`) | SIM Docker slot after `08:05Z` | Deferred to the next Docker window per the host-only dispatch rule. |

## Non-blocking observation (NIT)

- **`NIT-LA-E5-23-01` (`services/lti-service/src/store/port-boundary.test.ts:15,21,34`):** `AC-LA-E5-23-01` states that no production file outside `store/**` and `db/**` calls `prepare`, `exec`, `transaction`, or `afterCommit`. `port-boundary.test.ts` checks `prepare`, `exec`, `transaction` and synchronous `Db`-first-parameter `store/` imports, but does not include `afterCommit` in its `aliases` or member-call check. QA-2's AST boundary scan in `tests/ltiaas/tasks-ops/LA-E5-23/async-store.k0.test.ts` checks `afterCommit` (both imported call and member call) across all `46` production files outside `store/**` and `db/**` and confirms `0` hits.

## Host regression (`195930c1`, fresh Vitest cache before every run)

| Suite | Command | Result | Time | Evidence |
| --- | --- | --- | --- | --- |
| QA-2 `LA-E5-23` K0 + UNIT (`async-store.k0.test.ts`) | `LA_LEVEL=k0 ./tests/node_modules/.bin/vitest run -c tests/ltiaas/tasks-ops/LA-E5-23/vitest.config.mts` | `5/5` passed (includes `16/16` `store/*.test.ts` files) | `12.17s` | `qa2-e523-k0.log`, `la-e5-23-store-unit-tests.log` |
| QA-2 `LA-E5-01` CLI output selftest | `node tests/ltiaas/tasks-ops/LA-E5-01/cli-output.selftest.mjs` | `4/4` passed | `3.8ms` | `reg-e5-01-selftest.log` |
| QA-2 `LA-E5-02` K0 (`audit.k0.test.ts`) | `LA_LEVEL=k0 ./tests/node_modules/.bin/vitest run -c tests/ltiaas/tasks-ops/LA-E5-02/vitest.config.mts` | `1/1` passed | `2.15s` | `reg-e5-02-k0.log` |
| QA-2 `LA-E5-22` K0 + UNIT (`app-key-provider.k0.test.ts`) | `LA_LEVEL=k0 ./tests/node_modules/.bin/vitest run -c tests/ltiaas/tasks-ops/LA-E5-22/vitest.config.mts` | `4/4` passed (includes `8` `cogniate-app` unit files, `70/70` tests) | `10.61s` | `reg-e5-22-k0.log` |
| QA-2 `LA-E7-03` K0 (`hosts-manifest.k0.test.ts`) | `LA_LEVEL=k0 ./tests/node_modules/.bin/vitest run -c tests/ltiaas/tasks-ops/LA-E7-03/vitest.config.mts` | `1/1` passed (includes `255/255` `test:infra`) | `30.81s` | `reg-e7-03-k0.log` |
| All `services/lti-service/src/**/*.test.ts` unit suites (`LA-E5-01`..`21`, `LA-E5-23`) | `npx --no-install vitest run services/lti-service/src` | `96/96` files, `1,306/1,306` tests passed | `42.27s` | `reg-lti-service-unit.log` |
| Full `npm run check` (`lint`, `typecheck`, `test:unit`, `test:infra`, `test:k0`, `F1`, `F5`) | `npm run check` | `204/204` unit files (`3,260` passed, `5` skipped); `255/255` infra; `145/145` K0; `F1` `0` hits; `F5` `6` rules, `0` hits | `116.5s` | `r0-npm-check.log` |
