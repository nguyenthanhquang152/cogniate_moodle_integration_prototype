Verdict: APPROVE
Round: 1

# LA-E5-14 review, Reviewer-B2 (lens: "Can a human team own it?")

Reviewer: Reviewer-B2, the second lens-B instance (plan LD-22). Diff: `git diff 3c7221d^1 3c7221d` (the merge of lane L for LA-E5-14, with the RQ-2 lines in S1 files). Spec: `docs/architecture/ltiaas/tasks/LA-E5-14.md`. Design: contract delta §1.3, §1.6, §4.3, §6, §9; LA-ADR-06 D1 "Retry-After rule"; BD-A2-15, BD-A2-16; operability §4, §5. I did not open any reviewer-a file. I did not run Docker.

Counts: **0 BLOCKER, 0 MAJOR, 1 MINOR, 2 NIT.**

The change is small and easy to follow. The mapping has one function, `platformRateLimitError`. The token client and `platformResponseError` call it, so every AGS and NRPS call and the token request behind them get the same answer. The wait has one rule (`retryAfterSeconds`, 1–3,600, default 60), and the generic error handler sets the header from `details.retryAfter` for any code (BD-A2-16), with no branch per code. A tool developer gets a clear answer: `429`, `PLATFORM_RATE_LIMITED`, "The platform asked us to wait before another request.", the header and `details.retryAfter`. The operator gets one `platform_rate_limited {platform_id, status, retry_after_s}` warn line with the trace id, and operability §5 already has the `PlatformThrottled` alert with the next step ("the outbox waits by itself"). No platform body goes into the answer or the log, and a test checks that with an e-mail address in the body.

## How I checked

- Scratch clone of `3c7221d` (private `/tmp` folder, `--no-hardlinks`, `node_modules` copied; deleted after the run). `vitest run services/lti-service/src/http services/lti-service/src/platform`: **19 files, 274 tests passed**. F1 on the clone: `F1 PASS: 74 files with hits, 590 hits`.
- I read the three new test files against the ACs and compared the log line and the answer with contract delta §1.3 and §6.

## Checks

| Check | Result |
| --- | --- |
| Files and "Must not edit" | `platform/error-mapping.ts` and `platform/token-client.ts`: in the "May edit" list. `api-errors.ts` (the catalog line), `http/retry-after.ts` and the `http/app.ts` handler lines are the RQ lines that the spec names (S1). `main.ts` and `testkit.ts` change only to pass the logger. `lti/codes.ts` gets the protocol page code `RATE_LIMITED`, which the merge message calls "LA-E5-03 request 1". That is another task's request; no route uses it yet, and the Lead records it. **`platform/ags.ts` and `platform/nrps.ts` are in the "Must not edit" list and change**: see B-LA-E5-14-01. |
| Ownership | Lane L for its files. The S1 lines came by RQ. |
| No behaviour change outside the spec | LA-IC-11 only: a platform `429` or a `403` that says `Rate Limit Exceeded` gives `429 PLATFORM_RATE_LIMITED` (it was `502`). Other `403` answers and other token failures keep `PLATFORM_ERROR` (tests at `token-client.test.ts` and `error-mapping.test.ts`). No automatic retry: the token test asserts one request. |
| No LMS name in core | The added lines contain no LMS word. F1 passes. |
| UNIT AC | AC-06: `7200 → 3600`, `0 → 1`, an HTTP date 90 s ahead → 90, unreadable → 60, all in `error-mapping.test.ts` (`it.each` table), plus the old date forms and edge values (`'1.5'`, `'-1'`, `'90, 120'`, a 400-digit value). The function is new, so the old tree fails the test. OK. |
| Tests a human can keep | Each test is a named table. The token test also proves that a throttled answer leaves no cached token and no shared in-flight promise. The handler test proves that the rule works for a code outside the catalog. OK. |

## Findings

### B-LA-E5-14-01 — MINOR — `platform/ags.ts` and `platform/nrps.ts` changed, but the spec lists both under "Must not edit"

- **File:** `services/lti-service/src/platform/ags.ts:177`, `:189`; `services/lti-service/src/platform/nrps.ts:30`, `:49`; spec "Files" table ("`platform/ags.ts`, `platform/nrps.ts` (L, LA-E3-11, LA-E3-12; they already call the mapping)").
- **Problem:** The spec assumed that these two files need no edit. But the log line needs `platform_id` and the trace id, and only the call site has them. So the Author added a `logger` dependency and a `context` argument in both files. The change is small, needed, and in the same lane. But LA-E3-11 and LA-E3-12 also edit these files, and nothing in the record tells their Authors.
- **Evidence:** `git diff 3c7221d^1 3c7221d --stat` lists `platform/ags.ts | 7` and `platform/nrps.ts | 9`. The merge message names RQ-2 lines only for the S1 files.
- **Suggested fix:** No code change. The Lead records the two edits as a ratified exception (or asks A1/A2 to fix the spec row) and tells the LA-E3-11 and LA-E3-12 Authors, so their rebase keeps the `context` argument.

### B-LA-E5-14-02 — NIT — The AGS and NRPS clients make their own logger when none is passed

- **File:** `services/lti-service/src/platform/ags.ts:177`; `services/lti-service/src/platform/nrps.ts:30`.
- **Problem:** `deps.logger ?? createLogger({ service: 'lti-service' })` silently gives a caller that forgets the logger a new logger. That logger writes to stdout and to `LOG_DIR` from the process env, outside the logger the caller set up. The token client already requires its logger. So the three platform clients follow two different rules.
- **Suggested fix:** Make `logger` required in `AgsClientDeps` and in the NRPS deps, as in `TokenClientDeps`. The two production call sites (`main.ts`, `testkit.ts`) already pass it.

### B-LA-E5-14-03 — NIT — The three HTTP date patterns have no names

- **File:** `services/lti-service/src/platform/error-mapping.ts:8-12`.
- **Problem:** The comment says "the three HTTP date forms", but it does not say which is which. A maintainer who must change one regex has to find the standard first.
- **Suggested fix:** Name them in one comment line each: IMF-fixdate (`Sun, 06 Nov 1994 08:49:37 GMT`), obsolete RFC 850 (`Sunday, 06-Nov-94 08:49:37 GMT`), asctime (`Sun Nov  6 08:49:37 1994`), with the reference RFC 9110 §5.6.7.

## Not checked

- K1-SIM ACs (AC-01..05) with the simulator `429` option (QA-4).
- Lens-A items: the `403` body match (case, size, encoding), and the order of the throttle check against the other status mappings beyond the unit tables.
