Verdict: PASS
Round: 1

# LA-E7-01 K0 channel contract suite and the canary channel: QA verification

Tester: lead QA (Orca task `task_9eba03b67aaa`, dispatch `ctx_cb28274cfd08`), 2026-10-22. Spec: `docs/architecture/ltiaas/tasks/LA-E7-01.md`. Design: `docs/architecture/ltiaas/adr/LA-ADR-01-channel-kernel.md` (D2–D6, D10–D12, test impact) and `tests/ltiaas/TEST-STRATEGY.md` §2.7.

Independence: Lead QA wrote `tests/ltiaas/k0/contract.test.ts` and `tests/ltiaas/canary/**` from the task spec, `LA-ADR-01`, `TEST-STRATEGY.md` §2.7, and the public entry points of `docs/architecture/ltiaas/tasks/README.md` §3 (`@cogniate/channel-kernel` and `services/lti-service/src/profiles/index.ts`). Lead QA read no product source files, no Author notes, and no reviewer files.

| Item | Value |
| --- | --- |
| SHA | `d6c2b151c14f0325269096134a8a53f11a8b747b` (integration `quang/ltiaas-milestone`, includes `LA-E1-02`, `LA-E1-04` and `LA-E1-05`) |
| Lane and slot | host-only (no Docker) |
| Clone | `~/cogniate-qa-runs/LA/LA-E7-01/r1/clone` (`git clone --no-hardlinks`, push URL disabled, `npm ci --ignore-scripts`) |
| Files delivered | `tests/ltiaas/k0/contract.test.ts`, `tests/ltiaas/canary/package.json`, `tests/ltiaas/canary/zz-canary/{manifest,lti-profiles,app}.ts`, `tests/ltiaas/canary/zz-canary-admin/{manifest,lti-profiles}.ts` |
| Artifacts | `~/cogniate-qa-runs/LA/LA-E7-01/r1/` (umask 077): `npm-ci.log`, `k0-verbose.log`, `k0-with-scratch-channel.log`, `npm-check.log`, `status-after.txt` |

## Acceptance criteria

| AC | Result | Test id | Command | Evidence |
| --- | --- | --- | --- | --- |
| AC-LA-E7-01-01 | PASS (K0) | `tests/ltiaas/k0/{contract,smoke,ld1/open-world}.test.ts` (3 files, 109 tests) | `npm run check` (runs `npm run test:k0`: `vitest run --config tests/ltiaas/k0/vitest.config.mts`) | `npm-check.log`, `k0-verbose.log` (109/109 pass in 279 ms; full `npm run check` exits 0) |
| AC-LA-E7-01-02 | PASS (K0) | `K0 product channel contract: %s` (`describe.each` over discovered channels) | `npx --no-install vitest run --reporter=verbose --config tests/ltiaas/k0/vitest.config.mts` with QA form (k) `packages/channels/zz-scratch/{manifest,lti-profiles,app}.ts` | Adding `packages/channels/zz-scratch/` with 0 test edits raises the K0 test count from 109 to 123 (+14 cases for `zz-scratch`: `K-MANIFEST`, `K-LEGACY`, `K-CAP.catalog`, 9 `K-CAP` guard cases, `K-PROFILE`, `K-ADAPTER`); all 123 pass (`k0-with-scratch-channel.log`). Scratch folder removed after run. |
| AC-LA-E7-01-03 | PASS (K0) | `K-LEGACY.moodle`, `K-LEGACY.canvas`, `K-LEGACY.blackboard`, `K-LEGACY.zz-canary`, `K-LEGACY.zz-canary-admin` | `npx --no-install vitest run --reporter=verbose --config tests/ltiaas/k0/vitest.config.mts` | `reg.legacyCapabilities(id)` equals `legacyProjection(reg.capabilities(id))` for every channel and matches the M1 six-flag objects (`dynamicRegistration`, `operatorApproval`, `webServices`, `courseShell`, `addDeployment`, `canvasConfiguration`) byte for byte for `moodle`, `canvas` and `blackboard` (`k0-verbose.log`). |
| AC-LA-E7-01-04 | PASS (K0) | `K-CAP.<channel>.catalog` + `K-CAP.<channel>.<guardId>` (one test case per false/absent guarded capability from `CAPABILITY_CATALOG` and `CAPABILITY_GUARD_TABLE`) | same | 39 per-capability guard cases across the 5 channels (`moodle`: 6, `canvas`: 7, `blackboard`: 8, `zz-canary`: 9, `zz-canary-admin`: 9), each verifying status (`409` or `400`), error code (`DYNAMIC_REGISTRATION_NOT_SUPPORTED`, `CAPABILITY_NOT_SUPPORTED`, `PLACEMENT_NOT_GRADED`) and `details.capability` (`k0-verbose.log`). |
| AC-LA-E7-01-05 | PASS (K0) | `K0 canary channel contract: zz-canary`, `K0 canary channel contract: zz-canary-admin`, `AC-LA-E7-01-05` | same | Both `tests/ltiaas/canary/zz-canary/` (with `app.ts`) and `tests/ltiaas/canary/zz-canary-admin/` (admin-value variant without `app.ts`, for `LA-E2-03` AC-05) pass all 14 contract cases when `tests/ltiaas/canary` is loaded as the second root; the product registry loaded with one root (`packages/channels`) lists neither (`k0-verbose.log`). |
| AC-LA-E7-01-06 | PASS (K0) | `AC-LA-E7-01-06: negative control — a canary copy with a manifest schema error fails K0 and names the canary channel and the broken field` | same | A canary copy `zz-canary-bad` with `names.label: ""` throws `RegistryError` with `channel: "zz-canary-bad"`, `check: 1`, and `detail` naming `"names.label"` (`k0-verbose.log`). |
| AC-LA-E7-01-07 | PASS (K0) on `zz-canary` (`app.ts`) and `zz-canary-admin` (`toolConfiguration: 'none'`); pending: `LA-E1-07` for baseline `packages/channels/*/app.ts` | `K-ADAPTER.<channel>` | same | `K-ADAPTER.zz-canary` exercises `toolConfiguration`, `stageCreate` (strict body), and `bindingTarget` (strict body) with throwing `db` and `lti` Proxy stubs; `K-ADAPTER` automatically requires and tests `packages/channels/{moodle,canvas,blackboard}/app.ts` once `LA-E1-07` lands `services/cogniate-app/src/kernel/ports.ts`. |

