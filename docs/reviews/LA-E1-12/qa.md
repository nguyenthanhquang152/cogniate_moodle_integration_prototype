Verdict: PASS
Round: 1

# LA-E1-12 S9 F1 ratchet at zero, F2 on, canary check: QA verification

Tester: QA-3 (Orca task `task_9b05d182d78f`, dispatch `ctx_3c190ff75ff7`; prior `AC-02` run in `task_ca544d19e96b`), 2026-10-23. Spec: `docs/architecture/ltiaas/tasks/LA-E1-12.md` (with `docs/architecture/ltiaas/README.md` §4, `BD-A1-63`..`-65`, `BD-A1-81`, `LA-IC-20`). Suite: `tests/ltiaas/tasks-core/LA-E1-12/` (QA-3 test-first).

Independence: QA-3 did not read product source (`services/**`, `packages/**`, `apps/**`), Author notes or reviewer files. QA-3 verified `AC-LA-E1-12-01`..`-05` in an isolated `--no-hardlinks` clone of `6689a18` (`node_modules/.vitest-cache` deleted before every Vitest run).

| Item | Value |
| --- | --- |
| SHA | `6689a185faa90c444de2e1c540a476bccb4dcf01` (integration `6689a18`, code `0e6bace`; `E1-done` SHA `b216f8658a22d28943e502804a615bb0f42543e7` named in lane K's commit `7cbb8983b70761b8a68522d93429153138afb426`; F1 0 hits from `eb7b717` on; lane P `ChannelErrorNotice` fix `bd988df` and open-world card tests `d42c19d` merged) |
| Lane and slot | lane K and P; no Docker (`LA-E1-12` is K0-only) |
| Clone | `~/cogniate-qa-runs/LA/run14/r1/clone`: `git clone --no-hardlinks --no-checkout`, detached at `6689a185faa90c444de2e1c540a476bccb4dcf01`, push URL `DISABLED`, `npm ci` at root and `tests/`, `node_modules/.vitest-cache` deleted before every Vitest run |
| Environment | macOS arm64, Node 24.21.0, npm 11.19.0 |
| Artifacts | private run folder `~/cogniate-qa-runs/LA/run14/r1/k0/LA-E1-12/` (umask 077): `vitest.log`, `e1-12-check-clean.log`, `e1-12-ac01-baseline-summary.json`, `e1-12-ac01-f1.log`, `e1-12-ac02-fitness-scope.json`, `e1-12-ac03-k0-canary.log`, `e1-12-ac04-f3-eslint.log`, `e1-12-ac04-f5-rules.log`, `e1-12-ac05-f2-base.log`, `e1-12-ac05-f2-pure.log`, `e1-12-ac05-zz-probe-pure.txt`, `e1-12-portal-unit.log`, `../status-after.txt` |

## Acceptance criteria

| AC | Result | Test id | Command | Evidence |
| --- | --- | --- | --- | --- |
| AC-LA-E1-12-01 | PASS (K0 + UNIT) | `e1-done.k0.test.ts > AC-LA-E1-12-01: infra/scripts/fitness/f1-baseline.json has count 0 for every core file except legacy-wire.ts and the applied migrations, and F1 passes in npm run check` + `apps/portal/src/connect/provider-errors.test.tsx`, `apps/portal/src/channels/shell.test.tsx`, `apps/portal/src/portal.test.ts` (3 files, 77 tests) | `LA_LEVEL=k0 LA_SCRATCH_CLONE=$PWD LA_E1_DONE_SHA=b216f8658a22d28943e502804a615bb0f42543e7 LA_RUN_DIR=~/cogniate-qa-runs/LA/run14/r1/k0/LA-E1-12 npx --no-install vitest run --config tests/ltiaas/tasks-core/LA-E1-12/vitest.config.mts --reporter=verbose` | `infra/scripts/fitness/f1-baseline.json` (`35` entries) has `positiveNonExceptions: []` (count `0` for every core file except `legacy-wire.ts` and the applied migrations); `npm run fitness:lms-names` passes with `F1 PASS: 0 files with hits, 0 hits`. Lane P portal suites (`77/77` tests) verify `ChannelErrorNotice` (`bd988df`, `BD-A1-63`, `BD-A1-81`, `LA-IC-20`) and open-world card assertions (`d42c19d`). `e1-12-ac01-baseline-summary.json`, `e1-12-ac01-f1.log`, `e1-12-portal-unit.log` |
| AC-LA-E1-12-02 | PASS (K0) | `e1-done.k0.test.ts > AC-LA-E1-12-02: packages/channel-kernel/fitness-scope.json exception list has only legacy-wire.ts and the applied migrations` | same | `packages/channel-kernel/fitness-scope.json` `classes.coreExceptions.globs` lists only the 3 allowed D10 entries (`"packages/channel-kernel/src/legacy-wire.ts"`, `"services/cogniate-app/src/domain/migrations/*.sql"`, `"services/lti-service/src/db/migrations/*.sql"`), with `packages/shared/src/config.ts` absent. `e1-12-ac02-fitness-scope.json` |
| AC-LA-E1-12-03 | PASS (K0) | `e1-done.k0.test.ts > AC-LA-E1-12-03: F4: K0 passes on the QA canary channel (tests/ltiaas/canary/) loaded as the extra root, with no core edit` | same | `COGNIATE_CHANNELS_EXTRA_ROOT=tests/ltiaas/canary npm run test:k0` passes (`3` files, `134` tests in `670ms`) with no core edit. `e1-12-ac03-k0-canary.log` |
| AC-LA-E1-12-04 | PASS (K0) | `e1-done.k0.test.ts > AC-LA-E1-12-04: F3 (eslint .) has 0 errors and the full F5 run (npm run fitness:rules) has 0 hits on the clean tree` | same | `npx eslint .` exits `0` (`0` errors, `0` bytes output) and `npm run fitness:rules` passes with `F5 PASS: 6 rules (audit-event-delete, channel-sql-tables, connection-lms, no-score-sync, protocol-urls, sql-portability), 0 hits`. `e1-12-ac04-f3-eslint.log`, `e1-12-ac04-f5-rules.log` |
| AC-LA-E1-12-05 | PASS (K0) | `e1-done.k0.test.ts > AC-LA-E1-12-05: commit message names the E1-done SHA (or LA_E1_DONE_SHA is set) and F2 against it lists 0 core paths for a scratch channel packages/channels/zz-probe/**` | same | Against `E1-done` SHA `b216f8658a22d28943e502804a615bb0f42543e7` (named in `7cbb8983b70761b8a68522d93429153138afb426`), `infra/scripts/fitness/channel-diff.mjs` reports `F2 PASS: core = 0, paths = 4` for a channel-only path list (`packages/channels/zz-probe/**` + `tests/ltiaas/k0/zz-probe.test.ts`) and `F2 PASS: core = 0, paths = 1` in a detached worktree at `b216f86` with a scratch `packages/channels/zz-probe/manifest.json` commit. `e1-12-ac05-f2-pure.log`, `e1-12-ac05-f2-base.log` |

### R0 `npm run check` counts at `6689a18` (`e1-12-check-clean.log`)

| Suite | Count at `6689a18` |
| --- | --- |
| Vitest (`test:unit`) | 178 files; 2,879 passed, 5 skipped |
| Infra (`test:infra`, `node --test`) | 254 pass, 0 fail |
| K0 (`test:k0`) | 3 files; 134 passed |
| F1 (`fitness:lms-names`) | `F1 PASS: 0 files with hits, 0 hits` |
| F5 (`fitness:rules`) | `F5 PASS: 6 rules (audit-event-delete, channel-sql-tables, connection-lms, no-score-sync, protocol-urls, sql-portability), 0 hits` |

## Other checks

- **QA test updates:**
  - `tests/ltiaas/tasks-core/LA-E1-12/e1-done.k0.test.ts` (`AC-LA-E1-12-05`): Invoked `path.join(wtDir, 'infra/scripts/fitness/channel-diff.mjs')` so `common.mjs` resolves `ROOT` inside the `b216f86` worktree rather than the `6689a18` parent clone when running `--base` against the scratch commit.
  - `tests/ltiaas/tasks-core/LA-E1-04/fitness.ts`: Added `rmSync(path.join(cwd, 'node_modules/.vitest-cache'), { recursive: true, force: true })` inside `run(...)` before every Vitest/check invocation.
- **Clone cleanliness:** `git status --porcelain` in `~/cogniate-qa-runs/LA/run14/r1/clone` is empty after the run (`status-after.txt`, 0 bytes).
- **Measured time:** `e1-done.k0.test.ts` `99.38s` (`5/5` tests passed; `npm run check` in `beforeAll` `93.1s`).
