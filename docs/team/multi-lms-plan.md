# Blackboard and Canvas integration phase

Date: 2026-10-20. Base: `9e24137`. Owner: Lead.

## Authority and goal

The product owner requested Blackboard and Canvas support as the next step toward an enterprise LTI service.
The owner requested both Claude Code Opus 5.5 and Codex GPT-6-Astra, each at xhigh effort.
The existing Codex coordinator remains Lead for this phase.
The role ownership and independent review gates in the charter still apply.
The earlier push request covered the completed Moodle release. This phase has no push authorization.

Work branch: `nguyenthanhquang152/lti-multi-lms`.
Orca run: `run_ebe671ad72a9`.

## Sources and scope

- [DataCamp Blackboard case](https://support.datacamp.com/en-us/articles/17598773-blackboard-lti-integration)
- [DataCamp Canvas case](https://support.datacamp.com/en-us/articles/17598821-canvas-lti-integration)
- Current official Blackboard, Canvas, and 1EdTech documentation.

Use the cases to understand administrator, teacher, and learner flows.
Implement the open standards independently.
Do not copy DataCamp credentials, client IDs, private endpoints, prose, or product policies.
Keep Cogniate's current privacy and grade policies unless a reviewed design requires a change.

The phase covers provider setup, registration, Deep Linking, learner launch, and grade return for both LMSs.
Keep the existing Moodle flow and its native-only features.
Separate the LMS site URL, issuer, registration endpoints, and service origins where the standards require it.
Do not weaken SSRF checks or tenant isolation to accept a new provider.
Treat a provider profile as configuration, not proof of live interoperability.

The Architect will define precise acceptance criteria and file ownership before implementation.
Enterprise operations such as billing, high availability, and certification require a separate scope decision.
They are not implied by adding these two LMS integrations.

## Roles and gates

### Current owner direction: two LMS teams, one engine

The owner clarified this structure after the M0 gate passed:

| Team | Implementation | Independent QA |
| --- | --- | --- |
| Team 1: Blackboard | Existing Author, Claude Code Opus 5.5 xhigh | Existing QA, Codex GPT-6-Astra xhigh |
| Team 2: Canvas | Existing Author-2, Codex GPT-6-Astra xhigh | Existing QA-E2E, Claude Code Opus 5.5 xhigh |

Only these two models and xhigh effort are authorized.
Moodle, Blackboard and Canvas share one LTI engine.
The teams own provider-specific adapters, setup flows and tests around that engine.
Shared engine and portal files each have one named implementer; two workers never edit the same file concurrently.
Both existing reviewers remain separate from the authors and QA, and review both teams.
The Architect and Docs remain shared roles. The Lead integrates the work.
At most two implementers and one QA or reviewer run beside the Lead.

The horizontal M1/M2 implementation and test-preparation tasks were never dispatched.
They are now marked blocked as superseded; their old ownership is not authority to start work.
Read-only Architect task `task_f8c34ad605f6`, dispatch `ctx_e9dd8cd62b35`, completed the file and interface map.
The [two-team brief](multi-lms-team-brief.md) is the current ownership authority.
It names the shared backend owner, shared portal owner, provider files, test paths and foundation handoffs.
This changes execution ownership, not the approved protocol, criteria or review gate.

### Initial role assignment (history)

| Role | Model | Initial responsibility |
| --- | --- | --- |
| Lead | Existing Codex coordinator | Task briefs, team records, commits, integration, gate tracking |
| Architect | Claude Code Opus 5.5, xhigh | Sources, design, contracts, acceptance criteria, final conformance |
| Author | Claude Code Opus 5.5, xhigh | Backend and shared protocol implementation after design review |
| Author-2 | Codex GPT-6-Astra, xhigh | Portal provider flows in an isolated worktree after design review |
| QA | Dedicated Codex GPT-6-Astra, xhigh | Independent acceptance tests from the approved criteria |
| QA-E2E | Dedicated Claude Code Opus 5.5, xhigh | Moodle regression and available live LMS checks |
| Reviewer-A | Dedicated Claude Code Opus 5.5, xhigh | Correctness, protocol conformance, security |
| Reviewer-B | Dedicated Codex GPT-6-Astra, xhigh | Operability, maintainability, evidence, user flows |
| Docs | Dedicated Claude Code Opus 5.5, xhigh | Setup guides and small human review artifacts |

Both reviewers submit their first findings independently.
No author or Docs worker acts as QA or as a reviewer.
The Lead commits only named paths and marks tasks done only after the charter gates pass.
Record requested and effective worker models from Orca receipts.
Report a model or effort mismatch before relying on that worker's result.

## Validation boundary

Use local signed LTI platform fixtures for deterministic protocol and isolation tests.
These fixtures do not prove behavior on a real Blackboard or Canvas tenant.
Use existing authorized LMS environments when available.
Do not create third-party accounts or expose the local stack publicly without authorization.
Record unavailable live checks as unverified, with exact steps for the team.

Preserve the existing stack and unrelated containers.
Every test stack needs its own ports, network, data, and cleanup.
Do not run a destructive reset against the user's existing environment.

## Task board

| Task | Result | State |
| --- | --- | --- |
| M0 | Source review, architecture, contracts, criteria | Done for design scope; round 3 accepted and nonblocking text corrections applied |
| M0-A2 | Read-only portal and integration audit | Complete; no code or tests changed |
| M0-AU | Read-only backend and deployment impact audit | Complete; no code or tests changed |
| M0-QE | Independent environment and live-LMS validation preflight | Complete; environment inventory, no product verification |
| M1 | Shared backend and provider registration support | Planned |
| M2 | Blackboard and Canvas portal flows | Planned |
| M3 | Independent QA and Moodle regression | Planned |
| M4 | Guides, interactive review pack, final conformance | Planned |

## Launch evidence

Orca accepted these workers. Each receipt reports the requested model and effort as effective.

| Role | Dispatch | Effective model | Effort |
| --- | --- | --- | --- |
| Architect | `ctx_c8c00b22d5f1` | `claude-opus-5-5` | `xhigh` |
| Author-2 | `ctx_1eeade383449` | `gpt-6-astra` | `xhigh` |
| QA-E2E preflight | `ctx_3c4961a02f14` | `claude-opus-5-5` | `xhigh` |
| Author impact audit | `ctx_94cbe8647c96` | `claude-opus-5-5` | `xhigh` |
| Reviewer-A source preflight | `ctx_8546daf0903f` | `claude-opus-5-5` | `xhigh` |
| Reviewer-B workflow preflight | `ctx_6964f917fdea` | `gpt-6-astra` | `xhigh` |
| Reviewer-A formal design review (same instance) | `ctx_1d8b93c872ae` | `claude-opus-5-5` | `xhigh` |
| Reviewer-B formal design review (same instance) | `ctx_3c1ba794297e` | `gpt-6-astra` | `xhigh` |
| QA design testability review | `ctx_4d2994dbaa01` | `gpt-6-astra` | `xhigh` |

The initial Docker inventory found no running containers.
The Lead asked which existing LMS test environments are available; the answer is pending.

## M0 checkpoints

The Architect completed the first correction in `ctx_51ca18725d38`.
ADR-011 revision 5 and [the response table](../architecture/review-response-M0.md) address all 23 initial findings.
This is the Architect's resolution record, not independent approval.
The Lead froze the design at `bd9fe36` and reused the same Reviewer-A, Reviewer-B and QA instances for round 2.
The new dispatches are `ctx_e0abb11702aa`, `ctx_adcbc4bedd37` and `ctx_d667c956a9d5`, respectively.
The retained structured sessions use authoritative dispatch preambles sent through Orca messaging.
No new worker process or model replacement was created for this wave.
The gate needs two approvals, a design-testability PASS, and no open BLOCKER or MAJOR.
M1, M2 and test-writing tasks stay blocked until that gate passes.

Round 2 is complete on `bd9fe36`: both reviewers require changes and QA gives FAIL for design testability only.
The reports preserve the first round and identify which findings are closed.
The same Architect completed revision 6 in `task_ca1fae1a7570`, dispatch `ctx_2b04d15a6bc3`, from `706a278`.
The same three independent instances remain retained for the next recheck.
Round 3 tasks are queued: Reviewer-A `task_ed981aeb1a31`, Reviewer-B `task_31e336af4b46`, and QA `task_15510d66f895`.
They depend on the completed correction and will use one frozen commit.
The completion reports all round-2 corrections applied; this is not independent approval.
Revision 6 adds committed deployment approval, inactive staging, ordered attempts, and history-based cleanup.
The criteria now contain 40 M1, 13 M2, 7 M3 and 8 M4 items, including the accepted A-M0-10 deferral record.
M1, M2 and both test-preparation tasks remain blocked.
The Lead froze revision 6 at `158a4d86fb5764f597ff20e3f652ae6d5225f96b`.
Round 3 uses the same retained sessions: Reviewer-A `ctx_61b8795c3642`, Reviewer-B `ctx_3b1d667906b2`, and QA `ctx_e5ddff18c81b`.
All three received their new authoritative preambles and the same frozen handoff.
All three completed the new tasks. Both reviewers APPROVE; QA gives PASS FOR DESIGN TESTABILITY ONLY.
The [implementation handoff](multi-lms-implementation-brief.md) records the full criterion count, ownership and test boundaries.
The Lead accepts the M0 design gate at `158a4d8`: no BLOCKER or MAJOR remains.
This is not product approval or live-LMS evidence.
Architect task `task_ceecd44306c1` applies three nonblocking text corrections before the implementation handoff:
A-M0-11 narrows the accepted race to self-hosted Canvas; A-M0-12 aligns the due-time test bound;
B-M0-10 distinguishes retained approval history from effective authority.
The same contracts already define those behaviors. No protocol redesign or additional deferral is authorized.
The Architect completed these exact clarifications in `ctx_58eb42ecc1de`.
The Lead checked the diff against the accepted contracts; it changes wording only and keeps ADR revision 6.
M1, M2 and both test-preparation tasks are now ready. Product implementation and verification remain separate.

The owner asked to proceed with Canvas and Blackboard in parallel.
Neither provider waits for the other provider's live access or setup work.
Shared LTI, grant and grade code has one backend owner; portal and independent tests run beside it.
Each provider keeps its own setup cases, acceptance results, live matrix and readiness status.
The current resource limit still applies: three active workers beside the Lead, and at most two test stacks.

Author-2 completed the read-only audit in `ctx_1eeade383449`.
Messages `msg_57b462b0aec3`, `msg_c8afa054e00e`, and `msg_b3a206ea8b3f` hold the findings.
The Lead sent the contract questions and source findings to the Architect.
Main gaps include provider identity, endpoint trust, deployment binding, framing, native-feature guards, and provider-specific UI.
These are implementation inputs, not independent QA evidence.

The Author-2 instance remains idle for later implementation.
This preserves the charter's requirement to use the same dedicated author instance across tasks.
The Lead accepted its successful completion and recorded retention before acknowledging the report.

Design review tasks `task_8539cca49e29` and `task_6df3fc0172eb` depend on the Architect's M0 task.
Each reviewer will write its own report before it sees the other review.
Independent QA task `task_8b0eb55ffe6f` will check the design's testability from its acceptance criteria.

The Architect completed the revision 4 proposal in `ctx_c8c00b22d5f1`.
The completion report is `msg_e1108c37cd51`.
It covers ADR-011, both API contracts, migration and security rules, and M1 through M4 criteria.
The Lead accepted the handoff for independent review, not as design approval.
The dedicated Architect remains retained for review corrections and final conformance.
No product implementation has started.

The frozen review proposal is `51e69d1`.
Both reviewers and independent QA confirmed that they started their assigned reviews.
The runtime refused `worker-start --terminal` for retained structured chat sessions.
The Lead reused each exact reviewer session through `dispatch` and sent its returned preamble by orchestration message.
Both sessions confirmed the new dispatch. These two dispatches do not own a new supervised process.
Their original retained resources remain assigned to the same dedicated reviewer roles.

Implementation tasks are queued, but they are not authorized to start before the design gate passes.
Backend task `task_88ef41c0aea3` resumes the dedicated Author.
Portal task `task_3b1e979ab893` resumes Author-2 in its isolated worktree.
Each task depends on both design reviews and the QA testability review.
The Lead must also confirm that all BLOCKER and MAJOR findings are closed.
The portal branch will first advance to the approved design commit.

Independent test preparation is also queued behind the design gate.
QA task `task_7676dddddb02` owns the signed simulator and M1 acceptance tests.
QA-E2E task `task_732732ad5b91` owns M2 browser tests.
Both write tests from approved criteria before reading author code.
Test preparation is not a product PASS; later runs use an exact candidate SHA.

The two dedicated reviewers started read-only preflights while the Architect revised M0.
Tasks `task_5029938ab2e4` and `task_843b9fd4f001` check stable vendor facts and setup workflows.
These tasks are not formal design approval. The reviewers remain independent.
They will reuse the same instances for the formal design review.

Reviewer-B completed its preflight in `ctx_6964f917fdea` without changing files.
The Lead sent B-PF-01 through B-PF-09 to the Architect.
This is not design approval. The same dedicated reviewer is retained for the formal review.

Reviewer-B completed its first formal review of `51e69d1` in `ctx_3c1ba794297e`.
Its verdict is CHANGES_REQUESTED: four MAJOR recovery and upgrade findings, plus two MINOR inconsistencies.
Independent QA completed the design testability review in `ctx_4d2994dbaa01`.
Its verdict is FAIL FOR DESIGN TESTABILITY ONLY, with six MAJOR gaps and three MINOR clarifications.
Their reports are [Reviewer-B](../reviews/M0/reviewer-b.md) and [QA](../reviews/M0/qa.md).
Both dedicated instances remain retained for recheck.

Architect correction task `task_76b235e74210` follows the three first reports.
The recheck tasks are `task_2e2307b7f7fe` (Reviewer-A), `task_f5a737f0a439` (Reviewer-B), and `task_f0190c5eafe4` (QA).
The initial task completions do not open the implementation gate when their verdicts require changes.
The queued M1, M2 and two test-preparation tasks are explicitly blocked in Orca until that gate passes.
The Architect confirmed correction dispatch `ctx_51ca18725d38` in the same dedicated instance.
The first reports and Lead correction directions are committed at `74de92c`.
Local dependencies are installed in both author worktrees. No product check ran as part of that preparation.

Reviewer-A completed its first formal review in `ctx_1d8b93c872ae`.
Its [report](../reviews/M0/reviewer-a.md) requests changes: one BLOCKER, one MAJOR, three MINOR and three NIT findings.
The blocker is self-hosted Canvas entering through the standard Moodle path without approval.
The MAJOR finding requires operator containment and correction of a redeemed binding.
All three first reports are complete. No design approval or product verification is implied.

Reviewer-A completed its source preflight in `ctx_8546daf0903f` without changing files.
The Lead sent A-PRE-01 through A-PRE-06 to the Architect in `msg_9328b2a6abc6`.
The same dedicated reviewer is retained for the formal review.

The Author completed the backend audit in `ctx_94cbe8647c96`.
Messages `msg_7b0385efd7e4`, `msg_a49edfb39d36`, and `msg_f0556212f33f` hold the findings.
The Lead sent them to the Architect and retained the same dedicated Author for implementation.
The findings cover deployment ownership, disconnect effects, stored keys, migration safety, and issuer-versus-site assumptions.
They are implementation inputs, not independent QA evidence.

QA-E2E completed [the environment preflight](../reviews/M0/qa-e2e-preflight.md).
The Lead accepted its report and retained the dedicated QA-E2E instance for the later regression task.
The VM has 7.75 GiB of memory. Seven existing Docker volumes belong to earlier work and must remain intact.

## Test environment decisions

Proceed with signed platform simulations and real Moodle regression first.
Assess local Canvas alone after those checks; do not change Docker Desktop settings.
Local Canvas and hosted Canvas are separate evidence levels.
Hosted Canvas and Blackboard validation still need confirmed access and a reachable tool configuration.

QA owns simulator behavior, signing fixtures, and score oracles under `tests/**`.
The Author owns required infrastructure and test transport plumbing.
Test overrides must stay unavailable in production.
A simulation must not impersonate real vendor hosts through DNS or certificates.

| Test lane | Project prefix | Port | Subnet |
| --- | --- | --- | --- |
| QA acceptance | `qa-multi-r` | 8443 | `172.29.0.0/16` |
| QA-E2E Moodle | `qa-e2e-m3-r` | 8543 | `172.31.0.0/16` |
| QA-E2E provider simulation | `qa-e2e-sim-r` | 8643 | `172.27.0.0/16` |
| Author smoke, when needed | `cogniate-multi-author` | 8743 | `172.26.0.0/16` |

Check availability again before each run. Run at most two stacks at once.
Cleanup of a worker's own temporary stack, clone, secrets, traces, and test image is authorized.
Preserve redacted evidence first. Never remove existing volumes, shared base images, or another worker's resources.

## Design requirements from the Lead

Public issuer, client, and deployment IDs do not prove that a library controls an LMS installation.
New Canvas and Blackboard bindings need a verified approval or proof step before activation.
This includes additional Canvas deployments.
Typing another institution's public deployment ID must not claim its launches.
This protection is in scope. It is not an accepted deferral.

The Lead selected trusted-operator approval for this prototype.
The operator verifies installation authority outside the portal.
The operator issues a one-time expiring grant for the exact library, connection, provider, site, client and deployment.
The app must redeem that grant atomically before it activates the binding.
Normal LTI validation will not gain an exception for unbound deployments in this phase.
The Architect must define the trust boundary, recovery steps and negative tests.

The Architect accepted this direction in `msg_6bf730b0e5a7`.
Canvas uses Paste JSON setup and graded assignment selection in this phase.
Ungraded Canvas module items are deferred; the existing grade policy stays unchanged.
The final design must separate hosted Canvas evidence from local Canvas evidence.
Rollback uses coordinated, verified backups and restores; it must state the lost-write consequences and pass QA.

Canvas will have one configured page origin and one configured service origin, which defaults to the page origin.
The operator grant must bind both. No wildcard or arbitrary alias list is in scope.
Canvas AGS, NRPS and token requests use the service origin; Deep Linking and framing use the page origin.
The Canvas simulator must use its actual `iframe` launch claim, including new-tab launches.
A top-level Canvas embedded page will continue to its player; a framed page keeps the open-in-window step.
The final design must define permanent handling of upstream HTTP 422 and retain the existing policy for HTTP 400.

The acceptance criteria must cover first-claim squatting, cross-library redemption, replay, disconnect, and old stored service keys.
Disconnecting one deployment must not stop another institution or reactivate old authority through a later binding.
Keep existing Moodle IDs and service keys valid across migration.

M1 includes `apps/player/**` for provider-aware learner text, as well as services, packages, and infrastructure.
M2 owns only `apps/portal/**`.
Preserve anonymous identity and the existing grade policy.
Canvas dynamic registration, billing, high availability, public deployment, and certification are outside this phase.

## Direction for the first design correction

Keep the operator-grant model and close the alternative registration path found by Reviewer-A.
The `standard` profile must not let a real self-hosted Canvas launch bypass the required approval and privacy rules.
Preserve legitimate Moodle launches. The Architect must state the exact signed evidence and refusal rule.

Add a bounded operator procedure to recover an incorrectly approved binding.
It must revoke old authority before any corrected binding can activate.
It must not transfer old publications, attempts or grades to another library.
This is an operator recovery path, not general self-service reassignment.

For Q-M0-04, narrow the third-host claim to what the trusted inputs can establish.
Specify Deep Linking return checks, browser frame restrictions and top-level resource launches separately.
Do not add browser Referer checks as ownership proof.

The one-page-origin and one-service-origin rule applies to self-hosted Canvas too.
Its issuer remains the configured page origin. Test a distinct approved service origin explicitly.
Define one canonical URL representation before storing values and comparing approval grants.

QA's internal transport fault barrier is authorized only in the acceptance environment.
The Author owns its infrastructure; QA owns the scenarios and assertions.
Use fixed local transport endpoints and explicit gates. Do not weaken production URL checks.

Split default-profile T7 from legacy acceptance suites that need their existing fixtures and knobs.
Use the new revision's maintenance commands while both old services remain stopped.
Validate the complete backup before replacing either database, including sidecars and backup identity.

## Direction for the second design correction

Resolve these groups together. A passing remote call alone does not prove that an app binding was approved.

| Required correction | Finding ids |
| --- | --- |
| A Canvas deployment has app launch and grade authority only after its own approval commits. Separate a finalized repeat from an active orphan. Retry, cancellation and cleanup must keep the existing approved deployment working. | B-M0-07 (BLOCKER), Q-M0-R2-03 |
| An older or cancelled attempt cannot adopt a newer attempt's ref. Adoption must atomically establish or validate the required active state, including compensation between its read and write. | B-M0-03 |
| Persist each attempt's target and locate unfinalized Canvas platforms through that history. Suspend and release use an owned remote ref even when the connection has no final platform id or ref. Preserve newer and foreign bindings. | A-M0-09, B-M0-08, Q-M0-R2-02 |
| Separate live overlap within the five-second call from a timed-out late write and a dead handler's lease. Define gate request ids, phases and delivery after caller disconnect. Give executable schedules and explicit cleanup owners. | B-M0-09, Q-M0-R2-01 |
| Align encoded-id inputs, fixed-deployment error precedence and the due-time behavior of disabled score rows. | Q-M0-R2-04, Q-M0-R2-05, Q-M0-R2-06 |

The two reviewers differ on whether the current fence is complete.
The concrete schedules in B-M0-03 and B-M0-07 remain required corrections.
The next independent rechecks must trace those schedules explicitly.
Keep the existing production timeout and security checks; do not add a test bypass to make an unreachable schedule pass.

A-M0-10 is an accepted MINOR deferral under charter §5 for this prototype.
After release, an authenticated library can race the rightful Canvas owner by making a new standard-profile record with the same public identifiers.
Signed product-family checks still refuse its Canvas launches before claim storage.
This can block setup; it does not authorize Canvas access.
Correct the false claim that every later binding must use a grant.
Document the operator order and residual race without claiming that prompt redemption prevents it.
Protection against repeated hostile registration needs a later reserved-identifier or quarantine design before an enterprise service relies on this workflow.
The Architect must record this limit in the ADR, response and guide requirements.
Docs must carry it into `docs/human_review/deferred.md` in M4.
This deferral does not waive any BLOCKER, MAJOR or functional recovery check.

The Architect proposed the second correction in `msg_b3037b65604e`.
The Lead directed it to proceed in `msg_c1e60694db20`; this is not independent approval.
The proposed shape uses one attempt lease per connection, changing refs on conditional writes, inactive staging, committed deployment approvals, and saved attempt targets and ref history.
The final contracts must distinguish denied app authority from a remote record that still needs cleanup.
They must also define exact generation changes, replacement-request refusals, discovery of late records, and preservation of another connection's binding.
