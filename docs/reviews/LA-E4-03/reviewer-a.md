Verdict: APPROVE
Round: 3

# LA-E4-03 review: Reviewer-A (lens "Is it right and is it safe?")

- Diff: `git diff a285bdb^1 a285bdb` (lane R, Codex; the `testkit.ts` import conflict was resolved by keeping both sides). The files at `HEAD` are the same as at `a285bdb`.
- References: `docs/architecture/ltiaas/tasks/LA-E4-03.md`; LA-ADR-03 D5–D9 (D7 rows "`429`", "Fairness", "Row errors"); LA-ADR-04 D8 (LA-IC-11, LA-IC-15); A1 BD-A1-27; A2 BD-A2-31; my LA-E4-02 round-1 findings.
- I ran on the host (no Docker):
  - Vitest on `kernel/records`, `drivers`, `app/results.test.ts`, `runtime-path`, `kernel/registry` and `packages/tracking`: 13 files, 197 tests pass.
  - `infra/scripts/fitness/no-score-sync.test.mjs`: 4/4 pass.
  - My round-1 split-literal probe (`"SELECT id FROM " + "score_sync"`): now a hit.
  - `EXPLAIN QUERY PLAN` of the new `due` statement on the `014` schema.
- Blind review: I did not open the other reviewer's file.
- **Counts: 0 BLOCKER, 0 MAJOR, 1 MINOR, 1 NIT.**

## Checks

| Check | Result |
| --- | --- |
| Mapping table (AC-01) | Correct and tested for each status: 2xx accepted; 409 conflict; 400, 403, 404 and 422 rejected; 0, 401 and 5xx retryable (`uncertain` only after `beginSend` and for no answer or 5xx); 429 with `PLATFORM_RATE_LIMITED` or `RATE_LIMITED` throttled. The client keeps `details.retryAfter` as whole seconds from 1 to 3,600, with 60 as the fallback (test table). A 429 from the line-item lookup is also throttled, with no try counted. |
| Throttling does not lose or repeat a score (AC-03, LA-IC-11) | Correct. A throttled outcome is never `uncertain`. When the POST had begun, the try that `beginSend` counted is taken back. `recordSend` clears `send_started_at`, so no recovery sends the row again. `next_try_at` = max(`retryAt`, normal backoff). `not_before` goes on the row and on every pending row of its partition, in the same transaction as the result. `due` and `lease` also skip a partition while any of its rows has a future `not_before`, so new rows and stale due snapshots wait too (test). The confirmation phase and earlier uncertainty stay. A `retryAt` beyond the 24 h window gives `failed` (test). |
| Retries and restart | Unchanged from LA-E4-02: the owner checks are now required (`ownsDispatch` takes a string, `lease_owner = ?`), and the old worker with its `recoverInterruptedSends` is gone, so only the outbox recovery path is left. `not_before` is stored, so a restart keeps the pause. |
| Read-back (AC-06) | `POST …/results/refresh` keeps the disabled check first. Then it needs `records.readBack` on the channel and a reporter with `readBack`, else `409 CAPABILITY_NOT_SUPPORTED` (`records.readBack`); both cases are tested. The reporter reads only the learner's own result and writes only `gradebook_read`. It never sends a score, so a read-back cannot overwrite a grade on the platform. All three baseline manifests have `records.readBack: true`. |
| LA-IC-15 only where the LA-IC says | Yes. Only the 409 `lastError` uses `textName(channel)` (Moodle "Moodle", so Moodle rows are byte-equal), and `your LMS` for an unknown channel (test). Stored rows keep their old text. The play status text (`status-text.ts`, a K file) is unchanged, and it already used the LMS name. |
| Policy guard (AC-08) | `createDispatchQueue` refuses any policy other than `bestResult` (test). |
| Reporter wiring | `configureRecordReporters` is called in the app listener build, before the content listener is built and starts listening (`startService` builds and listens in order), so record creation and the outbox use the same instance. |
| LA-E4-02 round-1 findings | -01 closed: `kernel/records/shutdown.ts` logs `service_stopping {signal}` on both listeners, exits 0 after a clean close, and logs `service_exit_forced` and exits 1 after 70 s (two tests). -02 closed: the F5 rule joins static `+` and template chunks (test and my probe). -03 closed: a lower row is superseded only when a higher dispatch exists; `due` skips a row whose learner has a better final attempt without a dispatch, as the M1 worker did. |
| "Must not edit" and ownership | Respected. `worker/**` was moved into `drivers/lti-ags/` and removed. No `status-text.ts`, `html.ts`, K, L or LTI-service file changed. |

## Findings

