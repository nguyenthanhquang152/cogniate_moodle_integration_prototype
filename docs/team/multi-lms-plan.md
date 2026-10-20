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

The first provider-team wave was dispatched from `294114092b643766b5f552150038b812513da1d0`:

| Work | Task | Dispatch |
| --- | --- | --- |
| Blackboard and shared backend | `task_9522839fff91` | `ctx_bed3b61aefb9` |
| Canvas and shared portal | `task_11fc3a40e7a0` | `ctx_303ff8d6037c` |
| Common and Blackboard test preparation | `task_33fd8359458d` | `ctx_45f64a5defb9` |
| Canvas and M2 browser test preparation | `task_b8c969c16053` | Queued for the next free slot and simulator interface |

The first three reuse the same dedicated instances and the recorded model/effort settings.
All three workers confirmed activity.
The Lead will commit and transfer the backend and wizard interfaces at explicit checkpoints.
Canvas's first wizard/DTO checkpoint passed its portal typecheck.
It was committed on the Canvas branch as `1f8ebc5` and merged into integration as `c0b35ab`.
This is WIP interface evidence, not product acceptance.
The Blackboard owner received the typed wizard interface in `msg_b274eddbc535`.
The provider-aware player text request is `msg_808ad19bf8c6`.
The next Canvas slice was committed as `51f685a` and merged as `4876253`.
It adds the Canvas setup wizard, configuration export UI, approval forms and shared portal helpers.
Author checks passed: portal typecheck, targeted lint and 34 unit tests.
The Blackboard owner can now use the shared tool rows, error notices, form lifetime hook and copy fallback.
These are author checks, not independent feature acceptance.

The portal and player slice followed as `b3544ca`, merged as `42055ff`.
It adds provider routes, connection details, capability guards, publishing and results labels, and learner text.
Author checks passed: portal and player typechecks, targeted lint and 136 tests in 11 files.
The Blackboard wizard mount remains pending.
Canvas backend implementation started after the foundation transfer below.

The shared backend foundation is committed as `2aa9263`.
It contains the provider types, registries, shared origin and role helpers, route interfaces and five Canvas stubs.
The backend owner had frozen those five stubs in `msg_2eb8c5b7802a`.
The Lead captured the 26 named files with matching content hashes and tested an isolated clone.
The Canvas branch advanced to this commit without changing its ongoing portal edits.
Exclusive ownership of the five Canvas modules transferred in `msg_f0102e0ecabc`.
Canvas accepted in `msg_ed519996cc5c`; the backend owner received `msg_a57aa8f39711`.
The common connection fields (`lms`, `profile`, `serviceUrl`) were deferred to the second backend checkpoint below.

The first isolated root check at `2aa9263` passed lint, typechecks and 789 of 790 tests.
One Canvas test read a teacher heading before its separate request completed.
The author retained the assertion and waited for that heading.
The follow-up also fixes older polls replacing a successful write and preserves registered teacher guidance.
It is committed as `a8736b2`, merged as `410e0eb`.
The Lead's isolated root check at `410e0eb` passes lint, all typechecks and 791 tests in 55 files, with zero skips.
The command used the real course fixtures through `COURSE_FIXTURES_DIR`.
Local check logs are `/tmp/cogniate-lead-foundation.bzkF2F.check.log` and `/tmp/cogniate-lead-foundation.bzkF2F.followup-check.log`.
This is a checked WIP foundation and portal snapshot. Canvas and Blackboard backend behavior is still incomplete.
Author screenshots in `apps/portal/evidence/M2/author-self-check/` use mocked API responses and make no SIM or live claim.

Canvas's pure backend slice is committed as `8af7914`, merged as `096aa89`.
It implements five Canvas profiles, the adapter and the embedded continuation helper.
The author reports root lint, typechecks and 798 tests passing for this slice.
The six source and unit-test files were held for the commit, then released.
The backend owner received the implemented profiles in `msg_bb1f19617691`.
Canvas configuration and deployment routes use the typed connection handoff recorded below.
No provider-readiness or independent QA claim follows from this checkpoint.

The shared backend's second checkpoint is committed as `6742cd9`.
The Lead committed the 57 named, held paths from `msg_148c594af91e`.
The author check passed lint, typechecks and 821 tests in 59 files; log: `/tmp/au-check-cp2.log`.
It adds the provider-aware LTI paths, migrations 004 and 011, typed connections, app routes and grant-engine implementation.
The app redemption and cleanup modules compile, but their focused unit tests are still in progress.
The Canvas branch advanced to this commit with its route edits preserved.
Canvas received the typed connection, DTO and real redemption interfaces in `msg_18ea5d4b5b6e`.
The backend hold was released in `msg_12634eff2ca7`; Canvas-owned modules remain exclusive to Canvas.
Both implementation tasks continue. This checkpoint is not independent QA or full feature acceptance.

