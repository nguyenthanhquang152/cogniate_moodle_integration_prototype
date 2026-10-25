Verdict: PASS
Round: 4

# LA-E7-01 K0 channel contract suite and the canary channel: QA verification

Tester: lead QA (Round 1: `task_9eba03b67aaa` / `ctx_cb28274cfd08`; Round 2: `task_1100e1e862e3` / `ctx_02bcb0afde80`; Round 3: `task_a8adccfe1547` / `ctx_7c3cb8b3db3a`; Round 4: `task_e83f04afbb74` / `ctx_f232fb808203`), 2026-10-23. Spec: `docs/architecture/ltiaas/tasks/LA-E7-01.md`. Design: `docs/architecture/ltiaas/adr/LA-ADR-01-channel-kernel.md` (D2–D6, D10–D12, test impact), `BD-A1-20`, `BD-A1-28`, `BD-A1-85`, `BD-A1-110`, and `tests/ltiaas/TEST-STRATEGY.md` §2.7.

Independence: Lead QA wrote `tests/ltiaas/k0/contract.test.ts` and `tests/ltiaas/canary/**` from the task spec, `LA-ADR-01`, `TEST-STRATEGY.md` §2.7, and the public entry points of `docs/architecture/ltiaas/tasks/README.md` §3 (`@cogniate/channel-kernel`, `services/lti-service/src/profiles/index.ts`, and `services/cogniate-app/src/kernel/ports.ts`). Lead QA read no product source files.

## Round 4 (`BD-A1-110` `setup.connectionCheck` Kit Update + `buildProfileRegistryCompat` Shim Removal)

| Item | Value |
| --- | --- |
| SHA | Verified on `c62b373d` and `e4a3ceefb3b68edeeefc0a1ba1088725d6df7b7c` (`quang/ltiaas-milestone`) |
| Lane and slot | host-only (no Docker) |
| Clone | `/Users/quangnguyen/cogniate-qa-runs/LA/K0-connectionCheck/r1/clone` (`git clone --no-hardlinks`, push URL disabled, `npm ci --no-audit --no-fund`, `node_modules/.vitest-cache` cleared before every Vitest run) |
| Files delivered | `tests/ltiaas/k0/contract.test.ts`, `docs/reviews/LA-E7-01/qa.md` |
| Artifacts | `/Users/quangnguyen/cogniate-qa-runs/LA/K0-connectionCheck/r1/logs/`: `tsc.log`, `k0-c62b373-without-connectionCheck.log`, `k0-c62b373-with-lti-generic-connectionCheck.log`, `k0-without-connectionCheck.log`, `k0-with-lti-generic-connectionCheck.log` |

### Changes in Round 4

| Item | Resolution |
| --- | --- |
| `BD-A1-110` (`K-ADAPTER` `setup.connectionCheck` without `app.ts`) | Removed `manifest.setup.connectionCheck === true` from `needsAdapter` in `tests/ltiaas/k0/contract.test.ts:1132-1136` and updated the no-`app.ts` branch (`contract.test.ts:1153-1157`) to assert `expect(channelCaps['setup.connectionCheck']).toBe(Boolean(manifest.setup?.connectionCheck))` (since `POST /app-api/connections/:id/check` → LTI `POST /api/platforms/:id/check` is a core route guarded by `setup.connectionCheck` that uses no `ConnectionSetup` member). Verified in the clean clone both without `lti-generic` `setup.connectionCheck: true` (`147/147` pass in `610 ms` on `c62b373`; `146/146` pass in `970 ms` on `e4a3ceef` after `LA-E6-04` part 1 enabled `canvas` `setup.connectionCheck`) and with simulated `lti-generic` `setup.connectionCheck: true` (`146/146` pass in `619 ms` on `c62b373`; `145/145` pass in `867 ms` on `e4a3ceef`). |
| `buildProfileRegistryCompat` dead shim removal (`BD-A1-75` / `78ffce1`) | Removed the transitional `buildProfileRegistryCompat` function (`contract.test.ts:685-708`) and called `buildProfileRegistry(productMerged)` and `buildProfileRegistry(combinedMerged)` directly (`contract.test.ts:693,701`). `npx --no-install tsc -p tests/ltiaas/tsconfig.json --noEmit` exits `0` (`0` errors) and K0 passes `147/147` on `c62b373` (`146/146` on `e4a3ceef`). |

