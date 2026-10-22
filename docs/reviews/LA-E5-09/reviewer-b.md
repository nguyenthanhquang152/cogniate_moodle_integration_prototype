Verdict: APPROVE
Round: 2

# LA-E5-09 review, Reviewer-B2 (lens: "Can a human team own it?")

Reviewer: Reviewer-B2, the second lens-B instance (plan LD-22). Diff: `git diff 09516e0^1 09516e0` (the merge of lane S2 for LA-E5-09). Spec: `docs/architecture/ltiaas/tasks/LA-E5-09.md`. Design: LA-ADR-06 D6 ("Re-wrap", "Legacy refusal", "Status"), D11; operability §6.3; contract delta §3, §5; BD-A2-36, -38, -42, -43. I did not open any reviewer-a file. I did not run Docker.

Counts: **0 BLOCKER, 0 MAJOR, 3 MINOR, 2 NIT.**

The task is small, and its parts are easy to find:
- The route file has 20 lines. The status function is 15 lines, and its comment says why expired sessions and removed keys count.
- The job end event has the exact `details` shape of BD-A2-42.
- The refusal setting is two small functions in `settings.ts`. They keep the other keys of the JSON value, and their comments name the transaction rule.
- The provider change is one option (`legacyBlobsRefused`) and one method (`openWithMetadataSync`). `openSync` is now a one-line wrapper, so the two paths cannot differ.

The tests are the strongest part. Each rule of BD-A2-36/42/43 has its own named test:
- the lease margin at 9,999 ms, 0 ms and exactly 10 s, and another lease owner;
- the abort signal, and the compare-and-set skip;
- a legacy row inserted before the final check, and a final check that reaches the lease margin;
- a thrown batch, an unreadable row, and an audit insert failure;
- the BD-A2-38 collision blob.

The route test runs the real runner.

The outcome values are clear when the operator reads the job end event. My first MINOR is that nothing leads the operator from the `202` answer to that event, and a run that did not start also gives `202`.

## How I checked

- Scratch clone of `09516e0` (private `/tmp` folder, `--no-hardlinks`, `node_modules` copied; deleted after the run).
  - `vitest run services/lti-service/src packages/shared/src/key-provider.test.ts`: **72 files, 901 tests passed**.
  - `F1 PASS: 32 files with hits, 184 hits`. `F5 PASS: 3 rules …, 0 hits`.
  - `eslint` on the changed files and `tsc -p services/lti-service --noEmit`: no output.
- Mutations (one at a time, reverted after each). Each one makes a named test fail:
  - re-seal check without `legacyFormat` → AC-07;
  - final check without the `legacy_remains` stop → BD-A2-43 "final verification finds a legacy row …";
  - provider without the refusal line → 4 tests, AC-07 included;
  - lease margin `10_000` → `0` → AC-08 (both rows) and the lease-margin verification test;
  - update without the compare-and-set condition → "compare-and-set preserves a blob …".
- Operator probe (a temporary test with the real operator app and the real runner; deleted after the run):
  - (A) `POST …/rewrap` while the runner is not active;
  - (B) two `POST`s in a row, with the trace ids compared;
  - (C) a key ring whose `legacy` value is wrong (an easy typing mistake in step 3 of §6.3).

## Checks

| Check | Result |
| --- | --- |
| Files and "Must not edit" | `jobs/key-rewrap.ts`, `http/operator/key-provider.ts` and their tests (May edit). The RQ-2 lines in S1 files (named in the merge message): `store/settings.ts` (two helpers), `jobs/index.ts` (one job line and the `keys` option), `main.ts` (the runner is made before the operator app, and is passed to it), `http/operator/index.ts` (the mount line and `jobs` in the context). `packages/shared/src/key-provider.ts` is on the "Must not edit" list. BD-A2-38 ratifies `openWithMetadataSync` in its own commit (`1358e2a`). The `legacyBlobsRefused` option (`a4ec71a`) is what the Scope needs ("from then on `open` refuses"). The spec routes a needed change to "a follow-up in lane S after LA-E5-08", and S2 owns that file (epics §5). So the Lead records it. `jobs.ts` is unchanged. |
| Ownership | Lane S2. `keys/key-config.ts` is S2's (epics §5 matrix). OK. |
| No behaviour change outside the spec | Without the setting, `open` is unchanged (the existing provider tests pass). The runner now gets `keys` in `main.ts` and registers one on-demand job (`everyMs: null`, `runAtStart: false`), so nothing new runs at start. OK. |
| No LMS name in core | F1 passes. |
| UNIT ACs | AC-06: 205 tool keys and one session. The run stops after the first 100-row batch, a second run finishes, and the plaintext and version per row equal a full run. A third run changes no row. AC-07: the refusal is stored, `open` gives `legacy_refused` with the log line, and the row binding and derived keys stay. AC-08: the lease rows, `legacy_remains`, the unreadable row, and the thrown batch. The old tree has no job, no setting and no option, so each test fails there. OK. |
| Can an operator rotate and re-wrap from the API and the runbook alone? | Yes for the normal path: the run takes milliseconds, and step 6 (`sealedCount` 0) is visible in `GET …/key-provider`. Not for the other outcomes: see B-LA-E5-09-01. |
| Are outcome, `stopReason` and counts clear? | Yes in the event. LA-ADR-06 D6 defines each value. Probe C gives `{outcome: "failed", unreadable: 1, unreadableVersions: ["legacy"]}`, which points at the wrong ring value. |

