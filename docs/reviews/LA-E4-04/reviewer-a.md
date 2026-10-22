Verdict: CHANGES_REQUESTED
Round: 1

# LA-E4-04 review: Reviewer-A

## Round 1

Reviewer: Codex GPT-6-Astra xhigh, lens "Is it right and is it safe?" **Counts: 1 BLOCKER, 0 MAJOR, 0 MINOR, 0 NIT.**

Reviewed `ab49b35`, merged at `1a40bbd`, against the task spec, LA-ADR-03 D3–D6, A1 BD-A1-60 and plan §6.1. Verification used a private `git clone --no-hardlinks` at `380d6e4`; the reviewed implementation matches the merge. No Docker or stack ran. No other reviewer's file was opened.

### Finding

**A-LA-E4-04-01 (BLOCKER): a legacy final attempt without a backfilled final record writes new records without `submitted_at` (AC-03).**

- Where: `services/cogniate-app/src/kernel/records/records.ts:55` (`attemptTimes`) and `services/cogniate-app/src/domain/attempts.ts:300` (submission transition).
- Problem: the fallback assumes a completed legacy attempt has a historical `final` record. Migration 014 copied one record per `score_sync`, not per completed attempt. A version whose final score did not beat another version's score had no score sync and therefore has no backfilled record. On its next commit, `before.outcome` is already final, so `submitted` is false; the aggregate finds no historical submission and returns null. Both the new progress record and any new final record then violate AC-03, which requires submission times on records written after the final outcome.
- Evidence: a private probe models two non-preview attempts for the same learner and placement, in different versions. One has a backfilled final/dispatch at score 90. The other was created at 100 and reached score 60 at 500, with stored CMI but no backfilled record. At 2000, an accepted commit changes its location and improves its score to 75. The two new rows are `progressed` and `final`, both with `started_at = 100` and **`submitted_at = NULL`**. The assertion that each new row has a submission time fails. The existing legacy test always seeds a final record, so it misses this valid history.
- Suggested fix: define and implement a stable fallback for an already-final legacy attempt with no historical final record. Capture any chosen historical attempt value before the commit overwrites `updated_at`, and keep the chosen time consistent on later records. Document the approximation with the Architect; do not silently treat the attempt as unsubmitted or use another attempt's time. Add this two-version case to AC-03's tests, including a progress-only commit and a later score improvement. If unknown historical submission times must remain null, the Architect must explicitly revise AC-03 and the legacy rule.

### Checks

| Check | Result |
| --- | --- |
| Progress cannot send a score | `started`, `progressed` and `submitted` call only `insertRecord`. Only a new best final result enters `writeFinalRecord` and the dispatch policy. The existing best-result sequence and dispatch-kind assertions pass. |
| M1 score behavior | The `improves` and final-outcome conditions are unchanged. Progress facts do not alter the stored score or result API. No driver or AGS body changed; tests still pin the original five-field score payload (BD-A1-60). |
| New-attempt times and duplicates | SCORM and HTML tests cover one start, one submission, later improvements retaining the first submission time, resumed sessions, repeated unloads, and excluded session-time/exit changes. A private probe also confirms a final first commit records both times once and a repeated stale unload adds nothing. |
| Transaction and previews | All attempt, session, record and dispatch writes remain in the commit transaction. A private trigger that rejects the `submitted` insert rolls back the earlier progress inserts, attempt update and session update; no dispatch remains. Previews still write no record. |
| UNIT criteria | AC-01 and AC-03 have new SCORM/HTML count and exact-time tests that would fail without progress records. The legacy test covers only histories with a backfilled final record; the missing case is the finding above. |
| Scope and ownership | Only the permitted `domain/attempts.ts` and `kernel/records/**` files changed. No migration, K/L file, `tests/**`, new reporter or LMS core-path name was added. |

### Verification

All commands ran in `/tmp/la-review-a-03baae72b0b6`:

- `npx vitest run services/cogniate-app/src/kernel/records services/cogniate-app/src/runtime-path.test.ts services/cogniate-app/src/drivers/lti-ags packages/tracking`: **12 files, 207 tests passed**, before adding private probes.
- `npx tsc --noEmit -p services/cogniate-app/tsconfig.json`: **passed**.
- Private boundary probes in `kernel/records/records.test.ts`: **2 passed** (rollback and final first commit/stale unload), **1 failed** (legacy submission time). They remain outside the integration worktree; the reproduction above is the durable evidence.

AC-02/AC-04 simulator and golden checks remain for QA. Only this review file was created for this item.
