Verdict: APPROVE
Round: 1

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
