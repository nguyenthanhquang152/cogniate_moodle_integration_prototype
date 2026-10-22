Verdict: APPROVE
Round: 2

# LA-E1-09 — Reviewer-B

## Round 1

Reviewer: Codex GPT-6-Astra, xhigh. Lens: "Can a human team own it?" Reviewed `git diff e770ff2^1 e770ff2`, including RQ-2 `9ac60c6`, against the task spec, LA-ADR-01 D9/D12, LA-ADR-04 D2/D8, BD-A1-56/57, the ownership matrix and plan §6.1. No Reviewer-A file was opened.

Counts: **0 BLOCKER, 0 MAJOR, 1 MINOR, 0 NIT.**

A channel team normally needs only its manifest text name. The app obtains it through `channels.textName`, the play and runtime pages pass it through `data-lms-name`, and the browser renders it with `textContent`. Tracking and the shell poll now require the name argument, which prevents new typed callers from silently taking a fixed default. Portal routes use one pair of patterns and check the registry before the session redirect.

The frozen values are easy to find and understand. `legacy-wire.ts` names and explains the three app error defaults, the tool-may-exist code and cleanup text, and the old back-link attribute. Exact-value tests protect them. The app error table explains that channel extension errors now belong to the channel table. The embedded continuation has a neutral name and still uses the existing capability. One rare name-substitution edge remains below.

### B-LA-E1-09-01 — MINOR — Insert the manifest name literally in error templates

- **File:** `services/cogniate-app/src/tool-pages/register-texts.ts:30`; helper: `services/cogniate-app/src/tool-pages/page.ts:9`.
- **Problem:** The newly parameterized registration errors pass the name to `String.replaceAll` as a replacement string. It interprets sequences such as `$&` and `$$`, so some valid manifest names differ between the confirmation page/player and the error page/connection `lastError`.
- **Evidence:** A manifest with `names.text: 'A$&B'` passes `buildChannelRegistry`. `registerErrorText('REGISTRATION_FAILED', 'Course tool', channels.textName('zz-review'))` returns `Cogniate could not connect this A{LMS}B site` and `The connection failed. Go back to A{LMS}B and try again.` A name `A$$B` becomes `A$B`. The kernel's `fillText` preserves these names. The helper predates this diff; the new registration-error call uses it with arbitrary channel names.
- **Suggested fix:** Make `withLms` delegate to the existing kernel `fillText(text, { LMS: lms })`, or use a replacement callback. Add one regression with a dollar sequence in `names.text`, checking the error page and stored `lastError`. This is a display-only edge case and is safe to defer.

### Evidence and test quality

All execution used a private `git clone --no-hardlinks` under `/tmp`, pinned to `e770ff2`, with dependencies copied into the clone. No Docker, stack, host stack runner or commit was used.

- **160 tests passed in 15 files.** Command: `node node_modules/vitest/vitest.mjs run services/cogniate-app/src/tool-pages services/cogniate-app/src/app/portal.test.ts services/cogniate-app/src/content-host services/cogniate-app/src/app/native.test.ts services/cogniate-app/src/app/mbz-concurrency.test.ts apps/player/src packages/tracking/src packages/channel-kernel/src/legacy-wire.test.ts`.
- **UNIT AC-02:** the tests cover manifest names in confirmation, completion and error pages, connection `lastError`, play and runtime markup, browser status text and expired-session responses. Quote/markup tests cover the HTML, inline script and browser text boundaries. Restoring only the old `lms-name.ts` caused eight failures. Restoring only the old content server caused the runtime-name test to fail on its 410 description.
- **UNIT AC-03:** six tracking cases preserve the three baseline names and accept `your LMS` and `Brightspace`, including best-score states. These also pass with the old `status-text.ts`: arbitrary string names already worked there. This is parity evidence, not proof of new runtime behavior. The change removes the default argument; the current app, player and root typechecks pass with explicit names at all callers.
- **UNIT AC-04:** tests cover every registered channel, a new channel, authenticated requests, login redirects and unknown ids. Restoring only the old portal module makes the new-channel test fail; the unknown-path test still passes. The registered-route test allows the existing 503 response when the portal bundle is absent, so it proves route selection, not a browser render.
- Each old-code probe used `e770ff2^1` for the one replaced file. Each file was restored afterward; the private clone had no remaining diff.
- `tsc --noEmit` passed for `services/cogniate-app/tsconfig.json`, `apps/player/tsconfig.json` and the root `tsconfig.json`.
- F1 passed: 9 files with hits, 29 hits, with existing baseline-lowering notices. A separate scan of all 15 changed files in F1 scope found **zero hits**. F5 passed: 6 rules, 0 hits. No closed LMS-name union remains in the changed interfaces.

### Scope and ownership

The diff leaves `services/lti-service/**`, `apps/portal/**`, the tracking outcome/index files, and the R-owned app files unchanged. The connection-JSON and app-server edits are small K-owned wiring changes needed to pass the name and registry. The shared index export removal has the explicit S2 RQ-2 grant in `9ac60c6`; baseline reductions follow RQ-3. The kernel frozen values follow BD-A1-30/56.