Canvas's final two backend routes are committed as `d01eb5e`, merged as `003e2e4`.
The author reports 11 focused route tests and a full root check of 832 tests in 61 files passing.
The four source and unit-test paths were held for the commit, then released.
All five Canvas backend modules are now implemented.
Canvas still owns the Blackboard wizard mount and final shared portal checks once that module is delivered.
The Lead requested this small Blackboard checkpoint in `msg_13c6f24fa767`.
The current evidence remains author self-checks; no independent SIM or live result exists yet.

The Blackboard wizard is committed as `6bbee71`.
Its five held files were released after the commit, and the Canvas branch advanced with its smoke-script edit preserved.
Canvas received the exact exports for the shared registry mount in `msg_8467740fcceb`.
The backend author's checkpoint check passed 866 tests in 66 files (`/tmp/au-check-cp5.log`).
That check includes uncommitted backend work and remains author evidence.
The backend owner also received two narrowly scoped tracking files for AC-M1-33's HTTP 422 mapping.
The [team brief](multi-lms-team-brief.md) records this ownership correction from `msg_495acdccb262`.

The final shared backend slice is committed as `ea36bd8` from 45 held paths.
It adds the shared learner wiring, operator commands, recovery tests and acceptance infrastructure.
The author's check passed 873 tests in 66 files (`/tmp/au-check-cp6.log`).
The path hold was released in `msg_7c05dd903e1f`.
That message authorizes a short default-profile smoke in the isolated author lane.
Acceptance startup waits for the Canvas simulator; the author must not replace it with a stub.

Canvas's final ten portal paths are committed as `3872e49`, merged as `4156ad9`.
Its implementation task completed in `msg_aaf5bc7d16b9`; the same instance remains retained.
The checked source was `6bbee71` plus that final slice: 838 tests in 62 files, portal build and 11 mocked browser stages pass.
The Lead inspected the Blackboard setup and teacher screenshots.
They are author evidence from mocked API responses, not SIM or live evidence.
The Blackboard owner has a minor duplicate instruction correction in `msg_58d0d35222b3`.
The final independent browser run must use the corrected candidate.

Common and Blackboard QA preparation completed in `msg_7dc06a3b7ea3` and is committed as `6733e57`.
Its 37 files include 144 API cases, 12 host checks and strict case accounting.
All 16 harness self-checks pass; this task made no product calls or stack runs.
The same QA instance remains retained for frozen-candidate verification.
The retained Claude QA-E2E instance started Canvas and M2 preparation in `ctx_2289f5d57f67`.
Its authoritative handoff is `msg_c851b8cb47a8`, with the committed simulator interface and explicit audience correction.
Both implementation teams and QA keep the original path ownership.

The Blackboard duplicate instruction correction is committed as `92f9f12`.
The author reported the three files complete, with 15 focused checks and portal typecheck passing.
The Lead checked the scoped diff and confirmed that indexed content matched the worktree before committing.
No hold remains on those files; the backend owner received `msg_6f6a81330d49`.
The isolated Lead check at `92f9f12` passes root lint, all typechecks and 874 tests in 66 files, with zero skips.
Log: `/tmp/cogniate-lead-foundation.bzkF2F.integration-check.log`.
This is the combined implementation check, not independent acceptance.

The backend implementation task completed in `msg_9dce99140564`; the same author instance remains retained.
Its default-profile smoke passed migrations, health, operator approval and containment, Moodle compatibility, and backup/restore checks.
The smoke found missing CLI audit logs when the process exited before the stream flushed.
The six-file correction is committed as `1e2c81f`.
The author reran the CLI checks and reports the expected audit events in the log.
Evidence: `/tmp/au-smoke/EVIDENCE.md` and `/tmp/au-smoke/logs/`.
The Lead confirmed no running containers and all seven baseline volumes after author cleanup.
The isolated combined check at `1e2c81f` passes root lint, typechecks and 876 tests in 66 files.
Log: `/tmp/cogniate-lead-foundation.bzkF2F.final-implementation-check.log`.
Both author tasks are complete. M1 and M2 still need independent acceptance and both reviews.

A narrow author infrastructure task, `task_0ea1b07b3397`, is queued for acceptance-profile startup.
It starts only after the Canvas simulator checkpoint is committed and the Lead supplies an exact revision and lane.
It checks simulator/gate startup and transport controls; it does not replace independent acceptance.
The Canvas QA checkpoint request is `msg_1fe8a7abb13e`.

