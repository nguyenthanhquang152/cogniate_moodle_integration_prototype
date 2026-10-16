# ADR-004: SCORM 1.2 and HTML courses run in the Cogniate player behind LTI

Status: Accepted (round 2; the SCORM API object is decided by the T5-spike). Date: 2026-10-16.

## Context

Both packages must reach Moodle learners through LTI 1.3, with score and completion in the gradebook.

Facts from the packages (read in full; flows §6c, §6d):

- SCORM package: SCORM 1.2, one SCO (`index.html`), mastery 70. `scorm-api.js` finds `window.API` in the parent chain, then the opener chain, then `window.top`. It probes `cmi.core.lesson_status` before `LMSInitialize` and expects `301`. It calls `LMSFinish` itself when the course is complete, also at once on a later load of a finished course.
- HTML package: the same pages, no SCORM API, no manifest. Only native signal: `localStorage.lessonProgress`. Same quiz markup (`data-cog-quiz`, `data-cog-correct`) and `<body data-lesson-id>`.
- Both load images from a Cogniate S3 bucket. The HTML package loads Google fonts.

## Options for SCORM 1.2

| Option | For | Against |
| --- | --- | --- |
| A. Our player: a runtime page on the content origin defines `window.API` and frames the SCO | Works on MoodleCloud without admin steps per course. Live updates. Cogniate sees progress. Grade through AGS. | We must implement the SCORM 1.2 runtime well |
| B. Native Moodle `mod_scorm` | Moodle's own player | Manual upload or `.mbz` restore per version. No live updates. → stretch (ADR-007) |
| C. Hosted SCORM engine | Mature | Commercial, sign-up, learner data leaves Cogniate |

## Options for HTML tracking

| Option | For | Against |
| --- | --- | --- |
| A. Read `localStorage.lessonProgress` | Already there | No completion event, no quiz result, browser-local |
| B. Inject a tracker script when we serve pages | Simple runtime | Changes package bytes |
| C. The runtime frame observes the same-origin package frame | No byte change. Same rule as SCORM. | Depends on the Cogniate export markup |
| D. Score 100 at launch | Trivial | Says nothing about learning |

## Decision

**SCORM: option A.**

- The runtime page (`/rt/{runtimeToken}`) and the package files (`/pkg/{packageId}/...`) are on the same content origin, so the SCO finds `parent.API`.
- CSP on package files: `frame-ancestors {PUBLIC_CONTENT_URL} {PUBLIC_APP_URL}`. CSP checks every ancestor, and the shell on the app origin is the top ancestor. With only the content origin, the browser blocks every package page (found in review A-T0-01).
- API object: the **T5-spike** decides between `scorm-again` (MIT, no dependencies) and our own subset. It loads the real package in the real nested frames with the real headers and proves the `301` probe, `LMSFinish` and the commit transport. The behaviour is fixed in the app contract §8 either way.
- One runtime page load = one SCORM session. The runtime frame stays loaded while the SCO moves between its pages.
- Transport: `LMSCommit` and `LMSFinish` send `POST /rt/{runtimeToken}/commit` (`fetch` with `keepalive`). `pagehide` sends `unload` with `navigator.sendBeacon`.
- The server applies the Moodle `LMSFinish` status rule, adds session time once per session, and derives the outcome (ADR-010).

**HTML: option C.**

- The HTML runtime frames the package entry page on the same origin and attaches listeners to the child document on each `load`.
- Rules (same as the SCORM package):
  - A page is seen after `minDwellMs` (10 s) of visible time and a scroll to the end (24 px slack, or the page is shorter than the viewport).
  - The menu page (`index`, when there is more than one page) is seen on visit.
  - A question is answered by the first click or change on an input with `data-cog-correct` inside `[data-cog-quiz]`. The first answer stands.
  - Complete = all pages seen and all questions answered. Score = round(correct / total × 100). Passed if score ≥ 70 (or the upload value).
- It removes `target` and `rel` from internal `.html` links.
- It reports raw progress. The server computes the outcome from the tracking profile of the attempt's version.

**Frames:** runtime iframe `sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"`, `allow="autoplay; fullscreen"`. The inner package iframe gets the same `allow` value, because permission delegation stops at each frame. `allow-modals` is on, because the HTML export uses `alert()` or `confirm()` once.

**Versions:** each attempt keeps its course version. A new version is used only for new attempts (spec §9.4: "New attempts use the new version"). An in-progress attempt continues on its version.

## Consequences

- One attempt model and one outcome-to-AGS mapping for both formats. The same course gives the same result in both formats.
- The HTML runtime depends on "Cogniate HTML export markup v1" (Q7).
- Scores computed in the browser can be forged (security §7, Q8).
- Multi-SCO and SCORM 2004 packages are rejected at upload.
- The T5-spike runs before T2, so a bad surprise in the player shows early.
