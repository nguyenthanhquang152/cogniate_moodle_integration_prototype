Verdict: PASS (K0 + UNIT + K1-SIM golden `AC-07` PASS; `R1` in Slot 3B `LA-E7-08` and `R2-lite` `AC-08` in Slot 6 `R2-sim` PASS + Slot 8 `LA-E7-09`)
Round: 3

# LA-E1-07 S5 ConnectionSetup port, authority strategies, app LMS check, operator CLI by authority: QA verification

Tester: QA-3 (Round 1: task `task_ee6c6506d56e` / `ctx_4ec2a34e6c0e`; Round 2: task `task_a50b56d70b54` / `ctx_48bb0d05458e`), 2026-10-23. Spec: `docs/architecture/ltiaas/tasks/LA-E1-07.md` (with `BD-A1-12`, `BD-A1-17`, `BD-A1-20`, `BD-A1-24`, `BD-A1-25`, `BD-A1-29`, `BD-A1-35`, `BD-A1-38`, `BD-A1-39`, `BD-A1-40`, `BD-A1-41`, `BD-A1-54`, `BD-A1-55`). Suite: `tests/ltiaas/tasks-core/LA-E1-07/` (QA-3 test-first).

Independence: QA-3 did not read product source (`services/**`, `packages/**`, `apps/**`) except the types-only `1b51999:services/cogniate-app/src/kernel/ports.ts` authorized by the Lead in run 5 (`AC-LA-E1-07-03`). QA-3 verified all K0 and UNIT ACs in isolated `--no-hardlinks` clones (`5ec8a69` in Round 1; `5b5b3a2` in Round 2).

## Round 2

| Item | Value |
| --- | --- |
| SHA | `5b5b3a2a91e7d8cb38b425e9c21d78b4c49cd943` (integration `5b5b3a2`; holds `LA-E1-07` fix round 1 merge `6270d43` over `1b4d514`: two-phase `familyGuardVerdict` `BD-A1-54`/`BD-A1-55`, kernel contexts `toolAccountId`/`toolUrls` and `@cogniate/channel-kernel/setup` `BD-A1-40`, `BD-A1-38`/`BD-A1-39`/`BD-A1-41`) |
| Lane and slot | lane K; no Docker (HOST-ONLY; K1-SIM and MOODLE-LIVE rows marked `pending: Docker window`) |
| Clone | `~/cogniate-qa-runs/LA/LA-E1-07/r2/clone`: `git clone --no-hardlinks --no-checkout`, detached at `5b5b3a2a91e7d8cb38b425e9c21d78b4c49cd943`, push URL `DISABLED`, `npm ci` at root |
| Environment | macOS arm64, Node 24.21.0, npm 11.19.0 |
| Artifacts | private run folder `~/cogniate-qa-runs/LA/LA-E1-07/r2/` (umask 077): `npm-ci.log`, `k0-vitest.log`, `unit-rows-files.log`, `k0/e1-07-check-clean.log`, `k0/e1-07-ac01-k-adapter.json`, `k0/e1-07-ac02-no-db-no-lti.log`, `k0/e1-07-ac03-ports-typecheck.log`, `k0/e1-07-ac09-f1-deltas.json`, `status-after.txt` |

### Round 2 acceptance criteria

