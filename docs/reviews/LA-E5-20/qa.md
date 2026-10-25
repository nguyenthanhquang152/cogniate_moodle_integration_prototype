Verdict: PASS
Round: 2

# LA-E5-20 Background jobs and `/operator/v1/jobs`: QA verification

## K1-SIM Docker slot 1 (`4209dcb`, Batch 2 on `qa2-la-sim-r2`)

Tester: QA-2 (Orca task `task_0336155284b2`, dispatch `ctx_c5845e359f4b`, run `run_06d07dc77faf`), 2026-10-23. Verified in SIM slot 1 (`04:41Z–05:29Z`) on a clean `--no-hardlinks` clone of `4209dcb` (product code `77df44e`) in `~/cogniate-qa-runs/LA/qa2-sim-4209dcb/clone-batch2-r2` (`COMPOSE_PROJECT_NAME=qa2-la-sim-r2`, `PUBLIC_PORT=9443`, `STACK_SUBNET=172.20.0.0/16`).

| AC | Result | Test id | Command | Evidence |
| --- | --- | --- | --- | --- |
| AC-LA-E5-20-01, 02 | PASS (K1-SIM) | `tests/ltiaas/tasks-ops/LA-E5-20/jobs.test.ts` (2 `K1-SIM` tests: `AC-LA-E5-20-01`, `02`) | `COMPOSE_PROJECT_NAME=qa2-la-sim-r2 PUBLIC_PORT=9443 STACK_SUBNET=172.20.0.0/16 node tests/ltiaas/tasks-ops/run-batch2.mjs --sha 4209dcb --workdir ~/cogniate-qa-runs/LA/qa2-sim-4209dcb/clone-batch2-r2 --replace-tests` | Both `K1-SIM` tests pass (`container-LA-E5-20`, `2/2` passed; artifacts at `tests/host/artifacts/qa2-la-sim-r2-4209dcb-2026-10-23T05-00-39-765Z`, log `~/cogniate-qa-runs/LA/qa2-sim-4209dcb/logs/batch-2-r2.log`). |
| AC-LA-E5-20-03 .. 06 | PASS (UNIT) | `services/lti-service/src/http/operator/jobs.test.ts` (`AC-LA-E5-20-03`), `services/lti-service/src/jobs/{api-key-expiry,idempotency-cleanup,signing-key-rotation,account-purge,index}.test.ts` (`AC-LA-E5-20-04` .. `06`) | `npx --no-install vitest run services/lti-service/src/http/operator/jobs.test.ts services/lti-service/src/jobs/{api-key-expiry,idempotency-cleanup,signing-key-rotation,account-purge,index}.test.ts` | Verified in host unit run and Round 1 below. |

---

## Round 1 (host-only at `2a15f5b`)

Tester: QA-2 (Orca task `task_d8da4ccfd3e5`, dispatch `ctx_bcd74cb4daf3`), 2026-10-23. Spec: `docs/architecture/ltiaas/tasks/LA-E5-20.md` (with `BD-A2-65` .. `BD-A2-70`). Suite: `tests/ltiaas/tasks-ops/LA-E5-20/` (QA-2 test-first, written from spec and contracts before reading `LA-E5-20` commits or unit tests).

Independence: QA-2 did not read product source (`services/**`, `packages/**`, `apps/**`), Author notes or reviewer files to write `tests/ltiaas/tasks-ops/LA-E5-20/` or during this host-only run on `2a15f5b`. QA-2 verified all host-only UNIT, K0 and suite checks in an isolated `--no-hardlinks` clone of `2a15f5b`.

| Item | Value |
| --- | --- |
| SHA | `2a15f5b47744e3a3d4c3c43d5a63d695a680d3b7` (integration `2a15f5b`; holds `LA-E5-20` commits `95036a9`, `14287ee`, `ce47f03`, `805b897`, `ca75c68`) |
| Lane and slot | lane S1; no Docker (`HOST-ONLY`; `K1-SIM` rows marked `pending: Docker window`) |
| Clone | `~/cogniate-qa-runs/LA/qa2-r8-2a15f5b/clone`: `git clone --no-hardlinks`, detached at `2a15f5b47744e3a3d4c3c43d5a63d695a680d3b7`, push URL `DISABLED`, `npm ci` at root and `tests/` |
| Environment | macOS arm64, Node 24.21.0, npm 11.19.0 |
| Artifacts | private run folder `~/cogniate-qa-runs/LA/qa2-r8-2a15f5b/logs/` (umask 077): `npm-ci-root.log`, `npm-ci-tests.log`, `check.log`, `e5-20-r1-unit.log`, `qa-suites-host.log`, `task-commits-stat.txt`, `head.txt`, `status-after.txt` |

## Acceptance criteria

