Verdict: PASS (K0 + UNIT + K1-SIM AC-02, AC-03, AC-04; AC-05 pending next slot after 08:05Z; MOODLE-LIVE AC-09 pending Moodle slot)
Round: 4

# LA-E4-03 The `lti-ags` record reporter, throttling and the read-back guard: QA verification

Tester: QA-3 (Round 1: task `task_bdc23b632bbb` / `ctx_da00a2da9dd0`; Round 2: task `task_241dc471afe8` / `ctx_44be6cfd9586`; Round 3: task `task_ca544d19e96b` / `ctx_fce3d399cb78`; Round 4 Slot 4: task `task_e59ce20f8f0f` / `ctx_e6263da242a0`), 2026-10-23. Spec: `docs/architecture/ltiaas/tasks/LA-E4-03.md` (with `LA-IC-11`, `LA-IC-15`, `BD-A1-27`, `BD-A1-61`). Suite: `tests/ltiaas/tasks-core/LA-E4-03/` (QA-3 test-first).

Independence: QA-3 did not read product source (`services/**`, `packages/**`, `apps/**`), Author notes or reviewer files (except `docs/reviews/LA-E4-03/reviewer-{a,b}.md` in Rounds 2–3 to verify finding closures). QA-3 verified all K0 and UNIT ACs in isolated `--no-hardlinks` clones (`d40826d` in Round 1; `836d579` in Round 2; `894406f` in Round 3) and K1-SIM in Slot 4 at `e1e4fab` (`COMPOSE_PROJECT_NAME=qa3-la-sim-r3`).

## Round 4 (Slot 4 K1-SIM on `e1e4fab`)

| Item | Value |
| --- | --- |
| SHA | `e1e4fabf451276d6b5d2c07cb28024ad8ef6f271` (`e1e4fab`, code `5171f7f`) |
| Lane and slot | lane R; Slot 4 Docker SIM (`COMPOSE_PROJECT_NAME=qa3-la-sim-r3`, `PUBLIC_PORT=9453`, `STACK_SUBNET=172.21.0.0/16`) |
| Artifacts | `~/cogniate-qa-runs/LA/qa3-slot4-e1e4fab/artifacts/qa3-la-sim-r3-e1e4fabf-2026-10-23T06-35-01-035Z/` (`cmd/11-test-acceptance-LA-E4-03.log`, `container-LA-E4-03/vitest-results.json`, `reports/LA-E4-03.json`) |

| AC | Result | Test id | Evidence |
| --- | --- | --- | --- |
| AC-LA-E4-03-02 | PASS (K1-SIM) | `reporter.k1sim.test.ts > AC-LA-E4-03-02: K1-AGS A1-A6 pass on the Moodle-shaped standard, Canvas and Blackboard simulator channels (including LA-IC-15 per-channel 409 text)` | Live K1-SIM (`20,916.7 ms`): K1-AGS A1–A6 pass on Moodle (`standard`), Canvas and Blackboard simulator channels, including assertion `aud` forms, score body, per-channel `409` conflict text `"{LMS} has a grade with a newer time"`, no send for staff preview, no send for a disabled connection, and off-origin service URL refusal. `11-test-acceptance-LA-E4-03.log` |
| AC-LA-E4-03-03 | PASS (K1-SIM) | `reporter.k1sim.test.ts > AC-LA-E4-03-03: simulator score POST 429 with Retry-After: 30 keeps row pending with tries unchanged, logs dispatch_throttled, and delays next POST >= 30 s` | Live K1-SIM (`31,881.3 ms`): simulator `429` with `Retry-After: 30` keeps row `pending` with `tries === 0`, logs `dispatch_throttled {dispatch_id, partition, retry_at}`, and delays the next score POST by `>= 30 s` (`/__sim/records`). `11-test-acceptance-LA-E4-03.log` |
| AC-LA-E4-03-04 | PASS (K1-SIM) | `reporter.k1sim.test.ts > AC-LA-E4-03-04: fairness with transport gate (hold_before on score path of platform A): platform B score is sent before release; two held rows of platform A are forwarded one at a time` | Live K1-SIM (`1,612.0 ms`): while platform A's first score POST is held at `lti-gate` (`held_before`), platform B's score completes as `sent` before release, and platform A's two rows are forwarded one at a time. `11-test-acceptance-LA-E4-03.log` |
| AC-LA-E4-03-05 | pending next slot after 08:05Z | `reporter.k1sim.test.ts > AC-LA-E4-03-05` | Updated `reporter.k1sim.test.ts` to pass the same `{ resourceLinkId: "p2-" + pub.id }` to both `canvasPlay` calls (with `await newVersion(cv, pub)` before the second attempt) so the `9/10` row supersedes the held `5/10` row on the same `placement_id`; ready to run in the post-08:05Z slot. |

