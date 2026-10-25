Verdict: APPROVE
Round: 2

# LA-E4-01 review, Reviewer-B (lens: "Can a human team own it?")

## Round 2 (Reviewer-B2)

Reviewer: Reviewer-B2, the second lens-B instance (plan LD-22), on Reviewer-B's file. This is a bounded check of my lens's round-1 findings. Diff: `git diff 1b17ccb 93194ec` on lane `la-r` (commits `4740b26` item cooling, `3f29f80` instance id and lease limits, `93194ec` states table, skip reasons, fixture delay, boundary cases, subpath export; merged as `06efe56`). I did not open the other reviewer's file. I did not run Docker.

Counts (this round): **0 BLOCKER, 0 MAJOR, 0 MINOR, 1 NIT.** Every round-1 finding is **closed**.

How I checked: a scratch clone of `93194ec` in a private `/tmp` folder. `vitest run packages/shared/src/jobs.test.ts` gives **24 of 24 passed**. I ran the three round-1 mutants that survived, one at a time. Each one now fails tests:
- (a) `>=` → `>` at `jobs.ts:334`: 1 failed.
- (b) no `s.running` guard at `:470`: 2 failed.
- (c) `graceMs = JOB_LEASE_MS` at `:541`: 1 failed.

I also read the new state table against the code of `conflict()`, `check()`, `beat()`, `start()` and `stop()` (`jobs.ts:308-385`, `:521-559`).

### Round-1 findings

| Finding | Status |
| --- | --- |
| B-LA-E4-01-01 (MINOR) | **Closed.** The header table (`jobs.ts:7-16`) lists every move, and each row matches the code. A conflict while `waiting` keeps a web runner waiting and turns a worker off (`:308-324`). A lost heartbeat moves `active` to the same states (`:374-385`). `stop()` from `idle` or `off` gives `off` (`:527-531`). The `JobRunnerState` comment now names all five states (`:186`). The AC-06 rows now also assert `stopping` and `off`. |
| B-LA-E4-01-02 (NIT) | **Closed.** `job_run … skipped_lease` has `reason`: `lease_held`, `already_running` or `runner_not_active` (`:222`, `:471`, `:485`). The contract asserts all three. |
| B-LA-E4-01-03 (NIT) | **Closed.** `QueueStoreFixture.confirmationDelayMs` is a required field. The asserts and the reference outbox use it, so LA-E4-02 passes the app's own constant. |
| B-LA-E4-01-04 (NIT) | **Closed.** (a) The crash case now rechecks exactly at the 30 s boundary (`jobs.testkit.ts:293`). (b) A new AC-07 case: an in-process run blocks a second run after its lease expires (`:237`). (c) AC-06 runs with `JOB_LEASE_MS` and `2 × JOB_LEASE_MS` and a second, shorter job (`:408`). The mutant results are above. |
| B-LA-E4-01-05 (NIT) | **Closed.** `packages/shared/package.json` exports `./jobs.testkit`. `jobs.test.ts` imports `@cogniate/shared/jobs.testkit`, so the suite itself proves the subpath, and the header comment shows it. |
| B-LA-E4-01-06 (NIT, A1) | **Closed by A1** (BD-A1-14). The LA-ADR-03 D7 sketch now says that `jobs.ts` and its doc comments are the reference. |

### New in this round

#### B-LA-E4-01-07 — NIT — The per-row cooling map only shrinks when a row later succeeds in this runner

- **File:** `packages/shared/src/jobs.ts:211`, `:413`, `:447`, `:451-452`.
- **Problem:** A row that throws gets an entry in `cooling`. The entry goes away only when the same id later runs without a throw in this process. Sometimes a row never comes back to this runner: a peer process fixes it, or the row becomes superseded or deleted. Its entry then stays until a restart, and each entry also raises the `due()` batch size by one (`+ q.cooling.size`, `:413`). Throws are only a backstop, because a run must catch its row errors, so the map grows slowly. But a long-lived web process can collect entries, and nothing shows the size.
- **Suggested fix:** On each poll, drop an entry whose `until + MAX_ITEM_COOLDOWN_MS` has passed (the row did not come back for a full cap period). Add one unit row: a row throws, then leaves `due()`, and after the cap time the next batch size is back to the default.

## Round 1

Diff: `git diff 1b17261 dba6dd2` (lane `la-r`, merged as `89d5ec5`). Spec: `docs/architecture/ltiaas/tasks/LA-E4-01.md`. Design: LA-ADR-03 D7, data-model §3. I did not open the other reviewer's file. I did not run Docker.

Counts: **0 BLOCKER, 0 MAJOR, 1 MINOR, 5 NIT.**

