Verdict: PASS
Round: 1

# T6 QA verification

| Item | Value |
| --- | --- |
| SHA | `1639c7ee06d741408b234618255714f877d835c7` (T6 round 2 by Author-2 (Codex), T3c rounds 2 and 3, T8 backend round 1; QA tests) |
| Spec | `tasks/T6.md` at this SHA: badges "Waiting for Moodle", "Link expired", "Registered — activate in Moodle", "Connected", "Disconnected"; the exact `moodle-steps.json` with `edit-tool-settings`; AC-T6-06 with the server reason `title` and `path`; AC-T6-14 with fresh rows from the T5b recipes. App contract §2–§5 (`lastError` with `title` and `action`). |
| Scope | All 14 T6 ACs. T6 reads T5 result rows, so each full run is `--tasks T5a,T5b,T6` on one stack (T5a and T5b ran again and passed: a regression check of T5 on this SHA). |
| Tests used | The SHA tests plus the QA-side changes in section 3 (`--replace-tests`). The Lead can commit `tests/**`. |
| Runner | `COMPOSE_PROJECT_NAME=qa-t6-r1 PUBLIC_PORT=8443 STACK_SUBNET=172.29.0.0/16 node tests/host/run-t5.mjs --sha 1639c7e… --tasks T5a,T5b,T6` (`npm run build` before `stack:up`; the host channel answers the `lti-service` restart of the AC-T6-14 conflict recipe). Run 3: `--tasks T6 --only AC-T6-04,AC-T6-05,AC-T6-12` (new stack, T6 folder only). |
| Isolation | Each run used a new stack, removed with its volumes and networks. QA did not touch `cogniate-stack`, `cogniate-codex` or `qa-e2e-r1`. Clean-up names only `qa-t6-r1`. |
| Evidence roots | `R1` = `tests/host/artifacts/qa-t6-r1-1639c7ee-2026-10-19T02-24-33-878Z/` (run 1: QA defects), `R2` = `…T02-41-02-026Z/` (run 2: 12 of 14), `R3` = `…T02-55-37-427Z/` (run 3: AC-T6-04, -05, -12). |

## 1. Results per acceptance criterion

