Verdict: PASS (K0 + UNIT + K1-SIM `AC-05` PASS; `AC-07`/`AC-08` covered by Wave-End Gate Slot 3B `LA-E7-08`)
Round: 3

# LA-E1-06 S4 Migration 013 and the channel and authority reads: QA verification

Tester: QA-3 (Orca task `task_d6623272a952`, dispatch `ctx_23fdc72bce22`), 2026-10-22. Spec: `docs/architecture/ltiaas/tasks/LA-E1-06.md` (with `BD-A1-11`, `BD-A1-12`, `BD-A1-17`, `BD-A1-19`). Suite: `tests/ltiaas/tasks-core/LA-E1-06/` (QA-3 test-first).

Independence: QA-3 did not read product source (`services/**`, `packages/**`, `apps/**`), Author notes or reviewer files. QA-3 verified the K0 and UNIT ACs in an isolated clone of `b3af690` through `npm run check`, `fitness:lms-names` (F1), `fitness:rules` (F5) and Vitest.

| Item | Value |
| --- | --- |
| SHA | `b3af69059a6529b1b2882b72c1869b50749f91e6` (integration `b3af690`; holds `LA-E1-06` merge `dc67c14` over base `265d6d0` and `BD-A1-19` F1 exact-token exception for migration `013` merged at `8a1ef2d`) |
| Lane and slot | lane K; no Docker (HOST-ONLY; K1-SIM rows marked `pending: Docker window`) |
| Clone | `~/cogniate-qa-runs/LA/LA-E1-06/r1/clone`: `git clone --no-hardlinks --no-checkout`, detached at `b3af69059a6529b1b2882b72c1869b50749f91e6`, push URL `DISABLED`, `npm ci` at root |
| Environment | macOS arm64, Node 24.21.0, npm 11.19.0 |
| Artifacts | private run folder `~/cogniate-qa-runs/LA/LA-E1-06/r1/` (umask 077): `npm-ci.log`, `k0-vitest.log`, `unit-rows-by-id.log`, `unit-rows-domain.log`, `k0/e1-06-check-clean.log`, `k0/e1-06-f5-clean.log`, `k0/e1-06-ac04-connection-lms.log`, `k0/e1-06-ac09-f1-deltas.json`, `status-after.txt` |

## Acceptance criteria