## Findings

### B-LA-E5-09-01 — MINOR — The `202` answer does not lead to the outcome, and a run that did not start also gives `202` (runbook part: route to A2)

- **File:** `services/lti-service/src/http/operator/key-provider.ts:14-18`; operability §6.3 steps 5–6 and the second CAUTION.
- **Problem:**
  - The route records the request event, calls `runNow` without waiting, and always answers `202 {job, traceId}`. When the runner does not start a run, the operator gets the same `202` and the same request event, but no job end event. This occurs when the runner is not `active`, or when another run holds the lease. The only sign is a `job_run {result: "skipped_lease", reason}` log line, and that line has a different trace id.
    - The runner is `waiting` after a start until it claims its instance row. After an unclean stop, that can take until the old heartbeat is stale. `/readyz` does not check the runner, so step 4 ("`/readyz` = 200") does not show it.
    - So an operator who follows step 6 ("Wait until … `sealedCount` 0") waits with no hint.
  - The `traceId` of the `202` finds only the request event. The job end event, which holds `outcome`, `stopReason` and the counts, has the run's own trace id. The run's `key_open_failed` lines have the boot trace id (probe C). So the trace id that the operator gets leads to none of the results.
  - The CAUTION of §6.3 says: remove a version "only after a complete re-wrap (job end `outcome: complete`)". But the runbook does not say how to read that event, or what to do for `partial` or `failed`.
- **Evidence:** Probe A (runner not active): `202`, one request event (`details: null`), no end event, `job_run {result: "skipped_lease", reason: "runner_not_active"}`, and the status unchanged. Probe B: the two `202` trace ids, the end event and the `job_run` lines all have different trace ids. The second `POST` gives a second request event and `skipped_lease` `already_running` (that case is harmless).
- **Suggested fix:**
  - S2: before `audit.change`, check `runner.state() === 'active'`. If it is not active, answer an error and write no request event, for example `503` with "The job runner is not active yet. Try again in 30 s." This needs one line in contract delta §3, so route it to A2. Without a contract change, at least log `key_rewrap_not_started` with the request trace id when `runNow` gives `skipped_lease`.
  - A2, runbook §6.3 step 6: "Read the job end event: `GET /operator/v1/audit?action=key_provider.rewrap&actorId=key-rewrap&limit=1`. `complete`: go to step 7. `partial`: run step 5 again (`stopReason` `lease` or `stopping`), or find the writer of old-format rows (`legacy_remains`). `failed` with `unreadable` > 0: check that each value in the key-ring file is correct (a wrong `legacy` value gives `unreadableVersions: ["legacy"]`), then run step 5 again. No event after 1 minute: look for the `job_run {job: "key-rewrap"}` line."

### B-LA-E5-09-02 — MINOR — Status and readiness read the list of sealed columns from two places that nothing ties together

- **File:** `services/lti-service/src/jobs/key-rewrap.ts:12-18` (`SEALED_COLUMNS`, its `present` predicates and `aadFor`); `services/lti-service/src/keys/key-config.ts:57-58` (`keyVersionsInUse` uses `toolKeyVersions`, `tool-keys.ts:235`, and `registrationTokenVersions`, `registrations.ts:88`); the associated-data builders `tool-keys.ts:20` and `registrations.ts:34`.
- **Problem:**
  - `GET …/key-provider` (`sealedCount`) and the re-wrap use `SEALED_COLUMNS`. Readiness (`ready()`, `/readyz`) uses the store functions. The "present" rule (`length(…) > 0` or `IS NOT NULL`) and the associated-data format are each written twice.
  - Today the two lists agree. But the runbook bases a destructive step on one list, and the service checks the result with the other list. Suppose a later task adds a sealed column, and adds it to its store and `keyVersionsInUse`, but not to `SEALED_COLUMNS`:
    1. The status shows `sealedCount` 0 for `k1`.
    2. The operator removes `k1` (§6.3 step 8).
    3. The service then stays not ready (`key_version_missing`).
    4. The re-wrap reports `complete`, although it never looked at that column.
  - A change of an associated-data format in a store also does not reach `aadFor`. Then every row of that table becomes `unreadable`.
