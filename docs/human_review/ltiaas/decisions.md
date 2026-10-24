# LA open human decisions

2026-10-24. Source: [LA plan §6.2](../../team/ltiaas/plan.md#62-human-decisions) and the [LA board](../../team/ltiaas/board.md). The question and the recommendation of each row come from the plan. This page adds what waits on each answer. Back to [start-here.md](start-here.md) or [index.html](index.html).

## Decided since the gate

### LA-H25: how do we finish the channel kit (LA-E7-06)? Decided: (a)

- **Facts:** LA-E7-06 (the K1 channel certification kit, Must) used the 3 fix rounds of charter-LA §5. Each round-4 review still has 2 open BLOCKERs: some safety checks and some callers do not match the product contracts. The kit host checks pass, including the one-file onboarding of a sixth channel ([LA-E7-06 qa](../../reviews/LA-E7-06/qa.md) round 4).
- **Result:** the kit is done. The round 7 fix of LD-27 passed the live run r8 on `a8bbac53`: 195 of 195 expected cases PASS on all 5 channels, and the round 8 reviews APPROVE with 0 open findings ([LA-E7-06 qa](../../reviews/LA-E7-06/qa.md) round 8). AC-LA-E7-08-02 is PASS on `a8bbac53`, and again on the final SHA `4f10c5fd` in the re-gate runs D3 and D4 (195 of 195 each; [LA-E7-08 qa](../../reviews/LA-E7-08/qa.md) §14.5; reviews in progress). The `acme-lms` kit run of the walkthrough (LA-E8-02 AC-03) passed 39 of 39 ([LA-E8-02 qa](../../reviews/LA-E8-02/qa.md) round 2).
- **Options:**
  - (a) One extra fix round by a fresh Claude Opus 5.5 xhigh QA session (a model exception for this task). The reviewers' round-4 counterexample probes are its acceptance test. Then round-5 reviews.
  - (b) One extra fix round on Antigravity QA-4.
  - (c) Move the kit K1 run to LG. The kit stays a host-only K0 check. AC-LA-E7-08-02 closes with the frozen M1, M2 and K2 results and the E2-N proof (D2L Brightspace, F2 `core = 0`). The LA-E8-05 pack then says so.
- **Lead recommendation:** (a).
- **Decision** (product owner, 2026-10-24; [plan §6.2](../../team/ltiaas/plan.md#62-human-decisions)):
  1. About 09:25Z: option (a), one extra fix round by a fresh QA session, then round-5 reviews and the kit K1-SIM run.
  2. About 13:15Z: Reviewer-A's last BLOCKER got a narrow fix (both reviewers APPROVE). The first live K1-SIM run failed on kit wiring defects only. The product owner chose a live fix-and-rerun window for QA-K, then one review of the whole diff and a clean final run.
  3. Plan LD-27 (Lead): the live run r7 gave 195 of 195 ([LA-E7-06 qa](../../reviews/LA-E7-06/qa.md) round 7), but the round 7 reviews ask for changes in kit oracles that the window added. So: one kit fix round by QA-K (kit files only, no product change), round 8 reviews of that fix, then a clean final live run. If BLOCKER or MAJOR findings stay open after round 8, the Lead escalates with option (c).

### LA-H27: when do we merge the Blackboard and Canvas final result? Decided: (a)

- **Facts:** LA started on a frozen candidate of the Blackboard and Canvas milestone and planned to merge its final commits later (LA-H10 (a)). That merge was not done. The Blackboard and Canvas final result is main `78971b03`.
- **Options:** (a) merge now and repeat the full re-gate on the new final SHA; (b) close LA on the frozen base and merge at the LA-to-main step; (c) merge now with one re-gate run.
- **Lead recommendation:** (a).
- **Decision:** (a), by the product owner on 2026-10-24 ([plan §6.2](../../team/ltiaas/plan.md#62-human-decisions)). The new final product SHA is `4f10c5fd` (`a8bbac53` plus main `78971b03`).
- **Result:** the re-gate (LD-29) passed on `4f10c5fd`: all 11 gate checks, in the double full run D3 and D4 ([LA-E7-08 qa](../../reviews/LA-E7-08/qa.md) §14, [run-D4](../../reviews/LA-E7-08/run-D4.md)). The reviews of this evidence are in progress.

## Lead decisions since the gate

From [plan §6.1](../../team/ltiaas/plan.md):

| Id | Decision |
| --- | --- |
| LD-27 | The kit round 7 review findings are part of the LA-H25 live window: one kit fix round, round 8 reviews of that fix, then a clean final live run. Result: done, PASS on `a8bbac53` (above). |
| LD-28 | Two unbuilt cut candidates go to the LG backlog: LA-E4-06 (Should, the app-edge limit on the handoff pages) and LA-E7-12 (Could, other K2 browser checks). No task depends on them, and a build now would change the SHA of the first final runs. |
| LD-29 | The re-gate after the Blackboard and Canvas merge (LA-H27): every suite of the milestone-end double run and the kit K1 runs again on `4f10c5fd`, with the rules of LD-25. Task evidence on `a8bbac53` stays valid as task evidence; only the gate and final-SHA claims move. Result: D3 and D4 PASS on `4f10c5fd` (reviews in progress). The re-captured baseline-3 (main `78971b03`) closed the LA-E0-03 gap (A and B APPROVE); LA-E0-02 is QA PASS, with reviews in progress. |
| LD-30 | Kit finding F-LA-E7-06-WALK-02: with the walkthrough channel `acme-lms`, the kit gave a false FAIL on `brightspace` R3 (37 of 39). One narrow kit fix by QA-K, then round 9 reviews of that fix. Result: closed. The fix (kit tree `d7e50b5d`) passed round 9 (A and B APPROVE), and the 6-channel walk-clone run passed 234 of 234. |
| LD-31 | The Moodle-stack rule for the re-gate: "at most one Moodle stack at a time" (LD-25) means one active Moodle-lane workload at a time. A SIM-lane stack may run beside it. The browser suites M2 and K2 run with no other stack starting, seeding or tearing down. A failure under overlap is rerun alone and recorded as a flake finding, never as PASS. **Amendment:** the M1 runner's isolation check reads every resource that its own run does not own, so M1 sim also runs with no other LA stack up (after the D4 overlap finding `qalead-la-151`). In a solo run, isolation changes that come only from another team's `sto-*` resources are an environment note, listed by name; a changed LA resource is a finding and a rerun. |
| LD-32 | The kit source for the re-gate: the frozen test overlay restored a `run-api.mjs` without the K1 dispatcher, so the first D3 kit run `qalead-la-141` ran 0 tests (a gate-source assembly defect; it stays FAIL). Both kit runs (D3 `qalead-la-144`, D4 `qalead-la-161`) use one fresh clone of integration `99338e52`: 0 lines of product diff against `4f10c5fd`, kit tree `d7e50b5d`. The kit test content is the same in D3 and D4. |

## Architect decision since the gate

| Id | Decision |
| --- | --- |
| BD-A2-114 | The legacy T2/T3 groups reach registration peaks from one client address and one tool account that the reviewers flagged as above the defaults. A2 replayed the measured requests through the real bucket rule: no refusal and no soft log line. **The registration defaults stand; no product change** ([build-decisions-A2](../../architecture/ltiaas/build-decisions-A2.md)). |

## Decide first

### LA-H26: a live proof of the new-channel path

- **Question:** which real open-source LMS gives the first live (not SIM) proof of the new-channel path. The free test sites are Sakai and Open edX. E2 proved `lti-generic` and `brightspace` on the simulator only.
- **Lead recommendation:** Open edX first, Sakai as fallback; after LA (LG).
- **What waits:** the first LIVE row for a channel that LA added.

## Decide before the next build wave

### LA-H22: do we offer ungraded items?

- **Question:** offer ungraded items (D-11; LA-ADR-05 D5).
- **Lead recommendation:** yes for Canvas `link_selection` and `lti-generic`; no for Moodle.
- **What waits:** LA-E3-08, LA-E3-14 and LA-E4-08 (intended change LA-IC-07). They are not built.

### LA-H4: privacy of launch claims

- **Question:** which claims a channel may receive; retention periods; the scope of a learner erase.
- **Lead recommendation:** a pseudonymous default; a claim policy per tool account.
- **What waits:** LA-E3-10 (intended change LA-IC-08). It is not built. The E4 record rules also use this answer.

### LA-H24: the verified admin launch

- **Question:** approve the verified-admin-launch authority (E6, Could) after a security review (LA-ADR-08).
- **Lead recommendation:** only if E6 gets capacity.
- **What waits:** LA-E6-03 and LA-E6-07. They are not built. Both also need a security review of the spec.

### LA-H9: 1EdTech certification

- **Question:** 1EdTech membership, and the certified product shape: the service with a reference tool, or the Cogniate app.
- **Lead recommendation:** certify the service with a reference tool.
- **What waits:** LA-E7-11 (certification reference tool, Should).

## Other rows of plan §6.2

The Lead does not list these rows as open for the LA close. They are needed later.

| Id | Question | Lead recommendation | Needed by |
| --- | --- | --- | --- |
| LA-H2 | Legal: the LTIAAS compatibility claim | Keep the "API-shape compatible" wording until a legal review | the release claim |
| LA-H3 | Real test sites and budget (Canvas, Blackboard, D2L); owner of the Blackboard app | Free now: self-hosted Canvas and Moodle. Budget for the Blackboard VMDK (about USD 0.05/hour plus AWS; the image expires 2026-12-04). Ask D2L for partner access. | the live LMS rows |
| LA-H21 | Operator policy: who holds an operator key; key life; two-person rule for account close and forced key activation | Named staff only; 90-day keys; a second operator as a Could | E5 build |
| LA-H23 | Moodle manual connect authority: keep `self` (residual risk R-LA-1), or require a verified admin launch or a grant | Keep `self` for the pilot | E5/E6 |

LA-H3 and LA-H26 are the path to the first real LMS results for the channels that LA moved or added. Until then, every result for Canvas, Blackboard, D2L Brightspace and other LTI 1.3 LMSs is a SIM result.
