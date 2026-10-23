Verdict: PASS (K0 + UNIT + K1-SIM AC-02, AC-03, AC-05, AC-06; AC-04 K1-SIM pending next slot after 08:05Z)
Round: 3

# LA-E4-07 App metrics and readiness listener (Should): QA verification

Tester: QA-3 (Orca task `task_ae9a0ac6c9cf`, dispatch `ctx_0838b24a9ae1`), 2026-10-23. Spec: `docs/architecture/ltiaas/tasks/LA-E4-07.md` (with `docs/architecture/ltiaas/contracts/cogniate-app-api-delta.md` §8a, `docs/architecture/ltiaas/operability.md` §4.3/§4.4, and `BD-A2-88`, `BD-A1-100`). Suite: `tests/ltiaas/tasks-core/LA-E4-07/` (QA-3 test-first, authored in this round).

Independence: QA-3 authored `tests/ltiaas/tasks-core/LA-E4-07/` from `docs/architecture/ltiaas/tasks/LA-E4-07.md`, `cogniate-app-api-delta.md` §8a, `operability.md` §4.3/§4.4, and `build-decisions-A2.md` §41 (`BD-A2-88`) / `build-decisions-A1.md` (`BD-A1-100`) without reading product source (`services/**`, `packages/**`, `apps/**`), Author notes or reviewer files.

| Item | Value |
| --- | --- |
| SHA | `9f562050098656fba55c951e1015e243e94e35f6` (integration `9f56205`, code `be7698d`; holds `LA-E4-07` merge `be7698d` + `BD-A1-100` `579a754`) |
| Lane and slot | lane R; no Docker (`HOST-ONLY`; `K1-SIM` rows `AC-02`..`06` marked `pending: Docker window`, slot 4) |
| Clone | `~/cogniate-qa-runs/LA/LA-E4-07/r1/clone`: `git clone --no-hardlinks --no-checkout`, detached at `9f562050098656fba55c951e1015e243e94e35f6`, push URL `DISABLED`, `npm ci` at root and `tests/`, `node_modules/.vitest-cache` and `node_modules/.vite` deleted before every Vitest run |
| Environment | macOS arm64, Node 24.21.0, npm 11.19.0 |
| Artifacts | private run folder `~/cogniate-qa-runs/LA/LA-E4-07/r1/k0/` (umask 077): `vitest.log`, `e4-07-check-clean.log`, `e4-07-unit-by-ac.log`, `head-sha.txt`, `status-after.txt` (`0` bytes) |

## Acceptance criteria