- **Suggested fix:** Keep one list (for example `keys/sealed-columns.ts`, S2) with table, column, row key, "present" rule and associated-data builder. Use it in `keyVersionsInUse`, `keyProviderStatus` and the re-wrap. Add one unit test that reads every `*_encrypted` column of the LTI schema (`PRAGMA table_info` on each table) and asserts that the list has it. The two stores can use the list's builder later. `registrations.ts` is lane L's from B3, so that edit needs an RQ.

### B-LA-E5-09-03 — MINOR — `run()` is one 96-line function, and the row-open code is in it twice

- **File:** `services/lti-service/src/jobs/key-rewrap.ts:44-140`; the two copies are `:59-71` (batch) and `:106-117` (final check).
- **Problem:**
  - Each rule of BD-A2-36, -42 and -43 is in one function:
    - the batch loop, under the label `columns:`;
    - the final check, under the label `verify:`;
    - the outcome rule and the end event.
  - Four closures set the outer variable `stopped` (`:57`, `:102`, `:108`, `:124`), and three different code paths can set the final outcome.
  - The SELECT text and the "open, or count as unreadable" block are written twice, with small differences. The batch copy uses a cursor and `LIMIT`, and it re-seals. The final copy scans everything, and it stops on `legacyFormat`.
  - This job is the one that can make rows unreadable for ever (the refusal), so it is the one a maintainer must change with most care. Today the tests protect it well (each of my mutations failed a named test). But to change one rule, a reader must hold the whole function in mind.
- **Suggested fix:**
  - Extract `rewrapBatch(spec, cursor, ctx)`, `verifyNoLegacy(ctx)` and `finishRun(state, ctx)`.
  - Add one `openRow(spec, row)` that returns `{ opened } | { unreadableVersion }`. Use it in both loops, and keep the SELECT text in one helper.
  - Put the outcome rule in a header comment, as LA-ADR-06 D6 states it: `failed` > `partial` > `complete`, and the three `stopReason` values.

### B-LA-E5-09-04 — NIT — Two optional dependencies let a composition drop the job without a type error

- **File:** `services/lti-service/src/jobs/index.ts:46`, `:54` (`keys?`; the job is added only when `keys` is set); `services/lti-service/src/http/operator/index.ts:41`, `:67` (`jobs?`); `key-provider.ts:12`.
- **Problem:** `main.ts` passes both values, but the types do not ask for them.
  - If a composition leaves out `keys`, the runner has no `key-rewrap` job. The `POST` then gives `202` and a request event, and `runNow` rejects with "Unknown interval job". The operator sees nothing, because the only sign is a `key_rewrap_failed` log line.
  - If a composition leaves out `jobs`, the `POST` gives a `500`.
  - The options are optional because the older tests do not pass them (`jobs/index.test.ts:56-59` and the other `buildOperatorApp` tests).
- **Suggested fix:** Make `keys` required in `createLtiJobRunner`, and pass a test provider in the four old test calls. Or keep it optional, and make the route answer a clear error when the runner has no `key-rewrap` job. Add a comment on `OperatorDeps.jobs` that says that only the key re-wrap route needs it.

### B-LA-E5-09-05 — NIT — The tests mark run boundaries with call counts and give no reason

- **File:** `services/lti-service/src/jobs/key-rewrap.test.ts:72` (`++calls === 100` with `setImmediate(() => controller.abort())`), `:182` (`++calls === 3`), `:197` (`++calls === 102`).
- **Problem:** Each number depends on the order of the job's internal calls:
  - `100`: the last seal of the first batch. The abort task then runs before the job's own `setImmediate` yield, because the queue runs in order.
  - `3`: two batch opens, then the first open of the final check.
  - `102`: the second row of the second batch.

  None of this is written down. A change to the batch size or to the order of the loops makes a test fail, or makes it pass for a different reason. The reader must find out which.
- **Suggested fix:** Add a one-line comment at each count. You can also build the numbers from `KEY_REWRAP_BATCH_SIZE`, for example `const FIRST_VERIFY_OPEN = 3; // two batch opens, then the final check`.

## Not checked

- The K1-SIM ACs AC-01..05 (QA, with the README OC-7 key-ring procedure), and the regression areas T2a..T3c.
- Lens-A items: the cost of the full final scan under the write lock for large tables, a corrupt `key_provider` setting value (the zod parse is inside `open`), and the `examined` set memory for large tables.

