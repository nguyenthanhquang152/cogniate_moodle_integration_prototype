Verdict: APPROVE
Round: 4

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

## Round 2

- Reviewer: Reviewer-A2 (same session as round 1). Date: 2026-10-22.
- Diff: `git diff c96c837^1 c96c837` (lane S1 commits `d6886db`, `e2d36c2`, `7ee383f`, `7600b8d`, `d13dcc0`; 9 files). Rulings: A2 BD-A2-31 (stop order) and BD-A2-32 (start run).
- I ran on the host (no Docker), in a throwaway `git archive c96c837` copy: the job and `main.test.ts` tests give 5 files and 26 passed. I also ran 5 mutants, one per fix.
- Blind review: I did not open the other reviewer's file.
- **Round 2 counts: 0 open findings. All three round-1 MINORs are closed.**

| Id | Round 1 | Round 2 result |
| --- | --- | --- |
| A-LA-E5-19-01 | MINOR | **Closed (BD-A2-32).** `audit-retention` has `runAtStart: true`, so every start runs it once, then daily. A restart can no longer skip it. The retention days are read once, at runner construction (the job takes `days` as a required argument). Mutant T1 (`runAtStart: false`) fails 2 tests. |
| A-LA-E5-19-02 | MINOR | **Closed.** A new store test uses two connections to one file: owner A takes the lease, owner B takes it after A's lease ends, then A's late `endJobLease` leaves B's owner, `lease_until` and empty result unchanged, and B's own end records its result. My round-1 mutant (no owner condition in `endJobLease`), now T2, fails this test. |
| A-LA-E5-19-03 | MINOR | **Closed (BD-A2-31).** The order is fixed: runner grace (60 s, `JOB_LEASE_MS`) < service exit fallback (`SERVICE_EXIT_AFTER_MS` = `JOB_LEASE_MS` + 10 s = 70 s) < container `stop_grace_period: 75s` (on `lti-service` and `cogniate-app`). `createShutdownHandler` runs once per process. The clean path clears the timer and exits 0. A rejected close exits 1. The fallback logs `service_exit_forced {after_ms}` and exits 1. Mutants T3 (the fallback exits 0) and T4 (a 3 s fallback) are each killed. |

Also in this diff:
- `7ee383f` adds `cleanupStorageChecks` to the `retention` job (one more `retention_cleanup` table, 10-minute rule). This closes AC-LA-E5-19-09 and my LA-E3-02 MINOR A-LA-E3-02-01. Mutant T5 (no call) fails 2 tests.
- `infra/compose.yaml` passes `AUDIT_RETENTION_DAYS` (default 400) and `JOB_INSTANCE_ID` (default `lti-1`), and `.env.example` documents them as comments only. They are not secrets.
- Note (no finding): `SERVICE_EXIT_AFTER_MS` uses the default lease. A future job with a longer `leaseMs` would make the runner grace longer than 70 s. The job that adds it should raise both values, following the BD-A2-31 order.


## Round 3 — WE-F4 shutdown fix

Reviewer: Codex GPT-6-Astra xhigh, 2026-10-24. Diff: `93ab0c50^1..93ab0c50` (S1 `d219ce40`), against BD-A2-109, LA-ADR-06 D11 and operability §3. **CHANGES_REQUESTED: 1 new MAJOR; no new BLOCKER, MINOR or NIT.** Prior closed findings remain closed.

### A-LA-E5-19-04 — MAJOR — Listener-close errors are discarded, so shutdown reports success

- **File:** `services/lti-service/src/main.ts:103`, also `:105`.
- **Problem:** `Promise.allSettled` waits for the runner and both listeners, but destructuring keeps only the runner result. A rejected public or operator close is ignored. `close()` resolves and `createShutdownHandler` exits 0, contrary to the required failed-step exit 1.
- **Evidence:** A private test started the real service on ephemeral local ports, wrapped the operator listener close to await its real close and then reject with `operator close failed`, and asserted that service close rejected. It instead resolved `undefined`; the database was closed. Existing failure-exit coverage supplies a rejected service-level `close`, so it cannot detect this swallowed listener error. The previous implementation also discarded listener errors; this review flags it because failure exit is an explicit requirement of the dispatched shutdown fix.
- **Suggested fix:** Keep all settled results; after database cleanup, propagate a rejected result from any listener or the runner. Add listener-failure coverage through service close (and its exit handler). A private control with that change passed the probe and the focused suite.

