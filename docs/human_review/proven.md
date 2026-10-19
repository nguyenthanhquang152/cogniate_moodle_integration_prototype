# Proven / not proven

Source: commit `4182c80`, 2026-10-19.

Each row is one claim. **Proven by QA** means that an independent QA agent tested it from the acceptance criteria, and the test passed. The id points to a row in `docs/reviews/<task>/qa.md`. Time to read: 5 minutes.

**Headline:** the full story works on a real Moodle 5.2.4 site. QA ran the end-to-end test three times in a row, with no retries. All 15 end-to-end checks passed [AC-T7-01, AC-T7-11]. Source: [`docs/reviews/T7/qa.md`](../reviews/T7/qa.md).

## 1. Proven by QA

| Area | Claim | Proof |
| --- | --- | --- |
| End to end | One command runs the full story on an empty Moodle 5.2.4 site in about 3 minutes (188, 189 and 186 s). | AC-T7-01, AC-T7-11 |
| Connect | The admin follows the 6 portal steps in Moodle. Every Moodle label matches. Moodle shows the tool "Active", with "New window". | AC-T7-14, AC-T7-02 |
| Connect | The manual method (16 values out, 6 values back) also connects a site. | AC-T4-10, AC-T7-01 |
| Texts | The portal uses the exact Moodle 5.2.4 labels: the teacher path and the manual grade option (findings Q-T7-01, Q-T7-02 fixed). | T7 qa.md §6 (validation run `f0e5525`) |
| Publish | Publish, withdraw and publish again work. You cannot publish to a site that is not ready. | AC-T4-12, AC-T4-14 |
| Teacher | "Select content" lists exactly the published courses of the library. The activity gets a grade item of max 100. | AC-T7-03, AC-T4-15 |
| Learner | Each launch opens a new window with the player in less than 0.2 s. The URL has no token. | AC-T7-07 |
| SCORM 1.2 | The real Cogniate SCORM course gives 100 for a correct answer and 0 for a wrong answer, with completion in Moodle. | AC-T5-07, AC-T5-08, AC-T7-04, AC-T7-05 |
| HTML | The real Cogniate HTML course gives the same results. Our HTML runtime watches the pages, because the export does not record progress. | AC-T5-09, AC-T5-27, AC-T7-04 |
| Grades | The score reaches the Moodle gradebook in 3.4 to 3.9 seconds (limit 60 s). No Moodle cron is needed. | AC-T7-04, AC-T7-05 |
| Grades | The best result counts. A later worse result never lowers the grade. A teacher override in Moodle stays. | AC-T5-12, AC-T5-23, AC-T5-33 |
| Grades | If Moodle is down, the score waits and arrives after Moodle comes back. A grade conflict shows in the portal, with "Resend". | AC-T5-14, AC-T5-31, AC-T5-32 |
| Portal | The portal (dev-portal style) has Integrations, the Connect wizard with live status, the manual form, upload progress, Publish, and Results with "Resend". No request leaves the app site. No serious accessibility error. | AC-T6-01 to AC-T6-14 |
| Portal | The Results page shows "Passed 100" and "Sent". "Refresh from Moodle" shows the Moodle gradebook values. | AC-T7-06, AC-T6-08, AC-T5-18 |
| Security | Replayed, forged, expired, tampered or changed launches are refused. | AC-T2-09 to AC-T2-11, AC-T2-20 to AC-T2-27, AC-T7-10 |
| Security | No token or key is in the logs. Each end-to-end run found 0 of 28 captured secrets. The validation run found 0 of 48 values of 9 kinds. | AC-T7-10, T7 qa.md §6, AC-T2-30, AC-T5-19 |
| Privacy | Cogniate gets an anonymous learner id and role. It does not get names or emails. | AC-T2-04, AC-T4-08 |
| LTIAAS-style API | The real `ltiaas` 0.0.4 Python SDK works against our LTI service: id token, deep linking, scores (7/10 read back as 70/100) and memberships. The output has no secrets. An external claim needs decision Q1. | AC-T3-27, AC-T3-09, AC-T3-20 |
| Isolation | One library cannot see or use the courses, connections or results of another library. | AC-T7-08, AC-T7-09, AC-T4-34, AC-T4-16 |
| Isolation | Course packages run on a separate content site, in a sandbox. They cannot read the portal session. 16 kinds of bad zip are refused. | AC-T5-01, AC-T5-03, AC-T5-17, AC-T4-05 |
| Run it | A ready demo starts from zero in about 45 seconds (`e2e:reset` 36 s, `demo:prepare` 9.3 s). | AC-T7-15 |
| Run it | A reset gives an empty site with the same passwords. No secret is in git. | AC-T1-10, AC-T1-11 |

## 2. Pending final QA

Both reviewers approved these items. QA did not check them yet.

| Task | Claim | State |
| --- | --- | --- |
| T8 | Native channel: Moodle backup (`.mbz`) and an empty Moodle course on publish. | Builder evidence only. QA (AC-T8-02 to AC-T8-10) is pending. |

## 3. Not proven

| Claim | Why | Decision |
| --- | --- | --- |
| It works on MoodleCloud. | QA used a local Moodle 5.2.4 site. A test needs a MoodleCloud trial account. | Q5 |
| A teacher on Safari can add content. | QA used Chromium only. Safari can block the Cogniate cookie in Moodle's frame. | Q16, R4 |
| The player works in Firefox and Safari. | QA used Chromium only. | — |
| The player works in mobile browsers. | No mobile test. | — |
| The course video plays. | QA proved only that the server sends the video file correctly (AC-T5-02). The export has no visible video. | — |
| A real person who closes the real player window keeps the progress. | QA closed the window by script (AC-T5-22, AC-T5-35). That proves the saved progress, not a real close by hand. | — |
| A person (not a test robot) can do every step. | All runs used a browser robot. The HTML menu link was clicked by script. | Q17, HR-2 |
| A new person starts the stack in 10 minutes. | The human run test is not done yet. | HR-2 |
| Load and scale. | No test is planned for the prototype. | Q11 |
| 1EdTech LTI Advantage certification. | No test is planned for the prototype. | Q1 |
| A `.mbz` restore in the Moodle pages, or on another site. | The T8 test uses the Moodle command line only. | Q5, Q12 |

## QA notes

- `npm run demo:browser`, `stack:doctor`, `demo:users` and `stack:down` are not verified by QA. The [run guide](../guides/run-the-stack.md) marks them.
- In a regression run, the attempt status after the first SCORM page load was "in progress", not "not started" (Q-T5a-02). QA calls it a spec interaction, not a product error.
