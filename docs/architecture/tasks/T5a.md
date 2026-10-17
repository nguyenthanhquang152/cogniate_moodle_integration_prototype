# T5a: Content host, SCORM 1.2 runtime, tracking, score sync, results

Owner: Author. Depends on: T4b2, T5-spike note. Contract: [`../contracts/cogniate-app-api.md`](../contracts/cogniate-app-api.md) §5 (results GET), §6 (`/play`), §7, §8, §10, §12. Decisions: ADR-004, ADR-010. Security §5, §7.

## Goal

A learner completes the SCORM course in the Cogniate player, and the result reaches the Moodle gradebook through AGS. The app shows each result and each sync.

## Scope

In:

- Content host listener (`src/content-host`, import fence of ADR-008): `/pkg/*`, `/rt/*`, `/_rt/assets/*`, headers of security §5 and §7.
- `apps/player`: SCORM 1.2 runtime = **our own subset** (T5-spike decision; estimate about 300 lines of TypeScript and 300 lines of unit tests, one test per contract §8 row and error code). The spike code in `apps/player-spike/` is reference only. Commit transport: `fetch` keepalive for `commit` and `finish`, **one** `sendBeacon` on `pagehide`, no state by `postMessage` (app contract §7). Player shell script (status poll every 5 s: "In progress", "Completed — score 100 sent to Moodle", "Preview — no grade is sent").
- `packages/tracking`: CMI rules, Moodle `LMSFinish` rule, session time once per session, outcome, AGS mapping, best-result rule (ADR-010).
- Attempts per course version, sessions with `seq` (`lastSeq` in RuntimeState, H10), `total_time`, `entry`.
- Score sync worker (first tries; the full 24 h schedule, `conflict` and Resend are T5b).
- `GET /app-api/publications/:id/results` with `best`, `attempts`, `scoreSyncs` (H5) and preview rows.
- `npm run dev:web` (ADR-008).

Out: HTML runtime, results refresh, Resend, full retry schedule (T5b). Portal results UI (T6).

## Design notes

- The runtime page loads `/_rt/assets/runtime.js`. It reads `/rt/{token}/state`, defines the API, then sets the package iframe `src`.
- The runtime must not wait for S3 or Google hosts.
- QA notes from the spike: Playwright `page.route()` does not see requests sent while a page closes (use the logs); with hanging hosts use `waitUntil: 'domcontentloaded'`.
- Score sync rows are made in the same transaction as the attempt update.

## Acceptance criteria

Setup: T4b2 state; activities "Cogniate SCORM" (SCORM course) and "Cogniate HTML" (HTML course) in `COGNIATE-DEV-101`, deep-linked, completion "Receive a grade". Non-`*.test` hosts are blocked in the browser.

Content origin:

- **AC-T5-01** `GET {PUBLIC_CONTENT_URL}/pkg/<packageId>/index.html` → `200 text/html`, `nosniff`, CSP `frame-ancestors {PUBLIC_CONTENT_URL} {PUBLIC_APP_URL}`, no `Set-Cookie`. Raw path requests (`curl --path-as-is` or a raw Node request) with `../` and `%2e%2e/` → `400` or `404`, and the body is not the target file.
- **AC-T5-02** `GET .../pkg/<packageId>/assets/ask-lyra/lyra.mp4` with `Range: bytes=0-1023` → `206`, `video/mp4`, `Content-Range: bytes 0-1023/10721508`.
- **AC-T5-03** `GET /rt/<runtimeToken>` → CSP `frame-ancestors {PUBLIC_APP_URL}`. Random token → `404`. The shell's runtime iframe has exactly `sandbox="allow-scripts allow-same-origin"` (no `allow-top-navigation`, no other tokens) and `allow="autoplay; fullscreen"`. In the package frame, `document.fullscreenEnabled === true`. The shell sends no `Permissions-Policy` header.

SCORM runtime:

- **AC-T5-04** In a `cg_student` launch of "Cogniate SCORM", the runtime frame has `window.API` with the eight SCORM 1.2 functions, and the package frame has `window.CogniateSCORM.available === true` (the package script ran under our CSP).
- **AC-T5-05** QA uploads a "blank SCO" package (one `index.html` that never calls the API, mastery 70), publishes, deep-links and launches it. In the runtime frame: `LMSGetValue("cmi.core.lesson_status")` before init → `""`, `LMSGetLastError()` → `"301"`; `LMSInitialize("")` → `"true"`, `"0"`; `cmi.core.student_id` = LTI user id; `cmi.student_data.mastery_score` = `"70"`; `LMSSetValue("cmi.core.lesson_status","done")` → `"false"`, `"405"`; `LMSGetValue("cmi.core.session_time")` → `"404"`; `LMSSetValue("cmi.core.student_id","x")` → `"403"`; `LMSGetValue("cmi.foo")` → `"201"`; on a new page load `LMSInitialize("x")` → `"201"`; after `LMSFinish("")`, `LMSGetValue` → `"101"`.
- **AC-T5-06** Blank SCO: set `cmi.suspend_data="qa-resume"`, `cmi.core.exit="suspend"`, `LMSCommit("")`, close the window. Launch again from Moodle → `cmi.suspend_data = "qa-resume"`, `cmi.core.entry = "resume"`.
- **AC-T5-21** Blank SCO, new learner attempt: `LMSInitialize("")`, then `LMSFinish("")` only → the attempt outcome is `completed`, and Moodle shows 100 (Moodle `LMSFinish` rule + ADR-010 mapping).
- **AC-T5-22** Blank SCO: two sessions with `session_time` `0000:00:30.00` each, each with `LMSFinish` and then window close (so each session also sends an `unload`) → in the third session `cmi.core.total_time` = `0000:01:00.00` (each session counts once, with its largest `session_time`).

