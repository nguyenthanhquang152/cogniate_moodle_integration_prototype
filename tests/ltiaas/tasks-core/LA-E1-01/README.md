# LA-E1-01 open the closed provider enum: QA-3 acceptance tests

Spec: `docs/architecture/ltiaas/tasks/LA-E1-01.md`. Contract: `docs/architecture/ltiaas/contracts/cogniate-app-api-delta.md` §2. QA-3 wrote the tests from these files and TEST-STRATEGY §4.6 only (test-first).

| AC | Label | Test | Status |
| --- | --- | --- | --- |
| AC-LA-E1-01-01 | UNIT | Author unit test | QA records the Author's run (below). Reviewer-B checks the test quality. |
| AC-LA-E1-01-02 | UNIT | Author unit test | As AC-01 |
| AC-LA-E1-01-03 | K1-SIM | `golden-g1.k1sim.test.ts` | Binding to the LA-E0-03 golden tool. It fails on purpose until the `BINDING` object is set (Lead answer "A", 2026-10-22). |
| AC-LA-E1-01-04 | K0 | `check.k0.test.ts` | Check part: ready. F1 part: `it.todo`, pending LA-E1-04. |

## AC-04 (K0, no Docker)

```sh
# from tests/, after npm ci there
LA_LEVEL=k0 LA_TASK_SHA=<task SHA> LA_RUN_DIR=<new private folder outside the repo> \
  npx vitest run --config ltiaas/tasks-core/LA-E1-01/vitest.config.mts
```

The test clones the SHA, runs `npm ci` and `npm run check`, and writes `npm-ci.log`, `check.log` and `counts.json` (Vitest and infra counts, for qa.md next to the LA-E0-01 numbers). F1 part, when LA-E1-04 lands: run the check-one-text mode (`npm run fitness:lms-names -- --stdin --as <path>`) on each changed file at G-BASE and at the task SHA. The task-SHA count must not be higher (the method is in the `it.todo` comment).

## AC-03 (K1-SIM)

1. Booked SIM slot only (no Docker before the Lead grants a window). Project `qa3-la-sim-r<n>`, `PUBLIC_PORT` 9443, `STACK_SUBNET` 172.20.0.0/16 (TEST-STRATEGY §5.2). Run the LA-E0-03 capture at the task SHA, then stop the stack.
2. No Docker: `LA_LEVEL=k1sim LA_GOLDEN_CAPTURE=<capture folder> LA_GOLDEN_BASELINE=tests/ltiaas/golden/<baseline-sha> LA_RUN_DIR=<private folder> npx vitest run --config ltiaas/tasks-core/LA-E1-01/vitest.config.mts`.

The test needs both captures to hold the lms-providers document and the connection DTOs. It applies no `LA-IC` expected-delta file, and it fails on any differing field in these documents. It writes the other G1–G4 differences to `golden-diff-paths.json` for the regression row (R0 plus the golden compare, LA-ADR-04 D6).

## UNIT rows (AC-01, AC-02)

In the clone of the task SHA: `npx vitest run --reporter=verbose -t "AC-LA-E1-01-0[12]"`. qa.md records the test names that cite each AC id. If no test name cites the id, qa.md says so, and Reviewer-B maps the test.