## Round 3

| Item | Value |
| --- | --- |
| SHA | `894406f365148378d7089de8c56e619a1dbfe18a` (integration `894406f`; holds `LA-E4-03` fix round 2 merge `9e4bc18` over `ecd59cd`: status-independent `429` pause check, app migration `017_record_dispatch_pause` partial index, failed/superseded carrier keeps pause, release at `retryAt`) |
| Lane and slot | lane R; no Docker (HOST-ONLY; K1-SIM and MOODLE-LIVE rows marked `pending: Docker window`) |
| Clone | `~/cogniate-qa-runs/LA/LA-E4-03/r3/clone`: `git clone --no-hardlinks --no-checkout`, detached at `894406f365148378d7089de8c56e619a1dbfe18a`, push URL `DISABLED`, `npm ci` at root |
| Environment | macOS arm64, Node 24.21.0, npm 11.19.0 |
| Artifacts | private run folder `~/cogniate-qa-runs/LA/LA-E4-03/r3/` (umask 077): `npm-ci.log`, `k0-vitest.log`, `throttling-unit.log`, `k0/e4-03-check-clean.log`, `k0/e4-03-unit-rows.log`, `k0/e4-03-r2-unit-suites.log`, `status-after.txt` |

### Round 3 acceptance criteria and fix-round checks (`9e4bc18` / `A-LA-E4-03-03`)

