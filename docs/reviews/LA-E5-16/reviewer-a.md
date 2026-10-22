Verdict: CHANGES_REQUESTED
Round: 1

# LA-E5-16 review: Reviewer-A (lens "Is it right and is it safe?")

- Diff: `git diff 6ae0ebe^1 6ae0ebe` (lane S1, Codex). It holds migration `017`, the plugin and store, and these S1 follow-ups:
  - LA-E5-05 fix round 1 (`lti:bootstrap`, operator client);
  - the audit `traceId` filter (BD-A2-50);
  - the strict `hosts.json` rule in `lib.sh` (BD-A1-53).

  The files at `HEAD` are the same as at `6ae0ebe`.
- References: `docs/architecture/ltiaas/tasks/LA-E5-16.md`; LA-ADR-06 D9 "Build rules" and D4 rule 1; contract delta §4.9, §1.3; A2 BD-A2-50, BD-A2-51; A1 BD-A1-01 v1.1, BD-A1-53.
- I ran on the host (no Docker):
  - Vitest on `http/idempotency`, `store/idempotency`, `store/audit`, `http/operator/audit`, `cli/**` and `api-errors`: 10 files, 187 tests pass.
  - `node --test infra/scripts/lti-bootstrap.test.mjs infra/scripts/sim-hosts.test.mjs`: 42/42 pass.
- Blind review: I did not open the other reviewer's file.
- **Counts: 1 BLOCKER, 1 MAJOR, 0 MINOR, 0 NIT.**

## Checks

| Check | Result |
| --- | --- |
| Another account's answer | Never replayed. The record key is `(tool_account_id, key)` (`017`, primary key). The account comes from the authenticated caller (`caller.account.id`). Authentication runs before the lookup, so a refused or other-account credential never reaches a record. Test: "isolates tenants and rechecks authentication before a replay". |
| Fingerprint, admin routes | Exact. It holds the method, `req.routeOptions.url` (the route template), canonical JSON of the decoded `req.params` (the real platform id), and SHA-256 of canonical JSON of the parsed body. Keys are sorted at every level; arrays, strings and parsed numbers are kept; an absent body is `null`. Another platform id, route or body gives `422` (test), and a reordered body replays (test). For `/api/lineitems`: A-LA-E5-16-01. |
| A crash never blocks a key for 24 h | Correct. A `running` record is valid for 60 s only (`store/idempotency.ts:38`), then the next claim replaces it with a new `owner`. `completeIdempotency` and `abandonIdempotency` act only for the same `owner` and state `running`, so a slow first request cannot overwrite its successor. A `5xx` deletes the claim (test). A completed record is ignored after 24 h (store test). |
| `idempotencyKey` in audit details | Never a credential. `auditDetailsText` keeps a valid key but still runs `redactString`: an `ltis_` API key (48 characters, which fits the 64-character grammar) or an `ltio_` operator key becomes `[redacted-…]`, and a malformed value becomes `[redacted]` (tests). An ltik is a JWT and fails the grammar. The service-key route (`/api/lineitems`) writes no audit event. |
| Audit, one event per admin request | Correct. A replay mirrors the stored answer (`ok` with the stored target, or `refused` with the stored code) and has `details {idempotentReplay: true, idempotencyKey}`. The hook-level `409`/`422` and a bad header write one `refused` event. A claimed request writes only the route's own event. Line items write none. |
| Order and budget | Authentication, scope (`admin` for Bearer) and the rate limit run in the `preHandler` before the claim. The result is cached for the request, so the route spends no second token (test). A limiter `429` comes before the claim and is not stored. |
| Without the header | Unchanged: the hook returns at once when the method, route or header does not match (test, AC-07). |
| S1 follow-ups | `lib.sh` drops the fixed fallback lists (BD-A1-01 change 2), requires the kebab-case id, and refuses a repeated alias or allowlist host (BD-A1-53; table test). The audit `traceId` filter checks its format and is a bound SQL parameter. `--replace-operator-key` writes the new key `0600` through `umask 077`. The bootstrap tells the operator about a possibly committed key after a transport error. |
| "Must not edit" and ownership | Respected. No route file and no `platform/**` file changed. The plugin selects routes by method and template. |

