Verdict: APPROVE
Round: 1

# LA-E4-03 review, Reviewer-B2 (lens: "Can a human team own it?")

Reviewer: Reviewer-B2, the second lens-B instance (plan LD-22). Diff: `git diff a285bdb^1 a285bdb` (the merge of lane R for LA-E4-03; it also has the LA-E4-02 review fixes). Spec: `docs/architecture/ltiaas/tasks/LA-E4-03.md`. Design: LA-ADR-03 D5–D9; LA-ADR-04 D8 (LA-IC-11, LA-IC-15); BD-A1-27; BD-A2-31. I did not open any reviewer-a file. I did not run Docker.

Counts: **0 BLOCKER, 0 MAJOR, 2 MINOR, 2 NIT.**

The extraction makes the code easier to read:
- **AGS driver:** the AGS transport is one 73-line file, `drivers/lti-ags/index.ts`. It contains the D5 table as one `catch` block, in the order of AC-01, and the 409 text uses `channels.textName` (LA-IC-15).
- **Outcome rule:** `packages/tracking` keeps the neutral rule as `dispatchResult(DeliveryOutcome, …)`, and the old HTTP table has left the package.
- **Outbox:** it gets one `throttled` branch, in one transaction, with a comment ("Undo only this attempt …").
- **Old code removed:** the old worker and the LA-E4-02 compatibility exports are gone (−145 lines and −43 lines).
- **Shutdown:** `shutdown.ts` is a small, tested handler with the BD-A2-31 numbers.

The tests are good. Each rule has a named test:
- the 409 text per channel;
- the throttle cases: tries kept, only the partition paused, new rows and stale snapshots also paused, the 24 h window kept;
- the `everyRecord` refusal;
- the read-back guard.

My MINORs are about the next reporter. The neutral kernel still names `lti-ags` in five places, and the `RecordReporter` contract does not tell a newcomer what to implement or where to register it.

## How I checked

- Scratch clone of `a285bdb` (private `/tmp` folder, `--no-hardlinks`, `node_modules` copied; deleted after the run).
  - `vitest run services/cogniate-app/src packages/tracking`: **559 passed, 2 skipped**.
  - `node --test infra/scripts/fitness/no-score-sync.test.mjs`: 4 of 4 passed.
  - `F1 PASS: 20 files with hits, 74 hits`. `F5 PASS: 6 rules …, 0 hits`.
- Mutations (one at a time, reverted after each). Each one makes named tests fail:
  - no `tries - 1` undo on a throttle: 3 throttling tests;
  - no partition pause in `due`: "… pauses only its partition …";
  - no policy check: AC-08;
  - a fixed "Moodle" in the 409 text: 5 LA-IC-15 tests;
  - read-back without the capability check: AC-06.
- I followed the steps a newcomer must take to add a second reporter, and I searched the app for each `'lti-ags'` literal.

## Checks

| Check | Result |
| --- | --- |
| Files and "Must not edit" | `drivers/lti-ags/**`, `kernel/records/**`, `app/results.ts`, `clients/lti-client.ts`, `packages/tracking/src/{outcome,index}.ts`, and `worker/**` removed. The RQ-2 commit `43f0408` touches `main.ts`, `testkit.ts`, `tool-pages/play.ts` (one import path) and four test files. The no-score-sync fitness rule and `f1-baseline.json` are LA-E4-02 review fixes. There is no change to `status-text.ts`, `html.ts` or `services/lti-service/**`. OK. |
| Ownership | Lane R, B2, plus the RQ-2 lines. OK. |
| No behaviour change outside the spec | LA-IC-15 (the 409 text per channel) and LA-IC-11 are the recorded changes. The M1 log names stay for AGS (`score_sync {sync_id}`). OK. |
| No LMS name in core | F1 passes. The 409 text uses the channel's text name. |
| UNIT ACs | AC-01 (`reporter.test.ts`, the mapping table and LA-IC-15), AC-06 (`results.test.ts`), AC-07 (`connection-state.test.ts`, `results.test.ts`), AC-08 (`throttling.test.ts`). The old tree has no `throttled` kind, no read-back guard and no policy check, so these tests fail there. OK. |
| Can a newcomer add a reporter? | Partly. There is one list in `main.ts` and a neutral `DispatchView`. But see B-LA-E4-03-01 and -02. |

## Findings

### B-LA-E4-03-01 — MINOR — The "neutral" kernel still names `lti-ags` in five places

- **File:** `services/cogniate-app/src/kernel/records/dispatch-store.ts:1` (header: "Delivery state and best-result policy for the neutral outbox"). The literals are in `syncConnectionDisabled` (`:27`, literal at `:29`), `resendSync` (`:114`, literals at `:118` and `:121`), `syncRowInLibrary` (`:140`, `:142`) and `syncRow` (`:146`, `:147`). The outbox log is at `services/cogniate-app/src/kernel/records/outbox.ts:106-107` (`raw.reporter === 'lti-ags' ? 'score_sync' : 'record_dispatch'`).
- **Problem:**
  - This merge moves the results-API helpers of the AGS "score syncs" from `domain/score-syncs.ts` into the neutral kernel file. Each helper keeps a `reporter = 'lti-ags'` filter in its SQL. The outbox also selects its log event and id field by the reporter id.
  - A newcomer who adds a second reporter sees a kernel that names one driver. The newcomer cannot tell which of these places is "the AGS results view, on purpose" and which is "not generic yet". The rows of the new reporter are not in Resend and the results view, and nothing documents this.
  - `failDisabledSync` and `isCurrentSync` are neutral, so the important send rules apply to every reporter. That is good, but a reader cannot see it without reading each statement.
