# Multi-LMS prototype handover

Owner: Lead. Closed: 2026-10-23, 17:39 UTC.

The approved Blackboard and Canvas prototype phase is complete on `nguyenthanhquang152/lti-multi-lms`.
The final substantive guide revision is `911219b04ba0c8195e935955094155deac0e9fbb`.
Final independent reports are committed at `524d1c64`; the exact reviewed closure patch is `206ad2b99501b771e076f8a7b9cc6ddffeaf0f01`.
This phase has no push or main-merge authorization. These are local commits.

## Start with the prototype

Open [Start here](../human_review/START-HERE.md), then the [offline Canvas and Blackboard explainer](../human_review/canvas-blackboard.html).
The explainer shows tenancy, the approval flow, provider profiles, evidence and human decisions.
Use [Run the stack](../guides/run-the-stack.md) for the local environment.
The required course packages come from the product team and are not in git.

| Role | Guide |
| --- | --- |
| Moodle administrator | [Moodle setup](../guides/moodle-admin.md) |
| Canvas administrator | [Canvas setup](../guides/canvas-admin.md) |
| Blackboard administrator | [Blackboard setup](../guides/blackboard-admin.md) |
| Service operator | [Approval codes, connections and recovery](../guides/operator.md) |
| Teacher | [Add and use a course](../guides/teacher.md) |
| Learner | [Learner view](../guides/learner-view.md) |
| Support | [Troubleshooting](../guides/troubleshooting.md) |

Moodle, Canvas and Blackboard share the LTI engine. Provider profiles hold their setup differences.
The prototype covers LTI 1.3 launch, Deep Linking, grade return, connection approval and course use.
Read the evidence label beside each guide step before treating it as verified.

## Accepted results

