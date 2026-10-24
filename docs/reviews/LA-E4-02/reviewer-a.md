Verdict: APPROVE
Round: 3

# LA-E4-02 review: Reviewer-A (lens "Is it right and is it safe?")

- Diff: `git diff db7333f^1 db7333f` (lane R, Codex; RQ-2 lines in `legacy-wire.ts`, `index.ts`, `sql-portability.mjs`, `fitness.test.mjs` and test fixtures). The `services/cogniate-app/src/**`, `packages/shared/src/jobs*.ts` and fitness rule files at `HEAD` are the same as at `db7333f`.
- References: `docs/architecture/ltiaas/tasks/LA-E4-02.md`; LA-ADR-03 D2, D3, D6, D7; LA-ADR-04 D5, D6; data-model §3; A2 BD-A2-31, BD-A2-40; A1 BD-A1-10, BD-A1-46.
- I ran on the host (no Docker):
  - Vitest: `kernel/records`, `domain`, `worker`, `runtime-path`, `app/redemption` and `packages/shared` `jobs.test.ts`. 13 files, 268 tests pass.
  - `fitness.test.mjs` 37/37 pass, and F5 (`rules.mjs`) passes on the tree.
  - Three probes (outside the repo or in memory):
    - The old `score-syncs.ts` (with the table and column names replaced) compared with the new `dispatch-store.ts`.
    - `externalKey` compared with SQLite `json_array` (3.53.4) for all 128 ASCII characters and 9 edge strings: 0 differences.
    - An F5 `no-score-sync` stdin probe.
- Blind review: I did not open the other reviewer's file.
- **Counts: 0 BLOCKER, 0 MAJOR, 1 MINOR, 2 NIT.**

## Checks

