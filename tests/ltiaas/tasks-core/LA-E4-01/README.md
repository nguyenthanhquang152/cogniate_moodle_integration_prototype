# LA-E4-01 job runner: QA-3 notes

Spec: `docs/architecture/ltiaas/tasks/LA-E4-01.md`. All twelve ACs (AC-LA-E4-01-01 to -12, with AC-11 and AC-12 added by BD-A1-10) have the label UNIT: Author unit tests with a temporary SQLite store and a controlled clock (plan LD-5; tasks README §5). Reviewer-B checks their quality. The spec has no K0 or K1-SIM AC, so QA-3 writes no test file for this task. Docker-level proof comes with LA-E4-02 and LA-E4-03.

At the run (no Docker), QA-3 records:

1. R0: `npm ci` and `npm run check` in a fresh clone of the task SHA (`git clone --no-hardlinks`, private run folder, umask 077). The counts go next to the LA-E0-01 numbers.
2. UNIT rows: in that clone, `npx vitest run --reporter=verbose -t "AC-LA-E4-01-"`. qa.md lists, for each AC id, the passing test names that cite it. If no test name cites an AC id, qa.md says so, and Reviewer-B maps the test.
3. AC-LA-E4-01-09 is Could. If it is not built, qa.md records it as "not built (Could)".
