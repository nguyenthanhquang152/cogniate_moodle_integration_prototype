Verdict: PASS (host-only K0 + UNIT; K1-SIM pending: Docker window)
Round: 4

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

## Round 2

Tester: QA-3 (Orca task `task_414df49ec4b5`, dispatch `ctx_6748375ee627`), 2026-10-23. Scope: Round 2 host-only verification of `67e5ab0` (lane K fix round 1) and A1 `BD-A1-96` + `BD-A1-97` (`0ad9807`, `cogniate-app-api-delta.md` §3.4 and §7).

Independence: QA-3 authored the Round 2 checks in `tests/ltiaas/tasks-core/LA-E2-04/grant-staged.k0.test.ts` from `docs/architecture/ltiaas/cogniate-app-api-delta.md` (§3.4, §5, §7) and `docs/architecture/ltiaas/build-decisions-A1.md` (`BD-A1-96`, `BD-A1-97`) without reading product source (`services/**`, `packages/**`, `apps/**`), Author notes or reviewer files (test harness files `services/cogniate-app/src/app/operator-bound-values.test.ts` and `services/cogniate-app/src/app/redemption-admin.test.ts` were inspected solely for the in-memory `createOperator` test harness signature).

| Item | Value |
| --- | --- |
| SHA | `4db030d157d14d09b385d52393982cf67f282086` (integration `4db030d`, code `176e823`; holds `LA-E2-04` fix round 1 `67e5ab0` + `0ad9807`) |
| Lane and slot | lane K; no Docker (`HOST-ONLY`; `K1-SIM` rows `AC-03`, `-04`, `-08` remain `pending: Docker window`) |
| Clone | `~/cogniate-qa-runs/LA/LA-E2-04/r2/clone`: `git clone --no-hardlinks --no-checkout`, detached at `4db030d157d14d09b385d52393982cf67f282086`, push URL `DISABLED`, `npm ci` at root and `tests/`, `node_modules/.vitest-cache` and `node_modules/.vite` deleted before every Vitest run |
| Environment | macOS arm64, Node 24.21.0, npm 11.19.0 |
| Artifacts | private run folder `~/cogniate-qa-runs/LA/LA-E2-04/r2/k0/` (umask 077): `vitest.log`, `e2-04-check-clean.log`, `e2-04-unit-by-ac.log`, `e2-04-r2-summary.json`, `head-sha.txt`, `status-after.txt` (`0` bytes) |

### Round 2 checks (`67e5ab0` + `BD-A1-96` + `BD-A1-97`)

