# T5b: HTML runtime, retry and conflict, Resend, results refresh

Owner: Author. Depends on: T5a. Contract: [`../contracts/cogniate-app-api.md`](../contracts/cogniate-app-api.md) §5 (refresh, Resend), §7 (HTML), §9, §10. Decisions: ADR-004 (HTML), ADR-010 rules 5, 8–10.

## Goal

The HTML course is tracked like the SCORM course. Score syncs survive Moodle outages, conflicts are visible, and a human can resend.

## Scope

In: HTML runtime (contract §9, ADR-004); HTML progress rules in `packages/tracking`; full retry schedule (24 h); `conflict` state; `POST /app-api/score-syncs/:id/resend`; `POST /app-api/publications/:id/results/refresh`.

Out: portal UI (T6).

## Acceptance criteria

Setup: T5a state.

- **AC-T5-09** HTML pass: `cg_student` in "Cogniate HTML": menu page, lesson page ≥ 11 s and scroll to the end, correct option. The runtime can read `body[data-lesson-id]` of the child page (`frame.evaluate`). Within 60 s Moodle shows 100 and completion done; row `best.outcome=passed`, one sync `sent`.
- **AC-T5-10** The HTML package bytes are not changed: for **every** file in the zip, SHA-256 of `GET /pkg/<id>/<path>` = SHA-256 of the zip entry.
- **AC-T5-11** Incomplete: `cg_student2` opens "Cogniate HTML", sees only the menu page, closes the window → no grade in Moodle; row `in_progress`, `scoreSyncs: []`.
- **AC-T5-27** HTML fail: `cg_student2` (new run) picks a wrong option and finishes the pages → Moodle 0; row `failed`, one sync `sent`.
- **AC-T5-28** First answer stands: a learner clicks a wrong option, then the correct one, then finishes → `failed`, score 0.
- **AC-T5-29** Dwell rule: a learner answers, scrolls to the end of the lesson page, and closes the window before 10 s → `in_progress`, no sync.
- **AC-T5-14** Retry: a learner launches "Cogniate HTML" (Moodle up). QA runs `docker compose stop moodle`, the learner completes with the correct answer, the row shows `pending` with `tries ≥ 1`. QA starts Moodle before 30 s have passed since the first try. Within 3 min the row is `sent` and Moodle shows 100.
- **AC-T5-30** Outage order: `docker compose stop moodle`; a learner passes (row 1 `pending`, 100); QA posts a `failed`/0 final commit for the same learner and activity in a new session; `docker compose start moodle`. Moodle shows 100, row 1 is `sent`, and no row with 0 is `sent`.
- **AC-T5-31** Conflict: `cg_teacher` overrides `cg_student2`'s grade in the Moodle grader report to 50. Then QA posts a better final result for `cg_student2` (as AC-T5-23, on a fresh attempt). The row becomes `sent` or `conflict`. Moodle still shows the override 50. If `conflict`: the results view shows the conflict text, and `best.outcome` is the better result.
- **AC-T5-32** Resend: a `conflict` or `failed` row → `POST /app-api/score-syncs/<id>/resend` → `200`, the row is `pending` with `tries = 0`, then `sent` or `conflict` again. Resend of a `sent` row → `409 SYNC_NOT_RESENDABLE`.
- **AC-T5-18** `POST /app-api/publications/<id>/results/refresh` → the rows of AC-T5-07 and AC-T5-08 have `gradebook.resultScore` 100 and 0 (or the override value where AC-T5-31 ran), `resultMaximum` 100.
- **AC-T5-19** `infra/.logs/cogniate-app.jsonl` and `cogniate-content.jsonl` contain no runtime token, ltik or service key (QA greps for the captured values).

## Self-check

`npm run check` green. Unit tests: HTML rules (dwell, scroll end, menu page, first answer stands), retry schedule, conflict mapping, resend rules.
