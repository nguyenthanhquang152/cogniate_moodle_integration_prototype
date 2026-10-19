# Native channel: put a Cogniate course into Moodle as a normal Moodle course

STATUS: **Pending QA.** Task T8 (a stretch task) is built and approved by both reviewers. Its QA report does not exist yet. Use this guide only for a test. The builder checked every step below; QA did not.

## When to use it

The main path is the live link (LTI): Moodle opens the course from Cogniate, and the score comes back to the gradebook. See the [admin guide](moodle-admin.md) and the [teacher guide](teacher.md).

Use the native channel only if a customer needs a course that they can edit inside Moodle, for example on MoodleCloud (decision Q12). A native course runs in Moodle's own SCORM activity. Moodle grades it. Cogniate does not see the results.

The native channel works only for SCORM 1.2 courses. An HTML course has no download and no backup.

## Option A: Download the SCORM package

1. In the portal, open a SCORM 1.2 course.
2. Click "Download SCORM package".
3. In Moodle, turn on "Edit mode".
4. In a section, click "Add content".
5. Click "Activity or resource".
6. Select "SCORM package".
7. Click "Add".
8. Upload the downloaded zip in the SCORM form, then save.

NOTE: Steps 4 to 8 are standard Moodle steps. This repo does not describe the SCORM form in more detail.

## Option B: Moodle backup (.mbz)

### Make the backup

1. In the portal, open a SCORM 1.2 course.
2. Click "Build Moodle backup (.mbz)".
3. Wait. The build status changes from "queued" to "running" to "ready". The page updates every 3 seconds.
4. Click "Download Moodle backup (.mbz)".

If the status is "failed", the page shows the reason. A build with no progress for 10 minutes fails. A library can have at most 2 builds at the same time.

### Restore the backup in Moodle

The portal shows these steps:

1. Open "Site administration" > "Courses" > "Restore course".
2. Upload the `.mbz` file.
3. Restore it as a new course.
4. The course arrives hidden. Check the course, then make it visible.

NOTE: QA does not test the restore in the Moodle pages. The T8 test uses the Moodle command line for the restore. A restore on another site or another Moodle release is not proven (decision Q5).

## Option C: Make an empty Moodle course when you publish

This option uses a Moodle web services token. The Moodle admin makes the token in Moodle, with these three functions: `core_webservice_get_site_info`, `core_course_get_courses_by_field` and `core_course_create_courses`. This repo does not describe the Moodle steps to make a token.

1. In the portal, open "Manage Moodle" for the connection.
2. In "Moodle web services (optional)", paste the token into "Web services token".
3. Click "Save web services token". The portal shows the site name and the Moodle release.
4. Open the course and click "Publish".
5. Select "Also create an empty Moodle course".
6. Click "Publish".

Result: the dialog shows "Moodle course status: created" and a link "Open Moodle course". The new Moodle course is hidden. Add the activities, check the course, then make it visible. A second publish shows "exists" and makes no second course.

## Not verified by QA

Everything in this guide (task T8 QA pending). The Moodle restore pages are not planned for QA.
