Verdict: APPROVE
Round: 2

# LA-E5-15 review, lens A ("Is it right and is it safe?")

Reviewer: Reviewer-A2 (Claude Code Opus 5.5 xhigh, plan LD-22). Date: 2026-10-23.
Spec: `docs/architecture/ltiaas/tasks/LA-E5-15.md`. Design: LA-ADR-06 D8; LA-ADR-07 D7; contract delta §1.3, §3, §4.8, §5; BD-A2-47.

Diff: `git diff e67819c^1 e67819c` (15 files: the S2 commits `dd9b587` and `cb4becd`, plus the RQ-2 wiring commits `67582c4` and `0511ece` in S1 files and `0b8ece8` in L files).

Method: a throwaway `git archive e67819c` copy under `/private/tmp`, with a clone of the integration `node_modules`. I ran the LTI service tests (74 files, 929 passed) and 13 mutants in that copy only. I used no Docker and no network. I did not change the integration worktree, except for this file.

## Summary

| Id | Severity | Topic |
| --- | --- | --- |
| A-LA-E5-15-01 | MINOR | No test covers the route wiring of the write-scope check. If you remove the call from the score `POST`, the line item `PUT` or the line item `DELETE`, all 929 tests still pass. AC-05 (K1-SIM) covers only the score `POST`. No AC covers `PUT` or `DELETE`. |

There is no BLOCKER and no MAJOR finding. The lens-A points pass (see "Checks that pass").

## Findings

### A-LA-E5-15-01 — MINOR — the write-scope check has no route-level test

- **Files:** `services/lti-service/src/http/routes/services.ts` (the score `POST`: `await checkServiceKeyWriteScope(ctx, caller, ags, lineItemId);`), `services/lti-service/src/http/routes/compat.ts` (the same call in the `PUT` and `DELETE` handlers of `/api/lineitems/:lineItemId`).
- **Problem:** `http/auth-scope.test.ts` tests `checkServiceKeyWriteScope` directly, with a stub AGS client. No test sends a SERVICE-AUTH-V1 write through a route of a `resource-link` account. Mutants S1 (no call in the score `POST`), S2 (no call in `PUT`) and S3 (no call in `DELETE`) each pass the full LTI service suite (929 passed). AC-LA-E5-15-05 (K1-SIM) will cover the score `POST` later. No AC covers `PUT` or `DELETE`, but LA-ADR-06 D8 lists them as guarded writes. So a later refactor of `compat.ts` (an L file) can drop the guard on two of the three writes, and no test will fail.
- **Risk today:** none. The three calls are present, and each runs after the AGS context checks and before the write.
- **Suggested fix:** add one route test per write (score `POST`, `PUT`, `DELETE`) on a `resource-link` account: a service key of resource link A to a line item of resource link B gives `403 SERVICE_KEY_SCOPE`, and the AGS stub records no write. Or ask QA to add the `PUT` and `DELETE` cases to the AC-05 K1-SIM test.

## Checks that pass

| Item | Result |
| --- | --- |
| A revoked key never authenticates again (lens focus) | Revoke sets `revoked_at`, and `findServiceKey` needs `revoked_at IS NULL`. So the next SERVICE-AUTH-V1 call gets the same `401 INVALID_SERVICE_AUTH_AUTHORIZATION_HEADER` as an unknown key, through the same `reject` path. A re-issue replaces `key_hash` with the value of epoch + 1 and clears `revoked_at` in one transaction, so the old hash is gone. The epoch goes up only, and a binding change does not reset it (store test). So a revoked value cannot come back. A revoke at time 0 also counts (`revoked_at === null`, not a truthy test: mutant S4 is killed). Account close still revokes every key. A closed account cannot reach `GET /api/idtoken` (auth refuses it), so its keys are not re-issued. Platform delete still removes the rows (`ON DELETE CASCADE`; `revokeServiceKeys` has no product caller). |
| Epoch golden (AC-04, the UNIT AC) | Epoch 0 gives today's value for generations 0 and 1 (`todayKey`). Epoch 1 adds the length-framed part `epoch=1` after the generation part, and the test computes this value independently. A negative, fractional or unsafe epoch throws. The migration keeps every old row at epoch 0 and every other column unchanged (the LA-E5-08 migration test). Mutant S11 (`epoch=0` added for epoch 0) fails 4 tests. |
| Re-issue is atomic | The read of the epoch and the `UPDATE` run in one `transaction`, and a failed write rolls back. The test shows that the row stays revoked and that the epoch does not move. Mutant S5 (`revoked_at` not cleared) fails 2 tests. The new `tool_account_id` term in the lookup is safe: a platform row belongs to one account, so the old `UNIQUE (platform_id, deployment_id, context_id, resource_link_id)` cannot meet a row of another account. |
| Revoke boundaries (lens focus) | The body is a strict schema (`platformId`, optional filters, 1–2048 characters), and validation runs before any audit detail. An unknown platform and a platform of another account both give `404 UNREGISTERED_PLATFORM`. The check runs again inside `audit.change`. `revokeScopedServiceKeys` always has `tool_account_id = ?` and `platform_id = ?`, and each filter only narrows. Mutants S8 (no account term) and S10 (no platform check) are each killed. The tenant route needs Bearer with the `admin` scope (`statusGate`; contract delta §1.2 row). The operator route uses `ctx.audited` and gives `404 NOT_FOUND` for an unknown account. |
| Audit | Each successful revoke writes one `service_key.revoke` event, with target `platform` and details `{ platformId, filters, revoked }` (LMS ids only, no secret). A no-match gives `200 { revoked: 0 }` with its event. A failed audit insert rolls back `revoked_at` (test). An invalid body writes one `refused` event with `INVALID_REQUEST`. |
| The scope check cannot be bypassed or cached wrongly across accounts (lens focus) | The check runs only for `service` with `resource-link`, as BD-A2-47 says, and LTIK-AUTH-V2 is unchanged (test). The URL guard runs on every call, also on a cache hit (mutant S9 is killed). Only the exact launch `lineitem` of the key passes with no GET. The cache key is `JSON.stringify([sha256(service key), line item URL])`. The hash is the stored `key_hash`, and one hash belongs to one row, so to one account and one resource link. A re-issued key has a new hash, so it never sees an old result (mutant S6 is killed). The cache is per AGS client, so per process. It holds at most 10,000 entries, a hit moves the entry to the end, and the oldest entry goes out (mutant S13 is killed). The TTL is exactly 10 minutes (mutant S12 is killed). The cache never holds the credential. |
| A platform error never allows a write (lens focus) | The GET is the guarded `getLineItem` (URL check and AGS scope). Its error propagates, so the write does not run. A failed lookup is removed from the cache, so the next request tries again (mutant S7 is killed). Concurrent requests share one in-flight GET, so a failure refuses all of them. A line item with no `resourceLinkId`, or a non-string value, gives `403 SERVICE_KEY_SCOPE`. A platform that grants only the `score` scope cannot pass the GET. Then a write to any line item other than the launch `lineitem` fails closed. |
| Error contract | `SERVICE_KEY_SCOPE` (`403`) is in `KEY_ERRORS` and in the contract §1.3 test list. |
| Ownership and "Must not edit" | `lti/service-keys.ts` and `platform/**` are unchanged. Its `'serviceKey' in issued` branch is still valid, but it is now always true. The edits to `http/app.ts`, `http/operator/index.ts`, `api-errors.test.ts`, `routes/services.ts` and `routes/compat.ts` are separate RQ-2 commits, as the commit message records. Migration 016 is the next free number. No app file and no LMS name in core is changed. |