| AC | Result | Test id | Command | Evidence |
| --- | --- | --- | --- | --- |
| AC-LA-E1-07-01 | PASS (K0 + UNIT) | `setup.k0.test.ts > AC-LA-E1-07-01` + `BD-A1-40, BD-A1-54, BD-A1-55` + `packages/channel-kernel/src/setup.test.ts` (3 tests) + `services/cogniate-app/src/kernel/setup-context.test.ts` (2 tests) + `packages/channels/{moodle,canvas,blackboard}/app.test.ts` + `services/cogniate-app/src/app/connections.test.ts > LA-IC-17` | `LA_LEVEL=k0 LA_SCRATCH_CLONE=$PWD LA_BASE_SHA=36eb4e4 LA_RUN_DIR=~/cogniate-qa-runs/LA/LA-E1-07/r2/k0 npx --no-install vitest run --config tests/ltiaas/tasks-core/LA-E1-07/vitest.config.mts --reporter=verbose` | K-ADAPTER for `moodle` (16 tool rows), `canvas` (4 tool rows) and `blackboard` (9 tool rows): `toolConfiguration` rows equal `G1.acceptance.toolConfiguration`; P2 contexts carry `toolAccountId` and `toolUrls` (`BD-A1-40`), and injecting custom `toolUrls` updates `toolConfiguration` rows without hardcoded account ids or protocol paths; `@cogniate/channel-kernel/setup` exports `toolName`, `PRINTABLE_ID`, `GRANT_CODE`, `parseStrictBody`; strict `parseBindingBody` refuses missing and unknown fields (`LA-IC-17`, `BD-A1-41`). `k0/e1-07-ac01-k-adapter.json`, `unit-rows-files.log` |
| AC-LA-E1-07-02 | PASS (K0) | `setup.k0.test.ts > AC-LA-E1-07-02` | as AC-01 | Each baseline `app.ts` runs with throwing `db` and `lti` Proxy stubs, and every `ConnectionSetup` port call (`checkCreate`, `toolConfiguration`, `parseBindingBody`, `selfCreate`, `initialTarget`, `createRequest`) succeeds with zero database or LTI calls. `k0/e1-07-ac02-no-db-no-lti.log` |
| AC-LA-E1-07-03 | PASS (K0) | `setup.k0.test.ts > AC-LA-E1-07-03` | as AC-01 | `services/cogniate-app/src/kernel/ports.ts` holds only the documented channel contract (`BD-A1-38`, `0` runtime exports; `SetupRouteDeps` moved to `kernel/setup/deps.ts`), and a scratch QA probe file `packages/channels/zz-qa-ports-probe/app.ts` type-importing `ConnectionSetup`, `PortContext` and `ChannelSql` compiles cleanly under `tsc --noEmit -p packages/channels/tsconfig.node.json`. `k0/e1-07-ac03-ports-typecheck.log` |
| AC-LA-E1-07-04 | PASS (UNIT) | `services/cogniate-app/src/kernel/authority.test.ts > AC-04/05: zz-test operator authority issues a grant, commits two phases, and fences its binding` + `AC-04/05: zz-test stored self authority binds without a grant and disconnects unconditionally` + `refuses an unbuilt stored authority as a typed API error and one-line operator result` + `suspends self/operatorGrant once and fences the reloaded disabled connection` + `treats a missing redemption engine as a wiring error` (6 tests) | `npx --no-install vitest run --reporter=verbose services/cogniate-app/src/kernel/authority.test.ts` | Strategy follows stored `binding_authority`: `zz-test` with `operatorGrant` binds via two-phase redemption and fences on disconnect/suspend; `zz-test` with `self` binds without a grant and disconnects/suspends unconditionally; unbuilt stored authorities return a typed API error and one-line operator result. `unit-rows-files.log` |
| AC-LA-E1-07-05 | PASS (UNIT) | `services/cogniate-app/src/kernel/authority.test.ts` (6 tests) | as AC-04 | `app:grant issue` refuses a `self` connection, issues a code on an `operatorGrant` connection of `zz-test`, and refuses `--purpose add_deployment` without `deployments.multiple`. `unit-rows-files.log` |
| AC-LA-E1-07-06 | PASS (K0 + UNIT) | `setup.k0.test.ts > BD-A1-40, BD-A1-54, BD-A1-55` + `packages/channel-kernel/src/family-guard.test.ts > D6 family guard during registration` (13 tests) + `D6 family guard during launch` (13 tests) + `services/cogniate-app/src/kernel/launch-router.test.ts > AC-06:` (7 tests) | `npx --no-install vitest run --reporter=verbose packages/channel-kernel/src/family-guard.test.ts services/cogniate-app/src/kernel/launch-router.test.ts` | `familyGuardVerdict(registry, family, profileChannel, phase)` in `@cogniate/channel-kernel` (`BD-A1-39`, `BD-A1-54`) implements the exact two-phase verdict table: `pass` for absent/empty/unguarded or own channel; in `registration` phase, any foreign guard (`launch` or `registration` level) returns `refuse`; in `launch` phase, a foreign `launch`-level guard returns `refuse` and a foreign `registration`-level guard returns `refuse` only on `MANUAL_SELF_LEGACY_CHANNELS` (`moodle`), else `log`. Per `BD-A1-55`, the app uses only the `'launch'` phase in `launch-router.ts`. `unit-rows-files.log`, `k0-vitest.log` |
| AC-LA-E1-07-07 | PASS (golden `G1`/`G3`/`G4` K1-SIM); `R1` covered by Wave-End Gate **Slot 3B** (`LA-E7-08`) | `golden.k1sim.test.ts > AC-LA-E1-07-07` (`1/1` PASS in `43ms` on `qalead-la-10` capture) + Lead QA Slot 3B Steps 3B.4 (`qalead-la-14` `M1 --phase sim`) & 3B.5 (`qalead-la-15` `M2`) | `LA_LEVEL=k1sim LA_GOLDEN_BASELINE=tests/ltiaas/golden/1b17261be97c4701b928fa9dc2fa74c6d23028f6 LA_GOLDEN_CAPTURE=~/cogniate-qa-runs/LA/LA-E7-08/slot3b-80133d6b/golden-capture-80133d6b662dd4fb8e18a9eed62e3160d2b2a1c5-port9443 LA_EXPECTED_DELTA=LA-IC-01..LA-IC-21 LA_RUN_DIR=~/cogniate-qa-runs/LA/run22-golden-k1sim/LA-E1-07 vitest run --config tests/ltiaas/tasks-core/LA-E1-07/vitest.config.mts` | Golden `G1`, `G3` and `G4` verified on Wave-End Gate **Slot 3B** Step 3B.1 capture (`qalead-la-10` at `80133d6b` / product code `02f5d420`): `0` unexplained differences in `G1`, `G3`, `G4` (`acDiffs: []` in `e1-07-ac07-golden-diff-paths.json`; `~/cogniate-qa-runs/LA/run22-golden-k1sim/LA-E1-07/vitest.log`). `R1` (`M1 --phase sim --provider all` 394 rows + `M2` 64 cases) covered by Wave-End Gate **Slot 3B** Steps 3B.4 (`qalead-la-14`) & 3B.5 (`qalead-la-15`) in `docs/reviews/LA-E7-08/qa.md`. |
| AC-LA-E1-07-08 | PASS (`R2-sim` in QA-E2E **Slot 6**); live Moodle covered by Wave-End Gate **Slot 8** (`LA-E7-09`) (MOODLE-LIVE) | QA-E2E Slot 6 `R2-sim` (`qa-e2e-la-sim-r1` on `936dfbf2`: `T7`, `T4b1`, `T4b2` `PASS`) + Lead QA Slot 8 (`qalead-la-30` `T7 × 1`, `qalead-la-33` `T4b1,T4b2` on `02f5d420`) | `node tests/host/run-moodle-gate.mjs --sha <wave-end-sha> --project qalead-la-30 --t7-runs 1 --suites ""` & `--project qalead-la-33 --t7-runs 0 --suites T4b1,T4b2` | Simulator counterpart `R2-sim` (`T7`, `T4b1`, `T4b2`, `T5a`, `T6` on `moodle-sim`) passed `5/5` in QA-E2E **Slot 6** (`qa-e2e-la-sim-r1`, `docs/reviews/LA-E7-09/qa.md` Round 1); live Moodle `R2-lite` (`T7 × 1`, `T4b1`, `T4b2`) runs in Wave-End Gate **Slot 8** (`docs/reviews/LA-E7-09/qa.md`). |
| AC-LA-E1-07-09 | PASS (K0) | `setup.k0.test.ts > AC-LA-E1-07-09` | as AC-01 | `services/cogniate-app/src/providers/` no longer exists on disk or in git (`0` tracked files), and every core file changed between `36eb4e4` and `5b5b3a2` has F1 hits `<=` base (`F1 PASS: 20 files with hits, 74 hits`). `k0/e1-07-ac09-f1-deltas.json` |
| AC-LA-E1-07-10 | PASS (UNIT) | `services/cogniate-app/src/kernel/setup.test.ts > AC-10: every discovered app profile matches its LTI traits and covers every registration profile` (`BD-A1-39` item b: one discovery-based test in the app kernel tests replacing per-channel copies) | `npx --no-install vitest run --reporter=verbose services/cogniate-app/src/kernel/setup.test.ts` | For every discovered channel with `app.ts`, every profile in `app.ts` `profiles` (`BD-A1-12`, `BD-A1-29`) exists in `lti-profiles.ts` with matching `sharing`, `serviceUrl` and `refusedHostSuffixes`, every manifest registration profile has an entry, and a probe with a differing value fails (`BD-A1-39`). `unit-rows-files.log` |

