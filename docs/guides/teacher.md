# Teacher guide: add a Cogniate course to a Moodle course

This guide adds one Cogniate course to a Moodle course as an activity. Moodle then gets the score and the completion of each learner.

Before you start:

- The Moodle admin connected the site and activated the Cogniate tool ([admin guide](moodle-admin.md)).
- A Cogniate user published the course to this Moodle site.
- You are an editing teacher in the Moodle course.

Tags: `[AC-T7-…]` = the full end-to-end QA run on Moodle 5.2.4 used this step, and it passed. Other `[AC-…]` = QA tested it in an earlier task. `[Not verified by QA]` = only the builder checked it.

NOTE: QA tested teachers and learners with Chromium only. Other browsers are not proven (decision Q16). In Safari, "Select content" can fail. Our recommendation for the pilot: add content with Chrome, Edge or Firefox.

## Procedure: Add the course

The path in Moodle 5.2.4: Edit mode → "Add content" → "Activity or resource" → "Cogniate (<library>)" → "Add" → "Select content". The portal shows the same path next to each publication [T7 qa.md §6].

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

## After learners complete the course

- The Moodle grader report shows 100.00 for a pass and 0.00 for a fail. It shows "-" if the learner did not finish. The grade arrives in about 4 seconds [AC-T7-04].
- Completion "Receive a grade" is done, also for a grade of 0 [AC-T7-05].
- The best result counts. A later worse result does not lower the grade [AC-T5-12] (decision Q4).
- If you change a grade in Moodle (override), Moodle keeps your grade. The portal shows the difference [AC-T5-33].
- The Cogniate portal page "Results" shows the same scores. "Refresh from Moodle" shows the Moodle gradebook values [AC-T7-06, AC-T5-18].

## Other tasks

| Task | How | Tag |
| --- | --- | --- |
| Look at the course as a teacher | Open the activity. The player shows "Preview — no grade is sent". | AC-T5-13, AC-T4-19 |
| Use a different Cogniate course in an activity | Edit the activity. Click "Select content". Select the other course. | AC-T4-25 |
| See what learners see | See the [learner guide](learner-view.md). | — |

If a Cogniate user withdraws the course, the activity shows "This course is no longer available" [AC-T4-27].

## Not verified by QA

- Safari (see the NOTE above).
- The menu clicks to open the grader report. QA opened the report by its URL.
