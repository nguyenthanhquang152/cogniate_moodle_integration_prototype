Verdict: APPROVE
Round: 1

# LA-E5-19 review, lens A ("Is it right and is it safe?")

Reviewer: Reviewer-A2 (Claude Code Opus 5.5 xhigh, plan LD-22). Date: 2026-10-22.
Spec: `docs/architecture/ltiaas/tasks/LA-E5-19.md`. Design: LA-ADR-06 D4 rule 2, D7, D11 (AP-06-32, AP-06-33); LA-ADR-03 D7 (runner); data model §3, §4; BD-A1-10 item 4; BD-A2-25 (the LA-E5-04 follow-up `bface04`).

Diff: `git diff a50e7af^1 a50e7af` (lane S1 commits `bface04` and `45049fd`; 12 files). AC-LA-E5-19-09 is pending LA-E3-02, as the dispatch says.

Method: a throwaway `git archive a50e7af` copy under `/private/tmp`, with a clone of the integration `node_modules`. I ran the LTI service unit tests (60 files, 768 passed) and 7 mutants in that copy only. I used no Docker and no network. I did not change the integration worktree, except for this file.

## Summary

| Id | Severity | Topic |
| --- | --- | --- |
| A-LA-E5-19-01 | MINOR | `audit-retention` runs only after 24 h of uptime with no restart. A service that restarts at least once a day never deletes expired audit rows. |
| A-LA-E5-19-02 | MINOR | No test proves that a late `endJobLease` from an old owner leaves a newer owner's lease alone (mutant survives) |
| A-LA-E5-19-03 | MINOR | The 3 s exit fallback is gone, but the container stop time (Docker default 10 s) is now shorter than the runner grace (60 s). Route to A2 and S1 (BD-A1-10 item 4). |

There is no BLOCKER and no MAJOR finding. The four lens-A points pass for the three Must jobs: no job deletes data it must keep, leases are owned per instance and boot, shutdown cannot cut a job mid-delete, and no audit event is lost (see "Checks that pass").

## Findings

### A-LA-E5-19-01 — MINOR — audit retention can never run on a service that restarts daily

- **File:** `services/lti-service/src/jobs/audit-retention.ts:18` (`everyMs: DAY_MS, runAtStart: false`).
- **Problem:** the runner starts interval timers at process start (`packages/shared/src/jobs.ts:369-370`: `setInterval(everyMs)`, plus one run when `runAtStart` is true). It does not use `job_lease.last_run_at` to catch up. With `runAtStart: false`, the first delete comes 24 h after each start. A deploy, `stack:restart` or crash at least once a day resets that timer. Then `audit_event` rows stay past `AUDIT_RETENTION_DAYS`. That breaks the D11 "daily" Must job and the LA-H4 retention promise, silently and with no `job_run` line. The other two jobs run at start (`retention`; `signing-key-cleanup`: "run at start, then daily").
- **Evidence:** `audit-retention.test.ts` pins `[DAY_MS, false]`. `main.test.ts` (AC-07) shows one `signing-key-cleanup` run and no `audit-retention` run in the first 25 minutes after a start.
- **Suggested fix:** `runAtStart: true`. The delete uses the `audit_event_ts` index and removes nothing on most days. Another option: skip the start run only when `last_run_at` is less than one day old. That needs a runner feature (R), so `runAtStart: true` is the simple fix.

### A-LA-E5-19-02 — MINOR — the lease owner check of `endJobLease` has no test