### R0 `npm run check` counts at `5b5b3a2` (`k0/e1-07-check-clean.log`)

| Suite | Round 1 (`5ec8a69`) | Round 2 (`5b5b3a2`) |
| --- | --- | --- |
| Vitest (`test:unit`) | 130 files; 2,166 passed, 5 skipped | 164 files; 2,625 passed, 5 skipped |
| Infra (`test:infra`, `node --test`) | 211 pass, 0 fail | 252 pass, 0 fail |
| K0 (`test:k0`) | 3 files; 121 passed | 3 files; 121 passed |
| F1 (`fitness:lms-names`) | `F1 PASS: 32 files with hits, 184 hits` | `F1 PASS: 20 files with hits, 74 hits` |
| F5 (`fitness:rules`) | `F5 PASS: 3 rules, 0 hits` | `F5 PASS: 6 rules (audit-event-delete, channel-sql-tables, connection-lms, no-score-sync, protocol-urls, sql-portability), 0 hits` |

### Round 2 other checks

- **QA fixture update (`A-LA-E1-07-03`):** Updated `buildPortContext` in `tests/ltiaas/tasks-core/LA-E1-07/setup.k0.test.ts` to supply the required `BD-A1-40` context fields (`toolAccountId: 'cogniate-lms-tool'` and `toolUrls: { loginUrl, launchUrl, deepLinkingUrl, jwksUrl, registrationUrl }`, matching the shared K0 kit) while keeping the `G1.acceptance.toolConfiguration` golden comparison and the throwing `db`/`lti` Proxy I/O stubs intact, and reran the full K0 suite (`5/5` passed).
- **File scope (`1b4d514..6270d43`):** Fix round 1 touches `packages/channel-kernel/src/{family-guard,setup,index}*`, `packages/channels/{moodle,canvas,blackboard}/app*.ts`, `services/cogniate-app/src/kernel/**`, `services/cogniate-app/src/app/**`, and `services/cogniate-app/src/tool-pages/{launch,picker,register}.ts`.
- **Clone cleanliness:** `git status --porcelain` in `~/cogniate-qa-runs/LA/LA-E1-07/r2/clone` is empty after the run (`status-after.txt`, 0 bytes).
- **Measured time (Round 2):** `setup.k0.test.ts` (5 K0 tests) `178.7s` (`npm run check` in `beforeAll` `110.6s`, `AC-01` `3ms`, `AC-02` `3ms`, `AC-03` `1.63s`, `AC-09` `66.9s`, `BD-A1-40/54/55` `9ms`); unit suites (10 files, 98 tests) `3.04s`.