- **Evidence:** `git grep "'lti-ags'" a285bdb -- services/cogniate-app/src` finds the driver itself and also the kernel lines above, plus `domain/results.ts:49`.
- **Suggested fix:** Move the score-sync helpers (`syncConnectionDisabled`, `resendSync`, `syncRowInLibrary`, `syncRow`, `latestSyncStatus`) into `drivers/lti-ags/` or a `score-syncs.ts` next to `app/results.ts`. Or keep them in the kernel and give each one a `reporter` parameter, with one constant `RESULTS_REPORTER = 'lti-ags'` at the results API. For the log, let the reporter give its log names (for example an optional `log: { event: 'score_sync', idField: 'sync_id' }`), or keep the special case and add a one-line comment ("M1 log names for AGS; other reporters log record_dispatch"). A fitness check, or a unit test that greps `kernel/records/**` for a reporter literal, keeps the kernel neutral.

### B-LA-E4-03-02 — MINOR — The `RecordReporter` contract has no member docs, `partitionKey` echoes a value that the kernel already computed, and registration is two calls

- **File:** `services/cogniate-app/src/kernel/records/types.ts:33-44` (`id`, `policy`, `appliesTo`, `prepare` and `partitionKey` have no comment); `services/cogniate-app/src/drivers/lti-ags/index.ts:13` (`partitionKey: (d) => d.partitionKey`); `services/cogniate-app/src/kernel/records/records.ts:47-49` (the kernel computes `placementPartition(db, …)` and passes it to `reporter.partitionKey`); `services/cogniate-app/src/main.ts:48-50` and `services/cogniate-app/src/testkit.ts:380` (`configureRecordReporters(db, reporters)`, then `createDispatchQueue(db, reporters)`).
- **Problem:**
  - A newcomer must learn these rules from LA-ADR-03 and from the AGS driver:
    - what `appliesTo` decides;
    - what `prepare` returns (it is stored as the payload, and `deliver` gets it back);
    - that a `throttled` outcome pauses the **whole** partition;
    - that `deliver` must call `beginSend()` immediately before the remote call, and must return `null` when `beginSend` refuses.
  - `partitionKey` receives a dispatch whose `partitionKey` the kernel has already set. The only reporter returns that value. So the reader cannot tell who decides the partition. The spec says the reporter decides (platform id, or platform + deployment for a shared platform).
  - Registration is two calls with the same list. One call sets a hidden per-`Db` registry for record creation, and the other makes the queue. If a composition forgets the first call, the first final record fails at run time with "Record reporters are not configured".
  - A new reporter id must also go into each channel manifest's `records.reporters`, and read-back needs `records.readBack`. No note in the code says this.
- **Suggested fix:**
  - Add one doc comment per member of `RecordReporter`, and a short "Add a reporter" header in `types.ts`: add a driver folder, add the reporter to the list in `main.ts`, add its id to the manifests' `records.reporters`, and set `records.readBack` only with `readBack`.
  - Choose one owner for the partition. Either the reporter computes it from a documented view (placement, platform, deployment), or remove `partitionKey` from the reporter and document that the kernel decides it.
  - Make one call register both, for example `createDispatchQueue` stores the list for `writeFinalRecord`, or a `registerRecordReporters(db, list)` that returns the queue.

### B-LA-E4-03-03 — NIT — `deliver` makes a row with `"undefined"` strings when the placement row is missing

- **File:** `services/cogniate-app/src/drivers/lti-ags/index.ts:39-42` (`String(target?.resource_link_id)`, `String(target?.channel)`), `:52`, `:63-64` (`.slice(0, 300)` three times).
- **Problem:** When `target` is missing, the row gets `"undefined"` as the platform resource link and as the channel. The code still works, because `serviceKeyEncrypted` is `null` and the result is `NO_GRADEBOOK_COLUMN`. But the reader must trace that path to know it is safe. The 300-character limit is written three times.
- **Suggested fix:** Return `local_failure` with `NO_GRADEBOOK_COLUMN` at once when `!target`, then build the row from a known target. Add one `lastErrorText(text)` helper for the limit.

### B-LA-E4-03-04 — NIT — Old "sync" names stay in the neutral kernel

- **File:** `services/cogniate-app/src/kernel/records/dispatch-store.ts:20` (`failDisabledSync`), `:33` (`isCurrentSync`); `services/cogniate-app/src/kernel/records/records.ts:45` (`randomId('sync_')` for the rows of every reporter); `services/cogniate-app/src/drivers/lti-ags/index.ts:51` (`path: 'score_sync'`).
- **Problem:** The module names are neutral (`record_dispatch`, `DispatchView`, `dispatchResult`), but its functions and ids still say "sync". The `sync_` id and the `score_sync` log are M1 contract values for AGS. The function names are not, so a reader cannot tell which names are frozen.
- **Suggested fix:** Rename the kernel functions (`failDisabledDispatch`, `isCurrentDispatch`). Keep `sync_` and `score_sync` with a comment "M1 contract value (AGS)", or let the reporter give the id prefix.

## Not checked

- K1-SIM AC-02..05 and MOODLE-LIVE AC-09 (QA). The G3 update for LA-IC-15 (lead QA, LD-9).
- Lens-A items: the `due` and `lease` SQL under concurrency, `Math.max(1, tries)` against the old `syncResult` input, and the 24 h cut for a long `Retry-After` beyond the unit row.
