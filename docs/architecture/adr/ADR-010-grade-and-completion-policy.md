# ADR-010: Grade and completion policy (AGS mapping)

Status: Accepted (round 2; product confirmation pending, Q4). Date: 2026-10-16.

## Context

Moodle 5.2 facts (`mod/lti/service/gradebookservices/classes/local/resources/scores.php`, `mod/scorm/datamodels/scorm_12.js`):

- A score needs `userId`, `timestamp`, `activityProgress`, `gradingProgress`. The user must be gradable in the course.
- If `gradingProgress` is not `FullyGraded`, Moodle sets `scoreGiven` to null: a "Pending" message **clears** the grade.
- If the stored grade time is the same or newer than `timestamp` (seconds), Moodle returns `409`. Moodle stores our `timestamp` as the grade time (`save_grade_item`). A teacher override alone does not cause a 409: Moodle accepts the later score and keeps the overridden final grade (`grade_item::update_raw_grade`).
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

5. **Choose the best result; never retry a superseded result.** A new score sync row is made when an attempt reaches a final outcome and its `scoreGiven / scoreMaximum` is higher than the best value of **every** row of that learner and activity that is not `superseded` (`pending`, `sent`, `conflict` or `failed`; A-T5b-02, rule 10) (the first final outcome always makes a row). A new row marks older `pending` rows with a **lower** value as `superseded`. A `superseded` row never goes back to `pending` or `sent`: a send that ends after the row was superseded does not change its status (conformance P2). A timeout does not prove that Moodle stopped processing the old request. Apply the bounded confirmation policy below when an uncertain lower send is superseded; do not claim universal remote ordering.
6. **Learners only.** If the launch roles have no Learner role (teacher preview), the attempt is a preview: no row.
7. **Timestamps**: the LTI service sets them, ≥ 1 s apart per (platform, line item, user).
8. **409 = `conflict`.** No automatic retry. The portal says: "Moodle has a grade with a newer time." A teacher override is a different case: the sync is `sent`, Moodle keeps the override, and after "Refresh from Moodle" the portal says "Moodle keeps another grade, for example a teacher override" (`gradebookDiffers`).
9. **Retries**: 5 s, 30 s, 2 min, 10 min, 30 min, then every 1 h until 24 h after the row was made; then `failed`. Auth is `SERVICE-AUTH-V1`, so retries work after the ltik expires.
10. **Resend**: a Cogniate user can resend a `failed` or `conflict` row (`POST /app-api/score-syncs/:id/resend`) only if its score is the learner's current best final result on that resource link. A row with a lower score than any existing final result (sent, pending, conflict, failed, or a final attempt with no row) is refused (`409`). So only the best result is ever sent. A resent row gets a new 24 h retry window.
11. **Versions**: an attempt keeps its course version. The best result counts across all attempts of the learner on that activity.
12. **Completion in Moodle**: the teacher sets "Receive a grade" on the activity. Our score makes Moodle mark it done.

### P2: bounded confirmation after uncertain delivery (2026-10-19)

The existing best-score policy still applies. Replacement QA showed that an old timed-out request can write in Moodle after the app receives success for a higher score. The local `superseded` guard prevents another local send; it cannot cancel remote work.

- Persist an in-flight marker before each score POST. A timeout, no response, or an unresolved marker after restart means uncertain delivery. A later successful retry must not erase earlier uncertainty.
- When an uncertain lower send is superseded, the current best pending row requires confirmation. Store this requirement durably for that learner and activity. A still higher result inherits the requirement.
- The first `204` for that row keeps it `pending`, with no `sentAt`. Schedule one confirmation POST at least 5 s after that response. Re-check that the row is still pending and current best before the POST and before recording success.
- A successful confirmation `204` permits `sent`. Failures use the existing status mapping and retry schedule. Confirmation does not reset the current 24 h retry window. A manual Resend still starts a new window under rule 10.
- One successful confirmation completes the requirement. A restart can repeat an unacknowledged confirmation. Do not start an endless loop after successful confirmations.
- A `409` still stops as `conflict`; teacher overrides stay intact. A different grade in a results read is not permission to resend or override it.

**Limit:** a still older Moodle request can write after the accepted confirmation. The 5 s gap is a bounded mitigation, not proof that every remote request finished. `sent` records accepted delivery, including the required confirmation; it does not guarantee permanent equality with the Moodle gradebook. This limit must stay in the handover evidence. App contract §10 defines the worker rules; T5b defines the regression checks.

## Consequences

- The tool sends the best result. Teacher overrides and the late-write limit above can leave a different Moodle grade. The portal shows the best outcome, every attempt and every sync row.
- A learner who does not finish gets no grade ("In progress" in the portal).
- If product wants "latest result" instead, only rule 5 changes.