| Check | Result |
| --- | --- |
| Backfill is complete (AC-01) | Yes. Every `score_sync` row gets one record and one dispatch. The inner joins (`attempt`, `resource_link`, `connection`) cannot drop a row: `PRAGMA foreign_keys = ON` (`packages/shared/src/migrations.ts:111`), every referenced column is `NOT NULL`, and attempts are never deleted (retention). `attempt.outcome` and `course_version_id` are `NOT NULL`, so the record insert cannot fail. All state columns are copied, and the lease stays empty. `partition_key` follows D5 step 4. `connection_deployment` has a unique index on `connection_id` (`011`), so its scalar subquery returns one row. The test covers the three fixture branches. |
| No score sent twice | Correct. `main.ts` no longer creates the old worker. Its code stays for LA-E4-03 and is not started. One-in-flight: `lease` is one `UPDATE … WHERE NOT EXISTS` over rows of the same (placement, learner, reporter) with a live lease or `send_started_at`. SQLite runs one writer at a time, so two runners cannot both win. A row in `beginSend` keeps `send_started_at` until its result is recorded, so no other process can lease it, even after its 60 s lease ends. Only the lease owner records a result: `ownsDispatch` in `beginSend`, `failDisabledSync` and `recordSend`. Running recovery skips rows of its own `leaseOwner`. A superseded row that is still in flight blocks the higher row until its result is written, and the D7 confirmation clause covers a crash in that window (AC-12 test). |
| No score lost | Correct. Copied rows with `send_started_at` have no lease, so start recovery marks them uncertain, as today (D5). Start recovery also clears this instance's old leases, and running recovery clears expired or `NULL`-owner leases. Each run clears its lease through `release` (`jobs.ts:462`), also after a throw. A pending row always has a later `next_try_at`, or becomes `failed` at the end of its 24 h window. The catch path counts a try and moves the row (BD-A1-10; AC-13 store-contract case and outbox test). |
| Stop | Correct (BD-A1-10 item 4). `beginSend` is refused once `ctx.signal` aborts, so no new POST starts. The reporter does not pass the signal to `postScore`, so a POST in flight finishes and records its result. Test: "stop waits for a POST to record its result before removing the heartbeat". `close()` awaits `runner.stop()` before the listeners and `db.close()`. `cogniate-app` has `stop_grace_period: 75s`. The two missing log and timer items are in A-LA-E4-02-01. |
| Send rules equal to M1 | The moved store is the old code with new names. My diff shows only the planned changes: the owner checks, the `reporter` filter, the frozen recovery text from `legacy-wire.ts` (same bytes), `seq` in place of `rowid`, a transaction around Resend, and the D7 superseded clause in `needsConfirmation`. The outcome mapping matches `syncResult`: 2xx sent; 409 conflict; 400/403/404/422 failed; any other answer retries by `nextRetryAt(max(1, tries))` or fails at the window end; no line item and a key that cannot be decrypted fail at once. Tries count only a started POST, except the BD-A1-10 catch path. The `score_sync` log line is unchanged. |
| Record rule (AC-03) | The new `improves(before, …)` condition changes no dispatch set: `syncDecision` creates only above the best non-superseded row, and that best value never goes down, so a commit that does not improve its attempt never passed `syncDecision` before either. Preview commits write nothing. The payload is the same `agsScoreBody` (it reads only the two scores). The manifests of all three baseline channels list `records.reporters: ['lti-ags']`. |
| Resend (ADR-010 rule 10) | The same rule and texts, now in one transaction. `kickSync` and `onSyncCreated` kick `record-dispatch`. |
| `seq` order (BD-A2-40) | Stable. The backfill uses `ROW_NUMBER() OVER (ORDER BY created_at, rowid)`, new rows get `MAX(seq) + 1` inside the commit transaction, and the index is unique. The results statement, `latestSyncStatus`, `dueSyncs` and `due` order by `created_at, seq`. The baseline goes from 9 to 7: one `results.ts` entry is replaced one for one (`context_id` added), and the two moved statements are removed. |
| Placement and `external_key` (AC-02, AC-11) | The launch upserts the placement on `placement.id` in the resource-link transaction (a SAVEPOINT inside the launch). A rebind updates `publication_id`. `JSON.stringify` equals `json_array` (probe above). The results row shows "—" for `context_id = ''`. |
| Fairness and partitions | `due` is round-robin over `partition_key` with `ROW_NUMBER`. `busy` keeps one run per partition in a process. A failed lease moves on to the next item, so a blocked key does not stop its partition. |
| UNIT ACs fail on the old behaviour | Yes. AC-01 to AC-04 and AC-11 to AC-13 need the new tables, the job store or the outbox. |
| "Must not edit" and ownership | Respected. `worker/score-sync.test.ts` gets fixture changes only, with the assertions kept, and lane R owns it. No `drivers/**`, `services/lti-service/**` or `testkit.ts` change. The kernel and fitness lines are the RQ-2 commits named in the dispatch. |

## Findings

- **A-LA-E4-02-01 (MINOR): at `SIGTERM` the app no longer logs `service_stopping`, and it has no exit fallback.**
  - Where: `services/cogniate-app/src/main.ts:70` (`handleSignals: false`), `:72-87`.
  - Problem:
    - Before, `closeOnSignal` (`packages/shared/src/http.ts:48-56`) logged `service_stopping {signal}` and exited after 2 s. The new handler does neither.
    - `service_stopping` is an app log event of the contract (`docs/architecture/contracts/cogniate-app-api.md:901`). The T1 harness checks its boot trace id whenever the line is present.
    - BD-A2-31 and operability §3 give one stop order: runner grace 60 s, then the service exits by itself at 70 s (`service_exit_forced`, exit 1), then the container stop grace of 75 s. The compose file already sets 75 s for `cogniate-app`. The LTI service has this handler (`services/lti-service/src/main.ts:74-88`). The app has no fallback, so a `server.close()` that waits on a long request lasts until Docker kills the process at 75 s, and no log line says why.
    - Data stays safe: each write is one SQLite transaction, and an interrupted POST becomes uncertain at the next start.
  - Suggested fix: use the LTI service pattern in the app. Log `service_stopping {signal}` at once, arm a timer for `JOB_LEASE_MS + 10_000` that logs `service_exit_forced {after_ms}` and exits 1, and clear the timer on the clean path. Add one unit test, like `services/lti-service/src/main.test.ts:158-179`. If the Lead puts this in LA-E4-05, record it there.
