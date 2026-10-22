# LA-E4-02 migration 014, placements, learning records and the dispatch outbox: QA-3 UNIT-row recording plan

Spec: `docs/architecture/ltiaas/tasks/LA-E4-02.md` (at `481ba71`, with the A-LAB-19 clause in AC-04 and `BD-A1-10` item 2 in AC-13). Design: `docs/architecture/ltiaas/adr/LA-ADR-03-learning-record-core.md` D1–D4, D6, D7; `docs/architecture/ltiaas/adr/LA-ADR-04-refactor-and-migration.md` D5, D8 (LA-IC-09); `docs/architecture/ltiaas/data-model.md` §3, §7; `docs/architecture/ltiaas/contracts/cogniate-app-api-delta.md` §6; `docs/architecture/ltiaas/build-decisions-A1.md` BD-A1-10 item 2; plan LD-5, LD-6. Wave: B2 (lane R).

## Acceptance criteria map

| AC | Label | Verification owner | Summary |
| --- | --- | --- | --- |
| AC-LA-E4-02-01 | UNIT | Author unit test (QA-3 records; Reviewer-B checks quality) | Migration `014` backfill: 1:1 `score_sync` → `record_dispatch` (same id and state columns) and `final` `learning_record` (`rec_` + sync id body); 1:1 `resource_link` → `placement` (`external_key = json_array(deployment_id, context_id, resource_link_id)`); `partition_key` on exclusive, shared-reserved and released Blackboard fixtures. |
| AC-LA-E4-02-02 | UNIT | Author unit test (QA-3 records; Reviewer-B checks quality) | Runtime `external_key` encoder matches SQLite `json_array` for the same three strings, empty context id `""`, and escaped characters. |
| AC-LA-E4-02-03 | UNIT | Author unit test (QA-3 records; Reviewer-B checks quality) | Record rule: non-preview new best final result writes one `final` record and one dispatch; preview writes none; T5a and T5b commit sequences produce dispatch rows equal to today's score sync golden rows. |
| AC-LA-E4-02-04 | UNIT | Author unit test (QA-3 records; Reviewer-B checks quality) | LA-E4-01 store-contract suite on the migrated app job store with two runners: (1) one lease / `send_started_at` at a time per `(placement, learner_subject, reporter)` and ordered start; (2) stale boot id changes no row; (3) recovery respects live foreign leases, sets `delivery_uncertain = 1` on own/expired/`NULL` leases, and a copied row with `send_started_at` and a pending confirmation gets one confirmation send >= 5 s after the first accepted send inside its 24 h window (A-LAB-19). |
| AC-LA-E4-02-05 | K0 | QA-3 K0 probe (`fitness:rules`, wave B2) | F5 `no-score-sync`: probe product SQL naming `score_sync` outside an applied migration fails; clean tree passes. |
| AC-LA-E4-02-06 | K1-SIM | Lead QA U1 run (TEST-STRATEGY §4.5, tasks README §2) | Upgrade route U1 at E4: G3 transcript of old records equal; new launch on old resource link adds no placement and sends score; Resend of old failed row follows ADR-010 rule 10. |
| AC-LA-E4-02-07 | K1-SIM | Lead QA migration phases (tasks README §2) | M1 `migration` and `snapshot-upgrade` phases give the baseline results. |
| AC-LA-E4-02-08 | K1-SIM | QA-3 / Lead QA golden G3 compare | Golden G3 (`results` API rows, `scoreSyncs`, `lastScoreSync`, Resend answers, play status) equals the G-BASE baseline. |
| AC-LA-E4-02-09 | K1-SIM | Lead QA R1 run (tasks README §2) | M1 `sim` phase and M2 give the baseline result per test id. |
| AC-LA-E4-02-10 | MOODLE-LIVE | Lead QA / QA-E2E Moodle slot (tasks README §2) | T5a, T5b (P2, P5 with the LD-6 / QA form (j) `record_dispatch` fixture, P11) and T7 × 1 give the baseline results. |
| AC-LA-E4-02-11 | UNIT | Author unit test (QA-3 records; Reviewer-B checks quality) | Results row of a placement with context id `""` (launch without context, LA-ADR-05 D2) shows course name `"—"`. |
| AC-LA-E4-02-12 | UNIT | Author unit test (QA-3 records; Reviewer-B checks quality) | Confirmation rule (LA-ADR-03 D7, A-LAB-12): with a superseded row of the same key that still has `send_started_at`, an accepted higher row stays `pending` with `confirmation_after` >= 5 s later and becomes `sent` only after one confirmation. |
| AC-LA-E4-02-13 | UNIT | Author unit test (QA-3 records; Reviewer-B checks quality) | Outbox per-row error isolation (`BD-A1-10` item 2): when a reporter throws inside `send(work)` (or when outbox row work throws before or after `send`), the outbox catches every error of its row, moves the row with a try counted and a later `next_try_at`, and sends the next row of the same partition at the next poll. |

## UNIT-row recording plan (no Docker)

At the run of the LA-E4-02 SHA, QA-3 records:

1. **R0 (`npm ci` and `npm run check`):**
   - Clone the task SHA into a new private folder outside the repository (`git clone --no-hardlinks --no-checkout`, `git checkout --detach <SHA>`, push URL disabled, umask 077).
   - Run `npm ci` and `npm run check`, saving `npm-ci.log`, `check.log` and `counts.json`. Record the Vitest and infra counts in `docs/reviews/LA-E4-02/qa.md` next to the LA-E0-01 numbers.
2. **UNIT rows (`AC-LA-E4-02-01`, `-02`, `-03`, `-04`, `-11`, `-12`, `-13`):**
   - In that clone, run:
     ```sh
     npx --no-install vitest run --reporter=verbose -t "AC-LA-E4-02-"
     ```
   - Save the output to `unit-rows-by-id.log` in the private run folder.
   - For each of the seven UNIT ACs (`AC-LA-E4-02-01`, `AC-LA-E4-02-02`, `AC-LA-E4-02-03`, `AC-LA-E4-02-04`, `AC-LA-E4-02-11`, `AC-LA-E4-02-12`, `AC-LA-E4-02-13`), `docs/reviews/LA-E4-02/qa.md` lists the passing test names that cite the AC id (for `AC-LA-E4-02-04`, also checking that the A-LAB-19 P2 confirmation case is covered; for `AC-LA-E4-02-13`, checking `BD-A1-10` item 2 per-row throw isolation and next-row progression on the same partition). If no test name cites an AC id, `qa.md` states that explicitly and Reviewer-B maps the test.
3. **K0, K1-SIM and MOODLE-LIVE rows:**
   - `AC-LA-E4-02-05` (K0 `no-score-sync`) runs in the same no-Docker clone via `npm run fitness:rules -- --stdin --as <path>`.
   - `AC-LA-E4-02-06` to `-09` (K1-SIM) and `AC-LA-E4-02-10` (MOODLE-LIVE) require booked Docker slots and are recorded as `pending: Docker window` until the window opens.
