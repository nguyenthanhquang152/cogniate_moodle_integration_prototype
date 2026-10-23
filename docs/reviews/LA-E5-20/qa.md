Verdict: PASS
Round: 2

# LA-E5-20 Background jobs and `/operator/v1/jobs`: QA verification

## K1-SIM Docker slot 1 (`4209dcb`, Batch 2 on `qa2-la-sim-r2`)

Tester: QA-2 (Orca task `task_0336155284b2`, dispatch `ctx_c5845e359f4b`, run `run_06d07dc77faf`), 2026-10-23. Verified in SIM slot 1 (`04:41Z–05:29Z`) on a clean `--no-hardlinks` clone of `4209dcb` (product code `77df44e`) in `~/cogniate-qa-runs/LA/qa2-sim-4209dcb/clone-batch2-r2` (`COMPOSE_PROJECT_NAME=qa2-la-sim-r2`, `PUBLIC_PORT=9443`, `STACK_SUBNET=172.20.0.0/16`).

| AC | Result | Test id | Command | Evidence |
| --- | --- | --- | --- | --- |
| AC-LA-E5-20-01, 02 | PASS (K1-SIM) | `tests/ltiaas/tasks-ops/LA-E5-20/jobs.test.ts` (2 `K1-SIM` tests: `AC-LA-E5-20-01`, `02`) | `COMPOSE_PROJECT_NAME=qa2-la-sim-r2 PUBLIC_PORT=9443 STACK_SUBNET=172.20.0.0/16 node tests/ltiaas/tasks-ops/run-batch2.mjs --sha 4209dcb --workdir ~/cogniate-qa-runs/LA/qa2-sim-4209dcb/clone-batch2-r2 --replace-tests` | Both `K1-SIM` tests pass (`container-LA-E5-20`, `2/2` passed in `29 ms`; artifacts at `tests/host/artifacts/qa2-la-sim-r2-4209dcb-2026-10-23T05-00-39-765Z`, log `~/cogniate-qa-runs/LA/qa2-sim-4209dcb/logs/batch-2-r2.log`). |
| AC-LA-E5-20-03 .. 06 | PASS (UNIT) | `services/lti-service/src/jobs/{api-key-expiry,idempotency-cleanup,signing-key-rotation,account-purge,index}.test.ts` | `npx --no-install vitest run services/lti-service/src/jobs/index.test.ts` | Verified in host-only pre-gate (`host-pregate.log`) and Round 1 below. |

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
| AC-LA-E5-20-01 | pending: Docker window | `tests/ltiaas/tasks-ops/LA-E5-20/jobs.test.ts > AC-LA-E5-20-01` + Author unit tests: `services/lti-service/src/http/operator/jobs.test.ts > AC-01: GET /operator/v1/jobs returns the 5 jobs in order, with everyMs, lastRunAt, lastResult and write No` + `services/lti-service/src/jobs/index.test.ts > AC-01: lists the 5 registered jobs in order with everyMs, lastRunAt and lastResult` | `npx --no-install vitest run --reporter=verbose services/lti-service/src/jobs/api-key-expiry.test.ts services/lti-service/src/jobs/idempotency-cleanup.test.ts services/lti-service/src/jobs/signing-key-rotation.test.ts services/lti-service/src/jobs/account-purge.test.ts services/lti-service/src/jobs/index.test.ts services/lti-service/src/http/operator/jobs.test.ts services/lti-service/src/http/operator/accounts.test.ts services/lti-service/src/accounts/migration.test.ts && npx --prefix tests tsc --noEmit -p tests/ltiaas/tasks-ops/LA-E5-20/tsconfig.json && npx --prefix tests vitest list --config tests/ltiaas/tasks-ops/LA-E5-20/vitest.config.mts` | Waits for a SIM Docker window (`GET http://lti-service:4110/operator/v1/jobs` from the `e2e` container). At unit level, `GET /operator/v1/jobs` returns `200 { jobs }` listing all 5 registered jobs in order (`retention`, `idempotency_cleanup`, `api_key_expiry`, `signing_key_rotation`, `account_purge`) with `name`, `everyMs`, `lastRunAt`, and `lastResult`, and writes no audit event (`e5-20-r1-unit.log`, `qa-suites-host.log`). |
| AC-LA-E5-20-02 | pending: Docker window | `tests/ltiaas/tasks-ops/LA-E5-20/jobs.test.ts > AC-LA-E5-20-02` + `services/lti-service/src/http/operator/jobs.test.ts > AC-02: POST /operator/v1/jobs/retention/run returns 202 {job, traceId} and writes one job_run line and one job.run audit event` | as AC-01 | Waits for a SIM Docker window (`POST http://lti-service:4110/operator/v1/jobs/retention/run` from the `e2e` container). At unit level, `POST /operator/v1/jobs/retention/run` returns `202 { job: "retention", traceId }`, emits one `job_run` log line with `trace_id === traceId`, and writes one `job.run` audit event with `actor_type: "operator"`, `actor_id: "operator-key"`, `target_type: "job"`, `target_id: "retention"`, and `trace_id === traceId` (`e5-20-r1-unit.log`, `qa-suites-host.log`). |
| AC-LA-E5-20-03 | PASS (UNIT) | `services/lti-service/src/jobs/api-key-expiry.test.ts > AC-03: marks a grace-expired key as expired and writes one api_key.expire system audit event per key` + `keeps active keys and future grace keys untouched, and does not write a second event on a repeat run` | as AC-01 | With a controlled clock, `api_key_expiry` transitions a key in `grace` whose `expires_at <= now` to `state = 'expired'`, sets `revoked_at`, and writes one `api_key.expire` system audit event (`actor_type = 'system'`, `actor_id = 'job:api_key_expiry'`) per expired key in one transaction (`BD-A2-67`), leaving active or future-grace keys untouched and emitting `0` events on a repeat run. `e5-20-r1-unit.log` |
| AC-LA-E5-20-04 | PASS (UNIT) | `services/lti-service/src/jobs/signing-key-rotation.test.ts > AC-04: creates a new current key when current is >= 90 days old, sets grace on the old key, and deletes retirement-expired keys` + `leaves a fresh current key untouched and still deletes retired keys` + `validates the country-code setting and keeps each account in its own transaction` | as AC-01 | With a controlled clock (`KEY_ROTATION_DAYS = 90`, `KEY_RETIREMENT_DAYS = 7`), `signing_key_rotation` creates a new RSA-2048 `current` key for an active account whose current key is `>= 90` days old, moves the previous current key to `grace` (`retires_at = now + 7d`), deletes `grace` keys whose `retires_at <= now`, and writes one `signing_key.rotate` system audit event per rotated account (`BD-A2-68`). `e5-20-r1-unit.log` |
| AC-LA-E5-20-05 | PASS (UNIT) | `services/lti-service/src/jobs/account-purge.test.ts > AC-05: purges an account closed for 30 days, removes its tenant rows, and writes one account.purge system audit event` + `keeps an account closed for less than 30 days (including the exact boundary) and active accounts` + `rolls back all child deletes for an account if the audit write fails` + `services/lti-service/src/accounts/migration.test.ts > migration 019 (BD-A2-70: tool_account.purged_at)` + `services/lti-service/src/http/operator/accounts.test.ts > BD-A2-70: refuses purge of an already purged account with 409 CONFLICT` | as AC-01 | With a controlled clock (`ACCOUNT_PURGE_AFTER_DAYS = 30`), `account_purge` purges a `closed` account with `closed_at <= now - 30d` and `purged_at IS NULL`: deletes child rows in FK-safe order (`lti_registration_attempt`, `lti_context`, `lti_user`, `lti_nonce`, `lti_state`, `lti_service_key`, `lti_deployment`, `lti_platform`, `lti_signing_key`, `lti_api_key`, `idempotency_record`), sets `purged_at = now` on `tool_account`, preserves `audit_event`, and writes one `account.purge` system audit event (`BD-A2-69`, `BD-A2-70`). `e5-20-r1-unit.log` |
| AC-LA-E5-20-06 | PASS (UNIT) | `services/lti-service/src/jobs/index.test.ts > AC-06: a second run call while the job is running returns already_running and does not start a second execution` + `services/lti-service/src/http/operator/jobs.test.ts > AC-06: returns 409 CONFLICT with one refused job.run audit event when the job is already running` | as AC-01 | Calling `POST /operator/v1/jobs/:name/run` while `:name` is already in flight returns `409 CONFLICT`, does not start a second execution, and writes one refused `job.run` audit event (`outcome: "refused"`, `details: { reason: "already_running" }`) (`BD-A2-65`). `e5-20-r1-unit.log` |
| BD-A2-65 & BD-A2-66 (unknown job `404` with refused audit event; scheduler `unref()`, failure isolation, `stop()`, `idempotency_cleanup`) | PASS (UNIT) | `services/lti-service/src/http/operator/jobs.test.ts > returns 404 NOT_FOUND with one refused job.run audit event for an unknown job` + `services/lti-service/src/jobs/index.test.ts > logs job_failed, updates lastResult to error, and still runs the remaining jobs` + `start and stop manage unref'd timers and are idempotent` + `services/lti-service/src/jobs/idempotency-cleanup.test.ts` | as AC-01 | Unknown job name on `POST /operator/v1/jobs/:name/run` returns `404 NOT_FOUND` and writes one refused `job.run` audit event (`reason: "unknown_job"`); a throwing job logs `job_failed`, sets `lastResult = "error"`, and does not block other jobs; `idempotency_cleanup` deletes expired `completed` rows and stale (`> 60 s`) `running` rows (`BD-A2-65`, `BD-A2-66`). `e5-20-r1-unit.log` |

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