### Checks and limits

- The normal path starts both listener closes and runner stop in the same turn, closes idle connections, cuts a held request at 3,000 ms, waits for the running job, and closes the database afterward. The close promise remains idempotent. The original job-drain check stays green, as do the unchanged 70 s fallback and failure-exit tests; the runner's 60 s grace and both 75 s compose settings are unchanged.
- **48/48 existing focused tests passed** across LTI main, app shutdown and shared jobs. Both new LTI cases (a) and (b) failed with the old runner-first/no-HTTP-cut order restored privately; all four new app/LTI cases failed under those mutations. Two additional error-path probes exposed one defect per service. Private controls passed **50/50** checks, including these probes. These controls were removed, not submitted as product edits.
- The HTTP cut intentionally leaves pending handler code alive only while the runner drains, as BD-A2-109 states. Normal final exit follows database close immediately. No transaction, conditional binding write, lease or compensation rule changes; ADR-011 still covers late remote writes and dead handlers. No new request is accepted after the listeners stop. The changed files are S1's main wiring and its colocated tests, with no core LMS name or other behavior change.
- The fresh private clone `/tmp/la-reviewer-a-ctx-63e08b92dff0` was at `9f8e990a`, used its own `npm ci` and had its Vitest cache cleared before every run; its tracked tree is restored clean. Evidence: `/tmp/la-reviewer-a-ctx-63e08b92dff0-focused.log` and `/tmp/la-reviewer-a-ctx-63e08b92dff0-probes/` (probe sources, `error-paths.log`, `controls.log`, `old-order-mutants.log`). No Docker, stack, host stack runner, commit or Reviewer-B file was used. QA's restart timing and seven frozen M1-37 rows remain for the re-gate.


## Round 4 — WE-F4 error-path fix

Reviewer: Codex GPT-6-Astra xhigh, 2026-10-24. Diff: `8fadb828^1..8fadb828` (S1 `a2c99731`), against BD-A2-109 and the Round 3 finding. **APPROVE: 0 new or open findings. A-LA-E5-19-04 is closed; prior findings remain closed.**

- **Finding 04 closed:** `main.ts:103`–`:107` retains every settled result. It still waits for both listeners and the runner, closes the database, then propagates any failed result. A public or operator listener error now rejects the cached close promise and produces exit 1.
- The new parameterized test passes for both listeners, checks that the database closes last, and checks exit 1 through the real shutdown handler. My prior private operator-close rejection probe also passes. Restoring the prior faulty implementation makes all three checks fail: the two exit checks observe 0, and the private probe observes a resolved promise.
- **53/53 focused checks passed** across LTI main, app shutdown and shared jobs: 51 committed tests plus the two repeated private probes. All five relevant checks fail with the prior faulty implementations restored. Normal idle/busy shutdown, HTTP cutoff, runner drain, idempotence and the fallback remain covered. No change to the 3/60/70/75 s bounds, transaction or lease/ref rules. The diff stays within S1 main wiring and its colocated tests, with no unrelated behavior or core LMS name added.
- Verification: fresh `git clone --no-hardlinks` at `9b918a7e`, own `npm ci`, cache cleared before each run; `/tmp/la-reviewer-a-ctx-d2660307debb` is restored clean. Evidence: `/tmp/la-reviewer-a-ctx-d2660307debb-probes/focused-and-probes.log`, `prior-error-mutants.log` and saved probe sources. No Docker, stack, host stack runner, commit or Reviewer-B file was used. QA's restart timing and seven frozen M1-37 rows remain for the re-gate.
