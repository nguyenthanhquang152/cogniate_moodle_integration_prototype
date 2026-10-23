Verdict: PASS
Round: 1

# LA-E5-08 Key provider port, local key ring, sealed/derived storage, upgrade route U1: QA verification

Tester: QA-2 (Orca task `task_0336155284b2`, dispatch `ctx_c5845e359f4b`, run `run_06d07dc77faf`), 2026-10-23. Spec: `docs/architecture/ltiaas/tasks/LA-E5-08.md` (`LA-ADR-06` D6 `AP-06-23`). Suite: `tests/ltiaas/tasks-ops/LA-E5-08/`.

Independence: QA-2 verified `tests/ltiaas/tasks-ops/LA-E5-08/` on upgrade route `U1` (`--old-sha 1b17261be97c4701b928fa9dc2fa74c6d23028f6` -> `--sha 4209dcb`) in an isolated `--no-hardlinks` clone on `qa2-la-sim-r1`, plus unit checks in `host-pregate.log`.

| Item | Value |
| --- | --- |
| SHA | `4209dcbd3ce5343cb2a8d90504261664e2516dc1` (product `77df44e`; upgraded from `1b17261be97c4701b928fa9dc2fa74c6d23028f6`) |
| Lane and slot | lane S2; SIM slot 1 (`COMPOSE_PROJECT_NAME=qa2-la-sim-r1`, `PUBLIC_PORT=9443`, `STACK_SUBNET=172.20.0.0/16`) |
| Clone | `~/cogniate-qa-runs/LA/qa2-sim-4209dcb/clone-batch1b` |
| Environment | macOS arm64, Node 24.21.0, Docker 29.9.1, Compose 5.6.0 |
| Artifacts | `tests/host/artifacts/qa2-la-sim-r1-4209dcb-2026-10-23T05-25-56-482Z`, `~/cogniate-qa-runs/LA/qa2-sim-4209dcb/logs/batch-1b.log` |

## Acceptance criteria

| AC | Result | Test id | Command | Evidence |
| --- | --- | --- | --- | --- |
| AC-LA-E5-08-01 | PASS (K1-SIM, U1) | `tests/ltiaas/tasks-ops/LA-E5-08/run.mjs` (`AC-LA-E5-08-01` host part) + `tests/ltiaas/tasks-ops/LA-E5-08/u1.test.ts` (`LA-E5-08-U1OLD`, `LA-E5-08-U1REG`, `AC-LA-E5-08-01` registration session & tool key) | `COMPOSE_PROJECT_NAME=qa2-la-sim-r1 PUBLIC_PORT=9443 STACK_SUBNET=172.20.0.0/16 node tests/ltiaas/tasks-ops/LA-E5-08/run.mjs --sha 4209dcb --old-sha 1b17261be97c4701b928fa9dc2fa74c6d23028f6 --workdir ~/cogniate-qa-runs/LA/qa2-sim-4209dcb/clone-batch1b --replace-tests` | Candidate build starts on `1b17261` volumes with only `LTI_MASTER_KEY` (no key-ring file), completes the old build's stored Moodle Dynamic Registration session (`200` with `plt_...`), signs Deep Linking responses with the old active tool key, and emits `0` `key_provider_not_ready` / `key_open_failed` lines (`batch-1b.log`). |
| AC-LA-E5-08-02 | PASS (K1-SIM, U1) | `tests/ltiaas/tasks-ops/LA-E5-08/u1.test.ts > AC-LA-E5-08-02` | as AC-01 | Generation-0 service key keeps its exact SHA-256 value after upgrading from `1b17261` to `4209dcb`, score `POST` with the old service key returns `204`, and a 1-character-modified key returns `401 INVALID_SERVICE_AUTH_AUTHORIZATION_HEADER` (`batch-1b.log`). |
| AC-LA-E5-08-03 .. 09 | PASS (UNIT) | `packages/shared/src/key-provider.test.ts`, `services/lti-service/src/keys/key-config.test.ts` | `npx --no-install vitest run --reporter=verbose packages/shared/src/key-provider.test.ts services/lti-service/src/keys/key-config.test.ts` | Verified in `host-pregate.log` (`24/24` and `11/11` passed). |