| AC / Item | Result | Test id | Command | Evidence |
| --- | --- | --- | --- | --- |
| AC-LA-E5-20-01 | pending: Docker window | `tests/ltiaas/tasks-ops/LA-E5-20/jobs.test.ts > AC-LA-E5-20-01` + Author unit tests: `services/lti-service/src/http/operator/jobs.test.ts > AC-LA-E5-20-01 (unit part): lists every registered job with name, everyMs, lastRunAt (ISO or null) and lastResult` + `services/lti-service/src/jobs/index.test.ts` | `npx --no-install vitest run --reporter=verbose services/lti-service/src/jobs/api-key-expiry.test.ts services/lti-service/src/jobs/idempotency-cleanup.test.ts services/lti-service/src/jobs/signing-key-rotation.test.ts services/lti-service/src/jobs/account-purge.test.ts services/lti-service/src/jobs/index.test.ts services/lti-service/src/http/operator/jobs.test.ts services/lti-service/src/http/operator/accounts.test.ts services/lti-service/src/accounts/migration.test.ts && npx --prefix tests tsc --noEmit -p tests/ltiaas/tasks-ops/LA-E5-20/tsconfig.json && npx --prefix tests vitest list --config tests/ltiaas/tasks-ops/LA-E5-20/vitest.config.mts` | Waits for a SIM Docker window (`GET http://lti-service:4110/operator/v1/jobs` from the `e2e` container). At unit level, `GET /operator/v1/jobs` returns `200 { jobs }` listing all 8 registered hyphen-named jobs in order (`retention`, `audit-retention`, `signing-key-cleanup`, `key-rewrap`, `api-key-expiry`, `idempotency-cleanup`, `signing-key-rotation`, `account-purge`) with `name`, `everyMs`, `lastRunAt`, and `lastResult`, and writes no audit event (`e5-20-r1-unit.log`, `qa-suites-host.log`). |
| AC-LA-E5-20-02 | pending: Docker window | `tests/ltiaas/tasks-ops/LA-E5-20/jobs.test.ts > AC-LA-E5-20-02` + `services/lti-service/src/http/operator/jobs.test.ts > starts a run with the request trace id: 202 {job, traceId}, one job.run event and one job_run line` | as AC-01 | Waits for a SIM Docker window (`POST http://lti-service:4110/operator/v1/jobs/retention/run` from the `e2e` container). At unit level, `POST /operator/v1/jobs/retention/run` returns `202 { job: "retention", traceId }`, emits one `job_run` log line with `trace_id === traceId`, and writes one `job.run` audit event with `actor: { type: "operator", id: "unit" }`, `target: { type: "job", id: "retention" }`, and `traceId` (`e5-20-r1-unit.log`, `qa-suites-host.log`). |
| AC-LA-E5-20-03 | PASS (UNIT) | `services/lti-service/src/http/operator/jobs.test.ts > AC-LA-E5-20-03: a run request while the job holds its lease gives 409 JOB_RUNNING, one refused event and no run` | as AC-01 | Calling `POST /operator/v1/jobs/:name/run` (tested on `signing-key-cleanup`) while `:name` holds an active lease in `job_lease` returns `409 JOB_RUNNING`, does not start a second execution, and writes one refused `job.run` audit event (`result: "refused"`, `code: "JOB_RUNNING"`, `target: { type: "job", id: "signing-key-cleanup" }`). `e5-20-r1-unit.log` |
| AC-LA-E5-20-04 | PASS (UNIT) | `services/lti-service/src/jobs/api-key-expiry.test.ts > AC-LA-E5-20-04: api-key-expiry reports a key that expires in 13 days, not one in 15 days, with ids only` | as AC-01 | With a controlled clock, `api-key-expiry` (`everyMs: 3_600_000`) reports an active key expiring in 13 days (`counts: { expiring: 1 }`, one `api_key_expiring` warning line with `tool_account_id` and `api_key_id` only and no secret), and does not report a key expiring in 15 days or a revoked key. `e5-20-r1-unit.log` |
| AC-LA-E5-20-05 | PASS (UNIT) | `services/lti-service/src/jobs/signing-key-rotation.test.ts > AC-LA-E5-20-05: makes a next key at day 83 and activates it at day 90; manual and suspended accounts get no new key` + `never activates before the publish lead time, also at the rotation age` + `A-LA-E5-20-01` + `A-LA-E5-20-02` | as AC-01 | With a controlled clock (`rotateDays: 90`, `publishLeadSeconds: 86_400`), `signing-key-rotation` (`everyMs: 86_400_000`) creates a `next` key at day 83 (`signing_key.create`, actor `system:signing-key-rotation`) and activates it at day 90 after the publish lead time (`signing_key.activate`, retiring the prior active key); accounts with `autoRotate: false` or `status: "suspended"` get no new key. `e5-20-r1-unit.log` |
| AC-LA-E5-20-06 | PASS (UNIT) | `services/lti-service/src/jobs/account-purge.test.ts > AC-LA-E5-20-06: purges an account closed 31 days ago, keeps one closed 29 days ago, the tombstone and the audit rows` + `services/lti-service/src/jobs/idempotency-cleanup.test.ts > AC-LA-E5-20-06: idempotency-cleanup deletes only records 24 hours old or older, with a controlled clock` | as AC-01 | With a controlled clock, `account-purge` (`everyMs: 86_400_000`) deletes tenant rows of an account closed 31 days ago across all 10 tenant tables, preserves the `tool_account` tombstone and `audit_event` rows, writes one `account.purge` event (`actor: { type: "system", id: "account-purge" }`), and keeps an account closed 29 days ago; `idempotency-cleanup` (`everyMs: 3_600_000`) deletes only `idempotency_record` rows 24 hours old or older. `e5-20-r1-unit.log` |
| BD-A2-65 .. BD-A2-70 (unknown job `404 NOT_FOUND` with refused `job.run` audit event; `503 NOT_READY` when runner is idle or missing) | PASS (UNIT) | `services/lti-service/src/http/operator/jobs.test.ts > gives an unknown job 404 with one refused event that keeps no target id` + `a %s runner gives 503 NOT_READY with Retry-After and no event (BD-A2-69)` | as AC-01 | Unknown job name on `POST /operator/v1/jobs/:name/run` returns `404 NOT_FOUND` and writes one refused `job.run` audit event (`code: "NOT_FOUND"`, `target: { type: "job", id: null }`); an idle or missing runner returns `503 NOT_READY` with `Retry-After: 30` and writes no audit event. `e5-20-r1-unit.log` |

