Verdict: PASS (host-only K0 + UNIT; K1-SIM pending: Docker window)
Round: 1

# LA-E2-04 E2-K Operator grant bound values, `--accept-staged`, redemption checks and the staged registration page: QA verification

Tester: QA-3 (Orca task `task_9b05d182d78f`, dispatch `ctx_3c190ff75ff7`), 2026-10-23. Spec: `docs/architecture/ltiaas/tasks/LA-E2-04.md` (with `LA-ADR-02` D2a/D5/D6, `LA-ADR-04` D4 rule 5, `cogniate-app-api-delta.md` §3.4/§5/§7, and `BD-A1-59`, `BD-A1-79`, `BD-A1-87`, `BD-A1-90`, `BD-A1-91`, `BD-A1-92`). Suite: `tests/ltiaas/tasks-core/LA-E2-04/` (QA-3 test-first, authored in this round).

Independence: QA-3 authored `tests/ltiaas/tasks-core/LA-E2-04/` from `docs/architecture/ltiaas/tasks/LA-E2-04.md`, `LA-ADR-02` D2a/D5/D6, `LA-ADR-04` D4 rule 5, `cogniate-app-api-delta.md` §3.4/§5/§7, and `build-decisions-A1.md` (`BD-A1-59`, `BD-A1-79`, `BD-A1-87`, `BD-A1-90`..`92`) without reading product source (`services/**`, `packages/**`, `apps/**`), Author notes or reviewer files.

| Item | Value |
| --- | --- |
| SHA | `6689a185faa90c444de2e1c540a476bccb4dcf01` (integration `6689a18`, code `0e6bace`; holds `LA-E2-04` merge `0e6bace`) |
| Lane and slot | lane K; no Docker (`HOST-ONLY`; `K1-SIM` rows `AC-03`, `-04`, `-08` marked `pending: Docker window`) |
| Clone | `~/cogniate-qa-runs/LA/run14/r1/clone`: `git clone --no-hardlinks --no-checkout`, detached at `6689a185faa90c444de2e1c540a476bccb4dcf01`, push URL `DISABLED`, `npm ci` at root and `tests/`, `node_modules/.vitest-cache` deleted before every Vitest run |
| Environment | macOS arm64, Node 24.21.0, npm 11.19.0 |
| Artifacts | private run folder `~/cogniate-qa-runs/LA/run14/r1/k0/LA-E2-04/` (umask 077): `e2-04-check-clean.log`, `e2-04-unit-by-ac.log` |

## Acceptance criteria