The teams agreed on the player interface in `msg_a05ac85fc3b8` and `msg_7df7bdfe2bcc`.
The backend emits `data-lms-name` on the play page element and the content-origin runtime body.
Its value is `Moodle`, `Canvas` or `Blackboard`, derived from the stored connection.
The player accepts only these values and defaults to Moodle.
`playStatusText(status, lmsName)` also defaults to Moodle and preserves its existing text.

QA's simulator interface is committed in `7738dc3`, in `docs/reviews/M1/qa-plan.md`.
Canvas QA uses that interface when a worker slot becomes free.
The token assertion audience is a scalar for Canvas and an array for Blackboard.
The queued Canvas task's earlier shorthand about an audience array does not change this contract.

Both code review tasks depend on the two completed implementation tasks.
Reviewer-A: `task_def3c0e1323e`. Reviewer-B: `task_8b9947e26455`.
Each has separate reports for M1, M2 and relevant M3 infrastructure.
Reviewer-A started in `ctx_8abc3ceb148c`, with handoff `msg_6bb1694b881f`.
It reviews frozen implementation `1e2c81f` in a clean clone while Canvas QA prepares the remaining tests.
Its scope remains open until it also reviews the complete harness at a later exact revision supplied by the Lead.
The review must record both revisions and cannot approve missing tests.
Initially, Reviewer-B remained queued while one slot was reserved for the short acceptance-profile infrastructure smoke.
This parallel review start changes scheduling only; every acceptance and review gate still applies.

Reviewer-A's checkpoint `msg_fedfa10e31a0` covers static review at `1e2c81f`.
It reports no BLOCKER or MAJOR and one MINOR, A-M1-01.
The app accepts `LTI_API_URL` outside the acceptance profile; the startup scripts alone restrict it.
The retained backend author received the config guard and focused tests in `task_a15209c95b03`, dispatch `ctx_998a94e37e40`.
The authoritative handoff is `msg_3baae96cac7c`.
This bounded fix uses the reserved worker slot before the acceptance-profile startup smoke.
Reviewer-A remains active until it checks the committed fix and full harness supplement.
The checkpoint is not a final approval or independent product acceptance.

The author completed A-M1-01 in `msg_bac4c859dd20`; its two held paths are committed as `76b03c7`.
All 13 config cases and the full root check pass: 889 tests in 67 files, `/tmp/au-check-am101.log`.
The Lead's isolated check at `76b03c7` also passes lint, all typechecks and 889 tests with zero skips.
Log: `/tmp/cogniate-lead-foundation.bzkF2F.config-guard-check.log`.
Removing the guard made the four refusal cases fail; the author restored the guard before handoff.
Reviewer-A checked the exact delta and closed A-M1-01 by code reading in `msg_284bd54bb2aa`.
The author remains retained for the queued infrastructure smoke. No stack ran for this fix.
Final review still waits for the complete Canvas/M2 harness.

With the guard fix complete and Canvas preparation still active, Reviewer-B started in `ctx_055ee059f6df`.
Handoff `msg_7da9e4f23266` supplies frozen candidate `76b03c7` and the isolated 889-test check.
It reuses the retained GPT-6-Astra xhigh session and reviews independently of Reviewer-A.
Like Reviewer-A, it must inspect the complete committed harness supplement before final reports and settlement.
At that checkpoint, both reviewers and Canvas QA occupied the three worker slots.
The author infrastructure smoke waits for the checked Canvas module and the next free slot.
This avoids an idle review slot while keeping every verification gate.

Canvas/M2 QA preparation completed in `msg_008313464d19`; the same instance remains retained.
Its 31 paths are committed in `9964e6f`.
The inventory has 222 Canvas M1 rows (215 API, seven browser) and 64 M2 browser rows for both providers.
Full M1 discovery accounts for 359 API cases and 19 host/browser rows; 21 harness self-checks and typecheck pass.
M2's two harness self-checks, typecheck and 64-row accounting pass; the T7 selection remains 18.
No stack or product call ran in this preparation task.
Reviewer-A checked this supplement in `msg_478694142449` and reports no new finding from its lens.

Reviewer-B reproduced two product MAJORs in `msg_fe92ec471501`:

- B-M1-01: stale batch state permits a new grade POST after a connection is disabled, including during line-item lookup.
- B-M1-02: failed Docker or compose state checks permit backup/restore instead of refusing unknown service state.

The retained backend author is fixing them in `task_3ad990ed7771`, dispatch `ctx_02a94eea74ad`.
Handoff `msg_779d98e9768c` includes four independent probes and requires regression tests and a full root check.
Its additional MINOR B-M2-01 is the missing final Blackboard Submit instruction, routed in `msg_67647d0b44a3`.
That supplemental ownership is limited to the author's Blackboard steps and existing unit-test file.

