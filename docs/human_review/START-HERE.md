# Start here

**What it is.** A prototype that publishes Cogniate courses to Moodle with the LTI 1.3 standard. It has our own LTI service. Its API has the same shape as the public LTIAAS API. It also has a stand-in for the Cogniate portal and a real Moodle 5.2.4 site, all on one Mac.

**Result.** It works. On a real Moodle 5.2.4 site, QA ran the full test three times in a row with no retries. All 15 end-to-end checks passed. The score reaches the Moodle gradebook in about 4 seconds. ([proven.md](proven.md))

## The story in five steps

1. **Connect.** A Cogniate user clicks Integrations → Moodle → Connect. A Moodle admin pastes one URL in Moodle, then clicks Connect, Activate and Edit.
2. **Publish.** The Cogniate user uploads a SCORM 1.2 or HTML course and publishes it to the Moodle site.
3. **Add.** A teacher adds the course in Moodle: Add content → Activity or resource → Cogniate → Add → Select content.
4. **Learn.** A learner opens the activity. The course opens in a new window, in the Cogniate player.
5. **Grades.** The score and the completion go to the Moodle gradebook. The portal shows the same result.

## What works, and what does not

| Works (proven by QA) | Not proven yet |
| --- | --- |
| The five steps above, on a real Moodle 5.2.4 site | MoodleCloud: needs a trial account (Q5) |
| SCORM 1.2 and HTML courses, pass (100) and fail (0) | Teachers on Safari (Q16). QA used Chromium only. |
| The best result counts. A score waits if Moodle is down. | Load, scale and 1EdTech certification |
| Launch security. No secrets in the logs. | A new person runs the stack in 10 minutes (HR-2) |
| One library cannot see another library's data. | Final QA of the native `.mbz` backup (pending) |
| The portal: Connect wizard, Publish, Results (14 of 14 checks) | |
| The real `ltiaas` SDK works against our LTI service | |

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
| 2 | Video: [`video/explainer-en.mp4`](video/explainer-en.mp4) (Vietnamese: [`video/explainer-vi.mp4`](video/explainer-vi.mp4), machine-translated, please check) | 3 min |
| 3 | [`explainer.html`](explainer.html): open it in a browser. Tabs Story and Flows. | 8 min |
| 4 | [`proven.md`](proven.md) (also the Proven tab) | 5 min |
| 5 | [`decisions-needed.md`](decisions-needed.md) (also the Decisions tab, with "Copy my answers") | 10 min |

To run the prototype yourself, see [`docs/guides/`](../guides/run-the-stack.md). For engineers: [`deferred.md`](deferred.md) (open minor findings) and [`flows.md`](flows.md) (one diagram per flow).

## How this was built

- **`rea` not used.** We evaluated [`rea`](https://github.com/morluto/rea) and did not use it to clone LTIAAS. LTIAAS is a hosted service, and its terms forbid reverse engineering. So we built a clean-room service from the 1EdTech specs and the public API shape. QA then ran the real `ltiaas` 0.0.4 SDK against our service, and every check passed (AC-T3-27). See [`rea-evaluation.md`](../architecture/rea-evaluation.md) and [ADR-001](../architecture/adr/ADR-001-rea-not-used.md).
- **A team of agents.** Lead, Architect, Author, QA, QA-E2E, Docs, Reviewer-A and Reviewer-B ran on Claude Opus 5.5 (xhigh). Codex GPT-6-Astra (xhigh) worked as Author-2 through Orca, for the portal and the LTIAAS-compatible endpoints. Each finished task passed QA and two independent reviews (T8: QA pending). See the [charter](../team/charter.md#as-run-from-2026-10-18-two-author-lanes-two-qa-instances) and the [board](../team/board.md).
- **Legal note.** The claim "LTIAAS-compatible" is for internal use until a human decides Q1.
