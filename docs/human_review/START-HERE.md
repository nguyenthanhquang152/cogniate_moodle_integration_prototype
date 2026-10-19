# Start here

Source: commit `4182c80`, 2026-10-19.

**What it is.** A prototype that publishes Cogniate courses to Moodle with the LTI 1.3 standard. It has our own LTI service. For the endpoints listed in ADR-003, its API follows the public LTIAAS API reference, with listed differences. It also has a stand-in for the Cogniate portal and a real Moodle 5.2.4 site, all on one Mac.

**Result.** All 15 end-to-end checks passed on real Moodle 5.2.4, including the regression at `dd6dd11`. The earlier three consecutive runs also passed. Grades reached Moodle in 3.8–3.9 seconds in the final run. ([proven.md](proven.md))

**Current gate:** [Full player and portal regression](../reviews/T5b/qa.md#replacement-qa-final-regression-2026-10-19--d54c607d) passed at `d54c607d`: 49 ACs and 65 tests. Fresh T7 and final T9 artifact checks remain pending.

## The story in five steps

1. **Connect.** A Cogniate user clicks Integrations → Moodle → Connect. A Moodle admin pastes one URL in Moodle, then clicks Connect, Activate and Edit.
2. **Publish.** The Cogniate user uploads a SCORM 1.2 or HTML course and publishes it to the Moodle site.
3. **Add.** A teacher adds it in Moodle: Add content → Activity or resource → Cogniate → Add → Select content.
4. **Learn.** A learner opens the activity. The course opens in a new window, in the Cogniate player.
5. **Grades.** The score and the completion go to the Moodle gradebook. The portal shows course results and send status.

## What works, and what does not

| Works (proven by QA) | Not proven yet |
| --- | --- |
| Earlier main-flow checks passed on real Moodle 5.2.4 | MoodleCloud: needs a trial account (Q5) |
| SCORM 1.2 and HTML courses, pass (100) and fail (0) | Teachers on Firefox or Safari (Q16). QA used Chromium only. |
| | Not supported: Moodle in a subfolder, for example `https://school.edu/moodle` (Q18). MoodleCloud is not affected. |
| Sequential retakes, P2/P5 and three P11 states passed in full regression. | Load, scale and 1EdTech certification |
| | Not guaranteed: a very late older score can overwrite Moodle’s grade after confirmation ([P2 remote ordering](../architecture/adr/ADR-010-grade-and-completion-policy.md#p2-bounded-confirmation-after-uncertain-delivery-2026-10-19)). |
| Launch security. No secrets in the logs. | Unfamiliar-human usability remains unproven (HR-2). The Lead accepted QA’s 61-second fresh-clone run for AC-T9-01. |
| One library cannot see another library's data. | Moodle-page restore, portal token form, and some runner hardening remain untested ([T8 QA §5](../reviews/T8/qa.md#5-not-covered)). |
| Native backup, CLI restore, native SCORM grade, course shell and two race checks ([T8 QA](../reviews/T8/qa.md)) | |
| The portal: Connect wizard, Publish, Results (14 of 14 checks) | Recovery of unrecorded sends from before the upgrade (P2). |
| The real `ltiaas` SDK passed our test for the listed endpoints (claim: Q1) | Other browsers (QA used Chromium only), mobile, video playback, and a real person who closes the player window |

## What we need from you

Answer the questions in [decisions-needed.md](decisions-needed.md). The four most important:

1. **Q1 Legal:** approve our clean-room method and the product claim.
2. **Q5 MoodleCloud:** make a trial account, so that we can test there.
3. **Q3 Privacy:** confirm the default: no learner names or emails go to Cogniate.
4. **Q16 Safari:** tell pilot teachers to use Chrome, Edge or Firefox to add content.

## Your 30-minute path

| # | Open | Time |
| --- | --- | --- |
| 1 | This page | 3 min |
| 2 | Video: [`video/explainer-en.mp4`](video/explainer-en.mp4) (Vietnamese: [`video/explainer-vi.mp4`](video/explainer-vi.mp4), machine-translated, please check) | 4 min |
| 3 | [`explainer.html`](explainer.html): open it in a browser. Tabs Story and Flows. | 8 min |
| 4 | [`proven.md`](proven.md) (also the Proven tab) | 5 min |
| 5 | [`decisions-needed.md`](decisions-needed.md) (also the Decisions tab, with "Copy my answers") | 10 min |

To run the prototype yourself, see [`docs/guides/`](../guides/run-the-stack.md). For engineers: [`deferred.md`](deferred.md) (open minor findings) and [`flows.md`](flows.md) (one diagram per flow). [`PLAN.md`](PLAN.md): how Docs made this pack. You can skip it.

## How this was built

- **`rea` not used.** We evaluated [`rea`](https://github.com/morluto/rea) and did not use it to clone LTIAAS. LTIAAS is a hosted service, and its terms forbid reverse engineering. So we built a clean-room service from the 1EdTech specs and the public API shape. QA then ran the real `ltiaas` 0.0.4 SDK against the listed endpoints of our service, and every check passed (AC-T3-27). See [`rea-evaluation.md`](../architecture/rea-evaluation.md) and [ADR-001](../architecture/adr/ADR-001-rea-not-used.md).
- **Original team.** Lead, Architect, Author, QA, QA-E2E, Docs and both reviewers used Claude Opus 5.5 at xhigh effort. Codex GPT-6-Astra worked as Author-2 through Orca, also at xhigh effort. Author-2 built the portal and the listed LTIAAS-style endpoints. The spikes remain reference work, without independent QA or review.
- **Continuation team.** On 2026-10-19, the owner authorized Codex GPT-6-Astra replacements after Claude reached its session limit. Dedicated roles keep separate ownership and independent QA and reviews. These continuation reviews are not cross-model reviews. T8 round 2 passed QA. T9 still needs final QA and blind reviews. See the [charter](../team/charter.md#continuation-authority-2026-10-19) and [board](../team/board.md).
- **Final check.** The Architect checked the whole system against the design ([conformance report](../reviews/T9/architect-conformance.md)). The earlier conformance check approved the fixes. Full player and portal regression passed the repair. Fresh T7 remains pending. Q18 remains an accepted limit.
- **Legal note.** The claim "LTIAAS-compatible" is for internal use until a human decides Q1.
