# T4b: Connections, publications, content picker, launch handoff, tool page security

Owner: Author. Depends on: T3a, T3b, T4a. Contract: [`../contracts/cogniate-app-api.md`](../contracts/cogniate-app-api.md) §4, §5 (without results), §6, §12. Security §3, §4, §5, §6, §7 (output), §8. Flows §6a, §6b, §6c (up to `/play`), §6e.

## Goal

A Cogniate user connects Moodle (dynamic or manual) and publishes courses. A teacher picks a course in Moodle. A learner launch lands on the player shell with an attempt. Every tool page has the right frame, form and referrer rules.

## Scope

In: connections, publications, tool pages `/tool/launch`, `/tool/deep-link`, `/tool/picker/*`, `/tool/register`, player shell `/play/{playId}` (header, runtime iframe tag, status poll) and `/play/{playId}/embedded`, `/app-api/play/{playId}/status`, handoff rules, page headers, typed LTI service client with `X-Trace-Id`, dev helper `npm run seed:lti-activity -- --type <typeId> --course <shortname> --name <name> --url <toolUrl>`. Optional H11: `npm run stack:snapshot <name>` and `stack:restore <name>` for all stack volumes, so later suites can start from the "T4b state".

Out: content host, runtimes, outcome, score sync, results rows (T5a). Course shell and web services token (T8).

## Design notes

- Tool pages are server-rendered with the portal CSS tokens (a small static CSS file is enough). Escape all untrusted text.
- Store the ltik encrypted only in the picker session. The play session holds no ltik.
- Role check for the picker: a role that ends with `#Instructor`, `#ContentDeveloper` or `#Administrator`.
- The picker submit uses `POST /api/deeplinking` and renders its own form with a nonce script.

## Acceptance criteria

Setup: T4a state; both fixtures uploaded as Thanh's courses; one HTML course uploaded as library B's course.

Connections:

- **AC-T4-07** `POST /app-api/connections {name:"Dev Moodle", siteUrl: PUBLIC_MOODLE_URL, method:"dynamic"}` → `201`, `status=pending`, `registrationUrl` matches `^{PUBLIC_LTI_URL}/lti/register/cogniate\?ref=[A-Za-z0-9_-]{43}$`.
- **AC-T4-08** Moodle `admin` pastes that URL → Add LTI Advantage. The frame shows the confirm page with `PUBLIC_MOODLE_URL`, the Moodle version, "Thanh's Library" and the privacy text. A real click on "Connect" works: the dialog closes by itself, Moodle lists a new Pending tool "Cogniate (Thanh's Library)", and the connection is `registered` with `platform.clientId` = its client id.
- **AC-T4-09** Opening the same URL again → `REF_INVALID`. A connection with `siteUrl https://other.test`, used from Moodle → `SITE_MISMATCH`. With `REF_TTL_SECONDS=20` (`stack:restart`), a URL used at TTL + 3 s → `REF_EXPIRED`.
- **AC-T4-10** Manual: library B makes a `method:"manual"` connection. `GET .../tool-configuration` returns the ADR-009 values. QA makes the manual tool "Cogniate (QA Library B)" in Moodle and saves it. `PUT .../platform` with the six values → `200`, `registered`. With `jwksUrl` on `https://evil.test` → `422 INVALID_PLATFORM_VALUES`.
- **AC-T4-30** Library B also tries dynamic registration with its own registration URL. Moodle shows the choice page. QA chooses "update" of Thanh's tool → the frame shows `UPDATE_NOT_ALLOWED` with "Go back in Moodle and choose Register as a new tool". Thanh's Moodle tool is unchanged (name, URLs) and Thanh's connection keeps its platform. QA repeats and chooses "register as new" → library B gets its own tool.

Publish:

- **AC-T4-12** `POST /app-api/publications {connectionId, courseId:<SCORM course>}` → `201`, `available`. Again → `200`, same `id`. `withdraw`, then POST → `available`.
- **AC-T4-14** Publish to a `pending` connection → `409 CONNECTION_NOT_READY`.

Picker and launch (Thanh's tool activated and edited to New window and "Show in activity chooser"; both Thanh courses and library B's course published):