| AC | Result | Test id | Command | Evidence |
| --- | --- | --- | --- | --- |
| AC-LA-E4-07-01 | PASS (UNIT + K0) | `tests/ltiaas/tasks-core/LA-E4-07/app-metrics.k0.test.ts` + `services/cogniate-app/src/app/metrics.test.ts > operator listener settings (LA-E4-07) > AC-LA-E4-07-01: the default settings bind 127.0.0.1:4210 only` + `BD-A2-88: production refuses a host that is not loopback with the LTI service reason and text; acceptance may bind the network` + `services/cogniate-app/src/worker-main.test.ts > LA-E4-07 operator listener of the web entry` (3 tests) | `LA_LEVEL=k0 LA_SCRATCH_CLONE=$PWD LA_RUN_DIR=~/cogniate-qa-runs/LA/LA-E4-07/r1/k0 npx --no-install vitest run --config tests/ltiaas/tasks-core/LA-E4-07/vitest.config.mts --reporter=verbose` | Default settings bind `127.0.0.1:4210` only (bound address checked); `STACK_PROFILE=production` with a non-loopback `OPERATOR_HOST` refuses to start with `config_refused` reason `operator_bind_not_loopback` and the fixed message before any port opens (`BD-A2-88` D1). `e4-07-unit-by-ac.log` |
| AC-LA-E4-07-02 | pending: Docker window (K1-SIM; UNIT + K0 static PASS) | `app-metrics.k1sim.test.ts > AC-LA-E4-07-02..06` (SIM) + `app-metrics.k0.test.ts` + `services/cogniate-app/src/app/metrics.test.ts > GET /metrics > AC-LA-E4-07-02 (unit side): one OpenMetrics answer has the eight app families and ends with # EOF` | SIM Docker slot 4 / same | K1-SIM part pending Docker window. Host K0 static check confirms `infra/compose.yaml` sets `OPERATOR_HOST=0.0.0.0` / `4210` on `cogniate-app` in `acceptance` and proxy never routes `:4210`. Unit test confirms `GET /metrics` returns OpenMetrics text ending with `# EOF` containing all 8 families (`app_dispatch_rows`, `app_dispatch_oldest_pending_seconds`, `app_dispatch_sends_total`, `app_launch_refusals_total`, `app_grant_redemptions_total`, `app_grant_compensation_failures_total`, `app_job_runs_total`, `app_job_last_success_timestamp_seconds`). `e4-07-unit-by-ac.log` |
| AC-LA-E4-07-03 | pending: Docker window (K1-SIM; UNIT part PASS) | `app-metrics.k1sim.test.ts > AC-LA-E4-07-02..06` (SIM) + `services/cogniate-app/src/app/metrics.test.ts > GET /metrics > AC-LA-E4-07-03 (unit side): a recorded delivery outcome counts once, after its commit; a lost lease counts nothing` | SIM Docker slot 4 / same | K1-SIM part pending Docker window. Host unit test verifies `app_dispatch_sends_total{reporter="lti-ags",outcome="accepted"}` increments by 1 at the commit of the recording transaction (`afterCommit`) and counts nothing when the lease is lost (`BD-A2-88` D2a). `e4-07-unit-by-ac.log` |
| AC-LA-E4-07-04 | pending: Docker window (K1-SIM; UNIT part PASS) | `app-metrics.k1sim.test.ts > AC-LA-E4-07-02..06` (SIM) + `services/cogniate-app/src/app/metrics.test.ts > GET /metrics > AC-LA-E4-07-04 (unit side): the launch page counts its refusals in the registry of its database` | SIM Docker slot 4 / same | K1-SIM part pending Docker window. Host unit test verifies a refused launch (`deployment_not_approved`) increments `app_launch_refusals_total{reason="deployment_not_approved",channel=<id>}` by 1 in the database's metrics registry. `e4-07-unit-by-ac.log` |
| AC-LA-E4-07-05 | PASS (UNIT part); K1-SIM part pending: Docker window | `app-metrics.k1sim.test.ts` (SIM) + `services/cogniate-app/src/app/metrics.test.ts > GET /readyz (BD-A2-88: the app only) > answers 200 when the database and every migration are in place, else 503 with the reason` | SIM Docker slot 4 / same | Host UNIT part PASS: `GET /readyz` checks only the app (database + migrations, no LTI service check per `BD-A2-88` D3), returning `200 {status:"ready"}` when the database and migrations are in place, and `503 {status:"not_ready", reasons:[...]}` when the database does not answer (`database`) or an app migration is unapplied (`migrations`). K1-SIM check with `lti-service` stopped is pending Docker window. `e4-07-unit-by-ac.log` |
| AC-LA-E4-07-06 | pending: Docker window (K1-SIM; UNIT part PASS) | `app-metrics.k1sim.test.ts > AC-LA-E4-07-02..06` (SIM) + `services/cogniate-app/src/app/metrics.test.ts > GET /metrics > AC-LA-E4-07-04 (unit side), AC-LA-E4-07-06 (unit side): launch refusals keep only code values as labels` | SIM Docker slot 4 / same | K1-SIM K-HYG scan pending Docker window. Host unit test verifies `/metrics` labels and samples never hold library ids, user ids, learner subjects, tokens or keys. `e4-07-unit-by-ac.log` |
| AC-LA-E4-07-07 | PASS (UNIT) | `services/cogniate-app/src/app/metrics.test.ts > GET /metrics > AC-LA-E4-07-04 (unit side), AC-LA-E4-07-06 (unit side): launch refusals keep only code values as labels` + `services/cogniate-app/src/worker-main.test.ts > LA-E4-07 operator listener of the web entry > AC-LA-E4-07-01: the listener answers on 127.0.0.1; send series only with the runner in the process (on)` & `(off)` | same | Unknown channel id counts under `channel=""`; a reason outside `[a-z][a-z0-9_]{0,63}` counts under `reason="other"` (`BD-A2-88` D2). With `APP_JOB_RUNNER=off`, `/metrics` omits `app_dispatch_sends_total` and the job series (`app_job_runs_total`, `app_job_last_success_timestamp_seconds`) while keeping the store-based series (`BD-A2-88` D4). `e4-07-unit-by-ac.log` |

