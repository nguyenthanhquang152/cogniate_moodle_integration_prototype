Verdict: APPROVE
Round: 1

# LA-E3-11 — Reviewer-B

## Round 1

Reviewer: Codex GPT-6-Astra, xhigh. Lens: "Can a human team own it?" Reviewed `c88f7d0` (merged by `151f6a9`) against the task spec, LA-ADR-05 D9, contract delta §4.3, the ownership matrix and plan §6.1. No Reviewer-A file was opened.

Counts: **0 BLOCKER, 0 MAJOR, 0 MINOR, 1 NIT.**

The implementation has one clear member filter: `urlKeyedMembers` in `platform/ags.ts:99`. Score input, score output, result input and both line-item directions reuse it. The score-only count and size limits stay in `scoreExtensions`; they do not impose new limits on line items or platform results. Unknown non-HTTPS members are dropped. Extension values, including nested objects and `null`, survive unchanged.

The refusals identify the relevant field or member and the rule: `submission` timestamps, string `scoringUserId`, at most eight URL-keyed members, or the oversized member's URL. The size wording could be more exact (B-01 below).

### Evidence

All execution used a private `git clone --no-hardlinks` under `/tmp`, pinned to `676b7d9`, which contains both dispatched changes. No stack, Docker, host stack runner or commit was used.

- The combined review run passed **150 tests in nine files**: `platform/{ags,platform,error-mapping}.test.ts`, `http/routes/{compat,services}.test.ts`, `http/{service-key-write-scope,auth-scope}.test.ts`, `http/operator/platforms.test.ts` and `store/service-keys.test.ts` (paths under `services/lti-service/src/`). Command: `node node_modules/vitest/vitest.mjs run <these files>`.
- **AC-03:** parser tests cover eight versus nine keys and exactly 4096 versus more than 4096 bytes, with ASCII, multibyte characters and JSON escapes. The route test checks `400 INVALID_REQUEST` and no outbound calls for both authentication schemes.
- **AC-05:** the real-auth route test checks POST, PUT, GET and list for both schemes. It checks the outgoing body and the returned fields, including `null` and nested values.
- Replaced only `ags.ts` and `compat.ts` with their `c88f7d0^` versions in the private clone. Running the two route files with `-t 'AC-03|AC-05'` failed both tests: the old score path attempted the platform call, and the old line-item path dropped the extensions. Restored both files afterward.
- A small fake-outbound probe also passed: score POST kept submission timestamps, scoring user and the HTTPS extension; scores GET kept the scoring user and extension; other unknown members were dropped. This is not K1-SIM evidence.
- `tsc --noEmit -p services/lti-service/tsconfig.json` passed. F1 passed (20 files, 74 hits; existing baseline-lowering notices). F5 passed (6 rules, 0 hits).

### Scope and ownership

The production changes are in lane L's files. `compat.ts` is needed to prevent its body schema from dropping the new line-item members. Although the task's "Must not edit" column names `error-mapping.ts`, this dispatch explicitly includes deferred A-LA-E5-14-01/02: its one-line retry clamp and the AGS/NRPS warning tests are authorized companion work. The warning tests assert one safe event for each client and status; the retry tests now cover overflowing integers and leading zeroes. No token-client, reporter, QA test or core LMS-name change is added.

### B-LA-E3-11-01 — NIT — State the exact byte limit in the refusal

- **File:** `services/lti-service/src/platform/ags.ts:111`.
- **Problem:** The error names the member, but "4 KB of JSON" does not say that the limit is 4096 UTF-8 bytes of the serialized value, including quotes and escapes.
- **Evidence:** A value of 2048 `é` characters gives `Invalid field: https://platform.test/ext must be at most 4 KB of JSON.` Its JSON value is 4098 bytes. A client that counts characters can still exceed the limit after shortening the value.
- **Suggested fix:** Say "must serialize to at most 4096 UTF-8 bytes of JSON, including quotes and escapes" and pin that description in one boundary test. Safe to defer.

### Boundary

K1-SIM AC-01, AC-02 and AC-04, and the named stack regressions remain QA work. This approval covers the dispatched diff and host-only review evidence; later LA-E3-12 edits are outside this round.
