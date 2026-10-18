Verdict: PASS
Round: 2

# T5b QA verification

| Item | Value |
| --- | --- |
| SHA (round 2) | `edb99c9f0cb44c9fde5cc723f89cd447d1f757ad` (T5b round 2 `80f8581`, T6 portal, T7 work in progress, T3c merged; QA tests) |
| SHA (round 1) | `185e0f2498b32427f754517bcb6f1f1122e66e10` (T5b code `64c101f`; QA tests) |
| Spec | `tasks/T5b.md` (14 ACs, recipes AC-T5-31 to -33, QA run order) and app contract §5, §7, §12 at `8f3bc6e` (late `finish`/`unload` with `stale: true`, Resend guard, `gradebook_refresh_failed`, no `Cookie` to the content host); ADR-010 rules 5 and 10; `seq` rule at `4d99eab` |
| Scope | All 14 T5b ACs (AC-T5-09, -36, -10, -11, -27, -28, -29, -14, -30, -31, -32, -33, -18, -19), the round 2 items (A-T5b-01 cookies, A-T5b-02 Resend never lowers a grade, B-T5b-01 refresh stores only the learner's own grade), and a T5a regression (all 21 T5a ACs and the `PLAY_TTL_SECONDS` knob pass, because T5b changed attempts, score syncs, results, worker, content host, player runtime and Caddyfile). |
| Tests used | The SHA tests plus the QA-side changes in section 4 (`--replace-tests`). The Lead can commit `tests/**`. |
| Runner | `COMPOSE_PROJECT_NAME=qa-t5b-r2 PUBLIC_PORT=8443 STACK_SUBNET=172.29.0.0/16 node tests/host/run-t5.mjs --sha <sha> --tasks T5a,T5b` (T5a pass, knob pass, T5b pass). During the T5b pass the runner answers the test host actions: `docker compose stop moodle`, `docker compose start moodle` (AC-T5-14, -30) and `npm run stack:restart -- lti-service` (AC-T5-31). Round 1 used the project `qa-t5b-r1`. |
| Isolation | Each run used a new stack, removed after the run with its volumes and networks. QA did not touch `cogniate-stack` or `cogniate-codex`. One incident: before the focused round 2 re-run, a QA clean-up command used the pattern `^qa-` and so also named the volumes and network of `qa-e2e-r1` (the new QA-E2E stack). Docker refused each removal, because the stack was running. Nothing was removed. QA clean-up now names only its own projects. |
| Evidence roots | Round 2: `S1` = `tests/host/artifacts/qa-t5b-r2-edb99c9f-2026-10-18T14-26-39-251Z/` (full run), `S2` = `…/qa-t5b-r2-edb99c9f-2026-10-18T14-38-32-719Z/` (focused AC-T5-10 re-run after a QA test fix). Round 1: `R1` = `…/qa-t5b-r1-185e0f24-2026-10-18T06-46-22-625Z/`, `R2` = `…/qa-t5b-r1-185e0f24-2026-10-18T06-55-12-613Z/`. |

## 1. Round 2 results per acceptance criterion (`edb99c9`)

| AC | Result | What QA saw | Evidence |
| --- | --- | --- | --- |
| AC-T5-09 | PASS | `cg_student`, "Cogniate HTML": menu page, lesson page ≥ 11 s and scroll to the end, correct option. The runtime reads `body[data-lesson-id]`. Within 60 s Moodle shows 100 and completion done; the row is `passed`/100 with one `sent` sync. | `S1` |
| AC-T5-36 | PASS | Own activity. Every non-`*.test` request hangs (no answer); the hung requests are the S3 images and icons of the course. `cg_student` completes the course → `passed` and 100 in Moodle within the same deadline. | `S1` |
| AC-T5-10 | PASS | For each of the 7 files of the HTML zip (up to `lyra.mp4`, 10,721,508 B), SHA-256 of `GET /pkg/<id>/<path>` = SHA-256 of the zip entry. | `S1` |
| AC-T5-11 | PASS | `cg_student2` sees only the menu page and closes the window → no grade in Moodle; row `in_progress`, `scoreSyncs: []`. | `S1` |
| AC-T5-27 | PASS | `cg_student2`, a new run, a wrong option, all pages → Moodle 0; row `failed`, one `sent` sync. | `S1` |
| AC-T5-28 | PASS | Own activity: a wrong option, then the correct one, then the pages → `failed`, score 0. | `S1` |
| AC-T5-29 | PASS | Own activity: the learner answers, scrolls to the end and closes the window before 10 s → `in_progress`, no sync. | `S1` |
| AC-T5-14 | PASS | Own activity, run live. Moodle is stopped through the host channel; the learner passes; the row is `pending` with `tries ≥ 1`. QA starts Moodle 1 s after the row was made. Within 3 min the row is `sent` and Moodle shows 100. | `S1` (`cmd/`, `container-T5b/control/`) |
| AC-T5-30 | PASS | Own SCORM activity, run live. Moodle stopped; the learner passes (row 1 `pending`, 100); a `failed`/0 final commit in a new session (200, 200); Moodle started → Moodle 100, row 1 `sent`, no row with 0 is `sent`. | `S1` |
| AC-T5-31 | PASS | Own activity, run live with the recipe: QA score 10 with `timestamp` now + 10 min (204, Moodle 10), `lti-service` restart, then `cg_student2` passes → the row is `conflict` with `tries` 1 and `lastError` `PLATFORM_CONFLICT`. `tries` stays 1 for the 2 min window (polled every 10 s). Moodle stays 10; best `passed`. | `S1` |
| AC-T5-32 | PASS | Run live with the recipe. Resend of the AC-T5-31 `conflict` row within its 10 min → 200, then `conflict` again. "Cogniate HTML 102": QA unenrols `cg_student2` (UI), the learner passes → `failed` at once (`tries` 1, `PLATFORM_REJECTED_REQUEST`). QA enrols the learner again (UI); Resend → 200 with `pending`, `tries` 0; then `sent` and Moodle 100. Resend of the `sent` row → 409 `SYNC_NOT_RESENDABLE`. | `S1` |
| AC-T5-33 | PASS | Own SCORM activity: a wrong option (Moodle 0, `sent:0`). `cg_teacher` overrides the grade to 50 in the grader report (UI). A better final result in a new session → a new `sent:100` row; Moodle still shows 50 (overridden). After Refresh: `gradebookDiffers: true`, `resultScore` 50. | `S1` |
| AC-T5-18 | PASS | `POST …/results/refresh` for both publications. Every learner row has `gradebook.resultScore` = the Moodle grade (QA oracle, the right course for each activity), with `resultMaximum` 100. Named values: "Cogniate SCORM" 100 and 100; the AC-T5-33 activity 50 (differs). | `S1` |
| AC-T5-19 | PASS | `cogniate-app.jsonl` and `cogniate-content.jsonl` contain none of the 85 values that QA captured in this run (ltik, runtime token, service key). | `S1` |

### Round 2 items

| Item | Result | What QA saw | Evidence |
| --- | --- | --- | --- |
| A-T5b-01: 5–10 cookies of 4 KB on the content origin | PASS | Three oracles. (1) Node, HTTP/1.1, one joined `Cookie` header: 5 and 10 cookies of 4,000 characters → `GET /pkg/<id>/index.html` 200 with the same bytes as the zip entry. (2) Chromium top-level request with 10 such cookies: protocol `h2`, `Cookie` header 40,108 B, 200, same bytes. (3) The player in Chromium with these cookies (`SameSite=None; Secure`): the frames sent 40,108 B of cookies; all 8 content responses (`/rt`, `/_rt`, `/pkg`) were 200, and the package page loaded. | `S2` |
| A-T5b-02: Resend never lowers a grade | PASS | QA recipe (own SCORM activity in `COGNIATE-DEV-102`, `cg_student2` unenrolled while two final results are made): row 1 50 `failed` (`PLATFORM_REJECTED_REQUEST`), row 2 100 `failed`. After QA enrols the learner again: Resend of row 1 → 409 `SYNC_NOT_RESENDABLE`; row 1 stays `failed` with the same `tries`. Resend of row 2 → 200, `sent`, Moodle 100. Resend of row 1 again → 409. Moodle stays 100; no row with 50 is sent. | `S1` |
| B-T5b-01: refresh stores only the learner's own grade | PASS | Own HTML activity: `cg_student` passes (Moodle 100); `cg_student2` opens only the menu page (row `in_progress`, no Moodle grade). After Refresh: `cg_student` 100, `cg_student2` `null` (not 100). Every HTML row equals that learner's Moodle grade. | `S1` |
| T5a regression | PASS | All 21 T5a ACs and the knob pass (AC-T5-15 at TTL + 3 s → 410). AC-T5-15 now also checks the new contract rule: `seq` 0 and `seq` 1.5 → 400 `INVALID_REQUEST`, `details.field` `seq`. | `S1` |

The Author covered AC-T5-14, -30, -31 and -32 only with unit tests. All four pass live here, with Moodle stopped and started and `lti-service` restarted by the host channel.

## 2. Round 1 results (`185e0f2`)

| AC | Result |
| --- | --- |
| AC-T5-09, -36, -10, -11, -27, -28, -29, -14, -30, -31, -32, -18, -19 | PASS (`R2`). In `R1`, AC-T5-30 and AC-T5-31 failed and AC-T5-32 did not run, all because of a QA defect (section 4, items 1 and 2). |
| AC-T5-33 | Not finished in round 1. Both runs stopped in QA's grader report step (section 4, items 3 and 4). The steps before the override passed. Round 2 passes it. |
| B-T5b-01 | Not reproduced: after Refresh, `cg_student2` (no Moodle grade) kept `null`, and `cg_student` kept 100. The fallback that Reviewer-B describes did not show in this setup. |
| T5a regression | PASS (all 21 ACs and the knob pass). |

QA found no product defect in round 1. The round 2 items A-T5b-01 and A-T5b-02 were not tested in round 1.

### The Author's notes for round 1

| Note | QA result |
| --- | --- |
| The HTML runtime attaches when the page is parsed and never waits for `load` | Agrees: AC-T5-36 passes while every outside image hangs. |
| Conflict → `lastError` `PLATFORM_CONFLICT`, no retry | Agrees (AC-T5-31: `tries` stays 1 for 2 min). |
| Resend only for `failed`/`conflict`, refused when an equal or better result is `sent`/`pending`, new 24 h window | Agrees (AC-T5-32: `pending`, `tries` 0; 409 for a `sent` row). The 24 h window is not visible in the API. |
| Refresh sets `gradebook`/`gradebookDiffers`; logs `gradebook_refresh_failed` per unreadable row | `gradebook` and `gradebookDiffers` agree (AC-T5-18, -33). The log event was not separately checked. |
| A late `finish`/`unload` is logged with `stale: true` | Not separately checked (AC-T5-35 in the T5a regression passes). |
| The proxy drops `Cookie` to the content host | Agrees for round 2 (A-T5b-01, three oracles). |

## 3. Findings

No product findings.

| Id | Severity | Finding |
| --- | --- | --- |
| Q-T5b-01 | NIT (spec) | ADR-010 rule 10 and the app contract (`POST /app-api/score-syncs/:syncId/resend`) refuse a Resend only when an equal or better result is `sent` or `pending`. The round 2 build also refuses it when a better row is `failed` (A-T5b-02; QA saw 409), and Reviewer-A reports the same for `conflict`. The rule text should say so, for example: "never when another row of the same learner and activity that is not `superseded` has a higher score, or an equal row is `sent` or `pending`". |

## 4. QA-side changes (tests only)

1. `hostAction('moodle-start')` now waits until the Moodle login page answers 200 with the login form. `docker compose start` returns before Moodle answers, and the proxy gave 502 for a while (round 1 `R1`: AC-T5-30 got 502 from the QA oracle; AC-T5-31 found no login form).
2. `waitForMoodle` polls again after an oracle error until its deadline.
3. `overrideGradeInUi`: after the edit mode switch, QA waits for the grade cell. A `goto` while Moodle redirected gave `net::ERR_ABORTED` (`R1`).
4. `moodleLogin` registers a Playwright locator handler that ends a visible Moodle user tour (`data-flexitour`, "End tour"). On the first visit of the grader report, a tour backdrop took the click on "Save changes" (`R2`).
5. New tests: B-T5b-01 (in `zz-refresh-logs.spec.ts`), A-T5b-02 (`6-resend-lower.spec.ts`, own activity "Cogniate SCORM A-T5b-02" in `COGNIATE-DEV-102`), A-T5b-01 (in `1-html.spec.ts`). The AC-T5-18 checks find the Moodle course of each activity (`courseOf`).
6. A-T5b-01, first version (`S1`): the cookies were `SameSite=Lax`, so Chromium did not send them in the cross-site frames (0 B), and the test failed on its own check. The fixed test uses `SameSite=None; Secure` and adds the top-level HTTP/2 oracle (`S2`).
7. AC-T5-15: `seq` 0 and 1.5 → 400 `INVALID_REQUEST`, field `seq` (contract at `4d99eab`, from Q-T5a-01).
8. `run-t5.mjs`: `--only` uses the folders of `--tasks` (so a focused run can reach T5b tests); the host channel also runs during a T6 pass (for the AC-T6-14 setup).

## 5. Not covered

- A-T5b-02 with a better row in `conflict` (QA tested the `failed` case only; a second conflict row needs another 10 min window).
- B-T5b-01 fallback path: QA found no black-box way to make that path run. The black-box result is correct in both rounds.
- The 24 h retry window after Resend, and the `gradebook_refresh_failed` and `stale: true` log events.
- Browsers other than Chromium; more than 10 cookies over HTTP/2.

## 6. Writing

This file uses Simplified Technical English where practical: short sentences, active voice, one instruction per sentence. Code names, AC ids and error codes are kept as they are.
