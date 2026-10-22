Verdict: APPROVE
Round: 1

# LA-E4-02 review, Reviewer-B (lens: "Can a human team own it?")

Diff: `git diff db7333f^1 db7333f` (lane R commits `3019b06` to `8ddb076`, merged as `db7333f`). Spec: `docs/architecture/ltiaas/tasks/LA-E4-02.md`. Design: LA-ADR-03 D1–D4, D6, D7; LA-ADR-04 D5; data-model §3 (migration `014`); BD-A1-10, BD-A1-46, BD-A2-40. I did not open the other reviewer's file. I did not run Docker.

Counts: **0 BLOCKER, 0 MAJOR, 2 MINOR, 4 NIT.**

The new module is a good base for the record core. `kernel/records/` splits along the model: `placements.ts` (one key encoder), `records.ts` (the record and dispatch-create rule), `outbox.ts` (the queue job with lease, one in flight, recovery and fairness), `job-store.ts`, `types.ts` (the reporter port) and `legacy-reporter.ts`. The migration has one comment per column. The shared store-contract suites now run on the **shipped** app outbox, and the new shared case for AC-13 makes the BD-A1-10 row-error rule a contract for every store. The temporary adapter is marked in its first line ("Temporary port adapter … LA-E4-03 owns its move to drivers/lti-ags"), and so is the shim `domain/score-syncs.ts`.

My MINORs are about the question in the brief, "can a newcomer add a reporter":
- the reporter list is in two places, one of them a hard-coded loop;
- the port's dispatch view carries the fields of the one AGS reporter.

## How I checked

- Scratch clone of `db7333f` in a private `/tmp` folder (`--no-hardlinks`, `node_modules` copied; removed after the run). The shared LA worktree did not change.
- `vitest run services/cogniate-app packages/shared`: **41 files, 614 passed, 2 skipped**. `tsc --noEmit -p services/cogniate-app/tsconfig.json`: exit 0. `eslint services/cogniate-app/src packages/shared/src`: exit 0.
- `node infra/scripts/fitness/rules.mjs`: `F5 PASS: 4 rules … 0 hits`. A probe `SELECT * FROM score_sync …` as an app file gives one `no-score-sync` hit: "score_sync is frozen after migration 014; use record_dispatch (LA-ADR-04 D5)."

## Checks

| Check | Result |
| --- | --- |
| Files and "Must not edit" | New `014_learning_records.sql`, `kernel/records/**`, `infra/scripts/fitness/rules/no-score-sync.mjs`; `domain/{attempts,launch,results,retention,score-syncs}.ts`; `main.ts`, `config.ts`. RQ-2 commits (named in the dispatch): `legacy-wire.ts` and kernel `index.ts` (frozen texts), the F5 baseline and `sql-portability.mjs`, and test fixtures, among them `worker/score-sync.test.ts` (6 lines) under the "Must not edit `worker/**`" row. `packages/shared/src/jobs{,.testkit,.test}.ts` are R's own (LA-E4-01). No `testkit.ts` or `services/lti-service/**` edit. |
| Ownership | R in B2, plus the RQ-2 lines above. OK. |
| No behaviour change outside the spec | The frozen names stay: `sync_…` ids, the `score_sync` log event and `path: 'score_sync'`, the M1 texts (now in `legacy-wire.ts`). Shutdown changes: the app drains the runner with no forced exit timer. See B-LA-E4-02-06. |
| No LMS name in core | The F1 count of `domain/score-syncs.ts` goes from 3 to 0 (the file is now a re-export shim). The F5 `sql-portability` rowid baseline goes from 9 to 7 statements, with one exact allow entry for the `014` backfill (BD-A2-40; RQ-2). The new code is neutral; only comments name LMSs (B-LA-E4-02-04). |
| UNIT ACs fail on the old behaviour | AC-01 and -02 (`migration.test.ts`): the tables did not exist before. AC-03 and -11 (`records.test.ts`, golden T5a/T5b dispatch rows). AC-04 (`describeJobStoreContract` and `describeQueueStoreContract` on `recordsFixture`, plus "a copied in-flight confirmation with no lease sends once…"). AC-12 and -13 (`outbox.test.ts`, and the shared AC-13 case). A stop test proves that a POST in flight records its result before the heartbeat row goes. |

## Findings

### B-LA-E4-02-01 — MINOR — The reporter list is in two places, and the create rule loops over a hard-coded array

- **File:** `services/cogniate-app/src/kernel/records/records.ts:17-18` (`for (const reporter of [legacyAgsPolicy])`); `services/cogniate-app/src/main.ts:45` (`createDispatchQueue(db, [legacyAgsReporter(…)])`).
- **Problem:** A dispatch row is created by `writeFinalRecord` from one hard-coded policy list, and delivered by the outbox from a second list that `main.ts` passes in. A newcomer who adds a reporter must find and edit both, one of them inside core code. If they add it only to the outbox, no row is ever created. If they add it only to the create loop, every row fails after 24 h (see B-LA-E4-02-03). The comment ("LA has one reporter. E4-03 moves this policy into its driver without changing the creation rule") explains the present, but not the target.
- **Suggested fix:** Build the reporter list once in `main.ts`, and pass it to both the create step (`writeFinalRecord(db, record, reporters, now)` takes `RecordReporter` policies, not ids) and the outbox. LA-E4-03 can then add its driver in one place. If that is too large for this round, put the rule in one sentence in `types.ts` above `RecordReporter`: "A reporter is registered in two places until LA-E4-03: …".