## Other checks

- **R0 `npm run check` at `9f56205` (code `be7698d`, `e4-07-check-clean.log`):**
  - Vitest (`test:unit`): `191` files; `3,069` passed, `5` skipped.
  - Infra (`test:infra`, `node --test`): `254` pass, `0` fail.
  - K0 (`test:k0`): `3` files; `149` passed.
  - F1 (`fitness:lms-names`): `F1 PASS: 0 files with hits, 0 hits`.
  - F5 (`fitness:rules`): `F5 PASS: 6 rules (audit-event-delete, channel-sql-tables, connection-lms, no-score-sync, protocol-urls, sql-portability), 0 hits`.
- **Measured time:** `LA-E4-07` K0 + UNIT suite `105.82s` (`2/2` K0 tests; `2` unit test files / `22/22` unit tests in `8.45s`). `K1-SIM` rows (`AC-02`..`06`) are `pending: Docker window` (Docker slot 4).

## Round 2

Tester: QA-3 (Orca task `task_029beaadd9c2`, dispatch `ctx_3952ce74962a`), 2026-10-23. Scope: Round 2 host-only verification of `8f1ecea` / `5b89f42` (lane R fix round 1 for `B-LA-E4-07-01` / `AC-LA-E4-07-07` refusal reason label grammar `^[a-z][a-z0-9_]{0,63}$`) at integration SHA `e654574`.

Independence: QA-3 authored the Round 2 `AC-LA-E4-07-07` boundary test in `tests/ltiaas/tasks-core/LA-E4-07/app-metrics.k0.test.ts` from `LA-E4-07.md` and `cogniate-app-api-delta.md` §8a without reading product source (`services/**`, `packages/**`, `apps/**`), Author notes or reviewer files (test file `services/cogniate-app/src/app/metrics.test.ts` was inspected solely for the `AppMetrics` test harness constructor signature).

| Item | Value |
| --- | --- |
| SHA | `e65457445001a6a6636afbea7c55d66870211737` (integration `e654574`; holds `LA-E4-07` fix round 1 `8f1ecea` / `5b89f42`) |
| Lane and slot | lane R; no Docker (`HOST-ONLY`; `K1-SIM` rows `AC-02`..`06` remain `pending: Docker window`, slot 4) |
| Clone | `~/cogniate-qa-runs/LA/run19/clone`: `git clone --no-hardlinks --no-checkout`, detached at `e65457445001a6a6636afbea7c55d66870211737`, push URL `DISABLED`, `npm ci` at root and `tests/`, `node_modules/.vitest-cache` and `node_modules/.vite` deleted before every Vitest run |
| Environment | macOS arm64, Node 24.21.0, npm 11.19.0 |
| Artifacts | private run folder `~/cogniate-qa-runs/LA/run19/k0/LA-E4-07/` (umask 077): `vitest.log`, `e4-07-check-clean.log`, `e4-07-unit-by-ac.log`, `e4-07-r2-boundary.json` |

### Round 2 checks (`5b89f42` / `B-LA-E4-07-01` / `AC-LA-E4-07-07`)

| Check | Result | Test id | Evidence |
| --- | --- | --- | --- |
| `AC-LA-E4-07-07` (`B-LA-E4-07-01`): launch refusal reason boundary rows (`[a-z][a-z0-9_]{0,63}`) and unknown channel guard | PASS | `app-metrics.k0.test.ts > AC-LA-E4-07-07 Round 2 (B-LA-E4-07-01): launch refusal reason boundary rows` + `services/cogniate-app/src/app/metrics.test.ts > AC-LA-E4-07-07 (B-LA-E4-07-01)` (8 cases) | Verified: hyphen (`"deployment-not-approved"` -> `reason="other"`), 64 chars (`"a" + "0".repeat(63)` -> kept as-is), 65 chars (`"a" + "0".repeat(64)` -> `reason="other"`), leading digit (`"1deployment_not_approved"` -> `reason="other"`), upper case (`"Deployment_Not_Approved"` -> `reason="other"`), empty (`""` -> `reason="other"`), and unknown channel (`"unknown-channel-id"` -> `channel=""`). `e4-07-r2-boundary.json`, `e4-07-unit-by-ac.log` |

### R0 `npm run check` and suite timings at `e654574`

