Verdict: PASS
Round: 1

# LA-E5-04 Tool account lifecycle (`/operator/v1/accounts*`) and tenant state guard: QA verification

Tester: QA-2 (Orca task `task_0336155284b2`, dispatch `ctx_c5845e359f4b`, run `run_06d07dc77faf`), 2026-10-23. Spec: `docs/architecture/ltiaas/tasks/LA-E5-04.md`. Suite: `tests/ltiaas/tasks-ops/LA-E5-04/`.

Independence: QA-2 authored `tests/ltiaas/tasks-ops/LA-E5-04/` from the spec and contracts (`fe606f4`) and verified all 9 `K1-SIM` ACs and 3 `UNIT` ACs in SIM slot 1 on `4209dcb`.

| Item | Value |
| --- | --- |
| SHA | `4209dcbd3ce5343cb2a8d90504261664e2516dc1` (product `77df44e`) |
| Lane and slot | lane S2; SIM slot 1 (`COMPOSE_PROJECT_NAME=qa2-la-sim-r2`, `PUBLIC_PORT=9443`, `STACK_SUBNET=172.20.0.0/16`) |
| Clone | `~/cogniate-qa-runs/LA/qa2-sim-4209dcb/clone-batch2-r2` |
| Environment | macOS arm64, Node 24.21.0, Docker 29.9.1, Compose 5.6.0 |
| Artifacts | `tests/host/artifacts/qa2-la-sim-r2-4209dcb-2026-10-23T05-00-39-765Z`, `~/cogniate-qa-runs/LA/qa2-sim-4209dcb/logs/batch-2-r2.log` |

## Acceptance criteria

| AC | Result | Test id | Command | Evidence |
| --- | --- | --- | --- | --- |
| AC-LA-E5-04-01 .. 09 | PASS (K1-SIM) | `tests/ltiaas/tasks-ops/LA-E5-04/accounts.test.ts` (9 `K1-SIM` tests: `AC-LA-E5-04-01` .. `09`) | `COMPOSE_PROJECT_NAME=qa2-la-sim-r2 PUBLIC_PORT=9443 STACK_SUBNET=172.20.0.0/16 node tests/ltiaas/tasks-ops/run-batch2.mjs --sha 4209dcb --workdir ~/cogniate-qa-runs/LA/qa2-sim-4209dcb/clone-batch2-r2 --replace-tests` | All 9 `K1-SIM` tests pass (`container-LA-E5-04`, `9/9` passed; `batch-2-r2.log`). |
| AC-LA-E5-04-10 .. 12 | PASS (UNIT) | `services/lti-service/src/accounts/resolver.test.ts` (`AC-LA-E5-04-10`), `services/lti-service/src/accounts/migration.test.ts` (`AC-LA-E5-04-11`), `services/lti-service/src/store/accounts.test.ts` (`AC-LA-E5-04-12`) | `npx --no-install vitest run --reporter=verbose services/lti-service/src/accounts/resolver.test.ts services/lti-service/src/accounts/migration.test.ts services/lti-service/src/store/accounts.test.ts` | Verified in host unit run on `4209dcb` (`5/5` passed across the 3 Author unit test files). |

Correction note (2026-10-23T18:16Z, QA-2): Split `AC-LA-E5-04-01 .. 09` (`K1-SIM` in `tests/ltiaas/tasks-ops/LA-E5-04/accounts.test.ts`) from `AC-LA-E5-04-10 .. 12` (Author `UNIT` in `resolver.test.ts`, `migration.test.ts`, and `store/accounts.test.ts`) to match the test files and `batch-2-r2.log`.
