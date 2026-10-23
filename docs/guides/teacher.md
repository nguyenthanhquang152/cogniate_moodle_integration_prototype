# Teacher guide: add a Cogniate course to an LMS course

This guide has three parts: [Moodle](#moodle), [Canvas](#canvas) and [Blackboard Learn](#blackboard-learn). Each part adds one Cogniate course to one LMS course. The LMS then gets the score of each learner.

## Moodle

The Moodle part adds one Cogniate course to a Moodle course as an activity. Moodle then gets the score and the completion of each learner.

Before you start:

- The Moodle admin connected the site and activated the Cogniate tool ([admin guide](moodle-admin.md)).
- A Cogniate user published the course to this Moodle site.
- You are an editing teacher in the Moodle course.

Tags: `[AC-T7-…]` = the full end-to-end QA run on Moodle 5.2.4 used this step, and it passed. Other `[AC-…]` = QA tested it in an earlier task. `[Not verified by QA]` = only the builder checked it.

NOTE: QA tested teachers and learners with Chromium only. Other browsers are not proven (decision Q16). In Safari, "Select content" can fail. Our recommendation for the pilot: add content with Chrome, Edge or Firefox.

NOTE: [Full player and portal regression](../reviews/T5b/qa.md#replacement-qa-final-regression-2026-10-19--d54c607d) passed after the grade repair. [Fresh T7](../reviews/T7/qa.md#10-replacement-qa-e2e-repair-regression--2026-10-19) also passed.

NOTE: Those passes retain their historical identities. The later C8 T7 attempt remains FAILED. The final C10/C6 run passed all 15 criteria in three cycles of 17 tests. Only the permitted demo skip occurred. See [E-R8](../team/r8-t7-shared-host-verification-2026-10-23.md#final-t7-acceptance--1643-utc).

NOTE: An older Moodle request can write after the best score’s accepted confirmation. Permanent grade agreement is [not guaranteed (P2 remote ordering)](../architecture/adr/ADR-010-grade-and-completion-policy.md#p2-bounded-confirmation-after-uncertain-delivery-2026-10-19).

### Procedure: Add the course

The path in Moodle 5.2.4: Edit mode → "Add content" → "Activity or resource" → "Cogniate (<library>)" → "Add" → "Select content". The portal shows the same path next to each publication [AC-T7-01, [T7 qa.md §6](../reviews/T7/qa.md#6-suite-changes-after-the-reviews-round-1-addendum)].

1. Open the Moodle course.
2. Turn on the "Edit mode" switch at the top right [AC-T7-01].
3. If Moodle shows the tour "Activate edit mode", end the tour.
4. In a section, click "Add content" [AC-T7-01].
5. Click "Activity or resource" [AC-T7-01].
6. Select "Cogniate (<library>)" [AC-T7-01].
7. Click "Add". Sometimes the form opens at once. Then go to the next step [AC-T7-01].
8. In the activity form, click "Select content" [AC-T3-06, AC-T7-03].
9. In the Cogniate picker, select one course [AC-T4-15, AC-T7-03].
10. Click "Add to Moodle" [AC-T7-01].
11. Under "Completion conditions", click "Add requirements" [AC-T7-05].
12. Select "Receive a grade" [AC-T7-05].
13. Click "Save and return to course" [AC-T7-01].

Result:

- The course page shows a new activity with the course title [AC-T7-03].
- The gradebook has a grade item for the activity, with a maximum of 100 [AC-T7-03, AC-T3-07].
- In the portal, the publication shows "Selected in Moodle" [AC-T7-03].

NOTE: The picker lists only the courses that your library published to this Moodle site. Each course shows a badge "SCORM 1.2" or "HTML". You can select only one course [AC-T4-15, AC-T4-16, AC-T7-08].

### After learners complete the course

- The Moodle grader report shows 100.00 for a pass and 0.00 for a fail. It shows "-" if the learner did not finish. The grade arrives in about 4 seconds [AC-T7-04].
- Completion "Receive a grade" is done, also for a grade of 0 [AC-T7-05].
- In QA’s sequential retake, Moodle kept the higher grade [AC-T5-12]. Delivery races remain limited (P2; decision Q4).
- If you change a grade in Moodle (override), Moodle keeps your grade. The portal shows the difference [AC-T5-33].
- The Cogniate portal page "Results" shows course results and send status. "Refresh from Moodle" shows the Moodle gradebook values [AC-T7-06, AC-T5-18].

### Other tasks

| Task | How | Tag |
| --- | --- | --- |
| Look at the course as a teacher | Open the activity. The player shows "Preview — no grade is sent". | AC-T5-13, AC-T4-19 |
| Use a different Cogniate course in an activity | Edit the activity. Click "Select content". Select the other course. | AC-T4-25 |
| See what learners see | See the [learner guide](learner-view.md). | — |

If a Cogniate user withdraws the course, the activity shows "This course is no longer available" [AC-T4-27].

### Not verified by QA

- Safari (see the NOTE above).
- The menu clicks to open the grader report. QA opened the report by its URL.

## Canvas

Evidence basis: `31f4d0bb`, 2026-10-23. Product: C6 `4008afb9`. M1 tests: C9 `9eb504f5`. M2 actual tests: C8 `5561e8f7`. T7 actual tests: C10 `97b68af4`.

Runtime evidence is accepted. Architect conformance is APPROVE. This guide candidate awaits independent QA and two blind reviews. See the [evidence table](../../README.md#evidence-labels). Tags: the [evidence table](../../README.md#evidence-labels) gives the status of each label.

NOTE: Nobody has tested these steps on a real Canvas site. Canvas menu names come from provider documentation ([research](../research/multi-lms.md#4-canvas-facts)).

Before you start:

- The Canvas admin connected the site ([Canvas admin guide](canvas-admin.md)).
- A Cogniate user published the course with "Publish to an LMS" to this Canvas connection [SIM AC-M2-10].

### Procedure: Add the course as a graded assignment

1. In the Canvas course, open Assignments and add an assignment `[DOC F-CV-9; L-C04 UNVERIFIED]`. Not yet tested on a real Canvas site.
2. Set the submission type to "External Tool" `[DOC F-CV-9; L-C04 UNVERIFIED]`. Not yet tested on a real Canvas site.
3. Click "Find", then select "Cogniate" `[DOC F-CV-9; L-C04 UNVERIFIED]`. Not yet tested on a real Canvas site.
4. In the Cogniate picker, select one course `[SIM AC-M1-08; L-C04 UNVERIFIED]`. Not yet tested on a real Canvas site.
5. Make sure that "Load This Tool In A New Tab" is selected `[DOC F-CV-11; L-C04 UNVERIFIED]`. Not yet tested on a real Canvas site.
6. Keep "Allowed Attempts" unlimited `[SIM AC-M1-33; DOC F-CV-23; L-C15 UNVERIFIED]`. Not yet tested on a real Canvas site.
7. Click "Save & Publish" `[DOC F-CV-9; L-C04 UNVERIFIED]`. Not yet tested on a real Canvas site.

Result: the assignment has 100 points and the course title [SIM AC-M1-08; L-C04 UNVERIFIED]. Learners see it only when the course and the assignment are published [DOC F-CV-9]. Not yet tested on a real Canvas site.

NOTE: Only graded assignments are supported. Canvas module items are not offered (D-11) [SIM AC-M1-19].

NOTE: Cogniate can send a better score later. With a limit of one attempt, Canvas refuses that score, and the grade row ends as `failed` [SIM AC-M1-33]. So keep the attempts unlimited.

### What learners and teachers see

| Who | What happens | Evidence |
| --- | --- | --- |
| Learner, new tab on | The course opens in a new tab and goes to the player without a click. | `[SIM AC-M1-09; L-C07 UNVERIFIED]` Not yet tested on a real Canvas site. |
| Learner, new tab off | The page in Canvas shows "Open in a new window". | `[L-C06 UNVERIFIED]` Not yet tested on a real Canvas site. |
| Learner completes the course | The score goes to the Canvas gradebook. The portal shows sync `sent`. | `[SIM AC-M1-09, AC-M2-12; L-C08 UNVERIFIED]` Not yet tested on a real Canvas site. |
| Teacher opens the assignment | Preview. No grade is sent. | `[SIM AC-M1-16; L-C09 UNVERIFIED]` Not yet tested on a real Canvas site. |
| Teacher in Student View | Graded like a learner. Canvas keeps test-student grades. | `[SIM AC-M1-16; DOC F-CV-20; L-C09 UNVERIFIED]` Not yet tested on a real Canvas site. |
| Teacher adds content in Safari, or with blocked cross-site cookies | Depends on the browser, its version and its settings. | `[L-C10 UNVERIFIED]` Not yet tested on a real Canvas site. |

Learners are anonymous: Cogniate gets no names or emails [SIM AC-M1-14]. The portal shows each learner as `Learner <id> @ <Canvas host>` [SIM AC-M2-10]. A grade goes back only after the learner opens the assignment from Canvas [SIM AC-M1-09].

## Blackboard Learn

Evidence basis: `31f4d0bb`, 2026-10-23. Product: C6 `4008afb9`. M1 tests: C9 `9eb504f5`. M2 actual tests: C8 `5561e8f7`. T7 actual tests: C10 `97b68af4`.

Runtime evidence is accepted. Architect conformance is APPROVE. This guide candidate awaits independent QA and two blind reviews. See the [evidence table](../../README.md#evidence-labels). Tags: the [evidence table](../../README.md#evidence-labels) gives the status of each label.

NOTE: Nobody has tested these steps on a real Blackboard site. Learn menu names come from provider documentation ([research](../research/multi-lms.md#3-blackboard-facts)).

Before you start:

- The Learn admin connected the site ([Blackboard admin guide](blackboard-admin.md)).
- A Cogniate user published the course with "Publish to an LMS" to this Blackboard connection [SIM AC-M2-10].

### Procedure: Add the course in Ultra

1. In the course, open Course Content and click "+" `[DOC F-BB-11; L-B05 UNVERIFIED]`. Not yet tested on a real Blackboard site.
2. Open Content Market, then select "Cogniate" `[DOC F-BB-11; L-B05 UNVERIFIED]`. Not yet tested on a real Blackboard site.
3. In the Cogniate picker, select one course `[SIM AC-M1-10; L-B05 UNVERIFIED]`. Not yet tested on a real Blackboard site.

Result: Learn makes the item and a grade column `[L-B05 UNVERIFIED]`. Not yet tested on a real Blackboard site.

### Procedure: Add the course in Original

1. Open a content area of the course `[DOC F-BB-11; L-B06 UNVERIFIED]`. Not yet tested on a real Blackboard site.
2. Open Build Content, then select "Cogniate" `[DOC F-BB-11; L-B06 UNVERIFIED]`. Not yet tested on a real Blackboard site.
3. In the Cogniate picker, select one course `[SIM AC-M1-10; L-B06 UNVERIFIED]`. Not yet tested on a real Blackboard site.

### What learners see

| What happens | Evidence |
| --- | --- |
| The picker lists only the courses of your library. | `[SIM AC-M1-10]` |
| A new window or a frame: this depends on the Learn settings (D-10). | `[L-B08 UNVERIFIED]` Not yet tested on a real Blackboard site. |
| After completion, the score goes to the Grade Center. The portal shows sync `sent`. | `[SIM AC-M1-11, AC-M2-12; L-B09 UNVERIFIED]` Not yet tested on a real Blackboard site. |
| Teacher adds content in Safari, or with blocked cross-site cookies: depends on the browser, its version and its settings. | `[L-B10 UNVERIFIED]` Not yet tested on a real Blackboard site. |

Learners are anonymous: Cogniate gets no names or emails [SIM AC-M1-14]. A grade goes back only after the learner opens the item from Learn [SIM AC-M1-11].

If the item shows "This course is not available", the Cogniate connection was replaced. Add the course again under the new connection [SIM AC-M1-38].
