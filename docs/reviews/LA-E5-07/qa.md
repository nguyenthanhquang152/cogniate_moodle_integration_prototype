Verdict: PASS
Round: 1

# LA-E5-07 Multi-key tenant API keys, scopes (`launch`, `admin`), grace period: QA verification

Tester: QA-2 (Orca task `task_0336155284b2`, dispatch `ctx_c5845e359f4b`, run `run_06d07dc77faf`), 2026-10-23. Spec: `docs/architecture/ltiaas/tasks/LA-E5-07.md` (`BD-A2-07` .. `BD-A2-13`, `BD-A2-48`). Suite: `tests/ltiaas/tasks-ops/LA-E5-07/`.

Independence: QA-2 authored `tests/ltiaas/tasks-ops/LA-E5-07/` from the spec and contracts (`c3a11cf`) and verified all `K1-SIM` and `UNIT` checks in SIM slot 1 on `4209dcb`.

| Item | Value |
| --- | --- |
| SHA | `4209dcbd3ce5343cb2a8d90504261664e2516dc1` (product `77df44e`) |
| Lane and slot | lane S2; SIM slot 1 (`COMPOSE_PROJECT_NAME=qa2-la-sim-r2`, `PUBLIC_PORT=9443`, `STACK_SUBNET=172.20.0.0/16`) |
| Clone | `~/cogniate-qa-runs/LA/qa2-sim-4209dcb/clone-batch2-r2` |
| Environment | macOS arm64, Node 24.21.0, Docker 29.9.1, Compose 5.6.0 |
| Artifacts | `tests/host/artifacts/qa2-la-sim-r2-4209dcb-2026-10-23T05-00-39-765Z`, `~/cogniate-qa-runs/LA/qa2-sim-4209dcb/logs/batch-2-r2.log`, `host-pregate.log` |

## Acceptance criteria

| AC | Result | Test id | Command | Evidence |
| --- | --- | --- | --- | --- |
| AC-LA-E5-07-01 .. 05, 07, 08, 11, 12 | PASS (K1-SIM) | `tests/ltiaas/tasks-ops/LA-E5-07/api-keys.test.ts` (9 `K1-SIM` tests: `AC-LA-E5-07-01` .. `05`, `07`, `08`, `11`, `12`) | `COMPOSE_PROJECT_NAME=qa2-la-sim-r2 PUBLIC_PORT=9443 STACK_SUBNET=172.20.0.0/16 node tests/ltiaas/tasks-ops/run-batch2.mjs --sha 4209dcb --workdir ~/cogniate-qa-runs/LA/qa2-sim-4209dcb/clone-batch2-r2 --replace-tests` | All 9 `K1-SIM` tests pass (`container-LA-E5-07`, `9/9` passed; `batch-2-r2.log`). |
| AC-LA-E5-07-06, 09, 10, 12 (expired-key unit part), 13 | PASS (UNIT) | `services/lti-service/src/http/api-key-auth.test.ts` (`AC-LA-E5-07-06`, `AC-LA-E5-07-09`, expired/revoked across all 3 schemes), `services/lti-service/src/store/api-keys.test.ts` (`AC-LA-E5-07-10`), `services/lti-service/src/http/operator/api-keys.test.ts` (`BD-A2-12`, `BD-A2-33`) | `npx --no-install vitest run --reporter=verbose services/lti-service/src/http/api-key-auth.test.ts services/lti-service/src/store/api-keys.test.ts services/lti-service/src/http/operator/api-keys.test.ts` | Verified in host unit run on `4209dcb` (`25/25` passed). |

Correction note (2026-10-23T18:16Z, QA-2): Updated the `K1-SIM` row to list the 9 `K1-SIM` tests in `tests/ltiaas/tasks-ops/LA-E5-07/api-keys.test.ts` (`AC-LA-E5-07-01 .. 05, 07, 08, 11, 12`) and the `UNIT` row to list the Author `UNIT` tests (`AC-LA-E5-07-06, 09, 10`, the controlled-clock expired-key part of `12`, and `13`) to match the test files and `batch-2-r2.log`.
