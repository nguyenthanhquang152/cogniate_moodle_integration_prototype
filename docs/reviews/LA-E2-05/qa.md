Verdict: PASS (K0 + UNIT + DOC + K1-SIM AC-04, AC-06, AC-10; AC-05 item 3 and K2 AC-07 pending next slot after 08:05Z)
Round: 3

# LA-E2-05 E2-N Channel `brightspace` (manual) and the add-channel gate F2: QA verification

Tester: QA-3 (Orca task `task_7ec531a0369e`, dispatch `ctx_0a588da380c9`), 2026-10-23. Spec: `docs/architecture/ltiaas/tasks/LA-E2-05.md` (with `LA-ADR-01` D2/D5/D6, `LA-ADR-02` D1/D4/D8, `LA-ADR-05` D4, `cogniate-app-api-delta.md` §3.3, and `BD-A1-78`, `BD-A1-80`, `BD-A1-94`, `BD-A1-95`). Suite: `tests/ltiaas/tasks-core/LA-E2-05/` (QA-3 test-first, authored in this round).

Independence: QA-3 authored `tests/ltiaas/tasks-core/LA-E2-05/` from `docs/architecture/ltiaas/tasks/LA-E2-05.md`, `LA-ADR-01` D2/D5/D6, `LA-ADR-02` D1/D4/D8, `LA-ADR-05` D4, `cogniate-app-api-delta.md` §3.3, and `build-decisions-A1.md` (`BD-A1-78`, `BD-A1-80`, `BD-A1-94`, `BD-A1-95`) before running any test against `71f4ced`, and did not read product source (`services/**`, `packages/**`, `apps/**`; only `packages/channels/brightspace/README.md` for `AC-LA-E2-05-08` and test files `packages/channels/brightspace/channel.test.ts`, `services/cogniate-app/src/kernel/setup/admin-value.test.ts`, and `services/cogniate-app/src/app/lti-generic.test.ts` after the initial green run).

| Item | Value |
| --- | --- |
| SHA | `71f4cedddb302aef80d77032291ec3f6faf6a3fd` (integration `71f4ced`; holds `LA-E2-05` lane K commit `a3d94347d61804cd92bbb44792b7e487f6d85441`; `E2-K-done` SHA `678eb72d7cc0813605017fd21ac8baf16fe7e0f9`) |
| Lane and slot | lane K; no Docker (`HOST-ONLY`; `K1-SIM` rows `AC-04`, `-05`, `-06` live, `-10` and `K2` row `AC-07` marked `pending: Docker window`) |
| Clone | `~/cogniate-qa-runs/LA/LA-E2-05/r1/clone`: `git clone --no-hardlinks --no-checkout`, detached at `71f4cedddb302aef80d77032291ec3f6faf6a3fd`, push URL `DISABLED`, `npm ci` at root and `tests/`, `node_modules/.vitest-cache` deleted before every Vitest run |
| Environment | macOS arm64, Node 24.21.0, npm 11.19.0 |
| Artifacts | private run folder `~/cogniate-qa-runs/LA/LA-E2-05/r1/k0/` (umask 077): `vitest.log`, `e2-05-check-clean.log`, `e2-05-ac01-f2-task-sha.log`, `e2-05-ac01-f2-head.log`, `e2-05-ac02-03-09-manifest-profile.json`, `e2-05-ac03-k0.log`, `e2-05-ac06-tool-config.json`, `e2-05-unit.log`, `e2-05-ac08-readme.md`, `head-sha.txt`, `e2-k-done-sha.txt`, `e2-05-commit-sha.txt`, `status-after.txt` |

## Acceptance criteria