---

## Round 1

| Item | Value |
| --- | --- |
| SHA | `5ec8a699a554a4043fe91c6f6903380a0c2f53d4` (integration `5ec8a69`; holds `LA-E1-07` merge `7ee6be4` over base `36eb4e4`) |
| Lane and slot | lane K; no Docker (HOST-ONLY; K1-SIM and MOODLE-LIVE rows marked `pending: Docker window`) |
| Clone | `~/cogniate-qa-runs/LA/LA-E1-07/r1/clone`: `git clone --no-hardlinks --no-checkout`, detached at `5ec8a699a554a4043fe91c6f6903380a0c2f53d4`, push URL `DISABLED`, `npm ci` at root |
| Environment | macOS arm64, Node 24.21.0, npm 11.19.0 |
| Artifacts | private run folder `~/cogniate-qa-runs/LA/LA-E1-07/r1/` (umask 077): `npm-ci.log`, `k0-vitest.log`, `unit-rows-by-id.log`, `unit-rows-files.log`, `k0/e1-07-check-clean.log`, `k0/e1-07-ac01-k-adapter.json`, `k0/e1-07-ac02-no-db-no-lti.log`, `k0/e1-07-ac03-ports-typecheck.log`, `k0/e1-07-ac09-f1-deltas.json`, `status-after.txt` |

