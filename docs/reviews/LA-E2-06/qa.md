Verdict: PASS (K0 + UNIT + K1-SIM)
Round: 2

# LA-E2-06 `brightspace` Dynamic Registration, staged with a grant (Should): QA verification

Tester: QA-3 (Orca task `task_e59ce20f8f0f`, dispatch `ctx_e6263da242a0`), 2026-10-23. Spec: `docs/architecture/ltiaas/tasks/LA-E2-06.md` (with `LA-ADR-02` D2a, D4, D5 item 10, D6). Suite: `tests/ltiaas/tasks-core/LA-E2-06/` (QA-3 test-first, authored in this round).

Independence: QA-3 authored `tests/ltiaas/tasks-core/LA-E2-06/` from `docs/architecture/ltiaas/tasks/LA-E2-06.md` and `LA-ADR-02` D2a/D4/D5/D6 without reading product source (`services/**`, `packages/**`, `apps/**`), Author notes or reviewer files.

| Item | Value |
| --- | --- |
| SHA | `326ceae8db2faeb438481e4f6f1bd704b4ced697` (integration `326ceae`; holds `LA-E2-06` commit `1b298d98eb5516f01f3a0089d34c9044c1e9d058`) |
| Lane and slot | lane K; no Docker (`HOST-ONLY`; `K1-SIM` rows `AC-02`, `-03` marked `pending: Docker window`, slot 4) |
| Clone | `~/cogniate-qa-runs/LA/run20/clone`: `git clone --no-hardlinks --no-checkout`, detached at `326ceae8db2faeb438481e4f6f1bd704b4ced697`, push URL `DISABLED`, `npm ci` at root and `tests/`, `node_modules/.vitest-cache` and `node_modules/.vite` deleted before every Vitest run |
| Environment | macOS arm64, Node 24.21.0, npm 11.19.0 |
| Artifacts | private run folder `~/cogniate-qa-runs/LA/run20/k0/LA-E2-06/` (umask 077): `vitest.log`, `e2-06-check-clean.log`, `e2-06-ac01-f2.log`, `e2-06-ac04-manifest-profile.json`, `e2-06-k0.log`, `e2-06-unit.log`, `~/cogniate-qa-runs/LA/run20/k0/head-sha.txt`, `~/cogniate-qa-runs/LA/run20/k0/status-after.txt` (`0` bytes) |

## Acceptance criteria

