# T4a: Mock session, courses, upload and package inspector

Owner: Author. Depends on: T1 only (it can run in parallel with T2a if a second Author exists). Contract: [`../contracts/cogniate-app-api.md`](../contracts/cogniate-app-api.md) §1, §2, §3. Security §6, §7.

## Goal

A Cogniate user signs in (mock) and uploads both course packages. Unsafe packages are rejected before any file is written.

## Scope

In:

- `services/cogniate-app` skeleton (folders and import rule of ADR-008), SQLite and migrations, mock session, `Origin` rule, courses and course versions API.
- `packages/package-inspector`: zip checks, manifest parsing, HTML profile, report values (contract §3).
- Seed: libraries "Thanh's Library" and "QA Library B" and their users; passwords in `.env` and `seed.json` (key `portal.users`).

Out: connections, publications, tool pages (T4b1, T4b2). Download (T6).

## Design notes

- Stream the upload to a temp file. Inspect with `yauzl` before any extraction. Extract only after all checks pass, into a new `pkg_` folder. On any error, delete the temp file and the folder.
- Reject `<!DOCTYPE` and `<!ENTITY` before XML parsing. Parse with entity processing off.
- `parse5` reads only `body[data-lesson-id]`, `[data-cog-quiz]` and resource URLs.

## Acceptance criteria

Fixtures: `COURSE_FIXTURES_DIR` (copy each zip to a new temp folder first).

- **AC-T4-01** `POST /app-api/session` with Thanh's credentials (`seed.json`) → `204` and `__Host-cog_session` with `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`. Wrong password → `401 INVALID_CREDENTIALS`. `GET /app-api/me` without the cookie → `401 NOT_SIGNED_IN`.
- **AC-T4-02** `POST /app-api/courses` with the cookie and `Origin: {PUBLIC_CONTENT_URL}` → `403 ORIGIN_NOT_ALLOWED`. With `Origin: null` → `403`. Without `Origin` → `403`. No course is made.
- **AC-T4-03** SCORM zip → `201`, `format=scorm12`, `report.entryPath=index.html`, `report.fileCount=7`, `report.totalBytes=12723159`, `report.scorm.schemaVersion=1.2`, `report.scorm.masteryScore=70`, `report.scorm.scoCount=1`, `report.externalHosts=["cogniate-prod-ai-course-creation.s3.ap-southeast-1.amazonaws.com"]`, `trackingProfile.questionIds=["01M2M36Y89M9KPPZENF1ZW4AWJ"]`. The same SCORM upload with `masteryScore=50` → `400 MASTERY_SCORE_NOT_ALLOWED`, and no new version is stored.
- **AC-T4-04** HTML zip → `201`, `format=html`, `report.fileCount=7`, `report.totalBytes=12103306`, `report.html.pages=["index","lesson-ai-web-sprint"]`, `report.html.menuPage=index`, `report.html.questionIds=["01M2M36Y89M9KPPZENF1ZW4AWJ"]`, `trackingProfile.masteryScore=70`, `report.externalHosts` = the S3 host and `fonts.gstatic.com` (exactly these two).
- **AC-T4-05** Each crafted zip (QA makes them at run time) → `422 PACKAGE_REJECTED` with this code: `../evil.html` and `a/../../evil.html` → `PATH_TRAVERSAL`; `/abs.html` → `ABSOLUTE_PATH`; a symlink entry → `SYMLINK_ENTRY`; an entry with ratio > 100 → `ZIP_BOMB`; a manifest with `<!DOCTYPE x [<!ENTITY e SYSTEM "file:///etc/passwd">]>` → `MANIFEST_DTD_FORBIDDEN`; a manifest that is not XML → `MANIFEST_INVALID_XML`; SCORM 2004 → `SCORM_VERSION_UNSUPPORTED`; two SCOs → `MULTI_SCO_UNSUPPORTED`; SCO `href` missing → `LAUNCH_FILE_MISSING`; HTML zip without `index.html` → `NO_ENTRY_PAGE`; a text file → `ZIP_INVALID`; `A.html` and `a.html` → `DUPLICATE_ENTRY`; an entry name with a control character → `INVALID_ENTRY_NAME`; 5,001 entries → `ZIP_TOO_MANY_ENTRIES`; 201 MB of random data → `ZIP_TOO_LARGE`. After all of them, the number of folders in the package store is the same (`docker compose exec cogniate-app ls /data/packages | wc -l`), and `find / -name evil.html -o -name abs.html` in the container finds nothing.
- **AC-T4-35** Package identifiers (app contract §3.3): crafted packages with a manifest identifier of 129 characters, a `data-cog-quiz="__proto__"`, a page key `bad key.html` (space), and a manifest title with U+0007 → each `422 PACKAGE_REJECTED` with `INVALID_PACKAGE_IDENTIFIER`, `details.action` present, and nothing stored. Every `422` of AC-T4-05 also has a non-empty `details.action`.
- **AC-T4-06** The QA Library B user gets `404` for `GET /app-api/courses/<Thanh course id>`, for its versions, and for `POST .../versions` on it, and does not see it in `GET /app-api/courses`.

## Self-check

`npm run check` green. Unit tests: each reject code, report values on the two fixtures (copied to a temp dir), resource-host rule, origin check.
