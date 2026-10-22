# LA-E4-03 the `lti-ags` record reporter, throttling and the read-back guard: QA-3 UNIT-row recording plan

Spec: `docs/architecture/ltiaas/tasks/LA-E4-03.md` (at `481ba71`). Design: `docs/architecture/ltiaas/adr/LA-ADR-03-learning-record-core.md` D5, D6, D7 (`429`, Fairness), D8, D9; `docs/architecture/ltiaas/adr/LA-ADR-04-refactor-and-migration.md` D8 (`LA-IC-11`, `LA-IC-15`); `docs/architecture/ltiaas/contracts/cogniate-app-api-delta.md` §6, §8; `docs/architecture/ltiaas/build-decisions-A1.md` BD-A1-27 (`LA-IC-15` at LA-E4-03); plan LD-5. Wave: B2 (lane R).

## Acceptance criteria map

| AC | Label | Verification owner | Summary |
| --- | --- | --- | --- |
| AC-LA-E4-03-01 | UNIT | Author unit test (QA-3 records; Reviewer-B checks quality) | HTTP-to-outcome mapping table: 2xx → `accepted`; `409` → `conflict` with per-channel `"{LMS} has a grade with a newer time"` filled from the channel `names.text` (`BD-A1-27` / `LA-IC-15`; Lead QA owns the G3 expected-delta change); `400`, `403`, `404`, `422` → `rejected`; `401`, `5xx`, no answer → `retryable` (`uncertain` only after the send began and the answer was none or `5xx`); `429` with `PLATFORM_RATE_LIMITED` or `RATE_LIMITED` → `throttled` with `retryAt` from `Retry-After`. |
| AC-LA-E4-03-02 | K1-SIM | QA-3 / Lead QA K1-AGS suite (SIM slot) | K1-AGS A1–A6 pass on the Moodle-shaped standard, Canvas and Blackboard simulator channels. |
| AC-LA-E4-03-03 | K1-SIM | QA-3 K1-SIM acceptance (SIM slot; depends on LA-E5-14 and LA-E7-05) | Simulator score POST answers `429` with `Retry-After: 30`: row stays `pending`, try count does not rise, app logs `dispatch_throttled {dispatch_id, partition, retry_at}`, next score POST to that platform is >= 30 s later. |
| AC-LA-E4-03-04 | K1-SIM | QA-3 K1-SIM acceptance (SIM slot, `lti-gate`) | Fairness with transport gate `hold_before` on platform A score path: platform B score is sent before release; two held rows of platform A are forwarded one at a time. |
| AC-LA-E4-03-05 | K1-SIM | QA-3 K1-SIM acceptance (SIM slot, QA form (l)) | App restart (`npm run stack:restart -- cogniate-app`) while a send is held makes the row uncertain; after release, one confirmation send follows >= 5 s after the first accepted send (T5b P2 rule). |
| AC-LA-E4-03-06 | UNIT | Author unit test (QA-3 records; Reviewer-B checks quality) | Read-back guard: test channel without `records.readBack` gets `409 CAPABILITY_NOT_SUPPORTED` with `details.capability = "records.readBack"` on `POST …/results/refresh`; baseline channels answer as before. |
| AC-LA-E4-03-07 | UNIT | Author unit test (QA-3 records; Reviewer-B checks quality) | Disabled `operatorGrant` connection: dispatch row becomes `failed` with `CONNECTION_DISABLED` and no POST; Resend and refresh give `409 CONNECTION_NOT_READY`. |
| AC-LA-E4-03-08 | UNIT | Author unit test (QA-3 records; Reviewer-B checks quality) | Outbox registration refuses a reporter with a policy other than `bestResult` (`everyRecord` is reserved for LC). |
| AC-LA-E4-03-09 | MOODLE-LIVE | Lead QA / QA-E2E Moodle slot (tasks README §2) | T5a, T5b and T7 × 1 give the baseline results. |

## UNIT-row recording plan (no Docker)

At the run of the LA-E4-03 SHA, QA-3 records:

1. **R0 (`npm ci` and `npm run check`):**
   - Clone the task SHA into a new private folder outside the repository (`git clone --no-hardlinks --no-checkout`, `git checkout --detach <SHA>`, push URL disabled, umask 077).
   - Run `npm ci` and `npm run check`, saving `npm-ci.log`, `check.log` and `counts.json`. Record the Vitest and infra counts in `docs/reviews/LA-E4-03/qa.md` next to the LA-E0-01 numbers.
2. **UNIT rows (`AC-LA-E4-03-01`, `-06`, `-07`, `-08`):**
   - In that clone, run:
     ```sh
     npx --no-install vitest run --reporter=verbose -t "AC-LA-E4-03-"
     ```
   - Save the output to `unit-rows-by-id.log` in the private run folder.
   - For each of the four UNIT ACs (`AC-LA-E4-03-01`, `AC-LA-E4-03-06`, `AC-LA-E4-03-07`, `AC-LA-E4-03-08`), `docs/reviews/LA-E4-03/qa.md` lists the passing test names that cite the AC id (for `AC-LA-E4-03-01`, also verifying the `BD-A1-27` / `LA-IC-15` per-channel `409` conflict message `"{LMS} has a grade with a newer time"` across channel `names.text` values). If no test name cites an AC id, `qa.md` states that explicitly and Reviewer-B maps the test.
3. **K1-SIM and MOODLE-LIVE rows (`AC-LA-E4-03-02` to `-05`, `-09`) and G3 `LA-IC-15` delta:**
   - Require booked SIM and Moodle Docker slots (and `LA-E5-14` + `LA-E7-05` for `AC-LA-E4-03-03`); recorded as `pending: Docker window` until the window opens. Lead QA owns the G3 expected-delta update for `LA-IC-15` (`BD-A1-27`).
