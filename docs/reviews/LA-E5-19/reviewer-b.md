Verdict: APPROVE
Round: 4

# LA-E5-19 review, Reviewer-B (lens: "Can a human team own it?")

## Round 2 (Reviewer-B2)

Reviewer: Reviewer-B2, the second lens-B instance (plan LD-22), on this lens's file. This is a bounded check of the round-1 findings, with A2's BD-A2-31 (stop order) and BD-A2-32 (every interval job runs at start). Diff: `git diff c96c837^1 c96c837` (lane S1 commits `d6886db`, `e2d36c2`, `7ee383f`, `7600b8d`, `d13dcc0`). I did not open the other reviewer's file. I did not run Docker.

Counts (this round): **0 BLOCKER, 0 MAJOR, 0 MINOR, 1 new NIT.** Every round-1 finding is **closed**.

How I checked: a scratch clone of `c96c837` (private `/tmp` folder, deleted after the run). `vitest run services/lti-service/src/jobs services/lti-service/src/main.test.ts`: **5 files, 26 tests passed**.

### Round-1 findings

| Finding | Status |
| --- | --- |
| B-LA-E5-19-01 (MINOR) | **Closed** (BD-A2-32). `audit-retention` has `runAtStart: true`, and a test pins exactly one `job_run {job: "audit-retention"}` at start. |
| B-LA-E5-19-02 (MINOR) | **Closed** (BD-A2-31). The stop order is now written in three places: the runner grace is the longest lease (60 s); `SERVICE_EXIT_AFTER_MS = JOB_LEASE_MS + 10_000` (70 s) in `main.ts`, with `service_exit_forced {after_ms}` and exit 1; `stop_grace_period: 75s` on `lti-service` and `cogniate-app` in `infra/compose.yaml`. Each place has a comment that names BD-A2-31. The handler is now an exported, testable function, `createShutdownHandler`. Tests cover the 70 s fallback, a clean exit 0 after the grace, and exit 1 when `close` rejects. `service_stopping {signal}` marks the start of the drain. |
| B-LA-E5-19-03 (NIT) | **Closed.** `AUDIT_RETENTION_DAYS` and `JOB_INSTANCE_ID` are in the `lti-service` environment of `infra/compose.yaml` with their defaults, and in `.env.example` with a one-line meaning each. |
| B-LA-E5-19-04 (NIT) | **Closed.** `auditRetentionJob(db, days)` takes `days` as a required argument; the second `process.env` read is gone. |

Also in this round, and clear: the shared `retention` job now also calls `cleanupStorageChecks` (the RQ line for LA-E3-02), so `storage_check` rows get the same `retention_cleanup {table, deleted}` line. A new test proves that a late end from an expired lease owner does not touch the newer lease or its result.

### New in this round

#### B-LA-E5-19-05 — NIT — The three stop numbers are tied only by comments, and the 70 s fallback assumes no job has a longer lease

- **File:** `services/lti-service/src/main.ts` (`SERVICE_EXIT_AFTER_MS = JOB_LEASE_MS + 10_000`); `infra/compose.yaml` (`stop_grace_period: 75s` twice).
- **Problem:** BD-A2-31 needs runner grace < service fallback < container grace. The runner grace is the **longest** lease of the added jobs, but the fallback is computed from the default `JOB_LEASE_MS`. Today no LTI job sets `leaseMs`, so the order holds. A later job with a longer lease (for example a key re-wrap job; BD-A2-36 keeps its batches short, but its lease may grow) would let the 70 s timer cut the drain, and nothing would fail. The compose literal `75s` must also be changed by hand with the code constant.
- **Suggested fix:** Compute the fallback from the runner (the longest lease of the added jobs, plus 10 s), or refuse at start a job whose `leaseMs` is above `JOB_LEASE_MS`. Add one `infra/scripts/*.test.mjs` row that reads `compose.yaml` and checks that `stop_grace_period` is at least the fallback plus 5 s.

