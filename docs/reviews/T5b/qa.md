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


## Replacement QA regression, 2026-10-19 — candidate a5d9ddc

Independent replacement QA: Codex GPT-6-Astra, xhigh, assigned by the continuation authority. This is a replacement-model run, not a claim of cross-model QA. Acceptance specs and contracts were read before prior QA evidence. No author notes were used to create acceptance criteria. Historical rounds above remain unchanged.

- Tested SHA: `a5d9ddcbc95cfb61968f70372334790386f2bb4b`; product code: `dd6dd1188833653cb92c63cc09e3c438ac3cb7b4`. Product paths have no diff between these commits.
- Run: 2026-10-19 10:10:28–10:29:45 UTC. Fresh external clone: `/Users/quangnguyen/cogniate-qa-runs/qa-cont-t5-a5d9ddcb-2026-10-19T10-10-28-786Z`. No `--checkout` or `--replace-tests`.
- Evidence root `R`: `/Users/quangnguyen/orca/workspaces/cogniate_moodle_integration_prototype/moodle-lti-continuation/tests/host/artifacts/qa-cont-t5-a5d9ddcb-2026-10-19T10-10-28-786Z`. The root has `summary.json`, `images.json`, and command logs. Each container folder has its Playwright JSON, traces, screenshots, log snapshots and captured-secret evidence.
- Command: `COMPOSE_PROJECT_NAME=qa-cont-t5 PUBLIC_PORT=8643 STACK_SUBNET=172.29.0.0/16 COURSE_FIXTURES_DIR=/Users/quangnguyen/Workspaces/personal/cogniate_moodle_integration_prototype/docs/raw/data/courses node tests/host/run-t5.mjs --sha a5d9ddcbc95cfb61968f70372334790386f2bb4b --tasks T5a,T5b,T6`. The fixture source checkout was read only.
- Isolation: preflight and H1 passed; one own stack, free port and subnet, SHA-checked course fixtures. The runner removed the stack and recorded zero own containers, volumes and networks. An independent label-filtered Docker check also returned zero. None of the ten pre-existing containers stopped or restarted. No other stack was paused or changed.

Image IDs from `R/images.json`:

| Service | Image | ID |
| --- | --- | --- |
| moodle | `erseco/alpine-moodle:v5.2.4` | `sha256:3a310197e51ff34c6e8e8adbb92703fe598f71cbcf9eb974055c27f07f4cb23d` |
| cogniate-app | `node:24.22.0-alpine3.24` | `sha256:44fce696f38ba8c987c4db89954051000bbd05ffd8d8659ba15ed4a8602e937f` |
| lti-service | `node:24.22.0-alpine3.24` | `sha256:44fce696f38ba8c987c4db89954051000bbd05ffd8d8659ba15ed4a8602e937f` |
| postgres | `postgres:16-alpine` | `sha256:721873c34ceb9f8d8fc265984940dc982404c105f19ad51be9fdc5970a6080ea` |
| proxy | `caddy:2.11.7-alpine` | `sha256:d8542f48d34a9cf4e4c11a478865229840e87e4c96ea3f439101f31a5d35f75f` |

### Result at this candidate

**FAIL — 13 of 14 ACs pass; AC-T5-30 has an in-flight failure. The additional P5 fixture precondition failed.** The combined runner exited 1. This run does not clear the final T5/T6 gate.

Main pass: 22 passed, two failed, no skipped or flaky tests. P11 sent, pending and failed variants passed; P2 in flight and fixture-assisted P5 failed. The table uses the command above and `R/container-T5b/playwright-results.json`; the full test titles below identify the executed tests.

