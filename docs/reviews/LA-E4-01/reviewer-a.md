Verdict: APPROVE
Round: 1

# LA-E4-01 review: Reviewer-A (lens "Is it right and is it safe?")

- Diff: `git diff 1b17261 dba6dd2` (lane `la-r`, one commit; merged as `89d5ec5`). The files at the integration `HEAD` are the same.
- References: `docs/architecture/ltiaas/tasks/LA-E4-01.md`; LA-ADR-03 D7 (rows Lease, One in flight, Instance id, Recovery, Fairness, Parallelism, Interval jobs, Worker process); data-model §3. My round-3 design check (one in flight, boot-id restart rule) and my build note on `stop()` (now AC-06).
- I ran `packages/shared/src/jobs.test.ts` on the host: 19 of 19 pass. These are the reference SQLite store under both contract suites, plus the runner-only cases. I also ran one probe script outside the repo (A-LA-E4-01-01). The tree stayed clean.
- Blind review: I did not open the other reviewer's file. I wrote my findings before I judged the Author's choices.
- **Counts: 0 BLOCKER, 0 MAJOR, 1 MINOR, 2 NIT.**

## Checks

| Check | Result |
| --- | --- |
| Lease and owner (AC-01) | Correct. `leaseOwner` = instance id + `/` + boot id (8 random bytes). `lease_until` = now + `leaseMs` (60 s default) (`jobs.ts:222`, `:400-401`). The instance id cannot be empty or hold `/` (`:216`), so the owner prefix is never ambiguous. The reference statements check the owner at "send began" and at the result write (`jobs.test.ts:99-110`). A run with another boot id sends nothing and changes no row (testkit AC-01 and the crash case). |
| One in flight per key (AC-02) | Correct. The reference `lease` is one `UPDATE … WHERE … AND NOT EXISTS (same key, other id, live lease or send marker)` (`jobs.test.ts:80-83`), on one SQLite file through separate connections. Two runners on two rows of one key: the lower row ends (superseded) before the higher row gets a lease. A better row that comes during a send waits for that send's result. The suite takes the store as input, so LA-E4-02 runs the same case on the shipped outbox (A-LAB-10). |
| Fairness and limits (AC-03) | Correct. `due` asks for at least 20 rows. The reference query does the round-robin with `ROW_NUMBER() OVER (PARTITION BY …)`, so the limit cannot hide a partition. The runner skips a partition that is busy in this process. `parallel` (default 4, whole number ≥ 1) applies per queue job, as in the D7 sketch (`limits` on `QueueJob`). Each service has one queue job, so it also holds for the whole runner. `perPartition` ≠ 1 is refused at `addQueue` (`:257-258`). |
| Restart rule (AC-04) | Correct. After `stop()` the row is gone, so the next start claims it and runs the start recovery at once. After a crash, the row is left: the new boot id waits (`state = 'waiting'`), takes no lease, recovers nothing, and claims only when the heartbeat is 30 s old. The claim is one conditional upsert (`heartbeat_at <= staleBefore`). Start recovery takes rows of this instance id by an exact prefix (`substr(lease_owner, 1, length(id + '/'))`, `jobs.test.ts:91`), rows with an expired lease and rows with no owner. A live lease of another instance stays. |
| Second live process (AC-05, AC-09) | Correct. The waiting runner remembers the other row and calls `conflict()` when that row's heartbeat or boot id moves (`:320-327`). A worker goes `off` and calls `onConflict` (exit 1 in LA-E4-05). A web runner keeps waiting without a lease and starts when the other heartbeat is stale (Could, built). An active runner whose heartbeat update finds no row of its boot id also calls `conflict()` (`:357-368`). The other process's start recovery has then taken its rows, so its late results are refused. |
| `stop()` (AC-06) | Correct. `stop()` clears the timers, aborts the run signal, and waits for every tracked promise (runs, polls, checks). The wait ends after the longest `leaseMs` of all jobs at most. Only then does it delete its own row (by boot id) (`:505-539`). During the grace time no heartbeat is written, so a new start waits and logs no conflict (test). |
| Interval jobs (AC-07) | Correct. A run starts only after a conditional `takeJobLease` (free, no owner, or expired). Else, and also when the runner is not active or the same job runs in this process, the result is `skipped_lease`. An expired lease frees the job. `endJobLease` acts only for its own owner. `runNow` gives the run result. |
| `job_run` line (AC-08) | Correct. Each queue run, interval run and skip has a new 16-byte trace id and one `job_run {job, ms, result, counts}` line (`warn` for `failed`). An error logs `err.constructor.name` only. The test throws an error whose message holds an `ltis_` value and an email address; neither reaches a log line. `internal_error` lines also log the class only. |
| Running recovery (AC-10, A-LAB-11) | Correct. Before each `due` poll, rows with a send marker and an expired or missing lease are marked `delivery_uncertain = 1`, unless they belong to this process's `leaseOwner` (`jobs.test.ts:92`). The same rows lose the marker and the lease, and get `next_try_at` = now + 5 s. The higher row of the key is then sent, with exactly one P2 confirmation ≥ 5 s later, and B's late result changes no row (test). |
| UNIT ACs fail on the old behaviour | Yes. The module is new, and each AC has its own case (AC-09 too). The queue cases run on a real SQLite file with two connections, not on a mock. |
| "Must not edit" and ownership | Respected. Only `packages/shared/src/jobs*.ts` and the two export lines in `index.ts` (owner R in B1). No app or LTI service file, and no `config.ts`. `jobs.testkit.ts` imports vitest and is not exported from `index.ts`. |
| No LMS name in core paths | Yes. |

## Findings

