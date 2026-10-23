Verdict: PASS (K0 + UNIT + K1-CAP C2 AC-02; Lead R1/Moodle slots pending for AC-01, AC-07, AC-08)
Round: 3

# LA-E1-08 S6 Extension ports P5–P7, the port context and the capability guards: QA verification

Tester: QA-3 (Round 1: task `task_04af42599b39` / `ctx_9a0c491be3a8`; Round 2: task `task_a50b56d70b54` / `ctx_48bb0d05458e`; Round 3 Slot 4: task `task_e59ce20f8f0f` / `ctx_e6263da242a0`), 2026-10-23. Spec: `docs/architecture/ltiaas/tasks/LA-E1-08.md` (with `BD-A1-20`, `BD-A1-28`, `BD-A1-29`, `BD-A1-37`, `BD-A1-38`, `BD-A1-40`, `BD-A1-42`, `BD-A1-45`, `BD-A1-47`, `BD-A1-52`, `BD-A2-39`, `BD-A2-46`). Suite: `tests/ltiaas/tasks-core/LA-E1-08/` (QA-3 test-first).

Independence: QA-3 did not read product source (`services/**`, `packages/**`, `apps/**`), Author notes or reviewer files. QA-3 verified all K0 and UNIT ACs in isolated `--no-hardlinks` clones (`d2166d7` in Round 1; `5b5b3a2` in Round 2) and K1-SIM `AC-LA-E1-08-02` in Slot 4 at `e1e4fab` (`COMPOSE_PROJECT_NAME=qa3-la-sim-r3`).

## Round 2 & Round 3 (Slot 4 K1-SIM `AC-LA-E1-08-02`)

| Item | Value |
| --- | --- |
| SHA | `5b5b3a2a91e7d8cb38b425e9c21d78b4c49cd943` (R2 host-only) and `e1e4fabf451276d6b5d2c07cb28024ad8ef6f271` (R3 Slot 4 K1-SIM; code `5171f7f`) |
| Lane and slot | lane K; R2 `HOST-ONLY`; R3 Slot 4 Docker SIM (`COMPOSE_PROJECT_NAME=qa3-la-sim-r3`, `PUBLIC_PORT=9453`, `STACK_SUBNET=172.21.0.0/16`) |
| Clone | `~/cogniate-qa-runs/LA/LA-E1-08/r2/clone` (R2) and `~/cogniate-qa-runs/LA/qa3-slot4-e1e4fab/qa3-la-sim-r3-batch2` (R3): `git clone --no-hardlinks --no-checkout`, detached at target SHA, push URL `DISABLED`, `npm ci` at root |
| Environment | macOS arm64, Node 24.21.0, npm 11.19.0, Docker Compose (`qa3-la-sim-r3`) |
| Artifacts | private run folders `~/cogniate-qa-runs/LA/LA-E1-08/r2/` and `~/cogniate-qa-runs/LA/qa3-slot4-e1e4fab/artifacts/qa3-la-sim-r3-e1e4fabf-2026-10-23T06-35-01-035Z/` (`cmd/08-test-acceptance-LA-E1-08.log`, `container-LA-E1-08/vitest-results.json`, `reports/LA-E1-08.json`) |

### Round 2 & Round 3 acceptance criteria