| AC | Result | Test id | Command | Evidence |
| --- | --- | --- | --- | --- |
| AC-LA-E2-05-01 | PASS (K0) | `tests/ltiaas/tasks-core/LA-E2-05/brightspace.k0.test.ts > AC-LA-E2-05-01: npm run fitness:channel-diff -- --base <E2-K-done SHA> --channel brightspace reports core = 0 and lists only channel:brightspace, sim, tests and docs paths` | `LA_LEVEL=k0 LA_SCRATCH_CLONE=$PWD LA_E2_K_DONE_SHA=678eb72 LA_E2_05_SHA=a3d9434 LA_RUN_DIR=~/cogniate-qa-runs/LA/LA-E2-05/r1/k0 npx --no-install vitest run --config tests/ltiaas/tasks-core/LA-E2-05/vitest.config.mts --reporter=verbose` | From a detached checkout of `a3d9434` (`a3d94347d61804cd92bbb44792b7e487f6d85441`) against `E2-K-done` SHA `678eb72` (`678eb72d7cc0813605017fd21ac8baf16fe7e0f9`), `infra/scripts/fitness/channel-diff.mjs --base 678eb72 --channel brightspace` exits `0` with `F2 PASS: core = 0, paths = 4` (`channel:brightspace` paths `packages/channels/brightspace/{README.md,channel.test.ts,lti-profiles.ts,manifest.ts}`). At `71f4ced` + QA `tests/ltiaas/tasks-core/LA-E2-05/**`, `npm run fitness:channel-diff -- --base 678eb72 --channel brightspace` exits `0` with `F2 PASS: core = 0, paths = 10` (only `channel:brightspace`, `tests`, and `docs` paths). `e2-05-ac01-f2-task-sha.log`, `e2-05-ac01-f2-head.log` |
| AC-LA-E2-05-02 | PASS (K0 + UNIT) | `brightspace.k0.test.ts > AC-LA-E2-05-02, AC-LA-E2-05-03, AC-LA-E2-05-09` + `brightspace.k0.test.ts > AC-LA-E2-05-06 (host API/unit check) & AC-LA-E2-05-02 FieldSpec.default fills & manifest load checks` + `packages/channels/brightspace/channel.test.ts` (5 tests) | same | `brightspace` manifest `setup.bindingFields` sets `FieldSpec.default` constants: `issuer: "{siteUrl}"`, `authenticationEndpoint: "{siteUrl}/d2l/lti/authenticate"`, `jwksUrl: "{siteUrl}/d2l/.well-known/jwks"`, `accessTokenEndpoint: "https://auth.brightspace.com/core/connect/token"`, `tokenAudience: "https://api.brightspace.com/auth/token"`. `setupOf(reg, 'brightspace').parseBindingBody(...)` fills all 5 defaults when omitted and overrides them when posted values are supplied. `brightspace` profile has `endpoints: "admin"`, `issuerKind: "per-tenant"`, `endpointOrigins: "any-https"`, `clientAssertionAud: { value: "{platformValue}", form: "string" }`, `sharing: "exclusive"`, `privacyFloor: "allowlist"`, and `platformStorage: undefined` (`null`). `e2-05-ac02-03-09-manifest-profile.json`, `e2-05-unit.log` |
| AC-LA-E2-05-03 | PASS (K0) | `brightspace.k0.test.ts > AC-LA-E2-05-02, AC-LA-E2-05-03, AC-LA-E2-05-09` + `brightspace.k0.test.ts > ... manifest load checks` | same | `packages/channels/brightspace` has `manifest.ts`, `lti-profiles.ts`, `README.md`, and no `app.ts` (`servedByKernel(reg, 'brightspace') === true`); `npm run test:k0` passes (`3` files, `149` tests in `569ms`) with `brightspace` loaded and no kernel edit; legacy flags are `operatorApproval: true`, `addDeployment: true`, and `dynamicRegistration`, `webServices`, `courseShell`, `canvasConfiguration` all `false`. Load check 6 refuses a `brightspace` manifest variant with `manual -> self`. `e2-05-ac03-k0.log`, `e2-05-ac02-03-09-manifest-profile.json` |
| AC-LA-E2-05-04 | pending: Docker window (K1-SIM) | `brightspace.k1sim.test.ts > AC-LA-E2-05-04, AC-LA-E2-05-05, AC-LA-E2-05-10` | SIM Docker slot | Pending Docker window (D2L simulator provider `LA-E7-02`). |
| AC-LA-E2-05-05 | pending: Docker window (K1-SIM) | `brightspace.k1sim.test.ts > AC-LA-E2-05-04, AC-LA-E2-05-05, AC-LA-E2-05-10` | SIM Docker slot | Pending Docker window. Manifest verified at K0: `lti.guardedFamilies` is `[{ family: "desire2learn", level: "registration" }]`. |
| AC-LA-E2-05-06 | pending: Docker window (K1-SIM; host API + UNIT + K0 PASS) | `brightspace.k0.test.ts > AC-LA-E2-05-06 (host API/unit check) & AC-LA-E2-05-02 FieldSpec.default fills & manifest load checks` + `packages/channels/brightspace/channel.test.ts > the nine D2L tool rows...` + `services/cogniate-app/src/kernel/setup/admin-value.test.ts > BD-A1-78` + `brightspace.k1sim.test.ts > AC-LA-E2-05-06` (SIM) | same / SIM Docker slot | K1-SIM stack run pending Docker window. Verified at host API level via `testApp` (`POST /app-api/connections` for `brightspace` -> `201`, then `GET /app-api/connections/:id/tool-configuration` -> `200`): returns the 9 D2L rows `tool_name`, `domain`, `redirect_urls`, `openid_connect_login_url`, `target_link_uri`, `keyset_url`, `extensions`, `roles`, `privacy` in exact order with filled kernel placeholders (`cogniate-app-api-delta.md` §3.3, `BD-A1-78`, `BD-A1-94`) and no hardcoded `/lti/` protocol path in `manifest.ts`. `e2-05-ac06-tool-config.json`, `e2-05-unit.log` |
| AC-LA-E2-05-07 | pending: Docker window (K2) | K2 U3 browser flow (`brightspace`) | SIM Docker slot | Pending Docker window. |
| AC-LA-E2-05-08 | PASS (DOC + K0) | `brightspace.k0.test.ts > AC-LA-E2-05-08: packages/channels/brightspace/README.md lists each fact of LA-ADR-02 D4 with its source and status, and marks family and frame name UNVERIFIED` | same | `packages/channels/brightspace/README.md` lists all 18 rows of `LA-ADR-02` D4 facts with their values, sources (`R2 §5.4`, `LA-ADR-02 D4`, `BD-A1-78`/`80`, `LA-ADR-05 D4`), and status, and explicitly marks both the guarded product family (`desire2learn`) and the platform storage frame name (`platformStorage`) `**UNVERIFIED**`. `e2-05-ac08-readme.md` |
| AC-LA-E2-05-09 | PASS (K0 + UNIT) | `brightspace.k0.test.ts > AC-LA-E2-05-02, AC-LA-E2-05-03, AC-LA-E2-05-09` + `packages/channels/brightspace/channel.test.ts > AC-LA-E2-05-09 (manifest part)` | same | `capabilities('brightspace')['registration.scopes']` equals the 4 AGS scopes (`lineitem`, `lineitem.readonly`, `result.readonly`, `score`) and contains no NRPS scope (`LA-ADR-05` D4). `e2-05-ac02-03-09-manifest-profile.json` |
| AC-LA-E2-05-10 | pending: Docker window (K1-SIM) | `brightspace.k1sim.test.ts > AC-LA-E2-05-04, AC-LA-E2-05-05, AC-LA-E2-05-10` | SIM Docker slot | Pending Docker window (conformance kit on D2L simulator provider `LA-E7-02` / `LA-E7-06`). |

