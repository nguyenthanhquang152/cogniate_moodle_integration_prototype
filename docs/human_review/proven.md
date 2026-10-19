# Proven / not proven

Source: commit `4182c80`, 2026-10-19.

Each row is one claim. **Proven by QA** means that an independent QA agent tested it from the acceptance criteria, and the test passed. The id points to a row in `docs/reviews/<task>/qa.md`. Time to read: 5 minutes.

**Headline:** the full story works on a real Moodle 5.2.4 site. QA ran the end-to-end test three times in a row, with no retries. All 15 end-to-end checks passed [AC-T7-01, AC-T7-11]. The earlier regression at `dd6dd11` also passed all 15 ACs. Source: [T7 QA §9](../reviews/T7/qa.md#9-final-regression-run-dd6dd11-final-code).

**Current gate:** [Full player and portal regression](../reviews/T5b/qa.md#replacement-qa-final-regression-2026-10-19--d54c607d) passed at `d54c607d`: 49 ACs and 65 tests. Fresh T7 and final T9 artifact checks remain pending.

## 1. Proven by QA

| Area | Claim | Proof |
| --- | --- | --- |
| End to end | One command runs the full story on an empty Moodle 5.2.4 site in about 3 minutes (188, 189 and 186 s). | AC-T7-01, AC-T7-11 |
| Connect | The admin follows the 6 portal steps in Moodle. Every Moodle label matches. Moodle shows the tool "Active", with "New window". | AC-T7-14, AC-T7-02 |
| Connect | The manual method (16 values out, 6 values back) also connects a site. | AC-T4-10, AC-T7-01 |
| Texts | The portal uses the exact Moodle 5.2.4 labels: the teacher path and the manual grade option (findings Q-T7-01, Q-T7-02 fixed). | AC-T7-01, [T7 qa.md §6](../reviews/T7/qa.md#6-suite-changes-after-the-reviews-round-1-addendum) (validation run `f0e5525`) |
| Publish | Publish, withdraw and publish again work. You cannot publish to a site that is not ready. | AC-T4-12, AC-T4-14 |
| Teacher | "Select content" lists exactly the published courses of the library. The activity gets a grade item of max 100. | AC-T7-03, AC-T4-15 |
| Learner | Each launch opens a new window with the player in less than 0.2 s. The URL has no token. | AC-T7-07 |
| SCORM 1.2 | The real Cogniate SCORM course gives 100 for a correct answer and 0 for a wrong answer, with completion in Moodle. | AC-T5-07, AC-T5-08, AC-T7-04, AC-T7-05 |
| HTML | The real Cogniate HTML course gives the same results. Our HTML runtime watches the pages, because the export does not record progress. | AC-T5-09, AC-T5-27, AC-T7-04 |
| Grades | The score reaches the Moodle gradebook in 3.4 to 3.9 seconds (limit 60 s). No Moodle cron is needed. | AC-T7-04, AC-T7-05 |
| Grades | In tested sequential retakes, a lower result did not lower Moodle’s grade. A teacher override stayed. Late delivery remains limited (P2). | AC-T5-12, AC-T5-23, AC-T5-33 |
| Grades | If Moodle is down, the score waits and arrives after Moodle comes back. A grade conflict shows in the portal, with "Resend". | AC-T5-14, AC-T5-31, AC-T5-32 |
| Portal | The portal (dev-portal style) has Integrations, the Connect wizard with live status, the manual form, upload progress, Publish, and Results with "Resend". No request leaves the app site. No serious accessibility error. | AC-T6-01 to AC-T6-14 |
| Portal | The Results page shows "Passed 100" and "Sent". "Refresh from Moodle" shows the Moodle gradebook values. | AC-T7-06, AC-T6-08, AC-T5-18 |
| Security | Replayed, forged, expired, tampered or changed launches are refused. | AC-T2-09 to AC-T2-11, AC-T2-20 to AC-T2-27, AC-T7-10 |
| Security | No token or key is in the logs. Each end-to-end run found 0 of 28 captured secrets. The validation run found 0 of 48 values of 9 kinds. | AC-T7-10, [T7 qa.md §6](../reviews/T7/qa.md#6-suite-changes-after-the-reviews-round-1-addendum), AC-T2-30, AC-T5-19 |
| Privacy | Cogniate gets an anonymous learner id and role. It does not get names or emails. | AC-T2-04, AC-T4-08 |
| LTIAAS-style API | For the endpoints listed in ADR-003, our API uses the paths, header schemes and field names of the public LTIAAS API reference. The differences are in contract §8. The real `ltiaas` 0.0.4 Python SDK passed: id token, deep linking, scores (7/10 read back as 70/100) and memberships. One limit: a line item id with a raw slash gets 404. The form that the SDK sends passes (D15). An external claim needs decision Q1. | AC-T3-27, AC-T3-09, AC-T3-20 |
| Isolation | One library cannot see or use the courses, connections or results of another library. | AC-T7-08, AC-T7-09, AC-T4-34, AC-T4-16 |
| Isolation | Course packages run on a separate content site, in a sandbox. They cannot read the portal session. 16 kinds of bad zip are refused. | AC-T5-01, AC-T5-03, AC-T5-17, AC-T4-05 |
| Run it | A ready demo starts from zero in about 45 seconds (`e2e:reset` 36 s, `demo:prepare` 9.3 s). | AC-T7-15 |
| Run it | A reset gives an empty site with the same passwords. No secret is in git. | AC-T1-10, AC-T1-11 |
| Run it | The Lead accepted QA’s fresh-clone run for AC-T9-01. Both login pages opened in 61 seconds. Unfamiliar-human usability remains unproven. | [AC-T9-01](../reviews/T9/qa.md), HR-2 |
| Native channel | QA built the backup, restored it through the CLI, and confirmed grade 100 in Moodle’s SCORM player. | [AC-T8-02 to AC-T8-07](../reviews/T8/qa.md), round 2, `8059c31` |
| Native channel | The token API and course shell passed. The Publish checkbox and course link passed. Two race checks passed. | [AC-T8-08 to AC-T8-10, C-T8-01, C-T8-02](../reviews/T8/qa.md), round 2 |
| Connect | The button is disabled with the 15-second wait text. Slow Moodle shows `MOODLE_TOOL_MAY_EXIST`. QA observed one confirm POST. | [P1, final T4b1 QA](../reviews/T4b1/qa.md#replacement-qa-final-regression--2026-10-19), `a5d9ddcb` |
| Grades | Full P2 regression passed. After a real app restart, Moodle kept 90 for 90 seconds. No obsolete retry occurred. | [P2, final T5b QA](../reviews/T5b/qa.md#replacement-qa-final-regression-2026-10-19--d54c607d), `d54c607d` |
| Grades | With an approved fixture, QA removed the higher failed sync. Resend of the lower score returned `409 SYNC_NOT_RESENDABLE`. | [P5, fixture-assisted](../reviews/T5b/qa.md#replacement-qa-final-regression-2026-10-19--d54c607d), `d54c607d` |
| Player and portal | All 49 ACs and 65 tests passed after the repair. The separate runtime-expiry test also passed. | [T5a](../reviews/T5a/qa.md#replacement-qa-final-regression-2026-10-19--d54c607d), [T5b](../reviews/T5b/qa.md#replacement-qa-final-regression-2026-10-19--d54c607d), [T6](../reviews/T6/qa.md#replacement-qa-final-regression-2026-10-19--d54c607d), `d54c607d` |
| Grades | P11 lower-retake texts passed for sent, pending and failed best scores. The current score stayed 75; the best stayed 90. | [P11, final T5b QA](../reviews/T5b/qa.md#replacement-qa-final-regression-2026-10-19--d54c607d) |

## 2. Pending final QA

T4b1, T4b2 and P1 passed at `a5d9ddcb`. Full T5a/T5b/T6 regression passed at `d54c607d`. Fresh T7 and final T9 checks remain pending.

| Task | Claim | State |
| --- | --- | --- |
| T7 | End-to-end regression after the P2 repair. | Fresh run pending. |
| T9 | Final pack and videos meet the hand-over criteria. | Final QA-E2E and independent reviews follow this Docs pass. |

## 3. Not proven

| Claim | Why | Decision |
| --- | --- | --- |
| Scoreless and lower-retake conflict P11 texts. | Live QA covers the sent, pending and failed lower-retake variants only. | [T5b QA](../reviews/T5b/qa.md) |
| Recovery of unrecorded sends from before the upgrade. | Migration 010 preserves old rows with empty markers. It cannot reconstruct earlier delivery uncertainty. | [P2 upgrade boundary](../reviews/T9/architect-conformance.md#10-round-3-p2-late-remote-write) |
| **Not guaranteed (P2 remote ordering):** Moodle always keeps the confirmed best score. | An older request can write after accepted confirmation. The 5-second gap cannot prove that all remote work finished. | [ADR-010](../architecture/adr/ADR-010-grade-and-completion-policy.md#p2-bounded-confirmation-after-uncertain-delivery-2026-10-19) |
| It works on MoodleCloud. | QA used a local Moodle 5.2.4 site. A test needs a MoodleCloud trial account. | Q5 |
| **Not supported:** Moodle in a subfolder (for example `https://school.edu/moodle`). | Dynamic registration is refused. Web service and course links (T8) would use the wrong path. Manual connect may work, but nobody tested it. MoodleCloud is not affected. About 1 day to add. | Q18 |
| A teacher on Firefox or Safari can add content. | QA used Chromium only. Safari can block the Cogniate cookie in Moodle's frame. | Q16, R4 |
| The player works in Firefox and Safari. | QA used Chromium only. | — |
| The player works in mobile browsers. | No mobile test. | — |
| Video playback. | The export has no visible video. QA proved only that the server sends the video file correctly (AC-T5-02). | — |
| A real person who closes the real player window keeps the progress. | QA closed the window by script (AC-T5-22, AC-T5-35). That proves the saved progress, not a real close by hand. | — |
| A person (not a test robot) can do every step. | All runs used a browser robot. The HTML menu link was clicked by script. | Q17, HR-2 |
| A person who did not build it starts the stack in 10 minutes. | The Lead accepted QA’s 61-second run for AC-T9-01. A new person’s experience remains unproven; this follow-up does not block that AC. | HR-2 |
| Load and scale. | No test is planned for the prototype. | Q11 |
| 1EdTech LTI Advantage certification. | No test is planned for the prototype. | Q1 |
| A `.mbz` restore in the Moodle pages, or on another site. | The T8 test uses the Moodle command line only. | Q5, Q12 |
| The portal web services token form. | T8 QA used the API for AC-T8-08. | Q12 |
| All Build Runner hardening paths. | The 10-minute timeout, interrupted-build sweep, planted-file rejection and backup copy checks lack black-box tests ([T8 QA §5](../reviews/T8/qa.md#5-not-covered)). | — |

## QA notes

- The final live restart check used recorded sends after the upgrade. It observed Moodle grade 90 for 90 seconds. It does not recover earlier, unrecorded remote work.
- P5 uses an approved fixture exception. QA removes one higher failed sync, then checks the public API. This is fixture-assisted, not pure black-box.
- The Author’s synthetic upgrade check preserved seven rows and passed its integrity checks. This is not independent QA or a production-upgrade guarantee. See the [conformance record](../reviews/T9/architect-conformance.md#10-round-3-p2-late-remote-write).

- A third-party SCORM package that writes more than 250 interactions loses its score (P9). The Cogniate package is not affected.
- The desktop window of `npm run demo:browser` is not verified by QA. QA used the same Chrome settings without a window. The [run guide](../guides/run-the-stack.md) marks it.
- In a regression run, the attempt status after the first SCORM page load was "in progress", not "not started" (Q-T5a-02). QA calls it a spec interaction, not a product error.

- T6 covers Chromium at 1440 pixels. Its five accessibility scans found no serious or critical issue. Expired, disconnected and server-error card states lack independent setup.
- The full 24-hour score retry window was not observed by live QA.