## Round 1

Diff: `git diff a50e7af^1 a50e7af` (lane S1 commit `45049fd`, plus the LA-E5-04 follow-up `bface04`, merged as `a50e7af`). Spec: `docs/architecture/ltiaas/tasks/LA-E5-19.md`. Design: LA-ADR-06 D11 (Must rows, AP-06-32, AP-06-33), D4 rule 2, LA-ADR-03 D7, operability §2. I did not open the other reviewer's file. I did not run Docker.

Counts: **0 BLOCKER, 0 MAJOR, 2 MINOR, 2 NIT.**

The wiring is small and easy to follow. `jobs/index.ts` holds the LTI job store (seven one-statement methods) and the one job list. Each job is a short module, and `main.ts` now starts and drains one runner instead of a timer. An operator sees each run as one `job_run` line with counts. `retention_cleanup` keeps its per-table lines, and a bad `AUDIT_RETENTION_DAYS` stops the start with a clear message. The tests use the shared store-contract suite through the new `@cogniate/shared/jobs.testkit` sub-path (my LA-E4-01 NIT, now fixed), and a controlled clock for the 25-minute window.

My two MINORs are about *when* the jobs run in a real stack: the daily audit job never runs on a service that restarts more often than daily, and the new shutdown drain conflicts with Docker's default stop time.

## How I checked

- Scratch clone of `a50e7af` in a private `/tmp` folder (`--no-hardlinks`, `node_modules` copied; removed after the run). The shared LA worktree did not change.
- `vitest run services/lti-service/src/jobs services/lti-service/src/main.test.ts`: **5 files, 21 tests passed**. `tsc --noEmit -p services/lti-service/tsconfig.json`: exit 0.
- `infra/compose.yaml` at `a50e7af`: no `AUDIT_RETENTION_DAYS`, `JOB_INSTANCE_ID` or `stop_grace_period` line, and no `env_file`.

## Checks

| Check | Result |
| --- | --- |
| Files and "Must not edit" | `store/retention.ts` is unchanged (the job calls `cleanupExpired`); new `jobs/{index,retention,audit-retention}.ts` and tests; `main.ts`; migration `013_job_runner.sql`. No edit of `packages/shared/src/jobs.ts`, `packages/shared/src/retention.ts`, `store/tool-keys.ts`, `jobs/signing-key-cleanup.ts` or `store/storage-checks.ts`. The `bface04` part (`cli/bootstrap.ts`, `store/accounts.ts`, its test) is an LA-E5-04 follow-up; I did not review it. |
| Ownership | S1 in B2. OK. |
| No behaviour change outside the spec | Retention moves from its own timer onto the runner, with the same lines. The 3-second forced exit on `SIGTERM` is gone. That is a change in shutdown time; see B-LA-E5-19-02. |
| No LMS name in core | None. |
| UNIT ACs fail on the old behaviour | AC-02 and AC-03 (`jobs/retention.test.ts`, `jobs/audit-retention.test.ts`): there was no job module before. AC-05 (`jobs/index.test.ts`): an upgraded M1 fixture gets the two empty tables, and the old rows stay. AC-06: `describeJobStoreContract('LTI migration 013', …)` on independent connections. AC-07 (`main.test.ts`): 3 runs in 25 minutes, one `job_run` each. A drain test shows that a job longer than 3 s finishes before the database closes. AC-09 is **pending: LA-E3-02** (the retention job does not call a `storage_check` cleanup yet), as the AC text allows. |

## Findings

### B-LA-E5-19-01 — MINOR — `audit-retention` never runs on a service that restarts more often than once a day

