Verdict: APPROVE
Round: 1

# LA-E5-14 review, lens A ("Is it right and is it safe?")

Reviewer: Reviewer-A2 (Claude Code Opus 5.5 xhigh, plan LD-22). Date: 2026-10-22.
Spec: `docs/architecture/ltiaas/tasks/LA-E5-14.md`. Design: lti-service-api-delta §1.3, §1.6, §6, §9; LA-ADR-06 D1 (the `Retry-After` rule); BD-A2-15, BD-A2-16; LA-ADR-04 D8 LA-IC-11.

Diff: `git diff 3c7221d^1 3c7221d` (lane L commits `77919da` and `ad14818`; 14 files).

Method: a throwaway `git archive 3c7221d` copy under `/private/tmp`, with a clone of the integration `node_modules`. I ran the LTI service unit tests (52 files, 642 passed), probes of the normalizer and 10 mutants in that copy only. I used no Docker and no network. I did not change the integration worktree, except for this file.

## Summary

| Id | Severity | Topic |
| --- | --- | --- |
| A-LA-E5-14-01 | MINOR | No unit test checks the `platform_rate_limited` line for an AGS or NRPS response (2 mutants survive). No AC checks the NRPS line. |
| A-LA-E5-14-02 | NIT | A `Retry-After` integer too large for a JavaScript number gives 60, not 3,600 |

There is no BLOCKER and no MAJOR finding. The three lens-A points pass: no platform data leaks, the normalizer cannot be abused, and there is no automatic retry.

## Findings

### A-LA-E5-14-01 — MINOR — the AGS and NRPS warn lines have no test

- **Files:** `services/lti-service/src/platform/ags.ts:189`, `services/lti-service/src/platform/nrps.ts:49` (the `context` argument that makes `platformRateLimitError` log).
- **Problem:** the spec says "Log `platform_rate_limited {platform_id, status, retry_after_s}` (warn), once for each throttled platform response (the token request included)". The unit tests prove the line for the mapping itself and for the token client. Nothing proves that the AGS and NRPS clients pass the context. Without the context, the answer is still `429`, but the line is missing.
- **Evidence:** mutant E9 (`nrps.ts` without `context`) and mutant E10 (`ags.ts` without `context`) each pass all 642 tests. QA's AC-05 (K1-SIM) catches E10 on the score POST. No AC checks the line for `/api/memberships` (AC-04 checks only the status).
- **Suggested fix:** one unit case per client: a fake outbound answers `429`, then assert one `platform_rate_limited` line with `platform_id`, `status` and `retry_after_s`, and no platform body in the line.

### A-LA-E5-14-02 — NIT — a huge integer `Retry-After` gives 60

- **File:** `services/lti-service/src/platform/error-mapping.ts:18`.
- **Problem:** `/^\d+$/` accepts any number of digits, and `Number()` of a 400-digit value is `Infinity`. `retryAfterSeconds(Infinity)` then gives the default 60, not the clamp 3,600. Probe: `platformRetryAfter('9'.repeat(400))` → 60. The spec says "clamped to 1–3,600 …; 60 when absent or not readable". A readable but very large wait should give 3,600. This does no harm (a shorter wait than the platform asked, and still no automatic retry).
- **Suggested fix:** in the digit branch, return 3,600 when the value is not finite.

## Checks that pass

| Item | Result |
| --- | --- |
| No platform data in answers or logs (lens focus) | The `PLATFORM_RATE_LIMITED` error has no message, so the answer takes the catalog description (BD-A2-15). `details` holds only `retryAfter`. The log line holds `trace_id`, `platform_id`, `status` and `retry_after_s`. No platform body, header or status text goes into either. The `403` body test runs on the buffer only. The NRPS path keeps `echoMessage: false`. |
| Normalizer (lens focus) | Probes of `platformRetryAfter` (fixed clock): `7200` → 3,600, `0` → 1, `-5` → 60, `1.5` → 60, `1e3` → 60, `" 120 "` → 120. The three HTTP date forms 90 s ahead → 90. An impossible date (`Wed, 99 Oct …`) → 60. A list value `120, 120` → 60. A missing value → 60. Only the three anchored HTTP-date forms reach `Date.parse`, so loose strings are not dates. The regular expressions are linear, and Node limits the header size. The API error handler normalizes `details.retryAfter` again with the same rule (`http/app.ts:87`). Every `ApiError` body has a `details` object, so `Object.hasOwn` cannot throw. |
| No retry storm (lens focus) | The token client, AGS and NRPS throw the error once. There is no loop and no token retry. A throttled token answer is not cached. A token failure is not mapped again by the AGS call, so the token request gives one log line and AGS gives none for it. |
| Scope | Only the token client, AGS and NRPS call the mapping (`git grep`), so other platform calls keep `502 PLATFORM_ERROR`. A `403` with another body keeps today's mapping. LA-IC-11 is the intended change. |
| UNIT AC-06 and the mapping | Mutants killed: E1 (maximum 7,200), E2 (minimum 0), E3 (default 30), E4 (no HTTP date), E5 (no `403` body rule), E6 (no log line), E7 (token answer not mapped), E8 (no `Retry-After` header). |
| Ownership | The spec's "May edit" list is `platform/error-mapping.ts` and `platform/token-client.ts`. The other changes are the ones the dispatch names: the S1 RQ-2 lines (`api-errors.ts`, `http/retry-after.ts`, `http/app.ts`, the spec's "Needs from other lanes"), the LA-E5-03 request (`lti/codes.ts`, `RATE_LIMITED`), and the logger plumbing to the AGS and NRPS clients. `ags.ts` and `nrps.ts` are lane L's own files, but they are in this task's "Must not edit" list. `main.ts` and `testkit.ts` only pass the logger. The Lead may record these as approved. |
