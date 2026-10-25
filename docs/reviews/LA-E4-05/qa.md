Verdict: PASS (K0 + UNIT + K1-SIM `AC-01..05` all PASS)
Round: 2

# LA-E4-05 Worker process mode and the production refusal: QA verification

Tester: QA-3 (Orca task `task_a50b56d70b54`, dispatch `ctx_48bb0d05458e`), 2026-10-23. Spec: `docs/architecture/ltiaas/tasks/LA-E4-05.md`. Suite: `tests/ltiaas/tasks-core/LA-E4-05/` (QA-3 test-first).

Independence: QA-3 did not read product source (`services/**`, `packages/**`, `apps/**`), Author notes or reviewer files. QA-3 verified all K0 and UNIT ACs in an isolated `--no-hardlinks` clone of `5b5b3a2`.

| Item | Value |
| --- | --- |
| SHA | `5b5b3a2a91e7d8cb38b425e9c21d78b4c49cd943` (integration `5b5b3a2`; holds `LA-E4-05` merge `392287d` over base `ff5f369`) |
| Lane and slot | lane R; no Docker (HOST-ONLY; K1-SIM row marked `pending: Docker window`) |
| Clone | `~/cogniate-qa-runs/LA/LA-E4-05/r1/clone`: `git clone --no-hardlinks --no-checkout`, detached at `5b5b3a2a91e7d8cb38b425e9c21d78b4c49cd943`, push URL `DISABLED`, `npm ci` at root |
| Environment | macOS arm64, Node 24.21.0, npm 11.19.0 |
| Artifacts | private run folder `~/cogniate-qa-runs/LA/LA-E4-05/r1/` (umask 077): `npm-ci.log`, `k0-vitest.log`, `unit-rows-by-id.log`, `unit-rows-worker-main.log`, `k0/e4-05-check-clean.log`, `k0/e4-05-unit-rows.log`, `status-after.txt` |

## Acceptance criteria