- **A-LA-E4-02-02 (NIT): F5 `no-score-sync` misses a table name that is built from more than one string literal.**
  - Where: `infra/scripts/fitness/rules/no-score-sync.mjs:24-28` (each literal is checked alone).
  - Problem: probe on `services/cogniate-app/src/domain/probe.ts`:
    - `"SELECT id FROM score_sync …"` is a hit;
    - `` `UPDATE "score_sync" …` `` is a hit;
    - `"SELECT id FROM " + "score_sync"` is not a hit, because the second literal has no SQL keyword.

    AC-05 asks only for one probe, so this passes, but a split statement goes through.
  - Suggested fix: also report a literal that is exactly `score_sync` (or `"score_sync"`) when an SQL keyword is in the same expression. Or note the limit in the rule comment.
- **A-LA-E4-02-03 (NIT): `run` now marks a pending row `superseded` before any send when it is no longer the best result.**
  - Where: `services/cogniate-app/src/kernel/records/outbox.ts:93-96`.
  - Problem: the M1 `send()` only returned, and the row stayed `pending`. I found no normal path that makes such a row: `syncDecision` already supersedes lower pending rows when it creates a better one, and the best non-superseded value never goes down. So the change is safe, but it is outside the spec and no test pins it.
  - Suggested fix: add a one-line comment that links this to the D7 "outbox engine for every later change" rule, or keep the M1 return.

## Notes (no finding)

- An unexpected error before the POST now counts a try and retries by the normal backoff. Before, it failed at once (`internal_error`). BD-A1-10 decided this. A key that cannot be decrypted still fails at once with the M1 text.
- If an error is thrown after `recordSend` has already written a final status (for example by the logger), the catch path writes again: `delivery_uncertain = 1` on a sent row, or one more try on a failed row. The effect is at most one extra confirmation later. No real path throws there today.
- The F5 adapter entry for `014` allows the `rowid` form for the whole file. It is still "one entry", and an applied migration cannot change (its checksum is frozen).
- With `APP_JOB_RUNNER=off`, the web process sends no scores and runs no retention. LA-E4-05 adds the `worker` entry. Until then, `off` is only for that task's tests.
- AC-06 to AC-10 are K1-SIM or MOODLE-LIVE and wait for QA. The unit tests and the checks above cover their logic.


## Round 2 — WE-F4 shutdown fix

Reviewer: Codex GPT-6-Astra xhigh, 2026-10-24. Diff: `739c51ad^1..739c51ad` (R `549a21b4`), against BD-A2-109, LA-ADR-06 D11, operability §3 and ADR-011 §4a. **CHANGES_REQUESTED: 1 new MAJOR; no new BLOCKER, MINOR or NIT.**

### A-LA-E4-02-04 — MAJOR — One listener error ends the wait for every other listener

- **File:** `services/cogniate-app/src/kernel/records/shutdown.ts:21`, also `:26`–`:28`.
- **Problem:** `Promise.all` rejects on the first listener error. The outer `allSettled` then waits only for that already-rejected aggregate and the runner; it does not wait for the other listeners. It cancels their three-second cutoff and closes the database while a request can still be open. This violates the required database-after-listeners order on the failure path.
- **Evidence:** A private real-HTTP probe passed one non-listening server and another server holding a request to `stopService`, with no runner. The first server reported `ERR_SERVER_NOT_RUNNING`; before advancing the fake clock, `closeDb` had already run while the second request remained held. The required `dbClosed === false` assertion failed. Existing tests cover only one listener and a runner failure, so they do not detect this case.
- **Suggested fix:** Retain each listener-close promise separately and await all of them together with the runner using `Promise.allSettled`. Keep the cutoff armed until all have settled, close the database, then rethrow a failed result. Add the two-listener failure case. That private control passed the probe and all existing focused tests.

### Checks and limits

