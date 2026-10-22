Verdict: APPROVE
Round: 1

# LA-E5-07 review, Reviewer-B (lens: "Can a human team own it?")

Diff: `git diff 4d692e1^1 4d692e1` (lane S2 commits `cd2ba5f` to `98e40a2`, merged as `4d692e1`). Spec: `docs/architecture/ltiaas/tasks/LA-E5-07.md`. Design: LA-ADR-06 D2 and D5, contract delta §1.3 and §3, BD-A2-09, -10, -12. I did not open the other reviewer's file. I did not run Docker.

Counts: **0 BLOCKER, 0 MAJOR, 0 MINOR, 5 NIT.**

An operator can rotate keys with the API and its error answers alone:
1. `GET …/api-keys` lists the keys. The migrated key shows label `bootstrap`, `createdBy` `system:bootstrap` and `prefix` `null`; new keys show their 8-character prefix and `lastUsedAt`.
2. `POST …/api-keys` returns the new key once. A third active key gives `409 API_KEY_LIMIT` ("This account already has two active API keys.").
3. The operator watches the old key's `lastUsedAt` stop moving, then calls `…/revoke`. A second revoke is idempotent; an unknown id gives `404 "Unknown API key."`.

A missing scope says what is missing ("The API key needs the admin scope."), and a closed account answers `409 ACCOUNT_CLOSED` on issue but still allows list and revoke. The store is small and easy to read, and the tests read like the rules. I have only NITs, about names, repeated checks with no comment, one dead function and log fields.

The tenant audit actor now comes from `http/auth.ts` (`actor: { type: 'api_key', id: key.id }`). So this task switched the actor in its own file, as my LA-E5-02 finding B-LA-E5-02-02 suggested.

## How I checked

- Scratch clone of `4d692e1` in a private `/tmp` folder (`--no-hardlinks`, `node_modules` copied; removed after the run). The shared LA worktree did not change.
- `vitest run services/lti-service`: **49 files, 595 tests passed**. `tsc --noEmit -p services/lti-service/tsconfig.json`: exit 0. `eslint services/lti-service/src`: exit 0.
- I walked the rotation flow above through the routes, the error table and `toApi`.

## Checks

| Check | Result |
| --- | --- |
| Files and "Must not edit" | New `store/api-keys.ts`, `http/operator/api-keys.ts`, migration `011_api_key.sql` and their tests; `http/auth.ts` and `http/key-errors.ts` (S2). One line each in the S1 files `http/operator/index.ts` (mount) and `api-errors.ts` (merge). The `accounts.ts` bridge is the Lead's process call. `signing-keys.ts` is S2's. **One edit is under "Must not edit `http/routes/**`"**: `http/routes/platforms-audit.test.ts` (L in B2) changes three expectations from `bootstrap-<account>` to the real key id. The actor switch makes that change necessary, and it changes no product code. The Lead should record it as an RQ line. |
| Ownership | As above. No `lti/**` or app file. |
| No behaviour change outside the spec | Auth reads the `api_key` table. A key without the needed scope gets `403` (only new keys can lack a scope). Close revokes the rows. The bridge keeps the `lti:bootstrap` JSON line and the key files. The new `requireWritableAccount` calls in the signing-key routes are BD-A2-12 (D2 "Operator writes on a closed account"). |
| No LMS name in core | None added. |
| UNIT ACs fail on the old behaviour | AC-06: `api-key-auth.test.ts` (Bearer at expiry ±1 s). The old lookup had no expiry, so the +1 s call passed. AC-09: the same file, a migration backfill check on old hashes; the table did not exist before. AC-10: `store/api-keys.test.ts`, with a temp trigger that records each `last_used_at` write (exactly two writes in 60 s). AC-13: `operator/api-keys.test.ts` ("closed status precedes body errors; reads and idempotent revoke stay available"). Other tests cover the account scope, the limit, the bridge rollback, and an audit insert failure that rolls back the issue without showing the new key. |

## Findings

### B-LA-E5-07-01 — NIT — `findActiveApiKey` also writes

- **File:** `services/lti-service/src/store/api-keys.ts:101-119`.
- **Problem:** The name says "find", but the function also updates `last_used_at` (at most once a minute) and keeps an in-memory map per database. The design note asks LA-E5-03 to use "this same lookup" for its `auth_failure` rule. A later caller that only wants to classify a credential (a CLI check, a health view) will mark the key as used without knowing.
- **Suggested fix:** Rename it to what it does, for example `useApiKey` or `authenticateApiKey`. Or split it: a pure `findActiveApiKey`, plus `touchApiKeyUse(db, key, now)` that only `authenticate` calls. Keep one comment on the throttle.

### B-LA-E5-07-02 — NIT — The issue route runs each refusal check two or three times, with no comment

- **File:** `services/lti-service/src/http/operator/api-keys.ts:29`, `:35-38`; `services/lti-service/src/store/api-keys.ts:84-87`.
- **Problem:** `requireWritableAccount` runs before the body parse and again inside `audit.change`. `validateApiKeyIssue` and `requireApiKeySlot` run before `audit.change`, and `issueApiKey` runs both again inside its transaction. The reason is rule T3 (refuse before the change) plus a second check against a race. Only the signing-key route says so in a comment. Someone who "cleans up" one copy can break either rule.
- **Suggested fix:** Copy the one-line comment from `signing-keys.ts` ("refuse before audit.change (D4 T3); repeat inside the transaction against a race"). Or make `issueApiKey` the one place for the in-transaction checks and keep only the T3 pre-checks in the route.

### B-LA-E5-07-03 — NIT — `findAccountByApiKey` has no product caller left

- **File:** `services/lti-service/src/store/accounts.ts:106-110` (and the header `:1`, "Tool accounts and their API keys"); `services/lti-service/src/store/operator-keys.ts:3` (a comment that names it).
- **Problem:** BD-A2-10 rule 1 says the function "delegates … or is removed when no caller is left". Only tests call it now. It also has a `now = Date.now()` default, which no other store function has. A reader may take it as the auth path.
- **Suggested fix:** Remove it, and let the tests use `findActiveApiKey` plus `getAccount`. Update the two comments.

### B-LA-E5-07-04 — NIT — The key log lines have no trace id

- **File:** `services/lti-service/src/http/operator/api-keys.ts:42`, `:52`.
- **Problem:** `api_key_issued` and `api_key_revoked` log only `tool_account_id` and `api_key_id`. An operator cannot join the log line with the audit event (which has `traceId`) or with the request line. S1's `account_status_changed` carries `trace_id`. (S2's older `signing_key_changed` lacks it too.)
- **Suggested fix:** Add `trace_id: req.traceId` to both lines, and to `signing_key_changed` the next time that file changes.

### B-LA-E5-07-05 — NIT — The limit error does not say what to do

- **File:** `services/lti-service/src/http/key-errors.ts:6`.
- **Problem:** "This account already has two active API keys." is correct, but the next step is to revoke one, and the answer does not say so. On a test volume where `POST /operator/v1/accounts` ran before this migration, an unusable `bootstrap` row also takes a slot (LA-ADR-06 D5). There the operator meets the limit after only one issue and has no hint why.
- **Suggested fix:** Extend the description: "… Revoke one first (GET …/api-keys lists them)." The code and status stay frozen.

## Not checked

- K1-SIM AC-01 to -05, -07, -08, -11, -12 (QA). The emergency CLI path writes no audit event by design (BD-A2-10 rule 6; LA-E5-05 closes it).
