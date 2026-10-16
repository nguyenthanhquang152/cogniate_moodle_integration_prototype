# ADR-007: Native channel (.mbz) and the course shell are stretch

Status: Accepted (round 2). Date: 2026-10-16.

## Context

The spec (§1, §9.1) describes a "package import" channel: a headless Moodle ("Build Runner") writes a native course and backs it up to `.mbz`, and the MoodleCloud admin restores it by hand. The Partners On Purpose plan (WBS 2.3.12) has a manual "attach SCORM package" step. The spec also uses web services to make empty Moodle courses (course shells).

Spike facts (§8): `add_moduleinfo()` with the SCORM zip works from CLI (0.14 s). `backup.php` makes a 23.2 MB `.mbz` in about 1 s. Restore on another site is not verified.

The goal of this prototype is LTI 1.3 publishing. The native channel and the course shell are not needed for it. Web services cannot add activities, so the teacher adds the activity with Deep Linking anyway.

## Decision

- **"Download SCORM package"** (the original zip, with steps for "Add an activity → SCORM package") is in **T6**. It needs almost no work and helps MoodleCloud users now.
- **Stretch task T8** (only after T7 passes, only if the Lead starts it):
  - Build Runner: a separate compose project with the same Moodle image and its own Postgres, on an internal network. It makes a hidden course with one `mod_scorm` activity, runs `backup.php --nousers`, and copies the `.mbz` out.
  - Portal: build status, download, restore steps.
  - E2E stand-in for the manual restore: `admin/cli/restore_backup.php`.
  - **Course shell** through web services (`core_course_get_courses_by_field`, `core_course_create_courses`), with the web services token on the connection.
- Not in T8: HTML as native activities, LTI activities inside the `.mbz`, automatic restore.

## Consequences

- T1–T7 do not need the Build Runner, a web services client or a web services token.
- If T8 is skipped, the human review pack says "native channel designed, not proven".
- Restore across Moodle releases stays a risk (spec §14).