| AC | Result | Test id | Command | Evidence |
| --- | --- | --- | --- | --- |
| AC-LA-E1-06-01 | PASS (UNIT) | `services/cogniate-app/src/domain/migration-013.test.ts > 013 channel migration > backfills a copy of the populated 010/011/012 fixture and keeps all old values` (3 tests; no AC id in test name, Reviewer-B maps) | `npx --no-install vitest run --reporter=verbose services/cogniate-app/src/domain/migration-013.test.ts` | Backfills copies of the M1 `010`, `011` and `012` fixture databases (`channel = lms`, `binding_authority` `self` vs `operatorGrant`, `target_kind`, `bound_values` `NULL`). `unit-rows-domain.log` |
| AC-LA-E1-06-02 | PASS (UNIT) | `services/cogniate-app/src/domain/migration-013.test.ts > 013 channel migration > a 012 build refuses a database with the 013 ledger` (no AC id in test name, Reviewer-B maps) | as AC-01 | A pre-`013` (`012`) build refuses a database whose ledger has `013`. `unit-rows-domain.log` |
| AC-LA-E1-06-03 | PASS (UNIT) | `services/cogniate-app/src/domain/connections.test.ts > AC-LA-E1-06-03: channel writer and immutable identity` (7 tests) | `npx --no-install vitest run --reporter=verbose -t "AC-LA-E1-06-"` | Baseline connections (`moodle / manual / standard`, `canvas / manual / canvas-cloud-production`, `blackboard / manual / blackboard`) write `lms = channel`; test channels (`zz-test / dynamic / zz-self`, `zz-test / manual / zz-exclusive`, `zz-test / manual / zz-shared`) write the frozen behaviour class (`moodle`, `canvas`, `blackboard`); updates keep `channel` immutable; grants store `channel` and optional `bound_values`. `unit-rows-by-id.log` |
| AC-LA-E1-06-04 | PASS (K0) | `migration-013.k0.test.ts > AC-LA-E1-06-04` | `LA_LEVEL=k0 LA_SCRATCH_CLONE=$PWD LA_BASE_SHA=265d6d0 LA_RUN_DIR=~/cogniate-qa-runs/LA/LA-E1-06/r1/k0 npx --no-install vitest run --config tests/ltiaas/tasks-core/LA-E1-06/vitest.config.mts --reporter=verbose` | `infra/scripts/fitness/rules/connection-lms.mjs` exists; 3 probe SQL texts outside `services/cogniate-app/src/domain/connections.ts` (`domain/attempts.ts`, `domain/score-syncs.ts`, `app/results.ts`) that read `connection.lms` exit `1` and name `connection-lms`; `services/cogniate-app/src/domain/connections.ts` at HEAD and the clean tree exit `0` (`F5 PASS: 3 rules (audit-event-delete, connection-lms, sql-portability), 0 hits`). `k0/e1-06-ac04-connection-lms.log` |
| AC-LA-E1-06-05 | pending: Docker window (K1-SIM) | `golden-g1.k1sim.test.ts > AC-LA-E1-06-05` | SIM golden capture + `LA_LEVEL=k1sim npx --no-install vitest run --config tests/ltiaas/tasks-core/LA-E1-06/vitest.config.mts` | Pending SIM Docker slot for G1 golden capture and `LA-IC-01` compare. (Host unit suites `services/cogniate-app/src/app/connections.test.ts`, `connect.test.ts` and `runtime-path.test.ts` pass in `k0/e1-06-check-clean.log`.) |
| AC-LA-E1-06-06 | PASS (UNIT) | `services/cogniate-app/src/domain/connections.test.ts > AC-LA-E1-06-06: the same test channel routes self and grant connections by their stored authority` + `services/cogniate-app/src/worker/score-sync.test.ts > AC-LA-E1-06-06: disabled zz-test grant rows fail without POST; self rows still send` (2 tests) | `npx --no-install vitest run --reporter=verbose -t "AC-LA-E1-06-"` | With test channel `zz-test`, `operatorGrant` routes by `approved_deployment` and a disabled `operatorGrant` connection fails its score row with `CONNECTION_DISABLED` and no POST, while `self` routes by `lti_platform_id` and sends. `unit-rows-by-id.log` |
| AC-LA-E1-06-07 | pending: Docker window (K1-SIM) | Lead QA R1 (`M1 --phase sim` + `M2`) | Lead QA SIM slot | Pending Docker window. |
| AC-LA-E1-06-08 | pending: Docker window (K1-SIM) | Lead QA M1 `migration` + `snapshot-upgrade` phases + U1 | Lead QA SIM slot | Pending Docker window. |
| AC-LA-E1-06-09 | PASS (K0) | `migration-013.k0.test.ts > AC-LA-E1-06-09` | as AC-04 | Clean tree passes `npm run check` (`F1 PASS: 74 files with hits, 590 hits`, down from `80` files / `680` hits at `265d6d0`; `F5 PASS: 3 rules (audit-event-delete, connection-lms, sql-portability), 0 hits`). Every core file changed by `LA-E1-06` decreased or stayed (`domain/attempts.ts` `18 → 0`, `domain/connections.ts` `15 → 0`, `app/connections.ts` `20 → 7`, `app/binding-cleanup.ts` `11 → 2`, `app/operator.ts` `20 → 12`, `domain/publications.ts` `17 → 13`, `domain/results.ts` `4 → 2`, `domain/score-syncs.ts` `3 → 1`, `packages/tracking/src/status-text.ts` `4 → 1`, `providers/types.ts` `10 → 7`, `tool-pages/picker.ts` `3 → 0`, `tool-pages/launch.ts` `1 → 0`, `tool-pages/play.ts` `6 → 5`, `worker/score-sync.ts` `1 → 0`, `app/results.ts` `1 → 0`, `app/redemption.ts` `2 → 1`, `app/canvas-configuration.ts` `8 → 7`, `app/canvas-deployments.ts` `2 → 1`, `app/binding-targets.ts` `4 → 1`, and `domain/migrations/013_channel_kernel.sql` `0` hits under `BD-A1-19`). `k0/e1-06-ac09-f1-deltas.json`, `k0/e1-06-f5-clean.log` |

### R0 `npm run check` counts at `b3af690` (`k0/e1-06-check-clean.log`)

| Suite | Count at `b3af690` |
| --- | --- |
| Vitest (`test:unit`) | 113 files; 2,013 passed, 5 skipped |
| Infra (`test:infra`, `node --test`) | 207 pass, 0 fail (21 suites) |
| K0 (`test:k0`) | 3 files; 118 passed, 3 todo |
| F1 (`fitness:lms-names`) | `F1 PASS: 74 files with hits, 590 hits` |
| F5 (`fitness:rules`) | `F5 PASS: 3 rules (audit-event-delete, connection-lms, sql-portability), 0 hits` |

