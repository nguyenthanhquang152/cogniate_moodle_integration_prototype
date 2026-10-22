Verdict: PASS (host-only K0 + UNIT; K1-SIM and K2 pending: Docker window)
Round: 1

# LA-E3-02 Platform storage: storage check and Canvas values: QA verification

Tester: QA-4 (Orca task `task_fb862e2b49d1`, dispatch `ctx_6039a0441240`), 2026-10-23. Spec: `docs/architecture/ltiaas/tasks/LA-E3-02.md` (with `BD-A1-33`, `BD-A1-34`, `BD-A2-44`, `LA-IC-06`). Suite: `tests/ltiaas/tasks-lti/LA-E3-02/` (QA-4 test-first, committed in `95540f2`).

Independence: QA-4 did not read product source (`services/**`, `packages/**`, `apps/**`), Author notes or reviewer files to author `tests/ltiaas/tasks-lti/LA-E3-02/`, and verified all host-only K0 and UNIT checks in an isolated `--no-hardlinks` clone of `a2dfc04` using boolean assertions that never print product source.

| Item | Value |
| --- | --- |
| SHA | `a2dfc0418ccf421891f260925ddee0d22371e240` (integration `a2dfc04`; holds `LA-E3-02` merge `d3c4848`, collision regression `f09c3ea` in `3344520`, and S1 retention caller for `AC-LA-E5-19-09`) |
| Lane and slot | lane L; no Docker (`HOST-ONLY`; `K1-SIM` and `K2` rows marked `pending: Docker window`) |
| Clone | `~/cogniate-qa-runs/LA/qa4-r8-a2dfc04/clone`: `git clone --no-hardlinks --no-checkout`, detached at `a2dfc0418ccf421891f260925ddee0d22371e240`, push URL `DISABLED`, `npm ci` at root and `tests/` |
| Environment | macOS arm64, Node 24.21.0, npm 11.19.0 |
| Artifacts | private run folder `~/cogniate-qa-runs/LA/qa4-r8-a2dfc04/logs/` (umask 077): `npm-ci.log`, `npm-ci-tests.log`, `LA-E3-02-k0.log`, `e3-02-unit.log`, `rev.txt`, `remotes.txt`, `status-after.txt` |

## Acceptance criteria

| AC | Result | Test id | Command | Evidence |
| --- | --- | --- | --- | --- |
| AC-LA-E3-02-01 | pending: Docker window (K1-SIM) | `tests/ltiaas/tasks-lti/LA-E3-02/platform-storage-check.k1sim.test.ts > AC-LA-E3-02-01` | SIM Docker slot | Pending Docker window. Verified at host unit level in `services/lti-service/src/lti/storage-check.test.ts > prepares minimized claims without an ltik, then completes the same tool redirect (deep linking false)` (`e3-02-unit.log`). |
| AC-LA-E3-02-02 | pending: Docker window (K1-SIM) | `platform-storage-check.k1sim.test.ts > AC-LA-E3-02-02` | SIM Docker slot | Pending Docker window. Verified at host unit level in `storage-check.test.ts > prepares minimized claims without an ltik, then completes the same tool redirect (deep linking true)` (`e3-02-unit.log`). |
| AC-LA-E3-02-03 | pending: Docker window (K1-SIM) | `platform-storage-check.k1sim.test.ts > AC-LA-E3-02-03` | SIM Docker slot | Pending Docker window. Verified at host unit level in `services/lti-service/src/store/storage-checks.test.ts > stores only the check hash and consumes once within the correct account` and `storage-check.test.ts` (`e3-02-unit.log`). |
| AC-LA-E3-02-04 | PASS (UNIT + K0) | `services/lti-service/src/store/storage-checks.test.ts > expires at 120 seconds, including the controlled 121-second case (AC-04)` + `cleans rows older than ten minutes and keeps the boundary and newer rows, used or unused (AC-04)` + `services/lti-service/src/lti/storage-check.test.ts > shows the storage help for an empty value and enforces the controlled 121-second expiry` + `services/lti-service/src/jobs/retention.test.ts > AC-LA-E5-19-09` + `platform-storage-check.k0.test.ts > AC-LA-E3-02-04 (UNIT)` | `LA_LEVEL=k0 LA_TARGET_ROOT=$PWD ./node_modules/.bin/vitest run --config tests/ltiaas/tasks-lti/LA-E3-02/vitest.config.mts --reporter=verbose` and `./node_modules/.bin/vitest run --reporter=verbose services/lti-service/src/store/storage-checks.test.ts services/lti-service/src/lti/storage-check.test.ts services/lti-service/src/jobs/retention.test.ts` | With a controlled clock at `t + 121 s`, `POST /lti/launch/:account/storage-check` returns `400 INVALID_STATE` (`storage_check_unknown_used_or_expired`); `cleanupStorageChecks` (and the retention job `AC-LA-E5-19-09`) deletes used and unused `storage_check` rows older than 10 minutes and retains boundary/newer rows; migration `015_storage_check.sql` applies cleanly to a copied M1 database. `LA-E3-02-k0.log`, `e3-02-unit.log` |
| AC-LA-E3-02-05 | pending: Docker window (K1-SIM) | `platform-storage-check.k1sim.test.ts > AC-LA-E3-02-05` | SIM Docker slot | Pending Docker window. Verified at host unit level in `storage-check.test.ts > refuses the wrong origin before consumption and consumes a mismatch before a retry` (`e3-02-unit.log`). |
| AC-LA-E3-02-06 | pending: Docker window (K1-SIM) | `platform-storage-check.k1sim.test.ts > AC-LA-E3-02-06` | SIM Docker slot | Pending Docker window. Verified at host unit level in `storage-check.test.ts > refuses the wrong origin before consumption and consumes a mismatch before a retry` (`e3-02-unit.log`). |
| AC-LA-E3-02-07 | pending: Docker window (K1-SIM) | `platform-storage-check.k1sim.test.ts > AC-LA-E3-02-07` | SIM Docker slot | Pending Docker window. Verified at host unit level in `storage-check.test.ts > runs signature verification before making a storage check and uses up the state` (`e3-02-unit.log`). |
| AC-LA-E3-02-08 | pending: Docker window (K2) | QA-E2E `K2-STORAGE` browser harness (`LA-E7-02`) | SIM Docker slot | Pending Docker window. Verified at fake-window unit level in `services/lti-service/src/lti/storage-pages.test.ts > storage check page > gets the bounded key from forwarding and submits only the check and matching value once` (`e3-02-unit.log`). |
| AC-LA-E3-02-09 | pending: Docker window (K2) | QA-E2E `K2-STORAGE` browser harness (`LA-E7-02`) | SIM Docker slot | Pending Docker window. Verified at fake-window + route unit level in `storage-pages.test.ts > ignores invalid replies and submits an empty value at 1500 ms` and `storage-check.test.ts > shows the storage help for an empty value and enforces the controlled 121-second expiry` (`e3-02-unit.log`). |
| AC-LA-E3-02-10 | pending: Docker window (K1-SIM) | `platform-storage-check.k1sim.test.ts > AC-LA-E3-02-10` | SIM Docker slot | Pending Docker window. Verified at host unit level in `storage-check.test.ts > keeps the cookie path and refuses a mismatched cookie without creating a storage check` and `a parallel login overwrites the storage slot; matching cookie present: true (BD-A2-44)` (`e3-02-unit.log`). |
| AC-LA-E3-02-11 | pending: Docker window (K1-SIM) | `platform-storage-check.k1sim.test.ts > AC-LA-E3-02-11` | SIM Docker slot | Pending Docker window. Verified at host unit level in `storage-check.test.ts > gates account status before origin and consumption, and allows the same check after reactivation` (`e3-02-unit.log`). |
| AC-LA-E3-02-12 | pending: Docker window (K1-SIM) | `platform-storage-check.k1sim.test.ts > AC-LA-E3-02-12` | SIM Docker slot | Pending Docker window. Verified at host unit level in `storage-check.test.ts > gates account status before origin and consumption, and allows the same check after reactivation` (`e3-02-unit.log`). |

