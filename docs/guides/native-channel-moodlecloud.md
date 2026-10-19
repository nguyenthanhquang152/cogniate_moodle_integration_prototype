# Native channel: put a Cogniate course into Moodle

STATUS: T8 round 2 passed AC-T8-02 to AC-T8-10 and both race checks at `8059c31` ([T8 QA](../reviews/T8/qa.md)). This covers the backup API, CLI restore, native SCORM grade, token API, course shell, and Publish controls. It does not verify every native-channel screen or MoodleCloud.

## When to use it

The main path is the live link (LTI). Moodle opens the course from Cogniate, and the score returns to the gradebook. See the [admin guide](moodle-admin.md) and the [teacher guide](teacher.md).

Use the native channel only if a customer needs a course they can edit inside Moodle (decision Q12). A restored course runs in Moodle's SCORM player. QA confirmed grade 100 and status "Passed" there [AC-T8-06]. Cogniate does not track this native result.

The native channel supports SCORM 1.2 packages. HTML courses have no download button [AC-T6-11].

## Option A: Download the SCORM package

1. In the portal, open a SCORM 1.2 course.
2. Click "Download SCORM package" [AC-T6-11].

Result: the file matches the uploaded zip. HTML courses have no such button [AC-T6-11].

In Moodle (steps from Moodle 5.2.4; not verified by QA):

3. Turn on "Edit mode".
4. In a section, click "Add content".
5. Click "Activity or resource".
6. Select "SCORM package".
7. Click "Add".
8. Upload the downloaded zip in the SCORM form.
9. Save the activity.

NOTE: This repo does not describe the Moodle SCORM form in more detail.

## Option B: Moodle backup (.mbz)

### Make the backup

QA verified the build and download through the API [AC-T8-02]. The portal button sequence and polling interval below remain unverified.

1. In the portal, open a SCORM 1.2 course [Not verified by QA].
2. Click "Build Moodle backup (.mbz)" [Not verified by QA].
3. Wait for the status "ready" [Not verified by QA].
4. Click "Download Moodle backup (.mbz)" [Not verified by QA].

The page polls every 3 seconds [Not verified by QA]. A failed build shows its reason in the portal [AC-T8-07]. The backup contains no users and exactly one SCORM activity [AC-T8-04]. A library can have at most two active builds [C-T8-01].

### Restore the backup in Moodle

The portal shows these steps from Moodle 5.2.4. QA did not verify these page steps.

1. Open "Site administration" > "Courses" > "Restore course".
2. Upload the `.mbz` file.
3. Restore it as a new course.
4. Check the hidden course.
5. Make it visible when ready.

NOTE: QA restored the backup with Moodle's command line [AC-T8-05]. The restored course was hidden. A learner then earned grade 100 in Moodle's SCORM player [AC-T8-06]. Restore through Moodle pages, MoodleCloud, and other Moodle releases remain unverified (Q5).

## Option C: Make an empty Moodle course when you publish

This option uses a Moodle web services token. The Moodle admin makes the token with these functions:

- `core_webservice_get_site_info`
- `core_course_get_courses_by_field`
- `core_course_create_courses`

This repo does not describe the Moodle steps to make a token. QA verified token validation through the API [AC-T8-08]. The portal token form remains unverified.

1. In the portal, open "Manage Moodle" for the connection [Not verified by QA].
2. Under "Moodle web services (optional)", paste the token into "Web services token" [Not verified by QA].
3. Click "Save web services token" [Not verified by QA].
4. Open the course and click "Publish" [AC-T8-10].
5. Select the Moodle connection [AC-T8-10].
6. Select "Also create an empty Moodle course" [AC-T8-10].
7. Click "Publish" [AC-T8-10].

Result: the dialog links to the new hidden Moodle course [AC-T8-10]. The API returns `created`, then `exists` on a second publish, with no duplicate course [AC-T8-09].

Before learners use it:

1. Add the activities [Not verified by QA].
2. Check the course [Not verified by QA].
3. Make it visible [Not verified by QA].

## Not verified by QA

- MoodleCloud, restore through Moodle pages, and other Moodle releases.
- The portal token form and the full backup button sequence.
- The 10-minute build timeout and the sweep of interrupted builds.
- Rejection of planted request files and the backup copy checks.

These limits come from [T8 QA §5](../reviews/T8/qa.md#5-not-covered). The two concurrent-build checks and the runner race passed in round 2. A rare stale-lock takeover race remains an accepted deferral (A-FX-03 in [deferred.md](../human_review/deferred.md)).