## Other checks

- **File scope (`265d6d0..dc67c14`):** `LA-E1-06` touches only the files allowed by `docs/architecture/ltiaas/tasks/LA-E1-06.md` and `BD-A1-11`/`12`/`17` (`infra/scripts/fitness/rules/connection-lms.mjs`, `packages/channel-kernel/src/legacy-wire.ts`, `packages/tracking/src/status-text.ts`, and `services/cogniate-app/src/**`; no `services/lti-service/**`, `apps/**` or `packages/channels/*/lti-profiles.ts` changes).
- **Clone cleanliness:** `git status --porcelain` in `~/cogniate-qa-runs/LA/LA-E1-06/r1/clone` is empty after the run (`status-after.txt`, 0 bytes).

## Regression and time

R0 (`npm run check` on the clean clone): PASS. R1 + migration phases + U1 (`AC-05`, `AC-07`, `AC-08`): `pending: Docker window`. Measured time of `migration-013.k0.test.ts`: `150.5s` (`AC-04` `1.3s`, `AC-09` `39.2s`, `npm run check` in `beforeAll` `110.0s`).

## Round 2

Verdict: PASS (K0 + UNIT + K1-SIM `AC-05` PASS; `AC-07`/`AC-08` covered by Wave-End Gate Slot 3B `LA-E7-08`)
Round: 3

Tester: QA-3 (Orca task `task_44bb686301fe`, dispatch `ctx_f71d95005166`), 2026-10-22. Spec: `docs/architecture/ltiaas/tasks/LA-E1-06.md` (with `BD-A1-11`, `BD-A1-12`, `BD-A1-17`, `BD-A1-19`, `BD-A1-27`).

Independence: QA-3 did not read product source (`services/**`, `packages/**`, `apps/**`), Author notes or reviewer files. QA-3 verified the K0 and UNIT ACs in an isolated `--no-hardlinks` clone of `6b79c1f`.

| Item | Value |
| --- | --- |
| SHA | `6b79c1f0b3b410cf603dbc3b1a820073169dc1d2` (`6b79c1f`: lane K Round 2 fix commits cherry-picked — `9edd9e7` frozen 409 and learner texts per `BD-A1-27`, `85b5f52` F5 `connection-lms` comma joins, `eb48552` cleanup target kinds and pending shared binding text tests, `6b79c1f` resolve `sharing` from the chosen profile) |
| Lane and slot | lane K; no Docker (HOST-ONLY; K1-SIM rows marked `pending: Docker window`) |
| Clone | `~/cogniate-qa-runs/LA/LA-E1-06/r2/clone`: `git clone --no-hardlinks --no-checkout`, detached at `6b79c1f0b3b410cf603dbc3b1a820073169dc1d2`, push URL `DISABLED`, `npm ci` at root |
| Environment | macOS arm64, Node 24.21.0, npm 11.19.0 |
| Artifacts | private run folder `~/cogniate-qa-runs/LA/LA-E1-06/r2/` (umask 077): `npm-ci.log`, `k0-vitest.log`, `unit-rows-by-id.log`, `unit-rows-domain.log`, `infra-connection-lms.log`, `k0/e1-06-check-clean.log`, `k0/e1-06-f5-clean.log`, `k0/e1-06-ac04-connection-lms.log`, `k0/e1-06-ac09-f1-deltas.json`, `status-after.txt` |

### Round 2 acceptance criteria