## Acceptance criteria

| AC | Result | Test id | Command | Evidence |
| --- | --- | --- | --- | --- |
| AC-LA-E1-07-01 | PASS (K0) | `setup.k0.test.ts > AC-LA-E1-07-01` | `LA_LEVEL=k0 LA_SCRATCH_CLONE=$PWD LA_BASE_SHA=36eb4e4 LA_RUN_DIR=~/cogniate-qa-runs/LA/LA-E1-07/r1/k0 npx --no-install vitest run --config tests/ltiaas/tasks-core/LA-E1-07/vitest.config.mts --reporter=verbose` | K-ADAPTER for `moodle` (16 tool rows), `canvas` (4 tool rows) and `blackboard` (9 tool rows): `toolConfiguration` rows equal `G1.acceptance.toolConfiguration`; strict `parseBindingBody` accepts valid bodies and refuses missing (`jwksUrl`, `grantCode`, `deploymentId`) and unknown (`zzUnknownField`) fields; `initialTarget` target kind is `exclusive_platform` (Canvas) and `shared_deployment` (Blackboard); only Moodle has `selfCreate`. `k0/e1-07-ac01-k-adapter.json` |
| AC-LA-E1-07-02 | PASS (K0) | `setup.k0.test.ts > AC-LA-E1-07-02` | as AC-01 | Each baseline `app.ts` runs with throwing `db` and `lti` Proxy stubs, and every `ConnectionSetup` port call (`checkCreate`, `toolConfiguration`, `parseBindingBody`, `selfCreate`, `initialTarget`, `createRequest`) succeeds with zero database or LTI calls. `k0/e1-07-ac02-no-db-no-lti.log` |
| AC-LA-E1-07-03 | PASS (K0) | `setup.k0.test.ts > AC-LA-E1-07-03` | as AC-01 | `services/cogniate-app/src/kernel/ports.ts` exists, has only type-level AST statements and `0` runtime exports, and a scratch QA probe file `packages/channels/zz-qa-ports-probe/app.ts` type-importing `ConnectionSetup`, `PortContext` and `ChannelSql` compiles cleanly under `tsc --noEmit -p packages/channels/tsconfig.node.json`. `k0/e1-07-ac03-ports-typecheck.log` |
| AC-LA-E1-07-04 | PASS (UNIT) | `services/cogniate-app/src/kernel/authority.test.ts > AC-04/05: zz-test operator authority issues a grant, commits two phases, and fences its binding` + `AC-04/05: zz-test stored self authority binds without a grant and disconnects unconditionally` (2 tests; cites `AC-04/05`, Reviewer-B maps) | `npx --no-install vitest run --reporter=verbose services/cogniate-app/src/kernel/authority.test.ts` | Strategy follows stored `binding_authority`: `zz-test` with `operatorGrant` binds via two-phase redemption and fences on disconnect; `zz-test` with `self` binds without a grant and disconnects unconditionally (`active: false`). `unit-rows-files.log` |
| AC-LA-E1-07-05 | PASS (UNIT) | `services/cogniate-app/src/kernel/authority.test.ts > AC-04/05: zz-test operator authority issues a grant, commits two phases, and fences its binding` + `AC-04/05: zz-test stored self authority binds without a grant and disconnects unconditionally` (2 tests; cites `AC-04/05`, Reviewer-B maps) | as AC-04 | `app:grant issue` refuses a `self` connection, issues a code on an `operatorGrant` connection of `zz-test`, and refuses `--purpose add_deployment` without `deployments.multiple`. `unit-rows-files.log` |
| AC-LA-E1-07-06 | PASS (UNIT) | `services/cogniate-app/src/kernel/launch-router.test.ts > AC-06: channel zz-test, profile canvas-cloud-production, family undefined: allowed=false info=false` (+ 6 additional `AC-06:` rows; 7 tests, Reviewer-B maps) | `npx --no-install vitest run --reporter=verbose services/cogniate-app/src/kernel/launch-router.test.ts` | App LMS check refuses profile/channel mismatch (`lms_mismatch`, `connection_lms` = channel id), refuses a `launch`-level guarded family from another channel, and enforces `registration`-level family guard only on `MANUAL_SELF_LEGACY_CHANNELS` platforms (logging `family_guard_mismatch` otherwise). `unit-rows-files.log` |
| AC-LA-E1-07-07 | pending: Docker window (K1-SIM) | `golden.k1sim.test.ts > AC-LA-E1-07-07` + Lead QA R1 run | Lead QA SIM slot + `LA_LEVEL=k1sim npx --no-install vitest run --config tests/ltiaas/tasks-core/LA-E1-07/vitest.config.mts` | Pending SIM Docker window for R1 and G1/G3/G4 golden compare with `LA-IC-01`. (Host unit suites `services/cogniate-app/src/app/connections.test.ts` — including `BD-A1-24` and `BD-A1-35` — and `connect.test.ts` pass in `unit-rows-files.log`.) |
| AC-LA-E1-07-08 | pending: Docker window (MOODLE-LIVE) | Lead QA / QA-E2E R2-lite (`T7 × 1`, `T4b1`, `T4b2`) | Lead QA / QA-E2E Moodle slot | Pending Docker window. |
| AC-LA-E1-07-09 | PASS (K0) | `setup.k0.test.ts > AC-LA-E1-07-09` | as AC-01 | `services/cogniate-app/src/providers/` no longer exists on disk or in git (`0` tracked files); `services/cogniate-app/src/app/connections.ts` F1 hits dropped `7 → 0`, all new `services/cogniate-app/src/kernel/**` files have `0` F1 hits, and every changed core file decreased or stayed (`F1 PASS: 32 files with hits, 184 hits`). `k0/e1-07-ac09-f1-deltas.json` |
| AC-LA-E1-07-10 | PASS (UNIT) | `packages/channels/{moodle,canvas,blackboard}/app.test.ts > AC-LA-E1-07-10: offered profile data matches LTI traits and covers every registration profile` (3 tests) | `npx --no-install vitest run --reporter=verbose -t "AC-LA-E1-07-"` | For `moodle`, `canvas` and `blackboard`, every profile in `app.ts` `profiles` (`BD-A1-12`, `BD-A1-29`) exists in `lti-profiles.ts` with matching `sharing`, `serviceUrl` and `refusedHostSuffixes`, every manifest registration profile has an entry, and a probe with a differing value fails. `unit-rows-by-id.log` |