| AC | Result | Executed test / observation |
| --- | --- | --- |
| AC-T5-09 | PASS | HTML pass: cg_student in "Cogniate HTML" (menu, lesson ≥ 11 s + scroll, correct option); the runtime reads body[data-lesson-id]; within 60 s Moodle 100 and completion done; row passed, one sync sent |
| AC-T5-36 | PASS | hanging hosts: every non-*.test request hangs; cg_student completes the HTML course → passed and 100 in Moodle within 60 s |
| AC-T5-10 | PASS | the HTML package bytes are not changed: SHA-256 of GET /pkg/<id>/<path> = SHA-256 of the zip entry, for every file; (A-T5b-01) 5 and 10 cookies of 4,000 characters on the content origin: GET /pkg/<id>/index.html → 200 with the same bytes (Node HTTP/1.1; Chromium HTTP/2 top-level); the player loads in Chromium (every content response < 400) |
| AC-T5-11 | PASS | incomplete: cg_student2 sees only the menu page and closes the window → no grade in Moodle; row in_progress, no scoreSyncs |
| AC-T5-27 | PASS | HTML fail: cg_student2 (new run) picks a wrong option and finishes the pages → Moodle 0; row failed, one sync sent |
| AC-T5-28 | PASS | first answer stands: a wrong option, then the correct one, then the pages → failed, score 0 |
| AC-T5-29 | PASS | dwell rule: the learner answers, scrolls to the end and closes the window before 10 s → in_progress, no sync |
| AC-T5-14 | PASS | retry: Moodle stopped, the learner passes → row pending with tries ≥ 1; Moodle started before 30 s since the first try → within 3 min sent and Moodle 100 |
| AC-T5-30 | FAIL | outage order: Moodle stopped; the learner passes (row 1 pending, 100); a failed/0 final commit in a new session; Moodle started → Moodle 100, row 1 sent, no row with 0 sent; (P2) Moodle stopped: a failed 60 is pending, then a passed 90 supersedes it; Moodle started → 90 sent, Moodle 90; the 60 row stays superseded and is never sent; (P2, in flight) Moodle paused: the better result (90) arrives while the send of the lower row (60) runs; after unpause the 60 row stays superseded and Moodle shows 90 |
| AC-T5-31 | PASS | conflict: a QA score with timestamp now + 10 min, lti-service restart, then cg_student2 completes → row conflict (tries stays 1 for 2 min, PLATFORM_CONFLICT), Moodle still 10, best passed |
| AC-T5-32 | PASS | failed and Resend: unenrolled learner → failed at once (PLATFORM_REJECTED_REQUEST); enrol again, Resend → pending, tries 0, then sent; conflict Resend → conflict; Resend of a sent row → 409; (A-T5b-02) Resend never lowers a grade: rows 50 and 100 both failed (learner unenrolled); after enrol, Resend of the 50 row → 409 SYNC_NOT_RESENDABLE; Resend of the 100 row → sent, Moodle 100; the 50 row stays failed |
| AC-T5-33 | PASS | teacher override: the grade is overridden to 50; a better result is sent; Moodle still shows 50; after Refresh, gradebookDiffers and resultScore 50 |
| AC-T5-18 | PASS | (B-T5b-01) Refresh from Moodle never stores another learner's grade: a learner without a Moodle grade keeps resultScore null; every HTML row = the Moodle grade; Refresh from Moodle: every row of the SCORM publication has gradebook.resultScore = the Moodle grade (resultMaximum 100); Cogniate SCORM 100/100; AC-T5-33 activity 50 with gradebookDiffers |
| AC-T5-19 | PASS | cogniate-app.jsonl and cogniate-content.jsonl contain no runtime token, ltik or service key captured in this run |

### P2 failure: app says 90 sent, Moodle remains 60

Product behavior failure, reported to the coordinator before test changes. Repro: create a fresh blank SCO activity; pause only QA Moodle; finalize failed 60; wait for its first send timeout; at seven seconds after that event, finalize passed 90 during the next send; wait for the late lower-send event; unpause Moodle. The app marks the higher row `sent`, but the Moodle grade oracle still returns 60 at the end of the 120-second wait. `8-supersede.spec.ts:115` fails with expected 90, received 60. ADR-010 rule 5 at this candidate requires the best result to win.

| UTC event | Public/log evidence |
| --- | --- |
| 10:22:36.402 | Host starts own Moodle pause; exit 0. |
| 10:22:41.578 | Lower `sync_f0t9IXlPJGgkxXMf0tXB7g`: `pending`, tries 1. |
| 10:22:48.583 | Better result committed, inside the lower send. |
| 10:22:52.142 | Lower row late completion: `superseded`, `send_result: pending`, tries 2. |
| 10:22:52.432 | Host starts own Moodle unpause; exit 0. |
| 10:22:52.582 | Higher `sync_7OWUNO4QA4OGy1pWREuY-Q`: `sent`, tries 1. |
| Following 120 seconds | Moodle remains 60; required 90 is not observed. |

Trace: `R/container-T5b/playwright/T5b-8-supersede-AC-T5-30-P-a42e6-erseded-and-Moodle-shows-90/trace.zip`. The late-event `superseded` and `send_result` assertions passed. The subsequent 90-second no-retry/grade-stability observation was **not reached** and is not claimed as passing. The separate stopped-Moodle P2 case passed its 60-second observation. The approved repair policy and its residual remote-write risk require fresh independent verification; this failed run proves neither the repair nor universal never-lower delivery.

### P5 fixture failure: QA ownership

