Verdict: PASS
Round: 1

# LA-E1-04 Fitness tools F1, F2 and the F5 rule runner: QA verification

Tester: QA-3 (Orca task `task_443093f7301e`, dispatch `ctx_3dc20840b43e`), 2026-10-22. Spec: `docs/architecture/ltiaas/tasks/LA-E1-04.md` (with `BD-A1-02`, `BD-A1-04`, `BD-A1-07`, `BD-A1-09`, `BD-A1-15`). Suite: `tests/ltiaas/tasks-core/LA-E1-04/` (QA-3 test-first).

Independence: QA-3 did not read product source (`services/**`, `packages/**`, `apps/**`), Author notes or reviewer files. QA-3 verified F1 (`fitness:lms-names`), F2 (`fitness:channel-diff`) and F5 (`fitness:rules`) through `npm run check`, `--stdin --as <path>`, `--paths-from <file>`, scratch channel folders and scratch branches in an isolated clone only.

| Item | Value |
| --- | --- |
| SHA | `3fe6c134c2e9e9dae1de5a41fb95920d26ce3caa` (integration `3fe6c13`; holds LA-E1-04 + `BD-A1-15` fix merge `b1906d7` and root wiring `3fe6c13`) |
| Lane and slot | lane P + lane K root wiring; no Docker (HOST-ONLY) |
| Clone | `~/cogniate-qa-runs/LA/LA-E1-04/r1/clone`: `git clone --no-hardlinks --no-checkout`, detached at `3fe6c134c2e9e9dae1de5a41fb95920d26ce3caa`, push URL `DISABLED`, `npm ci` at root |
| Environment | macOS arm64, Node 24.21.0, npm 11.19.0 |
| Artifacts | private run folder `~/cogniate-qa-runs/LA/LA-E1-04/r1/` (umask 077): `npm-ci.log`, `check.log`, `k0-vitest.log`, `infra-fitness-test.log`, `k0/e1-04-check-clean.log`, `k0/e1-04-f1-baseline-summary.json`, `k0/e1-04-ac02-probes.log`, `k0/e1-04-ac05-ratchet.log`, `k0/e1-04-ac07-f2.log`, `k0/e1-04-ac08-rename.log`, `k0/e1-04-ac09-f5.log`, `k0/e1-04-check-probe-rule.log`, `status-after.txt` |

## Acceptance criteria