### R0 `npm run check` counts at `71f4ced` (`e2-05-check-clean.log`)

| Suite | Count at `71f4ced` |
| --- | --- |
| Vitest (`test:unit`) | 187 files; 3,017 passed, 5 skipped |
| Infra (`test:infra`, `node --test`) | 254 pass, 0 fail |
| K0 (`test:k0`) | 3 files; 149 passed |
| F1 (`fitness:lms-names`) | `F1 PASS: 0 files with hits, 0 hits` |
| F5 (`fitness:rules`) | `F5 PASS: 6 rules (audit-event-delete, channel-sql-tables, connection-lms, no-score-sync, protocol-urls, sql-portability), 0 hits` |

## Other checks

- **E2-N add-channel proof (`BD-A1-94`, `BD-A1-95`):** Adding `packages/channels/brightspace/{manifest.ts,lti-profiles.ts,README.md,channel.test.ts}` (`a3d9434`) on top of `E2-K-done` (`678eb72`) modified `0` core files (`F2 PASS: core = 0, paths = 4`), increased `test:k0` from `134` to `149` passing tests, and increased `test:unit` from `3,011` (`678eb72`) to `3,017` (`71f4ced`) with `0` closed-world regressions (rule N10).
- **Clone cleanliness:** `git status --porcelain` in `~/cogniate-qa-runs/LA/LA-E2-05/r1/clone` is empty after the run (`status-after.txt`, 0 bytes).
- **Measured time:** `LA-E2-05` K0 suite `92.46s` (`4/4` K0 tests passed; `2` unit files / `18/18` unit tests in `473ms`). `K1-SIM` (`AC-04`, `-05`, `-06` live, `-10`) and `K2` (`AC-07`) are `pending: Docker window`.

