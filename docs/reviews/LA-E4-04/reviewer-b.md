Verdict: CHANGES_REQUESTED
Round: 1

# LA-E4-04 — Reviewer-B

## Round 1

Reviewer: Codex GPT-6-Astra, xhigh. Lens: "Can a human team own it?" Reviewed `ab49b35` (merge `1a40bbd`) against the task spec, LA-ADR-03 D3–D5, data-model §3, BD-A1-60, ownership matrix §5 and plan §6.1. No other reviewer's file was opened.

Counts: **1 BLOCKER, 0 MAJOR, 0 MINOR, 0 NIT.**

The record-writing boundary is clear. `RecordKind` lists the four kinds. `writeCommitRecords` documents their order and triggers and calls the dispatch writer only for `final`. `progressOf` explains the Author's trigger choice: compare stored SCORM CMI without `core.session_time` and `core.exit`, or all stored HTML progress. The adjacent tests show repeated unload, resumed-session and preview behavior. The AGS payload remains the D5 body, as BD-A1-60 requires.

### B-LA-E4-04-01 — BLOCKER — A resumed legacy final attempt can write new records without a submission time

- **File:** `services/cogniate-app/src/kernel/records/records.ts:47–55`, called from `services/cogniate-app/src/domain/attempts.ts:300`.
- **Problem:** `attemptTimes` recovers submission time only from this attempt's `submitted` or `final` record. A pre-014 final attempt can have neither: migration 014 copies only old `score_sync` rows, and a final attempt whose score did not beat another attempt's result had no such row. On resume, the attempt is already final, so `submitsNow` is false. New `progressed` and `final` records then have `submitted_at = null`. This fails AC-LA-E4-04-03 for newly written records after a final outcome. It also contradicts the helper's account of null as the not-yet-submitted state, so a future reporter cannot interpret the field consistently.
- **Evidence:** A private unit probe used the existing records fixture, set the attempt to a pre-upgrade passed result of 60/100 with stored CMI (`created_at = 100`, `updated_at = 500`), and left it without learning records, as the migration can do. A commit at 2000 with changed progress and 75/100 succeeded and wrote `progressed` and `final`; both received `started_at = 100` and `submitted_at = null`. The assertion that newly written records have a submission time failed. The shipped legacy test always inserts `rec_old`, so it misses this case. The Lead confirmed through orchestration that there is no approved legacy exception; BD-A1-60 only preserves the AGS body.
- **Suggested fix:** Agree the historical fallback with Architect A1, document its approximate meaning, and use it consistently for an already-final attempt that has no prior record. For example, preserve the pre-commit attempt state and a suitable last-known time for that decision rather than losing them during the update. Add a regression test with no copied score row, and check a later resumed commit keeps the same chosen time. Do not rewrite immutable old records or add submission fields to the AGS body as part of this fix.
- **Severity:** BLOCKER under charter §5 because UNIT AC-03 fails. Grade dispatch itself remains unchanged.

### Evidence

Execution used a private `git clone --no-hardlinks` at `380d6e4`, with copied dependencies and unchanged lockfile. The reviewed product files were unchanged at the later integration checkpoint.

- `vitest run services/cogniate-app/src packages/tracking/src`: **640 passed, 2 skipped**, plus one 5-second timeout in the unrelated audit CLI suite during concurrent verification. An isolated rerun of that entire suite passed **26 tests** in 3.40 seconds; no product assertion failed in the baseline run.
- The records suite passed **9 tests**, including both UNIT ACs, after restoring the mutations below. The private missing-history probe failed as described in B-01.
- Replaced only `domain/attempts.ts` and `kernel/records/records.ts` with their `ab49b35^` versions in the clone. All **four selected AC-01/03 tests failed** on missing kinds or timestamps. Restored both files afterward.
- App TypeScript passed. F1 passed (9 files, 29 hits; baseline-reduction notices only). F5 passed (six rules, zero hits).
- The existing final-record tests still pin the exact AGS payload. The new record tests join dispatches to their records and show only `final` rows; progress, resumed sessions and previews are covered without changing grade-return expectations.

### Scope and remaining work

The diff changes only lane R's `domain/attempts.ts`, `kernel/records/records.ts` and their adjacent records/throttling tests. No migration, K/L file, QA test, new LMS name or new reporter is added. The times stay in storage; the driver and score body are unchanged. Resolve B-01 and add its regression before approval. K1-SIM AC-02/04, golden comparison and score-area stack regressions remain QA work; no Docker, stack or stack-starting host runner was used.