The fixture naturally created final 60/100 and 80/100 attempts on two versions with both sync rows `failed`. The host reported deletion of exactly one row, higher sync `sync_n7HyLWux3irUt477kFfG3g`, at 10:26:39.864 UTC. The following public results still contained that same failed 80 row. Both attempts and best 80 were unchanged, but `9a-best-score.spec.ts:64` correctly failed the requirement that only the lower failed row remain. **Resend was not called; this run does not prove P5.**

Trace: `R/container-T5b/playwright/T5b-9a-best-score-P5-fixtu-84c03-d-sync-60-Resend-is-refused/trace.zip`. The failure belongs to the QA fixture, not a demonstrated Resend defect. The Lead approved the bounded stop/delete/start/health-wait extension, now in the T5b spec. The QA fix keeps the one-row deletion and unchanged-attempt/lower-row assertions. It must be committed and rerun before P5 can pass. This exception is fixture-assisted, not pure black-box.

### P11 and additional passing checks

| Check | Result and observed behavior |
| --- | --- |
| P11 sent | PASS: version 1 best 90, version 2 retake 75; status API reports attempt 75 and sync sent 90/100; shell says Moodle keeps best 90; no 75 sync; Moodle 90. |
| P11 pending | PASS: own Moodle stopped while best 90 is pending; retake 75 remains separate; exact shell text names sending best 90; after recovery Moodle 90. |
| P11 failed | PASS: UI unenrolment makes best 90 fail with `PLATFORM_REJECTED_REQUEST`; retake 75 remains separate; shell says best 90 was not sent; re-enrol/Resend ends with Moodle 90. |
| Existing lower-Resend guard | PASS: two failed syncs 50 and 100; lower Resend 409, higher Resend sent, Moodle 100. This does not substitute for P5's missing-higher-row precondition. |
| Conflict | PASS: no retry for the required two minutes; Resend returns conflict again within the future timestamp window. |
| Teacher override | PASS: higher sent result does not remove Moodle's override 50; refresh reports 50 and `gradebookDiffers`. |
| Secret scan | PASS: captured runtime tokens, ltiks and service keys were absent from app/content logs. Captured values remain only in ignored QA artifacts, never copied to this report. |

The P11 pending and failed screenshots and status annotations are under `R/container-T5b/playwright/T5b-9-retake-unsent-*` and in its JSON report. No live lower-score `conflict` or scoreless-attempt P11 variant is claimed here. This run does not observe a full 24-hour retry window. Observation windows are finite; only Chromium and local Moodle 5.2.4 were tested.

### Withdrawn repair candidate, 2026-10-19 10:41–10:43 UTC

The coordinator first authorized `1ce57f2435103fef5a342e141080de8d7191afa7`, then withdrew it after an Architect finding in the new score-comparison guard. The fresh focus run had passed clone/setup/H1/fixtures and started its acceptance container. QA stopped only `qa-cont-p2-qa-acceptance-31933`, so the host runner returned through its normal `finally` teardown. No acceptance test result was produced; the focus reports exit 137 and missing expected tests. This is a withdrawn run, not a PASS and not a new observed product failure.

Evidence: `/Users/quangnguyen/orca/workspaces/cogniate_moodle_integration_prototype/moodle-lti-continuation/tests/host/artifacts/qa-cont-p2-1ce57f24-2026-10-19T10-41-44-249Z`. Command: the same `run-t5.mjs` environment above, with project `qa-cont-p2`, the withdrawn SHA, and `--tasks T5a,T5b --only SETUP-T5b,AC-T5-30,P5`. Cleanup passed with zero own containers, volumes and networks; a separate exact-label Docker check also returned zero, and no other container stopped or restarted. A corrected committed candidate is required before the focus and full regressions can continue.

## Replacement QA repair focus, 2026-10-19 — d54c607d

**PASS: all six focused tests.** Independent replacement QA remains Codex GPT-6-Astra, xhigh. Tested committed SHA `d54c607d7fc6ce2d97e039bb108f52a37f2174ee`, including the P2 policy and the fractional best-attempt guard repair. This focus clears P2 and P5; the full T5a/T5b/T6 regression is still required.

Run time: 10:45:38–10:51:48 UTC. Fresh clone: `/Users/quangnguyen/cogniate-qa-runs/qa-cont-p2-d54c607d-2026-10-19T10-45-38-252Z`. Evidence root `F`: `/Users/quangnguyen/orca/workspaces/cogniate_moodle_integration_prototype/moodle-lti-continuation/tests/host/artifacts/qa-cont-p2-d54c607d-2026-10-19T10-45-38-252Z`. Image identities are in `F/images.json` and equal the IDs listed in the a5d9ddc section above. Command: `COMPOSE_PROJECT_NAME=qa-cont-p2 PUBLIC_PORT=8643 STACK_SUBNET=172.29.0.0/16 COURSE_FIXTURES_DIR=/Users/quangnguyen/Workspaces/personal/cogniate_moodle_integration_prototype/docs/raw/data/courses node tests/host/run-t5.mjs --sha d54c607d7fc6ce2d97e039bb108f52a37f2174ee --tasks T5a,T5b --only SETUP-T5b,AC-T5-30,P5`.

