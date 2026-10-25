Verdict: PASS
Round: 2

# LA-E1-03 S2 Channel build model and the import fence F3: QA verification

Tester: QA-3 (Orca task `task_7f8563662a4f`, dispatch `ctx_c82a2585129a`), 2026-10-22. Spec: `docs/architecture/ltiaas/tasks/LA-E1-03.md`. Suite: `tests/ltiaas/tasks-core/LA-E1-03/` (QA-3 test-first).

Independence: QA-3 did not read product source, Author notes or reviewer files. QA-3 tested the build model and the F3 ESLint fence through `npm run check`, `npm run typecheck`, root Vitest and `eslint --stdin --stdin-filename <path>`, using scratch channel folders `packages/channels/zz-probe/` (QA form (k)) in the isolated clone only and removing them after each probe.

| Item | Value |
| --- | --- |
| SHA | `336448871c292d314bbae298254657de545d6013` (integration `3364488`; holds LA-E1-03 merge `a9f83be` / commit `33118bc`) |
| Lane and slot | lane K; no Docker (HOST-ONLY) |
| Clone | `~/cogniate-qa-runs/LA/LA-E1-03/r1/clone`: `git clone --no-hardlinks --no-checkout`, detached at `336448871c292d314bbae298254657de545d6013`, push URL `DISABLED`, `npm ci` at root |
| Environment | macOS arm64, Node 24.21.0, npm 11.19.0 |
| Artifacts | private run folder `~/cogniate-qa-runs/LA/LA-E1-03/r1/` (umask 077): `npm-ci.log`, `k0-vitest.log`, `k0/e1-03-check-clean.log`, `k0/e1-03-check-type-error.log`, `k0/e1-03-check-failing-test.log`, `k0/e1-03-ac03-eslint.log`, `k0/e1-03-ac05-vitest.log`, `k0/e1-03-ac05-typecheck.log`, `unit-rows-by-id.log`, `e1-03-merge-files.txt`, `status-after.txt` |

## Acceptance criteria

| AC | Result | Test id | Command | Evidence |
| --- | --- | --- | --- | --- |
| AC-LA-E1-03-01 | PASS (K0) | `build-model.k0.test.ts > AC-LA-E1-03-01` | `LA_SCRATCH_CLONE=$PWD LA_RUN_DIR=~/cogniate-qa-runs/LA/LA-E1-03/r1/k0 npx --no-install vitest run --reporter=verbose --config tests/ltiaas/tasks-core/LA-E1-03/vitest.config.mts` | Scratch `packages/channels/zz-probe/manifest.ts` with a type error makes `npm run check` fail at the `typecheck` step (`packages/channels/zz-probe/manifest.ts(1,14): error TS2322`) before `test:unit` starts; scratch folder removed. `k0/e1-03-check-type-error.log` |
| AC-LA-E1-03-02 | PASS (K0) | `build-model.k0.test.ts > AC-LA-E1-03-02` | as AC-01 | Scratch `packages/channels/zz-probe/probe.test.ts` makes `npm run check` fail at `test:unit` (`FAIL \|node\| packages/channels/zz-probe/probe.test.ts > zz-probe QA-3 failing probe`) and stop before `test:infra`; scratch folder removed. `k0/e1-03-check-failing-test.log` |
| AC-LA-E1-03-03 | PASS (K0) | `build-model.k0.test.ts > AC-LA-E1-03-03` | `npx --no-install eslint --stdin --stdin-filename <path> --format json` | All six D1 import-table probes report severity-2 import/boundary errors (`no-restricted-imports` and/or `channels/local-boundary`): (1) core `services/cogniate-app/src/zz-qa-probe.ts` importing `packages/channels/canvas/manifest`; (2) channel `packages/channels/canvas/app/zz-qa-probe.ts` importing `../../moodle/manifest`; (3) `packages/channels/canvas/manifest.ts` importing `@cogniate/shared`; (4a) `packages/channels/canvas/app.ts` and (4b) `packages/channels/moodle/app/zz-qa-probe.ts` importing `services/cogniate-app/src/domain/*`; (5) `packages/channels/canvas/portal/index.tsx` importing `apps/portal/src/Integrations`. Positive control (`manifest.ts` importing `type { ChannelManifest } from '@cogniate/channel-kernel'`) gives `[]` (0 errors). `k0/e1-03-ac03-eslint.log` |
| AC-LA-E1-03-04 | PASS (K0) | `build-model.k0.test.ts > AC-LA-E1-03-04` | `npm run check` in the clean clone | `npm run check` runs `eslint .` (`lint` step) and exits 0 with 0 errors. `k0/e1-03-check-clean.log` |
| AC-LA-E1-03-05 | PASS (K0) | `build-model.k0.test.ts > AC-LA-E1-03-05` | as AC-01 | Scratch `packages/channels/zz-probe/{manifest.ts,lti-profiles.ts,probe.test.ts}` (diff touches only `packages/channels/zz-probe/**`) is run by root Vitest (`1 passed`), linted by ESLint (not ignored), and checked by `npm run typecheck` (`zz-probe/lti-profiles.ts` type error caught) with no edit of a root build file; scratch folder removed. `k0/e1-03-ac05-vitest.log`, `k0/e1-03-ac05-typecheck.log` |