### Additional K0 and unit checks (`LA-E3-02-k0.log`, `e3-02-unit.log`)

- **Rule 1a Canvas profile trait values (`LA-IC-06`):** `platform-storage-check.k0.test.ts > Rule 1a` and `services/lti-service/src/profiles/storage.test.ts > enables every Canvas profile and normalizes other absent values to null` verify that all 5 Canvas profiles (`canvas-cloud-production`, `canvas-cloud-beta`, `canvas-cloud-test`, `canvas-self-hosted`, `canvas-sim-cloud`) have `platformStorage: { targetFrame: 'from-login', origin: 'authOrigin' }` while `standard`, `blackboard` and `blackboard-sim` stay `null`.
- **Non-`POST` method check (`405`):** `storage-check.test.ts > returns 405 and Allow POST for non-POST methods on storage-check` verifies `GET /lti/launch/:account/storage-check` returns `405` with `Allow: POST`.
- **Reviewed `LA-IC-06` test-change list (plan LD-9):** Documented in `tests/ltiaas/tasks-lti/LA-E3-02/README.md` (`0` existing tests require edits because all existing Canvas simulator launches either omits `lti_storage_target` on login or presents the `oidc_state` cookie on launch).
- **F1 and F5 checks:** All 5 core files (`lti/launch.ts`, `http/routes/protocol.ts`, `lti/storage-pages.ts`, `store/storage-checks.ts`, `db/migrations/015_storage_check.sql`) have `0` F1 hits and `0` F5 hits (`LA-E3-02-k0.log`).

## Other checks

- **File scope (`d3c4848`):** Touches `services/lti-service/src/lti/{launch,storage-pages,codes}.ts`, `services/lti-service/src/http/routes/protocol.ts`, `services/lti-service/src/store/storage-checks.ts`, `services/lti-service/src/db/migrations/015_storage_check.sql`, `packages/channels/canvas/lti-profiles.ts`, and their Author tests. Does not touch `http/app.ts`, `http/auth.ts`, manifests, `app.ts`, `lti-generic` or app files.
- **Clone cleanliness:** `git status --porcelain` in `~/cogniate-qa-runs/LA/qa4-r8-a2dfc04/clone` is empty after the run (`status-after.txt`, 0 bytes).

## Regression and time

R0: PASS (`14.25s` K0 suite, `1.05s` focused 4-file unit run with 29 tests). `K1-SIM` (`AC-LA-E3-02-01`..`03`, `05`..`07`, `10`..`12`) and `K2` (`AC-LA-E3-02-08`, `09`) are `pending: Docker window`.