| Check | Result | Test id | Evidence |
| --- | --- | --- | --- |
| (a) Finalized repeat compares submitted admin values with the committed approval's bound values (`B-LA-E2-04-02`, `cogniate-app-api-delta.md` §3.4) | PASS | `grant-staged.k0.test.ts > Round 2 (a) & (b)` + `redemption-admin.test.ts > B-LA-E2-04-02` | Identical repeat (including canonical origin `HTTPS://LMS.School.Edu:443` and blank `tokenAudience: ""`), staged short-body repeat, and fixed profiles return `200` with `0` LTI calls. Changed bound values (`accessTokenEndpoint`, `jwksUrl`, etc.) return `422 GRANT_MISMATCH` with `details.fields`, log `grant_rejected` with `reason: "mismatch"`, and make `0` LTI calls. `vitest.log`, `e2-04-unit-by-ac.log` |
| (b) Staged generic wizard sends `{ clientId, deploymentId, grantCode }` (`B-LA-E2-04-01` / `A-LA-E2-04-01`) | PASS | `grant-staged.k0.test.ts > Round 2 (a) & (b)` + `redemption-admin.test.ts` + `apps/portal/src/channels/shell.test.tsx` | `lti-generic` `manifest.setup.bindingFields` with `method: 'dynamic'` are `['clientId', 'deploymentId', 'grantCode']` (all `required: true`), pre-filled from `dto.platform`, and redeem the staged registration (`200`). `vitest.log`, `e2-04-unit-by-ac.log` |
| (c1) App delta §7 refused-event catalogue (`BD-A1-96`) | PASS | `grant-staged.k0.test.ts > Round 2 (c): BD-A1-96 refused-event catalogue` + `operator-bound-values.test.ts` | Verified `audit_event` (`result = 'refused'`) codes on manual (`bound_value_invalid`, `bound_values_missing`, `foreign_hosts_unconfirmed`, `not_staged`) and staged (`bound_values_missing` without `--accept-staged`, `bound_values_not_allowed`, `client_id_mismatch`, `deployment_mismatch`, `foreign_hosts_unconfirmed`, `staged_values_changed` checked before printing) paths. `vitest.log`, `e2-04-unit-by-ac.log` |
| (c2) `BD-A1-97` staged values changed after grant issue & unredeemed staged disconnect/release | PASS | `grant-staged.k0.test.ts > Round 2 (c)` + `redemption-admin.test.ts` | Staged platform values changed after grant issue returns `422 GRANT_MISMATCH` with `details.fields: ["jwksUrl"]` and logs `grant_rejected` (`reason: "mismatch"`). `DELETE /app-api/connections/:id` and `op.release(...)` on an unredeemed staged connection leave the inactive staged platform alone in `lti-service` (`active: false`). `vitest.log`, `e2-04-unit-by-ac.log` |
| (c3) `BD-A1-97` gone staged platform `409 PLATFORM_IN_USE` description (`cogniate-app-api-delta.md` §3.4) | **FAIL** | `grant-staged.k0.test.ts > Round 2 (c)` + `redemption-admin.test.ts > BD-A1-97` | When the staged platform is gone from `lti-service` before redemption, `PUT /app-api/connections/:id/platform` returns HTTP `409` with `details.message = "PLATFORM_IN_USE"`, **but `details.description` is still the generic developer-key string** (`"This your LMS developer key is already connected to Cogniate. Make a new developer key for this library, or ask your Cogniate operator."`) instead of naming the cause (`the staged registration is gone; make a new connection`) required by `BD-A1-97` (`0ad9807`) and `cogniate-app-api-delta.md` §3.4. `vitest.log` |

### Round 2 finding

- **F-LA-E2-04-R2-01 (`BD-A1-97` / `cogniate-app-api-delta.md` §3.4 — gone staged platform `409 PLATFORM_IN_USE` description):**
  - **Spec (`cogniate-app-api-delta.md` §3.4 / `BD-A1-97`):** *"If the staged platform is gone from the LTI service, the call returns `409 PLATFORM_IN_USE` with a description that says the staged registration is gone and to make a new connection."*
  - **Observed at `4db030d` (`67e5ab0`):** `PUT /app-api/connections/:id/platform` returns `409 PLATFORM_IN_USE`, leaves the grant unredeemed, and sets `connection.status = 'error'` with `last_error = 'PLATFORM_IN_USE'`, but `details.description` is `"This your LMS developer key is already connected to Cogniate. Make a new developer key for this library, or ask your Cogniate operator."` (no mention of the staged registration being gone or making a new connection).

### R0 `npm run check` and suite timings at `4db030d`

- **R0 `npm run check` (`e2-04-check-clean.log`):**
  - Vitest (`test:unit`): `190` files; `3,056` passed, `5` skipped.
  - Infra (`test:infra`, `node --test`): `254` pass, `0` fail.
  - K0 (`test:k0`): `3` files; `149` passed.
  - F1 (`fitness:lms-names`): `F1 PASS: 0 files with hits, 0 hits`.
  - F5 (`fitness:rules`): `F5 PASS: 6 rules (audit-event-delete, channel-sql-tables, connection-lms, no-score-sync, protocol-urls, sql-portability), 0 hits`.
- **Targeted unit + portal suite (`e2-04-unit-by-ac.log`):** `6` files (`operator-bound-values.test.ts`, `redemption-admin.test.ts`, `register-staged.test.ts`, `lms-texts.test.ts`, `lti-client.test.ts`, `apps/portal/src/channels/shell.test.tsx`), `92/92` passed (`2.18s`).
- **Measured time:** `LA-E2-04` K0 suite `98.33s` (`3/4` K0 tests passed, `1` failed on `F-LA-E2-04-R2-01`). `K1-SIM` rows (`AC-03`, `-04`, `-08`) remain `pending: Docker window`.