- Normal path: all three app listeners stop immediately, the runner stop begins concurrently, idle keep-alives close, held HTTP sockets are cut at 3,000 ms, and the database waits for the runner. `close()` remains idempotent. The 60 s runner grace, 70 s service fallback and 75 s compose grace are unchanged; worker code is untouched. R1 **A-LA-E4-02-01 is closed** by the existing shutdown handler's stop log, fallback and failure exit tests. R1 NITs 02 and 03 are outside this fix and are not re-reviewed.
- ADR-011: a socket cut does not cancel JavaScript. While a job drains, a handler can finish through the existing attempt/ref fencing; phase 1 and phase 2 remain separate transactions, with conditional approval and compensation. On the normal shutdown path, `createShutdownHandler` exits immediately after `close()` returns, so a killed handler leaves the established recoverable lease/ref state. No grant, lease, transaction or compensation code changed. The listener-failure ordering exception is finding 04 above.
- Ownership is wave-dependent: epics §5 gives `kernel/records/**` to R in B2/B3 and K in B4 for LA-E5-22. This is the existing R shutdown helper, within LA-E4-02's explicit directory grant and this Lead-dispatched R fix of BD-A2-109; no K key-provider behavior was edited. The change stays within the specifically authorized fix scope.
- **48/48 existing focused tests passed** across app shutdown, LTI main and shared jobs. Both app cases (a) and (b) failed when the old runner-first/no-HTTP-cut order was restored privately; all four new app/LTI cases failed under those mutations. The two new error-path probes failed on the submitted code; private controls for both services passed **50/50** checks. No product fix was made in integration.
- Verification used `/tmp/la-reviewer-a-ctx-63e08b92dff0` at `9f8e990a`, a fresh `--no-hardlinks` clone with its own `npm ci` and a cleared Vitest cache before every run. It is clean after restoring all probes. Logs: `/tmp/la-reviewer-a-ctx-63e08b92dff0-focused.log` and `/tmp/la-reviewer-a-ctx-63e08b92dff0-probes/{error-paths,controls,old-order-mutants}.log`; probe sources are in that directory. No Docker, stack, host stack runner, commit or Reviewer-B file was used. QA's seven frozen M1-37 re-gate rows remain pending.


## Round 3 — WE-F4 error-path fix

Reviewer: Codex GPT-6-Astra xhigh, 2026-10-24. Diff: `f8d7d7d6^1..f8d7d7d6` (R `cd8f06c9`), against BD-A2-109 and the Round 2 finding. **APPROVE: 0 new findings. A-LA-E4-02-04 is closed.** Prior NITs 02 and 03 remain outside this fix.

- **Finding 04 closed:** `shutdown.ts:22`–`:31` keeps one promise per listener and awaits all listeners and the runner with `allSettled`. An early listener error cannot cancel the held listener's cutoff or close the database early. After all steps settle, the cutoff is cleared, the database closes, and the first failed result is thrown.
- The new two-listener test and my repeated private probe both pass: a non-listening server reports `ERR_SERVER_NOT_RUNNING`, the other request stays held until the 3 s cutoff, and database close follows that listener. Restoring the prior faulty helper makes both tests fail because the database closes early.
- **53/53 focused checks passed** across app shutdown, LTI main and shared jobs: 51 committed tests plus the two prior private probes. All five relevant checks fail with the two prior faulty implementations restored. Normal idle/busy shutdown, immediate connection refusal, runner drain and failure exit remain covered. The 3/60/70/75 s bounds, transactions and lease/ref fences are unchanged. Only the authorized R helper and its colocated test changed; no core LMS name or unrelated behavior was added.
- Verification: fresh `git clone --no-hardlinks` at `9b918a7e`, own `npm ci`, cache cleared before each run; private clone `/tmp/la-reviewer-a-ctx-d2660307debb` restored clean. Evidence: `/tmp/la-reviewer-a-ctx-d2660307debb-probes/focused-and-probes.log`, `prior-error-mutants.log` and saved probe sources. No Docker, stack, host stack runner, commit or Reviewer-B file was used. QA's seven frozen M1-37 re-gate rows remain pending.
