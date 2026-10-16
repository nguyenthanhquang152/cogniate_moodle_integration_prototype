# T5-spike: Player spike — real SCORM package in the real frames

Owner: Author. Time-box: half a day. Not reviewed (like T1-spike). Depends on: T1. Output: `apps/player/SPIKE-NOTES.md` (decision note) and throwaway code that T5a may keep or delete.

## Goal

Find the browser surprises of the player before the LTI work: the real Cogniate `scorm-api.js` in three nested documents on two origins, with the real headers and sandbox, and no LTI.

## Setup

- A static player shell page on `PUBLIC_APP_URL` (for example `/spike/play`) with the runtime iframe (security §5 and §7 headers and sandbox).
- A static runtime page on `PUBLIC_CONTENT_URL` (`/spike/rt`) that defines `window.API` and frames the package.
- The SCORM fixture extracted (from `COURSE_FIXTURES_DIR`, into a new empty folder) and served at `/spike/pkg/...` on the content origin with `frame-ancestors {PUBLIC_CONTENT_URL} {PUBLIC_APP_URL}`.
- Commits go to a stub endpoint that only logs them.

## Exit questions (answer each in the note, with evidence)

| # | Question |
| --- | --- |
| S1 | With the CSP above, does every package page load and run its script in Chromium? (`window.CogniateSCORM.available === true`.) Does it fail with only `frame-ancestors {PUBLIC_CONTENT_URL}`? |
| S2 | `scorm-again` `Scorm12API` (auto-commit off): does it return `""` + `301` for `LMSGetValue` before `LMSInitialize`, `201` for `cmi.foo`, `101` after `LMSFinish`? Can we hook commit and finish and read the CMI? |
| S3 | Decision: `scorm-again` or our own subset (app contract §8). Give the reason and the estimated size of the subset. |
| S4 | Does the full course reach `passed` with `LMSFinish` (menu page, lesson page 11 s + scroll, correct answer)? Which commits arrive, in which order, with which `event`? |
| S5 | Does `pagehide` + `sendBeacon` deliver the last state when the window closes? After `LMSFinish`, which events still fire (to confirm "session time once per session")? |
| S6 | Does the video play and go full screen with `allow="autoplay; fullscreen"` on both iframes? Does `allow-modals` work for `alert()`? |
| S7 | With non-`*.test` hosts blocked, does the course still complete (no wait on S3 or Google)? |

## Done

The note answers S1 to S7. The Lead reads it before T5a starts. If S3 chooses our own subset, the Lead re-checks the T5a size.