### R0 `npm run check` counts at `5ec8a69` (`k0/e1-07-check-clean.log`)

| Suite | Count at `5ec8a69` |
| --- | --- |
| Vitest (`test:unit`) | 130 files; 2,166 passed, 5 skipped |
| Infra (`test:infra`, `node --test`) | 211 pass, 0 fail |
| K0 (`test:k0`) | 3 files; 121 passed |
| F1 (`fitness:lms-names`) | `F1 PASS: 32 files with hits, 184 hits` |
| F5 (`fitness:rules`) | `F5 PASS: 3 rules (audit-event-delete, connection-lms, sql-portability), 0 hits` |

## Other checks

- **File scope (`36eb4e4..7ee6be4`):** `LA-E1-07` touches only files allowed by `docs/architecture/ltiaas/tasks/LA-E1-07.md` (`packages/channel-kernel/**`, `packages/channels/{moodle,canvas,blackboard}/{app,app.test,manifest}.ts`, `services/cogniate-app/src/**`, removing `services/cogniate-app/src/providers/**`; no `services/lti-service/**`, `apps/**` or `LA-E1-08` extension files).
- **Clone cleanliness:** `git status --porcelain` in `~/cogniate-qa-runs/LA/LA-E1-07/r1/clone` is empty after the run (`status-after.txt`, 0 bytes).

## Regression and time

R0 (`npm run check` on the clean clone): PASS. R1 (`AC-07`) and R2-lite (`AC-08`): `pending: Docker window`. Measured time of `setup.k0.test.ts`: `108.2s` (`AC-01` `0.002s`, `AC-02` `0.004s`, `AC-03` `0.9s`, `AC-09` `10.5s`, `npm run check` in `beforeAll` `96.8s`).