| AC / Check | Result | Test id | Command | Evidence |
| --- | --- | --- | --- | --- |
| `A-LA-E4-03-03` (status-independent `429` pause check + app migration `017_record_dispatch_pause`) | PASS (K0 + UNIT) | `reporter.k0.test.ts` + `services/cogniate-app/src/kernel/records/throttling.test.ts > partition throttling (LA-ADR-03 D7) > A-LA-E4-03-01, A-LA-E4-03-03: the pause check reads every row status through the record_dispatch_pause index` | `LA_LEVEL=k0 LA_SCRATCH_CLONE=$PWD LA_RUN_DIR=~/cogniate-qa-runs/LA/LA-E4-03/r3/k0 npx --no-install vitest run --config tests/ltiaas/tasks-core/LA-E4-03/vitest.config.mts --reporter=verbose` | App migration `017_record_dispatch_pause.sql` (`016` reserved for `LA-E6-02`) creates the partial index `record_dispatch_pause` on `(partition_key, not_before) WHERE not_before IS NOT NULL`, and the `429` partition pause check reads every row of the partition regardless of status (`pending`, `failed`, `superseded`) through `record_dispatch_pause`. `throttling-unit.log`, `k0/e4-03-r2-unit-suites.log` |
| `A-LA-E4-03-03` (window-end failed carrier followed by a new learner; release at `retryAt`) | PASS (UNIT + K0) | `services/cogniate-app/src/kernel/records/throttling.test.ts > partition throttling (LA-ADR-03 D7) > A-LA-E4-03-03: a carrier that failed at its window end still pauses a new learner until exactly retryAt` | `npx --no-install vitest run --reporter=verbose services/cogniate-app/src/kernel/records/throttling.test.ts` | When the last pending carrier row receives `429` near the end of its 24 h retry window and transitions to `failed` with a future `not_before = retryAt`, a new dispatch row for a new learner in the same partition is blocked by `due`, `lease`, and `beginSend` before `retryAt`, and is released at `retryAt`. `throttling-unit.log` |
| `A-LA-E4-03-03` (window-end failed carrier followed by a better result of the same learner; release at `retryAt`) | PASS (UNIT + K0) | `services/cogniate-app/src/kernel/records/throttling.test.ts > partition throttling (LA-ADR-03 D7) > A-LA-E4-03-03: a carrier that failed at its window end still pauses a better result of the same learner until exactly retryAt` | as above | When the carrier row transitions to `failed` at its 24 h window end with `not_before = retryAt`, a new better result for the same learner inherits/honours the partition pause across `due`, `lease`, and `beginSend` until `retryAt`, then releases at `retryAt`. `throttling-unit.log` |
| `A-LA-E4-03-01` (superseded carrier keeps pause) | PASS (UNIT + K0) | `services/cogniate-app/src/kernel/records/throttling.test.ts > partition throttling (LA-ADR-03 D7) > A-LA-E4-03-01: a new better row keeps the pause of the row that it supersedes` | as above | Superseding a paused carrier row preserves the partition pause. `throttling-unit.log` |
| AC-LA-E4-03-01, -06, -07, -08 (`B-01..04`, `A-02`) | PASS (K0 + UNIT) | `reporter.k0.test.ts` (3/3 passed) + 9 unit files (144 tests passed) | as first row | All UNIT ACs, neutral kernel checks (`0` `'lti-ags'` literals in `kernel/records/**`, M1 `score_sync` and `sync_` unchanged), and Round 2 fixes remain green. `k0/e4-03-unit-rows.log`, `k0/e4-03-r2-unit-suites.log` |
| AC-LA-E4-03-02..05, -09 | pending: Docker window (K1-SIM / MOODLE-LIVE) | `reporter.k1sim.test.ts > AC-LA-E4-03-02..05`, Moodle slot (`T5a`, `T5b`, `T7 × 1`) | SIM / Moodle slots | Pending Docker window. |

### R0 `npm run check` counts at `894406f` (`k0/e4-03-check-clean.log`)

| Suite | Round 1 (`d40826d`) | Round 2 (`836d579`) | Round 3 (`894406f`) |
| --- | --- | --- | --- |
| Vitest (`test:unit`) | 155 files; 2,498 passed, 5 skipped | 169 files; 2,743 passed, 5 skipped | 174 files; 2,803 passed, 5 skipped |
| Infra (`test:infra`, `node --test`) | 243 pass, 0 fail | 252 pass, 0 fail | 254 pass, 0 fail |
| K0 (`test:k0`) | 3 files; 121 passed | 3 files; 121 passed | 3 files; 121 passed |
| F1 (`fitness:lms-names`) | `F1 PASS: 20 files with hits, 74 hits` | `F1 PASS: 9 files with hits, 29 hits` | `F1 PASS: 5 files with hits, 13 hits` |
| F5 (`fitness:rules`) | `F5 PASS: 6 rules, 0 hits` | `F5 PASS: 6 rules, 0 hits` | `F5 PASS: 6 rules (audit-event-delete, channel-sql-tables, connection-lms, no-score-sync, protocol-urls, sql-portability), 0 hits` |

### Round 3 other checks