| AC | Result | Test id | Command | Evidence |
| --- | --- | --- | --- | --- |
| AC-LA-E1-08-01 | pending: Docker window (K1-SIM) | `golden.k1sim.test.ts > AC-LA-E1-08-01` | SIM slot golden capture + `LA_LEVEL=k1sim` | Pending Docker window (K0 `AC-LA-E1-08-04` + `Round 2 (BD-A1-40, BD-A1-52)` + `packages/channels/canvas/app/configuration.test.ts` and `services/cogniate-app/src/app/canvas-configuration.test.ts` verify in-process that `GET canvas-configuration` returns exact `G1.canvasConfiguration["jwk=url"]` and `["jwk=inline"]` bodies, reads `ctx.toolUrls` even when `ctx.urls` throws, and normalizes non-ASCII library names to ASCII tool names). |
| AC-LA-E1-08-02 | PASS (K1-SIM) | `tests/ltiaas/tasks-core/LA-E1-08/capability-guards.k1sim.test.ts > AC-LA-E1-08-02: Blackboard web-services and canvas-configuration, Moodle deployments, and Canvas createMoodleCourse return 409 CAPABILITY_NOT_SUPPORTED with details.capability and zero simulator calls` | `COMPOSE_PROJECT_NAME=qa3-la-sim-r3 PUBLIC_PORT=9453 STACK_SUBNET=172.21.0.0/16 node tests/ltiaas/tasks-core/run-slot4-batch2.mjs --sha e1e4fabf451276d6b5d2c07cb28024ad8ef6f271 --replace-tests` | Live K1-SIM verification (`2268.8 ms`): `PUT /app-api/connections/:id/web-services` and `GET /app-api/connections/:id/canvas-configuration` on Blackboard return `409 CAPABILITY_NOT_SUPPORTED` (`details.capability = "webServices"` and `"canvasConfiguration"`); `POST /app-api/connections/:id/deployments` on Moodle returns `409 CAPABILITY_NOT_SUPPORTED` (`details.capability = "addDeployment"`); `POST /app-api/publications` with `createMoodleCourse: true` on Canvas returns `409 CAPABILITY_NOT_SUPPORTED` (`details.capability = "courseShell"`); `/__sim/records` records `0` simulator calls across all four refusals. `08-test-acceptance-LA-E1-08.log`, `reports/LA-E1-08.json` |
| AC-LA-E1-08-03 | PASS (UNIT + K0) | `services/cogniate-app/src/kernel/port-context.test.ts > AC-03: refuses unscoped reads and writes, including a scope name only in a comment or value` + `names invalid SQL parameter refusals for the runtime log` + `AC-03: binds the library and connection on get, all and run, even if parameters try to replace them` (+ 4 key/seal/queue boundary tests in the same file) | `npx --no-install vitest run --reporter=verbose services/cogniate-app/src/kernel/port-context.test.ts` | `ChannelSql` refuses statements without `:library_id` with `channel_sql_unscoped`, names invalid SQL parameter refusals (`channel_sql_invalid_params`) for the runtime log, and binds `library_id` and `connection_id` on `get`, `all` and `run` so library A cannot read or mutate rows of library B (`BD-A1-40`, `BD-A2-39`). `unit-rows-extensions.log`, `k0/e1-08-r2-unit-extensions.log` |
| AC-LA-E1-08-04 | PASS (K0 + INFRA) | `extensions.k0.test.ts > AC-LA-E1-08-04` + `Round 2 (BD-A1-40, BD-A1-52)` + `infra/scripts/fitness/channel-sql-tables.test.mjs` (9 tests) + `packages/channels/canvas/app/configuration.test.ts` (6 tests) + `services/cogniate-app/src/kernel/setup-context.test.ts` (2 tests) | `LA_LEVEL=k0 LA_SCRATCH_CLONE=$PWD LA_BASE_SHA=b391155 LA_RUN_DIR=~/cogniate-qa-runs/LA/LA-E1-08/r2/k0 npx --no-install vitest run --config tests/ltiaas/tasks-core/LA-E1-08/vitest.config.mts --reporter=verbose` | `channel-sql-tables.mjs` passes on clean tree (`0` hits), refuses undeclared storage in `SELECT`/`REPLACE`/`VALUES` in both `packages/channels/*/app/**` and `packages/channels/*/app.ts` while ignoring unit fixture SQL (`infra-sql-tables.log`), and allows declared `storage` tables/columns (`BD-A1-42`, `BD-A1-52`). P5 `PortContext` supplies `toolUrls` (`BD-A1-40`), and Canvas `canvas-configuration` uses `ctx.toolUrls` even when `ctx.urls` is a throwing stub (`Round 2 (BD-A1-40, BD-A1-52)`). `k0/e1-08-ac04-f5-and-ports.json`, `k0/e1-08-r2-unit-extensions.log` |
| AC-LA-E1-08-05 | PASS (UNIT + K0) | `services/cogniate-app/src/kernel/extensions.test.ts > AC-05: refuses hook DTO fields outside the frozen list, including core field overrides` + `AC-05: keeps the frozen publication fields and defaults for channels without a hook` + `services/cogniate-app/src/app/native.test.ts > AC-T8-09` | `npx --no-install vitest run --reporter=verbose services/cogniate-app/src/kernel/extensions.test.ts services/cogniate-app/src/app/native.test.ts` | Any `publishHooks[].dtoFields` key outside `LEGACY_PUBLICATION_EXTENSION_FIELDS` in `legacy-wire.ts` is refused with a named kernel error; `moodleCourse`, `shellStatus` and `shellError` appear in the publication DTO as before. `unit-rows-extensions.log` |
| AC-LA-E1-08-06 | PASS (UNIT + K0) | `services/cogniate-app/src/kernel/extensions.test.ts > mounts only a frozen path or x/<name>: canvas-configuration | web-services | createMoodleCourse | x/reports allowed=true` + `reports | deployments | constructor | x/../reports | x/reports/more | x/ | /web-services allowed=false` (11 tests) + `AC-06: the frozen extension and export paths are mounted in the authenticated app scope` + `services/cogniate-app/src/app/{canvas-configuration,canvas-deployments,mbz-concurrency,native}.test.ts` | `npx --no-install vitest run --reporter=verbose services/cogniate-app/src/kernel/extensions.test.ts services/cogniate-app/src/app/canvas-configuration.test.ts services/cogniate-app/src/app/canvas-deployments.test.ts services/cogniate-app/src/app/mbz-concurrency.test.ts services/cogniate-app/src/app/native.test.ts` | Only frozen extension paths (`canvas-configuration`, `web-services`) or `x/<name>` and the frozen publish option (`createMoodleCourse`) may be mounted; non-frozen/reserved/traversal paths (`reports`, `deployments`, `constructor`, `x/../reports`, `x/reports/more`, `x/`, `/web-services`) are refused with named kernel errors; all frozen routes (`GET …/canvas-configuration`, `PUT …/web-services`, `POST …/deployments`, `…/mbz`, `…/download?kind=mbz`) answer per the base contract. `unit-rows-extensions.log`, `k0/e1-08-r2-unit-extensions.log` |
| AC-LA-E1-08-07 | pending: Docker window (K1-SIM) | Lead QA R1 (`M1 --phase sim` + `M2`) | Lead QA SIM slot | Pending Docker window. |
| AC-LA-E1-08-08 | pending: Docker window (MOODLE-LIVE) | Lead QA / QA-E2E R2-lite (`T7 × 1` + T8 Moodle-only features) | Moodle slot | Pending Docker window. |
| AC-LA-E1-08-09 | PASS (K0) | `extensions.k0.test.ts > AC-LA-E1-08-09` | as AC-04 | All 6 legacy core files (`canvas-configuration.ts`, `canvas-deployments.ts`, `web-services.ts`, `mbz.ts`, `mbz-builds.ts`, `moodle-ws.ts`) are absent on disk and in git, and every changed core file between `b391155` and `5b5b3a2` has F1 hits `<=` base (`F1 PASS: 20 files with hits, 74 hits`). `k0/e1-08-ac09-f1-deltas.json` |

