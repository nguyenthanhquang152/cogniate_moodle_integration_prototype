Verdict: PASS
Round: 1

# LA-E5-10 Tool signing key lifecycle, rotation, publish lead, retirement: QA verification

Tester: QA-2 (Orca task `task_0336155284b2`, dispatch `ctx_c5845e359f4b`, run `run_06d07dc77faf`), 2026-10-23. Spec: `docs/architecture/ltiaas/tasks/LA-E5-10.md` (`BD-A2-04` .. `BD-A2-06`). Suite: `tests/ltiaas/tasks-ops/LA-E5-10/`.

Independence: QA-2 authored `tests/ltiaas/tasks-ops/LA-E5-10/` from the spec and contracts (`fe606f4`) and verified all `K1-SIM` and `UNIT` checks in SIM slot 1 on `4209dcb`.

| Item | Value |
| --- | --- |
| SHA | `4209dcbd3ce5343cb2a8d90504261664e2516dc1` (product `77df44e`) |
| Lane and slot | lane S2; SIM slot 1 (`COMPOSE_PROJECT_NAME=qa2-la-sim-r3`, `PUBLIC_PORT=9443`, `STACK_SUBNET=172.20.0.0/16`) |
| Clone | `~/cogniate-qa-runs/LA/qa2-sim-4209dcb/clone-batch3` |
| Environment | macOS arm64, Node 24.21.0, Docker 29.9.1, Compose 5.6.0 |
| Artifacts | `tests/host/artifacts/qa2-la-sim-r3-4209dcb-2026-10-23T05-11-11-546Z`, `~/cogniate-qa-runs/LA/qa2-sim-4209dcb/logs/batch-3.log`, `host-pregate.log` |

## Acceptance criteria

| AC | Result | Test id | Command | Evidence |
| --- | --- | --- | --- | --- |
| AC-LA-E5-10-01 .. 04, 06, 08, 09, 13 | PASS (K1-SIM) | `tests/ltiaas/tasks-ops/LA-E5-10/signing-keys.test.ts` (8 `K1-SIM` tests: `AC-LA-E5-10-01` .. `04`, `06`, `08`, `09`, `13`) | `COMPOSE_PROJECT_NAME=qa2-la-sim-r3 PUBLIC_PORT=9443 STACK_SUBNET=172.20.0.0/16 node tests/ltiaas/tasks-ops/run-batch3.mjs --sha 4209dcb --workdir ~/cogniate-qa-runs/LA/qa2-sim-4209dcb/clone-batch3 --replace-tests` | All 8 `K1-SIM` tests pass (`container-LA-E5-10`, `8/8` passed in `1307 ms`; `batch-3.log`). |
| AC-LA-E5-10-05, 07, 10, 11, 12 | PASS (UNIT) | `services/lti-service/src/store/keys.test.ts`, `services/lti-service/src/http/operator/keys.test.ts` | `npx --no-install vitest run --reporter=verbose services/lti-service/src/store/keys.test.ts services/lti-service/src/http/operator/keys.test.ts` | Verified in `host-pregate.log` (`15/15` passed). |