The runner is a good base for two lanes. The store interface is small (7 methods). The queue job brings its own SQL (`due`, `lease`, `release`, `recover`). The contract suite gives LA-E4-02 and LA-E5-19 one set of lease cases to run on their real tables, and the reference SQLite store shows the SQL that those tasks need. The tests are strong: 10 of my 13 mutants fail them. My findings are about how easy the module is to read and change: the state machine has no map, two results share one name, and a few test and contract details.

## How I checked

- Scratch clone of `dba6dd2` in a private `/tmp` folder (`--no-hardlinks`, `node_modules` copied). The shared LA worktree did not change.
- `vitest run packages/shared/src/jobs.test.ts`: **19 of 19 passed** (both contract suites on the reference store, plus the runner cases). `eslint` on the three files: 0 problems. `tsc --noEmit -p packages/shared/tsconfig.json`: exit 0.
- No mutation list was on record (the brief only says "13 mutations reported"), so I ran my own 13 mutants of `jobs.ts`. **10 are killed** by the tests:
  - no running recovery;
  - `stop()` deletes the row at once;
  - conflict ignores a heartbeat move;
  - no cooling after a failed run (killed by a hang, not by an assert);
  - `parallel` off by one;
  - no per-partition busy check;
  - heartbeat loss not a conflict;
  - the error message logged;
  - no release after a run;
  - the web runner turns off on conflict.

  **3 survive**: see B-LA-E4-01-04.

## Checks

| Check | Result |
| --- | --- |
| Files and "Must not edit" | New `jobs.ts`, `jobs.testkit.ts`, `jobs.test.ts`; two export lines in `packages/shared/src/index.ts`. No app, LTI service or `config.ts` change. OK. |
| Ownership (epics §5) | `packages/shared/src/jobs.ts` R (new in B1); `index.ts` R in B1 (export lines after the `crypto.ts` line, as adjustment 12 asks). OK. |
| No behaviour change outside the spec | Nothing imports the runner yet. `index.ts` does not export the testkit (it imports Vitest). OK. |
| No LMS name in core | None. The contract uses neutral names (`contract-1`, `p1`, `k1`). |
| API surface | `JobRunner` has 10 members, against 5 in the D7 sketch. The extras are `kick` (poll after a new row), `state()` (tests, later a health view) and the three ids. `QueueJob` adds `release`, `recover` and a `now` argument to `lease`; `JobStore` has 7 methods. Each extra has a reason in its doc comment. I think the surface is as small as the D7 rules allow. See B-LA-E4-01-06 for the sketch drift. |
| Testkit contract shape | `describeJobStoreContract` (heartbeat row, interval lease, restart, conflict, stop) fits both services; `describeQueueStoreContract` is app-only and its header says so. The fixture needs `queueJob(send)`, where `send(id)` stands for the remote call (resolve = accepted). So LA-E4-02 needs a reporter seam in its real queue job; the record reporter port gives it. The status values (`pending`, `sent`, `superseded`) match data-model §3. See B-LA-E4-01-03 and -05. |
| UNIT ACs fail on the old behaviour | There was no runner before, so every AC test fails on the old tree. Each AC (01 to 10, also the Could AC-09) has a named test; the mutants above show that most rules are pinned. |

## Findings

### B-LA-E4-01-01 — MINOR — The runner's state machine has no map

- **File:** `packages/shared/src/jobs.ts:170-171` (`JobRunnerState`), `:214-542` (`createJobRunner`), `:227-233` (the mutable flags).
- **Problem:** The runner has 5 states (`idle`, `waiting`, `active`, `stopping`, `off`). Its moves are spread over `start`, `check`, `activate`, `conflict`, `beat` and `stop`, and 6 flags guide them (`state`, `controller`, `waitTimer`, `seen`, `conflicted`, `stopping`). The doc comment explains only 3 of the 5 states. A maintainer who adds a move (for example the LA-E4-05 worker mode, or the S2 async store port in LA-E5-23) must rebuild the graph from the code. A wrong move here breaks the Instance id rule silently (two senders, or a runner that never starts). Two other lanes (R, S2) build on this file.
- **Evidence:** For example, `conflict()` moves `active → waiting` (web) or `* → off` (worker). In `waiting` it changes no state, but it sets `conflicted`, which only hides the next `job_instance_wait` line. `check()` can end in `activate()` or in `removeInstance` when a `stop()` came during the claim. None of this is in one place.
- **Suggested fix:** Add a short transition table to the file header, about 8 lines. For example: `idle → waiting (start)`; `waiting → active (row free or 30 s old, claim ok)`; `waiting → waiting (fresh row; a moved heartbeat = conflict: web keeps waiting, worker → off)`; `active → waiting (web conflict, or heartbeat lost)`; `active → off (worker conflict)`; `any → stopping → off (stop)`. Also complete the `JobRunnerState` comment with `stopping` and `off`. No code change.

