Verdict: APPROVE
Round: 1

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