---

## Round 3

| Item | Value |
| --- | --- |
| SHA | `5770cbe` (integration `quang/ltiaas-milestone`), plus verification with `1b51999` (`services/cogniate-app/src/kernel/ports.ts` from lane `la-k`) merged locally |
| Lane and slot | host-only (no Docker) |
| Clone | `~/cogniate-qa-runs/LA/LA-E7-01/r3/clone` (`git clone --no-hardlinks`, push URL disabled, `npm ci --ignore-scripts`) |
| Files delivered | `tests/ltiaas/k0/contract.test.ts`, `tests/ltiaas/canary/zz-canary/app.ts`, `tests/ltiaas/tsconfig.json`, `docs/reviews/LA-E7-01/qa.md` |
| Artifacts | `~/cogniate-qa-runs/LA/LA-E7-01/r3/`: `a-integration-k0.log`, `d3-prose-edit-k0.log`, `m1-status.log`, `a-integration-check.log`, `b-with-1b51999-k0.log`, `b-with-1b51999-kit-typecheck.log`, `b-with-1b51999-check.log` |

### Round 2 review findings and `BD-A1-28` addressed in Round 3

| Item | Severity | Resolution in Round 3 |
| --- | --- | --- |
| `B-LA-E7-01-07` | MINOR | Removed `parseAdr01D3Tables` and `fs.readFileSync(adr01Path)` from `tests/ltiaas/k0/contract.test.ts`. Replaced runtime ADR markdown parsing with `FROZEN_D3_CATALOG_ORACLE` (frozen in the kit, each row citing its `LA-ADR-01 D3` lines `145–176`) and compared product `CAPABILITY_CATALOG` (`{ kind, source }`) and product `legacyProjection` single-capability flip directly against `CAPABILITY_GUARD_TABLE` and `FROZEN_D3_CATALOG_ORACLE`. Verified that rewording D3 prose in `docs/architecture/ltiaas/adr/LA-ADR-01-channel-kernel.md` (`"the picker stays single select"` → `"the picker keeps single selection"`) changes 0 K0 results (`118 passed | 3 todo`, `d3-prose-edit-k0.log`), while mutation `M1` (`status: 409` → `418` on `deployments.multiple`) still fails 4 `K-CAP` tests (`m1-status.log`). |
| `B-LA-E7-01-08` & `BD-A1-28` | NIT / Ruling | Updated `tests/ltiaas/k0/contract.test.ts` and `tests/ltiaas/canary/zz-canary/app.ts` (`satisfies ConnectionSetup`) to `import type` from `services/cogniate-app/src/kernel/ports.ts` (`1b51999`) and fill every required context field: `ToolConfigurationContext` (`{ urls: { lti, app, content }, libraryName, sharedClientId }`), `PlatformBodyContext` (`{ siteUrl, clientId, sharedClientId }`) + `purpose: 'initial'` (`GrantPurpose`), `InitialTargetContext` (`{ connection, values, profile, sharedPlatform }`), `CreateRequestContext` (`{ libraryName }`), and `selfCreate` values (`{ issuer, authenticationEndpoint, accessTokenEndpoint, jwksUrl, tokenAudience, clientId, deploymentId }`). Fixture `grantCode` uses 43 base64url characters (`VALID_GRANT_CODE_43`), and a negative probe asserts that a malformed `grantCode` returns `{ ok: false, fields: ['grantCode'] }`. Extension-port assertions (`extensionRoutes`, `publishHooks`, `packageExporters`) are gated as pending `LA-E1-08` on baseline channels until defined on `adapter`, while the canary keeps the full rule. |
| Baseline `K-ADAPTER` switch (`1b51999`) | Ruling | Changed the baseline `K-ADAPTER` switch so `moodle`, `canvas`, and `blackboard` register `it.todo` while `initialLoaded.appAdapter === undefined` (`LA-E1-07`), rather than checking `!fs.existsSync(appPortsPath)`. Verified both (a) on `quang/ltiaas-milestone` (`5770cbe`) as-is (`a-integration-k0.log`, `a-integration-check.log` exit `0`) and (b) with `1b51999` merged locally (`b-with-1b51999-k0.log`, `b-with-1b51999-kit-typecheck.log`, `b-with-1b51999-check.log` all exit `0`, `118 passed | 3 todo`). |

---

## Round 2