- **File:** `services/lti-service/src/jobs/audit-retention.ts:18` (`everyMs: DAY_MS, runAtStart: false`).
- **Problem:** The runner schedules an interval job with an in-process timer that starts at each process start. It does not read `job_lease.last_run_at`. With `runAtStart: false`, the first run comes 24 hours after a start. A stack that restarts daily or more often (each deploy, every `stack:restart`, a dev stack each morning) never runs the job. `audit_event` then grows past `AUDIT_RETENTION_DAYS` without a sign, and no `job_run {job: "audit-retention"}` line ever appears. `signing-key-cleanup` (S2) avoids this with `runAtStart: true` (D11 "at start, then daily").
- **Evidence:** D11 says only "daily" for this job. AP-06-32 tests the delete rule, not the schedule. `audit_event` has the index `audit_event_ts (ts, id)` (migration `007`), so a start-time run is one indexed `DELETE`.
- **Suggested fix:** Set `runAtStart: true` (the simplest fix, and the same as `signing-key-cleanup`). Or run at start only when `job_lease.last_run_at` is older than one day. Add one assert to the AC-07-style test: a start logs one `job_run {job: "audit-retention"}`. If A2 wants "daily, never at start", write that in D11 together with the restart caveat.

### B-LA-E5-19-02 — MINOR — The new shutdown drain can take up to 60 s, but Docker stops the container after 10 s

- **File:** `services/lti-service/src/main.ts:65-79` (no forced exit any more; "runner.stop owns the lease-based grace period"); `infra/compose.yaml` (no `stop_grace_period` for `lti-service`).
- **Problem:** `jobs.stop()` waits for the runs in flight up to the longest lease (default 60 s), and only then deletes the heartbeat row. Docker sends `SIGKILL` after its default 10 s. So a stop during a slow run (an `audit-retention` delete on a large table, a slow signing-key cleanup) is cut off. The heartbeat row stays, and the next start takes the crash path: it waits up to 30 s before its jobs run. AC-08 asks for a restart "as fast as before LA". While it drains, the service also logs nothing, so `stack:restart` seems to hang.
- **Evidence:** The comment at `:78` chooses the lease-based grace on purpose, and the drain test proves the wait beyond 3 s. The compose file has no longer stop period.
- **Suggested fix:** Pick one rule and write it down:
  - (a) Add `stop_grace_period: 70s` to the `lti-service` service. S1 owns `infra/compose.yaml`, so it can come in the next S1 commit.
  - (b) Cap the drain below Docker's limit (for example 8 s), and accept the crash path for a longer run.

  In both cases, log one `job_runner_stopping {in_flight}` line when the drain starts.

### B-LA-E5-19-03 — NIT — The two job settings cannot be set in the stack

- **File:** `services/lti-service/src/jobs/index.ts:46-49` (reads `AUDIT_RETENTION_DAYS` and `JOB_INSTANCE_ID` from `process.env`); `infra/compose.yaml`; `.env.example`.
- **Problem:** Operability §2 lists both settings (`AUDIT_RETENTION_DAYS`, `JOB_INSTANCE_ID`). But the compose service passes neither value and has no `env_file`, and `.env.example` names neither. In the stack, an operator cannot change them without editing `infra/compose.yaml`.
- **Suggested fix:** Add `AUDIT_RETENTION_DAYS: ${AUDIT_RETENTION_DAYS:-400}` and `JOB_INSTANCE_ID: ${JOB_INSTANCE_ID:-lti-1}` to the `lti-service` environment, and add both names to `.env.example`. This can come in the next S1 infra commit, or through the Lead if another lane owns `.env.example`.

### B-LA-E5-19-04 — NIT — A second, unused read of `AUDIT_RETENTION_DAYS`

- **File:** `services/lti-service/src/jobs/audit-retention.ts:16` (`days = auditRetentionDays(process.env.AUDIT_RETENTION_DAYS)`).
- **Problem:** `createLtiJobRunner` reads the setting once from its `env` option and passes `days`. The default parameter reads `process.env` again, and no product caller uses it. A reader cannot tell which read is the real one, and a test that forgets `days` silently uses the shell environment.
- **Suggested fix:** Make `days` required.

