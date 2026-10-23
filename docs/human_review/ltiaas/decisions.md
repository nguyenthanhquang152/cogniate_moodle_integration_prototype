# LA open human decisions

Draft, 2026-10-24. Source: [LA plan §6.2](../../team/ltiaas/plan.md#62-human-decisions) and the [LA board](../../team/ltiaas/board.md). The question and the recommendation of each row come from the plan. This page adds what waits on each answer. Back to [start-here.md](start-here.md) or [index.html](index.html).

## Decide first

### LA-H25: how do we finish the channel kit (LA-E7-06)?

- **Facts:** LA-E7-06 (the K1 channel certification kit, Must) used the 3 fix rounds of charter-LA §5. Each round-4 review still has 2 open BLOCKERs: some safety checks and some callers do not match the product contracts.
- **What waits:** the kit simulator rows of the wave-end gate; LA-E8-01 finding B-03 (the add-a-channel guide); LA-E8-02 (the timed add-a-channel walkthrough).
- **Options:**
  - (a) One extra fix round by a fresh Claude Opus 5.5 xhigh QA session (a model exception for this task). The reviewers' round-4 counterexample probes are its acceptance test. Then round-5 reviews.
  - (b) One extra fix round on Antigravity QA-4.
  - (c) Move the kit K1 run to LG. The kit stays a host-only K0 check. AC-LA-E7-08-02 closes with the frozen M1, M2 and K2 results and the E2-N proof (D2L Brightspace, F2 `core = 0`). The final LA-E8-05 pack says so.
- **Lead recommendation:** (a).
- **Note:** the [LA-E7-08 QA file](../../reviews/LA-E7-08/qa.md) lists AC-LA-E7-08-02 as PASS (K1-SIM) for all 5 channels, from the K1 suites of each channel task. The LA-H25 text in the plan still lists AC-LA-E7-08-02 as waiting for the kit. The Lead resolves this difference in the final pack.

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

### E2 open-source channel

- **Status:** the Lead lists this as an open decision. Its question text is not yet in plan §6.2. The Lead adds it there.

## Can wait

| Id | Question | Lead recommendation | Needed by |
| --- | --- | --- | --- |
| LA-H2 | Legal: the LTIAAS compatibility claim | Keep the "API-shape compatible" wording until a legal review | the release claim |
| LA-H3 | Real test sites and budget (Canvas, Blackboard, D2L); owner of the Blackboard app | Free now: self-hosted Canvas and Moodle. Budget for the Blackboard VMDK (about USD 0.05/hour plus AWS; the image expires 2026-12-04). Ask D2L for partner access. | the live LMS rows |
| LA-H21 | Operator policy: who holds an operator key; key life; two-person rule for account close and forced key activation | Named staff only; 90-day keys; a second operator as a Could | E5 build |
| LA-H23 | Moodle manual connect authority: keep `self` (residual risk R-LA-1), or require a verified admin launch or a grant | Keep `self` for the pilot | E5/E6 |

LA-H3 is the path to the first real Canvas, Blackboard and D2L Brightspace results. Until then, every result for these LMSs is a SIM result.
