# T5b: HTML runtime, retry and conflict, Resend, results refresh

Owner: Author. Depends on: T5a. Contract: [`../contracts/cogniate-app-api.md`](../contracts/cogniate-app-api.md) §5 (refresh, Resend), §7 (HTML), §9, §10. Decisions: ADR-004 (HTML), ADR-010 rules 5, 8–10.

## Goal

The HTML course is tracked like the SCORM course. Score syncs survive Moodle outages, conflicts are visible, and a human can resend.

## Scope

In: HTML runtime (contract §9, ADR-004; attach to each child document when it is parsed, not on `load`); HTML progress rules in `packages/tracking`; full retry schedule (24 h); `conflict` state; `POST /app-api/score-syncs/:id/resend`; `POST /app-api/publications/:id/results/refresh`.

Out: portal UI (T6).

Recipes: AC-T5-31 makes a `conflict` row and AC-T5-32 makes a `failed` row in a fixed way. T6 (AC-T6-14) uses these rows.

## Acceptance criteria

Setup: T5a state.

QA run order: AC-T5-09 and AC-T5-10 (`cg_student`, "Cogniate HTML"); AC-T5-11 → AC-T5-27 (`cg_student2`, "Cogniate HTML"); the ACs with their own activity in any order (AC-T5-14, -28, -29, -30, -31, -32, -33, -36); then AC-T5-18 and AC-T5-19 last.

- **AC-T5-09** HTML pass: `cg_student` in "Cogniate HTML": menu page, lesson page ≥ 11 s and scroll to the end, correct option. The runtime can read `body[data-lesson-id]` of the child page (`frame.evaluate`). Within 60 s Moodle shows 100 and completion done; row `best.outcome=passed`, one sync `sent`.
- **AC-T5-36** (own activity `Cogniate HTML AC-T5-36`) Hanging hosts: QA makes every non-`*.test` request hang (no answer, not blocked). `cg_student` completes "Cogniate HTML" as in AC-T5-09 → the same result (`passed`, 100 in Moodle) within the same deadline. (A runtime that waits for the iframe `load` event records nothing here.) Tip: in the HTML export some copies of the lesson link are hidden; a DOM `a.click()` works.
- **AC-T5-10** The HTML package bytes are not changed: for **every** file in the zip, SHA-256 of `GET /pkg/<id>/<path>` = SHA-256 of the zip entry.
- **AC-T5-11** Incomplete: `cg_student2` opens "Cogniate HTML", sees only the menu page, closes the window → no grade in Moodle; row `in_progress`, `scoreSyncs: []`.
- **AC-T5-27** HTML fail: `cg_student2` (new run) picks a wrong option and finishes the pages → Moodle 0; row `failed`, one sync `sent`.
- **AC-T5-28** (own activity `Cogniate HTML AC-T5-28`) First answer stands: a learner clicks a wrong option, then the correct one, then finishes → `failed`, score 0.
- **AC-T5-29** (own activity `Cogniate HTML AC-T5-29`) Dwell rule: a learner answers, scrolls to the end of the lesson page, and closes the window before 10 s → `in_progress`, no sync.
- **AC-T5-14** (own activity `Cogniate HTML AC-T5-14`) Retry: a learner launches "Cogniate HTML" (Moodle up). QA runs `docker compose stop moodle`, the learner completes with the correct answer, the row shows `pending` with `tries ≥ 1`. QA starts Moodle before 30 s have passed since the first try. Within 3 min the row is `sent` and Moodle shows 100.
- **AC-T5-30** Outage order (own activity `Cogniate SCORM AC-T5-30`; SCORM course, because in the HTML course the first answer stands and a later fail is impossible): `docker compose stop moodle`; a learner passes (row 1 `pending`, 100); QA posts a `failed`/0 final commit (`lesson_status=failed`, `score.raw=0`, then `finish`) for the same learner and activity in a new session; `docker compose start moodle`. Moodle shows 100, row 1 is `sent`, and no row with 0 is `sent`.
- **AC-T5-31** Conflict (deterministic recipe; Moodle stores our `timestamp` as the grade time, `save_grade_item`): `cg_student2` launches its own activity `Cogniate HTML AC-T5-31` (QA captures the ltik and reads the service key with `GET /api/idtoken`). QA posts `POST /api/lineitems/<id>/scores` with `SERVICE-AUTH-V1`, `scoreGiven: 10`, `scoreMaximum: 100`, `timestamp` = now + 10 min. QA runs `npm run stack:restart -- lti-service` (clears the in-memory clock). `cg_student2` completes with the correct answer → the row is `conflict` (no retry: `tries` stays 1 for 2 min), `lastError` names `PLATFORM_CONFLICT`, Moodle still shows 10, and `best.outcome = passed`.
- **AC-T5-32** Failed and Resend (deterministic recipe): `cg_teacher` deep-links Thanh's HTML course into `COGNIATE-DEV-102` as "Cogniate HTML 102" (so no other test's grades are touched). `cg_student2` launches it. QA unenrols `cg_student2` from `COGNIATE-DEV-102` in the Moodle UI (Participants). `cg_student2` completes in the open window → the row is `failed` at once, `lastError` names `PLATFORM_REJECTED_REQUEST` (Moodle: "Incorrect score received", user not gradable). QA enrols `cg_student2` in `COGNIATE-DEV-102` again as student. `POST /app-api/score-syncs/<id>/resend` → `200`, the row is `pending` with `tries = 0`, then `sent`, and Moodle shows the score. Resend of the AC-T5-31 `conflict` row within its 10 min → `conflict` again. Resend of a `sent` row → `409 SYNC_NOT_RESENDABLE`.
- **AC-T5-33** Teacher override (own activity `Cogniate SCORM AC-T5-33`; one expected result, checked in the Moodle 5.2.4 source): `cg_student2` completes with a wrong option (Moodle 0). `cg_teacher` overrides that grade in the grader report to 50. QA then posts a better final result for `cg_student2` in a new session (`lesson_status=passed`, `score.raw=100`, then `finish`). The row is `sent`; Moodle still shows 50 (an overridden final grade is not changed by a module grade update). After "Refresh from Moodle", the row has `gradebookDiffers: true` and `gradebook.resultScore = 50`.
- **AC-T5-18** (run after the other ACs) `POST /app-api/publications/<id>/results/refresh` → every row's `gradebook.resultScore` equals the Moodle grade (QA oracle), with `resultMaximum` 100. Expected for "Cogniate SCORM": `cg_student` 100, `cg_student2` 100 (AC-T5-23 raised it from 0). For `Cogniate SCORM AC-T5-33`: 50 with `gradebookDiffers: true`.
- **AC-T5-19** `infra/.logs/cogniate-app.jsonl` and `cogniate-content.jsonl` contain no runtime token, ltik or service key (QA greps for the captured values).

