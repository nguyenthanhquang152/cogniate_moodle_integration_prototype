Verdict: PASS
Round: 1

# LA-E5-21 Production profile and secrets from files: QA verification

Tester: QA-2 (Orca task `task_d8da4ccfd3e5`, dispatch `ctx_bcd74cb4daf3`), 2026-10-23. Spec: `docs/architecture/ltiaas/tasks/LA-E5-21.md` (with `LA-ADR-06` D12, `LA-ADR-07` D4, `Q-LAB-01`). Suite: `tests/ltiaas/tasks-ops/LA-E5-21/` (QA-2 test-first, committed in `d40826d`).

Independence: QA-2 did not read product source (`services/**`, `packages/**`, `apps/**`), Author notes or reviewer files to write `tests/ltiaas/tasks-ops/LA-E5-21/` or during this host-only run on `2a15f5b`. QA-2 verified all host-only UNIT, K0 and suite checks in an isolated `--no-hardlinks` clone of `2a15f5b`.

| Item | Value |
| --- | --- |
| SHA | `2a15f5b47744e3a3d4c3c43d5a63d695a680d3b7` (integration `2a15f5b`; holds `LA-E5-21` commits `c8faf49`, `c19e722`, `caf437f`) |
| Lane and slot | lane S1; no Docker (`HOST-ONLY`; `K1-SIM` rows marked `pending: Docker window`) |
| Clone | `~/cogniate-qa-runs/LA/qa2-r8-2a15f5b/clone`: `git clone --no-hardlinks`, detached at `2a15f5b47744e3a3d4c3c43d5a63d695a680d3b7`, push URL `DISABLED`, `npm ci` at root and `tests/` |
| Environment | macOS arm64, Node 24.21.0, npm 11.19.0 |
| Artifacts | private run folder `~/cogniate-qa-runs/LA/qa2-r8-2a15f5b/logs/` (umask 077): `npm-ci-root.log`, `npm-ci-tests.log`, `check.log`, `e5-21-r1-unit.log`, `qa-suites-host.log`, `task-commits-stat.txt`, `head.txt`, `status-after.txt` |

## Acceptance criteria

