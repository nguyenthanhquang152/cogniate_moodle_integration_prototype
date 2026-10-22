Verdict: APPROVE
Round: 1

# LA-E5-15 review, Reviewer-B2 (lens: "Can a human team own it?")

Reviewer: Reviewer-B2, the second lens-B instance (plan LD-22). Diff: `git diff e67819c^1 e67819c` (the merge of lane S2 for LA-E5-15). Spec: `docs/architecture/ltiaas/tasks/LA-E5-15.md`. Design: LA-ADR-06 D8; LA-ADR-07 D7; contract delta §1.3, §3, §4.8, §5; operability §6.5; BD-A2-12, BD-A2-47. I did not open any reviewer-a file. I did not run Docker.

Counts: **0 BLOCKER, 0 MAJOR, 2 MINOR, 3 NIT.**

The change is small, and each part is easy to follow:
- **Revoke:** one store function (`revokeScopedServiceKeys`) with one WHERE list for the optional filters. The tenant route and the operator route share one body schema and one function, `revokeServiceKeyScope`.
- **Re-issue:** one line, `issue_epoch + (revoked ? 1 : 0)`, inside one transaction. The comment says why ("A second launch must see the new epoch").
- **Epoch 0:** keeps the old HMAC input. The doc comment and the golden test both say so.
- **Migration 016:** one `ALTER` with a `CHECK`, and a comment.
- **Refusals:** each has a known code: `400 INVALID_REQUEST` for a bad filter, `404 UNREGISTERED_PLATFORM` for an absent or foreign platform, `200 {revoked: 0}` for a filter with no match, and `403 API_KEY_SCOPE_MISSING`. Each refusal is audited.

The unit tests are good and a human can keep them:
- AC-04 is a golden test against an independent HMAC build, for generation 0 and 1.
- The re-issue tests cover "advances exactly once", "a revoke at time 0 counts", "a failed write rolls back", and "all filters, only this account".
- The cache tests cover the exact 10-minute boundary, the LRU bound at 10,000, a shared in-flight GET, a retry after a platform error, and the URL guard before a cache hit.

My MINORs are about two gaps. First, no test proves that the three write routes call the scope check. Second, an operator cannot find the `platformId` that the revoke needs.

## How I checked

- Scratch clone of `e67819c` (private `/tmp` folder, `--no-hardlinks`, `node_modules` copied; deleted after the run).
  - `vitest run services/lti-service/src`: **929 tests passed**.
  - `F1 PASS: 31 files with hits, 183 hits`. `F5 PASS: 4 rules …, 0 hits` (migration `016` passes `sql-portability`).
- Mutations (one at a time, reverted after each):
  - remove the `checkServiceKeyWriteScope` calls from line item `PUT` and `DELETE` (`compat.ts`): **all 929 tests still pass**;
  - remove the call from score `POST` (`services.ts`): **all 929 tests still pass**;
  - the epoch never advances: 3 named tests fail.
- I read every refusal text, and I followed runbook §6.5 with the operator API alone.

## Checks

| Check | Result |
| --- | --- |
| Files and "Must not edit" | S2 files: `store/service-keys.ts`, `http/auth.ts`, the new `routes/service-key-admin.ts`, the new `operator/service-keys.ts`, `key-errors.ts`, and migration `016`. `http/app.ts` and `operator/index.ts` get the two mount lines (RQ-2, S1). `routes/services.ts` and `routes/compat.ts` are on the "Must not edit" list (L). They get the scope-check call in an RQ-2 commit (`0b8ece8`), because the Scope needs that call and the spec lists no RQ-1 line for it, so the Lead records it. `lti/service-keys.ts` and `platform/**` are unchanged. No app file changed. |
| Ownership | Lane S2 (epics §5 matrix: `http/operator/service-keys.ts`, `store/service-keys.ts`). OK. |
| No behaviour change outside the spec | Epoch 0 keeps today's key value (golden test). The scope check returns at once unless the caller uses SERVICE-AUTH-V1 and the account has `resource-link`. One intended change: a revoked row now gets a new value at the next launch, where before the launch got no key. That is the Goal. |
| No LMS name in core | F1 passes. |
| UNIT AC | AC-04: the epoch-0 key equals `todayKey`, and epoch 1 equals an independent HMAC with `epoch=1`. On the old code the fifth argument has no effect, so epoch 1 equals epoch 0 and the test fails. OK. |
| Can an operator revoke and re-issue from the API alone? | Revoke: yes, if the operator has the `platformId` (see B-LA-E5-15-02). Re-issue: no call is needed, because the next launch gives a new key. §6.5 step 2 tells the operator to say this to the library. |

## Findings

### B-LA-E5-15-01 — MINOR — No test proves that the three write routes call the scope check, so a refactor can remove a call and every test still passes

- **File:** `services/lti-service/src/http/routes/services.ts:53` (score `POST`); `services/lti-service/src/http/routes/compat.ts:48`, `:55` (line item `PUT`, `DELETE`); `services/lti-service/src/http/auth-scope.test.ts` (calls `checkServiceKeyWriteScope` directly).
- **Problem:**
  - The design says the check runs for exactly three writes. Every test of `SERVICE_KEY_SCOPE` calls the function directly.
  - AC-05 (K1-SIM) proves the score `POST` later on a stack. Nothing at any level proves line item `PUT` or `DELETE`, or that read routes (line item `GET`, memberships) do not call the check.
  - The call sites are in lane L's files, so the person who refactors them is not the author of the control. If a call is lost, the account setting `resource-link` silently stops protecting that route.
