Verdict: APPROVE
Round: 2

## Round 1

Reviewer: Codex GPT-6-Astra, xhigh, 2026-10-23. Lens B: can a human team own it? Scope: `f3633a2`, `4c9809f`, and `7216b0b` (merge `4d31891`), tested at `df5f8b37784f6631383ee99a027996e76581b9e3`. Read the task spec, LA-ADR-05 D6, the A1 binding and registration-URL decisions, ownership matrix §5, and plan §6.1. No Reviewer-A file was opened.

One MINOR finding. No blocking findings.

### B-LA-E3-16-01 — MINOR — A staged registration still offers a renewal that cannot succeed

**Files:** `packages/channels/canvas/portal/CanvasWizard.tsx:36`, `packages/channels/canvas/portal/CanvasRegistration.tsx:26`, and `packages/channels/canvas/portal/canvas-steps.json:41`.

**Problem:** After Canvas registration stages the platform, the page correctly shows the pre-filled approval form, but it also keeps the registration instructions and **Get registration URL** button. The staged DTO has no registration URL, so the first instruction explicitly directs the administrator to that button. Renewal is no longer allowed at this point. The resulting instruction to reload does not resolve it and obscures the remaining step: check the values and enter the approval code.

**Evidence:** The Canvas wizard renders this step for every pending dynamic connection. The shared URL part checks only `pending` and `dynamic`; the app's registration-URL route rejects a connection with a non-null platform as `CONNECTION_NOT_PENDING`. A private UI probe rendered the staged DTO with the pre-filled Client ID, clicked the button, and supplied that route's `409` response. It displayed “This connection changed while Cogniate saved it. Reload the page.” The assertion that a staged connection should no longer offer renewal failed. This is safe to defer because the correct approval form remains available.

**Suggested fix:** In the Canvas staged branch, show that registration is complete and direct the administrator to the values and approval code. Hide renewal there. Keep renewal for the unstaged dynamic connection and preserve the manual path and shared shell behavior. Add a staged-view assertion for the absence of the renewal action.

### Checks and scope

The method labels, default, paste location, expiry, waiting text, and staged values make the new path understandable. The method list comes from the provider DTO derived from the manifest. The parent connection page polls for changes, so the staged form can appear after the administrator returns from Canvas. The new branch is small, reuses the shell's URL helper, and keeps its texts together. The Canvas menu path is based on the repository's research; this review did not verify it against a live Canvas instance.

The UNIT criteria have relevant coverage: AC-01 checks both methods, default selection, exact request bodies, and the manual-only case; AC-02 checks initial and renewed URLs, expiry, copying, and absence of developer-key JSON; AC-03 checks waiting without inputs, pre-filled values, an empty approval code, and an edited submission. AC-05 pins the manual create and pending DOM. In a private control using the production files from `83d97aa`, all four selected dynamic-path tests failed as expected, while an independent check of both manual DOM hashes passed. All five temporary production-file replacements were restored.

Verification used `/tmp/la-review-b-15734a340910`, a fresh `git clone --no-hardlinks` with its own `npm ci`; the Vitest cache was removed before every run. **65 tests passed across four files**, covering the Canvas wizard and shared channel shell. Portal and channel-portal typechecks, changed-file ESLint, and F1 passed. The separate staged-renewal probe confirmed the minor issue above.

The changes stay within the assigned Canvas portal scope and the explicitly dispatched shared URL extraction/SDK export. No protected app, service, manifest, or other-channel file changed; no production core LMS name was added. The app fixes under BD-A1-106 and the LA-E3-09 service work are separately assigned and are not treated as missing portal work. K1-SIM, the unchanged M2 manual E2E, and full R0 remain with their assigned verification lanes. No Docker, stack, or commit was used. Only this review file changed in integration.

## Round 2 (BD-A2-106 follow-up)

Reviewer: Codex GPT-6-Astra, xhigh, 2026-10-24. Lens B: can a human team own it? Scope and test pin: `aa351bad0b52d1941df6f658aace8d3f6c0c1619`. Read the prior B round, task spec, BD-A2-106, channel README, and related admin guidance. No Reviewer-A file was opened.

**APPROVE. No new findings.** B-LA-E3-16-01 is outside this copy-only follow-up.

The sentence names the affected deployment, gives the exact alternative choice, **Developer key**, and states that Cogniate does not yet support this method there. It is clear beside the Dynamic Registration radio. It matches the approved wording and the pending quotation in `docs/guides/ltiaas/baseline-admin-changes.md` §2.1. It also agrees with the channel README's developer-key path and its statement that live Canvas rows remain unverified. Both method choices remain available as BD-A2-106 requires.

Verification used fresh private clone `/tmp/la-review-b-fe99586dd62b`, checked out at the unmerged commit, with its own `npm ci` and the Vitest cache deleted before each run. **All 20 Canvas wizard tests passed**, including UNIT AC-01/02/03 and AC-05's manual DOM hashes. Restoring only the parent commit's JSON copy made AC-01 fail on the missing new sentence while AC-05 still passed. The copy was restored and the clone is clean. Channel portal typecheck, test-file lint, and whitespace checks passed.

Only the two assigned Canvas portal files change. Protected paths, request behaviour, and other channels are unchanged; no core LMS name was added. Lead merge and the planned M2/K2 re-gate remain; the guide's pending-verification label can follow that evidence. No Docker, stack, or commit was used. Only this review file changed in integration.