| AC | Result | Test id | Command | Evidence |
| --- | --- | --- | --- | --- |
| AC-LA-E1-04-01 | PASS (K0) | `fitness.k0.test.ts > AC-LA-E1-04-01` | `LA_LEVEL=k0 LA_SCRATCH_CLONE=$PWD LA_RUN_DIR=~/cogniate-qa-runs/LA/LA-E1-04/r1/k0 npx --no-install vitest run --config tests/ltiaas/tasks-core/LA-E1-04/vitest.config.mts --reporter=verbose` | Clean tree passes `npm run check` (`F1 PASS: 80 files with hits, 680 hits`; `apps/portal/src/App.tsx` count `13`, baseline `13`, delta `+0`). `infra/scripts/fitness/f1-baseline.json` holds `80` core files totaling `680` hits, and every entry matches a core file with a positive hit count. `k0/e1-04-check-clean.log`, `k0/e1-04-f1-baseline-summary.json` |
| AC-LA-E1-04-02 | PASS (K0) | `fitness.k0.test.ts > AC-LA-E1-04-02` | `npm run --silent fitness:lms-names -- --stdin --as <core path>` | Every probe exits `1` and prints `path:line:col  "<token>"  banned "<word>"`: identifier `createMoodleWsClient` (`moodle`), string `"canvas"` (`canvas`), template part `/blackboard/x` (`blackboard`), JSX text `Connect your Moodle site` (`moodle`), import source `moodle-client` (`moodle`), new migration column `moodle_x` (`moodle`), and regular-expression literals `/canvas/` (`canvas`), `/\bcanvas\b/i` (`"\\bcanvas\\b"`, `canvas`), `/^(moodle\|canvas)-/` (`"^(moodle\|canvas)-"`, `moodle` and `canvas`), and `/\.instructure\.com$/i` (`"\\.instructure\\.com$"`, `instructure`; `BD-A1-15`). `k0/e1-04-ac02-probes.log` |
| AC-LA-E1-04-03 | PASS (K0) | `fitness.k0.test.ts > AC-LA-E1-04-03` + `AC-LA-E1-04-03 (lti-generic part)` | as AC-02 | Comment-only text (`moodle`, `canvas`, `blackboard` in `//` and `/* */`), `<canvas>` + `HTMLCanvasElement` (`CanvasRenderingContext2D`, `OffscreenCanvas`), and `"generic"` / `ltiUrl` alone exit `0` with `0` hits; `ltiGeneric` and `"lti-generic"` exit `1` and report banned `"lti-generic"` (`BD-A1-07`). `k0-vitest.log` |
| AC-LA-E1-04-04 | PASS (K0) | `fitness.k0.test.ts > AC-LA-E1-04-04` | as AC-01 | Adding a temporary folder `packages/channels/zz-lms/` in the clone causes `--stdin --as services/cogniate-app/src/zz-qa-probe.ts` with `export const zzLms = 1;` to exit `1` (`"zzLms"  banned "zz-lms"`) with no edit of the banned list; temporary folder removed. `k0-vitest.log` |
| AC-LA-E1-04-05 | PASS (K0) | `fitness.k0.test.ts > AC-LA-E1-04-05` | as AC-02 | Raising `apps/player/src/lms-name.ts` from `6` to `7` exits `1` (`apps/player/src/lms-name.ts: count 7, baseline 6, delta +1`); lowering to `0` exits `0` and prints `apps/player/src/lms-name.ts: count 0, baseline 6, delta -6` (`lower f1-baseline.json for apps/player/src/lms-name.ts to 0`). `k0/e1-04-ac05-ratchet.log` |
| AC-LA-E1-04-06 | PASS (K0) | `fitness.k0.test.ts > AC-LA-E1-04-06` | as AC-02 | Frozen wire name `canvasConfiguration` passes at `packages/channel-kernel/src/legacy-wire.ts` (exit `0`, `0` hits) and fails at `services/cogniate-app/src/app/connections.ts`, `packages/channel-kernel/src/registry.ts` and `apps/portal/src/api.ts` (exit `1`, banned `"canvas"`). `k0-vitest.log` |
| AC-LA-E1-04-07 | PASS (K0) | `fitness.k0.test.ts > AC-LA-E1-04-07` | `npm run --silent fitness:channel-diff -- --channel canvas --paths-from <file>` | Core path `services/cogniate-app/src/app/connections.ts` → class `core`, exit `1`; another channel path `packages/channels/moodle/manifest.ts` → class `core`, exit `1`; list with `packages/channels/canvas/manifest.ts` (`channel:canvas`), `tests/sim/canvas/provider.mjs` (`sim`), `tests/acceptance/M1/common/00-profiles.test.ts` (`tests`) and `docs/architecture/ltiaas/README.md` (`docs`) → `F2 PASS: core = 0, paths = 4`, exit `0`. `k0/e1-04-ac07-f2.log` |
| AC-LA-E1-04-08 | PASS (K0) | `fitness.k0.test.ts > AC-LA-E1-04-08` | `npm run --silent fitness:channel-diff -- --base <head> --channel canvas` | On scratch branch `zz-qa-f2-rename` moving `services/cogniate-app/src/app/connections.ts` to `packages/channels/canvas/zz-qa-moved.ts`, F2 uses `--no-renames`, classes `services/cogniate-app/src/app/connections.ts` as `core`, and exits `1`; branch deleted after probe. `k0/e1-04-ac08-rename.log` |
| AC-LA-E1-04-09 | PASS (K0) | `fitness.k0.test.ts > AC-LA-E1-04-09` | `npm run --silent fitness:rules -- --stdin --as <path>` | `INSERT OR REPLACE INTO connection (id) VALUES ('1');` at new migration path `services/cogniate-app/src/domain/migrations/999_zz_qa_probe.sql` exits `1` and names `sql-portability` (`INSERT OR REPLACE/IGNORE/ABORT/FAIL/ROLLBACK` and `REPLACE INTO`); the same SQL at applied migration path `services/cogniate-app/src/domain/migrations/001_init.sql` exits `0`. `k0/e1-04-ac09-f5.log` |
| AC-LA-E1-04-10 | PASS (K0) | `fitness.k0.test.ts > AC-LA-E1-04-10` | `npm run check` with scratch rule `infra/scripts/fitness/rules/zz-qa-probe.mjs` | Scratch rule file in `infra/scripts/fitness/rules/` is discovered automatically by `npm run check` with no edit of `rules.mjs`, and its hit (`services/cogniate-app/src/main.ts:1:1  zz-qa-probe  QA-3 probe hit`) fails `npm run check`; scratch rule removed. `k0/e1-04-check-probe-rule.log` |

