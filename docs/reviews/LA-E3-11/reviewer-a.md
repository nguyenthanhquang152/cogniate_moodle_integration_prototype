Verdict: APPROVE
Round: 1

# LA-E3-11 review: Reviewer-A

## Round 1

- Reviewer: Codex, Reviewer-A, lens "Is it right and is it safe?" Date: 2026-10-23.
- Diff: `git show c88f7d0` (merge `151f6a9`). References: task LA-E3-11; LA-ADR-05 D9; LTI service contract delta §4.3; plan §6.1; the earlier Reviewer-A report for LA-E5-14.
- **Verdict: APPROVE. New findings: 0 BLOCKER, 0 MAJOR, 0 MINOR, 0 NIT.** Deferred findings A-LA-E5-14-01 and A-LA-E5-14-02 are closed by this task.
- Method: read the named diff in the integration worktree; run tests and mutants in a private `git clone --no-hardlinks` at `9c87853`. No Docker, stack, network service, commit, or other reviewer's file. Later integration changes are outside this review.

### Checks

| Check | Evidence |
| --- | --- |
| Extension keys | `platform/ags.ts:99` requires an explicit HTTPS authority, rejects whitespace and backslashes, and checks the parsed protocol. Relative, HTTP, URN, malformed and unknown keys are dropped before forwarding. It preserves the original accepted key and JSON value. The key is never used as a request destination. Both score parsing and `compat.ts` line-item parsing use this filter. |
| Score limits, UNIT AC-03 | `scoreExtensions` counts only accepted URL keys, permits eight, and refuses nine. It measures each JSON-encoded value with `Buffer.byteLength(..., 'utf8')`, including quotes and escapes, and permits exactly 4096 bytes. The route parses the score before the ownership GET or score POST. Tests cover both authorization schemes, a ninth key, ASCII and multibyte overflow, exact boundaries and no outbound call. Removing the count limit or using string length instead of UTF-8 bytes each fails two tests. |
| Optional fields and score wire | The submission schema validates each optional timestamp without normalizing it; `scoringUserId` must be a string. `postScore` preserves these fields and the filtered extensions. Two scratch client probes pass: exact outgoing score JSON and media type, and incoming result extras with unknown/HTTP keys removed. The old score fields, aliases, timestamp clock, URL checks and AGS scopes are unchanged. |
| Line items, UNIT AC-05 | The new real-auth route test covers POST, PUT, GET and list for LTIK and service-key callers, with nested and null extension values. It checks the outbound body and returned object. Independently restoring the old write parser or removing extension preservation from the response mapper each fails this test. |
| Write authorization | The three service-key write guards remain before their outbound writes. Readonly/missing AGS scopes still fail before a write. The focused run includes both the existing compat scope tests and the new LA-E5-15 real-auth route tests. |
| Ownership and scope | `compat.ts` is lane L's file and its parser change is named in this review dispatch. The `error-mapping.ts` exception to the task's original "Must not edit" list is expressly authorized by the deferred LA-E5-14-02 fix in the Author brief. No token-client, reporter, QA test, or channel manifest change. No LMS name added to core code. |

The 8-member and 4096-byte limits apply to score POST extensions, as the task and D9 specify. Line-item extensions and platform read responses use the HTTPS-key filter without these score limits. The existing 256 KiB HTTP body limit still bounds incoming line-item requests (`http/app.ts:72`); they do not have the score's per-value limit.

### Deferred findings

| Id | Status | Evidence |
| --- | --- | --- |
| A-LA-E5-14-01 — MINOR | Closed | The four AGS/NRPS × 429/403 cases require exactly one warning with trace, platform, status and retry delay. They reject body email and token leakage. Removing the AGS log context fails its two cases; removing the NRPS log context fails its two cases. |
| A-LA-E5-14-02 — NIT | Closed | The digit branch clamps before calling the finite-number normalizer. A 400-digit positive integer gives 3600, all zeroes give 1, and leading zeroes preserve 120. Restoring the old branch fails the huge-integer case. |

### Validation and limits

- The combined review run passed **196 tests in 11 Node files**, including `platform/{ags,platform,error-mapping}.test.ts`, `http/routes/{compat,services}.test.ts`, service-key tests and re-wrap tests. LTI service typecheck passed.
- The two additional scratch AGS wire probes passed. The extra run, with the platform suite and service-key store suite, passed 44 tests. All seven E3/deferred-fix mutants failed at the expected assertions. Scratch edits were restored; the clone has no tracked changes.
- F1 passed. No stack-based K1-SIM or frozen M1/M2/T7 regression was run; those remain QA gates.
