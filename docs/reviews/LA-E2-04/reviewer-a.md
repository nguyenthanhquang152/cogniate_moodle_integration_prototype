Verdict: APPROVE
Round: 5

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


## Round 2

Verdict: APPROVE. Reviewer: Codex GPT-6-Astra xhigh. Date: 2026-10-23. **Open counts: 0 BLOCKER, 0 MAJOR, 1 MINOR, 0 NIT.**

Reviewed `71da381` and `16085aa` (merge `67e5ab0`), the staged-form fix `9d52c24`, and the BD-A1-96/-97 contract changes in `0ad9807`. Product tests ran at `67e5ab0` in fresh private clone `/tmp/la-reviewer-a-ctx-5531550d7cc2`, with its own `npm ci`. `node_modules/.vitest-cache` was deleted before every Vitest run.

### Round 1 findings

- **A-LA-E2-04-01 (MAJOR): CLOSED.** `9d52c24` adds the three dynamic-method binding fields to the generic manifest and preserves the staged deployment IDs in the pending connection DTO. The original private `/integrations/lti-generic/con_shell` route probe now submits exactly `{ clientId, deploymentId, grantCode }`; the public DTO/form-body chain redeems it. The new RQ-2 P test also pins the three prefilled inputs and preserves the longer manual form. The shared wizard needs no product change. `9d52c24` was not in Round 1's `0e6bace` snapshot, so this is a later fix, not a withdrawal of the original reproduction.
- **A-LA-E2-04-02 (MAJOR): CLOSED.** The repeat path compares admin values with the committed approval's grant before returning. Changed issuer/endpoints and added, removed or changed audience give `422 GRANT_MISMATCH`, ordered `details.fields`, and `grant_rejected` / `mismatch`; the platform stays unchanged and no LTI call runs. Identical values, canonical-equivalent origins, fixed-profile bodies and short staged bodies retain the no-op path. The original changed-JWKS probe passes. A further probe confirms that an expired original grant and a different well-formed submitted code do not affect an identical finalized repeat, while a changed bound value is still refused.

### New finding

**A-LA-E2-04-03 (MINOR): a gone staged platform still gets the developer-key collision description.**

- Where: `services/cogniate-app/src/app/redemption.ts:319`, through `:222`–`:226`; requirement: app API delta §3.4, BD-A1-97.
- Problem: the missing staged-platform branch uses the generic `inUse()` response, which says the developer key is already connected and asks for a new developer key. BD-A1-97 requires the description to explain that the staged registration is gone and to make a new connection.
- Evidence: a private app-route probe stages a platform, issues a valid grant, deletes that platform from the fake LTI service, and submits the short body. The status/code are correctly `409 PLATFORM_IN_USE`, but the description is: “This your LMS developer key is already connected to Cogniate. Make a new developer key for this library, or ask your Cogniate operator.” The connection remains pending, its lease is cleared, the grant stays unredeemed, and no activation runs. Only the cause/recovery text is wrong; no safety or data-loss failure was found, so this is safe to defer.
- Suggested fix: give the missing staged-platform branch its own description while preserving the existing code, cancellation cleanup and collision descriptions for other cases. Add an assertion for the cause and new-connection instruction beside the staged redemption tests.

### Ratified cases and verification

- **BD-A1-96:** the changed refused-event rows match the implemented branches, including `deployment_mismatch`, staged `client_id_mismatch`, missing `--accept-staged`, and the checks before printing staged values. Every literal `refuse` code in `operator.ts` has a catalogue row. The existing operator bound-value tests pass.
- **BD-A1-97:** changed staged values give `422` with the differing fields and mismatch log. Private checks confirm that disconnect, or suspend followed by release, of a never-redeemed staged connection leaves the inactive platform unchanged. The gone-platform state/status behavior is correct; finding -03 covers its description.
- Focused public redemption, operator, connection, registration and portal suites: **202/202 tests in 7 files**. Private probes: **7 pass, 1 fails**, with the sole failure establishing -03.
- Three old-code negative controls are detected: restoring the pre-`71da381` engine fails **4** repeat checks; restoring the pre-`9d52c24` manifest fails **2** wizard checks; restoring its old DTO fails the staged prefill/redemption test. All product files were restored; the two changed public suites then pass **15/15**.
- K0: **149/149**. App and portal typechecks and full lint pass. F1: **0 hits**. F5: **6 rules, 0 hits**. The private clone is clean; probe sources and logs are saved under `/tmp/la-reviewer-a-ctx-5531550d7cc2-probes` and the same `/tmp` prefix.

The fix stays within the engine/adjacent-test scope and the explicit P test handover; the earlier manifest/DTO fix supplies the staged form without a shared-wizard edit. No frozen acceptance, LTI-service, migration or unrelated product file changes. No Docker, stack, stack-starting runner or commit was used. No other reviewer's file was opened, and only this review file was edited in the integration worktree. K1-SIM, R1 and live/browser gates remain QA work.


## Round 3

Verdict: APPROVE. Reviewer: Codex GPT-6-Astra xhigh. Date: 2026-10-23. **Open counts: 0 BLOCKER, 0 MAJOR, 0 MINOR, 0 NIT.**

Reviewed `da423f9` (merge `77df44e`) against the task spec, app API delta §3.4 and BD-A1-97.