## F1 baseline and SQL portability rule list

- **F1 baseline (`infra/scripts/fitness/f1-baseline.json` at `3fe6c13`):** `80` core files, `680` total hits (`apps/portal/src/App.tsx`: `13` hits after `BD-A1-15`).
- **SQL portability statement list (`infra/scripts/fitness/rules/sql-portability.mjs` `STATEMENTS`):**
  1. `PRAGMA` (`/\bPRAGMA\b/gi`)
  2. `INSERT OR REPLACE/IGNORE/ABORT/FAIL/ROLLBACK` (`/\bINSERT\s+OR\s+(?:REPLACE|IGNORE|ABORT|FAIL|ROLLBACK)\b/gi`)
  3. `UPDATE OR REPLACE/IGNORE/ABORT/FAIL/ROLLBACK` (`/\bUPDATE\s+OR\s+(?:REPLACE|IGNORE|ABORT|FAIL|ROLLBACK)\b/gi`)
  4. `REPLACE INTO` (`/\bREPLACE\s+INTO\b/gi`)
  5. `AUTOINCREMENT` (`/\bAUTOINCREMENT\b/gi`)
  6. `WITHOUT ROWID` (`/\bWITHOUT\s+ROWID\b/gi`)
  7. `STRICT table` (`/\)\s*(?:,\s*)?STRICT\b/gi`)
  8. `CREATE VIRTUAL TABLE` (`/\bCREATE\s+VIRTUAL\s+TABLE\b/gi`)
  9. `ATTACH/DETACH DATABASE` (`/\b(?:ATTACH|DETACH)(?:\s+DATABASE)?\b/gi`)

### R0 `npm run check` counts (`check.log`)

| Suite | Count at `3fe6c13` |
| --- | --- |
| Vitest (`test:unit`) | 93 files; 1,333 passed, 5 skipped |
| Infra (`test:infra`, `node --test`) | 213 pass, 0 fail (24 suites; includes `infra/scripts/fitness/fitness.test.mjs`: 29 pass, 0 fail across 4 suites in `infra-fitness-test.log`) |
| K0 (`test:k0`) | 2 files; 42 passed, 0 failed |
| F1 (`fitness:lms-names`) | `F1 PASS: 80 files with hits, 680 hits` |
| F5 (`fitness:rules`) | `F5 PASS: 2 rules (audit-event-delete, sql-portability), 0 hits` |

## Other checks

- **Test-first harness alignment (`tests/ltiaas/tasks-core/LA-E1-04/fitness.k0.test.ts`):** Added the `BD-A1-15` regular-expression literal probes (`/canvas/`, `/\bcanvas\b/i`, `/^(moodle|canvas)-/`, `/\.instructure\.com$/i`) to `AC-LA-E1-04-02`, enabled `AC-LA-E1-04-03 (lti-generic part)` unconditionally per `BD-A1-07`, and passed only `['--channel', 'canvas', '--paths-from', file]` in `AC-LA-E1-04-07` (`--base` and `--paths-from` are mutually exclusive input options in F2).
- **Clone cleanliness:** `git status --porcelain` in `~/cogniate-qa-runs/LA/LA-E1-04/r1/clone` is empty after the run (`status-after.txt`, 0 bytes).

## Regression and time

R0: `npm run check` on the clean clone (PASS). Measured time of `fitness.k0.test.ts`: `178.8s` (includes two full `npm run check` runs: clean tree and `AC-10` probe rule discovery).