- **File scope (`ecd59cd..9e4bc18^2`):** Fix round 2 touches `services/cogniate-app/src/domain/migrations/017_record_dispatch_pause.sql` and `services/cogniate-app/src/kernel/records/{dispatch-store,outbox,records,throttling.test}.ts` (plus `infra/scripts/fitness/applied-migrations.json` stays unchanged since `017` is a new LA migration, not a pre-LA applied migration).
- **Clone cleanliness:** `git status --porcelain` in `~/cogniate-qa-runs/LA/LA-E4-03/r3/clone` is empty after the run (`status-after.txt`, 0 bytes).
- **Measured time (Round 3):** `reporter.k0.test.ts` (3 K0 tests) `126.03s` (`R0 & file layout` `7ms`, `UNIT rows` `7.13s`, `Round 2/3 checks` `1.53s`, `npm run check` in `beforeAll` `117.4s`); `throttling.test.ts` (9 tests) `494ms`.

---

## Round 2

| Item | Value |
| --- | --- |
| SHA | `836d579f2a42f7d44b6e470d1e74a17bb46aaee2` (integration `836d579`; holds `LA-E4-03` fix round 1 merge `5f9fd55` over `8083669`, including RQ-2 `b22fe80` on K files and `BD-A1-61`) |
| Lane and slot | lane R; no Docker (HOST-ONLY; K1-SIM and MOODLE-LIVE rows marked `pending: Docker window`) |
| Clone | `~/cogniate-qa-runs/LA/LA-E4-03/r2/clone`: `git clone --no-hardlinks --no-checkout`, detached at `836d579f2a42f7d44b6e470d1e74a17bb46aaee2`, push URL `DISABLED`, `npm ci` at root |
| Environment | macOS arm64, Node 24.21.0, npm 11.19.0 |
| Artifacts | private run folder `~/cogniate-qa-runs/LA/LA-E4-03/r2/` (umask 077): `npm-ci.log`, `k0-vitest.log`, `unit-rows-by-id.log`, `unit-rows-files.log`, `k0/e4-03-check-clean.log`, `k0/e4-03-unit-rows.log`, `k0/e4-03-r2-unit-suites.log`, `status-after.txt` |

### Round 2 acceptance criteria and fix-round checks