- **Evidence:** In the mutation run, I removed the calls from `compat.ts` (`PUT`, `DELETE`) and, separately, from `services.ts` (`POST`). All 929 tests passed both times.
- **Suggested fix:** Add one route test (with the testkit harness and a fake AGS client) for an account with `serviceKeyWriteScope: 'resource-link'`:
  - with a service key of resource link A, `POST …/scores`, `PUT` and `DELETE` on a line item of resource link B each give `403 SERVICE_KEY_SCOPE`, and the fake client gets no write;
  - the same three calls on A's own `lineitem` pass;
  - a `GET` of B's line item is not refused.

  Name the test after the design-note sentence, so that a lane-L author sees why it fails.

### B-LA-E5-15-02 — MINOR — The operator API gives no way to find the `platformId` that the revoke needs (runbook part: route to A2)

- **File:** operability §6.5 step 1 (`POST /operator/v1/accounts/<id>/service-keys/revoke {platformId, …}`); `services/lti-service/src/http/operator/accounts.ts:41-56` (the account view has no platforms); the operator mount list (there is no platform read route).
- **Problem:**
  - In an incident the operator knows the account and maybe the LMS site, but not the internal `plt_…` id. No operator route lists an account's platforms.
  - The audit log records `platform.create` (`routes/platforms.ts:175`; its `target.id` is `null` at the request). But the platforms of an existing `cogniate` stack were made in M1, before the audit table existed, so they have no event. No runbook step says to take the id from audit details.
  - So the runbook step can be done only with the tenant's API key (`GET /api/platforms`) or by reading the database. An operator of an incident cannot always get either.
  - A wrong id gives `404 UNREGISTERED_PLATFORM` "Unknown platform id.", and nothing says where to find the right one.
- **Suggested fix:** A2 decides one of these:
  - (a) a read route, for example `GET /operator/v1/accounts/:id/platforms`, which returns id, issuer, client id and name. This needs one contract delta §3 line.
  - (b) a runbook line: "Find the platform id with the library's API key: `GET /api/platforms`; match the issuer and the client id."

  In both cases, the `404` text can add "List the account's platforms to find the id."

### B-LA-E5-15-03 — NIT — The `SERVICE_KEY_SCOPE` text names the wrong object and no rule

- **File:** `services/lti-service/src/http/key-errors.ts:7` ("The service key cannot write to this resource link.").
- **Problem:** The refused target is a **line item**, either one with another `resourceLinkId` or one with none. The text says "resource link". It also does not name the account setting that causes the refusal. A tenant developer who sees the `403` in a dispatch error cannot tell what to change.
- **Suggested fix:** For example: "This service key can write only the line items of its own resource link (account setting serviceKeyWriteScope: resource-link). Use the service key of a launch from the line item's resource link."

### B-LA-E5-15-04 — NIT — The scope function holds a hand-written TTL and LRU cache, with branches for a hash that is always set

- **File:** `services/lti-service/src/http/auth.ts:105-148` (`checkServiceKeyWriteScope`); `:52` (`serviceKeyHash?`); `:126` (`cacheId` is `undefined` when the hash is missing).
- **Problem:**
  - About 25 of the 40 lines are cache logic: expiry on read, the delete-and-set step that moves an entry to the end, eviction of the first key, and removal of a failed lookup. The rule ("own `lineitem` passes; else one GET; a match is allowed") is mixed into that code.
  - `authenticate` always sets `serviceKeyHash` for the `service` scheme. So the three `cacheId === undefined` branches exist only for hand-built test callers.
- **Suggested fix:** Extract a small `ttlLruCache({ ttlMs, limit })` with `get`, `set` and `delete`. The existing cache tests then test it through the function, as today. Make `serviceKeyHash` required when `scheme` is `service` (a union type), and remove the `undefined` branches.

### B-LA-E5-15-05 — NIT — Two small readability points

- **File:** `services/lti-service/src/http/routes/service-key-admin.ts:28-34`; `services/lti-service/src/lti/service-keys.ts:24`.
- **Problem:**
  - `requireScope()` runs twice, once before `audit.change` and once inside it, with no comment. The reader must guess the reasons: the first call gives an audited refusal, and the second call checks again under the write lock.
  - `issueServiceKey` no longer returns `{ revoked: true }`. But lane L's caller still has `'serviceKey' in issued ? … : undefined`, and that branch is now dead.
- **Suggested fix:** Add a one-line comment on each `requireScope()` call. Send one RQ-1 line to L to simplify the caller to `issued.serviceKey`.

## Not checked

- The K1-SIM ACs AC-01..03 and AC-05..07, and the regression areas T3a, T3c, T5a and T5b (QA).
- Lens-A items: cache isolation across accounts beyond the key hash, the GET guard against a hostile line item URL beyond the unit row, and the race between a revoke and a launch beyond the transaction test.
