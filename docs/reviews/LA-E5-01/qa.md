Verdict: PASS
Round: 1

# LA-E5-01 Operator listener, operator keys, `lti:operator init`: QA verification

Tester: QA-2 (Orca task `task_0336155284b2`, dispatch `ctx_c5845e359f4b`, run `run_06d07dc77faf`), 2026-10-23. Spec: `docs/architecture/ltiaas/tasks/LA-E5-01.md`. Suite: `tests/ltiaas/tasks-ops/LA-E5-01/`.

Independence: QA-2 verified `tests/ltiaas/tasks-ops/LA-E5-01/` (host + in-container `K1-SIM`) against an isolated `--no-hardlinks` clone of `7a60016` (Batch 1a on `qa2-la-sim-r1`) and host-only pre-gate checks on `4209dcb`.

| Item | Value |
| --- | --- |
| SHA | `7a60016f114375885161e4c29f4d43aa1d2e4434` (Batch 1a `K1-SIM` run) & `4209dcbd3ce5343cb2a8d90504261664e2516dc1` (host pre-gate) |
| Lane and slot | lane S1; SIM slot 1 (`COMPOSE_PROJECT_NAME=qa2-la-sim-r1`, `PUBLIC_PORT=9443`, `STACK_SUBNET=172.20.0.0/16`) |
| Clone | `~/cogniate-qa-runs/LA/qa2-sim-7a60016/clone` (`K1-SIM`) & `~/cogniate-qa-runs/LA/qa2-sim-19d6dc4/clone` (host pre-gate) |
| Environment | macOS arm64, Node 24.21.0, Docker 29.9.1, Compose 5.6.0 |
| Artifacts | `tests/host/artifacts/qa2-la-sim-r1-7a60016f-2026-10-23T02-35-48-557Z`, `~/cogniate-qa-runs/LA/qa2-sim-19d6dc4/logs/batch-1a-LA-E5-01.log` |

## Acceptance criteria

| AC | Result | Test id | Command | Evidence |
| --- | --- | --- | --- | --- |
| AC-LA-E5-01-01 .. 10 | PASS (K1-SIM) | `tests/ltiaas/tasks-ops/LA-E5-01/operator.test.ts` (`AC-LA-E5-01-01` .. `10` & `LA-E5-01-HYG`) | `COMPOSE_PROJECT_NAME=qa2-la-sim-r1 PUBLIC_PORT=9443 STACK_SUBNET=172.20.0.0/16 node tests/ltiaas/tasks-ops/LA-E5-01/run.mjs --sha 7a60016 --workdir ~/cogniate-qa-runs/LA/qa2-sim-7a60016/clone --replace-tests` | All 10 `AC-LA-E5-01-01` .. `10` rows and `LA-E5-01-HYG` pass in container `e2e` (`12/12` tests passed, exit `0`, teardown clean with `0` leftover containers/volumes/networks; `summary.json` in `qa2-la-sim-r1-7a60016f-2026-10-23T02-35-48-557Z`). |
| AC-LA-E5-01-11 | PASS (UNIT) | `services/lti-service/src/operator/keys.test.ts > AC-LA-E5-01-11` | `npx --no-install vitest run --reporter=verbose services/lti-service/src/operator/keys.test.ts` | Verified in `host-pregate.log` (`7/7` tests passed). |