## Round 2

Tester: QA-3 (Orca task `task_e59ce20f8f0f`, dispatch `ctx_e6263da242a0`), 2026-10-23. Scope: Round 2 host-only verification of `6bfb150` (`BD-A1-85`: `lti.toolConfiguration = 'channel'` on `brightspace` and `lti-generic` so the nine D2L tool rows show through `GET /app-api/connections/:id/tool-configuration` and in the portal wizard, with K0 `K-ADAPTER` passing at `4d08fc1`) and re-run of all `LA-E2-05` rows at integration SHA `326ceae`.

| Item | Value |
| --- | --- |
| SHA | `326ceae8db2faeb438481e4f6f1bd704b4ced697` (integration `326ceae`; holds `6bfb150` + `1b298d9`) |
| Lane and slot | lane K; no Docker (`HOST-ONLY`; `K1-SIM` rows `AC-04`, `-05`, `-06` live, `-10` and `K2` row `AC-07` remain `pending: Docker window`, slot 4) |
| Clone | `~/cogniate-qa-runs/LA/run20/clone`: `git clone --no-hardlinks --no-checkout`, detached at `326ceae8db2faeb438481e4f6f1bd704b4ced697`, push URL `DISABLED`, `npm ci` at root and `tests/`, `node_modules/.vitest-cache` and `node_modules/.vite` deleted before every Vitest run |
| Environment | macOS arm64, Node 24.21.0, npm 11.19.0 |
| Artifacts | private run folder `~/cogniate-qa-runs/LA/run20/k0/LA-E2-05/` (umask 077): `vitest.log`, `e2-05-check-clean.log`, `e2-05-ac01-f2-task-sha.log`, `e2-05-ac01-f2-head.log`, `e2-05-ac02-03-09-manifest-profile.json`, `e2-05-ac03-k0.log`, `e2-05-ac06-tool-config.json`, `e2-05-unit.log`, `e2-05-ac08-readme.md` |

### Round 2 checks (`6bfb150` / `BD-A1-85` + all `LA-E2-05` rows)

| Check | Result | Test id | Evidence |
| --- | --- | --- | --- |
| `BD-A1-85` (`B-LA-E2-05-01` / `6bfb150`): `lti.toolConfiguration = 'channel'` on `brightspace` and `lti-generic`; 9 D2L tool rows in `GET .../tool-configuration` and portal wizard | PASS | `brightspace.k0.test.ts > AC-LA-E2-05-02, AC-LA-E2-05-03, AC-LA-E2-05-09 (and Round 2 BD-A1-85 lti.toolConfiguration = channel)` + `AC-LA-E2-05-06` + `apps/portal/src/channels/shell.test.tsx > renders all four default steps from brightspace manifest data` & `from lti-generic manifest data` | Both `reg.channel('brightspace')!.lti!.toolConfiguration` and `reg.channel('lti-generic')!.lti!.toolConfiguration` equal `'channel'`; K0 `K-ADAPTER` passes (`148/148` K0 tests in `1.14s`) without `app.ts` because all profiles are `endpoints: 'admin'`; `GET /app-api/connections/:id/tool-configuration` returns the 9 D2L rows in order and `apps/portal/src/channels/shell.test.tsx` renders all four wizard steps for `brightspace` and `lti-generic`. `e2-05-ac02-03-09-manifest-profile.json`, `e2-05-ac06-tool-config.json`, `e2-05-unit.log` |
| Re-run of `AC-LA-E2-05-01`, `AC-02`, `AC-03`, `AC-06` (host), `AC-08`, `AC-09` | PASS | `brightspace.k0.test.ts` (4/4 tests) + `packages/channels/brightspace/channel.test.ts` + `services/cogniate-app/src/kernel/setup/admin-value.test.ts` | F2 on `a3d9434` vs `678eb72` reports `F2 PASS: core = 0, paths = 4`; all D2L `FieldSpec.default` constants, profile traits, 4 AGS scopes, and README `UNVERIFIED` markers pass. `vitest.log`, `e2-05-unit.log` |

### R0 `npm run check` and suite timings at `326ceae`