- **A-LA-E4-03-01 (MINOR): the paused-partition check reads the whole `record_dispatch` table for each due row and each lease.**
  - Where: `services/cogniate-app/src/kernel/records/outbox.ts:70` (`due`) and `:81` (`lease`): `NOT EXISTS (SELECT 1 FROM record_dispatch paused WHERE paused.partition_key = … AND paused.not_before > ?)`.
  - Problem:
    - No index of `014` starts with `partition_key`. The plan shows `CORRELATED SCALAR SUBQUERY` and then `SCAN paused`.
    - Dispatch rows are never deleted (data-model §3 "Retention"). So the cost grows with every score ever sent: (due rows) × (all rows) on each poll every 2 s and on each kick. It is correct, but it gets slower over time.
  - Suggested fix: add `paused.status = 'pending'` (every row that `not_before` pauses is pending), so the `record_dispatch_due` index serves it. Or add an index on `(partition_key, not_before)` in the next app migration.
- **A-LA-E4-03-02 (NIT): the throttle bookkeeping runs before the owner check.**
  - Where: `outbox.ts:136-142`. The `tries - 1` and the partition `not_before` run first, and only then `recordSend`, which checks `ownsDispatch` (`dispatch-store.ts:72`).
  - Problem: a run whose lease another instance has taken over (only after the 60 s lease, with running recovery) still takes back a try that it did not own, and still pauses the partition. The effect is small: one try count and one pause.
  - Suggested fix: return early when `!ownsDispatch(db, row.id, ctx.leaseOwner)` at the start of the transaction.

## Notes (no finding)