| AC | Result | Test id | Command | Evidence |
| --- | --- | --- | --- | --- |
| AC-LA-E5-21-01 | pending: Docker window | `tests/ltiaas/tasks-ops/LA-E5-21/production-profile.test.ts > AC-LA-E5-21-01` + Author unit tests: `services/lti-service/src/config.test.ts > LA-E5-21 production profile and secret files > AC-01: refuses production when any test knob is active` + `services/lti-service/src/main.test.ts > LA-E5-21 AC-01: logs one config_refused line and exits 1 without opening the database` | `npx --no-install vitest run --reporter=verbose packages/shared/src/config.test.ts services/lti-service/src/config.test.ts services/lti-service/src/main.test.ts && npx --prefix tests tsc --noEmit -p tests/ltiaas/tasks-ops/LA-E5-21/tsconfig.json && npx --prefix tests vitest list --config tests/ltiaas/tasks-ops/LA-E5-21/vitest.config.mts` | Waits for a SIM Docker window (`docker compose run --rm -e STACK_PROFILE=production -e <knob>=<value> lti-service npm start`). At unit level, starting `lti-service` with `STACK_PROFILE=production` and an active test knob logs one JSON line `config_refused {reason: "test_knob_active"}`, exits `1`, and never opens the database (`e5-21-r1-unit.log`, `qa-suites-host.log`). |
| AC-LA-E5-21-02 | PASS (UNIT) | `services/lti-service/src/config.test.ts > LA-E5-21 production profile and secret files > AC-02: refuses production with LTI_PROVIDER_SIMULATION=on` | as AC-01 | With `STACK_PROFILE=production` and `LTI_PROVIDER_SIMULATION=on` (or case/whitespace variants), `loadConfig` throws `ConfigRefusedError` with `reason: "simulation_on"`. `e5-21-r1-unit.log` |
| AC-LA-E5-21-03 | PASS (UNIT) | `services/lti-service/src/config.test.ts > LA-E5-21 production profile and secret files > AC-03: refuses production with a non-empty OUTBOUND_PRIVATE_HOST_ALLOWLIST` | as AC-01 | With `STACK_PROFILE=production` and a non-empty `OUTBOUND_PRIVATE_HOST_ALLOWLIST`, `loadConfig` refuses with `reason: "private_host_allowlist"`. `e5-21-r1-unit.log` |
| AC-LA-E5-21-04 | PASS (UNIT) | `services/lti-service/src/config.test.ts > LA-E5-21 production profile and secret files > AC-04: refuses LTI_MASTER_KEY in the environment in production, and starts with LTI_MASTER_KEY_FILE` + `packages/shared/src/config.test.ts > readSecretSetting (LA-E5-21)` | as AC-01 | With `STACK_PROFILE=production`, `LTI_MASTER_KEY` in the environment is refused with `reason: "master_key_in_env"`, while providing the same key via `LTI_MASTER_KEY_FILE` (and optional `LTI_KEYRING_FILE` / `OPERATOR_API_KEY_FILE`) succeeds; setting both `NAME` and `NAME_FILE` in `default`/`acceptance` is also refused without leaking secret values. `e5-21-r1-unit.log` |
| AC-LA-E5-21-05 | PASS (UNIT) | `services/lti-service/src/config.test.ts > LA-E5-21 production profile and secret files > AC-05: refuses production with an empty TRUSTED_PROXY_CIDRS` | as AC-01 | With `STACK_PROFILE=production` and an empty `TRUSTED_PROXY_CIDRS`, `loadConfig` refuses with `reason: "no_trusted_proxy"`. `e5-21-r1-unit.log` |
| AC-LA-E5-21-06 | PASS (UNIT) | `services/lti-service/src/config.test.ts > LA-E5-21 production profile and secret files > AC-06: refuses production with a non-loopback OPERATOR_HOST` + `packages/shared/src/config.test.ts > isLoopbackHost (LA-E5-21)` + `services/lti-service/src/config.test.ts > checks the six production refusals in LA-ADR-06 D12 order` | as AC-01 | With `STACK_PROFILE=production` and `OPERATOR_HOST=0.0.0.0` (or any non-loopback host), `loadConfig` refuses with `reason: "operator_bind_not_loopback"`, whereas `127.0.0.1`, `::1`, `[::1]`, and `localhost` are accepted; all six production refusals are evaluated in exact `LA-ADR-06` D12 / `LA-ADR-07` order (`test_knob_active` -> `simulation_on` -> `private_host_allowlist` -> `master_key_in_env` -> `no_trusted_proxy` -> `operator_bind_not_loopback`). `e5-21-r1-unit.log` |
| AC-LA-E5-21-07 | pending: Docker window | `tests/ltiaas/tasks-ops/LA-E5-21/production-profile.test.ts > AC-LA-E5-21-07` + `services/lti-service/src/config.test.ts > AC-07: default and acceptance profiles keep today environment behaviour` | as AC-01 | Waits for a SIM Docker window (default and acceptance stack start and `G1` `/healthz` comparison). At unit level, `default` and `acceptance` profiles start with today's environment values (`LTI_MASTER_KEY` in env, active knobs in `acceptance`, simulation on, private host allowlist, empty `TRUSTED_PROXY_CIDRS`, and `0.0.0.0` operator host) (`e5-21-r1-unit.log`, `qa-suites-host.log`). |

### R0 `npm run check` counts at `2a15f5b` (`check.log`)

| Suite | LA-E0-01 (`1b17261`) | At `2a15f5b` |
| --- | --- | --- |
| Vitest (`test:unit`) | 97 files; 1,351 passed, 5 skipped | 180 files; 2,854 passed, 5 skipped |
| Infra (`test:infra`, `node --test`) | 197 pass, 0 fail | 254 pass, 0 fail (23 suites) |
| K0 (`test:k0`) | — | 3 files; 121 passed |
| F1 (`fitness:lms-names`) | — | `F1 PASS: 1 files with hits, 2 hits` |
| F5 (`fitness:rules`) | — | `F5 PASS: 6 rules (audit-event-delete, channel-sql-tables, connection-lms, no-score-sync, protocol-urls, sql-portability), 0 hits` |

## Other checks

- **File scope (`c8faf49`, `c19e722`, `caf437f`):** Touches `packages/shared/src/{config,config.test,index}.ts`, `services/lti-service/src/{config,config.test,main,main.test}.ts` (`task-commits-stat.txt`). Does not edit `services/cogniate-app/src/config.ts`, `packages/shared/src/knobs.ts`, or `infra/**`.
- **Clone cleanliness:** `git status --porcelain` in `~/cogniate-qa-runs/LA/qa2-r8-2a15f5b/clone` is empty after the run (`status-after.txt`, 0 bytes).

## Regression and time

R0 (`npm run check` on the clean clone): PASS (`47.09 s` unit, `647 ms` K0). Focused 3-file unit run (`e5-21-r1-unit.log`, 27 tests): `725 ms`. QA-2 host-only suite checks (`tsc --noEmit`, `vitest list` 2 `K1-SIM` cases, `node --check run.mjs`): PASS (`qa-suites-host.log`). `AC-LA-E5-21-01` and `AC-LA-E5-21-07` (`K1-SIM`) are `pending: Docker window`.