- **R0 `npm run check` (`e2-05-check-clean.log`):**
  - Vitest (`test:unit`): `191` files; `3,086` passed, `5` skipped.
  - Infra (`test:infra`, `node --test`): `254` pass, `0` fail.
  - K0 (`test:k0`): `3` files; `148` passed (`149 -> 148` expected as `brightspace` `registration.dynamic` is now `true`).
  - F1 (`fitness:lms-names`): `F1 PASS: 0 files with hits, 0 hits`.
  - F5 (`fitness:rules`): `F5 PASS: 6 rules (audit-event-delete, channel-sql-tables, connection-lms, no-score-sync, protocol-urls, sql-portability), 0 hits`.
- **Targeted unit + portal suite (`e2-05-unit.log`):** `3` files (`packages/channels/brightspace/channel.test.ts`, `services/cogniate-app/src/kernel/setup/admin-value.test.ts`, `apps/portal/src/channels/shell.test.tsx`), `63/63` passed (`1.75s`).
- **Measured time:** `LA-E2-05` K0 suite `131.61s` (`4/4` K0 tests passed). `K1-SIM` (`AC-04`, `-05`, `-06` live, `-10`) and `K2` (`AC-07`) remain `pending: Docker window` (Docker slot 4).

## Round 3 (Slot 4 K1-SIM on `e1e4fab`)

| Item | Value |
| --- | --- |
| SHA | `e1e4fabf451276d6b5d2c07cb28024ad8ef6f271` (`e1e4fab`, code `5171f7f`) |
| Lane and slot | lane K; Slot 4 Docker SIM (`COMPOSE_PROJECT_NAME=qa3-la-sim-r3`, `PUBLIC_PORT=9453`, `STACK_SUBNET=172.21.0.0/16`) |
| Artifacts | `~/cogniate-qa-runs/LA/qa3-slot4-e1e4fab/artifacts/qa3-la-sim-r3-e1e4fabf-2026-10-23T06-35-01-035Z/` (`cmd/09-test-acceptance-LA-E2-05.log`, `container-LA-E2-05/vitest-results.json`, `reports/LA-E2-05.json`) |

| AC | Result | Test id | Evidence |
| --- | --- | --- | --- |
| AC-LA-E2-05-04 | PASS (K1-SIM) | `brightspace.k1sim.test.ts > AC-LA-E2-05-04` | Manual connect on `brightspace-sim` (`token` host `auth.brightspace.sim.test`, bound audience `https://api.brightspace.com/auth/token`, UUID deployment `f47ac10b-58cc-4372-a567-0e02b2c3d479`) with `--confirm-foreign-hosts`, learner launch, Deep Linking pick, and score pass (`1262.1 ms`); `/__sim/records` confirms the token request assertion `aud` equals `https://api.brightspace.com/auth/token`. `09-test-acceptance-LA-E2-05.log` |
| AC-LA-E2-05-05 | pending next slot after 08:05Z (`poll` import added in `brightspace.k1sim.test.ts`) | `brightspace.k1sim.test.ts > AC-LA-E2-05-05` | Items 1 & 2 (`desire2learn` launch on `lti-generic` platform passes + logs `family_guard_mismatch`; `desire2learn` launch on Moodle `standard` platform returns `400 PROVIDER_PROFILE_MISMATCH`) executed in `qa3-la-sim-r1` and `qa3-la-sim-r3`; item 3 (`poll` import added for complete-time `family=desire2learn` check with `brightspace-dynamic` loaded) is ready for the post-08:05Z slot. |
| AC-LA-E2-05-06 | PASS (K1-SIM + UNIT + K0) | `brightspace.k1sim.test.ts > AC-LA-E2-05-06` | Live `GET /app-api/connections/:id/tool-configuration` returns the 9 D2L rows in exact `cogniate-app-api-delta.md` §3.3 order (`104.7 ms`). `09-test-acceptance-LA-E2-05.log` |
| AC-LA-E2-05-10 | PASS (K1-SIM) | `brightspace.k1sim.test.ts > AC-LA-E2-05-10` | Full K1 kit (`K1-LAUNCH`, `K1-DL`, `K1-AGS`, `K1-NRPS` with `0` NRPS calls, `K1-REG`, `K1-CAP`) passes on `brightspace-sim` (`1309.6 ms`). `09-test-acceptance-LA-E2-05.log` |