| AC / Finding | Result | Test id | Command | Evidence |
| --- | --- | --- | --- | --- |
| AC-LA-E4-03-01 (`B-LA-E4-03-02`, `B-LA-E4-03-03`) | PASS (UNIT + K0) | `reporter.k0.test.ts` + `services/cogniate-app/src/drivers/lti-ags/reporter.test.ts > AC-LA-E4-03-01: AGS transport mapping` (31 tests, including `B-LA-E4-03-02: the reporter computes the partition of a placement from its LTI platform`, `B-LA-E4-03-03: a dispatch whose placement has no resource link fails locally at once`, `B-LA-E4-03-03: stored texts keep the 300-character limit`) + `services/cogniate-app/src/drivers/lti-ags/connection-state.test.ts` (10 tests) + `services/cogniate-app/src/kernel/records/throttling.test.ts` (7 tests) + `packages/tracking/src/tracking.test.ts` (60 tests) | `LA_LEVEL=k0 LA_SCRATCH_CLONE=$PWD LA_RUN_DIR=~/cogniate-qa-runs/LA/LA-E4-03/r2/k0 npx --no-install vitest run --config tests/ltiaas/tasks-core/LA-E4-03/vitest.config.mts --reporter=verbose` | Mapping table (`2xx` → `accepted`, `409` → `conflict` with per-channel `"{LMS} has a grade with a newer time"`, `400`/`403`/`404`/`422` → `rejected`, `0`/`401`/`5xx` → `retryable`, `429` `PLATFORM_RATE_LIMITED`/`RATE_LIMITED` → `throttled` with normalized `Retry-After`) holds; a dispatch without a placement row returns `NO_GRADEBOOK_COLUMN` (`local_failure`) immediately without `"undefined"` strings (`B-LA-E4-03-03`); the reporter computes `partitionKey(p: PlacementView)` from its LTI platform (`B-LA-E4-03-02`, `BD-A1-61`). `k0/e4-03-unit-rows.log`, `unit-rows-files.log` |
| AC-LA-E4-03-02..05 | pending: Docker window (K1-SIM) | `reporter.k1sim.test.ts > AC-LA-E4-03-02..05` | QA-3 SIM slot (`qa3-la-sim-r<n>`, `PUBLIC_PORT` 9443, `STACK_SUBNET` 172.20.0.0/16) | Pending Docker window. |
| AC-LA-E4-03-06 | PASS (UNIT + K0) | `services/cogniate-app/src/app/results.test.ts > results guards and read-back > AC-LA-E4-03-06: no read-back capability or implementation gives 409 (false, true)` + `(true, false)` + `AC-LA-E4-03-06: the baseline reporter reads only the learner result and stores it` (3 tests) | as AC-01 | `POST …/results/refresh` returns `409 CAPABILITY_NOT_SUPPORTED` (`details.capability = "records.readBack"`) when `records.readBack` is absent or the reporter lacks `readBack`; baseline channels read/store only the learner result. `k0/e4-03-unit-rows.log` |
| AC-LA-E4-03-07 | PASS (UNIT + K0) | `services/cogniate-app/src/app/results.test.ts > results guards and read-back > AC-LA-E4-03-07: a disabled operator-grant connection refuses refresh and Resend before remote calls` + `services/cogniate-app/src/drivers/lti-ags/connection-state.test.ts` (10 tests) | as AC-01 | Disabled `operatorGrant` rows become `failed` with `CONNECTION_DISABLED` and no POST; Resend and refresh return `409 CONNECTION_NOT_READY`. `k0/e4-03-unit-rows.log`, `unit-rows-files.log` |
| AC-LA-E4-03-08 | PASS (UNIT + K0) | `services/cogniate-app/src/kernel/records/throttling.test.ts > partition throttling (LA-ADR-03 D7) > AC-LA-E4-03-08: refuses everyRecord at outbox registration and registers nothing` | as AC-01 | Outbox registration refuses any reporter whose `policy` is not `bestResult` and registers nothing. `k0/e4-03-unit-rows.log` |
| AC-LA-E4-03-09 | pending: Docker window (MOODLE-LIVE) | Lead QA / QA-E2E Moodle slot (`T5a`, `T5b`, `T7 × 1`) | Moodle slot | Pending Docker window. |
| `A-LA-E4-03-01` (pause check served by `record_dispatch_due`) | PASS (UNIT) | `services/cogniate-app/src/kernel/records/throttling.test.ts > partition throttling (LA-ADR-03 D7) > A-LA-E4-03-01: the pause check reads only pending rows through the record_dispatch_due index` + `A-LA-E4-03-01: a new better row keeps the pause of the row that it supersedes` | `npx --no-install vitest run --reporter=verbose services/cogniate-app/src/kernel/records/throttling.test.ts` | The paused-partition query filters `paused.status = 'pending'`, using the `record_dispatch_due` index rather than scanning `record_dispatch`, and superseding a paused row preserves the partition pause on the new row. `unit-rows-files.log` |
| `A-LA-E4-03-02` (owner check first) | PASS (UNIT) | `services/cogniate-app/src/kernel/records/throttling.test.ts > partition throttling (LA-ADR-03 D7) > A-LA-E4-03-02: a run that lost its lease during the POST neither takes back the try nor pauses the partition` | as `A-01` | Ownership (`ownsDispatch`) is verified first inside the throttle transaction before undoing `tries - 1` or setting `not_before`. `unit-rows-files.log` |
| `B-LA-E4-03-01`, `B-LA-E4-03-04` (neutral kernel names; M1 `score_sync` and `sync_` unchanged) | PASS (K0 + UNIT) | `reporter.k0.test.ts > Round 2 (5f9fd55 / BD-A1-61)` + `services/cogniate-app/src/kernel/records/neutral.test.ts > B-LA-E4-03-01: reporter-neutral record kernel` (8 tests) + `services/cogniate-app/src/app/results.test.ts > results guards and read-back > B-LA-E4-03-01: Resend keeps the M1 answers and shows only the rows of the results reporter` | as AC-01 | Every product file in `services/cogniate-app/src/kernel/records/` (`dispatch-store.ts`, `job-store.ts`, `outbox.ts`, `placements.ts`, `records.ts`, `shutdown.ts`, `types.ts`) has `0` `'lti-ags'` literals, `0` driver imports, and neutral function names (`failDisabledDispatch`, `isCurrentDispatch`), while the M1 values `score_sync` and `sync_` remain unchanged on the `lti-ags` reporter and results view. `k0/e4-03-r2-unit-suites.log`, `unit-rows-files.log` |
| `B-LA-E4-03-02` (`BD-A1-61`: one `registerRecordReporters` call; `RecordReporter` docs) | PASS (UNIT) | `services/cogniate-app/src/kernel/records/records.test.ts > B-LA-E4-02-01/02, B-LA-E4-03-02: one registration call; the reporter instance prepares, partitions and delivers` | `npx --no-install vitest run --reporter=verbose services/cogniate-app/src/kernel/records/records.test.ts` | `registerRecordReporters(db, reporters)` registers reporters for both final record creation and the outbox `QueueJob` in a single call (`BD-A1-61`). `unit-rows-files.log` |