## Round 3

Tester: QA-3 (Orca task `task_ff4caf16fc2d`, dispatch `ctx_21fbb77c9fe0`), 2026-10-23. Scope: Round 3 host-only verification of `77df44e` (`da423f9`, lane L2 RQ-2 in a K file fixing `F-LA-E2-04-R2-01` / `B-LA-E2-04-04` / `BD-A1-97`) and re-run of the full `LA-E2-04` K0 suite (`4/4` tests) and Round 2 rows.

| Item | Value |
| --- | --- |
| SHA | `77df44e46c0e18a7b3ad833378983a4ac011a0f2` (integration `77df44e`; holds `da423f9` + `f00fbd2`) |
| Lane and slot | lane K (`da423f9` via lane L2 RQ-2); no Docker (`HOST-ONLY`; `K1-SIM` rows `AC-03`, `-04`, `-08` remain `pending: Docker window`, slot 4) |
| Clone | `~/cogniate-qa-runs/LA/LA-E2-04/r3/clone`: `git clone --no-hardlinks --no-checkout`, detached at `77df44e46c0e18a7b3ad833378983a4ac011a0f2`, push URL `DISABLED`, `npm ci` at root and `tests/`, `node_modules/.vitest-cache` and `node_modules/.vite` deleted before every Vitest run |
| Environment | macOS arm64, Node 24.21.0, npm 11.19.0 |
| Artifacts | private run folder `~/cogniate-qa-runs/LA/LA-E2-04/r3/k0/` (umask 077): `vitest.log`, `e2-04-check-clean.log`, `e2-04-unit-by-ac.log`, `e2-04-r2-summary.json`, `head-sha.txt`, `status-after.txt` (`0` bytes) |

### Round 3 checks (`77df44e` / `da423f9` + all Round 2 rows)

| Check | Result | Test id | Evidence |
| --- | --- | --- | --- |
| `F-LA-E2-04-R2-01` / `B-LA-E2-04-04` (`BD-A1-97`, `cogniate-app-api-delta.md` §3.4): gone staged platform `409 PLATFORM_IN_USE` description | PASS | `grant-staged.k0.test.ts > BD-A1-97 (cogniate-app-api-delta.md §3.4): a gone staged platform gives 409 PLATFORM_IN_USE with a description that says the staged registration is gone and to make a new connection` + `redemption-admin.test.ts` | When the staged platform is deleted from `lti-service` before redemption, `PUT /app-api/connections/:id/platform` returns `409 PLATFORM_IN_USE` with `details.description = "The staged registration of this connection is gone from the LTI service. Make a new connection, or ask your Cogniate operator."` (`e2-04-r2-summary.json`, `vitest.log`). |
| (a) Finalized repeat compares submitted admin values with the committed approval's bound values (`B-LA-E2-04-02`, `cogniate-app-api-delta.md` §3.4) | PASS | `grant-staged.k0.test.ts > Round 2 (a) & (b)` + `redemption-admin.test.ts > B-LA-E2-04-02` | Identical repeat (`200`), staged short-body repeat (`200`), and changed bound values (`422 GRANT_MISMATCH` with `details.fields: ["accessTokenEndpoint", "jwksUrl"]` and `grant_rejected` `reason: "mismatch"`) all pass with `0` LTI calls. `vitest.log`, `e2-04-r2-summary.json` |
| (b) Staged generic wizard sends `{ clientId, deploymentId, grantCode }` (`B-LA-E2-04-01` / `A-LA-E2-04-01`) | PASS | `grant-staged.k0.test.ts > Round 2 (a) & (b)` + `redemption-admin.test.ts` + `apps/portal/src/channels/shell.test.tsx` | `lti-generic` dynamic `bindingFields` are `['clientId', 'deploymentId', 'grantCode']` and redeem the staged registration (`200`). `vitest.log`, `e2-04-unit-by-ac.log` |
| (c1) App delta §7 refused-event catalogue (`BD-A1-96`) | PASS | `grant-staged.k0.test.ts > Round 2 (c)` + `operator-bound-values.test.ts` | Manual (`bound_value_invalid`, `bound_values_missing`, `foreign_hosts_unconfirmed`, `not_staged`) and staged (`bound_values_missing`, `bound_values_not_allowed`, `client_id_mismatch`, `deployment_mismatch`, `foreign_hosts_unconfirmed`, `staged_values_changed` checked before printing) `audit_event` (`result = 'refused'`) codes verified. `e2-04-r2-summary.json` |
| (c2) `BD-A1-97` staged values changed after grant issue & unredeemed staged disconnect/release | PASS | `grant-staged.k0.test.ts > Round 2 (c)` + `redemption-admin.test.ts` | Staged values changed after grant issue returns `422 GRANT_MISMATCH` (`details.fields: ["jwksUrl"]`); `DELETE /app-api/connections/:id` and `op.release(...)` on an unredeemed staged connection preserve the inactive staged platform (`active: false`). `e2-04-r2-summary.json` |