### R0 `npm run check` counts at `2a15f5b` (`check.log`)

| Suite | LA-E0-01 (`1b17261`) | At `2a15f5b` |
| --- | --- | --- |
| Vitest (`test:unit`) | 97 files; 1,351 passed, 5 skipped | 180 files; 2,854 passed, 5 skipped |
| Infra (`test:infra`, `node --test`) | 197 pass, 0 fail | 254 pass, 0 fail (23 suites) |
| K0 (`test:k0`) | — | 3 files; 121 passed |
| F1 (`fitness:lms-names`) | — | `F1 PASS: 1 files with hits, 2 hits` |
| F5 (`fitness:rules`) | — | `F5 PASS: 6 rules (audit-event-delete, channel-sql-tables, connection-lms, no-score-sync, protocol-urls, sql-portability), 0 hits` |

## Other checks

- **File scope (`95036a9`, `14287ee`, `ce47f03`, `805b897`, `ca75c68`):** Touches `services/lti-service/src/db/migrations/019_tool_account_purged_at.sql`, `services/lti-service/src/jobs/{index,api-key-expiry,idempotency-cleanup,signing-key-rotation,account-purge}*.ts`, `services/lti-service/src/http/operator/{index,jobs,jobs.test,accounts,accounts.test}.ts`, `services/lti-service/src/accounts/{store,migration.test}.ts`, and `services/lti-service/src/main.ts` (`task-commits-stat.txt`). Does not edit `services/lti-service/src/retention.ts` or any `services/cogniate-app/**` file.
- **Clone cleanliness:** `git status --porcelain` in `~/cogniate-qa-runs/LA/qa2-r8-2a15f5b/clone` is empty after the run (`status-after.txt`, 0 bytes).

## Regression and time

R0 (`npm run check` on the clean clone): PASS (`47.09 s` unit, `647 ms` K0). Focused 8-file unit run (`e5-20-r1-unit.log`, 72 tests): `938 ms`. QA-2 host-only suite checks (`tsc --noEmit`, `vitest list` 2 `K1-SIM` cases, `node --check run.mjs`): PASS (`qa-suites-host.log`). `AC-LA-E5-20-01` and `AC-LA-E5-20-02` (`K1-SIM`) are `pending: Docker window`.

Correction note (2026-10-23T18:16Z, QA-2): Updated the Round 1 `UNIT` rows to use the hyphen job names (`retention`, `audit-retention`, `signing-key-cleanup`, `key-rewrap`, `api-key-expiry`, `idempotency-cleanup`, `signing-key-rotation`, `account-purge`), `409 JOB_RUNNING` (instead of `409 CONFLICT`), and the `AC-LA-E5-20-03 .. 06` ordering from `docs/architecture/ltiaas/tasks/LA-E5-20.md` and `tests/ltiaas/tasks-ops/LA-E5-20/jobs.test.ts`.