### R0 `npm run check` counts at `836d579` (`k0/e4-03-check-clean.log`)

| Suite | Round 1 (`d40826d`) | Round 2 (`836d579`) |
| --- | --- | --- |
| Vitest (`test:unit`) | 155 files; 2,498 passed, 5 skipped | 169 files; 2,743 passed, 5 skipped |
| Infra (`test:infra`, `node --test`) | 243 pass, 0 fail | 252 pass, 0 fail |
| K0 (`test:k0`) | 3 files; 121 passed | 3 files; 121 passed |
| F1 (`fitness:lms-names`) | `F1 PASS: 20 files with hits, 74 hits` | `F1 PASS: 9 files with hits, 29 hits` |
| F5 (`fitness:rules`) | `F5 PASS: 6 rules, 0 hits` | `F5 PASS: 6 rules (audit-event-delete, channel-sql-tables, connection-lms, no-score-sync, protocol-urls, sql-portability), 0 hits` |

### Round 2 other checks

- **File scope (`8083669..5f9fd55^2`):** Fix round 1 touches `services/cogniate-app/src/drivers/lti-ags/{index,partition,reporter.test}.ts`, `services/cogniate-app/src/kernel/records/**`, `services/cogniate-app/src/{app,domain}/results*.ts`, and RQ-2 `b22fe80` (`services/cogniate-app/src/{testkit,tool-pages/play,worker-main}.ts`).
- **Clone cleanliness:** `git status --porcelain` in `~/cogniate-qa-runs/LA/LA-E4-03/r2/clone` is empty after the run (`status-after.txt`, 0 bytes).
- **Measured time (Round 2):** `reporter.k0.test.ts` (3 K0 tests) `114.47s` (`R0 & file layout` `7ms`, `UNIT rows` `6.33s`, `Round 2 checks` `1.31s`, `npm run check` in `beforeAll` `106.8s`); standalone 9 unit files (142 tests) `776ms`.

---

## Round 1

| Item | Value |
| --- | --- |
| SHA | `d40826d765649b5ece01e23d26e53ccd2df7a14b` (integration `d40826d`; holds `LA-E4-03` merge `a285bdb` over base `3b14a84`) |
| Lane and slot | lane R; no Docker (HOST-ONLY; K1-SIM and MOODLE-LIVE rows marked `pending: Docker window`) |
| Clone | `~/cogniate-qa-runs/LA/LA-E4-03/r1/clone`: `git clone --no-hardlinks --no-checkout`, detached at `d40826d765649b5ece01e23d26e53ccd2df7a14b`, push URL `DISABLED`, `npm ci` at root |
| Environment | macOS arm64, Node 24.21.0, npm 11.19.0 |
| Artifacts | private run folder `~/cogniate-qa-runs/LA/LA-E4-03/r1/` (umask 077): `npm-ci.log`, `k0-vitest.log`, `unit-rows-by-id.log`, `unit-rows-files.log`, `k0/e4-03-check-clean.log`, `k0/e4-03-unit-rows.log`, `status-after.txt` |

