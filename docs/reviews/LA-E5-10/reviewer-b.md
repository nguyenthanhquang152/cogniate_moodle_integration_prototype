Verdict: APPROVE
Round: 2

# LA-E5-10 review, Reviewer-B2 (lens: "Can a human team own it?")

## Round 2

Diff: `git diff 36032f3^1 36032f3` (lane S2 fix commits `c0a1f64`, `c60cda4`, `6ef9075`, `3b13658`, `56bad6b`), with A2's BD-A2-23 (409 details) and BD-A2-24 (no active key is not an error). I did not open any reviewer-a file. I did not run Docker.

Counts (this round): **0 BLOCKER, 0 MAJOR, 0 MINOR, 1 NIT.** Both round-1 MINOR findings are **closed**.

How I checked: a scratch clone of `36032f3` (private `/tmp` folder, deleted after the run). `vitest run` on `profiles`, `http/operator/signing-keys.test.ts`, `store/tool-keys-lifecycle.test.ts`, `jobs` and `lti`: **14 files, 197 tests passed**.

### Round-1 findings

| Finding | Status |
| --- | --- |
| B-LA-E5-10-01 (MINOR) | **Closed** (BD-A2-23). `KeyError(code, {description?, details?})` passes details to `ApiErrorBase` (`http/key-errors.ts:13-16`). Each 409 now gives the fact to act on: `NOT_PUBLISHED_LONG_ENOUGH {kid, activatableAt}`, `NEXT_EXISTS {kid, publishedAt}` (the waiting key), `WRONG_STATE {kid, keyStatus}`, `ACTIVE {kid}`. The name is `keyStatus`, not `status`, so it does not collide with the HTTP `status` of the body. AC-14 asserts every shape, and asserts that no `Retry-After` header is set. |
| B-LA-E5-10-02 (MINOR) | **Closed** (BD-A2-24). "No active key" is no longer an error: create makes the key `active` at once (`201 {status: "active"}`), and activate gives `retired: null`. `WRONG_STATE` keeps its one contract meaning. The audit event records `details.status`, and the `retired` log line is skipped when nothing was retired (`signing-keys.ts:67`). |
| B-LA-E5-10-03 (NIT) | **Closed.** `retire` without `{immediate: true}` says what to send and how a key becomes `retired`, with `details.field: "immediate"`. A test asserts the text. |
| B-LA-E5-10-04 (NIT) | **Closed.** Each refusal row has a name (`'activate retired'`, `'retire without immediate'`, …), and every `expect` carries it, so a failure names its row. |
| B-LA-E5-10-05 (NIT) | **Closed in part, accepted.** The tests use `RETIRED_KEEP_MS`, and the migration test has the suggested name ("migration 009 keeps the public set, and the first cleanup clears migrated blobs"). Migration `009` gets no comment. That is correct: `009` is merged, and the migration runner keeps a SHA-256 of each applied file (`packages/shared/src/migrations.ts:69`), so even a comment change would fail on a stack that already applied it. |
| B-LA-E5-10-06 (NIT) | **Closed** (A2 text). Operability §6.1 step 7 now has the note for the time before LA-E5-19. |

Also in this round: the BD-A2-13 and BD-A2-14 code changes are in. Runtime SQL binds `new Uint8Array(0)` (`store/tool-keys.ts`, `jobs/signing-key-cleanup.ts`), and the tests now assert `typeof(private_jwk_encrypted) = 'blob'` and `length = 0`. The CLI rotation removes a waiting `next` key in the same transaction, and a test proves the rollback. Key generation is now async (`generateKeyPair`), so it does not block the event loop.

### New in this round

#### B-LA-E5-10-07 — NIT — `createNextToolKey` can now create an active key

- **File:** `services/lti-service/src/store/tool-keys.ts:114` (`createNextToolKey`, BD-A2-24).
- **Problem:** The doc comment is correct ("Publish a waiting key, or activate it at once when the account has no active key"), but the name says `next`. A caller who reads only the name (for example the LA-E5-05 CLI client) can expect `status: "next"` and miss the recovery case.
- **Suggested fix:** Rename the function to `createToolKey` or `publishToolKey`, or return the status in the name of the result type. The callers are the route and `ensureToolKey`, so the rename is small.

## Round 1

Reviewer: Reviewer-B2, the second lens-B instance (plan LD-22). Diff: `git diff f1f9de8^1 f1f9de8` (the merge of lane S2 for LA-E5-10). Spec: `docs/architecture/ltiaas/tasks/LA-E5-10.md`. Design: LA-ADR-06 D4, D7, D13; contract delta §1.3, §3; operability §6.1; BD-A2-04..08, BD-A2-13, BD-A2-14. I did not open any reviewer-a file. I did not run Docker.

Counts: **0 BLOCKER, 0 MAJOR, 2 MINOR, 4 NIT.**

