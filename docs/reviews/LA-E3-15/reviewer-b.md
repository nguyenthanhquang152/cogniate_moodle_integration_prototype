Verdict: CHANGES_REQUESTED
Round: 1

## Round 1

Reviewer: Codex GPT-6-Astra, xhigh, 2026-10-23. Lens B: can a human team own it? Scope: `4a62acb` (merge `2cc2aa5`), tested at `8208d2dc9597100e3253d602d5c4e4c2cb760b2b`. Read the task spec, LA-ADR-05 D6, LA-IC-14, ownership matrix §5, plan §6.1, and the named A1 follow-ups. No Reviewer-A file was opened.

One MAJOR finding. No other findings.

### B-LA-E3-15-01 — MAJOR — The new granted dynamic method cannot reach operator approval

**Files:** `packages/channels/canvas/manifest.ts:22` enables the path; `services/cogniate-app/src/app/connections.ts:210` and `services/cogniate-app/src/domain/connections.ts:206` still assume the earlier authority split.

**Problem:** A Canvas dynamic connection starts with `operatorGrant`, but the app only gives the `self` creation path an initial registration URL and only lets a `self` connection retain a staged platform. The advertised method therefore leaves an operator without the promised approval flow.

**Evidence:** Private HTTP probes using `canvas-sim-cloud` found:

1. Creation returns `201`, stores `operatorGrant`, and returns `registrationUrl: null`: the grant branch passes `null` as the ref. The existing dynamic creation contract supplies this URL (base app API §4).
2. Explicitly calling `POST /connections/:id/registration-url` gets past that first gap. The probe then supplies the planned LA-E3-09 completion result: an inactive Canvas platform with the exact binding ref sent by the app. `POST /tool/register` still returns `REGISTRATION_FAILED`, with upstream code `PLATFORM_NOT_ACTIVE`, because `stageRegistration` requires `binding_authority = 'self'`. It stores no staged platform, so the operator cannot proceed from that result to approval. The page says to try again; retry cannot fix this authority mismatch.

The existing `lti-generic` staged flow works because its dynamic method starts with `self`: `app/connections.ts:175` creates the ref, and staging then changes authority once to `operatorGrant`. Canvas starts with that authority already. This is a shared app assumption exposed by the new Canvas method; another dynamic method starting with `operatorGrant` would meet it too. The Lead confirmed that this app extension has no assigned companion and asked to record it for A1/K.

**Suggested fix:** K should create the initial ref for pending dynamic connections with grant authority and support their first staging write. A1 should define that transition's guards: preserve the pending/dynamic checks, the matching request binding ref and inactive platform checks, and rejection of an already staged or bound connection. Keep the existing generic transition and replay protection. Add a Canvas app test from create through the waiting-for-approval page and stored staged platform.

### Checks and scope

The manifest itself is clear and matches the specified method order, five profiles, default, and grant authority. Its derived capabilities and all six legacy flags have the intended values. The updated legacy assertion fails when the added method is removed. The diff touches only the manifest registration list and the explicitly named K-owned test; no production core LMS name or protected file changed.

The README and binding-field follow-up is `07eab11` (merge `dc98c43`), read for context and outside this round. Its README names both methods and the operator grant. The Canvas portal companion and LA-E3-09 service implementation remain separately assigned. The finding above is in the app handling of the planned service result.

Verification used `/tmp/la-review-b-589333895eac`, a fresh `git clone --no-hardlinks` with its own `npm ci`; its Vitest cache was removed before every run. **49 tests passed** across kernel registry/capabilities and app connections/staged registration. Kernel and channel Node typechecks, changed-file ESLint, and F1 passed. Of four private probes, two passed the manifest and HTTP capability/create checks; two failed on the flow checks above. A temporary control change to the two app assumptions made all four probes and the five existing staged-registration tests pass (**9 total**); it was restored. Removing the dynamic method caused the expected legacy-projection test failure. No product mutation remains.

There are no UNIT-labelled ACs in this task; K0, K1-SIM, and the LA-IC-14 assertion-change list remain with QA. No Docker, stack, or commit was used. Only this review file changed in integration.