### R0 `npm run check` counts (`k0/e1-03-check-clean.log`)

| Count | LA-E0-01 (`1b17261`) | `3364488` |
| --- | --- | --- |
| Vitest (`test:unit`) | 70 files; 1,123 passed, 5 skipped | 88 files; 1,300 passed, 5 skipped |
| Infra (`node --test`) | 111 pass, 0 fail (14 suites) | 152 pass, 0 fail (17 suites) |
| K0 (`test:k0`) | — | 2 files; 42 passed, 0 failed |

All five ACs of `LA-E1-03` carry the `K0` evidence label (`npx --no-install vitest run --reporter=verbose -t "AC-LA-E1-03-"` in `unit-rows-by-id.log`: 0 UNIT tests by AC id, 88 files skipped by name filter). `git status --porcelain` in the clone is empty after the run (`status-after.txt`), and no `packages/channels/zz-*` folder remains.

## Other checks

- The LA-E1-03 task commit `33118bc` (merged as `a9f83be`) touches only files allowed by the spec (`eslint.config.js`, `package.json`, `packages/channels/tsconfig.node.json`, `packages/channels/tsconfig.portal.json`, `vitest.config.ts`; `e1-03-merge-files.txt`).
- QA test-parser note: updated `tests/ltiaas/tasks-core/LA-E1-04/fitness.ts` (`scriptEchoes` strips the `<pkg>@<ver> ` prefix on npm script echo lines such as `> cogniate-moodle-lti-prototype@0.0.0 lint`) and `tests/ltiaas/tasks-core/LA-E1-03/build-model.k0.test.ts` (`IMPORT_RULE` accepts `channels/local-boundary` alongside `no-restricted-imports` for D1 boundary errors).

## Regression and time

R0: `npm run check` on the clean clone (PASS). Measured time of the new suite: `build-model.k0.test.ts` 173.5 s (includes three `npm run check` runs: clean tree 93.1 s, type-error probe 7.6 s, failing-test probe 63.7 s, ESLint stdin probes 1.1 s, scratch channel probe 8.1 s).

---

## Round 2

Tester: QA-3 (Orca task `task_d6623272a952`, dispatch `ctx_23fdc72bce22`), 2026-10-22. Spec: `docs/architecture/ltiaas/tasks/LA-E1-03.md` (with `BD-A1-16`, `BD-A1-18`, `BD-A2-11` and Reviewer-B MINORs).

| Item | Value |
| --- | --- |
| SHA | `b3af69059a6529b1b2882b72c1869b50749f91e6` (integration `b3af690`; holds lane K `LA-E1-03` Round 2 fix merge `b3af690` over `9cbd043`) |
| Lane and slot | lane K; no Docker (HOST-ONLY) |
| Clone | `~/cogniate-qa-runs/LA/LA-E1-03/r2/clone`: `git clone --no-hardlinks --no-checkout`, detached at `b3af69059a6529b1b2882b72c1869b50749f91e6`, push URL `DISABLED`, `npm ci` at root |
| Environment | macOS arm64, Node 24.21.0, npm 11.19.0 |
| Artifacts | private run folder `~/cogniate-qa-runs/LA/LA-E1-03/r2/` (umask 077): `npm-ci.log`, `k0-vitest.log`, `unit-rows-f3.log`, `k0/e1-03-check-clean.log`, `k0/e1-03-check-type-error.log`, `k0/e1-03-check-failing-test.log`, `k0/e1-03-ac03-eslint.log`, `k0/e1-03-ac05-vitest.log`, `k0/e1-03-ac05-typecheck.log`, `k0/e1-03-ac06-root-test-typecheck.log`, `status-after.txt` |

### Acceptance criteria (Round 2)