The five removed app error entries have no remaining app throw site or direct app-table expectation in the scanned code/tests/goldens. The native and concurrency route tests still pass through the channel implementation. The known-channel 410 text follows BD-A1-57 and LA-IC-19; the shared refusal helper is used by state GET and commit POST, and the new unit test checks both. Moodle text stays the same in those checks.

### Remaining verification

QA still owns AC-01's complete G4 byte comparison, AC-05's live Moodle/R2-lite run, and the stack regressions. This host-only review does not mark those gates passed. The only open lens-B finding is the safe-to-defer MINOR above.

## Round 2

Verdict: **APPROVE**. Counts: **0 BLOCKER, 0 MAJOR, 1 new MINOR, 0 NIT**; B-LA-E1-09-01 closed. Reviewed merge `141ffe3` and its three commits `9ff963c`, `4c7c060`, `a31005a`, against the task, LA-ADR-01 D12, BD-A1-59/62, the ownership matrix and plan §6.1. Same Reviewer-B lens; no Reviewer-A file was opened.

### Follow-up assessment

- **B-LA-E1-09-01 closed:** `withLms` delegates to kernel `fillText`; the tool-name replacement also uses a callback. The tests exercise `$&`, `$$` and `$'` in valid manifest names through the error page and connection `lastError`, plus dollar sequences in a tool name. They fail with the old helpers. A separate marker-collision edge is recorded below.
- **BD-A1-62 is clear and covered:** both listeners log the route template or `<unmatched>`. The two tests check raw and encoded personal-looking values, queries, and matched routes containing a play id or runtime token. They assert exact log paths and the absence of those values. The frozen T1 H7 probe can still match by response trace id; it does not require the unknown path to remain in the log. This is the explicit app API delta §8 change, not an accidental loss of a log field.
- **BD-A1-59 gives channel teams one clear contract:** `RegistrationTextKey` and `REGISTRATION_TEXT_KEYS` list the five allowed codes; `ChannelManifest.texts.registration` is optional and partial; `DEFAULT_REGISTRATION_TEXTS` spells out each fallback in one place. For example, the default `INVALID_REQUEST` says `Start the registration again from {LMS}.` The schema refuses unknown keys, empty strings and unknown placeholders with the relevant `texts.registration` path. `registrationText` returns the channel sentence or that key's default without filling it; its comment explicitly tells a caller with no known channel to supply the no-context channel. Moodle's five values match the existing registration help/actions, and literal-value tests pin them. Page consumption remains LA-E2-02 / LA-E2-04 work, as assigned by BD-A1-59.

### B-LA-E1-09-02 — MINOR — The tool-marker pass can rewrite an already inserted LMS name

- **File:** `services/cogniate-app/src/tool-pages/register-texts.ts:31`.
- **Problem:** After `withLms` inserts the name literally, `.replace('<tool>', ...)` scans the resulting string for the legacy tool marker. A valid LMS name containing `<tool>` is therefore changed, even for an error whose original template has no tool placeholder. This is a rare display issue and safe to defer; it does not reopen the fixed dollar-sequence defect.
- **Evidence:** In the private clone, extending the existing route test with `names.text: 'A<tool>B'` fails. The `SITE_MISMATCH` page says `another ACogniate (Thanh's Library)B site`, while the next occurrence still says `A<tool>B`. The stored `lastError.action` has the same mismatch, while its title preserves `A<tool>B`. The manifest and registry accept the name. The page escapes the resulting text; this is not an HTML injection finding.
- **Suggested fix:** Substitute markers only in the original template, in one pass, or build the frozen tool-may-exist action directly with `pendingToolText(toolName)` and apply `withLms` only to the other actions. Add the `<tool>` name to the existing route/stored-error regression so inserted text is never parsed again as a placeholder.

### Verification and scope

Execution used a private `git clone --no-hardlinks` pinned to `141ffe3`, with copied dependencies. No Docker, stack, host stack runner or commit was used.

- **125 tests passed in 11 files:** `node node_modules/vitest/vitest.mjs run packages/channel-kernel/src services/cogniate-app/src/tool-pages services/cogniate-app/src/http-request-log.test.ts services/cogniate-app/src/content-host services/cogniate-app/src/app/portal.test.ts`.
- Restoring the two pre-`9ff963c` helpers causes **4 regression failures**. Restoring the pre-`4c7c060` app/content servers causes **2 log-test failures**. Restoring only the pre-`a31005a` manifest schema causes **3 manifest-test failures**. Each source file was restored after the probe. The additional `<tool>` probe fails on the reviewed implementation as described above.
- Root and app `tsc --noEmit` checks pass. F1 passes (9 files with existing hits, 29 hits; baseline-lowering notices only), and F5 passes (6 rules, 0 hits). No LMS name was added to core production paths.
- The ten changed files are K-owned app/kernel/manifest code and adjacent Author tests. The schema/Moodle additions and the two request-log hooks are explicitly assigned by BD-A1-59/62. The task's prohibited LTI-service, portal, tracking outcome/index and R-owned app files are unchanged; there is no `tests/**` edit.

The previous G4/live Moodle/R2-lite verification boundary remains. This review approves the three host-testable follow-ups and leaves B-LA-E1-09-02 as the only open lens-B finding.
