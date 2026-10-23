Verdict: PASS
Round: 1

# LA-E7-03 Simulator host manifest (`tests/sim/hosts.json`) wiring: QA verification

Tester: QA-2 (Orca task `task_0336155284b2`, dispatch `ctx_c5845e359f4b`, run `run_06d07dc77faf`), 2026-10-23. Spec: `docs/architecture/ltiaas/tasks/LA-E7-03.md`. Suite: `tests/ltiaas/tasks-ops/LA-E7-03/`.

Independence: QA-2 authored `tests/ltiaas/tasks-ops/LA-E7-03/` (`hosts-manifest.k0.test.ts`, `hosts-manifest.test.ts`, `run.mjs`) from the spec and contracts (`fe606f4`) and verified all `K0` and `K1-SIM` ACs in SIM slot 1 on `4209dcb`.

| Item | Value |
| --- | --- |
| SHA | `4209dcbd3ce5343cb2a8d90504261664e2516dc1` (product `77df44e`) |
| Lane and slot | lane I (`infra`); SIM slot 1 (`COMPOSE_PROJECT_NAME=qa2-la-sim-r4`, `PUBLIC_PORT=9443`, `STACK_SUBNET=172.20.0.0/16`) |
| Clone | `~/cogniate-qa-runs/LA/qa2-sim-4209dcb/clone-batch4` |
| Environment | macOS arm64, Node 24.21.0, Docker 29.9.1, Compose 5.6.0 |
| Artifacts | `~/cogniate-qa-runs/LA/qa2-sim-4209dcb/logs/batch-4.log`, `~/cogniate-qa-runs/LA/qa2-sim-4209dcb/clone-batch4/tests/.tmp/la-e7-03-host-report.json` |

## Acceptance criteria

| AC | Result | Test id | Command | Evidence |
| --- | --- | --- | --- | --- |
| AC-LA-E7-03-01 .. 03 | PASS (K1-SIM) | `tests/ltiaas/tasks-ops/LA-E7-03/hosts-manifest.test.ts` (`AC-LA-E7-03-01`, `02`, `03`) | `COMPOSE_PROJECT_NAME=qa2-la-sim-r4 PUBLIC_PORT=9443 STACK_SUBNET=172.20.0.0/16 node tests/ltiaas/tasks-ops/LA-E7-03/run.mjs` | Default profile has no simulator host in allowlist/aliases and `/healthz` matches golden `G1.json` (`AC-03`); 3-provider baseline acceptance stack matches the 10 compose aliases, 13 `qa.crt` SANs, and 11 `lti-service` allowlist entries (`AC-01`); adding `zz-qa2-sim` to `tests/sim/hosts.json` adds `zz-qa2.sim.test` and `page.zz-qa2.sim.test` to compose aliases and `qa.crt` SANs, adds `zz-qa2.sim.test` (and not `page.zz-qa2.sim.test`) to `lti-service` allowlist, resolves both aliases to `lms-sim` inside `e2e`, and leaves `git status --porcelain -- infra/` empty (`AC-02`; `3/3` passed in `64 ms`, `batch-4.log`). |
| AC-LA-E7-03-04 | PASS (K0) | `tests/ltiaas/tasks-ops/LA-E7-03/hosts-manifest.k0.test.ts` (3 tests) | `LA_LEVEL=k0 npx --prefix tests vitest run -c tests/ltiaas/tasks-ops/LA-E7-03/vitest.config.mts` | `npm run test:infra` passes, `git status --porcelain -- infra/` is empty after `gen-env.sh` and fake-docker `stack-up.sh`, and invalid/missing manifest entries fail closed (`3/3` passed in `21,497 ms`, `batch-4.log`). |
