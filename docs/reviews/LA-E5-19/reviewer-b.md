Verdict: APPROVE
Round: 1

# LA-E5-19 review, Reviewer-B (lens: "Can a human team own it?")

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