Reviewer-B also found two harness MAJORs in `msg_f28b7dbcbfaa`.
B-M3-01 covers an invented wizard transition, the wrong connection-list location and incomplete baseline/label checks.
B-M3-02 covers full-page navigation that destroys the stale-state observer or resets the form under test.
The corrections must preserve every behavior assertion and use real client-side navigation.
They are mandatory in the final QA alignment task below.

Both reviewers now finish round-1 reports on `9964e6f`, with product code at `76b03c7`.
Messages `msg_b111ba3ce99a` and `msg_79c736363acc` replace the earlier instruction to wait for author repairs.
They will be retained for fresh round-2 reviews of all committed fixes.
A completed review task does not mean a passing verdict or a completed product gate.
This frees worker slots for the proper repair owners.

| Pre-verification follow-up | Task | Gate |
| --- | --- | --- |
| Architect: clarify Canvas domain, pending endpoint precondition and initial-grant check order (C-1 to C-3) | `task_52f5846266a5` | Accepted contract clarification, no silent design change |
| QA-E2E: exact oracles, B-M3-01/B-M3-02 and approved selectors | `task_ef66f1c5c7ed` | Architect clarification and author repair; then checked, committed harness |

For H-3, QA may read the accepted pre-M2 baseline `9e24137` and assert the exact Moodle disconnect text.
For H-6, the Lead approves only the M2 label-table changes in `tests/e2e/lib/portal.ts`, with affected test IDs recorded.
For H-1, QA may now read final portal structure to align selectors; all behavior assertions remain.
For H-7, retain the existing M2 host runner and infra helper interface; do not add a second selection path.
C-4's optional rotation host action is not added; its live matrix row stays unverified.
The two product-verification tasks are explicitly blocked on these internal gates and the acceptance startup smoke.
The Lead reopens them only after the exact product/test revisions and lanes are ready.

### Round-1 settlement and repairs

Reviewer-A completed its reports in `msg_b41420268b51`, committed as `17aa295`.
Its static code verdicts approve the reviewed scope, with A-M1-02 NIT open.
Reviewer-B completed in `msg_f1eb667c395a`, committed as `689e424`.
It requests changes for five MAJOR findings and the Blackboard instruction MINOR.
Both reviewed product `76b03c7` and harness `9964e6f`; neither report is product acceptance.
Both dedicated reviewer instances remain retained for fresh round-2 tasks.

The author completed B-M1-01 and B-M1-02 in `msg_ad700ad680a8`.
The seven held paths are committed as `9aeeddc`.
The repair also makes the maintenance entry point work through macOS path symlinks.
Meaningful tests cover disable during batch processing and lookup, failed Docker observation, and actual backup/restore entry.
The author reports mutation failures on the old code and a passing root check.
The Lead's isolated check at `9aeeddc` passes lint, all typechecks and 912 tests in 68 files, with zero skips.
Log: `/tmp/cogniate-lead-foundation.bzkF2F.bm1-repair-check.log`.
The path hold is released; no stack ran for this repair.

Reviewer-B's additional B-M1-03 proves provider lookup occurs before local grant or lease refusal.
The retained author received it with the outstanding B-M2-01 in `task_11e90efd0070`, dispatch `ctx_bbcf90c431bb`.
Handoff `msg_3842ee823d6e` requires local ordered validation and lease acquisition before any outbound LTI call.
Authoritative Blackboard readiness, target history, remote guards and strict repeats must remain.
Endpoint tests must prove invalid-code and live-lease refusals make zero outbound calls.

The Architect completed C-1 to C-3 in `msg_95b35b2fd6b0`, committed as `ca14de6`.
The [response](../architecture/review-response-M1.md) clarifies existing rules without changing the design.
Canvas domain uses the URL host with a non-default port.
Pending add-deployment refuses before grant lookup; a redeemed initial grant has the exact audit reason `redeemed`.

QA alignment started in `ctx_3d09691e1edf`, handoff `msg_707e7e5c3724`.
It uses the committed portal and clarified contract at `689e424`.
Its test-only corrections run alongside the backend grant repair because their files and preparation checks are independent.
This scheduling refinement replaces waiting for the final backend revision solely to prepare selectors and oracles.
It does not allow product execution, reading uncommitted implementation, weakening assertions, or skipping cases.
The final product and test revisions, startup smoke, both round-2 reviews and all independent acceptance gates remain required.

The author completed the separate Blackboard instruction repair in `msg_1b3d231b3f20`, committed as `9f96f7b`.
Six focused tests, portal typecheck and lint pass; the new ordering test fails with the old steps.
QA received the committed supplement in `msg_320bcbe9119c`.
The live Learn workflow remains unverified.

