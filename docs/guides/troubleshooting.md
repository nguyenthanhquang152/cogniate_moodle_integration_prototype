# Troubleshooting

Find your symptom. Do the fix. The last column tells you if QA verified the fix (`AC-…` = row in `docs/reviews/<task>/qa.md`).

First step for most problems: run `npm run stack:doctor`. It prints one line per check, with `OK`, `FIX` or `INFO`, and a fix for each `FIX` [AC-T9-01].

More technical help: [`infra/README.md`](../../infra/README.md#troubleshooting).

## Start and stack

| Symptom | Cause | Fix | Verified by QA |
| --- | --- | --- | --- |
| `Docker is not running` | Docker Desktop is not started. | Start Docker Desktop. Wait until it runs. Run the command again. | No |
| `Port 443 on 127.0.0.1 is busy` | Another program uses port 443. | Stop that program. Or set `PUBLIC_PORT=8443` in `.env`, run `npm run gen-env`, then start again. The URLs then end in `:8443`. | Another port works: AC-T1-09, AC-T7-07 |
| `PUBLIC_* ... expected ...` | You changed `PUBLIC_PORT`. | Run `npm run gen-env`. | No |
| `This checkout has no .env, but project ... still has Docker volumes` | A new `.env` has new passwords. They do not match the old database. | Put back the old `.env`. **WARNING:** A reset deletes the local Moodle site and all local Cogniate data. To start with empty data, run `npm run stack:reset`. | No |
| `The stack is not healthy` | A service did not start in 300 seconds. | Run `npm run stack:logs -- moodle`. Then start the stack again. | No |
| Moodle shows error 502 just after a start | Moodle is not ready yet. | Wait until the Moodle login page loads. | Seen by QA ([T5b qa.md §4](../reviews/T5b/qa.md#4-qa-side-changes-tests-only)) |
| `fixtures:check` fails | A course zip is missing or changed. | Make the folder (`mkdir -p docs/raw/data/courses`). Put the two original zips into it (decision Q15). | LC-T1-06 |
| Your daily browser cannot open `*.test` addresses | These names exist only for the local stack. | Use `npm run demo:browser`. Or see "Your own browser" in `infra/README.md` first. | No |

## Moodle pages

| Symptom | Cause | Fix | Verified by QA |
| --- | --- | --- | --- |
| A Moodle tour ("Activate edit mode") covers the page | First visit to edit mode. | Click "End tour". | Seen by QA ([T7 qa.md §4](../reviews/T7/qa.md#4-notes-for-the-reader)) |
| You cannot find "Add an activity" | Moodle 5.2.4 has no such label. | Turn on Edit mode, then click "Add content" → "Activity or resource". See the [teacher guide](teacher.md). | AC-T7-14, finding Q-T7-02 |
| You cannot find the option "Delegate to teacher" | The Moodle 5.2.4 text is longer. | Select "As specified in Deep Linking definition or Delegate to teacher". | AC-T7-01, [T7 qa.md §6](../reviews/T7/qa.md#6-suite-changes-after-the-reviews-round-1-addendum) |
| Moodle asks you to update a tool or register a new one | Another tool with the same domain exists. | Click "Register as a new external tool". Cogniate refuses an update. | AC-T6-04, AC-T3-25, AC-T4-30 |
| The Cogniate panel says "Moodle may have saved a Pending tool" | Moodle answered slowly during "Connect". | In "Manage tools", delete the pending tool "Cogniate (<library>)". Connect again with the same URL. | Message: [P1, final T4b1 QA](../reviews/T4b1/qa.md#replacement-qa-final-regression--2026-10-19). Manual cleanup and URL reuse: not verified. |
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

## Canvas and Blackboard

Source: commit `e2d58e9` (candidate C = `d3296dd`), 2026-10-22. Status: **draft**. The last column gives the evidence label; the [evidence table](../../README.md#evidence-labels) gives its status. Nobody has tested these fixes on a real Canvas or Blackboard site.

"Operator" means Cogniate staff ([operator guide](operator.md)). The operator reads the service logs in `infra/.logs/`.

### Portal: connect and Save

| Code and text | Cause | Fix | Evidence |
| --- | --- | --- | --- |
| `INVALID_SITE_URL` rule 1: "Enter only the address, … No path." | The URL has a path, a query, a fragment, user info, or is not https. | Enter only `https://` and the host. | `[SIM AC-M2-03]` |
| `INVALID_SITE_URL` rule 2: "Enter a host name, not an IP address or localhost." | An IP address, `localhost` or a `.localhost` name. | Enter the DNS name of the LMS. | `[SIM AC-M2-03]` |
| `INVALID_SITE_URL` rule 3: "This is a Cogniate address. …" | The URL is a Cogniate service address. | Enter your LMS address. | `[SIM AC-M2-03]` |
| `INVALID_SITE_URL` rule 4: "This is the LMS sign-in service, not your school site. …" | The URL is a fixed provider host, for example the Canvas sign-in host. | Enter the address that teachers use. | `[SIM AC-M2-03]` |
| `INVALID_SITE_URL` rule 5: "This is an Instructure-hosted address. …" | A self-hosted Canvas type with an `instructure.com` or `canvaslms.com` host. | Select an Instructure-hosted Canvas type. | `[SIM AC-M2-03]` |
| `GRANT_INVALID`: "This approval code is not valid, was used, or expired. …" | Wrong, used, expired or revoked code, or a code for another connection or library. | Ask the operator for a new code. | `[SIM AC-M2-05, AC-M1-29]` |
| `GRANT_MISMATCH`: "The values do not match the approval. …" | A marked field differs from the approved value. | Correct the marked field. Or ask the operator for a code with the right values. | `[SIM AC-M2-05, AC-M2-06]` |
| `GRANT_IN_USE`: "Cogniate is already saving this connection. …" | Another Save of this connection is still running (at most 60 seconds). | Wait a moment, then reload the page. | API code: `[SIM M1-37.canvas.f]`. Portal text: Not verified by QA. |
| `PLATFORM_IN_USE`: "This Canvas developer key is already connected to Cogniate. …" | Another connection uses this developer key, or one key serves many schools (D-5). | Make a new developer key for this library. For a self-hosted Canvas after a release, see the next row. | `[SIM AC-M2-05]` |
| `PLATFORM_IN_USE` after an operator release (self-hosted Canvas only) | A Moodle connection took the freed issuer and client ID first (D-12). It can block setup. It gives no Canvas access: check 14 refuses its Canvas launches before storage. | The operator suspends and releases that connection, then repeats the order: grant, suspend, release, redeem at once. Prompt redemption makes the window short; it cannot close it. An enterprise service needs a reserved-identifier or quarantine design first (D-12). | `[SIM M1-39.canvas.residual-race, M1-39.canvas.operator-order]` |
| `DEPLOYMENT_IN_USE`: "This Blackboard site is already connected to Cogniate." | Another connection holds this Deployment ID. | Ask the operator. If that binding is wrong, the operator suspends and releases it. | `[SIM AC-M2-06, AC-M1-29]` |
| `DEPLOYMENT_FIXED`: "This connection already reserved another Blackboard deployment. …" | This Blackboard connection holds another Deployment ID. | Disconnect it, then make a new connection. | Portal text: Author unit test only, not verified by QA. CLI refusal: `[SIM AC-M1-29]` |
| `PROVIDER_NOT_READY`: "This LMS setup is not ready in Cogniate. …" | The Blackboard shared setup is missing or changed, or the connection has no provider snapshot. | The operator reads `provider_not_ready {cause}` in the app log. Then: try again later, or make a new connection. | `[SIM AC-M2-05, AC-M2-06, AC-M1-29]` |
| `LTI_SERVICE_ERROR`: "Cogniate could not save the connection. Try again. Trace id: …" | The LTI service did not answer. | Click "Save" again with the same code. | `[SIM AC-M2-05, AC-M2-06]` |
| `CAPABILITY_NOT_SUPPORTED` | A Moodle-only feature: dynamic registration, web services, empty Moodle course. | Not available for Canvas or Blackboard. | `[SIM AC-M1-15, AC-M1-21]` |

### Launch pages (learners and teachers)

| Code and text | Cause | Fix | Evidence |
| --- | --- | --- | --- |
| `SERVICE_ORIGIN_MISMATCH`: "The {LMS} address in this launch is not the address saved in Cogniate. …" | A launch URL is not on the saved host. The log line `launch_check_failed` has `detail: "claim=<name> host=<origin>"`. | `claim=dl_return`: the host must be the site URL (the page host). `claim=ags_…` or `nrps`: the host must be the Canvas service URL. If the saved value is wrong, the operator suspends and releases the binding. Then the library makes a new connection with the right value and a new grant. | `[SIM AC-M1-12, AC-M1-32, M1-38.canvas.f]` |
| `SERVICE_ORIGIN_MISMATCH` with `claim=dl_return` from a second page host | Teachers used a third Canvas host for Deep Linking (D-2). | Add content through the saved Canvas URL. | `[SIM AC-M1-40]` |
| `DEPLOYMENT_NOT_ACTIVE`: "The connection to this {LMS} site is switched off. …" | The connection was disconnected or suspended. | A new connection needs a new approval, new publications and new course items. Old items stay unavailable. | `[SIM AC-M1-18, AC-M1-27, AC-M1-38]` |
| `UNKNOWN_DEPLOYMENT` | The launch comes from a deployment without an approved binding, for example a second Canvas install. | Canvas: add the deployment ID with an approval code ([Canvas guide](canvas-admin.md#add-a-second-deployment-id)). Blackboard: finish the setup. | `[SIM AC-M1-13, AC-M1-20]` |
| `PROVIDER_PROFILE_MISMATCH`: "This {LMS} site is connected to Cogniate in the wrong way. …" | A Canvas or Blackboard site was connected as Moodle. No claim is stored. | Connect it as Canvas or Blackboard in the portal, with an approval. If the Moodle connection blocks the right one, the operator suspends and releases it. | `[SIM AC-M1-39]` |
| `ISSUER_RESERVED` | A Moodle connection used a hosted Canvas or Blackboard issuer. Nothing is stored. | Connect it as Canvas or Blackboard. | API: `[SIM AC-M1-03]`. Registration page text: Not verified by QA. |
| `UNKNOWN_PLATFORM` on a Canvas or Blackboard launch | The site or service URL in the launch differs from the connection, or the LMS type differs. The log has `reason: site_mismatch` or `lms_mismatch`. | The operator compares the logged hosts with the connection. Correct as for `SERVICE_ORIGIN_MISMATCH`. | `[SIM AC-M1-22, AC-M1-39]` |
| "This course is not available" | The item belongs to an old connection that was replaced. | Add the course again under the new connection. | `[SIM AC-M1-38]` |
| A teacher cannot add content, or the state cookie is missing, in an LMS frame | The browser blocks the cross-site cookie in the frame. This depends on the browser, its version and its settings. | Try Chrome, Edge or Firefox; QA used Chromium only (Q16). In Canvas, keep "Load This Tool In A New Tab" on for learners. | `[SIM M1-34.canvas.cloud-no-cookie; L-C10, L-B10 UNVERIFIED]` Not yet tested on a real Canvas site. Not yet tested on a real Blackboard site. |
| A pending grade row turns `failed` with `CONNECTION_DISABLED` | The connection was disconnected or suspended. | Resend is refused. The LMS gets no score from this connection. | `[SIM AC-M1-18, AC-M1-38]` |
| A Canvas grade row is `failed` after a better score | The assignment allows only one attempt. | Keep "Allowed Attempts" unlimited ([teacher guide](teacher.md#canvas)). | `[SIM AC-M1-33]` |

For storage lock messages (`operation_in_progress`, `storage_writer_active`, `operation_lock_invalid`, `storage_lock_lost`), see the [operator guide](operator.md#43-storage-lock-messages).

## End-to-end test

If a step of `npm run test:e2e` fails, follow "Debug a failed E2E step" in [`infra/README.md`](../../infra/README.md#debug-a-failed-e2e-step).

WARNING: The test traces and the HTML report in `tests/e2e/artifacts/` hold raw secrets (passwords, cookies, tokens). Do not share them. Share the error text and a screenshot.
