Verdict: PASS
Round: 1

# LA-E1-01 Open the closed provider enum: QA verification

Tester: QA-3 (Orca task `task_0e4b7c2f8dd6`, dispatch `ctx_e52d6a0e1adb`), 2026-10-22. Spec: `docs/architecture/ltiaas/tasks/LA-E1-01.md`. Suite: `tests/ltiaas/tasks-core/LA-E1-01/` (QA-3 test-first, committed in `ef7d2ab`).

Independence: QA-3 did not read product source, Author notes or reviewer files. QA-3 found the Author's unit tests by name through the Vitest reporter. It read only the file list of the product merge.

| Item | Value |
| --- | --- |
| SHA | `3d20c71f34241aa3b5ebb7babf2561078cd69a56` (integration; holds the LA-E1-01 product merge `20648c2` and QA-3's suite) |
| Lane and slot | lane K; no Docker (the other run has exclusive Docker) |
| Clones | `~/cogniate-qa-runs/LA/LA-E1-01/r1/runner` (test runner, `npm ci --prefix tests`); `r1/k0/clone` (made by the test). Both: `git clone --no-hardlinks`, detached at the SHA, push URL disabled |
| Environment | macOS arm64, Node 24.21.0, npm 11.19.0 |
| Artifacts | private run folder `~/cogniate-qa-runs/LA/LA-E1-01/r1/` (umask 077): `k0-vitest.log`, `k0/npm-ci.log`, `k0/check.log`, `k0/counts.json`, `unit-rows-by-id.log`, `e1-01-merge-files.txt` |

## Acceptance criteria

| AC | Result | Test id | Command | Evidence |
| --- | --- | --- | --- | --- |
| AC-LA-E1-01-01 | PASS (UNIT) | Author test `services/cogniate-app/src/clients/lti-client.test.ts > AC-LA-E1-01-01: a providers answer with an unknown lms value parses; today's answer parses to the same objects` | `npx vitest run --reporter=verbose -t "AC-LA-E1-01-0"` in `r1/k0/clone` | The test passes. Reviewer-B checks its quality. `unit-rows-by-id.log` |
| AC-LA-E1-01-02 | PASS (UNIT) | Author test `services/cogniate-app/src/app/connections.test.ts > AC-LA-E1-01-02: with one unknown profile, the three baseline entries keep their values and order; the app logs it once` | as AC-01 | The test passes. `unit-rows-by-id.log` |
| AC-LA-E1-01-03 | pending: LA-E0-03 (golden tool) and a Docker window | `golden-g1.k1sim.test.ts` | — | The binding fails on purpose until LA-E0-03 publishes its CLI. |
| AC-LA-E1-01-04 | Check part: PASS. F1 part: pending LA-E1-04 | `check.k0.test.ts` (`it.todo` for the F1 part) | `LA_LEVEL=k0 LA_TASK_SHA=3d20c71… LA_RUN_DIR=r1/k0 npx vitest run --config ltiaas/tasks-core/LA-E1-01/vitest.config.mts` (from `r1/runner/tests`) | `npm ci` and `npm run check` exit 0. Counts below. `k0/counts.json`, `k0/check.log` |

### AC-04 counts

| Count | LA-E0-01 (`1b17261`) | `3d20c71` |
| --- | --- | --- |
| Vitest | 70 files; 1,123 passed, 5 skipped | 79 files; 1,188 passed, 5 skipped |
| Infra (`node --test`) | 111 pass, 0 fail | 111 pass, 0 fail |
| `npm run check` time | 78 s | 78 s |

Cause of the difference: `3d20c71` also holds other lane merges after the intake (the git log shows LA-E5-08 and LA-E5-01), and the two new LA-E1-01 tests. QA-3 did not split the count per merge. This is not a failure (LA-E0-01 AC-03 rule). The 5 skipped tests are the same course-fixture tests. `git status --short` in the clone is empty after the run.

## Other checks

- The LA-E1-01 product merge `20648c2` (first parent `f77eaf9`) changes only the three files that the spec allows and their unit tests: `app/connections.ts`, `clients/lti-client.ts`, `providers/index.ts`, `app/connections.test.ts` (new) and `clients/lti-client.test.ts` (`e1-01-merge-files.txt`).

## Regression and time

R0: the AC-04 run (PASS). The golden compare of the step (LA-ADR-04 D6) is pending with AC-03. Measured time of the new suite: `check.k0.test.ts` 81 s (82 s for the whole Vitest run).