The same checkpoint identifies a real data dependency for B-M1-03.
Current target construction reads provider data before local grant checks because the app has no local shared-platform id or Canvas issuer source.
The operator's grant issuance also reads providers despite the contract's no-LTI-call wording.
The Lead did not authorize the proposed exception that would allow provider reads before lease acquisition.
Reply `msg_3f5dd027395d` holds the engine repair for an explicit Architect decision.
Architect task `task_82c1af131e8a` must preserve local refusal, saved targets and authoritative remote checks, or submit a precise amendment for independent review.

Reviewer-B started the bounded repair recheck in `task_f13911a45527`, dispatch `ctx_e01f09f551e3`.
Handoff `msg_3a08c5b1220e` supplies `9aeeddc`; `msg_b9d86bd1e03e` narrows this dispatch to B-M1-01 and B-M1-02.
It will submit a checkpoint and settle to free the Architect slot.
Remaining round-2 work needs a fresh dispatch and exact later commits; this checkpoint cannot approve M1, M2 or M3 as a whole.

Reviewer-B completed that checkpoint in `msg_c5c310c6e0ff`, committed as `86adfbf`.
B-M1-01 and B-M1-02 are closed at `9aeeddc`.
Independent evidence includes 77 unit tests, 16 score-fence combinations, two refusal probes and six real/symlink backup-restore probes.
The same reviewer remains retained; overall CHANGES_REQUESTED still applies.
The Architect then started target-data resolution in `ctx_d4db78b27fef`, handoff `msg_31aa2ffc73ce`.
The author prepared six expected-failing endpoint tests in its held `redemption.test.ts`; these are not part of a passing commit.
No engine repair is authorized before the explicit design handoff.

QA completed alignment in `msg_02644efb0adc`; its twelve held paths are committed as `0008bde`.
The full harness checks pass: 21 M1 self-tests, two M2 self-tests, typechecks and unchanged case inventories.
The T7 selection remains 18 tests in six files.
This preparation used no stack or product calls.
The same QA-E2E instance is retained for final verification.
Reviewer-B started a separate bounded check of this supplement and the Learn instruction in `task_41cfdcc25616`, dispatch `ctx_17d6e7cf12b1`.
Handoff `msg_535e68ea63aa` supplies exact `0008bde` and requires meaningful oracle checks, not just successful discovery.
That review can close only the changes it actually checks; B-M1-03 and all product acceptance gates remain separate.

Reviewer-B completed the harness supplement in `msg_e830b4a0c281`, committed as `f89262c`.
It closes B-M2-01 and B-M3-01/02 for the reviewed source corrections.
MINOR B-M3-03 requires an observation of attempt creation; a later successful redemption proves only that no live lease remains.
QA follow-up `task_480510c15247` is queued for the retained Canvas QA instance.
The Lead approves a scoped audit comparison using the existing `grant_attempt_started` event and a positive control.
It must not add database access or weaken the no-attempt claim.
The event's stable semantics and rollback limits are also input to the design gate below.

The Architect completed proposal D in `msg_ade9630a3ca4`, committed as `a4bc3a4`.
It is **not accepted**. The [proposal](../architecture/review-response-M1.md) saves a trusted provider snapshot when the connection is created.
It adds migration `012`, a Blackboard readiness read after the local transaction, and a pinned Canvas issuer in S1.
The original B-M1-03 repair attempt settled **failed** in `msg_667a74777b06` because this design is not yet accepted.
Its separate B-M2-01 work is complete; the six expected-failing regressions remain held and uncommitted.
The same author remains retained for a fresh accepted-design implementation task.
This settlement does not close B-M1-03 or open any product gate.

The full independent design-review wave started on exact `a4bc3a4`:

| Work | Task | Dispatch |
| --- | --- | --- |
| Reviewer-A: correctness and security | `task_f01adc29325b` | `ctx_49f6050fff8e` |
| Reviewer-B: operability and test quality | `task_63f744cb3a1a` | `ctx_34758f845593` |
| Codex QA: design testability | `task_42cf75647102` | `ctx_8e6d60f0de88` |

Each writes its own target-snapshot report under `docs/reviews/M1/` before reading the other reports.
They inspect the applied issue-read clarification as well as the proposed schema and behavior changes.
Any BLOCKER or MAJOR keeps the design gate closed.
After approval, the Architect must apply the exact amendments before the author receives the implementation handoff.
Proposal D8 does not transfer Canvas module ownership by itself; the Lead must make that assignment explicit.