## Acceptance criteria

| AC | Result | Test id | Command | Evidence |
| --- | --- | --- | --- | --- |
| AC-LA-E4-03-01 | PASS (UNIT + K0) | `reporter.k0.test.ts` + `services/cogniate-app/src/drivers/lti-ags/reporter.test.ts > AC-LA-E4-03-01: AGS transport mapping` (28 tests) + `services/cogniate-app/src/drivers/lti-ags/connection-state.test.ts > moodle/canvas/blackboard uses its 409 name and keeps the frozen learner fallback` + `services/cogniate-app/src/kernel/records/throttling.test.ts > partition throttling (LA-ADR-03 D7)` (3 tests) + `packages/tracking/src/tracking.test.ts` | `LA_LEVEL=k0 LA_SCRATCH_CLONE=$PWD LA_RUN_DIR=~/cogniate-qa-runs/LA/LA-E4-03/r1/k0 npx --no-install vitest run --config tests/ltiaas/tasks-core/LA-E4-03/vitest.config.mts --reporter=verbose` | `200`/`201`/`204`/`299` → `accepted` (with prepared AGS body and `beginSend` marker first); `409` → `conflict` with per-channel `"{LMS} has a grade with a newer time"` (`Moodle`, `Canvas`, `Blackboard`, plus neutral fallback for unknown channel; `LA-IC-15`, `BD-A1-27`); `400`, `403`, `404`, `422` → `rejected`; `0`, `401`, `500`, `502`, `503`, `504` → `retryable` (`uncertain` only for no answer or `5xx` after POST began); `429` with `PLATFORM_RATE_LIMITED` or `RATE_LIMITED` → `throttled` with `retryAt` normalized from `Retry-After` (`[1, 3600]` s, default `60` s) without counting a try or introducing uncertainty. `k0/e4-03-unit-rows.log`, `unit-rows-files.log` |
| AC-LA-E4-03-02 | pending: Docker window (K1-SIM) | `reporter.k1sim.test.ts > AC-LA-E4-03-02` | QA-3 SIM slot (`qa3-la-sim-r<n>`, `PUBLIC_PORT` 9443, `STACK_SUBNET` 172.20.0.0/16) | Pending Docker window. |
| AC-LA-E4-03-03 | pending: Docker window (K1-SIM) | `reporter.k1sim.test.ts > AC-LA-E4-03-03` | QA-3 SIM slot | Pending Docker window. |
| AC-LA-E4-03-04 | pending: Docker window (K1-SIM) | `reporter.k1sim.test.ts > AC-LA-E4-03-04` | QA-3 SIM slot | Pending Docker window. |
| AC-LA-E4-03-05 | pending: Docker window (K1-SIM) | `reporter.k1sim.test.ts > AC-LA-E4-03-05` | QA-3 SIM slot | Pending Docker window. |
| AC-LA-E4-03-06 | PASS (UNIT + K0) | `reporter.k0.test.ts` + `services/cogniate-app/src/app/results.test.ts > results guards and read-back > AC-LA-E4-03-06: no read-back capability or implementation gives 409 (false, true)` + `AC-LA-E4-03-06: no read-back capability or implementation gives 409 (true, false)` + `AC-LA-E4-03-06: the baseline reporter reads only the learner result and stores it` (3 tests) | as AC-01 | `POST …/results/refresh` returns `409 CAPABILITY_NOT_SUPPORTED` with `details.capability = "records.readBack"` when the channel lacks `records.readBack` or the reporter lacks `readBack`; baseline channels (`moodle`, `canvas`, `blackboard`) declare `records.readBack: true` and read/store only the learner result as before. `k0/e4-03-unit-rows.log` |
| AC-LA-E4-03-07 | PASS (UNIT + K0) | `reporter.k0.test.ts` + `services/cogniate-app/src/app/results.test.ts > results guards and read-back > AC-LA-E4-03-07: a disabled operator-grant connection refuses refresh and Resend before remote calls` + `services/cogniate-app/src/drivers/lti-ags/connection-state.test.ts` (10 tests: `AC-LA-E1-06-06`, `B-M1-01`) | as AC-01 | On a disabled `operatorGrant` connection, due rows become `failed` with `CONNECTION_DISABLED` and no POST (while `self` connections still send), and Resend and refresh return `409 CONNECTION_NOT_READY` before any remote call. `k0/e4-03-unit-rows.log`, `unit-rows-files.log` |
| AC-LA-E4-03-08 | PASS (UNIT + K0) | `reporter.k0.test.ts` + `services/cogniate-app/src/kernel/records/throttling.test.ts > partition throttling (LA-ADR-03 D7) > AC-LA-E4-03-08: refuses everyRecord at outbox registration` | as AC-01 | Outbox registration refuses any reporter whose `policy` is not `bestResult` (`everyRecord` is reserved for LC). `k0/e4-03-unit-rows.log` |
| AC-LA-E4-03-09 | pending: Docker window (MOODLE-LIVE) | Lead QA / QA-E2E Moodle slot (T5a, T5b, T7 × 1) | Moodle slot | Pending Docker window. |

