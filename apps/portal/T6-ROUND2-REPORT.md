# T6 round 2 — author report

Date: 2026-10-18. Branch: `feat/t6-portal-ui`. No push was made. This report replaces the obsolete T5-unavailable statements in the earlier T6 reports. It is an author self-check; independent review and QA remain required.

## Commits and scope

- `f6a2abf` — exact wizard steps, server-owned results/errors, Tailwind primitives, component split, and component checks.
- `e126a43` — coordinator-approved merge of upstream `0d1e169`, including T5b, T8 and the connection `lastError.title/action` fields.
- `00ce707` — coordinator-approved merge of upstream `9533b5b`, including the clarified T6 badge labels.
- `0f7024b` — `Waiting for Moodle` / `Disconnected` coverage and tab focus lint fix.
- The commit containing this report adds only this report and `evidence/round2-*` artifacts.

All authored changes are under `apps/portal/`. No root package or lockfile change was needed. No backend, `tests/`, or `docs/` file was authored or conflict-edited; the two approved merges imported those owners' changes unchanged.

## Finding status

| Finding | Status and result |
| --- | --- |
| B-T6-01, MAJOR | Fixed. `moodle-steps.json` matches the task's complete JSON object, including IDs, text, paths, labels and booleans. Only `choose-register-new` is optional. All steps have `data-step-id`; `{libraryName}` is substituted as text. All six dynamic steps stay visible after registration, including `edit-tool-settings`. The real Moodle check below followed all six. |
| B-T6-02, MINOR | Fixed. `styles.css` is 267 lines, down from 1,129; it contains theme variables and base element styles, with no custom class rules. Tailwind utilities style the pages. Small Button, Card, Badge, Dialog, Input/Select/Textarea, Tabs and Notice primitives live in `src/ui/`. ConnectionSetup is 97 lines and CourseDetail is 105 lines, with separate forms, steps, status, package and publication components. |
| B-T6-03, MINOR | Fixed. Removed the unavailable branches, refresh cache and client grade comparison. Results renders server `gradebook` and `gradebookDiffers`, including null grade scores. Resend renders the returned sync status. ErrorNotice uses server message/description, `details.action`, and reason title/action/path. ConnectionError uses `lastError.title/action`; the legacy Pending-tool fallback imports the shared helper. |
| A-T6-01, NIT | Fixed. Results, Resend and Refresh preserve server errors for real 404/409/501 responses. No response becomes “not available yet.” Saved rows remain visible after an action error. |
| B-T6-04, NIT | Fixed `1 try`, unique dialog title IDs, and the locally reconstructed reject sentence. Kept the exact multi-action step texts because this dispatch requires them verbatim. Kept reports/evidence and the portal server test in their existing locations because moving them would cross the permitted ownership boundary. Kept the existing decorative copy because this dispatch requires the current look to stay the same. |
| Follow-up badge criteria | Fixed. A pending connection with a valid registration URL reads `Waiting for Moodle`; a disabled connection reads `Disconnected`. Expiry and registered/connected states retain their specified labels. |

The theme uses the supplied dev-portal variables from `.research_cache/dev-portal-app.css` in the main checkout. Five named portal overrides preserve the reviewed text contrast, sidebar surfaces and accessible button gradient. Fonts remain local. There is no CDN, runtime CSS-in-JS, new dependency or new style configuration.

## Checks

- `npm ci && npm run check && npm run build`: passed on the final source. 46 test files; 638 tests passed; 5 existing skips. `check` includes type checking, lint and unit/component tests.
- Component checks cover exact task JSON, the registered wizard's settings step, server error text and escaping, server-owned gradebook state replacing older refresh values, real Resend response handling, badge states and focus behavior.
- `git diff --check`: passed.
- Portal production build: JS 336.32 kB (gzip 103.57 kB), CSS about 32.9 kB (gzip 8.1 kB).
- Axe: zero violations on all nine equivalent screens: Integrations, new connection, dynamic wizard, manual wizard, courses, package report, publish dialog, Results not-found, and live Results. The last two replace the obsolete “service unavailable” and mocked Results screens. The real failed and resent Results states also have zero violations.
- Keyboard checks: category tabs support arrows and Home; wizard Escape returns focus to its opener; Dialog wraps Tab/Shift+Tab and returns focus on Escape.