| AC | Result | Test id | Command | Evidence |
| --- | --- | --- | --- | --- |
| AC-LA-E1-03-01 | PASS (K0) | `build-model.k0.test.ts > AC-LA-E1-03-01` | `LA_SCRATCH_CLONE=$PWD LA_RUN_DIR=~/cogniate-qa-runs/LA/LA-E1-03/r2/k0 npx --no-install vitest run --config tests/ltiaas/tasks-core/LA-E1-03/vitest.config.mts --reporter=verbose` | Scratch `packages/channels/zz-probe/manifest.ts` with a type error makes `npm run check` fail at `typecheck` (`10.97s`) before `test:unit`. `k0/e1-03-check-type-error.log` |
| AC-LA-E1-03-02 | PASS (K0) | `build-model.k0.test.ts > AC-LA-E1-03-02` | as AC-01 | Scratch `packages/channels/zz-probe/probe.test.ts` makes `npm run check` fail at `test:unit` (`61.19s`) before `test:infra`. `k0/e1-03-check-failing-test.log` |
| AC-LA-E1-03-03 | PASS (K0) | `build-model.k0.test.ts > AC-LA-E1-03-03` | `npx --no-install eslint --no-ignore --stdin --stdin-filename <path> --format json` | All 19 negative probes (`1`..`9c`) exit with severity-2 errors (`no-restricted-imports`, `no-restricted-globals`, `channels/local-boundary`, `@typescript-eslint/no-require-imports`): (1) core importing `packages/channels/canvas/manifest`; (2) channel importing `../../moodle/manifest`; (3) `manifest.ts` importing `@cogniate/shared`; (4a/4b) `app.ts` and `app/**` importing `services/cogniate-app/src/domain/*`; (5) `portal/**` importing `apps/portal/src/Integrations`; (6a–6e, `BD-A1-16`) dynamic `import('./manifest.js')`, `import(p)`, `require(...)`, `import x = require(...)` and `createRequire(...)` in channel files; (7a–7c, `BD-A1-16`) non-D1 channel files `helpers.ts` and `lib/x.ts` (`messageId: "kind"`) and `app/**` importing `../helpers` (`messageId: "boundary"`); (8, `BD-A1-16`) core `import(\`...packages/channels/canvas/manifest\`)` (`messageId: "core"`); (9a–9c, `BD-A2-11`) value and namespace imports from `@cogniate/shared` root (`no-restricted-imports`) and `fetch(...)` in `app/**` (`no-restricted-globals`). All 4 positive controls exit with `[]` (0 errors): `(control 1)` `manifest.ts` `import type` from `@cogniate/channel-kernel`; `(control 2)` `app.ts` importing `./manifest.ts` and `./app/x.ts`; `(control 3)` `app/**` `import type` from `@cogniate/shared`; `(control 4)` `app/**` value import `canonicalOrigin` from `@cogniate/shared/channel`. `k0/e1-03-ac03-eslint.log` |
| AC-LA-E1-03-04 | PASS (K0) | `build-model.k0.test.ts > AC-LA-E1-03-04` | `npm run check` in the clean clone | Clean tree passes `eslint .` inside `npm run check` with 0 errors. `k0/e1-03-check-clean.log` |
| AC-LA-E1-03-05 | PASS (K0) | `build-model.k0.test.ts > AC-LA-E1-03-05` | as AC-01 | Scratch `packages/channels/zz-probe/{manifest.ts,lti-profiles.ts,probe.test.ts}` is tested by root Vitest, linted by ESLint and checked by `npm run typecheck` with no edit of a root build file (`8.41s`). `k0/e1-03-ac05-vitest.log`, `k0/e1-03-ac05-typecheck.log` |
| AC-LA-E1-03-06 | PASS (K0) | `build-model.k0.test.ts > AC-LA-E1-03-06` | as AC-01 (`npm run typecheck`) | Scratch `packages/channels/zz-probe/probe.test.ts` with a type error (`export const broken: number = "not-a-number";`) makes `npm run typecheck` fail (`packages/channels/zz-probe/probe.test.ts(1,14): error TS2322`) because `packages/channels/tsconfig.node.json` includes `*/*.ts` and `*/app/**/*` (`BD-A1-16`, `11.30s`). `k0/e1-03-ac06-root-test-typecheck.log` |

### R0 `npm run check` counts at `b3af690` (`k0/e1-03-check-clean.log`)

| Suite | Count at `b3af690` |
| --- | --- |
| Vitest (`test:unit`) | 113 files; 2,013 passed, 5 skipped (includes `eslint.config.test.ts` and `packages/shared/src/channel.test.ts`: 495 tests passed in `unit-rows-f3.log`) |
| Infra (`test:infra`, `node --test`) | 207 pass, 0 fail (21 suites) |
| K0 (`test:k0`) | 3 files; 118 passed, 3 todo |
| F1 (`fitness:lms-names`) | `F1 PASS: 74 files with hits, 590 hits` |
| F5 (`fitness:rules`) | `F5 PASS: 3 rules (audit-event-delete, connection-lms, sql-portability), 0 hits` |

### Other checks (Round 2)

- **QA test alignment (`build-model.k0.test.ts`):** Updated `(control 2)` to use `./manifest.ts` and `./app/x.ts` (matching `LA-E1-03.md` `AC-03` and the closed file-kind extension rule) and `(control 4)` to import `canonicalOrigin` from `@cogniate/shared/channel` (one of the 23 pure helpers in `BD-A2-11`).
- **Clone cleanliness:** `git status --porcelain` in `~/cogniate-qa-runs/LA/LA-E1-03/r2/clone` is empty after the run (`status-after.txt`, 0 bytes).
- **Measured time (Round 2):** `build-model.k0.test.ts` `198.6s` (6/6 passed).