- **A-LA-E4-01-01 (MINOR): a row whose run throws every time blocks the other rows of its partition for ever.**
  - Where: `packages/shared/src/jobs.ts:437` (a throw puts the partition in `cooling`), `:345-348` (each timed poll clears `cooling`), and the `due` order (oldest `next_try_at` first inside a partition).
  - Problem:
    - The run contract says "a run must move its row". A run that throws leaves its row unchanged and due. The runner releases the lease and cools the partition. The next timed poll gives the same row first in that partition again.
    - So the row runs and throws every 2 s (one `job_run failed` line each time), and the other rows of its partition never run. For `lti-ags`, the partition is one LTI platform, so every learner of that school gets no grade.
    - This happens only for a throw before the send marker. After the marker, the running recovery moves the row 5 s ahead, and the partition goes on.
    - Today's M1 worker catches every error in `send()` and marks the row `failed` (`services/cogniate-app/src/worker/score-sync.ts:75-90`). Its loop also goes on to the next rows of the batch after an error that escapes (`:109-114`). The new runner loses the second protection.
  - Evidence: a probe with one runner (`pollMs` 50 ms) and partition `school-a` holding rows `poison` (oldest; its run throws `SyntaxError`), `good-1` and `good-2`, plus `other` in partition `school-b`. After 1 s: `poison` ran 20 times, `good-1` and `good-2` 0 times, `other` once, with 20 `failed` lines. The unit test at `jobs.test.ts:318-327` pins the "runs again at the next timed poll" behaviour with a single-row partition, so it does not show the block.
  - Suggested fix (either is enough):
    - Contract side (no runner change): state in the `QueueJob.run` comment that a run catches every row-level error and moves its row (a try counted, a later `next_try_at`, or `failed`), as the M1 `send()` does. Add a case to `describeQueueStoreContract`: when the outbox's remote call throws an unexpected error for one row, that row moves, and the next row of the same partition is sent. LA-E4-02 then proves it on the shipped outbox.
    - Runner side: on a throw, cool the item, not its partition, until the next timed poll (this needs an `id(item)` on `QueueJob`), so the poll goes on to the next row of the partition.
- **A-LA-E4-01-02 (NIT): the instance id is checked only for "" and "/".**
  - Where: `packages/shared/src/jobs.ts:216`.
  - Problem: the start recovery of a store must match "this instance id, any boot id". The reference store uses an exact prefix (`substr`), which is safe. But a service store that uses `LIKE ? || '/%'` would treat `_` and `%` in `JOB_INSTANCE_ID` (an operator value) as wildcards. Then `app_1` would recover the live leases of `appx1`, which breaks one in flight for that instance. No contract case would catch it.
  - Suggested fix: accept only `^[A-Za-z0-9-]{1,64}$` (the defaults `app-1` and `lti-1` pass). Or add a contract case where instance `contract_1` must not recover a live lease of `contractx1`.
- **A-LA-E4-01-03 (NIT): `leaseMs` has no upper limit, and Node runs a longer timer after 1 ms.**
  - Where: `packages/shared/src/jobs.ts:262`, `:269` (only `> 0`), and the grace timer in `stop()` (`:522-526`).
  - Problem: `pollMs` and `everyMs` are limited to `MAX_TIMER_MS`, but `leaseMs` is not. A job with `leaseMs` above about 24.8 days (for example a very long `key-rewrap` lease) makes the `stop()` grace timer fire at once. The row is then deleted while runs are still in flight, which is the case that AC-06 prevents.
  - Suggested fix: refuse `leaseMs > MAX_TIMER_MS` in `addQueue` and `addInterval`, as for `everyMs`.

## Author's choices (judged after my findings)

- `lease()` with a 4th argument `now`: right. The "no live lease" condition must use the runner's clock (the controlled clock in tests), not the database clock.
- `QueueJob.release()` and `recover()`: right. Release is owner-checked, so a late release of a lost lease changes nothing. `recover` has the two scopes of D7 and A-LAB-11, and the `running` scope correctly spares only this process's `leaseOwner`.
- `JobStore.readJobLease`: fine. `GET /operator/v1/jobs` needs `lastRunAt` and `lastResult`.
- `Awaitable` store calls: fine. Every rule stays in one conditional statement, so an async port (LA-E5-23) keeps the guarantees. The LA-ADR-06 D4 rule T2 (synchronous `transaction()` callbacks) still applies inside each run.
- `kick(name)`: fine. It has no effect unless the runner is active, and an unknown name throws.
- A throwing queue run cools its partition until the next 2 s poll: right as a loop brake, but not enough alone (A-LA-E4-01-01).
- Interval `leaseMs` (default 60 s, no renewal): acceptable. A2's long jobs must set it above their longest run, or a second process can start the same job when the lease expires. `key-rewrap` is resumable and idempotent, so the effect is limited (and see A-LA-E4-01-03 for the upper limit).
- Timers not `unref()`'d: right for a service process. `stop()` clears every timer, and an unref'd heartbeat could let a worker process end without notice.

## Notes for the integrating tasks (no finding)

- Shutdown order (LA-E4-02, LA-E5-19): `await runner.stop()` before the database closes. The shutdown fallback must allow the runner's grace. The LTI service exits 3 s after a signal today, and Docker kills a container after 10 s by default, while the grace can reach 60 s. When the process dies first, the heartbeat row stays: the next start waits up to 30 s (the crash path), and the runs in flight become uncertain rows.
- `stop()` aborts `ctx.signal` at once. The outbox should not abort a POST that is in flight (only skip its next step). Otherwise every normal restart with a send in flight makes an uncertain row and one more confirmation send.
- `runNow` gives `skipped_lease` also when the runner is not active (for example a web process with `APP_JOB_RUNNER=off`). A2's `POST /operator/v1/jobs/:name/run` maps it to `409 JOB_RUNNING`. A2 may want to tell "runner off" apart from "already running".
