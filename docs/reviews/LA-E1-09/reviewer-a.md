Verdict: APPROVE
Round: 1

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
