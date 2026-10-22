Verdict: PASS (host-only K0 + UNIT; K1-SIM and MOODLE-LIVE pending: Docker window)
Round: 1

# LA-E1-07 S5 ConnectionSetup port, authority strategies, app LMS check, operator CLI by authority: QA verification

Tester: QA-3 (Orca task `task_ee6c6506d56e`, dispatch `ctx_4ec2a34e6c0e`), 2026-10-22. Spec: `docs/architecture/ltiaas/tasks/LA-E1-07.md` (with `BD-A1-12`, `BD-A1-17`, `BD-A1-20`, `BD-A1-24`, `BD-A1-25`, `BD-A1-29`, `BD-A1-35`). Suite: `tests/ltiaas/tasks-core/LA-E1-07/` (QA-3 test-first).

Independence: QA-3 did not read product source (`services/**`, `packages/**`, `apps/**`) except the types-only `1b51999:services/cogniate-app/src/kernel/ports.ts` authorized by the Lead in run 5 (`AC-LA-E1-07-03`). QA-3 aligned the K0 context stubs in `tests/ltiaas/tasks-core/LA-E1-07/setup.k0.test.ts` with `BD-A1-20` (`ports.ts`) and `G1.json` (`acceptance.toolConfiguration`), and verified all K0 and UNIT ACs in an isolated `--no-hardlinks` clone of `5ec8a69`.

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
