Verdict: CHANGES_REQUESTED
Round: 1

# LA-E2-04 review: Reviewer-A

## Round 1

Reviewer: Codex GPT-6-Astra xhigh, lens "Is it right and is it safe?" Date: 2026-10-23. **Counts: 0 BLOCKER, 2 MAJOR, 0 MINOR, 0 NIT.**

Reviewed `3b2cdeb`, `064f4fa`, `32e27bd`, `63a51c1`, `1537882`, `da9a663` and `e0ffe74`, integrated by `0e6bace`, against the task spec, LA-ADR-02 D2a/D5/D6, LA-ADR-04 D4, app API delta §3.4/§5/§7, BD-A1-79/-87/-90..92 and plan §6.1. Tests ran in private clone `/tmp/la-reviewer-a-ctx-88ca8c796cc6`, pinned at `0e6bace`. The companion `3777e7c` fix is reviewed separately in LA-E2-03 Round 2.

### Findings

**A-LA-E2-04-01 (MAJOR): the staged generic portal form cannot send the required client and deployment IDs.**

- Where: `services/cogniate-app/src/kernel/authority/operator-grant.ts:17`; consumer `apps/portal/src/channels/ManifestWizard.tsx:33` and `:112`; `packages/channels/lti-generic/manifest.ts` (`setup.bindingFields`).
- Problem: staging preserves `method: dynamic` and changes the stored authority to `operatorGrant`. All generic binding fields have `method: manual`, so the existing wizard filters out both IDs. It adds only its fallback Approval code field. The new staged parser correctly requires all three keys, but there is no working portal path to supply them. App API delta §3.4 requires the portal to prefill both IDs from the staged platform.
- Evidence: a private test renders the actual `/integrations/lti-generic/con_shell` route with a pending dynamic/operatorGrant connection and a stored platform, types the approval code and clicks Save. The captured body is only `{ grantCode }`, without `clientId` or `deploymentId`. A separate real app-route probe stages a platform and issues a valid `--accept-staged` grant; that form body returns `422 INVALID_PLATFORM_VALUES`, fields `["clientId", "deploymentId"]`, and the platform stays inactive. The public chain test constructs the complete three-key body by hand and does not exercise the portal form.
- Suggested fix: arrange the P-owned wizard change through RQ so a staged connection renders/prefills its client and deployment IDs and submits exactly the short staged body. Keep the strict server checks. Add a real generic staged-form submission test, including the stored IDs, and connect its body to the staged redemption test.

**A-LA-E2-04-02 (MAJOR): finalized manual retries bypass the new bound-value comparison.**

- Where: `services/cogniate-app/src/app/redemption.ts:76` and `:159`; the new comparison is at `:125`.
- Problem: `finalizedRepeat` still checks only the registered state and client/deployment IDs. It returns the connection before phase 1 can compare the submitted admin values with the approved values. App API delta §3.4 limits this successful repeat to the same IDs **and bound values**; a changed value must not be reported as a successful repeat.
- Evidence: a private app-route probe issues a manual generic grant, redeems it successfully, then submits the same IDs/code with `jwksUrl` changed to another valid HTTPS URL on the same site. It receives `200`, with no LTI call. The existing public repeat assertion resends identical values, so it misses this case. This does not activate an unapproved endpoint: the stored platform remains unchanged, but the API falsely reports success for different requested values.
- Suggested fix: compare manual repeat values with the committed approval/grant's bound values before taking the no-op return, using the same origin/exact-URL and optional-audience rules. Return the documented mismatch with `details.fields` for changed values, while keeping identical repeats independent of a live grant and free of LTI calls. Cover changed endpoints and added/removed audience as well as an identical repeat.

### Acceptance and safety checks

| Area | Result |
| --- | --- |
| UNIT AC-01/-02/-06 | Tests cover missing bound flags, refusal on a fixed profile, value validation, printing before the code, foreign-host confirmation and refusal of `--accept-staged` without a staged platform. Unconfirmed issue stores no grant. Removing the foreign-host guard makes two tests fail. |
| UNIT AC-05 | The writer updates authority, frozen behavior class, staged record, issuer and ref fields in one guarded SQL statement. The trigger-abort test checks that failure changes nothing; the second-stage probe checks the authority guard. Removing that guard fails the named test. The domain writer is authorized by BD-A1-90. |
| UNIT AC-07 | Tests pin printed bound values and suspend/release of an admin-value binding through its stored exclusive-platform target. The cleanup path remains based on stored target kind. |
| Bound values and adoption | Phase 1 binds the grant to the library, connection, purpose, channel/profile/site and client/deployment values. S1 sends approved values. Staged redemption skips S1; S2 checks profile, IDs and all bound values before the unchanged A1–A3 ownership rules; S3 retains conditional activation and phase-2 compensation. Removing the manual comparison or both staged comparison guards makes the respective public refusal test fail. No unbound-value activation was demonstrated. Finding -02 is the repeat-path gap. |
| Staged registration and first use | The staged answer must be inactive and hold the fresh completion binding reference. Existing inactive-platform refusal, ref consumption and registration-URL refusal are tested. A kernel-served method whose provider reports fixed endpoints is unavailable and logs the specified first-use error. |
| Ownership and frozen behavior | No LTI-service, launch/picker, frozen acceptance or applied-migration file is changed. The staged writer and client work match the ratified K scope. Registration text uses channel data/defaults; tests pin the Moodle bytes. F1 and F5 pass without new exceptions. Finding -01 needs the P handover. |

### Verification

- Focused public app, client, adapter, operator and registration suites: **231/231 tests in 10 files**. App typecheck passes.
- K0: **134/134**. Full lint passes. F1: **0 files with hits, 0 hits**. F5: **6 rules, 0 hits**.
- Private probes: **2 failures** establish the findings and **8 passing controls**, including the six former LA-E2-03 failure probes. Four guard-removal mutations are detected: foreign-host confirmation, manual bound-value comparison, staged bound-value comparison and staged authority guard.
- Temporary diagnostic changes to render the staged IDs and compare finalized manual values make both failing probes and the related public suites pass (**181/181**). All diagnostic product changes were restored. The five affected public suites then pass (**75/75**), and the private clone is clean.

Probe sources are saved at `/tmp/la-reviewer-a-ctx-88ca8c796cc6-probes`; logs use that prefix in `/tmp`. No Docker, stack, stack-starting runner or commit was used, and no other reviewer's file was opened. K1-SIM AC-03/-04/-08, learner launch/score and the specified R1/Moodle regression remain QA gates; these in-memory tests do not claim those results. Only the two assigned Reviewer-A reports were written in the integration worktree for this dispatch.