| AC | Result | Test id | Command | Evidence |
| --- | --- | --- | --- | --- |
| AC-LA-E2-04-01 | PASS (K0 + UNIT) | `tests/ltiaas/tasks-core/LA-E2-04/grant-staged.k0.test.ts` + `services/cogniate-app/src/app/operator-bound-values.test.ts > AC-LA-E2-04-01: bound values on an admin-value channel, and the baseline flag rule` (2 tests) | `LA_LEVEL=k0 LA_SCRATCH_CLONE=$PWD LA_RUN_DIR=~/cogniate-qa-runs/LA/run14/r1/k0/LA-E2-04 npx --no-install vitest run --config tests/ltiaas/tasks-core/LA-E2-04/vitest.config.mts --reporter=verbose` | `connection-grant issue` for an `lti-generic` connection without the seven bound flags (or `--accept-staged`) exits 1 and stores no row; a bound flag on a fixed-endpoint (`moodle`/`blackboard`) connection exits 1 and stores no row. `e2-04-unit-by-ac.log` |
| AC-LA-E2-04-02 | PASS (K0 + UNIT) | `grant-staged.k0.test.ts` + `services/cogniate-app/src/app/operator-bound-values.test.ts > AC-LA-E2-04-02: bound values before the code, and foreign hosts` (2 tests) | same | `connection-grant issue` prints the bound values before the code, marks each value whose host differs from the issuer host, exits 1 without `--confirm-foreign-hosts` (storing nothing), and issues the grant when `--confirm-foreign-hosts` is passed. `e2-04-unit-by-ac.log` |
| AC-LA-E2-04-03 | pending: Docker window (K1-SIM; UNIT part PASS) | `grant-staged.k1sim.test.ts > AC-LA-E2-04-03` (SIM) + `services/cogniate-app/src/app/redemption-admin.test.ts > AC-LA-E2-04-03: the manual admin-value redemption` (4 tests) | SIM Docker slot / same | K1-SIM part pending Docker window. Host unit tests verify the manual redemption checks all 7 bound values before spending the grant (`422 GRANT_MISMATCH` with `details.fields`, grant stays unredeemed, no LTI platform created) and that matching values redeem once, create an active `lti-generic` platform + deployment (`exclusive_platform`), and transition the connection to `connected`. `e2-04-unit-by-ac.log` |
| AC-LA-E2-04-04 | pending: Docker window (K1-SIM; UNIT part PASS) | `grant-staged.k1sim.test.ts > AC-LA-E2-04-04` (SIM) + `services/cogniate-app/src/app/redemption-admin.test.ts > the staged registration redemption (AC-LA-E2-04-04 unit part)` (3 tests) | SIM Docker slot / same | K1-SIM part pending Docker window. Host unit tests verify the full chain (staged `/tool/register` page -> `--accept-staged` -> short `{grantCode}` body activates the existing staged platform with `PATCH /api/platforms/:id {active: true}` and no second create), refuses the full manual body on a staged connection, and returns `422 GRANT_MISMATCH` if staged platform values changed after grant issuance (`BD-A1-92`). `e2-04-unit-by-ac.log` |
| AC-LA-E2-04-05 | PASS (K0 + UNIT) | `grant-staged.k0.test.ts` + `services/cogniate-app/src/tool-pages/register-staged.test.ts` (4 tests) + `services/cogniate-app/src/tool-pages/lms-texts.test.ts` (16 tests) + `services/cogniate-app/src/clients/lti-client.test.ts` | same | When `POST /api/registration/complete` returns `active: false` (`endpointsOnIssuerOrigin: false`), `/tool/register` stores `target_kind = 'exclusive_platform'` and `target_ref = platform.id` (`BD-A1-91`), leaves the connection in `pending` (`last_error = null`), renders the staged page (does not call `LMS_REGISTRATION_COMPLETE` or `window.close()`), and maps `REGISTRATION_UPDATE_NOT_ALLOWED` to `manifest.texts.registration.UPDATE_NOT_ALLOWED` (`BD-A1-59`, `BD-A1-87`). `e2-04-unit-by-ac.log` |
| AC-LA-E2-04-06 | PASS (K0 + UNIT) | `grant-staged.k0.test.ts` + `services/cogniate-app/src/app/operator-bound-values.test.ts > the staged registration (AC-LA-E2-04-06; --accept-staged)` (2 tests) | same | `connection-grant issue --accept-staged` on a connection without an inactive staged platform exits 1 and stores nothing (`BD-A1-91`: checks `target_kind === 'exclusive_platform'`, `status === 'pending'`, `platform.active === false`, `platform.bindingRef === connection.id`). `e2-04-unit-by-ac.log` |
| AC-LA-E2-04-07 | PASS (K0 + UNIT) | `grant-staged.k0.test.ts` + `services/cogniate-app/src/app/redemption-admin.test.ts > AC-LA-E2-04-07: suspend and release pick the record kind from the stored target_kind` (1 test) | same | Suspend and release dispatch on the stored `connection.target_kind` (`exclusive_platform` vs `deployment`) rather than the channel's `issuerKind` (`LA-ADR-04` D4 rule 5), suspending and deleting the `exclusive_platform` record cleanly. `e2-04-unit-by-ac.log` |
| AC-LA-E2-04-08 | pending: Docker window (K1-SIM) | `grant-staged.k1sim.test.ts > AC-LA-E2-04-08` | SIM Docker slot | Pending Docker window. |

## Other checks

- **Build decisions verified (`BD-A1-59`, `BD-A1-79`, `BD-A1-87`, `BD-A1-90`..`92`):**
  - `BD-A1-90`: Migration `009_connection_grant_bound_values.sql` adds nullable `bound_values_json TEXT` to `connection_grants`.
  - `BD-A1-91`: Staged `complete` writes `target_kind = 'exclusive_platform'` and `target_ref = platform.id` while keeping `status = 'pending'`; retry on the same pending connection cleans up a replaced staged platform (`register-staged.test.ts > a new staged platform on the same pending connection cleans up the old one`).
  - `BD-A1-92`: Staged redemption re-reads the staged platform from `lti-service` and compares all 7 fields (`issuer`, `clientId`, `deploymentId`, `authenticationEndpoint`, `accesstokenEndpoint`, `jwksUrl`, `clientAssertionAud`) against `bound_values_json` before spending the grant or activating the platform.
- **R0 `npm run check` at `6689a18` (`e2-04-check-clean.log`):**
  - Vitest (`test:unit`): `178` files; `2,879` passed, `5` skipped.
  - Infra (`test:infra`, `node --test`): `254` pass, `0` fail.
  - K0 (`test:k0`): `3` files; `134` passed.
  - F1 (`fitness:lms-names`): `F1 PASS: 0 files with hits, 0 hits`.
  - F5 (`fitness:rules`): `F5 PASS: 6 rules (audit-event-delete, channel-sql-tables, connection-lms, no-score-sync, protocol-urls, sql-portability), 0 hits`.
- **Measured time:** `LA-E2-04` K0 suite `96.86s` (`2/2` K0 tests; `5` unit test files / `45/45` unit tests in `1.40s`). `K1-SIM` rows (`AC-03`, `-04`, `-08`) are `pending: Docker window`.