- **R0 `npm run check` (`e4-07-check-clean.log`):**
  - Vitest (`test:unit`): `192` files; `3,081` passed, `5` skipped.
  - Infra (`test:infra`, `node --test`): `254` pass, `0` fail.
  - K0 (`test:k0`): `3` files; `149` passed.
  - F1 (`fitness:lms-names`): `F1 PASS: 0 files with hits, 0 hits`.
  - F5 (`fitness:rules`): `F5 PASS: 6 rules (audit-event-delete, channel-sql-tables, connection-lms, no-score-sync, protocol-urls, sql-portability), 0 hits`.
- **Targeted unit suite (`e4-07-unit-by-ac.log`):** `2` files (`metrics.test.ts`, `worker-main.test.ts`), `30/30` passed (`8.63s`).
- **Measured time:** `LA-E4-07` K0 + UNIT suite `107.95s` (`3/3` K0 tests passed). `K1-SIM` rows (`AC-02`..`06`) remain `pending: Docker window` (Docker slot 4).

## Round 3 (Slot 4 K1-SIM on `e1e4fab`)

| Item | Value |
| --- | --- |
| SHA | `e1e4fabf451276d6b5d2c07cb28024ad8ef6f271` (`e1e4fab`, code `5171f7f`) |
| Lane and slot | lane R; Slot 4 Docker SIM (`COMPOSE_PROJECT_NAME=qa3-la-sim-r3`, `PUBLIC_PORT=9453`, `STACK_SUBNET=172.21.0.0/16`) |
| Artifacts | `~/cogniate-qa-runs/LA/qa3-slot4-e1e4fab/artifacts/qa3-la-sim-r3-e1e4fabf-2026-10-23T06-35-01-035Z/` (`cmd/10-test-acceptance-LA-E4-07.log`, `container-LA-E4-07/vitest-results.json`, `reports/LA-E4-07.json`) |

| AC | Result | Test id | Evidence |
| --- | --- | --- | --- |
| AC-LA-E4-07-02 | PASS (K1-SIM + UNIT + K0) | `app-metrics.k1sim.test.ts > AC-LA-E4-07-02: GET http://cogniate-app:4210/metrics from e2e container gives OpenMetrics text with all 8 series` | Live `GET http://cogniate-app:4210/metrics` from the `e2e` container returns `200` `application/openmetrics-text; version=1.0.0; charset=utf-8` ending with `# EOF` and containing all 8 families and series (`2.9 ms`). `10-test-acceptance-LA-E4-07.log` |
| AC-LA-E4-07-03 | PASS (K1-SIM + UNIT) | `app-metrics.k1sim.test.ts > AC-LA-E4-07-03: after one accepted score, app_dispatch_sends_total{reporter="lti-ags",outcome="accepted"} is 1 higher` | After one accepted score on `qa3-la-sim-r3`, `app_dispatch_sends_total{reporter="lti-ags",outcome="accepted"}` increments by `1` (`1,258.0 ms`). `10-test-acceptance-LA-E4-07.log` |
| AC-LA-E4-07-04 | pending next slot after 08:05Z (UNIT part PASS) | `app-metrics.k1sim.test.ts > AC-LA-E4-07-04` | Updated `app-metrics.k1sim.test.ts` to add an unapproved deployment on an owned `canvasBound()` platform (where `connection.lti_platform_id` is set on the per-tenant platform) so `routeLaunch` classifies the refusal as `deployment_not_approved`; ready to run in the post-08:05Z slot. |
| AC-LA-E4-07-05 | PASS (K1-SIM + UNIT) | `app-metrics.k1sim.test.ts > AC-LA-E4-07-05: GET http://cogniate-app:4210/readyz answers 200 {status:"ready"} both normally and while lti-service is stopped (BD-A2-88 D3 / BD-A1-100)` | Live `GET http://cogniate-app:4210/readyz` answers `200 {status:"ready"}` both normally and while `lti-service` is stopped via `docker compose stop lti-service` (`7,044.0 ms`). `10-test-acceptance-LA-E4-07.log` |
| AC-LA-E4-07-06 | PASS (K1-SIM + UNIT) | `app-metrics.k1sim.test.ts > AC-LA-E4-07-06: K-HYG scan of /metrics answer has 0 hits (no library id, user id, learner subject, token or key)` | Live K-HYG scan of `/metrics` has `0` hits (`1.6 ms`). `10-test-acceptance-LA-E4-07.log` |
