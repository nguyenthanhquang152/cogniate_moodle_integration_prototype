Verdict: APPROVE
Round: 1

# LA-E5-20 review, Reviewer-B

## Round 1

Reviewer-B: Codex GPT-6-Astra xhigh. Lens: "Can a human team own it?" Reviewed `95036a9`, `14287ee`, `ce47f03`, `805b897` and `ca75c68` in merge `2a15f5b`, against the task spec, LA-ADR-06 D2/D7/D11, contract delta §3/§5 and BD-A2-65 to -70. Verification used a private `git clone --no-hardlinks` pinned to integration commit `d8cb6af`. No other reviewer's report was read; no Docker or stack was run.

Counts: **0 BLOCKER, 0 MAJOR, 1 MINOR, 0 NIT.**

The four new job modules have clear names, small entry points and controlled-clock tests. The single runner registry supplies both scheduling and the operator list. Operators can correlate the accepted request, `job_run` and job audit events by trace id; counts distinguish expiry warnings, deleted records, key changes and purged accounts. The purge names all ten tables, deletes child rows first and writes the table counts and audit event in the same transaction. It keeps the account tombstone and earlier audit events, and a repeat writes no second purge event. Using `[{table, rows}]` keeps key-table counts visible through the existing redactor.

### B-LA-E5-20-01 — MINOR — The operator runbook lacks a general on-demand job procedure

- **File:** `docs/architecture/ltiaas/operability.md:207`, with the new route at `services/lti-service/src/http/operator/jobs.ts:19`.
- **Problem:** `JobStale` tells the operator only to read log lines. The procedures cover the dedicated key re-wrap route, but do not show how to list jobs, run one through the new endpoint, or find the result of an accepted run. A new operator must assemble these steps from the ADR and API contract. This is a handover gap, safe to defer.
- **Evidence:** LA-ADR-06 D11 at `docs/architecture/ltiaas/adr/LA-ADR-06-service-operability.md:406` documents `202`, `409`, `404` and `503`; neither `operability.md` nor `docs/guides/operator.md` contains `/operator/v1/jobs`. The API returns before completion: the `job.run` event records acceptance, while the later `job_run` line records the outcome and counts.
- **Suggested fix:** A2/Docs should add a short procedure and link it from `JobStale`: list jobs, POST a selected name, save `traceId`, find the matching `job_run` result/counts, and handle `failed` or `skipped_lease` before retrying. Explain the `409` wait and `503` Retry-After response; for purge, link the `account.purge` event and retained tombstone/audit rules. The existing master-key procedure is a useful pattern.

### Verification and scope

- **91 LTI service test files, 1,145 tests passed.** Root type checking, ESLint on the affected service areas and F5 passed (six rules, zero hits). All checks ran in the private clone without a stack.
- Every UNIT acceptance point has an effective regression test. AC-03 holds a real job lease and checks `409`, one refused event and no run. AC-04 distinguishes 13 from 15 days. AC-05 checks day 83/day 90, manual and suspended accounts, and a late publication that must wait for its lead time. AC-06 checks all ten purge tables at 31 versus 29 days, retained audit/tombstone rows, repeat behavior and the 24-hour cleanup boundary.
- In the clone, five deliberate regressions (skip the held-lease refusal, shorten the warning window, delay next-key creation, delay purge and change the cleanup boundary) made all five corresponding acceptance tests fail, plus the rotation-limit test: **six failures**. All source changes were restored.
- Operator unit tests also cover every registered job, ISO/null last-run values, correlated `202` acceptance, unknown names and inactive/missing runners. `autoRotate` defaults to false on migrated and new accounts, persists through unrelated PATCHes and has typed validation plus an audited change; closed accounts refuse changes. Environment tests cover defaults, lower bounds and invalid values for rotation, publish lead and closed-account retention. The defaults and limits are in the operability environment table.
- The changes stay in S1's job and operator area. BD-A2-65 explicitly authorizes the account field, PATCH and migration `019`, resolving the task's earlier `store/accounts.ts` exclusion. `store/tool-keys.ts`, `store/api-keys.ts` and `packages/shared/src/jobs.ts` are unchanged by these commits. No LMS-specific branch or name was added. The older migration tests still compare every pre-existing column; the added default is checked separately.
- K1-SIM AC-01/02 and R0/T2a remain QA evidence; unit injection is not a claim that those gates ran.