The lifecycle is easy to follow. The store has one function per transition (`createNextToolKey`, `activateToolKey`, `removeToolKey`) and one check per transition. The route file is 71 lines, and its comments explain why each check runs twice: once before `audit.change`, so that a refusal writes its `refused` event (D4 T3), and once inside the transaction, for callers outside HTTP. The routes, bodies and response shapes equal contract delta §3 row for row. The `signing_key_changed` log line is the one that operability §6.1 step 5 tells the operator to look for. The tests use a controlled clock, a real migration runner with a fake SQL clock, and an audit-failure trigger, so they read like the AC table. My findings are about what an operator can learn from a `409` alone, and about one code that has two meanings.

## How I checked

- Scratch clone of `f1f9de8` in a private `/tmp` folder (`git clone --no-hardlinks`, `node_modules` copied). The shared LA worktree did not change.
- `vitest run` on `http/operator`, `store/tool-keys-lifecycle.test.ts`, `jobs` and `keys`: **6 files, 38 tests passed**.
- Operator probe through `buildOperatorApp` (a temporary test file, deleted after the run). I ran create, early activate, `retire {}`, a second create, and a create on an account with no signing key. I recorded each response body and the log lines (evidence below).
- I compared each route, body and response with contract delta §3 rows 205–208, and each code with §1.3 rows 82–85.

## Checks

| Check | Result |
| --- | --- |
| Files and "Must not edit" | No change to `routes/protocol.ts`, `lti/**`, `platform/token-client.ts` or the app's `canvas-configuration.ts`. The `http/operator/index.ts` and `main.ts` lines are the BD-A2-04 RQ (C6). The S1 tests `audit.test.ts` and `operator-keys.test.ts` now pass a key handle, as C6 asks. One comment line in `packages/shared/src/key-provider.ts` is the HKDF NIT that the merge message names (an S2 file from LA-E5-08). OK. |
| Ownership | Lane S2 for the store, route, job, `key-config.ts` and `key-errors.ts`; the S1 lines came by RQ. OK. |
| No behaviour change outside the spec | The JWKS keeps a retired key for 30 days from `retired_at` instead of from `created_at` (the J-2 fix the spec names). `ensureToolKey` keeps its bootstrap contract. OK. |
| No LMS name in core | The added lines contain no LMS word. OK. |
| UNIT ACs fail on the old behaviour | AC-05 (lifecycle test and route test with env `600`), AC-07 (the old rule counted from `created_at`, so a key created 40 days ago was gone at once), AC-10, AC-11, AC-12, AC-13: each is new behaviour or the J-2 change, so the old tree fails it. OK. |
| Design notes | The key is sealed before `audit.change`, and the test records `db.isTransaction` around `seal` (`signing-keys.test.ts:23-30`, `:102`). An audit failure rolls back create, activate and remove (`:94-120`). OK. |
| BD-A2-13 and BD-A2-14 (clarity only) | Both rulings are clear enough to build and test. BD-A2-13 names the exact bind (`new Uint8Array(0)`), the F5 forms and the allow-list entries. BD-A2-14 gives one transaction and an unchanged stdout, and operability §6.1 already tells the operator. One limit for the team: a test cannot tell a bound empty array from `X''` (both store an empty BLOB). So the runtime part of BD-A2-13 is enforced only by review until its Should (the F5 scan of inline TypeScript SQL) lands. |

## Findings

### B-LA-E5-10-01 — MINOR — A `409` gives the operator no fact to act on: no time, no kid, no state

- **File:** `services/lti-service/src/http/key-errors.ts:11-12`; `services/lti-service/src/store/tool-keys.ts:69`, `:131-132`, `:141`.
- **Problem:** `KeyError` takes only a code, so every key error carries the default sentence. The shared `ApiErrorBase` already supports a per-throw description and `details` extras (`packages/shared/src/errors.ts:51-61`). In each case below, the operator must make another call or read the server env:
  - `SIGNING_KEY_NOT_PUBLISHED_LONG_ENOUGH` does not say when activation becomes possible. The lead time is an env value (`SIGNING_KEY_PUBLISH_LEAD_S`) that the API never shows, so the operator cannot compute it from `GET …/signing-keys` alone.
  - `SIGNING_KEY_NEXT_EXISTS` does not give the kid of the waiting key. Operability §6.1 ("Compromise of the active key", step 1) tells the operator to activate or remove exactly that key.
  - `SIGNING_KEY_WRONG_STATE` does not say the current state.
- **Evidence:** Probe bodies:
  - `{"status":409,"error":"Conflict","details":{"message":"SIGNING_KEY_NOT_PUBLISHED_LONG_ENOUGH","description":"The signing key has not reached the publish lead time."}}`
  - `{"details":{"message":"SIGNING_KEY_NEXT_EXISTS","description":"This account already has a next signing key."}}`