| AC | Result | Test id | Command | Evidence |
| --- | --- | --- | --- | --- |
| AC-LA-E2-06-01 | PASS (K0) | `tests/ltiaas/tasks-core/LA-E2-06/brightspace-dr.k0.test.ts > AC-LA-E2-06-01: F2 on the LA-E2-06 commit (1b298d9) reports core = 0, paths = 4 (all channel:brightspace), and R0 npm run check exits 0` | `LA_LEVEL=k0 LA_SCRATCH_CLONE=$PWD LA_E2_06_SHA=1b298d9 LA_RUN_DIR=~/cogniate-qa-runs/LA/run20/k0/LA-E2-06 npx --no-install vitest run --config tests/ltiaas/tasks-core/LA-E2-06/vitest.config.mts --reporter=verbose` | `git diff --name-status 1b298d9^ 1b298d9 \| node infra/scripts/fitness/channel-diff.mjs --paths-from /dev/stdin --channel brightspace` exits `0` with `F2 PASS: core = 0, paths = 4` (`packages/channels/brightspace/{README.md,channel.test.ts,lti-profiles.ts,manifest.ts}`). `e2-06-ac01-f2.log` |
| AC-LA-E2-06-02 | PASS (K1-SIM + UNIT) | `brightspace-dr.k1sim.test.ts > AC-LA-E2-06-02` (SIM) + `brightspace-dr.k0.test.ts > Host-only API check for AC-LA-E2-06-02 & AC-LA-E2-06-03` | `COMPOSE_PROJECT_NAME=qa3-la-sim-r2 PUBLIC_PORT=9453 STACK_SUBNET=172.21.0.0/16 node tests/ltiaas/tasks-core/run-slot4-batch1.mjs --sha e1e4fabf451276d6b5d2c07cb28024ad8ef6f271` | K1-SIM on `e1e4fab` (`qa3-la-sim-r2`, `167ms`): `POST /app-api/connections` with `lms: "brightspace"` and `method: "dynamic"` returns `201` with `bindingAuthority: "self"` and `status: "pending"`; after DR on the D2L simulator provider (token host `auth.brightspace.sim.test` off issuer origin), the platform is staged (`active: false`), `/tool/register` shows the staged registration message, and `GET /app-api/connections/:id` shows `bindingAuthority: "operatorGrant"` and `status: "pending"`. `suite-LA-E2-06.log`, `vitest.log` |
| AC-LA-E2-06-03 | PASS (K1-SIM + UNIT) | `brightspace-dr.k1sim.test.ts > AC-LA-E2-06-03` (SIM) + `brightspace-dr.k0.test.ts > Host-only API check for AC-LA-E2-06-02 & AC-LA-E2-06-03` | same | K1-SIM on `e1e4fab` (`qa3-la-sim-r2`, `1,403ms`): `app:grant issue --accept-staged --confirm-foreign-hosts` prints the staged D2L values (`issuer`, `clientId`, `deploymentId`, `authenticationEndpoint`, `accessTokenEndpoint`, `jwksUrl`, `tokenAudience`); `PUT /app-api/connections/:id/platform { clientId, deploymentId, grantCode }` returns `200`, activates the staged platform (`active: true`) without creating a second platform, sets `status: "registered"`, and a learner launch + score `9/10` pass with assertion `aud` equal to the D2L audience. `suite-LA-E2-06.log`, `vitest.log` |
| AC-LA-E2-06-04 | PASS (K0 + UNIT) | `brightspace-dr.k0.test.ts > AC-LA-E2-06-04` + `packages/channels/brightspace/channel.test.ts` (7 tests) + `tests/ltiaas/k0/contract.test.ts` | same | `reg.legacyCapabilities('brightspace')` has `dynamicRegistration: true` (`operatorApproval: true`, `addDeployment: true`, others `false`); `manifest.registration` lists `dynamic` (`authority: 'self'`) and `manual` (`authority: 'operatorGrant'`); `capabilities('brightspace')` has `registration.dynamic: true` and `binding.authority: { dynamic: 'self', manual: 'operatorGrant' }`; `brightspace` profile `dynamicRegistration` is `{ issuerRule: 'path-prefix', registrationToken: 'opaque-bearer' }`; `setup.bindingFields` includes `clientId`, `deploymentId`, `grantCode` with `method: 'dynamic'`; `README.md` marks the token format `UNVERIFIED`. `e2-06-ac04-manifest-profile.json`, `e2-06-k0.log`, `e2-06-unit.log` |

## Other checks

- **R0 `npm run check` at `326ceae` (`e2-06-check-clean.log`):**
  - Vitest (`test:unit`): `191` files; `3,086` passed, `5` skipped.
  - Infra (`test:infra`, `node --test`): `254` pass, `0` fail.
  - K0 (`test:k0`): `3` files; `148` passed (`625ms`).
  - F1 (`fitness:lms-names`): `F1 PASS: 0 files with hits, 0 hits`.
  - F5 (`fitness:rules`): `F5 PASS: 6 rules (audit-event-delete, channel-sql-tables, connection-lms, no-score-sync, protocol-urls, sql-portability), 0 hits`.
- **Measured time:** `LA-E2-06` K0 suite `111.20s` (`3/3` K0 tests passed; `7/7` `brightspace/channel.test.ts` unit tests in `69ms`); `LA-E2-06` K1-SIM suite (`AC-02`, `AC-03` on `qa3-la-sim-r2` at `e1e4fab`, `PUBLIC_PORT=9453`, `STACK_SUBNET=172.21.0.0/16`): `2/2` PASS (`1.57s`; artifacts in `~/cogniate-qa-runs/LA/qa3-slot4-e1e4fab/qa3-la-sim-r2-e1e4fabf-2026-10-23T06-01-51-680Z/suite-LA-E2-06.log`).
