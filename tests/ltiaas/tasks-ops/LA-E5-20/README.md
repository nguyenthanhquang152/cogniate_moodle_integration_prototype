# LA-E5-20 — Should jobs and the jobs endpoints (QA-2, K1-SIM)

Owner: QA-2 (`tests/ltiaas/tasks-ops/LA-E5-20/**`).
Spec: `docs/architecture/ltiaas/tasks/LA-E5-20.md`, `LA-ADR-06` D2, D7, D11, `lti-service-api-delta.md` §3, §5, `BD-A2-65`..`BD-A2-70`.

## Coverage

| AC | Level | Covered in | What is checked |
| --- | --- | --- | --- |
| `AC-LA-E5-20-01` | `K1-SIM` | `jobs.test.ts` | `GET /operator/v1/jobs` lists every registered job (`retention`, `audit-retention`, `signing-key-cleanup`, `key-rewrap`, `api-key-expiry`, `idempotency-cleanup`, `signing-key-rotation`, `account-purge`) with `name`, `everyMs`, `lastRunAt` (ISO 8601 or `null`) and `lastResult`; also checks `Account.autoRotate` (`BD-A2-65`) |
| `AC-LA-E5-20-02` | `K1-SIM` | `jobs.test.ts` | `POST /operator/v1/jobs/retention/run` returns `202 { job: "retention", traceId }`, emits one `job_run` log line with that `trace_id`, and writes one `job.run` audit event; unknown job returns `404 NOT_FOUND` with one `refused` `job.run` event (`BD-A2-69`) |
| `AC-LA-E5-20-03` | `UNIT` | Author unit test | A run request while the job holds its lease returns `409 JOB_RUNNING` (`skipped_lease`) |
| `AC-LA-E5-20-04` | `UNIT` | Author unit test | `api-key-expiry` reports a key that expires in 13 days and does not report a key that expires in 15 days (controlled clock; `BD-A2-70`) |
| `AC-LA-E5-20-05` | `UNIT` | Author unit test | For an active account with `autoRotate: true`, `signing-key-rotation` creates a `next` key at day 83 and activates it at day 90 after the lead time; `autoRotate: false` or non-active accounts get no new key (controlled clock; `BD-A2-65`, `BD-A2-68`) |
| `AC-LA-E5-20-06` | `UNIT` | Author unit test | `account-purge` deletes tenant rows of an account closed 31 days ago (keeping tombstone + audit rows and writing one `account.purge` audit event, `BD-A2-66`, `BD-A2-67`) and keeps an account closed 29 days ago; `idempotency-cleanup` deletes records older than 24 h only |

## Host-only check (no Docker)

```sh
npx --prefix tests tsc --noEmit -p tests/ltiaas/tasks-ops/LA-E5-20/tsconfig.json
npx --prefix tests vitest list --config tests/ltiaas/tasks-ops/LA-E5-20/vitest.config.mts
node --check tests/ltiaas/tasks-ops/LA-E5-20/run.mjs
```

## SIM slot execution

```sh
COMPOSE_PROJECT_NAME=qa2-la-sim-r1 PUBLIC_PORT=9443 STACK_SUBNET=172.20.0.0/16 \
  node tests/ltiaas/tasks-ops/LA-E5-20/run.mjs --sha <integration-sha> --replace-tests
```
