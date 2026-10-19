# What a learner sees

This guide shows what a learner sees when they do a Cogniate course in Moodle. Use it to try the learner path yourself.

Tags: `[AC-…]` = QA tested it, and it passed (row in `docs/reviews/<task>/qa.md`). `[Not verified by QA]` = only the builder checked it.

Before you start: the stack runs, and `COGNIATE-DEV-101` has the two Cogniate activities. See [run the stack](run-the-stack.md), procedure 1.

NOTE: [Focused P2/P5 QA](../reviews/T5b/qa.md#replacement-qa-repair-focus-2026-10-19--d54c607d) passed after the grade repair. Full regression and fresh T7 remain pending.

NOTE: An older Moodle request can write after the best score’s accepted confirmation. Permanent grade agreement is [not guaranteed (P2 remote ordering)](../architecture/adr/ADR-010-grade-and-completion-policy.md#p2-bounded-confirmation-after-uncertain-delivery-2026-10-19).

## Procedure: Do a Cogniate course as a learner

1. Sign in to Moodle as `cg_student`.
2. Open the course `COGNIATE-DEV-101`.
3. Click the activity "AI Website Sprint — SCORM" [AC-T7-03].
4. Wait for the new window. The course opens in the Cogniate player [AC-T7-07].
5. Read the menu page.
6. Open the lesson page.
7. Stay on the lesson page for more than 10 seconds [AC-T5-07].
8. Scroll to the end of the lesson page [AC-T5-07].
9. Answer the question [AC-T5-07].
10. Read the status line at the top of the player [AC-T7-07].
11. Do steps 3 to 10 again for "AI Website Sprint — HTML" [AC-T5-09].

Result:

- The player opens in a new window. Moodle stays open in the first window [AC-T7-07, AC-T4-17].
- The player shows the course title and a "Back to Moodle" link [AC-T4-17].
- With a correct answer, the status line shows "Completed — score 100 sent to Moodle" [AC-T7-07].
- With a wrong answer, it shows "Completed — score 0 sent to Moodle" [AC-T7-07].
- After a retake with a lower score, the status line names both scores. Example: "Completed — score 60. Moodle keeps your best score: 80" [Pending QA (T5b, T7)].
- Moodle gets the grade in about 4 seconds. In the QA runs, it took 3.4 to 3.9 seconds [AC-T7-04].
- The Moodle completion "Receive a grade" is done, also with a grade of 0 [AC-T7-05, AC-T5-08].

NOTE: The course has one question. The first answer counts. A second answer does not change the result [AC-T5-28]. The pass mark is 70 [AC-T4-03].

NOTE: On the HTML menu page, a decorative layer covers the centre of the lesson link. If a click does nothing, click another part of the link. QA did not check this by hand (decision Q17).

## What happens when…

| When the learner… | Then… | Tag |
| --- | --- | --- |
| closes the window before the end | Moodle gets no grade. The next launch continues the same attempt. QA closed the window by script, not by hand. | AC-T5-35, AC-T5-06, AC-T5-11 |
| leaves the lesson page before 10 seconds | The course is not complete. Moodle gets no grade. | AC-T5-29 |
| opens a passed course again | Nothing changes. Moodle keeps 100. | AC-T5-20 |
| fails, then passes on a new try | In this QA scenario, Moodle showed 100. Delivery races remain limited (P2). | AC-T5-23, AC-T5-12 |
| completes the course while Moodle is down | The score waits. In the QA run, Moodle got it within 3 minutes after it came back. | AC-T5-14 |
| is in progress when a new course version comes | The learner stays on the old version. A new attempt uses the new version. | AC-T5-24 |

## What the teacher sees in the player

When `cg_teacher` opens the activity, the status line shows "Preview — no grade is sent". Moodle gets no grade for the teacher [AC-T5-13, AC-T4-19].

## If the course opens inside the Moodle page

If the admin did not set "New window", Moodle shows the Cogniate page inside the Moodle page. The page has the button "Open in a new window". Click it to open the player [AC-T4-31]. The admin can fix the setting: see the [Moodle admin guide](moodle-admin.md).

## Error pages

Every Cogniate error page shows an error code, a trace id and one next action [AC-T2-30, AC-T4-32].

| Page or code | Cause | What to do | Tag |
| --- | --- | --- | --- |
| "This course is no longer available" | Cogniate withdrew the course from this Moodle site. | Ask the teacher. | AC-T4-27 |
| "This course is not available" | The activity points to a course that this Moodle site cannot use. | Ask the teacher. | AC-T4-18 |
| `HANDOFF_USED` | The learner opened an old launch link again (Back button or a copied URL). | Open the activity again from the Moodle course page. | AC-T4-24 |
| `INVALID_STATE` | A launch form was sent again. | Open the activity again from the Moodle course page. | AC-T7-10 |
| `STATE_COOKIE_MISSING` | The browser blocked a Cogniate cookie inside a frame. | Ask the Moodle admin to set "New window". | AC-T2-10 |
