# Native channel: put a Cogniate course into Moodle as a normal Moodle course

STATUS: Option A (download) is verified by QA in task T6. Options B and C are **pending QA** (task T8, a stretch task, approved by both reviewers). Steps in Moodle pages are marked "steps from Moodle 5.2.4; not verified by QA".

## When to use it

The main path is the live link (LTI): Moodle opens the course from Cogniate, and the score comes back to the gradebook. See the [admin guide](moodle-admin.md) and the [teacher guide](teacher.md).

Use the native channel only if a customer needs a course that they can edit inside Moodle, for example on MoodleCloud (decision Q12). A native course runs in Moodle's own SCORM activity. Moodle grades it. Cogniate does not see the results.

The native channel works only for SCORM 1.2 courses. An HTML course has no download and no backup.

## Option A: Download the SCORM package

1. In the portal, open a SCORM 1.2 course.
2. Click "Download SCORM package". The file is the same as the uploaded zip. An HTML course has no such button [AC-T6-11].

In Moodle (steps from Moodle 5.2.4; not verified by QA):

3. Turn on "Edit mode".
4. In a section, click "Add content".
5. Click "Activity or resource".
6. Select "SCORM package".
7. Click "Add".
8. Upload the downloaded zip in the SCORM form, then save.

NOTE: This repo does not describe the Moodle SCORM form in more detail.

## Option B: Moodle backup (.mbz)

### Make the backup (pending QA)

1. In the portal, open a SCORM 1.2 course.
2. Click "Build Moodle backup (.mbz)".
3. Wait. The build status changes from "queued" to "running" to "ready". The page updates every 3 seconds.
4. Click "Download Moodle backup (.mbz)".

If the status is "failed", the page shows the reason. A build with no progress for 10 minutes fails. A library can have at most 2 builds at the same time.

### Restore the backup in Moodle

The portal shows these steps (steps from Moodle 5.2.4; not verified by QA):

1. Open "Site administration" > "Courses" > "Restore course".
2. Upload the `.mbz` file.
3. Restore it as a new course.
4. The course arrives hidden. Check the course, then make it visible.

NOTE: QA (task T8, pending) checks the `.mbz` build and its contents. It also checks a restore with the Moodle command line and the grade in the native Moodle SCORM player. QA does not check the restore in the Moodle pages, on MoodleCloud, or on another Moodle release (decision Q5).

## Option C: Make an empty Moodle course when you publish (pending QA)

This option uses a Moodle web services token. The Moodle admin makes the token in Moodle, with these three functions: `core_webservice_get_site_info`, `core_course_get_courses_by_field` and `core_course_create_courses`. This repo does not describe the Moodle steps to make a token.

1. In the portal, open "Manage Moodle" for the connection.
2. In "Moodle web services (optional)", paste the token into "Web services token".
3. Click "Save web services token". The portal shows the site name and the Moodle release.
4. Open the course and click "Publish".
5. Select "Also create an empty Moodle course".
6. Click "Publish".

Result: the dialog shows "Moodle course status: created" and a link "Open Moodle course". The new Moodle course is hidden. Add the activities, check the course, then make it visible. A second publish shows "exists" and makes no second course.

## Not verified by QA

- Options B and C (task T8 QA pending).
- All steps in Moodle pages, including the restore on MoodleCloud.
