Verdict: PASS
Round: 1

# LA-E5-02 Append-only audit log and `/operator/v1/audit`: QA verification

Tester: QA-2 (Orca task `task_0336155284b2`, dispatch `ctx_c5845e359f4b`, run `run_06d07dc77faf`), 2026-10-23. Spec: `docs/architecture/ltiaas/tasks/LA-E5-02.md`. Suite: `tests/ltiaas/tasks-ops/LA-E5-02/`.

Independence: QA-2 authored `tests/ltiaas/tasks-ops/LA-E5-02/` from the spec and contracts (`fe606f4`) and verified all `K1-SIM` and `UNIT` checks in SIM slot 1 on `4209dcb`.

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
| AC-LA-E5-02-01 .. 06, 08, 10 | PASS (K1-SIM) | `tests/ltiaas/tasks-ops/LA-E5-02/audit.test.ts` (8 `K1-SIM` tests: `AC-LA-E5-02-01` .. `06`, `08`, `10`) | `COMPOSE_PROJECT_NAME=qa2-la-sim-r2 PUBLIC_PORT=9443 STACK_SUBNET=172.20.0.0/16 node tests/ltiaas/tasks-ops/run-batch2.mjs --sha 4209dcb --workdir ~/cogniate-qa-runs/LA/qa2-sim-4209dcb/clone-batch2-r2 --replace-tests` | All 8 `K1-SIM` tests pass (`container-LA-E5-02`, `8/8` passed in `1050 ms`; `batch-2-r2.log`). |
| AC-LA-E5-02-07, 09 | PASS (UNIT) | `services/lti-service/src/store/audit.test.ts` (`AC-LA-E5-02-07`, `AC-LA-E5-02-09`) | `npx --no-install vitest run --reporter=verbose services/lti-service/src/store/audit.test.ts` | Verified in `host-pregate.log` (`15/15` passed) and `F5` rule `audit-event-delete` (`0` hits). |
