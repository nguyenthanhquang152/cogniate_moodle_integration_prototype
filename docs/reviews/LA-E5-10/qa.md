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
| AC-LA-E5-10-01 .. 04, 06, 08, 09 | PASS (K1-SIM) | `tests/ltiaas/tasks-ops/LA-E5-10/signing-keys.test.ts` (7 `K1-SIM` tests: `AC-LA-E5-10-01` .. `04`, `06`, `08`, `09`) | `COMPOSE_PROJECT_NAME=qa2-la-sim-r3 PUBLIC_PORT=9443 STACK_SUBNET=172.20.0.0/16 node tests/ltiaas/tasks-ops/run-batch3.mjs --sha 4209dcb --workdir ~/cogniate-qa-runs/LA/qa2-sim-4209dcb/clone-batch3 --replace-tests` | All 7 `K1-SIM` tests pass (`container-LA-E5-10`, `7/7` passed; `batch-3.log`). |
| AC-LA-E5-10-05, 07, 10, 11, 12, 13, 14 | PASS (UNIT) | `services/lti-service/src/store/tool-keys-lifecycle.test.ts` (`AC-LA-E5-10-05`, `07`, `13`), `services/lti-service/src/http/operator/signing-keys.test.ts` (`AC-LA-E5-10-13`, `14`), `services/lti-service/src/jobs/signing-key-cleanup.test.ts` (`AC-LA-E5-10-10`, `11`, `12`) | `npx --no-install vitest run --reporter=verbose services/lti-service/src/store/tool-keys-lifecycle.test.ts services/lti-service/src/http/operator/signing-keys.test.ts services/lti-service/src/jobs/signing-key-cleanup.test.ts` | Verified in host unit run on `4209dcb` (`21/21` passed). |

Correction note (2026-10-23T18:16Z, QA-2): Moved `AC-LA-E5-10-13` from the `K1-SIM` row (7 `K1-SIM` tests: `AC-LA-E5-10-01 .. 04, 06, 08, 09` in `tests/ltiaas/tasks-ops/LA-E5-10/signing-keys.test.ts`) to the Author `UNIT` row (`tool-keys-lifecycle.test.ts`, `signing-keys.test.ts`, `signing-key-cleanup.test.ts`) to match the test files and `batch-3.log`.
