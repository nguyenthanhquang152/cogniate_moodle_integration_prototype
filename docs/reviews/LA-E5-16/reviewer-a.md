Verdict: APPROVE
Round: 3

# LA-E5-16 review: Reviewer-A (lens "Is it right and is it safe?")

## Round 1 (historical)

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

## Round 2

Reviewer: Codex GPT-6-Astra, xhigh. Reviewed `a36d4c5` in merge `836d579` against the task spec, LA-ADR-06 D9, contract delta §1.3/4.9 and BD-A2-56/57/58. Blind review; no Reviewer-B file read.

**Verdict: CHANGES_REQUESTED. Open counts: 0 BLOCKER, 1 MAJOR, 0 MINOR, 0 NIT.**

### Earlier findings

| Id | Status | Evidence |
| --- | --- | --- |
| A-LA-E5-16-01 | Closed | The fingerprint includes platform, deployment, context and the exact line items URL for both credential schemes. Other platforms/courses/URLs give `422`; private probes also changed only the deployment id and got `422`. Authentication, rate limits and `platformOf` checks now precede lookup. Cached and unused keys both respect inactive platforms/deployments, unknown profiles, changed binding generations and suspended accounts, without creating or changing a record. The remaining AGS-scope gap is -03 below. |
| A-LA-E5-16-02 | Closed | `429`, `5xx` and responses with `Retry-After` release the claim. The retry reaches the platform and can succeed; a later replay has no `Retry-After`. The store also refuses to complete a `429`. |

### A-LA-E5-16-03 — MAJOR — replay bypasses the current AGS scope and stores scope refusals

- **Where:** `services/lti-service/src/http/idempotency.ts:28`, `:95` and `:103`; the omitted read-only check is in `services/lti-service/src/platform/ags.ts:260` (`needScope`, defined at `:162`).
- **Problem:** `lineItemTarget` calls `agsContext`, which checks the platform and binding but not the AGS permission for a line item create. The hook can therefore return a cached success to a currently refused caller, or cache its `403` before a later authorized retry. This misses D9's rule that a current target refusal precedes lookup and is never stored or replayed.
- **Evidence:** three private HTTP regression probes fail at `836d579`:
  1. Create a line item with key `review` and a credential with `lineitem` scope: `201`. Use a new ltik with the same four target fields but only `lineitem.readonly`: without the header the route gives `403 SERVICE_NOT_AVAILABLE`; with key `review` it returns the old `201` and line item body.
  2. The same occurs for a service key after `issueServiceKey` refreshes its stored scope to `lineitem.readonly`. The key value stays the same, so this is also a state change on an existing credential. Only the first platform create occurs.
  3. Start with that read-only service key and an unused idempotency key: the `403 SERVICE_NOT_AVAILABLE` creates a completed record. Refresh the service key with full scope and retry: it still returns the stored `403`, with no platform create, for the record's validity period.
- **Suggested fix:** share the read-only line item create preflight (AGS endpoint and required scope) with the guarded AGS client, and run it before `claimIdempotency`. Keep the same refusal as the ordinary route and leave the key unclaimed. Coordinate the shared helper with lane L, which owns `platform/**`; do not solve this only by adding scope to the fingerprint, since that would still claim and store refusals. Add both credential-scheme replay tests and the refused-then-authorized retry test.

### Verification and scope

- Private clone at `836d579`: the shared LA-E5-16/11 focused run passed **187 tests in 10 files**. LTI-service and Cogniate-app TypeScript and ESLint on all 11 changed TypeScript files passed.
- The idempotency probes passed **12** target/binding checks and failed the **3** scope cases above. Four separate mutation controls were detected by the shipped tests: omit the target (1 failure), omit binding checks (1), restore cached `429` behavior (3), and ignore `Retry-After` (1). All mutations were restored.
- UNIT AC-04/06 retain concurrent-request, independent SQLite connection and controlled-clock coverage. BD-A2-58's `409` wait is rounded up to the remaining claim time, at least one second, and is sent in both the details and the header. Hook `409`/`422` responses are not stored. The route-registration check fails startup on a missing selected route.
- No forbidden route or `platform/**` file changed in the reviewed diff, and no LMS-name branch was added. Only this review file was edited for this item in the integration worktree. No Docker, stack or host stack runner was used. K1-SIM evidence remains with QA.

## Round 3

Reviewer: Codex GPT-6-Astra, xhigh. Reviewed `97e9f91` and its lane-L dependency `12f9541`, against the task spec, LA-ADR-06 D9, contract delta §4.9 and BD-A2-71/75. Blind review; no Reviewer-B file read.

**Verdict: APPROVE. Open counts: 0 BLOCKER, 0 MAJOR, 0 MINOR, 0 NIT.**

### Earlier findings and requested checks

| Item | Status and evidence |
| --- | --- |
| A-LA-E5-16-03, current AGS permission | **Closed.** `lineItemTarget` now calls the shared read-only `preflightCreateLineItem` after `agsContext` and before the claim. The actual create route uses the same helper. Endpoint presence, URL validation and `lineitem` scope checks preserve their order and refusals, with no outbound call; the checked URL becomes the fingerprint target. |
| Three round-two failure probes | **All pass.** An ltik without write scope and a service key whose stored scope was narrowed both receive the current `403`, rather than the old `201`. A refused unused key leaves no record, so the same key succeeds after permission is restored. The other 12 round-two target/binding probes also pass. |
| Exact route template | The startup guard collects exact POST templates via `onRoute`. Renaming only `:id` now fails startup; the missing-route test also passes. Restoring `hasRoute` makes the new renamed-parameter test fail. |
| BD-A2-75 / related A-LA-E3-03-01 | **Verified fixed.** No context is `contextId: ""` for both schemes. The earlier six private no-context probes now all pass, including replay in both directions between an ltik and its service key, with one create and the same body. Context-present controls and the service/placement checks stay green. |
| A-LA-E5-16-01/02 | Remain closed. Target isolation, binding checks, retryable-response release, running-claim handling and expiry tests continue to pass. |

### Verification and scope

- Private clone at `c2dd31d`: the shared focused run passed 170 tests in 18 files; it includes all 15 round-two probes and the six no-context probes. The separate platform suite also passes its preflight checks, exact refusal parity and no-I/O assertions.
- Three isolated mutation controls are detected: omit preflight (2 failing shipped tests), restore the non-exact route guard (1), and restore absent-context `null` (1). All mutations were restored. LTI-service TypeScript and ESLint on the reviewed TypeScript files pass.
- UNIT AC-04/06 remain covered by concurrency, independent SQLite connections and controlled clocks. S1 changes only its plugin and colocated tests; the shared AGS helper is the authorized lane-L RQ-1 change. No forbidden route edit or LMS-name branch was introduced.
- Only this review file was edited for this item in the integration worktree. No Docker, stack, host stack runner or commit was used. K1-SIM evidence remains with QA; no author change remains for this round.
