Verdict: APPROVE
Round: 1

# LA-E2-06 review: Reviewer-A

## Round 1

Reviewer: Codex GPT-6-Astra xhigh, lens "Is it right and is it safe?" Date: 2026-10-23. **Counts: 0 BLOCKER, 0 MAJOR, 0 MINOR, 0 NIT.**

Reviewed `1b298d9` (merge `326ceae`) against the task spec, LA-ADR-02 D2a/D4/D5/D6 and plan §6.1, including A1's clarification BD-A1-108 (`fd8b781`). The companion tool-row switch is reviewed separately in LA-E2-05 Round 2. No findings.

### Acceptance and safety

- **AC-01:** the dispatched F2 command on `1b298d9^..1b298d9` gives **core = 0, paths = 4**, all under `packages/channels/brightspace`. The separate E2-K tool-row follow-up in the combined merge is not part of this measurement. No core, frozen test or migration changes are needed for this feature.
- **AC-04 and channel data:** the manifest offers dynamic/self and manual/operatorGrant; the loaded DR profile has path-prefix issuer checking and an opaque Bearer token. K0 passes with the dynamic capability enabled. The three dynamic binding rows contain only client ID, deployment ID and approval code; the existing manual defaults and profile safety traits remain intact.
- **Staged flow, unit evidence for AC-02/-03:** a private real LTI-route probe uses the loaded Brightspace profile, `desire2learn` family, opaque token, the documented off-origin token URL and distinct audience. Completion stays inactive even with `autoActivate: true`, retains the binding reference and uses the token only as Bearer authorization. An app-route probe confirms the pending connection becomes `operatorGrant`, refuses an unapproved redemption and grant issue without foreign-host confirmation, then activates the existing platform with the staged grant and no new create. The real staged wizard prefills both IDs and submits exactly the short three-key body.
- **BD-A1-108:** a same-origin control completes active with no stored binding reference. I raised the conflict with the earlier "always staged" wording; A1 confirmed that this wording described the real D2L endpoint shape, not a separate channel grant policy, and corrected the spec. Both origin controls pass under the ratified rule. No pending finding remains.
- **Documentation:** the README adds the Dynamic/Standard admin paths, staging/grant flow and profile traits. It keeps the token format, configuration values and live-platform status explicitly unverified. It does not claim simulator evidence proves real D2L compatibility.

### Verification

Tests ran at `326ceae` in fresh private clone `/tmp/la-reviewer-a-ctx-8d3d02b18795`, with its own `npm ci` and `node_modules/.vitest-cache` deleted before every Vitest run.

- Focused public channel, registration, adapter and portal suites: **144/144**. K0: **148/148**; enabling the dynamic capability removes one OFF-capability case, as expected.
- Private app, portal and LTI-route checks: **10/10** after correcting the probe's generated-ID assumptions and applying the BD-A1-108 expectation. The original same-origin failure is retained in the diagnostic log; it established the wording question, not an implementation defect.
- Three mutations are detected: restoring hidden tool rows, restoring the old DR profile, and removing the staged ID/code rows. Product files were restored; the affected public/app/portal checks pass **17/17**, and both LTI origin controls pass **2/2**.
- App, portal and both channel typechecks and targeted lint pass. F1: **0 hits**. F5: **6 rules, 0 hits**. F2: **core = 0** for the reviewed feature commit.

Probe sources are saved under `/tmp/la-reviewer-a-ctx-8d3d02b18795-probes`; logs use the same prefix. The private clone is clean. No Docker, stack, stack-starting runner, commit or other reviewer's file was used. Only the two assigned Reviewer-A reports were edited in integration. K1-SIM learner-launch/score checks, the Brightspace kit, browser and live D2L gates remain QA work; these unit probes do not claim those results.