| AC | Result | Test id | Command | Evidence |
| --- | --- | --- | --- | --- |
| AC-LA-E1-06-01 | PASS (UNIT) | `services/cogniate-app/src/domain/migration-013.test.ts > 013 channel migration > backfills a copy of the populated 010/011/012 fixture and keeps all old values` (3 tests) | `npx --no-install vitest run --reporter=verbose services/cogniate-app/src/domain/migration-013.test.ts` | Backfills copies of the M1 `010`, `011` and `012` fixture databases (`channel = lms`, `binding_authority` `self` vs `operatorGrant`, `target_kind`, `bound_values` `NULL`). `unit-rows-domain.log` |
| AC-LA-E1-06-02 | PASS (UNIT) | `services/cogniate-app/src/domain/migration-013.test.ts > 013 channel migration > a 012 build refuses a database with the 013 ledger` | as AC-01 | A pre-`013` (`012`) build refuses a database whose ledger has `013`. `unit-rows-domain.log` |
| AC-LA-E1-06-03 | PASS (UNIT) | `services/cogniate-app/src/domain/connections.test.ts > AC-LA-E1-06-03: channel writer and immutable identity` (7 tests) + `derives sharing from the resolved default profile and refuses missing profile data before writing` (1 test) | `npx --no-install vitest run --reporter=verbose -t "AC-LA-E1-06-"` and `services/cogniate-app/src/domain/connections.test.ts` | Baseline and `zz-test` connections write the frozen behaviour class; updates keep `channel` immutable; grants store `channel` and optional `bound_values`; `sharing` is derived from the resolved default profile and missing profile data is refused before writing. `unit-rows-by-id.log`, `unit-rows-domain.log` |
| AC-LA-E1-06-04 | PASS (K0) | `migration-013.k0.test.ts > AC-LA-E1-06-04` + `infra/scripts/fitness/connection-lms.test.mjs` | `LA_LEVEL=k0 LA_SCRATCH_CLONE=$PWD LA_BASE_SHA=265d6d0 LA_RUN_DIR=~/cogniate-qa-runs/LA/LA-E1-06/r2/k0 npx --no-install vitest run --config tests/ltiaas/tasks-core/LA-E1-06/vitest.config.mts --reporter=verbose` and `node --test infra/scripts/fitness/connection-lms.test.mjs` | `infra/scripts/fitness/rules/connection-lms.mjs` refuses all 3 probe SQL texts outside `domain/connections.ts` and detects `connection.lms` reads through comma joins without flagging `grant.lms` (`infra-connection-lms.log`); `domain/connections.ts` at HEAD and the clean tree exit `0`. `k0/e1-06-ac04-connection-lms.log` |
| AC-LA-E1-06-05 | PASS (K1-SIM) | `golden-g1.k1sim.test.ts > AC-LA-E1-06-05` (`1/1` PASS in `49ms`) + Slot 3B Step 3B.1 (`qalead-la-10`) & Slot 3A (`qalead-la-3`) | `LA_LEVEL=k1sim LA_GOLDEN_BASELINE=tests/ltiaas/golden/1b17261be97c4701b928fa9dc2fa74c6d23028f6 LA_GOLDEN_CAPTURE=~/cogniate-qa-runs/LA/LA-E7-08/slot3b-80133d6b/golden-capture-80133d6b662dd4fb8e18a9eed62e3160d2b2a1c5-port9443 LA_EXPECTED_DELTA=LA-IC-01,LA-IC-03,LA-IC-04,LA-IC-12,LA-IC-13,LA-IC-14,LA-IC-15,LA-IC-16,LA-IC-17,LA-IC-18,LA-IC-19,LA-IC-20,LA-IC-21 LA_RUN_DIR=~/cogniate-qa-runs/LA/run22-golden-k1sim/LA-E1-06 vitest run --config tests/ltiaas/tasks-core/LA-E1-06/vitest.config.mts` | Verified on Wave-End Gate **Slot 3B** capture (`qalead-la-10` at `80133d6b662dd4fb8e18a9eed62e3160d2b2a1c5` / product code `02f5d420`): `G1.json` equals `G-BASE` (`1b17261b`) with `0` unexplained differences (`acDiffs: []` in `e1-06-ac05-golden-diff-paths.json`; `EQUAL: 280 differences (0 not explained), 0 expected changes missing` in `e1-06-ac05-golden-report.txt`), and `assertAdditiveFieldsOnG1` verified `channel`, `channelName` and `channelCapabilities` -> `capabilities` projection on all `acceptance`/`default` `lmsProviders.lms` entries and all connection DTOs (`~/cogniate-qa-runs/LA/run22-golden-k1sim/LA-E1-06/vitest.log`). |
| AC-LA-E1-06-06 | PASS (UNIT) | `services/cogniate-app/src/domain/connections.test.ts > AC-LA-E1-06-06: the same test channel routes self and grant connections by their stored authority` + `services/cogniate-app/src/worker/score-sync.test.ts > AC-LA-E1-06-06: disabled zz-test grant rows fail without POST; self rows still send` (2 tests) | `npx --no-install vitest run --reporter=verbose -t "AC-LA-E1-06-"` | With test channel `zz-test`, `operatorGrant` routes by `approved_deployment` and a disabled `operatorGrant` connection fails its score row with `CONNECTION_DISABLED` and no POST, while `self` routes by `lti_platform_id` and sends. `unit-rows-by-id.log` |
| AC-LA-E1-06-07 | Covered by Wave-End Gate **Slot 3B** (`LA-E7-08`) (K1-SIM) | Lead QA R1 (`M1 --phase sim --provider all` 394 rows + `M2` 64 cases on `80133d6b` / product code `02f5d420`) | `node tests/host/run-m1.mjs --sha 80133d6b662dd4fb8e18a9eed62e3160d2b2a1c5 --project qalead-la-14 --phase sim --provider all` & `node tests/host/run-m2.mjs --sha 80133d6b662dd4fb8e18a9eed62e3160d2b2a1c5 --project qalead-la-15` | Covered by Wave-End Gate **Slot 3B** Steps 3B.4 (`qalead-la-14`, `logs/slot3b-4-m1-sim.log`) & 3B.5 (`qalead-la-15`, `logs/slot3b-5-m2.log`) on `80133d6b` (product code `02f5d420`; recorded in `docs/reviews/LA-E7-08/qa.md`). |
| AC-LA-E1-06-08 | PASS / Covered by Wave-End Gate **Slot 3B** (`LA-E7-08`) (K1-SIM) | Lead QA Slot 3B Steps 3B.2a (`qalead-la-11` `M1 --phase migration`), 3B.2b (`qalead-la-12` `M1 --phase snapshot-upgrade`), & 3B.3 (`qalead-la-13` `U1-SIM` combined) + QA-2 Slot 1c (`qa2-la-sim-r1` `cd347224`) | `node tests/host/run-m1.mjs --sha 80133d6b... --project qalead-la-11 --phase migration`, `--project qalead-la-12 --phase snapshot-upgrade`, & `node tests/host/run-u1-sim.mjs --sha 80133d6b... --project qalead-la-13 --old-sha 1b17261be97c4701b928fa9dc2fa74c6d23028f6` | On `80133d6b` (product code `02f5d420`): (1) `qalead-la-11` (`logs/slot3b-2a-m1-migration.log`): `M1-23.common.baseline`, `M1-23.common.upgrade`, `M1-30.common.postwrite`, `M1-30.common.rollback`, and `MIGRATION` all `PASS`; (2) `qalead-la-12` (`logs/slot3b-2b-m1-snapshot-upgrade.log`): `M1-38.common.h1..h5` (`5/5`) `PASS` (post-stop `lti.db` ledger list in `m1-migration.mjs:332` tracked in `LA-E7-08`); (3) `qalead-la-13` (`logs/slot3b-3-u1-combined.log`): `U1-SIM` upgrade from `1b17261b` -> `80133d6b` `17/17` summary ids `PASS` (also verified in QA-2 Slot 1c `qa2-la-sim-r1` on `cd347224`). |
| AC-LA-E1-06-09 | PASS (K0) | `migration-013.k0.test.ts > AC-LA-E1-06-09` | as AC-04 | Clean tree passes `npm run check` (`F1 PASS: 73 files with hits, 588 hits`, down from `80` files / `680` hits at `265d6d0`; `F5 PASS: 3 rules (audit-event-delete, connection-lms, sql-portability), 0 hits`). Every changed core file decreased or stayed (`k0/e1-06-ac09-f1-deltas.json`), and `git status --porcelain` in `~/cogniate-qa-runs/LA/LA-E1-06/r2/clone` is empty (`status-after.txt`, 0 bytes). |