## Round 2

Reviewer: Reviewer-B (same lens B). Verdict for this round: **APPROVE**. This round re-checks the round-1 findings against lane S2's fix round 1. Diff: `git diff 3b14a84^1 3b14a84`. The commits are `e4cddc6` (split `run()`), `ed816ed` (setting validated at start), `31d5b22` (one sealed-column list) and `901bebd` (503/409), plus RQ-2 `153f041` (S1 files). I did not open any reviewer-a file. I did not run Docker.

Counts (this round): **0 BLOCKER, 0 MAJOR, 0 MINOR, 0 NIT (new).** All five round-1 findings are **closed** or **fixed**.

### How I checked

- Scratch clone of `3b14a84` (private `/tmp` folder, `--no-hardlinks`, `node_modules` copied; deleted after the run). `vitest run services/lti-service`: **78 files, 983 tests passed**. `tsc --noEmit -p services/lti-service/tsconfig.json`: exit 0.

| Finding | Status | Evidence |
| --- | --- | --- |
| B-LA-E5-09-01 (MINOR) `202` does not lead to the outcome; a run that did not start also gives `202` | **Closed** (S2 and runbook parts) | `http/operator/key-provider.ts:14-16`: a runner that is not `active` gives `503 NOT_READY` with `reasons: ['job_runner_not_active']` and `retryAfter: 30`. The test "a %s runner gives 503, Retry-After, and no event" (`key-provider.test.ts:80`) has rows for `idle`, `waiting`, `stopping`, `off` and a missing runner. `:17-24`: a live lease gives `409 JOB_RUNNING`, checked before the request event and again inside it (test `:92`, same and other owner: "one refused event and no second run"). An expired or unowned lease permits a new run (`:104`). Operability §6.3 step 5 (`:245-248`) now covers `202`, `503` (wait `Retry-After`) and `409`. Step 6 (`:249-253`) tells the operator how to read the end event (actor `system:key-rewrap`, `details.outcome`), what to do for `complete`, `partial` and both `failed` kinds, and what to do when no event comes. **Open, not a finding:** the request trace reaches the run only when the shared runner accepts `runNow(name, { traceId })` (comment at `:25-26`). Until S2's next round, step 6 uses `&since=`, and the runbook says so. |
| B-LA-E5-09-02 (MINOR) two unconnected lists of sealed columns | **Closed** | New `keys/sealed-columns.ts` holds table, column, row key, "present" rule and associated data in one list. Readiness (`key-config.ts:58`), the stores (`tool-keys.ts:21`, `:237`; `registrations.ts:36`, `:91`), the status and the re-wrap (`key-rewrap.ts:30`, `:82`, `:102`, `:158`) all use it. `sealed-columns.test.ts:17` compares the list with every encrypted column of the migrated schema, and `:48-49` fixes both associated-data formats. |
| B-LA-E5-09-03 (MINOR) one 96-line `run()` with two copies of the row-open code | **Closed** | `jobs/key-rewrap.ts` has one function per step: `stopReason` `:20`, `countNotReached` `:28`, `selectRows` `:45`, `openRow` `:49` (used by both loops), `rewrapBatch` `:54`, `rewrapColumns` `:81`, `verifyNoLegacy` `:101`, `finishRun` `:121`. The header `:1` states the rule: "Outcome priority is failed > partial > complete." |
| B-LA-E5-09-04 (NIT) optional `keys` and `jobs` | **Fixed** | `jobs/index.ts:47`: `keys: KeyHandle` is required, and the job is always registered. `http/operator/index.ts:42`, `:69`: a comment says that only the re-wrap route needs `jobs`, and that without it that route gives `503 NOT_READY` (the "missing" test row). |
| B-LA-E5-09-05 (NIT) call-count boundaries without a reason | **Fixed** | `key-rewrap.test.ts:73` uses `KEY_REWRAP_BATCH_SIZE`, `:183` has the comment "Two batch opens, then the first open of final verification.", and `:199` uses `KEY_REWRAP_BATCH_SIZE + 2`. |

- **Also closed:** my round-1 "Not checked" item on a corrupt `key_provider` setting. `ed816ed` validates the setting at start and gives one clear error without the stored value.
- **Ownership note for the Lead (not a finding):** `31d5b22` edits `store/registrations.ts`. It changes only the token associated data and `registrationTokenVersions`. These are the key-provider lines, which are S2's part of the matrix row (`epics.md:579`: "S2: key provider (B1–B2); L: E2-K (B3)"). The commit is not marked RQ-2. If this merge falls in B3, please record it as an RQ-2 line.