All three independent design reports request changes.
Reviewer-A's report is committed as `5a08512`; Reviewer-B and QA reports are committed as `c447dd3`.
The reports require local validation on all three redemption paths and consistent behavior for existing registered Canvas connections after migration.
They also require exact readiness and cancellation outcomes, post-commit audit semantics, prior-attempt cleanup, and a complete test inventory.
These are design findings. No product acceptance result follows from them.
The same Architect is correcting proposal D in `task_1d0ecd7020a8`, dispatch `ctx_fc5241ad834d`.
The Lead forwarded the final B and QA reports in `msg_0028acd06c91`.
The Architect owns only `review-response-M1.md` for this revision.
All three reviewing instances remain retained for independent rechecks of the frozen revision.
The engine repair and QA audit follow-up wait for the accepted contract.

The Architect completed revision 2 in `msg_5f5c25b3616a`, committed as `caa3541`.
It replaces D1–D8 with R0–R9 and preserves the original proposal as review history.
No accepted contract, data model, ADR, or task specification changed.
The independent recheck wave uses exact `caa35412887aa7c4b762a2c82be5fd12a984db9c`:

| Work | Task | Dispatch |
| --- | --- | --- |
| Reviewer-A | `task_c17cd1135dca` | `ctx_d1e7f2d9e3f0` |
| Reviewer-B | `task_06b884338b8a` | `ctx_1fd3ff3518ef` |
| Codex QA testability | `task_2184b58e02fa` | `ctx_db5eb5c61bc7` |

Handoffs are `msg_f49fa5cc459b`, `msg_d77e73ef389d`, and `msg_b014cce0238f`.
The Architect remains retained. Review completion alone will not open the implementation gate; the verdicts must approve the design.

QA's revision-2 report is committed as `9eb5da3`; Reviewer-B's report is committed as `6222358`.
They close the original readiness, registered Canvas lifecycle, prior-history cleanup, and bounded audit gaps.
Two MAJOR findings remain: a wrong registered-nonrepeat migration oracle, and incomplete recovery steps for old pending connections.
The intended fixes preserve grant-first validation and use the accepted suspend, fence, and release procedure.
Minor corrections cover target-construction wording, stable fresh-migration case IDs, and audit scope after restart.
The Architect started bounded revision 3 in `task_68130407ba89`, dispatch `ctx_ebe383641cd8`, handoff `msg_3672b92b92d2`.
It must incorporate Reviewer-A's final revision-2 report before settlement.
The same file ownership and implementation gate remain in force.

Reviewer-A completed revision 2 in `msg_f6406ec30b4a`, committed as `979aecc`.
Its verdict is APPROVE, with A-D-01 through A-D-05 closed.
A-D-06 requires neutral readiness guidance for both providers; A-D-07 overlaps the pending recovery correction.
A-D-08 lists six wording corrections.
The Lead forwarded the final report in `msg_d3456c44427d`.
Use the complete accepted recovery order and one neutral readiness message; no new public cause field is needed solely for that message.
The Architect now has all three final reports.
The final bounded recheck tasks are `task_1fe8ae6741d8`, `task_081f83c4db74`, and `task_03dd4c0d94cd`.
They wait for a frozen revision 3 and remain separate from product acceptance.

The Architect delivered revision 3 in `msg_c4f4e0386f02`.
Before committing it, the Lead found a fixture mismatch: the Blackboard seed fails before S1, so cleanup must observe an absent remote record.
Narrow task `task_8fbbd0427488`, dispatch `ctx_d6339580ea3c`, corrects that oracle and the conditional recovery text.
Handoff: `msg_0188520c6b03`. This is part of the uncommitted revision 3; the independent third review has not started.

The Architect completed that correction in `msg_390347962e0a`.
Revision 3 is frozen at **`78bc34ac422e0bcac324fa10e69ec9f82a17a3b8`**.
The Blackboard reservation-only fixture now expects absent records and a fresh deployment; the Canvas orphan fixture still requires fencing and deletion.
The final bounded design recheck wave is active on that exact commit:

| Work | Task | Dispatch |
| --- | --- | --- |
| Reviewer-A | `task_1fe8ae6741d8` | `ctx_752eba91c7de` |
| Reviewer-B | `task_081f83c4db74` | `ctx_d851263c7966` |
| Codex QA testability | `task_03dd4c0d94cd` | `ctx_f5b1c375220f` |

Handoffs: `msg_fa58502aaa35`, `msg_bf1c0892b181`, and `msg_a0afb45d9d38`.
The Architect is retained. Implementation still waits for approval and application of the accepted contract amendments.