| Task | Outcome | Accepted evidence |
| --- | --- | --- |
| M0: design | Complete for prototype scope | Existing design reviews; final [Architect conformance](../reviews/M4/architect-conformance.md#r76-verdict) APPROVE, with no open BLOCKER or MAJOR. |
| M1: engine and provider behavior | Complete | [E-R7](r7-m1-verification-2026-10-23.md): two equal fresh rounds of 394 cases each, C9 tests with C6 product. Another 94 C4 rows are carried separately, including 72 storage rows. This is not 488 fresh cases. |
| M2: portal and provider flows | Complete | [E-R6](r6-independent-verification-2026-10-23.md): accepted r7 at actual C8 tests/C6 product; 64 cases, 13 criteria and seven gates PASS. |
| M3: regression and evidence | Complete for approved scope | Twelve accepted legacy groups: 304 raw PASS entries, with a per-subrun unique-ID sum of 251. [C10 T7](r8-t7-shared-host-verification-2026-10-23.md#final-t7-acceptance--1643-utc): all 15 criteria PASS; three cycles of 17 PASS, zero FAIL and one permitted demo skip each. |
| M4: guides and review pack | Complete | [Independent Gemini QA, section 4](../reviews/M4/docs.md#4-final-m4-prototype-guide-and-review-pack-qa--frozen-candidate-911219b0-2026-10-23): all eight criteria PASS. [Claude Reviewer-A](../reviews/M4/reviewer-a-final.md) and [Claude Reviewer-B](../reviews/M4/reviewer-b-final.md): APPROVE, no open BLOCKER or MAJOR. |

C10 T7 used test revision `97b68af4` with product revision `4008afb9`.
Demo preparation took 11.45 seconds. Both launches and all four confirmation/refusal checks passed.
All 51 default tests had zero viewport click retries. All 12 required PNGs passed judgment.
The strict scan covered 162 values with zero shared hits. All 32 complete protected volume records matched.
The earlier C8 test and redaction failures remain failed history.

Final guide QA checked links, evidence labels, source references, English limits and the decision register.
The explainer passed offline, desktop, mobile, controls and no-JavaScript checks.
Axe reported zero violations, with one incomplete color-contrast category on each viewport.
This does not establish full accessibility compliance. Initial skip-link focus was not tested in that run.

## Final closure record

The first final QA report contained inaccurate descriptions of saved evidence.
The same independent QA session corrected section 4 before acceptance; earlier report sections remain unchanged.
Accepted completion: `msg_f7c3738fda97`, task `task_ff5344676c4b`, dispatch `ctx_df96b9b211e0`.
The accepted report has 88,296 bytes and SHA-256 `63c42cdeecf81c2a8e28d355aeef843a304f856cba12db16b5fd182d55884b87`.

The Lead verified the original eight-entry QA artifact manifest and the new eleven-entry manifest.
Both final blind reviews approved substantive revision `911219b0`.
[Reviewer-A's closure addendum](../reviews/M4/closure-reviewer-a.md) and QA section 4.6 assessed the exact final patch.
The retained Codex executor applied 21 text substitutions and one two-row MINOR register block.
The Lead compared all nine changed guide files byte for byte with the approved expected results.
Infrastructure instructions, decisions, product code and tests stayed unchanged.
The new Reviewer-B link resolves to its committed report. The unrelated `pnpm-workspace.yaml` remains untracked and untouched.

The two final MINOR findings, B-M4F-01 and B-M4F-02, are in the [deferral register](../human_review/deferred.md#final-guide-review-follow-ups).
They concern direct evidence links and undefined internal labels. Both are safe to defer.
A-M4F-02 and B-M4F-04 are closed by the exact label/status changes.
A-M4F-01/03/04 and B-M4F-03/05/06/07/08 remain nonblocking NITs.
A-SI-05/B-SI-09 stays pending: old-build wrapper branches lack captured output, and the related wording NIT remains.
This pending follow-up does not reopen the accepted M4 prototype criteria.

## Limits and next phase

All 32 live-LMS rows remain **UNVERIFIED**: 13 hosted Canvas, one local Canvas and 18 Blackboard rows.
Local Canvas remains **DEFERRED**. Canvas and Blackboard results use signed simulations.
Moodle regression uses the local real Moodle container.
This phase does not establish hosted Canvas or Blackboard interoperability, certification, production readiness or enterprise readiness.

The shared-host checks prove captured attribution, not host exclusivity.
Snapshots cannot detect resources created and removed between captures.
The LA watcher restarted and replayed events; no observed gap exceeded two minutes.
M2's missed prelaunch hold and later bridge reconciliation remain disclosed in E-R6.
Legacy functional results retain their exclusive-host deviation.

Storage acceptance applies only to the measured host and tool versions in [G-1](../human_review/decisions-needed.md).
No Docker volume generation ID is available.
The negative host test proves fault detection, not bind-mount locking.
`content_check_failed` has unit evidence; lost-lock exit has host fault-injection evidence.
For `operation_lock_invalid`, stop and escalate. Manual recovery is not validated.

The [decision register](../human_review/decisions-needed.md) keeps Q19–Q22 and D-1–D-12 open for their human owners.
The [live matrix](../reviews/M3/live.md) records the required tenants, public HTTPS and authorizations.
The [deferral register](../human_review/deferred.md) preserves the self-hosted Canvas release race, tracker, focus and other limits.
Prompt redemption narrows that race but does not prevent it. Enterprise use needs an identifier reservation or quarantine design.
These are future scope and documented limitations; no required prototype implementation or verification gate remains open.

## Roles and ownership

Claude Opus 5.5 owns planning, architecture, technical design and review, with xhigh requested.
Codex GPT-6-Astra owns implementation and Docs, with xhigh requested.
Antigravity Gemini 4 Argon (High) owns independent QA.
Reports retain the model and effort visibility limits; requested settings are not stronger evidence of effective settings.
The Lead owns this handover, the board, final acceptance and path-scoped commits.
Existing sessions are retained under the owner's same-session continuation instruction.

All 293 recorded worker attempts are settled. No worker terminal needs a cleanup decision.
Eleven obsolete scheduling rows were cancelled as superseded, with their replacement evidence recorded in Orca.
Orca uses failed status for cancellation; those rows are not claimed as completed executions.
Historical failures remain in the run. No pending, ready, dispatched or blocked task remains.