| AC | Result | Test id | Command | Evidence |
| --- | --- | --- | --- | --- |
| AC-LA-E4-05-01 | PASS (UNIT + K0) | `worker.k0.test.ts` + `services/cogniate-app/src/worker-main.test.ts > LA-E4-05 process entries > AC-LA-E4-05-01: web off serves pages and API, leaves scores pending and logs no job run` | `LA_LEVEL=k0 LA_SCRATCH_CLONE=$PWD LA_RUN_DIR=~/cogniate-qa-runs/LA/LA-E4-05/r1/k0 npx --no-install vitest run --config tests/ltiaas/tasks-core/LA-E4-05/vitest.config.mts --reporter=verbose` | With `APP_JOB_RUNNER=off`, the web process serves pages and API, logs no `job_run` line, and leaves a committed score `pending`. `k0/e4-05-unit-rows.log`, `unit-rows-worker-main.log` |
| AC-LA-E4-05-02 | PASS (UNIT + K0) | `worker.k0.test.ts` + `services/cogniate-app/src/worker-main.test.ts > LA-E4-05 process entries > AC-LA-E4-05-02: npm run worker sends a pending score while the web runner is off` | as AC-01 | `services/cogniate-app/src/worker-main.ts` exists, `services/cogniate-app/package.json` and root `package.json` define the `worker` script, and running `npm run worker` alone (with the web runner off) sends the pending score so the row becomes `sent`. `k0/e4-05-unit-rows.log`, `unit-rows-worker-main.log` |
| AC-LA-E4-05-03 | PASS (UNIT + K0) | `worker.k0.test.ts` + `services/cogniate-app/src/worker-main.test.ts > LA-E4-05 process entries > AC-LA-E4-05-03: production web refuses a live other role with either instance id` + `AC-LA-E4-05-03: production worker refuses a live other role with either instance id` + `AC-LA-E4-05-03: simultaneous production web and worker starts allow only one role` + `AC-LA-E4-05-03: default web/worker warns for the other role and still runs` + `AC-LA-E4-05-03: production web/worker ignores a stale other-role heartbeat` (7 tests) | as AC-01 | In the `production` profile, starting a `worker` while a live `web` runner row exists (or starting a `web` runner while a live `worker` row exists, or simultaneous starts) exits `1` with `config_refused {reason: "job_runner_twice"}`; stale heartbeats are ignored and non-production profiles log a warning and continue. `k0/e4-05-unit-rows.log`, `unit-rows-worker-main.log` |
| AC-LA-E4-05-04 | PASS (UNIT + K0) | `worker.k0.test.ts` + `services/cogniate-app/src/worker-main.test.ts > LA-E4-05 process entries > AC-LA-E4-05-04: two runner processes with distinct ids POST each due score once on one database` | as AC-01 | Two runner processes with distinct `JOB_INSTANCE_ID` values on one SQLite database send each due row once with zero duplicate score POSTs. `k0/e4-05-unit-rows.log`, `unit-rows-worker-main.log` |
| AC-LA-E4-05-05 | PASS (K1-SIM) | `golden.k1sim.test.ts > AC-LA-E4-05-05` (`1/1` PASS in `42ms`) + Slot 3B Step 3B.1 (`qalead-la-10`) & Slot 3A (`qalead-la-3`) | `LA_LEVEL=k1sim LA_GOLDEN_BASELINE=tests/ltiaas/golden/1b17261be97c4701b928fa9dc2fa74c6d23028f6 LA_GOLDEN_CAPTURE=~/cogniate-qa-runs/LA/LA-E7-08/slot3b-80133d6b/golden-capture-80133d6b662dd4fb8e18a9eed62e3160d2b2a1c5-port9443 LA_EXPECTED_DELTA=LA-IC-01..LA-IC-21 LA_RUN_DIR=~/cogniate-qa-runs/LA/run22-golden-k1sim/LA-E4-05 vitest run --config tests/ltiaas/tasks-core/LA-E4-05/vitest.config.mts` | Verified on Wave-End Gate **Slot 3B** capture (`qalead-la-10` at `80133d6b` / product code `02f5d420`): on the SIM lane with default settings (runner in web process), golden `G3` score rows equal the `G-BASE` baseline (`g3Diffs: []` in `e4-05-ac05-golden-diff-paths.json`; `~/cogniate-qa-runs/LA/run22-golden-k1sim/LA-E4-05/vitest.log`). |

### R0 `npm run check` counts at `5b5b3a2` (`k0/e4-05-check-clean.log`)

| Suite | LA-E0-01 baseline (`1b17261`) | At `5b5b3a2` |
| --- | --- | --- |
| Vitest (`test:unit`) | 97 files; 1,351 passed, 5 skipped | 164 files; 2,625 passed, 5 skipped |
| Infra (`test:infra`, `node --test`) | 197 pass, 0 fail | 252 pass, 0 fail |
| K0 (`test:k0`) | — | 3 files; 121 passed |
| F1 (`fitness:lms-names`) | — | `F1 PASS: 20 files with hits, 74 hits` |
| F5 (`fitness:rules`) | — | `F5 PASS: 6 rules (audit-event-delete, channel-sql-tables, connection-lms, no-score-sync, protocol-urls, sql-portability), 0 hits` |

## Other checks

- **File scope (`ff5f369..392287d`):** `LA-E4-05` touches `services/cogniate-app/src/{config,main,worker-main,worker-main.test,worker-main.testkit}.ts`, plus RQ-2 `worker` script lines in `services/cogniate-app/package.json` and root `package.json`. `infra/compose.yaml` is untouched.
- **Clone cleanliness:** `git status --porcelain` in `~/cogniate-qa-runs/LA/LA-E4-05/r1/clone` is empty after the run (`status-after.txt`, 0 bytes).

## Regression and time

R0 (`npm run check` on the clean clone): PASS. Golden G3 compare (`AC-05`): PASS (`42ms` on Slot 3B `qalead-la-10` capture at `80133d6b` / product code `02f5d420`). Measured time of `worker.k0.test.ts`: `162.77s` (`R0 & worker entry point` `1ms`, `UNIT rows` `11.10s`, `npm run check` in `beforeAll` `151.67s`); `worker-main.test.ts` (10 tests): `8.78s`; `golden.k1sim.test.ts`: `42ms`.