`F/container-focus/playwright-results.json`: setup T5a, setup T5b, outage-order AC-T5-30, stopped-Moodle P2, in-flight/restart P2, and fixture-assisted P5 all passed; no skipped, failed or flaky tests. The runner and a separate exact-label Docker check confirmed zero own containers, volumes and networks after teardown. No other container stopped or restarted. No tests were overlaid on the clone.

### P2: confirmation and restart evidence

Lower sync `sync_SSG3MN8g1s4yqe2ecTslPQ` (60/100) logged its first timeout at 10:49:18.025 UTC. QA committed the better result at 10:49:25.030. The lower send ended at 10:49:28.712 with persisted status `superseded`, `send_result: pending`, phase `send`, tries 2.

Higher sync `sync_JBTzuM3oNEx-L_R0qv121g` (90/100) had this sequence:

| UTC | Evidence |
| --- | --- |
| 10:49:29.543 | First accepted POST: phase `send`, `send_result: sent`, persisted status `pending`, tries 1. Public results also show `pending`, `sentAt: null`. |
| 10:49:30.151 | Own QA app fully stopped, 608 ms after the accepted response and before confirmation was due. |
| 10:49:30.819 | Own QA app started again; the host then waited for its health check. |
| 10:49:35.204 | Successful phase `confirmation`: status `sent`, tries 2, 5.661 s after first acceptance. Public results now have a `sentAt`. |
| Next 90 seconds | Moodle stays 90; lower row stays `superseded` with tries 2 and no later send log; higher row stays `sent` with tries 2 and no repeat confirmation loop. |

Each actual POST has one log event and the expected consecutive `tries` value. The separate stopped-Moodle P2 case also passed its 60-second observation. Exact JSON attachment extracted without changes: `F/evidence/p2-confirmation-evidence.json`; original attachment and trace: `F/container-focus/playwright-results.json` and `F/container-focus/playwright/T5b-8-supersede-AC-T5-30-P-ad9a4-onds-with-no-obsolete-retry/trace.zip`. Own app stop/start commands and the successful host acknowledgement are also in `F/cmd/` and `F/container-focus/control/`.

This is a finite live confirmation/restart check. An older remote request can still write after an accepted confirmation; the five-second policy does not prove universal remote ordering or permanent gradebook equality. Deterministic delayed-write placement, requirement transfer, confirmation-conflict and retry-window exhaustion are separate Author unit proofs, not claims of this live focus.

### P5: fixture-assisted best score across versions

All setup used public UI/API calls. UI unenrolment made both sync rows fail; UI re-enrolment restored the learner before the fixture. The own app was stopped, the exact higher failed sync was deleted, and the app was started and health-checked in `finally` cleanup before public assertions.

| Item | Before | After fixture and Resend |
| --- | --- | --- |
| Attempt `att_RpG4ojPVWhy2c3k-PGjDQA` | Version `ver_re11IfSgyNPHjaMY3yKGxQ`, final failed 60/100. | Unchanged, including its timestamp. |
| Attempt `att_sa4pFXIsuqHHN5p2Ah5PVg` | Version `ver_3JfbLCEPfx2hRRHiuo7gDw`, final passed 80/100. | Unchanged, including its timestamp. |
| Higher sync `sync_XPXxf5komBRbbyb9HPpduA` | Failed 80/100, tries 1. | Exact deletion count 1; absent in public results. |
| Lower sync `sync_U5SnN5SeJw4Y1OoYU_6OWw` | Failed 60/100, tries 1; otherwise resend-eligible. | Entire row unchanged; no send or retry created. |
| Public `best` | Higher final attempt, 80/100. | Still the same higher final attempt, 80/100. |
| Resend lower sync | Not yet requested. | HTTP 409, `details.message: SYNC_NOT_RESENDABLE`. |

Exact before/fixture/after/Resend/end public evidence: `F/evidence/p5-public-evidence.json`, extracted from the `p5-public-evidence` attachment in the Playwright JSON. Trace: `F/container-focus/playwright/T5b-9a-best-score-P5-fixtu-84c03-d-sync-60-Resend-is-refused/trace.zip`. The host fixture action ran from 10:51:31.164 to 10:51:34.067 UTC; its acknowledgement records deletion count 1 and successful stop/start/health recovery. This is **fixture-assisted**, not pure black-box, under the bounded T5b spec exception. No other database row or stack was changed.
