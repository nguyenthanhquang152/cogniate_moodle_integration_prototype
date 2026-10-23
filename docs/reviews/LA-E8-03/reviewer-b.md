Verdict: APPROVE
Round: 1

# LA-E8-03 — Reviewer-B

Reviewed Docs commit `167851d3` in merge `985f8f6f`, against LA-E8-03, the channel manifests and product code at `02f5d420`, app API delta §§3.3–3.4, the cited QA reports, and plan §6.1. Lens: can an LMS admin follow the guides? **0 BLOCKER, 0 MAJOR, 2 MINOR, 1 NIT.** Blind review; no Reviewer-A file opened.

## Findings

### B-LA-E8-03-01 — MINOR — The automatic-approval decision omits two conditions

- **File:** `docs/guides/ltiaas/lti-generic-admin.md:40–49`, repeated at `:81–82`.
- **Problem:** The guide says that every LMS URL being on the issuer host means immediate connection without a code. The rule also checks the port and the token audience. An admin can meet the stated rule and still receive “Waiting for approval.” The approval procedure remains usable, so this is safe to defer.
- **Evidence:** At `02f5d420`, `services/lti-service/src/lti/registration.ts:267–274` requires the authentication, token, JWKS and registration endpoints to have the issuer's **origin**, and `authorization_server` to be absent or exactly the token URL. For example, a token audience on the same host but a different path still stages the registration. QA E2-02-03 also distinguishes an off-origin audience, not only a token endpoint.
- **Suggested fix:** State those conditions in simple terms, or make the result page the decision: proceed when it says Connected; request approval whenever it says Waiting for approval. Keep the host example as an example, not the full rule.

### B-LA-E8-03-02 — MINOR — The extra-audience row promises too much

- **File:** `docs/guides/ltiaas/baseline-admin-changes.md:105`.
- **Problem:** “Every launch fails” for a second audience, followed by “Then the launch passes” after adding it, omits both the existing trusted list and the required authorized-party claim. This can send an admin to the wrong remedy for an audience error.
- **Evidence:** `services/lti-service/src/lti/checks.ts:121–129` accepts an already-trusted extra audience, requires `azp` with multiple audiences, and checks that `azp` equals the client ID. The cited `docs/reviews/LA-E3-12/qa.md:60` proves the negative/positive trusted-list pair with a correct `azp`; it does not prove the unconditional statement.
- **Suggested fix:** Say that an **untrusted** extra audience is refused. Ask the operator to confirm the cause and expected audience using the linked runbook; adding trust fixes that refusal when the other launch checks pass.

### B-LA-E8-03-03 — NIT — The quoted collision text is the API text

- **File:** `docs/guides/ltiaas/lti-generic-admin.md:176` and `docs/guides/ltiaas/brightspace-admin.md:168`.
- **Problem/evidence:** Both rows label the server collision description as portal text. The portal generic `PLATFORM_IN_USE` text ends with “Make a new tool registration for this library.” (`apps/portal/src/connect/provider-errors.tsx:13`); it omits “or ask your Cogniate operator.” The cited E2-04 round-4 QA distinguishes the ordinary portal substitution from the staged-gone exception.
- **Suggested fix:** Quote the portal text exactly. Keep asking the operator as the guide's advice. The error code and recovery action are already correct.

## Acceptance, usability and verification

The guides separate library-user, LMS-admin and operator work; steps are short and generally use simple technical English. The Canvas section gives the staged registration → approval code → Save sequence and warns about the hosted configuration-fetch restriction. The base M1 guides remain intact.

- **AC-01:** All eight generic and nine Brightspace row keys/labels match in order; their values match the adapter, manifest and app contract. The guide-specific wave-end API comparison is explicitly pending. K2 E7-07-02 supplies existing row/copy-button evidence.
- **AC-02 / AC-06:** Brightspace fact statuses preserve the channel README's live limitations. All **five** manifest defaults match; five is correct despite the spec's older “four” wording, and K2 E7-07-02/03 verifies all five.
- **AC-03:** The listed baseline changes cite corresponding QA rows, with simulator/unit tiers and pending Moodle/live checks distinguished. The extra-audience wording issue is recorded above.
- **AC-05:** The quoted staged heading and body match `tool-pages/register.ts`. The final guide-specific page comparison is marked pending; earlier E2-04/E2-06 and K2 evidence covers the flow.

Read-only source and evidence review, plus a local reference scan: **60/60 local links resolve**, including heading anchors. No UNIT acceptance criterion applies to this documentation task. No runtime tests, Docker, stack, host stack runner, dependency installation or commit. The dispatch changes only its three allowed guide files; no product, frozen test or base guide changes. Only this review file was written in integration. The two guide-specific K1-SIM comparisons and real LMS checks remain separate from this approval.