- **AC-T4-15** `cg_teacher`: Add an activity → "Cogniate (Thanh's Library)" → Select content. The picker shows exactly Thanh's publications as radio buttons (single select) with badges "SCORM 1.2" and "HTML". Pick the SCORM course → the form gets the course title. Save → the gradebook item has maximum 100. Connection `connected`. `stats.activities = 1`.
- **AC-T4-16** Through "Cogniate (QA Library B)" in `COGNIATE-DEV-102`, the picker shows only library B's publication.
- **AC-T4-26** A picker POST (real page, edited form value) with library B's publication id, and one with a withdrawn publication → `400` page `PUBLICATION_NOT_AVAILABLE`; no deep-linking call (`outbound_request` to the LTI service is absent for that trace id).
- **AC-T4-17** `cg_student` opens the activity → a new window ends at `{PUBLIC_APP_URL}/play/<playId>`, with no `ltik` in the final URL. The `/tool/launch` response is `303` with `Referrer-Policy: no-referrer`. The page shows the course title and "Back to Moodle". `GET /app-api/play/<playId>/status` → `outcome=not_started`, `preview=false`. `stats.learners = 1`.
- **AC-T4-24** QA captures the `/tool/launch?…&ltik=` URL of a launch and opens it again in a new context → `409` page `HANDOFF_USED`, `handoff_rejected {code: HANDOFF_USED}` is logged with the page's trace id, and there is no `launch_accepted` event for that trace id.
- **AC-T4-23** QA intercepts the `303` to `/tool/launch` and changes `resource` to the HTML publication id → the player still opens the **SCORM** course (from the signed target).
- **AC-T4-25** `cg_teacher` edits the SCORM activity, uses "Select content" again and picks the HTML course. The next `cg_student` launch opens the HTML course, and `resource_link_rebound` is logged.
- **AC-T4-18** `seed:lti-activity` makes an activity under Thanh's tool with `--url {PUBLIC_LTI_URL}/lti/launch/cogniate?resource=<library B publication id>`. `cg_student` launch → `404` page "This course is not available"; `launch_rejected {reason: publication_not_in_connection}`; no attempt.
- **AC-T4-27** Withdraw the SCORM publication; a launch of an activity that uses it → `410` page "This course is no longer available".
- **AC-T4-19** `cg_teacher` opens the activity → status `preview=true`.
- **AC-T4-20** `GET /tool/deep-link?ltik=<ltik of a student resource launch>` → `403` page. A picker POST with a used picker id → `410` page. With `PICKER_TTL_SECONDS=20`, a POST at TTL + 3 s → `410` page.
- **AC-T4-31** Moodle `admin` sets Thanh's tool "Default launch container" to "Embed, without blocks" (the value that dynamic registration sets). `cg_student` opens the activity: the Moodle iframe shows `/play/<playId>/embedded` with "Open in a new window". The button opens `/play/<playId>` in a new top-level window that works. Then the admin sets "New window" again.

Tool page security:

- **AC-T4-21** Headers (security §5): `GET /tool/register` has `frame-ancestors {PUBLIC_MOODLE_URL}` and `form-action 'self'`; the picker GET has `frame-ancestors {PUBLIC_MOODLE_URL}`; the picker POST result has `form-action` = the Moodle origin; `/play/<id>` has `frame-ancestors 'none'`; `/play/<id>/embedded` has `frame-ancestors {PUBLIC_MOODLE_URL}`. All have `Referrer-Policy: same-origin`, a `script-src 'nonce-…'` where they have scripts, no `X-Frame-Options` on the framed pages, and no `Set-Cookie`.
- **AC-T4-22** `POST /tool/register` and `POST /tool/picker/<id>` with `Origin: https://evil.test`, with `Origin: null`, and without `Origin` → `403`, `csrf_rejected` logged, and no state change (connection still `pending`; picker not used; no deep-linking call).
- **AC-T4-28** A course titled `<b>x</b>` and an uploaded SCORM package with manifest title `<img src=x onerror="window.__xss=1">`, published; a Moodle activity named `<i>y</i>`. The picker, the confirm page and the player shell show these texts literally, and `window.__xss` is undefined in every page.
- **AC-T4-29** Tenant matrix: the library B session gets `404` for Thanh's connection (GET, `registration-url`, `tool-configuration`, `platform`, DELETE), publication (GET, withdraw, POST with Thanh's ids) and course version endpoints. `GET /app-api/play/<unknown id>/status` → `404`.
- **AC-T4-32** Every tool page error shows a code, a trace id and one action line. The trace id is in the matching log event (`launch_rejected`, `picker_rejected`, `handoff_rejected`, `registration_confirm_rejected`).

## Self-check

`npm run check` green. Unit tests: role check, publication upsert, handoff single use, signed-target parsing, resource link key and rebound, origin check, ref token rules, header builder per page.