| AC | Result | What QA saw | Evidence |
| --- | --- | --- | --- |
| AC-T6-01 | PASS | Title, subtitle, five pills, ≥ 9 cards in 3 columns at 1440 px, the Moodle card text. `GET /app-api/connections`: 2 connections, the newest is `pending` with a valid link → the card shows "Waiting for Moodle", "Manage" and "Connect another site", and no "Connect". | `R2` |
| AC-T6-02 | PASS | `body` background `rgb(11, 10, 15)`, active pill `rgb(166, 103, 228)`, `font-family` starts with "DM Sans", cards `12px`. Screenshot attached next to the reference. | `R2` |
| AC-T6-03 | PASS | No request leaves `PUBLIC_APP_URL` while sign-in and Integrations load. | `R2` |
| AC-T6-04 | PASS | The registration URL matches AC-T4-07; the copy button puts it on the clipboard. "Waiting for Moodle" before the registration. After the admin registers in a second page (Moodle showed the "update or register new" page in `R2`, not in `R3`; QA chose "Register as a new external tool"), "Registered — activate in Moodle" within 10 s, no reload. | `R2`, `R3` |
| AC-T6-05 | PASS | The 16 rows of §4.1 in order with `data-key`; each copy button gives the row `value`. The six inputs have `name` = the contract keys. `http://moodle.test` as issuer and a JWKS URL on `evil.test` → inline error, the connection stays `pending`. Valid values from a new manual Moodle tool → "Registered" (API status `registered`). | `R3` |
| AC-T6-06 | PASS | Slow network (CDP): `role="progressbar"` with `aria-valuenow` 0 → 100 in 59 rising steps; then the report with "SCORM 1.2", "Mastery score 70" and the S3 host warning. The `PATH_TRAVERSAL` zip: the API gives the reason `title` "The package has an unsafe file path" and `path` `../evil.html`; the UI shows both; no version. | `R2` |
| AC-T6-07 | PASS | The Publish dialog lists only registered or connected connections (not QA's `pending` one); after "Publish", "Available in Moodle" and the teacher text. | `R2` |
| AC-T6-08 | PASS | SCORM results: `cg_student` "Passed 100" and "Sent"; `cg_student2` "Passed 100" (best of failed 0 and passed 100) and "Sent". "Refresh from Moodle" fills the gradebook column with 100. | `R2` |
| AC-T6-09 | PASS | axe: no `serious` or `critical` violation on Integrations, the wizard, Courses, the Publish dialog (a native `<dialog>`) and Results. Keyboard only: the dialog opens with Enter, closes with Esc, and focus returns to its opener. | `R2` |
| AC-T6-10 | PASS | Signed out, every route goes to `/signin`. "Logout" → `GET /app-api/me` 401. | `R2` |
| AC-T6-11 | PASS | "Download SCORM package" gives a file with the SHA-256 of the uploaded zip; the HTML course has no such button. | `R2` |
| AC-T6-12 | PASS | `moodle-steps.json` equals the block in `tasks/T6.md` (deep equal). Both wizard methods show each step with `data-step-id` = `id` and the step text with `{libraryName}` = "QA Library B". Dynamic: `open-manage-tools`, `paste-registration-url`, `choose-register-new` (`optional: true`, "Register as a new external tool"), `confirm-connect`, `activate-tool`, `edit-tool-settings` (with the two Moodle settings). Manual: four steps. | `R3` |
| AC-T6-13 | PASS | `<b>x</b>` and `<img src=x onerror="window.__xss=1">` show as literal text in Courses, Publish and Results; `window.__xss` stays undefined. | `R2` |
| AC-T6-14 | PASS | Fresh rows from SETUP-T6 (the AC-T5-31, -32 and -33 recipes on own activities). The conflict row shows "Moodle has a grade with a newer time" and "Resend". The failed row (learner unenrolled) shows the error and "Resend"; after QA enrols the learner again (UI), "Resend" → "Pending" → "Sent" with no reload. After "Refresh from Moodle", the override row shows "Moodle keeps another grade, for example a teacher override". Its sync history lists both syncs (`Sent · 0 / 100`, `Sent · 100 / 100`). | `R2` |

T5a (21 ACs and the knob pass) and T5b (14 ACs and the round 2 checks) also passed in `R1` and `R2`.

## 2. Findings

No product findings. The Lead's known item (the `UPDATE_NOT_ALLOWED` page text "Register as a new tool") was not seen: no T6 AC chooses "update" in Moodle. The wizard step text already says "Register as a new external tool".

## 3. QA-side changes (tests only)

1. AC-T6-01, -04: the badge texts of the updated T6.md ("Waiting for Moodle", "Disconnected"); "Waiting for Moodle" before the registration.
2. `portalSignIn`: if the context is already signed in (`/signin` then redirects into the app), keep the session of the same user, else drop the app cookies first (`R1` AC-T6-05 found no sign-in form).
3. AC-T6-06: the upload hint "Use a SCORM 1.2 or HTML zip" also contains "SCORM 1.2", so the progress loop stopped at the first value (`R1`). The loop now stops on "Mastery score 70" or when the bar is gone, and the report check uses an exact "SCORM 1.2".
4. `resultsRow`: the Results view puts the course title (`activity.contextTitle`) right after the activity title with no space in the text (`Cogniate SCORMCogniate Dev Course 101`). Rows are now matched by title + context title (`R1` AC-T6-08).
5. AC-T6-14 sync history: the new UI uses a `<details>` "Sync history (n)" disclosure; QA opens it and reads it.
6. AC-T6-09: the Publish dialog is a native `<dialog>` (implicit role), so the axe `include` uses `dialog[open]` (`R1`: "No elements found for include").
7. `createManualTool`: AC-T6-04's dynamic registration and AC-T6-05's manual tool have the same Moodle name "Cogniate (QA Library B)". QA took the first card (the dynamic tool), and the app correctly refused its values with `PLATFORM_IN_USE` (the UI showed the server title, code and trace id). QA now takes the newest card with that name (`R2`).
8. `run-t5.mjs`: `--tasks T6 --only <ids>` runs the T6 folder alone (for ACs with no T5 state).

## 4. Not covered

- The connection page and card with a `lastError` (`title`, `action`, code, trace id): no T6 AC; the `PLATFORM_IN_USE` inline error in `R2` showed the same server-owned parts.
- "Link expired" and "Disconnected" badges on the card (the shared stack had no such newest connection).
- Browsers other than Chromium; viewports other than 1440 px.

## 5. Writing

This file uses Simplified Technical English where practical: short sentences, active voice, one instruction per sentence. UI texts, AC ids and error codes are kept as they are.