- **Suggested fix:** Let `KeyError` take `(code, options?)` and pass them to `ApiErrorBase`. Add additive `details`: `activatableAt` (ISO) for the lead-time refusal, `kid` of the waiting key for `NEXT_EXISTS`, and `status` (the key's current state) for `WRONG_STATE`. These are new response fields, so the Lead asks A2 to add them to contract delta §1.3. The `refused` audit event can carry the same fields.

### B-LA-E5-10-02 — MINOR — `SIGNING_KEY_WRONG_STATE` also means "the account has no active key", and neither the contract nor the text says so

- **File:** `services/lti-service/src/store/tool-keys.ts:71`, `:134`; `services/lti-service/src/http/key-errors.ts:8`; contract `docs/architecture/ltiaas/contracts/lti-service-api-delta.md:85`.
- **Problem:** The contract row defines `SIGNING_KEY_WRONG_STATE` as "a transition that the key's state does not allow". The code also throws it in two other places. `POST …/signing-keys` throws it when the account has no active key, although that request names no key. `activate` of a valid `next` key throws it when no active key exists. In both cases the description "The signing key cannot make this change from its current state" sends the operator to look at a key whose state is fine.
- **Evidence:** Probe: `POST /operator/v1/accounts/nokey/signing-keys` on an account with no `tool_key` row gives `409 … "SIGNING_KEY_WRONG_STATE","description":"The signing key cannot make this change from its current state."`. The AC-13 test does not cover this case.
- **Suggested fix:** Route to A2. Either add this case to the contract row with its own description, or give it a separate code. A suggested sentence: "The account has no active signing key. Make the first key with lti:bootstrap (or account create, LA-E5-04)." Then pass that description at `:71` and `:134` (with B-LA-E5-10-01), and add one row to the AC-13 table.

### B-LA-E5-10-03 — NIT — `retire` without `{immediate: true}` does not tell the operator what to send or how a key becomes `retired`

- **File:** `services/lti-service/src/http/operator/signing-keys.ts:14`, `:64-65`.
- **Problem:** The route is called `retire`, but it never makes a `retired` key: it makes `removed` keys, and a key becomes `retired` only when its successor is activated. The refusal says only `Invalid field: immediate.`
- **Suggested fix:** A specific description for this case: `retire needs {"immediate": true} (removes the key at once). A key becomes retired when you activate the next key.`

### B-LA-E5-10-04 — NIT — The AC-13 route test runs 12 cases in one loop with no case name

- **File:** `services/lti-service/src/http/operator/signing-keys.test.ts:60-82`.
- **Problem:** When one row fails, the report shows only `expected [409, 'SIGNING_KEY_WRONG_STATE']` and does not say which row. The loop stops at that row, so the other rows do not run. Only three rows have a comment (`// active`, `// retired`, `// removed`).
- **Suggested fix:** Use `it.each` with a name per row (for example `activate a retired key → 409 SIGNING_KEY_WRONG_STATE`), and keep the shared fixture in a `beforeEach`. As a smaller step, pass the path and account as the `expect` message.

### B-LA-E5-10-05 — NIT — The 30-day constant is a bare number in migration `009`, and the migration test is in the job test file

- **File:** `services/lti-service/src/db/migrations/009_signing_key_lifecycle.sql:12`, `:14`, `:16`; `services/lti-service/src/jobs/signing-key-cleanup.test.ts:51`.
- **Problem:** `2592000000` appears three times with no unit. A reader must work out that it is `RETIRED_KEEP_MS` (30 days in milliseconds). The AC-10 migration test is inside the cleanup job's test file, so a developer who changes migration `009` will not find it by name.
- **Suggested fix:** Add one SQL comment: `-- 2592000000 ms = 30 days (RETIRED_KEEP_MS in store/tool-keys.ts)`. This changes no statement, so it can go in before the migration is applied anywhere. Name the test "migration 009 keeps the public set, and the first cleanup clears migrated blobs", or move it next to the other migration tests.

### B-LA-E5-10-06 — NIT — Until LA-E5-19, runbook step 7 is only half true (route to the Lead and A2)

- **File:** `docs/architecture/ltiaas/operability.md:211` (§6.1 step 7).
- **Problem:** Step 7 says that after 30 days the cleanup job "removes A from the key set and zeroes its private part". The job is registered only by LA-E5-19 (S1, B2). Until then, A still leaves the JWKS on time (`publicJwks` filters on `retired_at`). But its status stays `retired`, and its sealed private part stays in the database.
- **Suggested fix:** Add one line to §6.1 or to the board while LA-E5-19 is open: "Until LA-E5-19, the key leaves the key set on time, but its private part is cleared only when the job runs." No code change in this task.

## Not checked

- K1-SIM ACs (AC-01..04, -06, -08, -09) and the LA-IC-10 golden compare (QA).
- Lens-A items: the transaction and race rules beyond the tests, the BD-A2-13 `X''` change and the BD-A2-14 CLI rotation path. A2 has ruled on both, and the code change is for the next round.
