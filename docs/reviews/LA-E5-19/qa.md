Verdict: PASS
Round: 1

# LA-E5-19 Configurable retention, batching, job leases, `audit_event` retention: QA verification

Tester: QA-2 (Orca task `task_0336155284b2`, dispatch `ctx_c5845e359f4b`, run `run_06d07dc77faf`), 2026-10-23. Spec: `docs/architecture/ltiaas/tasks/LA-E5-19.md` (`BD-A2-23` .. `BD-A2-28`, `BD-A2-31`, `BD-A2-32`). Suite: `tests/ltiaas/tasks-ops/LA-E5-19/`.

Independence: QA-2 authored `tests/ltiaas/tasks-ops/LA-E5-19/` from the spec and contracts (`c3a11cf`) and verified all `K1-SIM` and `UNIT` checks in SIM slot 1 on `4209dcb`.

| Item | Value |
| --- | --- |
| SHA | `4209dcbd3ce5343cb2a8d90504261664e2516dc1` (product `77df44e`) |
| Lane and slot | lane S1; SIM slot 1 (`COMPOSE_PROJECT_NAME=qa2-la-sim-r2`, `PUBLIC_PORT=9443`, `STACK_SUBNET=172.20.0.0/16`) |
| Clone | `~/cogniate-qa-runs/LA/qa2-sim-4209dcb/clone-batch2-r2` |
| Environment | macOS arm64, Node 24.21.0, Docker 29.9.1, Compose 5.6.0 |
| Artifacts | `tests/host/artifacts/qa2-la-sim-r2-4209dcb-2026-10-23T05-00-39-765Z`, `~/cogniate-qa-runs/LA/qa2-sim-4209dcb/logs/batch-2-r2.log`, `host-pregate.log` |

## Acceptance criteria

| AC | Result | Test id | Command | Evidence |
| --- | --- | --- | --- | --- |
| AC-LA-E5-19-01, 04, 08 | PASS (K1-SIM) | `tests/ltiaas/tasks-ops/LA-E5-19/retention.test.ts` (3 `K1-SIM` tests: `AC-LA-E5-19-01`, `04`, `08` — startup `retention` `job_run`, startup `signing-key-cleanup` `job_run`, and `npm run stack:restart -- lti-service` with a new `retention` `job_run` and no `job_instance_conflict` after a restart) | `COMPOSE_PROJECT_NAME=qa2-la-sim-r2 PUBLIC_PORT=9443 STACK_SUBNET=172.20.0.0/16 node tests/ltiaas/tasks-ops/run-batch2.mjs --sha 4209dcb --workdir ~/cogniate-qa-runs/LA/qa2-sim-4209dcb/clone-batch2-r2 --replace-tests` | All 3 `K1-SIM` tests pass (`container-LA-E5-19`, `3/3` passed; `lti-restart` host action exit `0` in `7929 ms`; `batch-2-r2.log`). |
| AC-LA-E5-19-02, 03, 05, 06, 07, 09 | PASS (UNIT) | `services/lti-service/src/jobs/retention.test.ts` (`AC-LA-E5-19-02`, `09`), `services/lti-service/src/jobs/audit-retention.test.ts` (`AC-LA-E5-19-03`), `services/lti-service/src/jobs/index.test.ts` (`AC-LA-E5-19-05`, `06`), `services/lti-service/src/main.test.ts` (`AC-LA-E5-19-07`) | `npx --no-install vitest run --reporter=verbose services/lti-service/src/jobs/retention.test.ts services/lti-service/src/jobs/audit-retention.test.ts services/lti-service/src/jobs/index.test.ts services/lti-service/src/main.test.ts` | Verified in host unit run on `4209dcb` (`23/23` passed). |

Correction note (2026-10-23T18:16Z, QA-2): Updated the `K1-SIM` row from `01, 02, 07` to `01, 04, 08` (including `AC-LA-E5-19-08`: no `job_instance_conflict` after a restart) and the `UNIT` row to `02, 03, 05, 06, 07, 09` to match `tests/ltiaas/tasks-ops/LA-E5-19/retention.test.ts`, the Author unit tests, and `batch-2-r2.log`.
