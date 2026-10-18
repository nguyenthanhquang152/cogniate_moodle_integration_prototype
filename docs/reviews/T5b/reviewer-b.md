Verdict: APPROVE
Round: 2

# T5b review — Reviewer-B (lens: "Can a human team own it?")

Scope: `git diff ef2d2c0 64c101f -- . ':!docs' ':!tests'` (29 files). Spec: `tasks/T5b.md`, app contract §5, §7, §9, §10, §12, ADR-004, ADR-010.

| Check | Result |
| --- | --- |
| `npm run check` (HEAD contains `64c101f`) | Pass: 42 test files, 570 tests (the Lead's clean worktree: 565) |

| Severity | Count | Ids |
| --- | --- | --- |
| BLOCKER | 0 | — |
| MAJOR | 0 | — |
| MINOR | 1 | B-T5b-01 |
| NIT | 1 | B-T5b-02 |

## My T5a items

| Id | Status | Evidence |
| --- | --- | --- |
| B-T5a-01 (grade policy in one place) | **Resolved** (one small rest in B-T5b-02) | `packages/tracking/src/outcome.ts` starts with "Grade policy (ADR-010) — the ONE place for it". It holds `finishStatus`, `agsScore`, `improves`, `syncDecision`, `nextRetryAt`, `bestAttempt` (moved from domain) and the new `syncResult(answer, tries, retryFrom, now)` (ADR-010 rules 8 and 9). `domain/results.ts` and `worker/score-sync.ts` import them. |
| B-T5a-02 (player uses the tracking value rules) | **Resolved** | `apps/player/src/scorm12/api.ts` imports `LESSON_STATUS`, `EXIT_VALUES`, `INTERACTION_TYPES`, `INTERACTION_RESULTS`, `MAX_*`, `isScore`, `isDecimal`, `isTime`, `isTimespan` from `@cogniate/tracking`, and its header says why ("a value that LMSSetValue accepts is never rejected by the server"). `packages/tracking/src/contract.ts` holds `RuntimeState` for both sides. |
| B-T5a-03 (no endless retry) | **Resolved** | An unexpected error in `send()` becomes `answer = { local: 'internal_error' }` with `internal_error` logged under the row's trace id. `syncResult` then marks it `failed` at once (a human can Resend). Test: "A-T5a-06: a service key that cannot be decrypted -> failed once (no send every 2 s)". |

## Lead's focus questions

- **HTML tracker for a developer new to it:** Good.
  - `apps/player/src/html/tracker.ts` lists the four rules in its header (menu page seen on visit; other pages after `minDwellMs` of *visible* time and a scroll to the end with 24 px slack; first click or change on `input[data-cog-correct]` stands; internal `.html` links lose `target` and `rel`).
  - `watchFrame` explains why it polls every 150 ms instead of waiting for `load` (a hanging S3 or font host blocks `load`, T5-spike, AC-T5-36).
  - The server side is pure and short: `packages/tracking/src/html.ts` (`checkHtmlProgress`: subset, keys, "first answer stands", merge; `htmlOutcome`).
  - The tests are named by rule (visible-time dwell, `visibilitychange` pauses, first answer stands, attach without `load`).
- **Resend and refresh flow:** Readable.
  - `app/results.ts` (70 lines) has three routes with the library check, SERVICE-AUTH-V1 (it works after the ltik expired), "a failed read keeps the last value", and `kickSync` after a Resend.
  - `domain/score-syncs.ts` `resendSync` states its rule: only `failed` or `conflict`, back to `pending` with `tries = 0` and a new 24 h window, and "never lower" also holds.
  - Migration 007 is commented (`resent_at` restarts the retry window; `gradebook_read` keeps the last value, `NULL` = no grade).
  - Two gaps in refresh: B-T5b-01.
- **Results module:** `domain/results.ts` builds the contract §5 rows, with `bestAttempt` from tracking.
- **Test quality (AC-T5-14, -30, -31, -32 unit-only here):** The tests in `runtime-path.test.ts` ("AC-T5-14 / -30 …", "AC-T5-31 / -32 …", "AC-T5-33 / -18 …") prove the app side with the fake LTI client: retry, outage order (a forged 0 makes no row), conflict not retried, Resend rules, library scope. The Moodle side is for QA's live run, as planned. Several `it` blocks cover two to five ACs each (B-T5b-02).
- **Caddyfile:** The content origin drops `Cookie` upstream and `Set-Cookie` downstream, with a comment that names the reason (A-T5a-02: big package cookies would make every course answer 431).

---

## Findings

### B-T5b-01 — MINOR — "Refresh from Moodle" can store another learner's value, and it does not say which rows failed

- **Location:** `services/cogniate-app/src/app/results.ts` lines 52–58 (`const mine = scores.find((s) => s.userId === target.userSub) ?? scores[0];` and the `catch` that only logs); app contract §5 (`gradebook`) and §12 (`gradebook_refresh_failed`: `publication_id`, `resource_link_id`, `lti_status`, `lti_code`).
- **Problem:**
  - When the answer has no result for this learner, the code takes `scores[0]`. Moodle filters by `user_id`, so this does not happen today, but a platform that ignores the filter (or a paging case) would store **another learner's** grade as this learner's gradebook value, and `gradebookDiffers` would then mislead.
  - A failed read is logged but not reported. The API answer has the old `gradebook` with an old `readAt`, so the portal cannot tell "refreshed" from "could not read".
- **Evidence:**
  - The `?? scores[0]` fallback.
  - The `catch` logs `gradebook_refresh_failed {trace_id, lti_status, lti_code, lti_reason}`, without the `publication_id` and `resource_link_id` that contract §12 lists.
- **Suggested fix:**
  1. Drop the fallback: no matching `userId` means `resultScore: null` (or skip the row).
  2. Return the failures, for example `{ rows, refresh: { failed: [resourceLinkId, …] } }`, or a per-row `gradebook.readError`, so T6 can show "Moodle could not be read for this learner".
  3. Log the contract fields (`publication_id`, `resource_link_id`).

### B-T5b-02 — NIT — Small "one place" rests and test granularity

- **Location and fix:**
  - The HTML pass/fail rule (`score >= mastery`) and `DEFAULT_MASTERY = 70` live in `packages/tracking/src/html.ts`, while `outcome.ts` says it is "the ONE place" for the grade policy. `packages/package-inspector` also has its own `DEFAULT_HTML_MASTERY = 70`. Name `htmlOutcome` in the `outcome.ts` header, or move the scoring part there, and import one default mastery constant everywhere.
  - `apps/player/src/html/tracker.ts` declares `TrackerProfile`, which repeats most of tracking's `HtmlProfile`. Use `Pick<HtmlProfile, 'pages' | 'menuPage' | 'questionIds' | 'minDwellMs'>`.
  - The "find the line item if it is missing" step (ADR-010 rule 1: `findLineItems` → `setLineItem`) is written twice: in the worker (`lineItemOf`) and in `app/results.ts` refresh. Use one helper.
  - `runtime-path.test.ts` has `it` blocks that cover several ACs ("AC-T5-07 / -20 / -12 / -08 / -23", "AC-T5-31 / -32"). One `it` per AC, or a `describe` per AC with shared setup, would show at once which AC broke and make the qa.md mapping easier.

---

## Round 2

Round 2 verdict: **APPROVE**.

Input: `git diff ba7e7bb 80f8581 -- . ':!docs' ':!tests'` (15 files).

| Id | Status | Evidence |
| --- | --- | --- |
| B-T5b-01 | **Resolved**, with one rest | `app/results.ts` refresh: `scores.find((s) => s.userId === target.userSub)` with no fallback ("none means Moodle has no grade"). `gradebook_refresh_failed` logs `publication_id`, `resource_link_id`, `lti_status`, `lti_code` (contract §12), also for a non-LTI error. Rest (NIT, safe to defer): the refresh answer still does not list the rows that could not be read, so the portal shows the old value without a "could not read" hint. |
| B-T5b-02 | **Resolved**, with one rest | `worker/line-item.ts` `resolveLineItem()` is the one ADR-010 rule 1 helper, used by the worker and by refresh. `TrackerProfile = Pick<HtmlProfile, …>`. The `outcome.ts` header lists every policy function (now also `resendDecision` and `htmlOutcome`), and says "Latest result instead of best changes improves, bestAttempt and syncDecision only". Rest: `package-inspector` keeps its own `DEFAULT_HTML_MASTERY` constant, and some tests still cover several ACs in one `it`. |

A-T5b-02 (only the best final result is ever sent) is written once in `outcome.ts` (`resendDecision`, `syncDecision`), with tests in `tracking.test.ts`. That fits "one place for the grade policy".