| Item | Value |
| --- | --- |
| SHA | `c82b67c9bf42634c0f51ab85e9c3fa932f1685ab` (integration `quang/ltiaas-milestone`) |
| Lane and slot | host-only (no Docker) |
| Clone | `~/cogniate-qa-runs/LA/LA-E7-01/r2/clone` (`git clone --no-hardlinks`, push URL disabled, `npm ci --ignore-scripts`) |
| Files delivered | `tests/ltiaas/k0/contract.test.ts`, `tests/ltiaas/canary/package.json`, `tests/ltiaas/canary/zz-canary/{manifest.ts,lti-profiles.ts,app.ts,README.md}`, `tests/ltiaas/canary/zz-canary-admin/{manifest.ts,lti-profiles.ts,README.md}` |
| Artifacts | `~/cogniate-qa-runs/LA/LA-E7-01/r2/`: `k0-verbose.log`, `m1-status.log`, `m2-method-rename.log`, `m3-db-touch.log`, `form-k-scratch.log`, `npm-run-check.log` |

### Round 1 review findings addressed

| Finding | Severity | Resolution in Round 2 |
| --- | --- | --- |
| `A-LA-E7-01-01`, `B-LA-E7-01-01` | BLOCKER / MAJOR | Rewrote `K-CAP` (`tests/ltiaas/k0/contract.test.ts`) to call product code (`reg.capabilities`, `computeCapabilities`, `reg.legacyCapabilities`, `legacyProjection`) on both the channel's actual off state and a mutated on copy (`guard.enableIn`), and to parse `docs/architecture/ltiaas/adr/LA-ADR-01-channel-kernel.md` D3 (lines 147–180) at test time as the oracle for HTTP status, error code, `details.capability` and guard summary. Corrected `registration.dynamic` (`422 CAPABILITY_NOT_SUPPORTED`, `details.capability: 'dynamicRegistration'`), `site.serviceOrigin` (`400 INVALID_REQUEST`), and behaviour/CLI guards (`kind: 'behaviour'`, `status: null`, `code: null` for `binding.authority`, `export.packages`, `content.multiple`, `content.ungraded`, `launch.windowHint`, `launch.topLevelContinue`, `records.reporters`). Verified mutation `M1` (`status: 409` → `500` on `deployments.multiple`) fails 4 tests (`m1-status.log`). |
| `A-LA-E7-01-02`, `B-LA-E7-01-02` (`BD-A1-20`) | MAJOR | Rewrote `K-ADAPTER` and `tests/ltiaas/canary/zz-canary/app.ts` against the `LA-ADR-01` D5 `ConnectionSetup` surface (`channel`, `checkCreate`, `toolConfiguration` returning `ToolRow[]`, `parseBindingBody` returning `{ ok: true, values } \| { ok: false, fields }`, `selfCreate?`, `initialTarget?`, `createRequest?`, `extensionRoutes?`, `publishHooks?`, `packageExporters?`). Removed silent `typeof` skips: missing required members fail loudly. Called every required method with throwing `db`, `sql`, `lti`, `outbound` Proxy stubs. Marked baseline `moodle`, `canvas`, `blackboard` as `it.todo` (`pending: LA-E1-07`) until `services/cogniate-app/src/kernel/ports.ts` and `packages/channels/*/app.ts` land. Verified mutations `M2` (rename `parseBindingBody`) and `M3` (touch `ctx.db.run()`) both fail `K-ADAPTER.zz-canary` (`m2-method-rename.log`, `m3-db-touch.log`). |
| `A-LA-E7-01-03`, `B-LA-E7-01-05` | MINOR | Replaced dynamic `existsSync` profile import with static imports from `@cogniate/channel-kernel` and `services/lti-service/src/profiles/index.ts`. Imported kernel and profile types (`ChannelManifest`, `LoadedChannel`, `ChannelRegistry`, `LegacyCapabilities`, `CapabilityId`, `CapabilitySet`, `ProfileTraits`, `ProfileRegistry`, `ProviderProfile`, `SiteValidationRules`) instead of local copies. Added `K0 product channel discovery` test asserting non-empty discovery matching `packages/channels/` (`moodle`, `canvas`, `blackboard`). |
| `A-LA-E7-01-04` | MINOR | Expanded `K-PROFILE` to check all `TEST-STRATEGY.md` §2.7 requirements through `services/lti-service/src/profiles/index.ts`: profile ownership (`channelOfProfile`), `wireLms`, traits (`endpoints`, `privacyFloor`, `sharing`, `serviceUrl`, `isSharedProfile`, `isStandardProfile`), fixed hosts (`profileFixedHosts`, `allFixedHosts`), template fill (`fillTemplate`, `profileEndpoints`), site rules 1–5 (`siteRulesFor` with accepted and refused origins per enabled rule), reserved issuer (`reservedIssuerOrigins`, `profileOfFixedIssuer`), and simulation gating (`simulations: false`). |
| `A-LA-E7-01-05` | NIT | Updated `AC-LA-E7-01-06` negative control to also run Vitest K0 in a child process with `LA_K0_EXTRA_ROOT` pointing at the broken canary root and assert a non-zero exit naming `zz-canary-bad` and `names.label`. Fixed per-channel guard counts in the table below. |
| `B-LA-E7-01-03` | MINOR | Built `fillText` sample dictionary dynamically from `TEXT_PLACEHOLDERS` (`LMS`, `tool`, `site`) so `{site}` placeholders resolve cleanly; added `{site}` to `zz-canary` and `zz-canary-admin` texts. |
| `B-LA-E7-01-04` | MINOR | Removed cross-canary import/re-export from `tests/ltiaas/canary/zz-canary/manifest.ts`; added `import type { ChannelManifest } from '@cogniate/channel-kernel'` + `satisfies ChannelManifest` to both `manifest.ts` files and `import type { ProfileSource } from '@cogniate/channel-kernel'` + `satisfies readonly ProfileSource[]` to both `lti-profiles.ts` files; added `README.md` to both `zz-canary/` and `zz-canary-admin/`. |
| `B-LA-E7-01-06` | NIT | Removed unused `export` keywords from `CapabilityGuardSpec` and `CAPABILITY_GUARD_TABLE`, and replaced `' package.json'.trim()` with `'package.json'`. |