- **File:** `services/lti-service/src/jobs/index.ts:38-40` (`… WHERE name = ? AND owner = ?`).
- **Problem:** the code is right. But mutant J4 (`endJobLease` without the owner condition) passes all 83 job, store and main tests. The shared contract suite (`describeJobStoreContract`) covers "take a free or expired lease" and "skipped_lease". It does not cover this case: owner A's run outlives its lease, owner B takes the job, then A's late end clears B's lease and writes A's result. The JobStore contract says "No change when another owner has the lease" (`packages/shared/src/jobs.ts:165`). This is the cross-instance case of the lens focus.
- **Suggested fix:** one case in `jobs/index.test.ts` (this lane's file): A takes the lease, time passes the lease end, B takes it, A calls `endJobLease`, and the row still shows B's owner and `lease_until`. Ask R to add the same case to the shared suite, so that the app store gets it too.

### A-LA-E5-19-03 — MINOR — the exit bound now comes from Docker, not from the runner grace

- **Files:** `services/lti-service/src/main.ts:75-78` (the 3 s `process.exit` timer is removed); `infra/compose.yaml` (no `stop_grace_period`, so Docker's default 10 s applies).
- **Problem:** BD-A1-10 item 4 flagged "the LTI service exit fallback (3 s) against the runner grace" for A2 and S1, and I find no ratification. The new shutdown is right inside the process: it waits for `jobs.stop()`, which is at most the longest lease (60 s), then the listeners, then the database. But `docker stop` and `stack:restart` send SIGKILL after 10 s. So a run in flight longer than 10 s is killed. For the three Must jobs, this is safe: each is synchronous SQLite work, and a kill rolls back. The cost is a stale `job_instance` row and lease, so the next start waits up to 30 s for the heartbeat and up to 60 s for the lease. For the async `key-rewrap` (LA-E5-09), a stop in the middle of a run becomes a hard kill. Outside Docker (a local run) there is now no upper bound if a close step hangs.
- **Suggested fix:** A2 and S1 record the ruling. One option: set `stop_grace_period` for `lti-service` to at least `JOB_LEASE_MS` plus a margin (for example 70 s), and keep a last-resort exit timer just above the runner grace. Another option: record that a 10 s kill is accepted until LA-E5-09.

## Checks that pass

| Item | Result |
| --- | --- |
| Audit retention bounds (lens focus) | `ts` is epoch ms (`007_audit_event.sql`), and the cutoff is `now - days × DAY_MS` in ms. The delete is strictly older (`ts < cutoff`). `AUDIT_RETENTION_DAYS` defaults to 400. A value that is not a whole number ≥ 1, or whose ms value is not a safe integer, stops the start (`''`, `0`, `-1`, `1.5`, `Infinity`, `days`, an 18-digit value), so a bad setting never shortens retention. Only this module deletes from `audit_event`. The test proves the boundary row (age exactly 7 days) stays, an unrelated table stays, and the append-only trigger still refuses `UPDATE`. Mutants J1 (`<=`) and J2 (default 40) are killed. |
| Signing-key states (lens focus) | The registered S2 module changes only `retired` keys with `retired_at` at least 30 days old to `removed`, and zeroes the private part of `removed` keys. It never touches `next` or `active` keys. No design audit action covers job-driven removals (contract delta §5 lists operator actions only), so no audit event is missing. |
| Retention parity | The job calls the same `cleanupExpired` (the 3 tables `oidc_state`, `launch`, `registration_session`). It writes one `retention_cleanup` line per table with deleted rows, with the run's trace id, and none for zero. It runs at start, then every 10 minutes: AC-07 shows 3 runs in 25 minutes, each with its own trace id. |
| Lease and instance ownership (lens focus) | Both tables equal data model §3 exactly. `takeJobLease` is one conditional upsert (free or expired lease only). `claimInstance` takes a row only when its heartbeat is stale. `heartbeat` and `removeInstance` match on the boot id. The shared store-contract suite passes on the LTI schema with separate connections. Mutants J3 (no expiry check), J5 (no staleness check) and J7 (heartbeat ignores the boot id) are killed. Gap: A-LA-E5-19-02. |
| Shutdown and no lost audit event (lens focus) | `close()` awaits `jobs.stop()` (it drains runs in flight up to the longest lease), then closes both listeners (Fastify waits for requests in flight, so their audit inserts commit), then the database. The `main.test.ts` drain case holds a job past 3 s, sees the instance row still present, and then sees a clean restart with no wait or conflict line. Mutant J6 (database closed before the drain) is killed. `close()` can run only once. |
| Migration | `013_job_runner.sql` adds the two tables only. The upgrade test keeps `tool_account` and `api_key` rows byte-equal, checks the column lists, the default `role` and its CHECK (AC-05). |
| LA-E5-04 follow-up (`bface04`, BD-A2-25) | Bootstrap without `--name` writes no name on an existing account. The test uses a trigger that refuses any name `UPDATE`. A new account still gets its id as the name. |
| Ownership and "Must not edit" | `packages/shared/src/jobs.ts`, `packages/shared/src/retention.ts`, `store/tool-keys.ts`, `jobs/signing-key-cleanup.ts` and `store/storage-checks.ts` are untouched. `cli/bootstrap.ts` and `store/accounts.ts` are S1 files of the LA-E5-04 follow-up. The migration number is the Lead's (RQ-5). |
