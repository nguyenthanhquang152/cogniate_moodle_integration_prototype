# Troubleshooting

Find your symptom. Do the fix. The last column tells you if QA verified the fix (`AC-…` = row in `docs/reviews/<task>/qa.md`).

First step for most problems: run `npm run stack:doctor`. It prints one line per check, with `OK` or `FIX` and the fix [Not verified by QA].

More technical help: [`infra/README.md`](../../infra/README.md#troubleshooting).

## Start and stack

| Symptom | Cause | Fix | Verified by QA |
| --- | --- | --- | --- |
| `Docker is not running` | Docker Desktop is not started. | Start Docker Desktop. Wait until it runs. Run the command again. | No |
| `Port 443 on 127.0.0.1 is busy` | Another program uses port 443. | Stop that program. Or set `PUBLIC_PORT=8443` in `.env`, run `npm run gen-env`, then start again. The URLs then end in `:8443`. | Another port works: AC-T1-09, AC-T7-07 |
| `PUBLIC_* ... expected ...` | You changed `PUBLIC_PORT`. | Run `npm run gen-env`. | No |
| `This checkout has no .env, but project ... still has Docker volumes` | A new `.env` has new passwords. They do not match the old database. | Put back the old `.env`. Or run `npm run stack:reset` (this deletes the local data). | No |
| `The stack is not healthy` | A service did not start in 300 seconds. | Run `npm run stack:logs -- moodle`. Then start the stack again. | No |
| Moodle shows error 502 just after a start | Moodle is not ready yet. | Wait until the Moodle login page loads. | Seen by QA (T5b qa.md §4) |
| `fixtures:check` fails | A course zip is missing or changed. | Put the two original zips in `docs/raw/data/courses/` (decision Q15). | LC-T1-06 |
| Your daily browser cannot open `*.test` addresses | These names exist only for the local stack. | Use `npm run demo:browser`. Or see "Your own browser" in `infra/README.md` first. | No |

## Moodle pages

| Symptom | Cause | Fix | Verified by QA |
| --- | --- | --- | --- |
| A Moodle tour ("Activate edit mode") covers the page | First visit to edit mode. | Click "End tour". | Seen by QA (T7 qa.md §4) |
| You cannot find "Add an activity" | Moodle 5.2.4 has no such label. | Turn on Edit mode, then click "Add content" → "Activity or resource". See the [teacher guide](teacher.md). | AC-T7-14, finding Q-T7-02 |
| You cannot find the option "Delegate to teacher" | The Moodle 5.2.4 text is longer. | Select "As specified in Deep Linking definition or Delegate to teacher". | T7 qa.md §6 |
| Moodle asks you to update a tool or register a new one | Another tool with the same domain exists. | Click "Register as a new external tool". Cogniate refuses an update. | AC-T6-04, AC-T3-25, AC-T4-30 |
| A grade or completion seems late | Moodle cron did not run yet. | Normally not needed. Fallback: `npm run moodle:cron`. | No cron needed: AC-T7-05. The command: no. |

## Course and player

| Symptom | Cause | Fix | Verified by QA |
| --- | --- | --- | --- |
| The course opens inside the Moodle page, with a button "Open in a new window" | The tool setting "Default launch container" is not "New window". | Click the button. The admin sets "New window" (see the [admin guide](moodle-admin.md)). | AC-T4-31 |
| Error `STATE_COOKIE_MISSING` | The browser blocked a cookie inside a frame. | The admin sets "New window". | The page: AC-T2-10. The fix: no. |
| Error `HANDOFF_USED` or `INVALID_STATE` | An old launch link or form was used again. | Open the activity again from the Moodle course page. | AC-T4-24, AC-T7-10 |
| A teacher on Safari cannot add Cogniate content | Safari blocks the Cogniate cookie inside Moodle's "Select content" frame (decision Q16). | Use Chrome, Edge or Firefox to add content. | No. QA used Chromium only. |
| The lesson link on the HTML menu page does not react | A decorative layer of the HTML export covers the link (decision Q17). | Click another part of the link. | No (not checked by hand) |
| The player says that the player is not built | The player files are missing. | Run `npm run build`. | No |

## End-to-end test

If a step of `npm run test:e2e` fails, follow "Debug a failed E2E step" in [`infra/README.md`](../../infra/README.md#debug-a-failed-e2e-step).

WARNING: The test traces and the HTML report in `tests/e2e/artifacts/` hold raw secrets (passwords, cookies, tokens). Do not share them. Share the error text and a screenshot.