### R0 `npm run check` counts at `5b5b3a2` (`k0/e1-08-check-clean.log`)

| Suite | Round 1 (`d2166d7`) | Round 2 (`5b5b3a2`) |
| --- | --- | --- |
| Vitest (`test:unit`) | 147 files; 2,403 passed, 5 skipped | 164 files; 2,625 passed, 5 skipped |
| Infra (`test:infra`, `node --test`) | 230 pass, 0 fail | 252 pass, 0 fail |
| K0 (`test:k0`) | 3 files; 121 passed | 3 files; 121 passed |
| F1 (`fitness:lms-names`) | `F1 PASS: 20 files with hits, 74 hits` | `F1 PASS: 20 files with hits, 74 hits` |
| F5 (`fitness:rules`) | `F5 PASS: 5 rules, 0 hits` | `F5 PASS: 6 rules (audit-event-delete, channel-sql-tables, connection-lms, no-score-sync, protocol-urls, sql-portability), 0 hits` |

### Round 2 other checks

- **File scope (`1b4d514..6270d43`):** Fix round 1 touches `services/cogniate-app/src/kernel/**`, `packages/channels/{canvas,moodle}/**`, `services/cogniate-app/src/app/{canvas-configuration,canvas-deployments}.test.ts`, `infra/scripts/fitness/{rules/channel-sql-tables.mjs,channel-sql-tables.test.mjs}`, and `eslint.config.{js,test.ts}`.
- **Clone cleanliness:** `git status --porcelain` in `~/cogniate-qa-runs/LA/LA-E1-08/r2/clone` is empty after the run (`status-after.txt`, 0 bytes).
- **Measured time (Round 2):** `extensions.k0.test.ts` (3 K0 tests) `163.19s` (`AC-04` `1.35s`, `AC-09` `48.40s`, `Round 2` `0.73s`, `npm run check` in `beforeAll` `112.7s`); unit suites (7 files, 60 tests) `2.38s`; `channel-sql-tables.test.mjs` (9 tests) `0.16s`.

---

## Round 1

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