### Acceptance criteria (Round 2)

| AC | Result | Test id | Command | Evidence |
| --- | --- | --- | --- | --- |
| AC-LA-E7-01-01 | PASS (K0) | `tests/ltiaas/k0/{contract,smoke,ld1/open-world}.test.ts` (3 files, 118 passed, 3 todo) | `npm run check` (`vitest run --config tests/ltiaas/k0/vitest.config.mts`) | `npm-run-check.log`, `k0-verbose.log` (118 passed, 3 todo in 462 ms; full `npm run check` exits 0) |
| AC-LA-E7-01-02 | PASS (K0) | `K0 product channel discovery` + `K0 product channel contract: %s` (`describe.each` over discovered channels) | `npx --no-install vitest run --reporter=verbose tests/ltiaas/k0/contract.test.ts --config tests/ltiaas/k0/vitest.config.mts` with QA form (k) `packages/channels/zz-scratch/{manifest,lti-profiles,app}.ts` | Adding `packages/channels/zz-scratch/` with 0 test edits adds 16 cases for `zz-scratch` (`K-MANIFEST`, `K-LEGACY`, `K-CAP.catalog`, 11 `K-CAP` guard cases, `K-PROFILE`, `K-ADAPTER`); 92 passed, 3 todo (`form-k-scratch.log`). Scratch folder removed after run. |
| AC-LA-E7-01-03 | PASS (K0) | `K-LEGACY.{moodle,canvas,blackboard,zz-canary,zz-canary-admin}` | `npx --no-install vitest run --reporter=verbose --config tests/ltiaas/k0/vitest.config.mts` | `reg.legacyCapabilities(id, profile)` equals `legacyProjection(reg.capabilities(id, profile))` across all channel profiles and matches the M1 six-flag objects byte for byte for `moodle`, `canvas` and `blackboard` (`k0-verbose.log`). |
| AC-LA-E7-01-04 | PASS (K0) | `K-CAP.<channel>.catalog` + `K-CAP.<channel>.<capabilityId>` | same | 51 per-capability guard cases across the 5 channels (`moodle`: 9, `canvas`: 7, `blackboard`: 11, `zz-canary`: 11, `zz-canary-admin`: 13). Each case calls `reg.capabilities` and `computeCapabilities` on the off state, toggles the capability on via `computeCapabilities` + `legacyProjection` to prove product capability computation flips, and cross-checks status, error code, `details.capability` and guard summary against `LA-ADR-01` D3 parsed from `docs/architecture/ltiaas/adr/LA-ADR-01-channel-kernel.md` (`k0-verbose.log`, `m1-status.log`). HTTP route guard execution is K1 (`LA-E7-02`). |
| AC-LA-E7-01-05 | PASS (K0) | `K0 canary channel contract: zz-canary`, `K0 canary channel contract: zz-canary-admin`, `AC-LA-E7-01-05` | same | Both `tests/ltiaas/canary/zz-canary/` (16 cases, with D5 `app.ts`) and `tests/ltiaas/canary/zz-canary-admin/` (18 cases, admin-value variant without `app.ts`, for `LA-E2-03` AC-05) pass when `tests/ltiaas/canary` is loaded as the second root; the product registry loaded with one root (`packages/channels`) lists neither (`k0-verbose.log`). |
| AC-LA-E7-01-06 | PASS (K0) | `AC-LA-E7-01-06: negative control — a canary copy with a manifest schema error makes K0 fail and name the canary channel and the broken field` | same | In-process `buildChannelRegistry` throws `RegistryError` (`channel: "zz-canary-bad"`, `check: 1`, `detail` naming `"names.label"`), and a child-process K0 Vitest run with `LA_K0_EXTRA_ROOT` exits non-zero and prints both `zz-canary-bad` and `names.label` (`k0-verbose.log`). |
| AC-LA-E7-01-07 | PASS (K0) on `zz-canary` and `zz-canary-admin` (`BD-A1-20`); `pending: LA-E1-07` for baseline `moodle`, `canvas`, `blackboard` | `K-ADAPTER.<channel>` | same | `K-ADAPTER.zz-canary` exercises the D5 `ConnectionSetup` contract surface (`channel`, `checkCreate`, `toolConfiguration` returning `ToolRow[]`, `parseBindingBody` returning `{ ok: false, fields }` on unknown/missing/empty fields, `initialTarget`, `createRequest`) with throwing `db`, `sql`, `lti`, `outbound` Proxy stubs (`m2-method-rename.log`, `m3-db-touch.log`). Baseline `moodle`, `canvas`, `blackboard` are marked `it.todo` until `LA-E1-07` lands `services/cogniate-app/src/kernel/ports.ts` and `packages/channels/{moodle,canvas,blackboard}/app.ts`. |