## Findings

- **A-LA-E5-16-01 (BLOCKER): on `POST /api/lineitems`, a key can replay a line item that was created for another platform or course of the same account.**
  - Where: `services/lti-service/src/http/idempotency.ts:17` (rule without a target) and `:61` (`params: canonicalJson(req.params ?? {})`, which is `{}` for this route). The route takes its target from the credential, not from the path: `http/routes/compat.ts:39-41` → `agsContext(ctx, caller, …)` → `platformOf` reads `caller.launch?.platformId ?? caller.serviceKey?.platformId` and the deployment (`http/service-context.ts`).
  - Problem:
    - Two ltiks or service keys of one tool account can point at different platforms, deployments or courses, for example the `cogniate` account with a Moodle site and a Canvas site.
    - When they send the same `Idempotency-Key` with the same body (for example a client key built from the resource id, or `{label, scoreMaximum}` that is the same in two courses), the fingerprints are equal. The second call then gets the first call's `201` and line item id. Its own course gets no line item, and the client stores an id that belongs to another course.
    - Required outcome, LA-ADR-06 D9 "Build rules" (BD-A2-51): "The same key with another fingerprint (another route, another platform, another body) gives `422 IDEMPOTENCY_KEY_REUSED`, so a key used for platform A never replays an answer for B." The dispatch lens says the same: "one key can never replay another account's or another platform's answer".
    - The unit test covers this only for the deployment route, where the platform id is in the path.
  - Suggested fix:
    - For the `ltik` and `service` schemes, put the credential's target into the fingerprint: the platform id, the deployment id, and the context (the launch's line items URL or context id, or the service key's resource link). Then a reuse in another course gives `422`.
    - Add a unit test with two launches of one account on two platforms, and on two courses of one platform.
    - Note: the replay also runs before `platformOf`'s binding checks (platform active, deployment active, generation). With the target in the fingerprint, a replay can only return an answer that was made for this same target, within 24 h.
- **A-LA-E5-16-02 (MAJOR): a platform `429` is stored and replayed for 24 hours, so a retry with the same key can never succeed.**
  - Where: `services/lti-service/src/http/idempotency.ts:81` (every `4xx` is stored) and `:67-70` (a replayed `429` gets its old `Retry-After`). The test "frees a 5xx claim for retry and preserves Retry-After on a cached platform 429" pins this.
  - Problem:
    - `PLATFORM_RATE_LIMITED` (LA-E5-14) is a "wait and retry" answer, not a final one. A client that follows `Retry-After: 12` and retries with the same key gets the cached `429` again, with the same `Retry-After`, for 24 hours. The platform is never called again.
    - The only way out is a new key, and that gives up the protection against a double create.
    - The ruling's text says "Only final answers (`2xx`, `4xx`) are stored and replayed". A `429` is a `4xx` that is not final, so the ruling and its reason do not agree here.
    - The limiter's own `429` comes before the claim and is safe. This applies to the platform `429` from `createLineItem`.
  - Suggested fix: needs an A2 ruling on the contract §4.9 text. Treat `429` like a `5xx`: abandon the claim, so the next call runs. Remove the replay `Retry-After` branch and change the test.

## Notes (no finding)

- A replay sends only the stored status and body with `content-type: application/json` (and `Retry-After` for a `429`). None of the three routes sets other headers today.
- `idempotency_record.key` keeps the raw key for up to 24 h (plus until LA-E5-20's cleanup job). It is not returned by any API. A copied credential is redacted only in the audit trail. That is enough for D9, but the cleanup job should not log the key.
- AC-01, AC-02, AC-03, AC-05 and AC-07 are K1-SIM and wait for QA. The unit tests above cover their logic.
