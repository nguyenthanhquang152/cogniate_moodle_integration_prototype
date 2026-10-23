Verdict: APPROVE
Round: 2

# LA-E1-09 review: Reviewer-A

## Round 1

- Reviewer: Codex, Reviewer-A, lens "Is it right and is it safe?" Date: 2026-10-23.
- Diff: `git diff e770ff2^1 e770ff2` (commits `3fcaa0b`, `3a0ccee`, `ec4ca12`, `379f905`, `9ac60c6`, `c39d635`, `23d5e5c`). References: task LA-E1-09; LA-ADR-01 D9/D12; LA-ADR-04 D2/D8 and LA-IC-19; app API delta §4; BD-A1-30, BD-A1-56, BD-A1-57; plan §6.1.
- **Verdict: APPROVE. Findings: 0 BLOCKER, 0 MAJOR, 0 MINOR, 0 NIT.**
- Method: read the named diff in the integration worktree. Run tests and mutants in a private `git clone --no-hardlinks` pinned to `e770ff2`. Later integration changes are outside this review. No Docker, stack, commit, or other reviewer's file.

### Correctness and safety

| Check | Evidence |
| --- | --- |
| Frozen M1 text | Direct comparison with `e770ff2^1` confirms that the three `LEGACY_APP_ERROR_TEXT` values equal the old app defaults byte for byte. The moved `pendingToolText` implementation and renamed embedded continuation script body are also equal. Kernel tests pin the pending-tool text, `MOODLE_TOOL_MAY_EXIST`, `data-back-to-moodle` and the three defaults. Register form, done page, play shell and tracking tests retain the baseline Moodle strings. The nonce script for a Moodle registration has the same text and quoting as before. |
| Removed app error entries | There is no remaining app `ApiError` throw or `APP_API_ERRORS` reference for the five removed entries. The Moodle adapter still returns their codes through channel error handling. The unchanged native and build-concurrency tests pass, including invalid token, missing functions, unsupported package and build-limit responses. This follows BD-A1-56; it does not remove these codes from the external API. |
| Known and unknown channel names | Register pages and connection `lastError` texts use the stored connection channel. The play shell and runtime page use the session's registry-derived text name. An unknown play or registration uses `textName(null)`. The player accepts arbitrary display names and uses the generic fallback only when its attribute is absent or blank. Both server-rendered player pages supply that attribute. |
| Runtime expiry, LA-IC-19 | `content-host/server.ts:174` retains the expired session's text name. Expired state and commit requests return 410 with that name; the runtime HTML route still returns 404. An unknown token still returns 404. Tests pin the Moodle description and the test-channel description. The session name comes from the database connection and registry, not a request parameter. |
| Portal allowlist | `app/portal.ts:37` checks the decoded route channel against the registry before the session check or SPA response. The registry uses a private `Map` over validated, frozen manifests; request parameters cannot add an entry. Unknown ids, including `__proto__`, get the same 404 body and CSP as an unknown path, with or without a session. Known ids keep the sign-in redirect and portal headers. API and tool paths do not gain a wildcard SPA fallback. |
| HTML and script safety | Display names in HTML text and attributes pass through `escapeHtml`. The register status script escapes backslash, quote, HTML-sensitive characters, line breaks and Unicode line separators inside its single-quoted literal. Player status and error messages use `textContent`. The hostile-name tests verify escaped register text/script and no child element from a markup-like player name. The renamed continuation keeps its existing JSON and script-element escaping. |
| Ownership and scope | No QA test, LTI service file, portal file, tracking outcome/index file or R-owned app file changes. The shared export removal is the named S2 RQ-2 commit `9ac60c6`. The K-owned caller/wiring and legacy constants are the Lead RQ changes identified in the lane commits and review dispatch. F1 changes only lower counts or remove the renamed file; no new LMS-specific core path or closed player name union appears. |

### UNIT criteria and mutation checks

| Criterion | Test evidence |
| --- | --- |
| AC-02 | `tool-pages/lms-texts.test.ts` and `apps/player/src/lms-name.test.ts` cover custom names, baseline Moodle text, missing context, registration, stored errors, runtime expiry and safe rendering. Restoring the old player name filter fails 8 cases. Forcing the old runtime, register or no-context name fails one targeted case each. Removing register script escaping fails the hostile-name case. |
| AC-03 | `packages/tracking/src/status-text.test.ts` checks all four sync states, the three baseline names, `your LMS`, another custom name, best-score wording and preview/in-progress text. The underlying formatter already accepted a supplied string before this task; these are invariant checks. The diff removes the implicit default, and both production callers supply a name. Forcing the name to Moodle fails the four non-Moodle cases. |
| AC-04 | `app/portal.test.ts` exercises both routes for every registry id, including a test channel, and compares unknown ids with an unknown path. Restoring the old fixed route list fails the test-channel case. Removing the registry guard fails the unknown-id case. |