## Not checked

- K1-SIM AC-01, -04, -08 (QA). The `bface04` LA-E5-04 follow-up. The registration of `key-rewrap` (LA-E5-09, by RQ-1 later).


## Round 3 (WE-F4 fix)

Verdict: **APPROVE**. Counts for this bounded round: **0 BLOCKER, 0 MAJOR, 0 MINOR, 0 new NIT**. The earlier deferred NIT B-LA-E5-19-05 is unchanged and outside this fix.

Reviewed `git diff 93ab0c50^1 93ab0c50` (author `d219ce40`) against BD-A2-109, LA-ADR-06 D11, operability §3 and LA-E5-19's updated design notes. Only `services/lti-service/src/main{,.test}.ts` change, within S1 ownership. No forbidden path or LMS name is added.

Both services now use `HTTP_DRAIN_MS = 3_000` and the same sequence: stop listeners and the runner together, cut remaining HTTP connections at 3 s, and close the database after listeners and runner finish. LTI keeps Fastify's close lifecycle for both public and operator listeners. The BD-A2-109 test names explain the idle-runner and running-job cases, including no HTTP answer on the cut, immediate listener refusal and the database staying open for a run. The operator can distinguish the 3 s HTTP limit from the 60 s job grace, 70 s forced-exit fallback and 75 s container grace; the cited design rows agree.

Verification shared with LA-E4-02 Round 2: fresh private clone at `93ab0c50`, own dependencies, **70/70** tests in app shutdown/outbox, shared runner and LTI main; changed-file ESLint and both service typechecks passed. This includes the existing job-beyond-3-seconds and fallback tests. Restoring the former LTI `close()` body makes each new BD-A2-109 case time out in an isolated test run: the held request or listener close cannot complete. The private control only adds socket cleanup after assertions; assertions stay unchanged. Shipped source restored cleanly and **19/19** shutdown/main tests passed again. Evidence: `/tmp/we-f4-review-b-h2dpjw6k/{focused,old-lti-idle,old-lti-running,restored}.log`; Vitest cache cleared before each run.

No new findings. QA still owns AC-LA-E5-19-08 and the seven M1-37 re-gate rows; no Docker, stack or commit was used. Blind review maintained; only the two assigned Reviewer-B reports were edited in the integration worktree.


## Round 4 (WE-F4 failure paths)

Verdict: **APPROVE**. Counts in this bounded round: **0 BLOCKER, 0 MAJOR, 0 MINOR, 0 new NIT**. Reviewed `git diff 8fadb828^1 8fadb828` (author `a2c99731`) against BD-A2-109 and the stop rule checked in Round 3. The earlier deferred B-LA-E5-19-05 NIT is unchanged and outside this fix.

`close()` now checks every settled result, so a public or operator listener failure reaches the shutdown handler and produces exit 1 after the database closes. Both services have the same clear sequence: start all stop steps, wait for all of them, close the database, then throw the first rejected result. The existing 3 s HTTP cutoff and job grace are unchanged. The parameterized test names each listener, runs its real close before injecting failure, and checks exit 1, the retained rejection, each stop step exactly once and database close last. It proves cleanup and failure reporting without depending on which stop step completes first.

Fresh private clone at `8fadb828`, own dependencies: **22/22** app shutdown and LTI main tests passed, including the earlier held-request, job-drain and fallback cases; changed-file ESLint and both service typechecks passed. With the pre-fix product files and unchanged tests, both new LTI cases fail because the handler exits 0; the new app failure-path case also fails. Shipped source restored cleanly and **22/22** passed again. Cache cleared before each run. Logs: `/tmp/we-f4-r2-review-b-3pag23n6/{focused,previous-source,restored}.log`.

No new findings. The diff stays within S1's `main{,.test}.ts`; no forbidden file, LMS name or unrelated behavior is added. Blind review maintained; no Docker, stack or commit. QA still owns the restart re-gate.