All three final design rechecks passed on `78bc34a`; the reports are committed together as **`b6e8f739e6de752cb287929c9836734d2494e444`**.
Reviewer-A APPROVE: `msg_826bd7afdaea`. Reviewer-B APPROVE: `msg_3a6cd089d556`. QA design PASS: `msg_776a4a57d078`.
No design BLOCKER, MAJOR, or MINOR remains. Product B-M1-03 remains open.
The Lead accepts optional A-D-09 precision for the contract application: include the create-handler error override, use a null pre-create connection id in the log, prefer the replacement cause over inactivity, and retain cancellation-first outcome wording.
Architect application task `task_cf7e2e942594`, dispatch `ctx_50ca8c5ba951`, started with explicit approval in `msg_2a5205155c10`.
It owns the eight named architecture files only. Product ownership stays with the existing two teams.

The next implementation and preparation tasks wait for the frozen applied contracts:

| Work | Task | Owner |
| --- | --- | --- |
| Shared engine, snapshot migration, Blackboard and server errors | `task_de758fb0e31a` | Existing Claude Author |
| Canvas S1 issuer pin and shared portal error text | `task_65cded3fc783` | Existing Codex Author-2 |
| Common/Blackboard cases, inventory and populated upgrade route | `task_7f4a69ad0b33` | Existing Codex QA |

No Canvas file ownership is transferred. The Canvas worktree has only its existing untracked setup artifact; the Lead will advance it before launch.
In parallel, the narrow B-M3-03 task `task_480510c15247` now runs as `ctx_974f279ececc`.
Handoff `msg_68891aec5a82` supplies the accepted R3.7 audit semantics and permits preparation in its two existing owned paths.
It uses a same-process request-completion control and a positive attempt control; it makes no durable crash or database claim.
This does not authorize product acceptance runs or the broader Canvas snapshot test work.

The Architect completed the eight-file application in `msg_8acb2b069133`.
The Lead inspected the changes and committed them at **`ccdd9ef67cdd2be4c6af374136777fda4e081943`**.
This is the applied-contract baseline for implementation and test preparation.
The Architect remains retained; no product finding is closed by that application.
The Canvas worktree advanced to this commit with tracked files clean and its untracked setup artifact preserved.

The implementation and preparation wave is now active:

| Work | Task | Dispatch | Handoff |
| --- | --- | --- | --- |
| Shared backend and Blackboard | `task_de758fb0e31a` | `ctx_610c9d2ca767` | `msg_7ed661f0cc4a` |
| Canvas adapter and shared error text | `task_65cded3fc783` | `ctx_7ea6a7979f6e` | `msg_f33acba30b52` |
| Common/Blackboard acceptance preparation and populated upgrade route | `task_7f4a69ad0b33` | `ctx_365b9228372d` | `msg_61ddda53baef` |

All reuse the same dedicated instances. This fills the three worker slots.
Each owner must hold exact completed paths for a Lead commit. No stack runs in this wave.
The six previously failing backend regression tests remain with their author until the repair passes.

Canvas QA completed the narrow B-M3-03 repair in `msg_e2c3b7e40181`.
Its two held paths are committed at **`3b160f7bc22ca43f18bc16c94ecfc336b0fe80d6`**.
The helper checks cover each refused request's own completion line and a separate positive attempt control.
Typecheck, 21 harness self-tests, unchanged inventory, and six synthetic oracle checks pass.
These are harness checks only. B-M3-03 awaits independent recheck.
The same Canvas QA instance remains retained for `task_1276def76f95`, the broader Canvas snapshot and readiness test preparation.
That task depends on the applied contracts and the committed narrow repair, and waits for a free worker slot.
Codex QA owns the complete manifest and mixed-provider `011→012` host route; Canvas QA supplies its assigned cases and fixture interfaces.

The QA case split is confirmed in `msg_dfe8dcfa0ded`: provider variants of AC-M1-37 (v12) and AC-M1-38 (i4) have separate rows.
Common QA supplies shared audit helpers without imports from test modules.
Canvas QA preserves the existing public Canvas fixture helpers or coordinates a change through the Lead.
The backend interface handoff `msg_41dc8a263951` assigns the typed staged-create URL field to the backend Author.
Canvas Author-2 owns `url: target.issuer` in the adapter and the missing committed-platform guard before parsing in its deployment route.
This applies the accepted contract; it transfers no file ownership.

Final combined code and harness review tasks are queued:
Reviewer-A `task_74de10f72cf9` and Reviewer-B `task_08461c360614`.
Both depend on the two implementation tasks and both test-preparation tasks.
The Lead must supply one committed candidate with a passing root check before dispatch.
They append independent reports and recheck the full candidate; earlier bounded findings and design approvals do not replace this gate.