- `RATE_LIMITED` (the LTI service's own limit) pauses the whole partition, the same as `PLATFORM_RATE_LIMITED`. The service limit is per caller, not per platform, so other partitions keep sending until they get their own `429`. This follows AC-01.
- AC-02 to AC-05 and AC-09 are K1-SIM or MOODLE-LIVE and wait for QA. The unit tests above cover their logic. The LD-9 G3 delta for LA-IC-15 (`canvas/` and `blackboard/` `B-conflict` `lastError`) is the lead QA's work.

## Round 2

Reviewer: Codex GPT-6-Astra xhigh, lens A. **CHANGES_REQUESTED: 0 BLOCKER, 1 MAJOR, 0 MINOR, 0 NIT open.**

Reviewed `3692a91`, `503dfe2`, `b22fe80`, `e2e8fb5` and their merge `5f9fd55`, against the task spec, LA-ADR-03 D5–D8, BD-A1-61 and plan §6.1. Verification used a private `git clone --no-hardlinks` at `7cabc68`; the reviewed product files match the merge. No Docker or stack ran. No other reviewer's file was opened.

### Earlier findings and checks

| Check | Result |
| --- | --- |
| A-LA-E4-03-01 | The query-plan problem is fixed: all three send gates use `record_dispatch_due`. The new row takes the pending row's pause before superseding it. However, my Round 1 suggestion that only pending rows need to carry a pause was incomplete. A failed row can still carry a live platform pause; see new finding A-LA-E4-03-03. |
| A-LA-E4-03-02 | Closed. The result transaction checks the owner before changing the try count or partition pause. A lost owner also emits no throttle/result log. The regression test passes. |
| Reporter and M1 contract | The driver owns the platform/deployment lookup and `score_sync` / `sync_id` log names. The kernel still creates `sync_` ids. `RESULTS_REPORTER` limits the results view, play status and Resend to AGS. Resend checks the library and disabled connection in the same transaction as the update and keeps the M1 answers. |
| Wiring and merge | One `registerRecordReporters` call provides the write/read-back registry and queue. Unsupported policy is refused before registration. The final `play.ts` import uses `domain/results.ts` and keeps `topLevelContinueScript`; runtime and embedded-session tests pass. |
| UNIT criteria | AC-01, AC-06, AC-07 and AC-08 retain tests for mapping, read-back guards, disabled connections and policy refusal. The new tests cover the missing resource link, text limit, reporter partition, Resend answers, neutral kernel, indexed pause and stale owner. The missing boundary case is below. |
| Scope and ownership | The changes match the dispatched neutral-kernel work and the explicit RQ-2 K-file import changes in `b22fe80`. No `tests/**`, tracking status-text/html, or LTI-service file changed. No LMS name was added to a core path. |

### Finding

**A-LA-E4-03-03 (MAJOR): a partition's pause ends early when its last pending row fails the 24 h retry-window check.**

- Where: `services/cogniate-app/src/kernel/records/dispatch-store.ts:52` (`partitionPaused`), `kernel/records/records.ts:57` (pause inheritance), and `kernel/records/outbox.ts:154` (the result can make the pause carrier failed).
- Problem: `recordSend` correctly fails a throttled row when its next retry lies outside its own window. Its future `not_before` still records a live platform rate limit, but both pause queries now ignore it because its status is `failed`. A new row in the same partition can start a POST immediately. The row's retry window must not shorten the platform's `Retry-After` wait (D7 Fairness/429; AC-03 timing rule).
- Reproduction: create the only dispatch at `100000`; run it at `86480000` (20 s before its window ends); return `throttled` with `retryAt = 86510000` (30 s later). The old row becomes `failed`, with `not_before = 86510000`. At `86480000`, create a new final record through `writeFinalRecord`, either for a new learner or as a better result for the same learner. In both cases, `due` returns the new row, `lease` returns `true`, and `beginSend` returns `started`, 30 s too soon.
- Evidence: two private regression probes fail on the reviewed code with those three results. Removing only `paused.status = 'pending'` from `partitionPaused` makes both probes pass, including release at the exact deadline. The private product file was restored after the check. The existing beyond-window test checks only the old row's failed status, so it misses this case.
- Suggested fix: retain the pause independently of a dispatch's pending status. One option is the Round 1 alternative: a suitable index on `(partition_key, not_before)` and a status-independent pause check. A separate durable partition pause is another option. Keep the row's 24 h failure rule, and add tests for a failed last carrier followed by a new learner and by a better result; check `due`, `lease`, `beginSend`, and release at `retryAt`.

### Verification

All commands ran in `/tmp/la-review-a-e403-6bed80580d66`:

- `npx vitest run services/cogniate-app/src/kernel/records services/cogniate-app/src/drivers/lti-ags services/cogniate-app/src/app/results.test.ts services/cogniate-app/src/worker-main.test.ts packages/tracking`: **165 passed** (before adding the probes).
- `npx vitest run services/cogniate-app/src/runtime-path.test.ts services/cogniate-app/src/tool-pages/embedded-session-help.test.ts`: **54 passed**.
- `npx tsc --noEmit -p services/cogniate-app/tsconfig.json`: **passed**.
- `node --test infra/scripts/fitness/no-score-sync.test.mjs`: **4 passed**.
- Private `kernel/records/reviewer-a-pause-probe.test.ts`: **2 failed** on the reviewed code; **2 passed** with only the old status-independent predicate restored. The reproduction above is the durable evidence; the probe is outside the integration worktree.

The simulator and Moodle acceptance gates remain for QA. Only this review file was changed in the integration worktree.


## Round 3

Reviewer: Codex GPT-6-Astra xhigh, lens A. Date: 2026-10-23. **APPROVE: 0 BLOCKER, 0 MAJOR, 0 MINOR, 0 NIT open.**

Reviewed `1232da6` and `a802807`, merged at `9e4bc18`, against the task, LA-ADR-03 D7 and plan §6.1. Verification used a private `git clone --no-hardlinks` at `ce2a3ba` (`/tmp/la-reviewer-a-ctx-e1c7d3f9bf5b`). No Docker, stack or stack-starting runner ran. No other reviewer's file was opened.

### Finding closed

**A-LA-E4-03-03 closed.** `dispatch-store.ts:51-52` reads a partition's future `not_before` across every status. The throttle transaction in `outbox.ts:144-154` keeps the maximum pause on the source row even if it was superseded during the POST, as well as on pending peers. A failed or superseded carrier therefore remains effective for a later learner or better score; `writeFinalRecord` no longer needs to copy the pause. The owner check still precedes every throttle write, so A-LA-E4-03-02 remains closed.

I reran both Round 2 reproductions with the same times and assertions, adapting only the newer `writeFinalRecord` time argument. Both pass: a carrier created at `100000` fails at `86480000` with `not_before = 86510000`; a new learner and a better result are each blocked by `due`, `lease` and `beginSend`. The Author's two boundary tests also check `86509999` and release through all three gates at exactly `86510000`.

The new partial index in `domain/migrations/017_record_dispatch_pause.sql` covers `(partition_key, not_before)` for non-null pauses. The query-plan test inspects the actual SQL from all three gates and finds `SEARCH paused USING COVERING INDEX record_dispatch_pause (partition_key=? AND not_before>?)`, with no `SCAN paused`. A private upgrade probe applies 017 to a database through 015 containing a failed carrier: all dispatch fields stay equal, the pause stays effective and the covering index is used. This closes A-LA-E4-03-01 without the pending-only restriction that caused -03. The migration is additive and uses the dispatched number 017; earlier migration files are unchanged.

### Verification and scope

- Focused records, AGS driver, results, worker, runtime, embedded-session, LMS-text and tracking suites: **239/239 tests pass in 16 files**. App type check and the four `no-score-sync` fitness tests pass.
- Private pause probes: **2/2 pass**; private migration-upgrade probe: **1/1 passes**.
- Three private mutants are detected by assertion failures: restoring the pending-only predicate fails both earlier probes; changing `>` to `>=` fails both exact-deadline cases; omitting the index fails the query-plan assertion. After restoration, the affected records/throttle suites and all seven private probes pass (**27/27**).
- The diff is limited to the dispatched records changes, their Author unit tests and the new migration. No frozen test, LTI-service file or tracking status-text/html file changes; no LMS name is added to a core path. The existing UNIT AC tests for mapping, read-back, disabled connections and policy refusal pass. The AGS score payload and retry-window failure rule stay unchanged.

Simulator timing/fairness and Moodle acceptance gates remain for QA. Only this review file was changed for this item.
