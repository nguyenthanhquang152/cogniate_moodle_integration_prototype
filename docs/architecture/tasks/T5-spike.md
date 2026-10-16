# T5-spike: Player spike — real SCORM package in the real frames

Owner: Author. Time-box: half a day. Not reviewed (like T1-spike). Depends on: T1. Output: `apps/player-spike/SPIKE-NOTES.md` (the Lead moved it there from `apps/player/`) and throwaway code that T5a may keep or delete.

**Status: done** (commit 07e8a45). Decisions folded into ADR-004, security §7, app contract §7–§9, T5a and T5b: own SCORM 1.2 subset; sandbox `allow-scripts allow-same-origin`; `allow` on the runtime iframe only; `fetch` keepalive + one `sendBeacon`; `101` after `LMSFinish`; HTML runtime attaches when the document is parsed. Not verified: video playback, Firefox and Safari, a real window close by a person, mobile.

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
