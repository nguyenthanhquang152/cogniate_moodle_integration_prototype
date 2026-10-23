Verdict: PASS (AC-LA-E1-12-02 K0 verified; AC-01, AC-03..05 pending lane P portal part)
Round: 1

# LA-E1-12 S9 F1 ratchet at zero, F2 on, canary check: QA verification (AC-02)

Tester: QA-3 (Orca task `task_ca544d19e96b`, dispatch `ctx_fce3d399cb78`), 2026-10-23. Spec: `docs/architecture/ltiaas/tasks/LA-E1-12.md` (with `docs/architecture/ltiaas/README.md` §4 and `BD-A1-63`..`-65`). Suite: `tests/ltiaas/tasks-core/LA-E1-12/` (QA-3 test-first).

Independence: QA-3 did not read product source (`services/**`, `packages/**`, `apps/**`), Author notes or reviewer files (aligned `AC-LA-E1-12-02` to `classes.coreExceptions.globs` from `docs/architecture/ltiaas/README.md` §4 and `infra/scripts/fitness/common.mjs`). QA-3 verified `AC-LA-E1-12-02` in an isolated `--no-hardlinks` clone of `894406f`.

| Item | Value |
| --- | --- |
| SHA | `894406f365148378d7089de8c56e619a1dbfe18a` (integration `894406f`; holds `LA-E1-12` lane K part `3979743`; lane P portal part `BD-A1-63..65` still open) |
| Lane and slot | lane K (and P); no Docker (`LA-E1-12` is K0-only) |
| Clone | `~/cogniate-qa-runs/LA/LA-E1-12/r1/clone`: `git clone --no-hardlinks --no-checkout`, detached at `894406f365148378d7089de8c56e619a1dbfe18a`, push URL `DISABLED`, `npm ci` at root |
| Environment | macOS arm64, Node 24.21.0, npm 11.19.0 |
| Artifacts | private run folder `~/cogniate-qa-runs/LA/LA-E1-12/r1/` (umask 077): `npm-ci.log`, `k0-vitest.log`, `k0/e1-12-check-clean.log`, `k0/e1-12-ac02-fitness-scope.json`, `status-after.txt` |

## Acceptance criteria

| AC | Result | Test id | Command | Evidence |
| --- | --- | --- | --- | --- |
| AC-LA-E1-12-01 | pending: lane P portal part (`BD-A1-63..65`) | `e1-done.k0.test.ts > AC-LA-E1-12-01` | — | Lane K's core files (`operator.ts`, `binding-cleanup.ts`, `binding-targets.ts`, `redemption.ts`) are at `0` in `f1-baseline.json` (`3979743`); 5 portal files (13 hits) await lane P (`BD-A1-63..65`). |
| AC-LA-E1-12-02 | PASS (K0) | `e1-done.k0.test.ts > AC-LA-E1-12-02: packages/channel-kernel/fitness-scope.json exception list has only legacy-wire.ts and the applied migrations` | `LA_LEVEL=k0 LA_SCRATCH_CLONE=$PWD LA_RUN_DIR=~/cogniate-qa-runs/LA/LA-E1-12/r1/k0 npx --no-install vitest run --config tests/ltiaas/tasks-core/LA-E1-12/vitest.config.mts --reporter=verbose -t "AC-LA-E1-12-02"` | `packages/channel-kernel/fitness-scope.json` `classes.coreExceptions.globs` (the `LA-E1-04` format read by `infra/scripts/fitness/common.mjs`) lists only the 3 allowed D10 entries (`"packages/channel-kernel/src/legacy-wire.ts"`, `"services/cogniate-app/src/domain/migrations/*.sql"`, `"services/lti-service/src/db/migrations/*.sql"`), with `packages/shared/src/config.ts` absent. `k0/e1-12-ac02-fitness-scope.json` |
| AC-LA-E1-12-03 | pending: lane P portal part (E1 close) | `e1-done.k0.test.ts > AC-LA-E1-12-03` | — | Runs when `LA-E1-12` closes after lane P lands. |
| AC-LA-E1-12-04 | pending: lane P portal part (E1 close) | `e1-done.k0.test.ts > AC-LA-E1-12-04` | — | Runs when `LA-E1-12` closes after lane P lands. |
| AC-LA-E1-12-05 | pending: lane P portal part (E1 close) | `e1-done.k0.test.ts > AC-LA-E1-12-05` | — | Runs when `LA-E1-12` closes after lane P lands. |

### R0 `npm run check` counts at `894406f` (`k0/e1-12-check-clean.log`)

| Suite | Count at `894406f` |
| --- | --- |
| Vitest (`test:unit`) | 174 files; 2,803 passed, 5 skipped |
| Infra (`test:infra`, `node --test`) | 254 pass, 0 fail |
| K0 (`test:k0`) | 3 files; 121 passed |
| F1 (`fitness:lms-names`) | `F1 PASS: 5 files with hits, 13 hits` |
| F5 (`fitness:rules`) | `F5 PASS: 6 rules (audit-event-delete, channel-sql-tables, connection-lms, no-score-sync, protocol-urls, sql-portability), 0 hits` |

## Other checks

- **QA test update (`AC-LA-E1-12-02`):** Aligned `tests/ltiaas/tasks-core/LA-E1-12/e1-done.k0.test.ts` (`AC-LA-E1-12-02`) to read `scope.classes.coreExceptions.globs` (per `docs/architecture/ltiaas/README.md` §4 and `infra/scripts/fitness/common.mjs`).
- **Clone cleanliness:** `git status --porcelain` in `~/cogniate-qa-runs/LA/LA-E1-12/r1/clone` is empty after the run (`status-after.txt`, 0 bytes).
- **Measured time:** `e1-done.k0.test.ts -t "AC-LA-E1-12-02"` `98.28s` (`AC-02` `1ms`, `npm run check` in `beforeAll` `98.2s`).