### R0 `npm run check` and suite timings at `77df44e`

- **R0 `npm run check` (`e2-04-check-clean.log`):**
  - Vitest (`test:unit`): `190` files; `3,057` passed, `5` skipped.
  - Infra (`test:infra`, `node --test`): `254` pass, `0` fail.
  - K0 (`test:k0`): `3` files; `149` passed.
  - F1 (`fitness:lms-names`): `F1 PASS: 0 files with hits, 0 hits`.
  - F5 (`fitness:rules`): `F5 PASS: 6 rules (audit-event-delete, channel-sql-tables, connection-lms, no-score-sync, protocol-urls, sql-portability), 0 hits`.
- **Targeted unit + portal suite (`e2-04-unit-by-ac.log`):** `6` files, `93/93` passed (`4.63s`).
- **Measured time:** `LA-E2-04` K0 suite `98.57s` (`4/4` K0 tests passed). `K1-SIM` rows (`AC-03`, `-04`, `-08`) remain `pending: Docker window` (Docker slot 4).

## Round 4

Tester: QA-3 (Orca task `task_029beaadd9c2`, dispatch `ctx_3952ce74962a`), 2026-10-23. Scope: Round 4 host-only verification of `BD-A1-101` (`2434c26`) and `BD-A1-102` (`048cc5e`, `e654574`) per `cogniate-app-api-delta.md` §3.4 and `LA-ADR-04` D8.

Independence: QA-3 authored the Round 4 checks in `tests/ltiaas/tasks-core/LA-E2-04/grant-staged.k0.test.ts` from `build-decisions-A1.md` (`BD-A1-101`, `BD-A1-102`) and `cogniate-app-api-delta.md` §3.4 without reading product source (`services/**`, `packages/**`, `apps/**`), Author notes or reviewer files (test files `services/cogniate-app/src/app/redemption-admin.test.ts` and `apps/portal/src/connect/provider-errors.test.tsx` were inspected solely for test harness conventions).

| Item | Value |
| --- | --- |
| SHA | `e65457445001a6a6636afbea7c55d66870211737` (integration `e654574`; holds `BD-A1-101` `2434c26` + `BD-A1-102` `048cc5e` & `e654574`) |
| Lane and slot | lane K (`2434c26`, `048cc5e` via L2 RQ-2) + lane P (`e654574`); no Docker (`HOST-ONLY`; `K1-SIM` rows `AC-03`, `-04`, `-08` remain `pending: Docker window`, slot 4) |
| Clone | `~/cogniate-qa-runs/LA/run19/clone`: `git clone --no-hardlinks --no-checkout`, detached at `e65457445001a6a6636afbea7c55d66870211737`, push URL `DISABLED`, `npm ci` at root and `tests/`, `node_modules/.vitest-cache` and `node_modules/.vite` deleted before every Vitest run |
| Environment | macOS arm64, Node 24.21.0, npm 11.19.0 |
| Artifacts | private run folder `~/cogniate-qa-runs/LA/run19/k0/LA-E2-04/` (umask 077): `vitest.log`, `e2-04-check-clean.log`, `e2-04-unit-by-ac.log`, `e2-04-r2-summary.json`, `~/cogniate-qa-runs/LA/run19/k0/head-sha.txt`, `~/cogniate-qa-runs/LA/run19/k0/status-after.txt` (`0` bytes) |