### B-LA-E4-02-02 — MINOR — The reporter port's `DispatchView` carries the AGS reporter's fields

- **File:** `services/cogniate-app/src/kernel/records/types.ts:14` (`DispatchView = DueSync & { reporter; partitionKey }`); `services/cogniate-app/src/kernel/records/dispatch-store.ts:13-29` (`DueSync`).
- **Problem:** Every reporter gets `platformResourceLinkId` ("Moodle's resource link id"), `lineItemId` and `serviceKeyEncrypted` in its view of a dispatch, because the view is the old worker's row type. A future reporter (LA-ADR-03 D9: xAPI, vendor APIs) gets fields that make no sense for it, and the port does not show what is generic (id, reporter, partition, payload, tries, the retry window) and what is AGS-only. That makes the port harder to learn than the model behind it.
- **Suggested fix:** Before LA-E4-03 moves the driver, split it: a neutral `DispatchView` with the generic fields, and AGS lookups (line item, service key, platform resource link id) read inside the AGS driver from the placement id. Or at least move the three AGS fields into a nested `lti?: { … }` member, documented as "lti-ags only". Then record the shape in the LA-ADR-03 D9 port line.

### B-LA-E4-02-03 — NIT — An unknown reporter id is logged only as `Error`

- **File:** `services/cogniate-app/src/kernel/records/outbox.ts:109-110`, `:133-137`.
- **Problem:** `throw new Error('Unknown record reporter')` is caught by the row-error rule. The class-only log rule turns it into `internal_error {error: "Error"}` and `last_error` "Internal error (Error).", and then retries the row for 24 hours. The person who forgot to register a reporter (B-LA-E4-02-01) cannot see why.
- **Suggested fix:** Throw a named class, `class UnknownReporterError extends Error {}`, so the log shows `error: "UnknownReporterError"`. Or fail the row at once with a fixed `last_error` that names the reporter id (an id is not secret).

### B-LA-E4-02-04 — NIT — The moved store still speaks "score sync" and LMS names

- **File:** `services/cogniate-app/src/kernel/records/dispatch-store.ts:2-3` (header: "Score sync rows … The rows are made by the commit transaction in attempts.ts"), `:30-34`, `:50`, `:60` ("A disabled Canvas or Blackboard connection … Moodle connections are unchanged"), and the names `DueSync`, `dueSyncs`, `isCurrentSync`, `failDisabledSync`.
- **Problem:** The table is `record_dispatch`, and the rows are now made in `records.ts`. The disabled rule now reads the stored authority (LA-E1-06), not the LMS. A newcomer reads two names for one row, and the comments describe the M1 model. The frozen wire and log names (`sync_…`, `score_sync`) must stay, but code identifiers in the new module do not have to.
- **Suggested fix:** Update the header and the two comments now (comments are not frozen). Plan the identifier renames (`DispatchRow`, `isCurrentDispatch`, `failDisabledDispatch`) for LA-E4-03, when the shim `domain/score-syncs.ts` and the old worker go.

### B-LA-E4-02-05 — NIT — The old worker is no longer started, but its code and tests stay

- **File:** `services/cogniate-app/src/worker/score-sync.ts` (still exports `createScoreSyncWorker`, uses `dueSyncs` and `recoverInterruptedSends`); `services/cogniate-app/src/domain/score-syncs.ts:1-2` (shim).
- **Problem:** `main.ts` now runs the outbox, but the old worker, its tests and its two helpers (`dueSyncs`, `recoverInterruptedSends`, which only it calls) are still in the tree. So for one task window there are two send paths, and only one of them runs. The task may not edit `worker/**`.
- **Suggested fix:** Add one line to the shim header: "`worker/score-sync.ts` is not started since LA-E4-02; LA-E4-03 deletes it with `dueSyncs` and `recoverInterruptedSends`." Make that deletion an explicit item of LA-E4-03.

### B-LA-E4-02-06 — NIT — The app drain has the same Docker stop-time gap as the LTI service

- **File:** `services/cogniate-app/src/main.ts:85-87`.
- **Problem:** "The runner owns its lease-based grace period" means the stop can wait up to the 60 s lease. Docker stops the container after 10 s by default, and compose sets no `stop_grace_period`. A score POST (up to 15 s timeout) in flight at stop is then killed. P2 recovery makes the row uncertain and confirms it, so this is safe, but the restart takes the crash path.
- **Suggested fix:** Use the same answer as B-LA-E5-19-02: a `stop_grace_period` for the app service (S1's compose file, through the Lead), or a bounded drain, plus one `job_runner_stopping` line.

## Not checked

- K0 AC-05 and the K1/MOODLE ACs (QA). The LD-6 T5b fixture change (QA, LA-IC-09).
- Lens-A depth of the recovery SQL and of the partition backfill branches beyond the unit cases.