### R0 `npm run check` counts at `d40826d` (`k0/e4-03-check-clean.log`)

| Suite | LA-E0-01 baseline (`1b17261`) | At `d40826d` |
| --- | --- | --- |
| Vitest (`test:unit`) | 97 files; 1,351 passed, 5 skipped | 155 files; 2,498 passed, 5 skipped |
| Infra (`test:infra`, `node --test`) | 197 pass, 0 fail | 243 pass, 0 fail |
| K0 (`test:k0`) | — | 3 files; 121 passed |
| F1 (`fitness:lms-names`) | — | `F1 PASS: 20 files with hits, 74 hits` |
| F5 (`fitness:rules`) | — | `F5 PASS: 6 rules (audit-event-delete, channel-sql-tables, connection-lms, no-score-sync, protocol-urls, sql-portability), 0 hits` |

## Other checks

- **File scope and layout (`3b14a84..a285bdb`):** `services/cogniate-app/src/drivers/lti-ags/` is created (`index.ts`, `line-item.ts`, `reporter.test.ts`, `connection-state.test.ts`); `services/cogniate-app/src/worker/` is completely removed (`0` tracked files in git and directory absent on disk); `services/cogniate-app/src/kernel/records/**`, `services/cogniate-app/src/app/results*.ts`, `services/cogniate-app/src/clients/lti-client.ts`, `packages/tracking/src/{outcome,index,tracking.test}.ts`, and `infra/scripts/fitness/**` (split legacy table detection in `no-score-sync.mjs`) are updated. Neither `packages/tracking/src/status-text.ts`, `packages/tracking/src/html.ts`, nor `services/lti-service/**` were edited. Note: `a285bdb` also adapted test imports in `services/cogniate-app/src/{testkit,tool-pages/play}.ts` after removing `worker/score-sync.ts`.
- **Clone cleanliness:** `git status --porcelain` in `~/cogniate-qa-runs/LA/LA-E4-03/r1/clone` is empty after the run (`status-after.txt`, 0 bytes).

## Regression and time

R0 (`npm run check` on the clean clone): PASS. K1-SIM (`AC-02` to `AC-05`) and MOODLE-LIVE (`AC-09`): `pending: Docker window`. Measured time of `reporter.k0.test.ts`: `99.69s` (`R0 & file layout` `7ms`, `UNIT rows` `7.02s`, `npm run check` in `beforeAll` `92.6s`).