### R0 `npm run check` counts at `6b79c1f` (`k0/e1-06-check-clean.log`)

| Suite | Count at `6b79c1f` |
| --- | --- |
| Vitest (`test:unit`) | 113 files; 2,063 passed, 5 skipped |
| Infra (`test:infra`, `node --test`) | 208 pass, 0 fail |
| K0 (`test:k0`) | 3 files; 118 passed, 3 todo |
| F1 (`fitness:lms-names`) | `F1 PASS: 73 files with hits, 588 hits` |
| F5 (`fitness:rules`) | `F5 PASS: 3 rules (audit-event-delete, connection-lms, sql-portability), 0 hits` |

### Round 2/3 regression and time

R0 (`npm run check` on the clean clone): PASS. Golden `G1` compare (`AC-05`): PASS (`49ms` on Slot 3B `qalead-la-10` capture). `U1-SIM` & `M1 migration` (`AC-08`): PASS in Slot 3B Steps 3B.2a (`qalead-la-11`) & 3B.3 (`qalead-la-13`); `M1 snapshot-upgrade` (`qalead-la-12`) & `R1` (`AC-07`, `qalead-la-14`/`15`) covered in Slot 3B (`docs/reviews/LA-E7-08/qa.md`). Measured time of `migration-013.k0.test.ts`: `172.2s` (`AC-04` `1.8s`, `AC-09` `54.3s`, `npm run check` in `beforeAll` `116.1s`).