### B-LA-E4-01-02 — NIT — `skipped_lease` also means "the runner is not active"

- **File:** `packages/shared/src/jobs.ts:448-451`.
- **Problem:** `runNow` returns `{ result: 'skipped_lease' }` and logs `job_run … skipped_lease` in four cases:
  - another process holds the lease;
  - this process already runs the job;
  - the runner is waiting for its instance id (for example a web runner after `job_instance_conflict`, which waits until the other process stops);
  - the runner is stopping or off.

  An operator who calls A2's `POST /operator/v1/jobs/:name/run` then sees "skipped_lease" with no hint that the runner itself is off.
- **Suggested fix:** Keep the return value (AC-07 and D7 fix it), but add a field to the log line: `reason: 'lease_held' | 'running' | 'runner_waiting' | 'runner_off'`. A2 can then show the reason in the operator answer later.

### B-LA-E4-01-03 — NIT — The P2 confirmation delay is a bare `5000` in the shared contract

- **File:** `packages/shared/src/jobs.testkit.ts:614-618` (`acceptedAt + 5000`); the reference outbox `packages/shared/src/jobs.test.ts:91-92`, `:115` (`now + 5000`).
- **Problem:** The queue contract asserts the app's P2 rule ("exactly one confirmation send, at least 5 s later", ADR-010) with a literal number. The app has the same literal (`services/cogniate-app/src/domain/score-syncs.ts:119`). If the app ever changes or names this delay, a shared test file breaks, far from the change.
- **Suggested fix:** Add `confirmationDelayMs` to `QueueStoreFixture` (default 5000), and use it in the asserts and in the reference outbox. LA-E4-02 then passes the app's own named constant.

### B-LA-E4-01-04 — NIT — Three of my mutants survive: two boundaries and one grace rule

- **File:** `packages/shared/src/jobs.ts:314`, `:448`, `:518-519`.
- **Evidence:**
  - (a) `t - row.heartbeatAt >= JOB_HEARTBEAT_STALE_MS` changed to `>` survives. D7 says "30 s old or older", but the tests check only at a 5 s cadence, so the exact boundary is never tested.
  - (b) Removing the in-process guard `s.running` survives. The store lease refuses a second run as long as the lease is live, so the guard only matters after an interval run outlives its `leaseMs`. No test covers that.
  - (c) `graceMs = JOB_LEASE_MS` (instead of the longest lease of the added jobs) survives. AC-06 says "or after `leaseMs`", and no test adds a job with a longer lease.
- **Suggested fix:** Three short rows: (a) a crashed row whose heartbeat is exactly 30 s old at a recheck; the runner starts. (b) An interval job with `leaseMs: 1000` whose run takes 2 s; a second `runNow` in the same process gives `skipped_lease`. (c) A queue job with `leaseMs: 120_000` whose run does not end; `stop()` is still pending after 60 s.

### B-LA-E4-01-05 — NIT — Services import the testkit by a deep relative path across packages

- **File:** `packages/shared/src/jobs.testkit.ts:6-7` ("Import it by its path, for example `'../../../../packages/shared/src/jobs.testkit.ts'`").
- **Problem:** LA-E4-02 and LA-E5-19 will reach into another package's `src/` by a path with four `../`. The path breaks when a folder moves. A later import fence (F3) may also refuse a path import across packages.
- **Suggested fix:** Add a subpath export to `packages/shared/package.json`: `"./jobs-testkit": "./src/jobs.testkit.ts"`. The tests then import `@cogniate/shared/jobs-testkit`, and the main entry still does not load Vitest. The file owner can add the line by RQ-1 when LA-E4-02 starts. Update the header comment then.

### B-LA-E4-01-06 — NIT — The D7 sketch no longer shows the real interface (route to A1)

- **File:** `docs/architecture/ltiaas/adr/LA-ADR-03-learning-record-core.md:140-164` against `packages/shared/src/jobs.ts:76-187`.
- **Problem:** The sketch lacks `JobStore`, `QueueJob.release`, `QueueJob.recover` with `RecoveryScope`, `JobContext.leaseOwner`, `JobRunner.kick` and `state()`. It also shows `limits` as required with `perPartition` as a setting. LA-E4-02 and LA-E5-19 Authors read the ADR first.
- **Suggested fix:** The Lead asks A1 to replace the sketch with a pointer to `jobs.ts` (the interface and its doc comments), or to copy the real interface into it. No code change.

## Not checked

- QA-3's UNIT run, and the real app and LTI stores (LA-E4-02, LA-E5-19).
- Lens-A depth of the recovery SQL in the reference store beyond the contract cases.
