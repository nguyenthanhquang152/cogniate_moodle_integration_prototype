Verdict: PASS (host-only K0 + UNIT; K1-SIM and MOODLE-LIVE pending: Docker window)
Round: 1

# LA-E1-08 S6 Extension ports P5–P7, the port context and the capability guards: QA verification

Tester: QA-3 (Orca task `task_04af42599b39`, dispatch `ctx_9a0c491be3a8`), 2026-10-22. Spec: `docs/architecture/ltiaas/tasks/LA-E1-08.md` (with `BD-A1-20`, `BD-A1-28`, `BD-A1-29`, `BD-A1-37`, `BD-A1-38`, `BD-A1-40`, `BD-A1-42`, `BD-A1-45`, `BD-A1-47`, `BD-A1-52`, `BD-A2-39`, `BD-A2-46`). Suite: `tests/ltiaas/tasks-core/LA-E1-08/` (QA-3 test-first, aligned to spec/BDs in run 7 prior to reading product source).

Independence: QA-3 did not read product source (`services/**`, `packages/**`, `apps/**`), Author notes or reviewer files. QA-3 verified all K0 and UNIT ACs in an isolated `--no-hardlinks` clone of `d2166d7`.

| Item | Value |
| --- | --- |
| SHA | `d2166d71fbd53432ea05f1a9b71a6e1e0ec690aa` (integration `d2166d7`; holds `LA-E1-08` merge `e29f574` over base `b391155`) |
| Lane and slot | lane K; no Docker (HOST-ONLY; K1-SIM and MOODLE-LIVE rows marked `pending: Docker window`) |
| Clone | `~/cogniate-qa-runs/LA/LA-E1-08/r1/clone`: `git clone --no-hardlinks --no-checkout`, detached at `d2166d71fbd53432ea05f1a9b71a6e1e0ec690aa`, push URL `DISABLED`, `npm ci` at root |
| Environment | macOS arm64, Node 24.21.0, npm 11.19.0 |
| Artifacts | private run folder `~/cogniate-qa-runs/LA/LA-E1-08/r1/` (umask 077): `npm-ci.log`, `k0-vitest.log`, `unit-rows-by-id.log`, `unit-rows-extensions.log`, `k0/e1-08-check-clean.log`, `k0/e1-08-ac04-f5-and-ports.json`, `k0/e1-08-ac09-f1-deltas.json`, `status-after.txt` |

## Acceptance criteria

