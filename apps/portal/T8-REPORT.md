# T8 portal and review cleanups — Author-2 handoff

Date: 2026-10-19. Branch: `feat/t6-portal-ui`. Status: author self-check complete; independent QA and reviews remain with the Lead.

## Changes

- SCORM versions show **Build Moodle backup (.mbz)**. The portal reads the newest build, polls every 3 seconds while it waits or runs, and stops polling when it is ready or failed. It shows the server status, step, reason (including a queued-build hint), size, and download URL. A failed build can be started again. HTML versions have no backup control.
- The course page gives the four MoodleCloud restore steps. It says that the restored course is hidden and must be checked before it is made visible.
- Each enabled connection has **Moodle web services (optional)**. The password field sends the token to `PUT .../web-services`, clears it after success, and shows the returned site name and release. API errors use the existing server-error display.
- The publish dialog shows **Also create an empty Moodle course** only for a selected connection with `webServices`. Changing the connection clears the checkbox. A checked box sends `createMoodleCourse: {}`. The result and the saved publication show `shellStatus`, the Moodle course link, and `shellError` when present. Keyboard focus moves to **Done** after publish.
- **B-T6-05:** the first-launch hint now appears only for a `registered` connection.
- **B-T3c-03:** all six SDK compatibility files use the same searchable `ltiaas-0.0.4 tolerance` tag. The route README lists all sites and points to contract §8 D14/D15.
- **A-T3c-03:** the service URL guard refuses `%3F`, `%3f` and `%23` in a final decoded path. The bounded extra SDK encoding layer still works.
- **Q-T7-02 (Lead follow-up):** teacher instructions now say **Edit mode → Add content → Activity or resource → Cogniate (<library>) → Add → Select content**. Original SCORM download instructions use **Edit mode → Add content → Activity or resource → SCORM package → Add**.

New portal components: `src/courses/MoodleBackup.tsx`, `src/courses/MoodleCourse.tsx`, and `src/connect/WebServices.tsx`. Existing course, publish, connection and DTO files wire them in. The existing portal test fixture gained `webServices: null`; no new tests or changes under `tests/` were authored.

## Self-check results

- `npm ci`: passed, zero audit vulnerabilities.
- `npm run check`: passed after the final integration merge; **46 test files, 653 passed, 5 skipped**. Existing Fastify router-option deprecation warnings remain.
- `npm run build`: passed after the final integration merge.
- `git diff --check`: passed.
- Axe: **zero violations across 19 states**, including desktop and 390 px mobile views. Mobile course and connection pages have no horizontal overflow. Screenshots were visually inspected.
- `npm run stack:doctor`: all checks OK after the final merge and recreation, with `COURSE_FIXTURES_DIR=/Users/quangnguyen/Workspaces/personal/cogniate_moodle_integration_prototype/docs/raw/data/courses`.

The isolated stack is `COMPOSE_PROJECT_NAME=cogniate-codex`, `PUBLIC_PORT=9443`, `STACK_SUBNET=172.30.0.0/16`. Its services were recreated after both integration merges. `npm run stack:up` started the updated host Build Runner. The default profile is restored and no test knobs are active.

## Live browser evidence

All real operations used Chrome and the seeded local accounts. No token or password is in committed evidence.

| Check | Result | Evidence |
| --- | --- | --- |
| **AC-T8-10** | Self-check passed: without web services there is no checkbox; with a saved token the checkbox appears; publish shows a link to the newly created Moodle course. | `evidence/t8-live.json`, `t8-publish-no-token.png`, `t8-publish-with-token.png`, `t8-published-course.png` |
| Real SCORM backup | Built from **Build Your First Website with AI**, then downloaded through the portal. File size **23,171,327 bytes**, matching the ready response. The file is a readable Moodle backup archive. | `t8-backup-queued.png`, `t8-backup-ready.png`, `t8-live.json`; local download `.tmp/t8-course.mbz` (not committed) |
| Polling | Running step is shown; build button is disabled while active; polling stops at ready. | `t8-backup-running.png`, `t8-final.json` |
| Real build failure | With `BUILD_RUNNER_FAIL_AT=backup`, the exact server reason appears, the download link is absent, and the build button is enabled again. Defaults were restored and a later build reached ready. | `t8-backup-failed.png`, `t8-live.json` |
| Web services | Invalid token returns `422 WS_TOKEN_INVALID` and displays the server description. The seed product token returns site `Cogniate_Dev_Moodle`, release `5.2.4 (Build: 20261005)`; the password input clears. | `t8-web-services-error.png`, `t8-web-services-saved.png`, `t8-live.json` |
| Hidden shell | First publish returned `created`, course id `4`, idnumber `cogniate:crs_q-p7ydMz1N2BWqheGwMpow:default:en`. The returned link opened Moodle. A product web-services read confirmed `visible=0`. Second publish returned `exists`. | `t8-hidden-course.png`, `t8-published-exists.png`, `t8-live.json` |
| HTML | No build button. | `t8-html-no-build.png` |
| Teacher path and mobile | Updated paths visible; result focus and mobile layout passed. | `t8-final-course.png`, `t8-mobile-*.png`, `t8-final.json` |

Error rendering was also checked with browser-intercepted responses for a failed course shell, `409 MBZ_BUILD_LIMIT`, and `502 MOODLE_WS_ERROR`. These are **simulated responses**, not claims of live backend failures. The exact supplied server text appeared; the failed shell had no link. Evidence: `t8-shell-failed.png`, `t8-live.json`, `t8-final.json`.

## SDK and path-guard evidence

Fresh real Moodle student and teacher launches were captured locally. The existing external smoke script ran with:

```sh
COMPAT_TESTS_DIR=/tmp/t3c-r3-smoke \
COMPAT_INPUT_FILE=/Users/quangnguyen/Workspaces/personal/cogniate_moodle_t6/.tmp/t8-sdk-input.json \
npm run test:compat
```

The installed **ltiaas 0.0.4** SDK passed idtoken, deep-link form and message with default URL, encoded score POST, encoded score GET with `user_id`, and memberships. Moodle returned **87/100**. Evidence: `evidence/t8-sdk-smoke.json`.

A separate script imported the real guard and decoder. Six single/double-encoding path-delimiter cases were refused; valid single and SDK double encoding were accepted. Evidence: `evidence/t8-path-guard.json`. The scripts and captured launch credentials stay outside `tests/` and outside git.

## Commits and integration

- `b9b5bdb` — `T6: show the first-launch hint only while registered`.
- `cd64ef1` — `T3c: mark SDK tolerances and reject encoded path delimiters`.
- `1029ae0` — merge updated native-channel and teacher-step contracts.
- `b0af68f` — merge the stack-scoped Build Runner cleanup and the latest integration branch (`8b4442b`, including backend fix `a101701`).
- The T8 portal commit includes this report, portal code and evidence. Its SHA is in the worker completion message.

The Lead requested the integration merges. They import the other owners' docs, tests and backend work; Author-2 did not edit those files. No push was made.

## Gaps and remaining work

No blocking portal API gap remains. Two observations were sent to the Lead and resolved upstream:

1. The Architect confirmed that download serves the newest **ready** backup of an immutable version, even if a later build fails or waits (`cf64467`). The portal shows the download only when the current build response includes its ready URL.
2. The old runner startup sweep could remove another stack's build. The backend Author fixed ownership with `org.cogniate.stack` (`a101701`). That fix is merged here; this stack was recreated and the new runner is running.

Independent QA and the two reviews still own acceptance and completion. MoodleCloud restore, native Moodle SCORM completion and gradebook checks remain in backend/QA scope; this portal self-check does not claim them.
