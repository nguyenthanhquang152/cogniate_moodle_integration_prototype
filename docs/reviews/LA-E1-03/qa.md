Verdict: PASS
Round: 1

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