**A-LA-E2-04-03 (MINOR): CLOSED.** The missing staged-platform lookup now returns `409 PLATFORM_IN_USE` with the cause and new-connection instruction. The optional description is supplied only for that staged branch. The developer-key collision sentence and shared-deployment error remain unchanged, as does the common attempt-cancellation and lease-cleanup block. The new public test and the original Round 2 probe both pass: no create or activation, the grant remains unredeemed, and the direct route leaves the connection pending with no lease. This text fix does not change status transitions.

Verification in fresh private clone `/tmp/la-reviewer-a-ctx-50efa367f558` at `77df44e`, with its own `npm ci` and `node_modules/.vitest-cache` removed before each Vitest run: **21/21** admin-redemption/public and original private checks pass, plus **3/3** selected existing redemption regressions covering collision behavior. Restoring the pre-fix engine makes both gone-platform text tests fail; restoring the reviewed engine makes both pass. App typecheck and lint of both changed files pass.

Only the authorized K engine file and adjacent test changed under the dispatched L2 RQ-2 handover; no LMS name or unrelated behavior was added. The private clone is clean; probes/logs use `/tmp/la-reviewer-a-ctx-50efa367f558-probes` and the same `/tmp` prefix. No Docker, stack, commit or other reviewer's file was used. Only this review file was edited in the integration worktree. No Reviewer-A findings remain; QA's remaining gates are unchanged.


## Round 4

Verdict: APPROVE. Reviewer: Codex GPT-6-Astra xhigh. Date: 2026-10-23. **Open counts: 0 BLOCKER, 0 MAJOR, 0 MINOR, 0 NIT.**

Reviewed `00d17d3` (merge `2434c26`) against BD-A1-101, the task notes, app API delta §3.4, LA-ADR-01 D2/D12 and plan §6.1. No new findings; the earlier findings remain closed.

The exclusive-platform collision reads `texts.registration.PLATFORM_IN_USE`, fills `{LMS}`, and falls back to the exact ratified core sentence. Canvas supplies the existing bytes; the frozen assertion in `redemption.test.ts:378` is unchanged and passes. Moodle keeps its self-authority path and frozen collision text. The staged-gone override, `DEPLOYMENT_IN_USE`, cancellation, lease cleanup and grant handling are unchanged. The kernel's key map stays closed, and only this core default is exempt from the test requirement to contain `{LMS}`. Portal notices remain separate.

Verification in fresh private clone `/tmp/la-reviewer-a-ctx-071f8c50cc95`, pinned at `2434c26`, with its own `npm ci` and `node_modules/.vitest-cache` removed before every Vitest run:

- Focused kernel, legacy-wire, redemption and connection suites: **162/162**. After restoring all mutations, the kernel/admin-redemption suites and the Moodle manual-connect regressions pass **60/60**.
- Three negative controls each fail the intended assertion: the pre-fix engine returns the old generic wording; removing the new kernel key makes the Canvas manifest invalid; removing `{LMS}` from `INVALID_REQUEST` violates the unchanged rule for other defaults.
- App and channel Node typechecks and lint of all five changed files pass. F1: **0 hits**. The private clone is clean; logs use the same `/tmp` prefix.

All five changed files fit the explicit L2 RQ-2 handover in K files. No frozen assertion, forbidden file or unrelated behavior changed. No Docker, stack, commit or other reviewer's file was used. Only this review file was edited in the integration worktree. Existing QA runtime gates remain unchanged.


## Round 5

Verdict: APPROVE. Reviewer: Codex GPT-6-Astra xhigh. Date: 2026-10-23. **Open counts: 0 BLOCKER, 0 MAJOR, 0 MINOR, 0 NIT.**

Reviewed `094ad03` and `070a8cb` (merges `048cc5e` and `e654574`) against BD-A1-102, the task notes, app API delta §3.4, LA-ADR-04 D8's LA-IC-20 exception and plan §6.1. No new findings; earlier Reviewer-A findings remain closed.

Only the missing staged-platform branch adds `details.reason: staged_gone`. Ordinary collisions, including an existing staged platform that fails adoption, have no reason. The shared-deployment branch and cancellation/lease cleanup are unchanged. Both portal notices preserve the server description, action, code and trace ID when a non-empty reason accompanies one of the five channel error keys. An empty reason follows the existing channel/default text rule. The API client preserves the details field, the generic wizard uses the changed notice, and React renders the description as text.

The baseline Moodle, Canvas and Blackboard text assertions pass. Their values match the unchanged M2 error literals and the frozen Moodle sentence; no baseline producer gains a reason. No frozen test or LD-9 list change is needed for this exception, as BD-A1-102 specifies.

Verification in fresh private clone `/tmp/la-reviewer-a-ctx-4cd8cf89e02f` at `e654574`, with its own `npm ci` and the Vitest cache deleted before every run:

- **154/154** checks pass across both redemption suites, the portal notice suite and one private staged-adoption probe. The probe confirms the ordinary collision has no reason, performs no create/activation, leaves the grant unredeemed and clears the lease.
- Restoring either old product file fails its new test. A mutation that marks ordinary collisions as staged-gone fails both the manual and staged collision checks. All files restored: **27/27** affected checks pass.
- App and portal typechecks, lint of all five changed files and F1 pass (**0 hits**). The clone is clean; probe source is saved under `/tmp/la-reviewer-a-ctx-4cd8cf89e02f-probes`, with logs under the same `/tmp` prefix.

The K edit follows the explicit L2 RQ-2 handover; the portal files belong to P. No unrelated or forbidden file changed. Only this review file was edited in the integration worktree. No Docker, stack, commit or other reviewer's file was used. M2/browser and other runtime gates remain QA work; they were not run here.