## Per-channel K0 contract case breakdown

| Channel | Root | `K-MANIFEST` | `K-LEGACY` | `K-CAP.catalog` | `K-CAP.<guard>` (off capabilities) | `K-PROFILE` | `K-ADAPTER` | Total cases | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `moodle` | `packages/channels` | 1 | 1 | 1 | 6 (`binding.authority.operatorGrant`, `deployments.multiple`, `setup.artifacts.developer-key-json`, `export.packages.common-cartridge-1.3`, `content.ungraded`, `setup.connectionCheck`) | 1 | 1 | 11 | PASS |
| `canvas` | `packages/channels` | 1 | 1 | 1 | 7 (`registration.dynamic`, `siteApi.token`, `publish.createCourse`, `export.packages.mbz`, `export.packages.common-cartridge-1.3`, `content.ungraded`, `setup.connectionCheck`) | 1 | 1 | 12 | PASS |
| `blackboard` | `packages/channels` | 1 | 1 | 1 | 8 (`registration.dynamic`, `deployments.multiple`, `setup.artifacts.developer-key-json`, `siteApi.token`, `publish.createCourse`, `export.packages.mbz`, `export.packages.common-cartridge-1.3`, `content.ungraded`, `setup.connectionCheck`) | 1 | 1 | 14 | PASS |
| `zz-canary` | `tests/ltiaas/canary` | 1 | 1 | 1 | 9 | 1 | 1 (full `app.ts` + throwing stubs) | 14 | PASS |
| `zz-canary-admin` | `tests/ltiaas/canary` | 1 | 1 | 1 | 9 | 1 | 1 (`toolConfiguration: 'none'`, no `app.ts`) | 14 | PASS |
| `zz-scratch` (QA form (k) probe) | `packages/channels` (scratch, removed) | 1 | 1 | 1 | 9 | 1 | 1 (full `app.ts` + throwing stubs) | 14 | PASS |

## Regression and time

- **R0 (`npm run check`):** PASS (`npm-check.log`: `lint` PASS, `typecheck` PASS, `test:unit` 89 files / 1,314 passed / 5 skipped, `test:infra` PASS, `test:k0` 3 files / 109 passed, `fitness:lms-names` F1 PASS, `fitness:rules` F5 PASS; `status-after.txt` is empty).
- **Measured time:** `vitest run --config tests/ltiaas/k0/vitest.config.mts` runs 3 files (109 tests: 67 in `contract.test.ts`, 40 in `ld1/open-world.test.ts`, 2 in `smoke.test.ts`) in 279 ms.
