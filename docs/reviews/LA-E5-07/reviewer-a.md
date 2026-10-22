Verdict: APPROVE
Round: 1

# LA-E5-07 review: Reviewer-A (lens "Is it right and is it safe?")

- Diff: `git diff 4d692e1^1 4d692e1` (what the merge added; lane `la-s2`), including `98e40a2` (closed-account guards on the signing-key routes). These files at `HEAD` are the same as at `4d692e1`.
- References: `docs/architecture/ltiaas/tasks/LA-E5-07.md` (with AC-13); LA-ADR-06 D2 ("Operator writes on a closed account"), D5 (with "Backfill values" and "Bridge until LA-E5-05") and D13; contract delta §1.2, §1.3 and §3; A2 BD-A2-09, BD-A2-10 and BD-A2-12. RQ-2 lines: the `http/operator/index.ts` mount, the `KEY_ERRORS` merge in `api-errors.ts`, and the `store/accounts.ts` bridge.
- I ran on the host (no Docker):
  - 8 vitest files, 36 tests pass (`api-key-auth`, `store/api-keys`, `operator/api-keys`, `auth`, `operator/signing-keys`, `store/accounts`, `platforms-audit`, `api-errors`).
  - Two probe scripts outside the repo, on an in-memory database: the closed-account probe for LA-E5-04, and A-LA-E5-07-01.
- Blind review: I did not open the other reviewer's file.
- **Counts: 0 BLOCKER, 0 MAJOR, 1 MINOR, 1 NIT.**

## Checks

| Check | Result |
| --- | --- |
| No key value stored or logged | Correct. `api_key` stores the SHA-256 `hash` and an 8-character display `prefix`. The `prefix` leaves 35 random characters, about 210 bits. The value is returned once, in the issue answer (`store/api-keys.ts` `issueApiKey`; route `http/operator/api-keys.ts`). The list query has no `hash` column, and the list answer has no key. The `api_key_issued`, `api_key_revoked` log lines and the audit details hold the id, label, scopes and expiry only, and `auditDetailsText` runs `redact()` on top. A failed audit insert rolls the issue back without returning a key (test). |
| Revoked and expired keys | Never authenticate. `findActiveApiKey` is the one lookup. Its SQL selects only rows with `revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now)`, and it always reads the row, so a revoke or an expiry works on the next call. A wrong format, unknown, revoked or expired key returns `null`, and `authenticate` turns that into the same `401` code as an unknown key in all three schemes (AC-06: passes at `expires_at − 1 s`, refused at `+ 1 s`; AC-12 unit part). A key of a `closed` account gets the same `401`. |
| Scopes | No bypass found. `authenticate` (`http/auth.ts`) is the only path that turns an API key into an account: every `/api/*` route calls it, and `findAccountByApiKey` has no caller left (A-LA-E5-07-02). After a valid credential, Bearer needs `admin`, and `LTIK-AUTH-V2` and `SERVICE-AUTH-V1` need `launch`. A missing scope gives `403 API_KEY_SCOPE_MISSING`. The test runs each single-scope key through all three schemes. The scope comes from the key row, not from the request. |
| Backfill (AP-06-18, AC-09) | Every account keeps working. `011` inserts one row per account with `hash = api_key_hash`, label `bootstrap`, scopes `["launch","admin"]`, no expiry and `prefix NULL`, as BD-A2-09 says. `randomblob`/`hex` are the D13-listed adapter items. The migration test passes the old key in all three schemes after the frozen column changes. An account closed before `011` gets a row with its unusable hash, and the closed-status check refuses it anyway. |
| Bridge (BD-A2-10) | Rules 1–7 hold. No product code reads `tool_account.api_key_hash` after `011`: the only uses are the two `INSERT`s that write the unusable hash. A new account gets the unusable hash and one `bootstrap` key in the same transaction. Rotation revokes every active key (all labels), then issues the new one, so the limit cannot refuse it. Without rotation, the key does not change. The calls are synchronous, and `api-keys.ts` does not import `accounts.ts`. A failed issue rolls back both a new account and a rotation (test). |
| Limit, expiry, last use | Correct. At most 2 unrevoked, unexpired keys: a pre-check, and the real check inside the issue transaction. Expiry is 1 hour to 2 calendar years, both ends included. `last_used_at` is written at most once a minute: an in-memory throttle, plus an SQL condition that also stops a double write from a second process (AC-10). |
| Closed account (BD-A2-12, AC-13) | Correct. The issue route checks `404`, then `409 ACCOUNT_CLOSED`, then the body, then `API_KEY_LIMIT`, and calls `requireWritableAccount` again inside `audit.change`. List and revoke stay available, and a second revoke keeps the first `revokedAt`. A `suspended` account gets `201`. Close calls `revokeAccountApiKeys` (expired rows too) in the close transaction. `98e40a2` adds the same guard to signing-key create and activate; my probe confirms it (LA-E5-04 note). |
| Audit | One `api_key.issue` or `api_key.revoke` per success (actor `operator:<name>`, no key). One `refused` event per `4xx` (test: a refused issue changes no row). Tenant events now carry the real key id as actor, which closes the B1 `bootstrap-<account>` stand-in (A-LAB-07). |
| UNIT ACs fail on the old behaviour | Yes. AC-06, -09, -10 and -13 need the `api_key` table, the lookup and the new routes. |
| "Must not edit" and ownership | Respected. `lti/**` is unchanged. In `http/routes/**`, only `platforms-audit.test.ts` changes (the actor is now the key id). `auth.ts` is S2's in B2. The S1 lines are the named RQ-2 edits. |

## Findings

- **A-LA-E5-07-01 (MINOR): a mistyped `expiresAt` silently makes a key that never expires.**
  - Where: `services/lti-service/src/http/operator/api-keys.ts:11-15` (`IssueBody` is a plain `z.object`, so unknown keys are dropped).
  - Evidence: `POST /operator/v1/accounts/zz-a/api-keys` with `{label, scopes: ["launch"], expiresat: "<2 h ahead>"}` (lower-case `a`) gives `201`, and the answer has `expiresAt: null`.
  - Problem: expiry is a security control (D5: "Optional, 1 hour to 2 years"). A typo turns a short-lived key into a permanent one. The only sign is `null` in an answer that the operator reads mainly for the key. The account bodies of LA-E5-04 are already `.strict()`.
  - Suggested fix: make `IssueBody` `.strict()`, so an unknown field gives `400 INVALID_REQUEST` naming it. Add one test with the mistyped field. Optionally do the same for the signing-key `ActivateBody`, where a mistyped `force` is harmless (fail closed).
- **A-LA-E5-07-02 (NIT): `findAccountByApiKey` is exported with no caller left, and it skips the scope and status checks.**
  - Where: `services/lti-service/src/store/accounts.ts:107-110`.
  - Problem: BD-A2-10 rule 1 says it "delegates … or is removed when no caller is left". No product code calls it now (only a comment in `store/operator-keys.ts:3` names it). A later route that uses it to find an account from a key would skip `API_KEY_SCOPE_MISSING`, the `suspended` gate and the `closed` check that live in `authenticate`.
  - Suggested fix: remove it, and change the comment in `operator-keys.ts` to name `findActiveApiKey`.

## Notes (no finding)

- `last_used_at` also moves when a valid key is then refused for scope or `suspended` status. That is still a real use of the key, so the rotation check ("`last_used_at` of the old key stops moving") stays right.
- The K1-SIM ACs (AC-01 to AC-05, AC-07, AC-08, AC-11, AC-12) wait for QA-2's Docker window. The unit tests above cover their logic.
