Verdict: PASS
Round: 1

# LA-E1-02 Kernel package, baseline manifests and the app registry: QA verification

Tester: QA-3 (Orca task `task_0304683cb252`, dispatch `ctx_caef0992f3d5`), 2026-10-22. Spec: `docs/architecture/ltiaas/tasks/LA-E1-02.md`. Suite: `tests/ltiaas/tasks-core/LA-E1-02/` (QA-3 test-first, committed in `7f4275c`).

Independence: QA-3 did not read product source, Author notes or reviewer files. QA-3 tested `@cogniate/channel-kernel` through the public entry points of `docs/architecture/ltiaas/tasks/README.md` §3, found the Author's unit tests by name through the Vitest reporter, and read only `packages/channel-kernel/fitness-scope.json` (AC-07 DOC) and the file list of the product merge.

| Item | Value |
| --- | --- |
| SHA | `7f4275c6f2875a1193d13fe2172778e35dd34fb0` (integration; holds the LA-E1-02 product merge `5f934d0` and QA-3's suite) |
| Lane and slot | lane K; no Docker (HOST-ONLY; another run holds exclusive Docker) |
| Clone | `~/cogniate-qa-runs/LA/LA-E1-02/r1/clone`: `git clone --no-hardlinks --no-checkout`, detached at `7f4275c6f2875a1193d13fe2172778e35dd34fb0`, push URL disabled, `npm ci` at root |
| Environment | macOS arm64, Node 24.21.0, npm 11.19.0 |
| Artifacts | private run folder `~/cogniate-qa-runs/LA/LA-E1-02/r1/` (umask 077): `npm-ci.log`, `k0-vitest.log`, `k0/e1-02-check-clean.log`, `k0/e1-02-ac01-channels.json`, `k0/e1-02-ac02-legacy-capabilities.json`, `k0/e1-02-ac04-canary.json`, `k0/e1-02-ac07-fitness-scope.json`, `k0/e1-02-ac10-workspaces.json`, `unit-rows-by-id.log`, `unit-rows-files-verbose.log`, `e1-02-merge-files.txt`, `status-after.txt` |

## Acceptance criteria

| AC | Result | Test id | Command | Evidence |
| --- | --- | --- | --- | --- |
| AC-LA-E1-02-01 | PASS (K0) | `registry.k0.test.ts > AC-LA-E1-02-01` | `LA_LEVEL=k0 LA_SCRATCH_CLONE=$PWD LA_RUN_DIR=~/cogniate-qa-runs/LA/LA-E1-02/r1/k0 npx --no-install vitest run --reporter=verbose --config tests/ltiaas/tasks-core/LA-E1-02/vitest.config.mts` | `moodle`, `canvas` and `blackboard` manifests pass the schema, each `id` equals its folder name, and `channels()` returns `["moodle", "canvas", "blackboard"]`. `k0/e1-02-ac01-channels.json` |
| AC-LA-E1-02-02 | PASS (K0) | `registry.k0.test.ts > AC-LA-E1-02-02` | as AC-01 | `legacyCapabilities(id)` equals the six-flag M1 capability object byte for byte for all three baseline channels (matched against G-BASE `G1.json`). `k0/e1-02-ac02-legacy-capabilities.json` |
| AC-LA-E1-02-03 | PASS (K0) | `registry.k0.test.ts > AC-LA-E1-02-03` | as AC-01 | `ownerOfFamily('canvas') = 'canvas'`, `ownerOfFamily('blackboardlearn') = 'blackboard'`, `ownerOfFamily('moodle') = null`; `textName(null) = 'Moodle'`, `textName('canvas') = 'Canvas'`. `k0-vitest.log` |
| AC-LA-E1-02-04 | PASS (K0) | `registry.k0.test.ts > AC-LA-E1-02-04` | as AC-01 | `loadChannelFolders([<product root>, <QA canary root>], 'app')` plus `buildChannelRegistry` loads `zz-canary` next to `moodle`, `canvas` and `blackboard` (`["moodle", "canvas", "blackboard", "zz-canary"]`). `k0/e1-02-ac04-canary.json` |
| AC-LA-E1-02-05 | PASS (UNIT) | Author tests: `services/cogniate-app/src/kernel/registry.test.ts > AC-LA-E1-02-05: a failing load check stops the app start with one channel_registry_invalid line > check 1..4, 6, 8` (7 cases) and `packages/channel-kernel/src/registry.test.ts > load checks (each failing case throws RegistryError with its check number) > check 1..4, 6, 8` | `npx --no-install vitest run --reporter=verbose -t "AC-LA-E1-02-"` (and verbose run of the two `registry.test.ts` files) | All cases pass. Reviewer-B checks their quality. `unit-rows-by-id.log`, `unit-rows-files-verbose.log` |
| AC-LA-E1-02-06 | PASS (UNIT) | Author tests: `services/cogniate-app/src/kernel/registry.test.ts > AC-LA-E1-02-06: the app start loads one constant root; no environment variable adds a root` and `> the product root is the repository folder packages/channels` | as AC-05 | Both tests pass. `unit-rows-by-id.log`, `unit-rows-files-verbose.log` |
| AC-LA-E1-02-07 | PASS (DOC) | `registry.k0.test.ts > AC-LA-E1-02-07 (DOC)` | as AC-01 | `packages/channel-kernel/fitness-scope.json` lists the same classes and globs as `docs/architecture/ltiaas/README.md` §4 (`channelFolders`, `core`, `coreExceptions`, `sharedBuildFiles`, `notCore`). `k0/e1-02-ac07-fitness-scope.json` |
| AC-LA-E1-02-08 | PASS (K0) | `registry.k0.test.ts > AC-LA-E1-02-08` | as AC-01 (`npm run check` in the clone) | `npm run check` runs `npm run test:k0` (`vitest run --config tests/ltiaas/k0/vitest.config.mts`: 2 files, 42 passed) and exits 0. `k0/e1-02-check-clean.log` |
| AC-LA-E1-02-09 | pending: LA-E0-03 (golden tool) and a Docker window | `golden-g1.k1sim.test.ts` | — | Binding to LA-E0-03 golden compare (`../LA-E1-01/golden-binding.ts`); waits for the golden CLI binding and a SIM Docker window. |
| AC-LA-E1-02-10 | PASS (K0) | `registry.k0.test.ts > AC-LA-E1-02-10` | as AC-01 (`npm query .workspace`) | Lists `packages/channel-kernel` (`@cogniate/channel-kernel`) and 0 paths under `packages/channels/`. `k0/e1-02-ac10-workspaces.json` |
| AC-LA-E1-02-11 | PASS (UNIT) | Author tests: `packages/channel-kernel/src/registry.test.ts > load checks … > AC-LA-E1-02-11: the baseline moodle manifest (manual with self) loads; the same rule refuses a test channel`, `> check 6: shared_platform_self_authority`, `> check 6: manual_self_authority`, and `> check 1: manifest_schema` | as AC-05 | All cases pass. Reviewer-B maps the unlabeled check 1 and check 6 subcases alongside `AC-LA-E1-02-11`. `unit-rows-by-id.log`, `unit-rows-files-verbose.log` |

### AC-08 `npm run check` counts

| Count | LA-E0-01 (`1b17261`) | `7f4275c` |
| --- | --- | --- |
| Vitest (`test:unit`) | 70 files; 1,123 passed, 5 skipped | 88 files; 1,281 passed, 5 skipped |
| Infra (`node --test`) | 111 pass, 0 fail (14 suites) | 136 pass, 0 fail (17 suites) |
| K0 (`test:k0`) | — (added in LA-E1-02) | 2 files; 42 passed, 0 failed |

Cause of the higher unit and infra counts: `7f4275c` includes LA-E1-01, LA-E1-02 (43 tests in `packages/channel-kernel` and `services/cogniate-app/src/kernel/registry.test.ts`), LA-E4-01, LA-E5-01, LA-E5-02, LA-E5-08 and LA-E7-03. The 5 skipped tests are the same course-fixture tests. `git status --porcelain` in the clone is empty after the run (`status-after.txt`).

## Other checks

- The LA-E1-02 product merge `5f934d0` changes only files allowed by the spec (`packages/channel-kernel/**`, `packages/channels/{moodle,canvas,blackboard}/{manifest.ts,README.md}`, `services/cogniate-app/src/kernel/registry.{ts,test.ts}`, `services/cogniate-app/src/main.ts`, `services/cogniate-app/package.json`, root `package.json`, `package-lock.json`, plus `infra/scripts/storage-compat.test.mjs` for the workspace count; `e1-02-merge-files.txt`).

## Regression and time

R0: the AC-08 `npm run check` run (PASS). The golden compare of the step (LA-ADR-04 D6) is pending with AC-09 (Docker window). Measured time of the new suite: `registry.k0.test.ts` 99.5 s (includes one full `npm run check` inside `beforeAll`; the 7 assertions themselves take 0.4 s).
