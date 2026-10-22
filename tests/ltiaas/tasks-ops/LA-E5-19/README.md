# LA-E5-19 retention jobs on the job runner: QA-2 acceptance tests

Spec: `docs/architecture/ltiaas/tasks/LA-E5-19.md`. Design: `docs/architecture/ltiaas/adr/LA-ADR-03-lti-protocol-depth.md` D7 (`AP-03-22` to `AP-03-27`), `docs/architecture/ltiaas/adr/LA-ADR-06-service-operability.md` D11 (`AP-06-44` to `AP-06-49`). QA-2 wrote these tests from the spec and the ADRs only (test-first).

## AC map

| AC id | Test id | Label | What it needs |
| --- | --- | --- | --- |
| `AC-LA-E5-19-01` | `AC-LA-E5-19-01` (`retention.test.ts`) | `K1-SIM` | Running stack (`acceptance` profile): after a service start, `infra/.logs/lti-service.jsonl` has one `job_run {job: "retention", result: "ok"}` line with `ms`, `trace_id`, and numeric deletion `counts`. |
| `AC-LA-E5-19-02` | Author unit test (`retention-expired-rows`) | `UNIT` | No Docker: nonces and states older than 600 s, expired sessions, revoked or expired refresh tokens, and expired `id_token_cache` rows are deleted; fresh rows stay. QA records the Author unit test run in `qa.md`. |
| `AC-LA-E5-19-03` | Author unit test (`retention-audit-and-outbox`) | `UNIT` | No Docker: `audit_log` rows older than 90 days and `score_outbox` rows in `sent`/`conflict`/`failed` older than 30 days are deleted; `pending` and `sending` rows stay regardless of age. QA records the Author unit test run in `qa.md`. |
| `AC-LA-E5-19-04` | `AC-LA-E5-19-04` (`retention.test.ts`) | `K1-SIM` | Running stack (`acceptance` profile): after a service start, `infra/.logs/lti-service.jsonl` has one `job_run {job: "signing-key-cleanup"}` line (the module of `LA-E5-10` is registered). |
| `AC-LA-E5-19-05` | Author unit test (`job-runner-conflict`) | `UNIT` | No Docker: two job runners started against the same Postgres -> the second logs `job_instance_conflict` and does not run jobs. QA records the Author unit test run in `qa.md`. |
| `AC-LA-E5-19-06` | Author unit test (`job-runner-stale-takeover`) | `UNIT` | No Docker: a job runner whose `heartbeat_at` is older than 30 s is taken over by a new runner, and its jobs run. QA records the Author unit test run in `qa.md`. |
| `AC-LA-E5-19-07` | Author unit test (`job-runner-isolated-failure`) | `UNIT` | No Docker: a job that throws logs `job_run {result: "error"}` and the next job still runs. QA records the Author unit test run in `qa.md`. |
| `AC-LA-E5-19-08` | `AC-LA-E5-19-08` (`retention.test.ts` + `run.mjs` host action `lti-restart`) | `K1-SIM` | Running stack (`acceptance` profile) + QA form (l) (`npm run stack:restart -- lti-service`): the service is ready as fast as before LA, the new start logs a new `job_run {job: "retention"}` line, and no `job_instance_conflict` line appears. |
| `AC-LA-E5-19-09` | Author unit test (`job-runner-graceful-stop`) | `UNIT` | No Docker: `stop()` deletes the `job_instance` row; a second runner started right after starts immediately without conflict. QA records the Author unit test run in `qa.md`. |

## How to run

### K1-SIM (booked SIM slot only)

```sh
COMPOSE_PROJECT_NAME=qa2-la-sim-r1 PUBLIC_PORT=9443 STACK_SUBNET=172.20.0.0/16 \
  node tests/ltiaas/tasks-ops/LA-E5-19/run.mjs --sha <integration sha> --replace-tests
```

### No-Docker checks (host-only)

```sh
npx --prefix tests tsc --noEmit -p tests/ltiaas/tasks-ops/LA-E5-19/tsconfig.json
npx --prefix tests vitest list --config tests/ltiaas/tasks-ops/LA-E5-19/vitest.config.mts
```
