Verdict: APPROVE
Round: 2

# LA-E5-16 review, Reviewer-B (lens: "Can a human team own it?")

Diff: `git diff 6ae0ebe^1 6ae0ebe`. The LA-E5-16 commits are `77ce0f5`, `23113fe` and `d017926`. The same merge holds S1 follow-ups: `541e13e` (LA-E5-05 fix round 1, reviewed in `docs/reviews/LA-E5-05/reviewer-b.md`), `a3fadc4` (audit `traceId` filter, BD-A2-50), and `04fbf4e`, `a84ba2f` (`lib.sh` strict host rules, BD-A1-53). Spec: `docs/architecture/ltiaas/tasks/LA-E5-16.md`. Design: LA-ADR-06 D9 (BD-A2-51), contract delta §1.3, §4.9, §7. I did not open the other reviewer's file. I did not run Docker.

Counts: **0 BLOCKER, 0 MAJOR, 1 MINOR, 1 NIT.**

The middleware is small and easy to own. `http/idempotency.ts` (91 lines) has one table of the three routes, and one `preHandler` that authenticates, checks the header and claims or replays. One `onSend` stores a `2xx`/`4xx` answer or frees the claim. `store/idempotency.ts` (73 lines) does the claim in one transaction with an owner fence, so a late, abandoned request cannot overwrite its successor. `app.ts` caches the auth result per request, so the hook and the route share one authentication and one budget charge, and a comment says so. The bad-header refusal is clear: "Invalid field: Idempotency-Key. Use 1 to 64 letters, digits, underscores or hyphens." The tests cover the BD-A2-51 rules one by one: reorder replay, another platform id or body gives `422`, `5xx` frees the key, stale running claim, tenants isolated, one admin token per call.

## How I checked

- Scratch clone of `6ae0ebe` in a private `/tmp` folder (`--no-hardlinks`, `node_modules` copied; removed after the run). The shared LA worktree did not change.
- `vitest run services/lti-service`: **76 files, 956 tests passed**. `tsc --noEmit -p services/lti-service/tsconfig.json`: exit 0. `eslint services/lti-service/src`: exit 0. `node --test infra/scripts/lti-bootstrap.test.mjs infra/scripts/sim-hosts.test.mjs`: 42 of 42.

## Checks

| Check | Result |
| --- | --- |
| Files and "Must not edit" | New `http/idempotency.ts`, `store/idempotency.ts`, migration `017_idempotency_record.sql` and tests; `http/app.ts` (plugin registration and the per-request auth cache); two codes in `api-errors.ts`. No change to `routes/platforms.ts`, `routes/compat.ts`, `routes/services.ts` or `platform/**`: the plugin selects the routes by method and template. The follow-ups (`lib.sh`, `lti-bootstrap.sh`, `cli/**`, `store/audit.ts`, `operator/audit.ts`) are S1's own files. |
| Ownership | S1 in B3. OK. |
| No behaviour change outside the spec | Without the header, nothing changes ("keeps requests without the header and other methods outside the plugin"). The auth cache keeps one charge per request. |
| No LMS name in core | None. |
| UNIT ACs | AC-04: "a concurrent line item call gets 409 while the first runs, with no admin audit event" (`http/idempotency.test.ts:155`), and the store test "arbitrates claims across independent SQLite connections" (`store/idempotency.test.ts:50`). AC-06: "expires completed answers at 24 hours without deleting unrelated old rows" (`:78`). The table did not exist before, so both fail on the old tree. |
| Also in this diff | BD-A1-53 makes `lib.sh` refuse a repeated host and a non-kebab `id`, and removes the fixed fallback. So the infra and the simulator now read `hosts.json` with one rule, which closes my LA-E7-02 finding B-LA-E7-02-01 on the infra side. |

## Findings

### B-LA-E5-16-01 — MINOR — The `409` and `422` refusals do not tell the client what to do next

- **File:** `services/lti-service/src/api-errors.ts` (`IDEMPOTENCY_KEY_REUSED`: "This Idempotency-Key was used for another request."; `IDEMPOTENCY_IN_PROGRESS`: "A request with this Idempotency-Key is still running."); `services/lti-service/src/http/idempotency.ts:73-75` (`throw new ApiError(code)`, no details).
- **Problem:** A tenant developer who gets `409 IDEMPOTENCY_IN_PROGRESS` does not know whether to retry, or when. The claim ends when the first call answers, or after 60 s (`IDEMPOTENCY_RUNNING_MS`). The service already has one generic rule for this: `details.retryAfter` plus the `Retry-After` header (BD-A2-16). A developer who gets `422 IDEMPOTENCY_KEY_REUSED` reads "another request", but not what counts as "another" (route, path id or body) or how long the key stays taken (24 hours).
- **Suggested fix:**
  - `409`: add `details: { retryAfter: <seconds until the 60 s claim ends, at least 1> }`, so the existing error handler also sends `Retry-After`. Use the description "A request with this Idempotency-Key is still running. Retry after the time in Retry-After."
  - `422`: "This Idempotency-Key was used in the last 24 hours for a request with another route, path id or body. Use a new key for a new request."
  - Add one assert per code to the existing tests.