| AC | Result | Test id | Command | Evidence |
| --- | --- | --- | --- | --- |
| AC-LA-E1-08-01 | pending: Docker window (K1-SIM) | `golden.k1sim.test.ts > AC-LA-E1-08-01` | SIM slot golden capture + `LA_LEVEL=k1sim` | Pending Docker window ( note: K0 `AC-LA-E1-08-04` already verifies in-process that Canvas `GET canvas-configuration` extension route returns exact `G1.canvasConfiguration["jwk=url"]` and `G1.canvasConfiguration["jwk=inline"]` bodies). |
| AC-LA-E1-08-02 | pending: Docker window (K1-SIM) | Lead QA / QA-3 K1-CAP C2 (M1 values) | Lead QA SIM slot | Pending Docker window. |
| AC-LA-E1-08-03 | PASS (UNIT) | `services/cogniate-app/src/kernel/port-context.test.ts > AC-03: refuses unscoped reads and writes, including a scope name only in a comment or value` + `AC-03: binds the library and connection on get, all and run, even if parameters try to replace them` (plus 4 `PortContext` key/seal/queue boundary tests in the same file; tests cite short `AC-03:` prefix rather than full `AC-LA-E1-08-03`, Reviewer-B maps) | `npx --no-install vitest run --reporter=verbose services/cogniate-app/src/kernel/port-context.test.ts` | `ChannelSql` refuses statements without `:library_id` (even when `:library_id` appears only in a SQL comment or string literal) with `channel_sql_unscoped`, and binds `library_id` and `connection_id` on `get`, `all` and `run` so library A cannot read or mutate rows of library B (`BD-A1-40`, `BD-A2-39`). `unit-rows-extensions.log` |
| AC-LA-E1-08-04 | PASS (K0) | `extensions.k0.test.ts > AC-LA-E1-08-04` | `LA_LEVEL=k0 LA_SCRATCH_CLONE=$PWD LA_BASE_SHA=b391155 LA_RUN_DIR=~/cogniate-qa-runs/LA/LA-E1-08/r1/k0 npx --no-install vitest run --config tests/ltiaas/tasks-core/LA-E1-08/vitest.config.mts --reporter=verbose` | `infra/scripts/fitness/rules/channel-sql-tables.mjs` passes on the clean tree (`0` hits), exits `1` on an undeclared table (`lms_connections`) and on an undeclared column (`connection.zz_secret_col`) in `packages/channels/moodle/app/zz-probe-sql.ts`, and exits `0` on declared Moodle `storage` columns (`ws_token_encrypted`, `ws_site_name`, `ws_release`, `id`, `library_id`; `BD-A1-42`). `services/cogniate-app/src/kernel/ports.ts` remains types-only; Canvas exposes `GET canvas-configuration` (`setup.artifacts`, `legacyCapabilityName = "canvasConfiguration"`), `POST deployments` is a kernel route (`BD-A1-28`), Moodle exposes `PUT web-services` (`siteApi.token`), `createMoodleCourse` (`publish.createCourse`) and `mbz` (`['scorm12']`), and Blackboard exposes none (`BD-A1-20`, `BD-A1-37`). `k0/e1-08-ac04-f5-and-ports.json` |
| AC-LA-E1-08-05 | PASS (UNIT) | `services/cogniate-app/src/kernel/extensions.test.ts > AC-05: refuses hook DTO fields outside the frozen list, including core field overrides` + `AC-05: keeps the frozen publication fields and defaults for channels without a hook` + `services/cogniate-app/src/app/native.test.ts > web services token and course shell (app contract §11) > AC-T8-09` (tests cite short `AC-05:` prefix rather than full `AC-LA-E1-08-05`, Reviewer-B maps) | `npx --no-install vitest run --reporter=verbose services/cogniate-app/src/kernel/extensions.test.ts services/cogniate-app/src/app/native.test.ts` | Any `publishHooks[].dtoFields` key outside `LEGACY_PUBLICATION_EXTENSION_FIELDS` in `legacy-wire.ts` is refused; `moodleCourse`, `shellStatus` and `shellError` appear in the publication DTO as before. `unit-rows-extensions.log` |
| AC-LA-E1-08-06 | PASS (UNIT) | `services/cogniate-app/src/kernel/extensions.test.ts > AC-06: the frozen extension and export paths are mounted in the authenticated app scope` + `services/cogniate-app/src/app/native.test.ts` (12 tests) + `services/cogniate-app/src/app/mbz-concurrency.test.ts` (4 tests; tests cite short `AC-06:` prefix, Reviewer-B maps) | `npx --no-install vitest run --reporter=verbose services/cogniate-app/src/kernel/extensions.test.ts services/cogniate-app/src/app/native.test.ts services/cogniate-app/src/app/mbz-concurrency.test.ts` | Frozen paths `GET …/canvas-configuration`, `PUT …/web-services`, `POST …/deployments`, `…/mbz` and `…/download?kind=mbz` are mounted in the authenticated app scope and answer per the base contract. `unit-rows-extensions.log` |
| AC-LA-E1-08-07 | pending: Docker window (K1-SIM) | Lead QA R1 (`M1 --phase sim` + `M2`) | Lead QA SIM slot | Pending Docker window. |
| AC-LA-E1-08-08 | pending: Docker window (MOODLE-LIVE) | Lead QA / QA-E2E R2-lite (`T7 × 1` + T8 Moodle-only features) | Moodle slot | Pending Docker window. |
| AC-LA-E1-08-09 | PASS (K0) | `extensions.k0.test.ts > AC-LA-E1-08-09` | as AC-04 | All 6 legacy core files (`services/cogniate-app/src/app/canvas-configuration.ts`, `app/canvas-deployments.ts`, `app/web-services.ts`, `app/mbz.ts`, `domain/mbz-builds.ts`, `clients/moodle-ws.ts`) are removed on disk and from git; every core file changed by `LA-E1-08` has F1 hits `<=` base (`app/publications.ts` `25 → 0`, `app/server.ts` `16 → 0`, `domain/publications.ts` `13 → 0`, `main.ts` `4 → 0`, `app/courses.ts` `2 → 0`, new `kernel/extensions.ts` `0`, `kernel/port-context.ts` `0`, `kernel/setup/deps.ts` `0`), reducing total F1 hits by `60` in `e29f574` (`141 → 81`, and `74` at `d2166d7`). `k0/e1-08-ac09-f1-deltas.json` |

### R0 `npm run check` counts at `d2166d7` (`k0/e1-08-check-clean.log`)

| Suite | LA-E0-01 baseline (`1b17261`) | At `d2166d7` |
| --- | --- | --- |
| Vitest (`test:unit`) | 97 files; 1,351 passed, 5 skipped | 147 files; 2,403 passed, 5 skipped |
| Infra (`test:infra`, `node --test`) | 197 pass, 0 fail | 230 pass, 0 fail |
| K0 (`test:k0`) | — | 3 files; 121 passed |
| F1 (`fitness:lms-names`) | — | `F1 PASS: 20 files with hits, 74 hits` |
| F5 (`fitness:rules`) | — | `F5 PASS: 5 rules (audit-event-delete, channel-sql-tables, connection-lms, no-score-sync, sql-portability), 0 hits` |

## Other checks

- **File scope (`b391155..e29f574`):** `LA-E1-08` touches `services/cogniate-app/src/kernel/{extensions,port-context,ports,setup}.ts`, `services/cogniate-app/src/kernel/setup/deps.ts`, `packages/channels/{canvas,moodle}/**`, `packages/channel-kernel/src/legacy-wire.ts`, `services/cogniate-app/src/{app,domain,main,testkit}`, `infra/scripts/fitness/**`, and RQ-2 lines in `eslint.config.js`, `infra/build-runner/queue.mjs`, `infra/scripts/build-runner.sh`, `infra/scripts/lib.sh`. No R-lane files (`domain/score-syncs.ts`, `worker/**`, `app/results.ts`, `domain/attempts.ts`, `domain/launch.ts`), `services/lti-service/**`, or `apps/**` were edited in `e29f574`.
- **Clone cleanliness:** `git status --porcelain` in `~/cogniate-qa-runs/LA/LA-E1-08/r1/clone` is empty after the run (`status-after.txt`, 0 bytes).

## Regression and time

R0 (`npm run check` on the clean clone): PASS. R1 (`AC-01`, `AC-02`, `AC-07`) and R2-lite (`AC-08`): `pending: Docker window`. Measured time of `extensions.k0.test.ts`: `111.04s` (`AC-04` `2.08s`, `AC-09` `11.36s`, `npm run check` in `beforeAll` `97.6s`).