### Per-channel K0 contract case breakdown (Round 2)

| Channel | Root | `K-MANIFEST` | `K-LEGACY` | `K-CAP.catalog` | `K-CAP.<capability>` (off capabilities) | `K-PROFILE` | `K-ADAPTER` | Total cases | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `moodle` | `packages/channels` | 1 | 1 | 1 | 9 (`binding.authority`, `deployments.multiple`, `site.serviceOrigin`, `setup.artifacts`, `content.multiple`, `content.ungraded`, `launch.windowHint`, `launch.topLevelContinue`, `setup.connectionCheck`) | 1 | 1 (`todo`: `LA-E1-07`) | 14 (13 pass, 1 todo) | PASS |
| `canvas` | `packages/channels` | 1 | 1 | 1 | 7 (`registration.dynamic`, `siteApi.token`, `publish.createCourse`, `export.packages`, `content.multiple`, `content.ungraded`, `setup.connectionCheck`) | 1 | 1 (`todo`: `LA-E1-07`) | 12 (11 pass, 1 todo) | PASS |
| `blackboard` | `packages/channels` | 1 | 1 | 1 | 11 (`registration.dynamic`, `deployments.multiple`, `site.serviceOrigin`, `setup.artifacts`, `siteApi.token`, `publish.createCourse`, `export.packages`, `content.multiple`, `content.ungraded`, `launch.topLevelContinue`, `setup.connectionCheck`) | 1 | 1 (`todo`: `LA-E1-07`) | 16 (15 pass, 1 todo) | PASS |
| `zz-canary` | `tests/ltiaas/canary` | 1 | 1 | 1 | 11 (`registration.dynamic`, `deployments.multiple`, `site.serviceOrigin`, `setup.artifacts`, `siteApi.token`, `publish.createCourse`, `export.packages`, `content.multiple`, `content.ungraded`, `launch.topLevelContinue`, `setup.connectionCheck`) | 1 | 1 (D5 `app.ts` + throwing stubs) | 16 (16 pass) | PASS |
| `zz-canary-admin` | `tests/ltiaas/canary` | 1 | 1 | 1 | 13 (`registration.dynamic`, `deployments.multiple`, `site.serviceOrigin`, `setup.artifacts`, `siteApi.token`, `publish.createCourse`, `export.packages`, `content.multiple`, `content.ungraded`, `launch.windowHint`, `launch.topLevelContinue`, `records.readBack`, `setup.connectionCheck`) | 1 | 1 (`toolConfiguration: 'none'`, no `app.ts`) | 18 (18 pass) | PASS |
| `zz-scratch` (QA form (k) probe) | `packages/channels` (scratch, removed) | 1 | 1 | 1 | 11 | 1 | 1 (D5 `app.ts` + throwing stubs) | 16 (16 pass) | PASS |