See [round2-self-check.json](evidence/round2-self-check.json) and [round2-live.json](evidence/round2-live.json).

## Live Moodle check

Only the isolated stack was used: `COMPOSE_PROJECT_NAME=cogniate-codex PUBLIC_PORT=9443 STACK_SUBNET=172.30.0.0/16`. It was recreated after the backend merge. The later merge changed docs and QA files only. Existing data volumes were kept. The stack remains running for review.

Using Chrome through Playwright, with real HTTP responses:

1. Create the dynamic connection `T6 round 2 dynamic` in the portal.
2. In Moodle, use Site administration → Plugins → Activity modules → External tool → Manage tools.
3. Paste the portal registration URL and click **Add LTI Advantage**.
4. Moodle showed its existing-tool choice; click **Register as a new external tool**.
5. Check the site and library in the Cogniate panel and click **Connect**. The portal reached `Registered — activate in Moodle` in **4,322 ms**, without a reload.
6. Click **Activate**, then **Edit** on that tool. Set **Tool configuration usage** to **Show in activity chooser and as a preconfigured tool** and **Default launch container** to **New window**. Click **Save changes**, reopen Edit and verify both values persisted.
7. Publish the real SCORM course `Build Your First Website with AI` to the new connection. As the Moodle teacher, choose **Cogniate (Thanh's Library)** from the activity chooser and use the real course picker. Save the resulting course activity.
8. As `cg_student2`, click the activity. A new browser page opened and reached the player at `https://app.cogniate.test:9443/play/...`; no embedded-player fallback was needed.
9. For a real failure, temporarily unenrol this learner from Course 102 through Moodle's manual-enrol plugin API after launch. Complete the open course by visiting its lesson, choosing the correct answer, scrolling to the end and waiting for its own completion timer. The real attempt became Passed 100; Moodle rejected the grade with `400 PLATFORM_REJECTED_REQUEST` and the portal showed Failed plus **Resend**.
10. Restore the student's enrolment through the same Moodle plugin API. Click **Resend** in the portal: HTTP 200, returned status `pending`, then polling showed `sent`. Click **Refresh from Moodle**: the server returned **100 / 100**, with `gradebookDiffers: false`.

No result, attempt or score-sync record was inserted or patched. No network route was mocked. The learner enrolment was restored and verified. The temporary browser scripts and session files remain ignored under `.tmp/`; committed artifacts contain no credentials, cookies, registration capabilities, runtime capabilities or play-session URLs.

Recorded IDs: connection `con_7Xk8qX-zy77Vdc7KMpoMBQ`; Moodle tool `3`; Moodle activity `6`; publication `pub_oJSp8cE-ejhv-R89Hgv06w`.

## Screenshots

- Integrations: [before](evidence/round2-integrations-before.png), [after refactor](evidence/round2-integrations-after.png), [final connected state](evidence/round2-integrations-final.png).
- Wizard: [before](evidence/round2-wizard-before.png), [after, with all six steps](evidence/round2-wizard-after.png), [final state](evidence/round2-wizard-final.png).
- Real Moodle [tool settings](evidence/round2-moodle-tool-settings.png) and [player in the new window](evidence/round2-player-new-window.png).
- Real Results [failed with Resend](evidence/round2-results-failed.png) and [resent with refreshed Moodle grade](evidence/round2-results-resent.png).

The paired refactor screenshots were taken in the same pending state before the late badge-label clarification. The Integrations image size remains 1440 × 1183, with 1,003 changed pixels out of 1,703,520 (0.059%) and unchanged grid geometry. The final snapshots show the later live connection state. Registration URLs are redacted in screenshots.

## Remaining work outside this dispatch

- At the integrated backend base, `REGISTER_ERRORS.UPDATE_NOT_ALLOWED` still says “Register as a new tool.” The portal faithfully renders that server action; its wizard uses the correct “Register as a new external tool.” This was reported to the coordinator, who assigned the backend owner and directed T6 to finish without waiting for that fix.
- Independent review and QA must confirm this author evidence. No required portal behavior or live Resend check remains unverified.