Note (no finding): any `GET /api/idtoken` re-issues a new key after a revoke, also with an ltik that was made before the revoke. This needs the API key and a live ltik, which are stronger credentials than the service key. The contract says "the next launch", and the key is given out at `GET /api/idtoken` as before LA. So I record this only as a note.

## Round 2

- Reviewer: Codex, Reviewer-A, same lens A. Date: 2026-10-23.
- Diff: `4b7bfd4`, `5c53cd0`, `5fbd89d`, `d2feeac`, `4d0df45`, `3eccb9f`, `001a3d9` (merge `676b7d9`). References: task LA-E5-15, LA-ADR-06 D8, LA-ADR-07 D7, contract delta §3, BD-A2-47 and BD-A2-53, plan §6.1.
- **Verdict: APPROVE. A-LA-E5-15-01 is closed. New findings: 0 BLOCKER, 0 MAJOR, 0 MINOR, 0 NIT.**

| Check | Result and evidence |
| --- | --- |
| A-LA-E5-15-01 — MINOR | Closed. `http/service-key-write-scope.test.ts` uses the mounted application and real SERVICE-AUTH-V1 authentication on a `resource-link` account. Each of score POST, line-item PUT and DELETE refuses another link with `403 SERVICE_KEY_SCOPE` and no AGS write. Each accepts the own-link URL without an ownership GET. Removing each guard separately fails its corresponding no-write assertion. Seven route cases pass, including unchanged cross-link GET. |
| New operator list | `http/operator/platforms.ts:9` checks account existence, then uses the account-filtered store query and an explicit seven-field projection. The response has no binding reference, key, token or registration data. It is mounted inside the existing operator authentication hook. Tests prove exact shape, account isolation, empty list, unknown-account 404, closed-account reads, and 401 for missing/tenant credentials on known and unknown accounts. Every case checks that no audit row was written. |
| Cache extraction | `AuthResult` requires `serviceKeyHash` for the service scheme; production authentication supplies the credential hash only after successful lookup. The cache key remains `[hash, lineItemId]`. The helper preserves the 10-minute fixed expiry, LRU refresh and 10,000-entry bound. The existing scope tests pass for positive and negative caching, concurrent lookup sharing, re-issued credentials, expiry, eviction, URL rechecks and failed-lookup retry. A failed GET still prevents the write. |
| Error text and revoke comments | The status and code remain `403 SERVICE_KEY_SCOPE`. The added text describes the account setting and required launch. The revoke changes are comments only. |
| UNIT AC-04 | The unchanged store test computes epoch 0 and epoch 1 HMAC inputs independently, tests generations 0 and 1, and rejects invalid epochs. The service-key store suite passes, including this golden test. |
| Ownership and frozen behavior | The new operator module is explicitly assigned to S2 in the fix brief. The mount and L fixture changes are the named RQ-2 commits `5c53cd0` and `3eccb9f`. No production AGS route, platform client, launch issue call, app file or QA test changed in this fix. No LMS name was added to core code. |

Validation: private `git clone --no-hardlinks` at `9c87853`, host-only. The combined focused Node run passed 196 tests in 11 files, including the new operator list and write routes, the scope/cache suite and existing compat routes. The additional platform/store run passed 44 tests, including all nine service-key store tests. LTI service typecheck and F1 passed. All three guard-removal mutants failed at the intended assertions. The clone's tracked files were restored. I did not open the other reviewer's file or run Docker, a stack, or stack regressions; those QA gates remain separate.