### Mutation checks (Round 2)

- **M1 (`CAPABILITY_GUARD_TABLE` status `409` → `500` on `deployments.multiple`):** exited `1` (`4 failed | 72 passed | 3 todo`), failing `K-CAP.{moodle,blackboard,zz-canary,zz-canary-admin}.deployments.multiple` against `LA-ADR-01` D3 (`m1-status.log`). Reverted after run.
- **M2 (rename `parseBindingBody` in `tests/ltiaas/canary/zz-canary/app.ts`):** exited `1` (`1 failed | 75 passed | 3 todo`), failing `K-ADAPTER.zz-canary: parseBindingBody is required` (`m2-method-rename.log`). Reverted after run.
- **M3 (call `ctx.db.run()` inside `parseBindingBody` in `tests/ltiaas/canary/zz-canary/app.ts`):** exited `1` (`1 failed | 75 passed | 3 todo`), failing `K-ADAPTER.zz-canary` with `Error: K-ADAPTER forbidden db access: run` (`m3-db-touch.log`). Reverted after run.

### RQ-1 alignment with `LA-E1-05` fix round 1 (`nguyenthanhquang152/la-l` `ead5edb`, `BD-A2-21`)

- `tests/ltiaas/canary/zz-canary-admin/lti-profiles.ts:10` already uses `privacyFloor: 'allowlist'` from Round 2 (`7c54c33` / `3efa55a`).
- `tests/ltiaas/k0/contract.test.ts:780` updated from `profileDefinition(profileId, profileReg)` to `profileDefinition(profileId, { simulation: true, registry: profileReg })`.
- **With `nguyenthanhquang152/la-l` (`ead5edb`) merged locally into `quang/ltiaas-milestone` (`e6558af`) in `~/cogniate-qa-runs/LA/LA-E7-01/r2-rq1/clone`:** `npm run test:k0` passes (`3 passed`, `118 passed | 3 todo` in 581 ms, `with-l-k0.log`) and full `npm run check` exits `0` (`with-l-check.log`).
- **Without `nguyenthanhquang152/la-l` (`ead5edb`):** `npm run typecheck` exits `0` (`without-l-typecheck.log`), and only line 780 (`profileDefinition(profileId, { simulation: true, registry: profileReg })`) requires L's merge because pre-`ead5edb` `profileDefinition(id, source)` calls `source.listProfiles(true)` directly on its second argument (`without-l-k0.log`); merge `tests/ltiaas/k0/contract.test.ts` and `nguyenthanhquang152/la-l` together.

---

## Round 1 (historical)

| Item | Value |
| --- | --- |
| SHA | `d6c2b151c14f0325269096134a8a53f11a8b747b` (integration `quang/ltiaas-milestone`, includes `LA-E1-02`, `LA-E1-04` and `LA-E1-05`) |
| Lane and slot | host-only (no Docker) |
| Clone | `~/cogniate-qa-runs/LA/LA-E7-01/r1/clone` (`git clone --no-hardlinks`, push URL disabled, `npm ci --ignore-scripts`) |
| Files delivered | `tests/ltiaas/k0/contract.test.ts`, `tests/ltiaas/canary/package.json`, `tests/ltiaas/canary/zz-canary/{manifest,lti-profiles,app}.ts`, `tests/ltiaas/canary/zz-canary-admin/{manifest,lti-profiles}.ts` |
| Artifacts | `~/cogniate-qa-runs/LA/LA-E7-01/r1/` (umask 077): `npm-ci.log`, `k0-verbose.log`, `k0-with-scratch-channel.log`, `npm-check.log`, `status-after.txt` |