At 11:38:20 UTC the Claude backend transcript ended with a session-limit notice (reset 20:20 Asia/Saigon), without `worker_done`.
The Lead followed the transcript cursor to its end; this is positive evidence of a stopped agent turn, not a timeout inference.
Dispatch `ctx_610c9d2ca767` is abandoned to fence its authority; its session remains retained and no process or file was removed.
The same task `task_de758fb0e31a` is failed for quota recovery, with a retry assigned to a dedicated Codex GPT-6-Astra xhigh replacement under the owner's earlier replacement authorization.
The eight partial backend paths are preserved in `/var/folders/_h/pjt6zzrj46sctnb18tsmbzgw0000gn/T/cogniate-bm1-03-claude-partial-taeekbh7`, with a SHA-256 manifest.
They remain uncommitted and are not a passed checkpoint. The replacement must check and complete them.
The [team brief](multi-lms-team-brief.md#backend-quota-replacement-2026-10-20) records the narrow role exception and prevents overlapping editors.
The retry started through `worker-start --retry-of` as **`ctx_1cb6714a155b`**, with effective `gpt-6-astra` / `xhigh`.
Its dedicated handle is `structworker_ead1fb5e-7672-4a9f-9e28-fe7e2943ed8d`.
Handoff `msg_0881270e976b` supplies the applied-contract SHA, partial-file backup and priority interface checkpoint.
Canvas received the recovery notice in `msg_6e4870bb8d15`; the active worker count stays three.
The replacement supplied the held two-file interface in `msg_a3a8a37dfea8`.
It is committed at `d64832b5b2ebf82f267cb6f21208eee792a4ff30`: a typed optional create URL and a local profile view.
An isolated app TypeScript check passed with exactly those two files; this does not verify the unfinished engine.
The Canvas branch advanced to that commit with its six modified paths and setup artifact byte-identical.
Canvas received `msg_07b1edd4332f`; the backend hold was released in `msg_1697d5d06e38`.

Canvas completed its repair in `msg_208b3e00ecb8`; its seven held paths are committed and integrated at **`4cf1e91c5c56b49630e57f9b428c73777a38af3d`**.
The final author check passes 926 tests in 68 files and 46 focused tests, plus lint and typechecks.
This includes the API-created connection fixture needed by the snapshot guard.
The backend owner received the integration in `msg_50801fa7b224`; its full engine check and independent verification are still pending.
Author-2 remains retained.

Canvas QA preparation started in `ctx_fb3dd983143d`, handoff `msg_c709d138e690`, with the common QA helper and case interfaces.
The quoted common-owner paragraph was clarified immediately in `msg_56190c6754af`: this worker owns only Canvas cases.
Its transcript then ended with two Claude session-limit notices, before task edits or `worker_done`.
The Lead fenced that dispatch and marked the same task `task_1276def76f95` failed for a quota retry.
The [Canvas QA replacement rule](multi-lms-team-brief.md#canvas-qa-quota-replacement-2026-10-20) assigns a distinct Codex GPT-6-Astra xhigh QA instance under the owner's existing fallback authorization.
No author or common QA instance takes that independent role.

The verification tasks are also queued behind both implementation and test-preparation tasks.
Common/Blackboard acceptance and legacy regression: `task_ed3b08aa45ea`.
Canvas acceptance, both portal flows, Moodle browser regression and the live matrix: `task_e28388df4dcc`.
Each needs a frozen candidate and an assigned stack lane before dispatch.
QA owns the combined M3 report; QA-E2E owns its separate M3 browser report and live matrix.
The Lead added Q19 to Q22 and D-1 to D-12 to `docs/human_review/decisions-needed.md` in `7a9734a`.
These are open human decisions from the approved design, not implementation or live-test evidence.

The final-stage tasks are queued. They do not start until their evidence gates pass.

| Work | Task |
| --- | --- |
| Architect final conformance | `task_f94489087dd6` |
| Docs: guides and offline review page | `task_ba7497546050` |
| Independent guide, STE and offline-page checks | `task_d98e2da881be` |
| M4 Reviewer-A | `task_551efa49283b` |
| M4 Reviewer-B | `task_8c5153cd2cd7` |

The Architect follows accepted implementation reviews and M3 verification.
Docs follows accepted conformance and documents only verified behavior, with separate notes for untested real LMS steps.
The two reviewers and independent QA then check one frozen documentation candidate.
A settled task with a failing verdict does not open the next gate.

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
| M1 | Shared backend and provider registration support | Provider-team implementation dispatched |
| M2 | Blackboard and Canvas portal flows | Provider-team implementation dispatched |
| M3 | Independent QA and Moodle regression | Common/Blackboard test preparation started; Canvas preparation queued |
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
