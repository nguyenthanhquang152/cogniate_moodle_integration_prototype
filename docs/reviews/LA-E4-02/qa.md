Verdict: PASS (host-only K0 + UNIT; K1-SIM and MOODLE-LIVE pending: Docker window)
Round: 1

# LA-E4-02 Migration 014, placements, learning records and the dispatch outbox: QA verification

Tester: QA-3 (Orca task `task_04af42599b39`, dispatch `ctx_9a0c491be3a8`), 2026-10-22. Spec: `docs/architecture/ltiaas/tasks/LA-E4-02.md` (with `A-LAB-10`, `A-LAB-12`, `A-LAB-19`, `BD-A1-10` item 2, `LA-IC-09`). Plan: `tests/ltiaas/tasks-core/LA-E4-02/README.md` (QA-3).

Independence: QA-3 did not read product source (`services/**`, `packages/**`, `apps/**`), Author notes or reviewer files. QA-3 verified all K0 and UNIT ACs in an isolated `--no-hardlinks` clone of `d2166d7`.

| Item | Value |
| --- | --- |
| SHA | `d2166d71fbd53432ea05f1a9b71a6e1e0ec690aa` (integration `d2166d7`; holds `LA-E4-02` merge `db7333f` over base `68308e1`) |
| Lane and slot | lane R; no Docker (HOST-ONLY; K1-SIM and MOODLE-LIVE rows marked `pending: Docker window`) |
| Clone | `~/cogniate-qa-runs/LA/LA-E4-02/r1/clone`: `git clone --no-hardlinks --no-checkout`, detached at `d2166d71fbd53432ea05f1a9b71a6e1e0ec690aa`, push URL `DISABLED`, `npm ci` at root |
| Environment | macOS arm64, Node 24.21.0, npm 11.19.0 |
| Artifacts | private run folder `~/cogniate-qa-runs/LA/LA-E4-02/r1/` (umask 077): `npm-ci.log`, `check.log`, `counts.json`, `unit-rows-by-id.log`, `k0/f5-clean.log`, `k0/f5-negative-domain.log`, `k0/f5-negative-015.log`, `k0/f5-positive-014.log`, `status-after.txt` |

## Acceptance criteria

| AC | Result | Test id | Command | Evidence |
| --- | --- | --- | --- | --- |
| AC-LA-E4-02-01 | PASS (UNIT) | `services/cogniate-app/src/kernel/records/migration.test.ts > records migration > AC-LA-E4-02-01: backfills every source column, partition branch, and equal-time insertion order without changing legacy rows` | `npx --no-install vitest run --reporter=verbose -t "AC-LA-E4-02-"` | Migration `014` backfills 1:1 `score_sync` → `record_dispatch` (same id and state columns) and `final` `learning_record` (`rec_` + sync id body), 1:1 `resource_link` → `placement` (`external_key = json_array(deployment_id, context_id, resource_link_id)`), and `partition_key` across exclusive, shared-reserved and released Blackboard fixtures without error. `unit-rows-by-id.log` |
| AC-LA-E4-02-02 | PASS (UNIT) | `services/cogniate-app/src/kernel/records/migration.test.ts > records migration > AC-LA-E4-02-02: one runtime key encoder equals SQLite json_array for empty and escaped strings` | as AC-01 | Runtime `external_key` encoder matches SQLite `json_array(deployment_id, context_id, resource_link_id)` for standard strings, empty context id `""`, and escaped characters. `unit-rows-by-id.log` |
| AC-LA-E4-02-03 | PASS (UNIT) | `services/cogniate-app/src/kernel/records/records.test.ts > final records > AC-LA-E4-02-03: T5a best-result sequence keeps the golden dispatch rows and writes immutable facts only on improvement` + `AC-LA-E4-02-03: T5b HTML completion and repeated unload keep one golden dispatch; previews keep none` (2 tests) | as AC-01 | Non-preview new best final result writes one `final` learning record and one dispatch; preview commits write none; T5a and T5b commit sequences produce dispatch rows equal to the baseline score sync golden rows. `unit-rows-by-id.log` |
| AC-LA-E4-02-04 | PASS (UNIT) | `services/cogniate-app/src/kernel/records/outbox.test.ts > job store contract: AC-LA-E4-02-04 app migration 014` (11 tests) + `queue store contract: AC-LA-E4-02-04 shipped app outbox` (7 tests) + `outbox row safety > AC-LA-E4-02-04: a copied in-flight confirmation with no lease sends once after its original bound` + `packages/shared/src/jobs.test.ts > AC-LA-E4-02-04` + `services/lti-service/src/jobs/index.test.ts > AC-LA-E4-02-04` (21 tests) | as AC-01 | Full LA-E4-01 store-contract suite passes on the migrated app job store with two runners: (1) one lease / `send_started_at` at a time per `(placement, learner_subject, reporter)` and ordered start; (2) stale boot id changes no row; (3) recovery respects live foreign leases, sets `delivery_uncertain = 1` on own/expired/`NULL` leases, and a copied row with `send_started_at` and a pending confirmation gets one confirmation send `>= 5 s` after the first accepted send inside its 24 h window (`A-LAB-19`). `unit-rows-by-id.log` |
| AC-LA-E4-02-05 | PASS (K0) | F5 `no-score-sync` (`infra/scripts/fitness/rules/no-score-sync.mjs` + `infra/scripts/fitness/fitness.test.mjs`) | `npm run --silent fitness:rules` + `--stdin --as services/cogniate-app/src/domain/zz-probe.ts` / `services/cogniate-app/src/domain/migrations/015_future.sql` / `014_learning_records.sql` | Clean tree passes `fitness:rules` (`0` hits across 5 rules). Negative probes naming `score_sync` in `services/cogniate-app/src/domain/zz-probe.ts` and unapplied migration `services/cogniate-app/src/domain/migrations/015_future.sql` fail with exit code `1` (`no-score-sync  score_sync is frozen after migration 014; use record_dispatch (LA-ADR-04 D5)`). Positive probe in applied migration `services/cogniate-app/src/domain/migrations/014_learning_records.sql` exits `0`. `k0/f5-*.log` |
| AC-LA-E4-02-06 | pending: Docker window (K1-SIM) | Lead QA U1 run (TEST-STRATEGY §4.5) | Lead QA SIM slot | Pending Docker window. |
| AC-LA-E4-02-07 | pending: Docker window (K1-SIM) | Lead QA M1 `migration` and `snapshot-upgrade` phases | Lead QA SIM slot | Pending Docker window. |
| AC-LA-E4-02-08 | pending: Docker window (K1-SIM) | QA-3 / Lead QA golden G3 compare | SIM slot | Pending Docker window. |
| AC-LA-E4-02-09 | pending: Docker window (K1-SIM) | Lead QA R1 (`M1 --phase sim` + `M2`) | Lead QA SIM slot | Pending Docker window. |
| AC-LA-E4-02-10 | pending: Docker window (MOODLE-LIVE) | Lead QA / QA-E2E Moodle slot (T5a, T5b with LD-6 `record_dispatch` fixture, T7 × 1) | Moodle slot | Pending Docker window. |
| AC-LA-E4-02-11 | PASS (UNIT) | `services/cogniate-app/src/kernel/records/records.test.ts > final records > AC-LA-E4-02-11: a placement without context shows the course name dash` | as AC-01 | Results row of a placement whose context id is `""` (launch without context, `LA-ADR-05` D2) displays course name `"—"`. `unit-rows-by-id.log` |
| AC-LA-E4-02-12 | PASS (UNIT) | `services/cogniate-app/src/kernel/records/outbox.test.ts > outbox row safety > AC-LA-E4-02-12: a superseded send marker requires exactly one successful confirmation` | as AC-01 | With a superseded row of the same key that still has `send_started_at`, an accepted higher row stays `pending` with `confirmation_after >= 5 s` later and becomes `sent` only after one successful confirmation (`LA-ADR-03` D7, `A-LAB-12`). `unit-rows-by-id.log` |
| AC-LA-E4-02-13 | PASS (UNIT) | `packages/shared/src/jobs.test.ts > queue store contract: reference SQLite store > AC-LA-E4-02-13: an unexpected remote error moves its row and the next row of its partition is sent` + `services/cogniate-app/src/kernel/records/outbox.test.ts > queue store contract: AC-LA-E4-02-04 shipped app outbox > AC-LA-E4-02-13: an unexpected remote error moves its row and the next row of its partition is sent` + `outbox row safety > AC-LA-E4-02-13: corrupt payload moves one row, sends its neighbour, and expires inside the original window` (3 tests) | as AC-01 | When a reporter throws inside `send(work)` or row work throws on a corrupt payload, the outbox catches the error, increments tries with a later `next_try_at`, and sends the next row of the same partition (`BD-A1-10` item 2). `unit-rows-by-id.log` |