## Final regression P5: bounded fixture exception

Lead decision, 2026-10-19. This checks the existing Resend rule in app contract §5 and ADR-010 rules 10–11. No public API removes a sync row. QA may use the following fixture exception only for this regression.

1. Use an isolated QA clone, its own stack, and a fresh activity for this check.
2. Through UI/API calls, create final attempts of 60/100 and 80/100 on two course versions for the same learner and activity.
3. Make both score syncs fail through UI/API actions. Record the attempt ids, version ids, sync ids, scores and statuses from public results.
4. Delete only the higher failed score-sync row from QA's app database, selected by its exact sync id. Assert exactly one deletion.
5. Do not alter either attempt, the lower sync row, or any other database row.
6. Read `GET /app-api/publications/:id/results`. Assert that both final attempts remain and `best` is still 80/100.
7. Assert that the higher sync is absent and the lower 60/100 sync is still `failed` or `conflict`.
8. Call `POST /app-api/score-syncs/:syncId/resend` for the lower sync. Expect `409 SYNC_NOT_RESENDABLE`.
9. Remove QA's own stack after the run.

The lower row must satisfy every Resend condition except the best-score rule. A `sent`, `pending` or `superseded` row cannot prove P5. If QA cannot reach the preconditions naturally, ask the Lead before any wider fixture mutation.

Report this check as **fixture-assisted**, not pure black-box. Include the exact deleted sync id, the one-row deletion count, public results before and after, and the Resend response. Keep the final regression pending until QA records the result.

## Self-check

`npm run check` green. Unit tests: HTML rules (dwell, scroll end, menu page, first answer stands), retry schedule, conflict mapping, resend rules.