### B-LA-E5-16-02 — NIT — A route rename silently turns idempotency off for that route

- **File:** `services/lti-service/src/http/idempotency.ts:14-18` (`ROUTES` keyed by the route template strings).
- **Problem:** The plugin matches `req.routeOptions.url` against three literal templates. If lane L renames one of these routes (for example a version prefix, or a changed parameter name), the plugin no longer applies to it, and every request goes through with no error. The current tests use the real routes, so they would fail only if they still send the old path.
- **Suggested fix:** In an `onReady` hook, check `app.hasRoute({ method: 'POST', url })` for each `ROUTES` key, and stop the start with a clear message when one is missing. Or add one test that does the same on the built app.

## Not checked

- K1-SIM AC-01 to -03, -05, -07 (QA). The `idempotency-cleanup` job (LA-E5-20).

## Round 2

Reviewer-B: Codex GPT-6-Astra xhigh, same lens B. Verdict: **APPROVE**. Reviewed `a36d4c5` (merge `836d579`) against the task and contract delta §1.3/§4.9, including BD-A2-56/57/58. Verification used a private `git clone --no-hardlinks` at `c2426eb`. No other reviewer's report was read; no Docker or stack was run.

Counts this round: **0 BLOCKER, 0 MAJOR, 1 MINOR, 0 NIT.**

| Prior finding | Result |
| --- | --- |
| B-LA-E5-16-01 (MINOR) — refusals give no next step | **Closed.** The `409` names `Retry-After` and supplies both the header and `details.retryAfter`; a controlled clock checks 44.5 seconds remaining becomes 45. The `422` now names the 24-hour interval, route, path id, resolved target and body, and tells the client to use a new key for a new request. Both descriptions match BD-A2-58. |
| B-LA-E5-16-02 (was NIT) — route renames silently disable idempotency | **Partly fixed; retained as MINOR below.** Missing routes and changed literal paths stop startup with a useful error. A changed parameter name still bypasses the guard. |

### B-LA-E5-16-02 — MINOR — The startup check does not detect a renamed path parameter

- **File:** `services/lti-service/src/http/idempotency.ts:78` and `:85`; test at `services/lti-service/src/http/idempotency.test.ts:289`.
- **Problem:** `hasRoute()` tests route matching, but the middleware selects by the exact `req.routeOptions.url` string. A parameter-only rename can satisfy the startup check and then skip idempotency on every request to that route.
- **Evidence:** In the pinned private clone, I registered all three POST routes but changed `/api/platforms/:id/deployments` to `/api/platforms/:platformId/deployments`. `hasRoute()` for the old template returned `true` and `app.ready()` succeeded. Two identical injected POSTs with the same key reached the dummy handler twice (create counts 1 and 2). The existing negative test omits the deployment route entirely and changes the literal line-item path, so it does not exercise this case. The current production templates still match; this is a future-maintenance gap, safe to defer. MINOR replaces the earlier NIT because the probe shows a concrete guard failure.
- **Suggested fix:** Collect the exact registered POST templates with `onRoute` and check those strings at startup, or bind the idempotency rule to route metadata. Add a case where only `:id` becomes `:platformId`, with all three routes otherwise present.

### Verification and scope

- The focused six-file run across this dispatch passed **109 unit tests**, including the HTTP/store idempotency tests and unchanged UNIT AC-04/06. Root type checking and ESLint on all 13 changed TypeScript files passed.
- Removing the new startup hook and retry detail in the private clone made the two corresponding tests fail. The parameter-rename probe above ran without a listener or stack. All source mutations were restored.
- The resolved-target helper calls the existing read-only service-context checks; target-specific replay and inactive/deleted-platform tests cover BD-A2-56. One shared final-status predicate and the `Retry-After` exclusion cover BD-A2-57; the tests prove that a `429` frees the key and the next call reaches the platform.
- The diff stays in S1's middleware/store, API error table and colocated unit tests. The forbidden route and `platform/**` files are unchanged; no LMS branch or name was added. K1-SIM and the task's regression gate remain separate QA evidence.