Full course:

- **AC-T5-07** SCORM pass: menu page, lesson page, ≥ 11 s visible, scroll to the end, the option with `data-cog-correct="true"`. Within 60 s: shell "Completed — score 100 sent to Moodle"; QA oracle shows 100 for "Cogniate SCORM" and completion done (grader report and course page screenshots); results row `best.outcome=passed`, `best.scoreGiven=100`, one `scoreSyncs` entry `sent`.
- **AC-T5-08** SCORM fail: `cg_student2` picks a wrong option and finishes the pages → Moodle 0 and completion done; row `failed`, `scoreGiven=0`, one sync `sent`.
- **AC-T5-20** `cg_student` opens "Cogniate SCORM" again after AC-T5-07 (the package calls `LMSFinish` at once) → no new `scoreSyncs` entry, `best.outcome` still `passed`, Moodle still 100.
- **AC-T5-12** After AC-T5-07: relaunch, then in the new session post a commit with `lesson_status=failed`, `score.raw=0`, `seq = lastSeq + 1` (from the runtime frame) → `200`; no new `scoreSyncs` entry; Moodle still 100.
- **AC-T5-23** After AC-T5-08: relaunch as `cg_student2`, commit `lesson_status=passed`, `score.raw=100`, then `finish` → one new sync `sent`; Moodle 100 for `cg_student2`; `best.outcome=passed`.
- **AC-T5-13** Teacher preview: `cg_teacher` completes "Cogniate SCORM" → shell "Preview — no grade is sent"; the result row has `preview: true` and `scoreSyncs: []`; no teacher grade in Moodle.
- **AC-T5-24** Versions: upload a version 2 of the SCORM course and publish it. `cg_student2`'s in-progress attempt (start one before the upload: open, menu page only) continues on version 1 (`RuntimeState` and `attempts[].versionId`). `cg_student`'s next launch (attempt final) makes a new attempt on version 2.

Isolation and rules:

- **AC-T5-34** After the end: when AC-T5-07 has finished (`LMSFinish` sent), QA goes back to the menu page in the same window. The package makes no second `finish` and no new `commit` (no new `commit_accepted` event for that session except at most one `unload`), and the outcome stays `passed`.
- **AC-T5-35** Close mid-course: `cg_student2` opens "Cogniate SCORM", sees the menu page, and QA closes the window (`page.close({runBeforeUnload: true})`). The content host logs exactly one `commit_accepted {event: "unload"}` from the runtime for that session (QA reads the log: Playwright routes do not see requests sent while a page closes). The attempt is `in_progress`, and the next launch gets `cmi.core.entry = "resume"`.
- **AC-T5-37** Rebind with an in-progress attempt (moved from AC-T4-25): `cg_student2` opens "Cogniate SCORM" and leaves after the menu page (attempt `in_progress`). `cg_teacher` re-selects the HTML course for that activity. `cg_student2`'s next launch opens the HTML course with a **new** attempt (`attempts[]` shows both versions); the SCORM attempt stays `in_progress`, gets no score sync, and shows under the SCORM publication's results.
- **AC-T5-15** Token scope: `GET /rt/<token A>/state` returns attempt A only; token B returns B only; a random token → `404`. A commit with `seq ≤ lastSeq` → `409 STALE_SEQUENCE`. With `PLAY_TTL_SECONDS=20`, a commit at TTL + 3 s → `410 RUNTIME_EXPIRED`.
- **AC-T5-16** A commit with 5,000 chars of `suspend_data` → `400 INVALID_CMI`, `details.field = "cmi.suspend_data"`; `commit_rejected` logged.
- **AC-T5-17** From the package frame: `fetch("{PUBLIC_APP_URL}/app-api/me", {credentials:"include"})` does not return the user (CORS error or `401`). `top.location.href = "https://evil.test"` does not change the top window URL.

## Self-check

`npm run check` green. Unit tests: `packages/tracking` (every ADR-010 row, best-result rule, `LMSFinish` rule, CMI rules, session time once), SCORM API (jsdom, the error table of contract §8).