### Round 4 checks (`BD-A1-101` + `BD-A1-102`)

| Check | Result | Test id | Evidence |
| --- | --- | --- | --- |
| (a) `BD-A1-101` ordinary `PLATFORM_IN_USE` collision description (`texts.registration.PLATFORM_IN_USE`) | PASS | `grant-staged.k0.test.ts > Round 2..4` + `services/cogniate-app/src/app/redemption-admin.test.ts > the grant collision text (BD-A1-101)` + `packages/channel-kernel/src/manifest.test.ts` | An ordinary `PLATFORM_IN_USE` collision on `lti-generic` (and `brightspace`) returns `409 PLATFORM_IN_USE` with the core default `"This LMS tool registration is already connected to Cogniate. Make a new tool registration for this library, or ask your Cogniate operator."`; the `canvas` manifest keeps `"This {LMS} developer key is already connected to Cogniate. Make a new developer key for this library, or ask your Cogniate operator."` (`e2-04-r2-summary.json`, `e2-04-unit-by-ac.log`). |
| (b) `BD-A1-102` staged-gone `details.reason: "staged_gone"` vs ordinary collision | PASS | `grant-staged.k0.test.ts > BD-A1-97, BD-A1-101, BD-A1-102` + `redemption-admin.test.ts` | Staged-gone `409 PLATFORM_IN_USE` carries `details.reason = "staged_gone"` and `details.description = "The staged registration of this connection is gone from the LTI service. Make a new connection, or ask your Cogniate operator."`; the ordinary `409 PLATFORM_IN_USE` collision has no `details.reason` (`e2-04-r2-summary.json`). |
| (c) `BD-A1-102` portal shows the server description when `details.reason` is present | PASS | `apps/portal/src/connect/provider-errors.test.tsx > an answer with details.reason keeps the server description (BD-A1-102)` (2 tests) | `ChannelErrorNotice`, `ProviderErrorNotice`, `channelErrorText`, and `providerErrorMessage` show the server description byte for byte across all channels (`moodle`, `canvas`, `lti-generic`, `null`) when `details.reason` is present (`"staged_gone"`), and keep the channel or generic collision text when `details.reason` is absent or empty (`e2-04-unit-by-ac.log`). |

### R0 `npm run check` and suite timings at `e654574`

- **R0 `npm run check` (`e2-04-check-clean.log`):**
  - Vitest (`test:unit`): `191` files; `3,081` passed, `5` skipped.
  - Infra (`test:infra`, `node --test`): `254` pass, `0` fail (after 1 transient `sqlite-lock-probe.test.mjs` flake on the prior run).
  - K0 (`test:k0`): `3` files; `149` passed.
  - F1 (`fitness:lms-names`): `F1 PASS: 0 files with hits, 0 hits`.
  - F5 (`fitness:rules`): `F5 PASS: 6 rules (audit-event-delete, channel-sql-tables, connection-lms, no-score-sync, protocol-urls, sql-portability), 0 hits`.
- **Targeted unit + portal suite (`e2-04-unit-by-ac.log`):** `8` files (`operator-bound-values.test.ts`, `redemption-admin.test.ts`, `register-staged.test.ts`, `lms-texts.test.ts`, `lti-client.test.ts`, `packages/channel-kernel/src/manifest.test.ts`, `apps/portal/src/channels/shell.test.tsx`, `apps/portal/src/connect/provider-errors.test.tsx`), `116/116` passed (`2.90s`).
- **Measured time:** `LA-E2-04` K0 suite `119.93s` (`4/4` K0 tests passed). `K1-SIM` rows (`AC-03`, `-04`, `-08`) remain `pending: Docker window` (Docker slot 4).