### R0 `npm run check` counts at `d2166d7` (`check.log`, `counts.json`)

| Suite | LA-E0-01 baseline (`1b17261`) | At `d2166d7` |
| --- | --- | --- |
| Vitest (`test:unit`) | 97 files; 1,351 passed, 5 skipped | 147 files; 2,403 passed, 5 skipped |
| Infra (`test:infra`, `node --test`) | 197 pass, 0 fail | 230 pass, 0 fail |
| K0 (`test:k0`) | — | 3 files; 121 passed |
| F1 (`fitness:lms-names`) | — | `F1 PASS: 20 files with hits, 74 hits` |
| F5 (`fitness:rules`) | — | `F5 PASS: 5 rules (audit-event-delete, channel-sql-tables, connection-lms, no-score-sync, sql-portability), 0 hits` |

## Other checks

- **File scope (`68308e1..db7333f`):** `LA-E4-02` touches `services/cogniate-app/src/domain/migrations/014_learning_records.sql`, `services/cogniate-app/src/kernel/records/**`, `services/cogniate-app/src/domain/{attempts,launch,results,retention,score-syncs,domain.test,migration-013.test}.ts`, `services/cogniate-app/src/{config,main,runtime-path.test}.ts`, `packages/shared/src/jobs*.ts`, `packages/channel-kernel/src/{index,legacy-wire}.ts` (RQ-2), and `infra/scripts/fitness/**` (`no-score-sync.mjs`). Note: `db7333f` also updated assertions in `services/cogniate-app/src/worker/score-sync.test.ts`, `services/cogniate-app/src/app/redemption.test.ts` and `services/cogniate-app/src/kernel/registry.test.ts` for migration `014` (Reviewer-A `LA-E4-02/reviewer-a.md` noted and approved this as 1 MINOR). No `services/lti-service/**` or `services/cogniate-app/src/testkit.ts` files were edited.
- **Clone cleanliness:** `git status --porcelain` in `~/cogniate-qa-runs/LA/LA-E4-02/r1/clone` is empty after the run (`status-after.txt`, 0 bytes).

## Regression and time

R0 (`npm run check` on the clean clone): PASS. K1-SIM (`AC-06` to `AC-09`) and MOODLE-LIVE (`AC-10`): `pending: Docker window`. Measured time of `-t "AC-LA-E4-02-"` (29 unit tests across 5 files): `4.81s`; F5 `no-score-sync` K0 probes: `0.6s`.