All **8 mutants** fail at the expected test assertions. All scratch changes were restored, and the private clone has no tracked changes.

### Validation and limits

- **160 tests in 15 files passed:** player tests (including its standalone bundle build), tracking tests, tool-page tests, portal allowlist, native routes, build concurrency and frozen kernel values.
- **161 tests in 2 files passed:** existing `app/connect.test.ts` and `app/redemption.test.ts` registration and baseline channel regressions.
- App and player typechecks passed. F1 passed; the task's touched core files have zero counts, with frozen names kept in `legacy-wire.ts`.
- Golden G4, Moodle R2-lite and wave-end R1 were not run. They remain QA gates; the host checks above do not replace them.


## Round 2

- Reviewer: Codex GPT-6-Astra, Reviewer-A, lens A. Date: 2026-10-23.
- Diff: merge `141ffe3`, commits `9ff963c`, `4c7c060`, `a31005a`. References: LA-E1-09, LA-ADR-01 D12, BD-A1-59 and BD-A1-62, app API delta §8, plan §6.1.
- **Verdict: APPROVE. Findings: 0 BLOCKER, 0 MAJOR, 0 MINOR, 0 NIT.**
- Read the diff in the integration worktree; ran host tests and mutants in private clone `/tmp/la-reviewer-a-ctx-49dc7112367a`, pinned to `141ffe3`. No Docker, stack, commit or other reviewer's file. Only this review file changed in the integration worktree.

### Findings and checks

| Change | Reviewer-A result |
| --- | --- |
| Literal names (`9ff963c`) | The named replacement-string defect is fixed. `withLms` uses the kernel callback formatter, and the tool-name replacement also uses a callback. `$&`, `$$` and `$'` remain literal in rendered text and stored `lastError`; HTML escaping still happens at rendering. The existing hostile-name/script tests pass. Restoring the old LMS formatter fails all three new name cases; restoring the old tool replacement fails its new case. |
| Request-log paths (`4c7c060`) | Both listeners use `req.routeOptions.url ?? '<unmatched>'`. Path parameters, raw/encoded personal values and query strings do not enter the `http_request.path` field. The matched-route tests pin `/play/:playId/embedded` and `/rt/:token/state`; unknown routes pin `<unmatched>`. Restoring either listener's old fallback fails that listener's privacy test. Response bodies, trace-id handling and `/healthz` log level are unchanged. The frozen T1 H7 test finds unknown-path requests by the returned trace id, so it does not need a raw path. |
| Closed registration keys (`a31005a`) | The optional nested `z.strictObject` accepts only the five specified codes. Extra probes reject `FETCH_FAILED`, `constructor`, `__proto__`, `prototype`, `toString`, unknown keys and invalid value types; all five allowed keys accept a partial override. The shared text schema rejects unknown placeholders and empty text. Replacing the strict object with a stripping object fails the new test. |
| Defaults and Moodle bytes | `registrationText` selects the channel sentence, then the frozen generic default. Defaults contain no LMS menu path. Direct source comparison with `141ffe3^1` confirms all five Moodle sentences are byte-identical to their previous LTI/app templates; the tests also pin their filled Moodle values. A one-byte Moodle mutation and a helper that ignores channel overrides both fail. The no-context caller contract is explicit: pass the standard-profile channel when it is known through the registry. |
| Scope and wire preservation | No page uses the new helper yet, as dispatched. The new manifest text member is not included in the existing `/lms-providers` DTO projection. No QA test, LTI service source, portal source, R-owned file or tracking outcome/index file changes. The two server files and kernel/Moodle additions are explicitly assigned to K by BD-A1-62 and BD-A1-59. There is no new LMS-specific core branch or closed LMS-name union. |

### Validation

- **286/286 tests pass in 13 files:** kernel, tool pages, request logs, portal routes, connection registration and redemption.
- **25 additional schema/value/literal-fill probes pass.** These include prototype-like unknown keys, each valid registration key and replacement-token-like names.
- **7/7 mutants are rejected at assertions:** old LMS replacement, old tool replacement, each old logging fallback, permissive registration keys, changed Moodle text and ignored channel override. Scratch edits were restored; the private clone has no tracked changes.
- Kernel and app typechecks pass. F1 passes; no new LMS-name hit is introduced by these commits.
- No review fix remains. LA-E2-02/LA-E2-04 page wiring and live golden/Moodle regression runs remain their scheduled tasks and QA gates.
