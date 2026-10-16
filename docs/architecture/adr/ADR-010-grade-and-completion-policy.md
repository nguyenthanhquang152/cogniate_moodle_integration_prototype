# ADR-010: Grade and completion policy (AGS mapping)

Status: Accepted (round 2; product confirmation pending, Q4). Date: 2026-10-16.

## Context

Moodle 5.2 facts (`mod/lti/service/gradebookservices/classes/local/resources/scores.php`, `mod/scorm/datamodels/scorm_12.js`):

- A score needs `userId`, `timestamp`, `activityProgress`, `gradingProgress`. The user must be gradable in the course.
- If `gradingProgress` is not `FullyGraded`, Moodle sets `scoreGiven` to null: a "Pending" message **clears** the grade.
- If the stored grade time is the same or newer than `timestamp` (seconds), Moodle returns `409`. This also happens after a teacher override.
- A deep-linking `lineItem` with `scoreMaximum` becomes a grade item with that maximum.
- "Receive a grade" completion runs on the grade update. A grade of 0 counts as received.
- Moodle's own SCORM player, on `LMSFinish`: `not attempted` → `completed`; then, in normal mode with credit, a set raw score and a mastery score decide `passed` or `failed`.

DataCamp sends 100/100 when the learner completes.

## Decision

1. **Line item**: each content item has `lineItem.scoreMaximum = 100`. The sync uses `services.assignmentAndGrades.lineItemId` from the launch. If it is missing, the app looks it up with `GET /api/lineitems?resourceLinkId=`. If there is none, the row shows "no gradebook column" and nothing is sent.
2. **Only final outcomes are sent.** No "Started" or "InProgress" message.
3. **Moodle's `LMSFinish` rule** is applied before the outcome (app contract §7).
4. **Mapping** (`packages/tracking`):

| Outcome | Rule | activityProgress | gradingProgress | scoreGiven / scoreMaximum |
| --- | --- | --- | --- | --- |
| `completed` | SCORM `completed` without mastery or raw score; HTML course without questions | `Completed` | `FullyGraded` | raw / max if raw exists, else 100 / 100 |
| `passed` | SCORM `passed`; HTML score ≥ mastery | `Completed` | `FullyGraded` | raw / max (max default 100); 100 / 100 if no raw |
| `failed` | SCORM `failed`; HTML score < mastery | `Completed` | `FullyGraded` | raw / max; 0 / 100 if no raw |
| `in_progress` | SCORM `incomplete`, `browsed`; HTML not complete | — | — | not sent |

5. **Best result wins, never lower.** A new score sync row is made when an attempt reaches a final outcome and its `scoreGiven / scoreMaximum` is higher than the best value of **every** row of that learner and activity that is `pending`, `sent` or `conflict` (the first final outcome always makes a row). A new row marks older `pending` rows with a **lower** value as `superseded`. So an outage can never let a lower result replace a better pending one.
6. **Learners only.** If the launch roles have no Learner role (teacher preview), the attempt is a preview: no row.
7. **Timestamps**: the LTI service sets them, ≥ 1 s apart per (platform, line item, user).
8. **409 = `conflict`.** No automatic retry. The portal says: "Moodle has a newer grade, for example a teacher override." A teacher override stays in Moodle.
9. **Retries**: 5 s, 30 s, 2 min, 10 min, 30 min, then every 1 h until 24 h after the row was made; then `failed`. Auth is `SERVICE-AUTH-V1`, so retries work after the ltik expires.
10. **Resend**: a Cogniate user can resend a `failed` or `conflict` row (`POST /app-api/score-syncs/:id/resend`).
11. **Versions**: an attempt keeps its course version. The best result counts across all attempts of the learner on that activity.
12. **Completion in Moodle**: the teacher sets "Receive a grade" on the activity. Our score makes Moodle mark it done.

## Consequences

- The gradebook shows the best result. The portal shows the best outcome, every attempt and every sync row.
- A learner who does not finish gets no grade ("In progress" in the portal).
- If product wants "latest result" instead, only rule 5 changes.
