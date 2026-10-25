# QA Report: LA-E6-04 (Channel capability flags for connection check)

Verdict: PASS
Round: 1
Integration SHA: `48c01495fd18d846577fc4782f52167b18e1c5a9` (product SHA `a8bbac538cfe1e305f410279d7879421d64a5a1f`, merged in `la-qa` with `6f666c01`)
Task Spec: [`docs/architecture/ltiaas/tasks/LA-E6-04.md`](../../architecture/ltiaas/tasks/LA-E6-04.md)
QA Test Suite: [`tests/ltiaas/tasks-qa/LA-E6-04/connection-check.k0.test.ts`](../../../tests/ltiaas/tasks-qa/LA-E6-04/connection-check.k0.test.ts)
Durable Evidence: `/Users/quangnguyen/cogniate-qa-runs/LA/qa3-la-e404-r1/logs/`

---

## 1. Executive Summary

- **Verdict:** **`PASS`** (`4/4` ACs `PASS` at `K0`, host-only, `0` Docker containers).
- **Existing `npm run test:k0 -- --reporter=verbose` Coverage (`149/149 PASS` in `655 ms`, `logs/test-k0-verbose.log`):**
  - `tests/ltiaas/k0/contract.test.ts` runs `116/116` tests (`K-REG.*`, `K-CAP.*`, `K-LEGACY.*`, `K-ADAPTER.*`), including:
    - `K-ADAPTER.lti-generic: dynamic registration (self), manual registration (operatorGrant), multiple deployments, content.multiple=true, setup.connectionCheck=true, 8-row tool-configuration`
    - `K-CAP.moodle.setup.connectionCheck: false/absent capability -> 409 CAPABILITY_NOT_SUPPORTED (details.capability=setup.connectionCheck)`
    - `K-CAP.blackboard.setup.connectionCheck: false/absent capability -> 409 CAPABILITY_NOT_SUPPORTED (details.capability=setup.connectionCheck)`
    - `K-CAP.brightspace.setup.connectionCheck: false/absent capability -> 409 CAPABILITY_NOT_SUPPORTED (details.capability=setup.connectionCheck)`
    - `K-LEGACY.moodle: legacyProjection matches M1 baseline 6 flags and GET /app-api/lms-providers & GET /app-api/connections/:id keepcapabilities + channel/channelName/channelCapabilities`
    - `K-LEGACY.canvas: legacyProjection matches M1 baseline 6 flags and GET /app-api/lms-providers & GET /app-api/connections/:id keepcapabilities + channel/channelName/channelCapabilities`
    - `K-LEGACY.blackboard: legacyProjection matches M1 baseline 6 flags and GET /app-api/lms-providers & GET /app-api/connections/:id keepcapabilities + channel/channelName/channelCapabilities`
  - **Gap Identified in `npm run test:k0`:** In `tests/ltiaas/k0/contract.test.ts`, `offGuards` is dynamically filtered from `initialCaps` at load time (`CAPABILITY_GUARD_TABLE.filter((g) => !g.isSupported(initialCaps))`), and `K-ADAPTER.lti-generic` asserts `expect(channelCaps['setup.connectionCheck']).toBe(Boolean(manifest.setup?.connectionCheck))`. As a result, setting a wrong `setup.connectionCheck` value in `packages/channels/<id>/manifest.ts` (or changing a legacy capability flag on `lti-generic` or `brightspace`) would not fail `npm run test:k0` on its own.
- **New `LD-5` K0 QA Suite (`tests/ltiaas/tasks-qa/LA-E6-04/connection-check.k0.test.ts`):**
  - Written using only the public registry entry points (`@cogniate/channel-kernel`: `loadChannelFolders`, `buildChannelRegistry`, `computeCapabilities`, `legacyProjection`; and `services/lti-service/src/profiles/index.ts`: `profileDefinition`).
  - Directly pins `AC-LA-E6-04-01`, `AC-LA-E6-04-02`, `AC-LA-E6-04-03`, and `AC-LA-E6-04-04` across all 5 channels (`moodle`, `canvas`, `blackboard`, `lti-generic`, `brightspace`) and all registered profiles (`4/4 PASS` in `104 ms`).
  - Verified to **fail** when temporary wrong values are injected (`logs/e6-04-k0-negative-mutation.log` and `logs/e6-04-k0-initial-pass.log`), and to **pass `4/4`** after removing the temporary wrong values (`logs/e6-04-k0-final-pass.log`).

---

## 2. Acceptance Criteria Matrix

| AC | Level | Description | Existing `npm run test:k0` Cases (`tests/ltiaas/k0/contract.test.ts`) | New QA K0 Case (`tests/ltiaas/tasks-qa/LA-E6-04/connection-check.k0.test.ts`) | Negative Mutation Proof (Fails on Temporary Wrong Value) | Status |
| --- | --- | --- | --- | --- | --- | --- |
| **`AC-LA-E6-04-01`** | `K0` | The registry gives `setup.connectionCheck: true` for `canvas`. | `K-CAP.canvas.*` omits `setup.connectionCheck` from `offGuards` because `canvas` has `setup.connectionCheck: true` (and `tests/ltiaas/tasks-core/LA-E6-01/connection-check.k0.test.ts` checks `reg.channel('canvas')?.setup.connectionCheck === true`), but `npm run test:k0` had no direct assertion that would fail if `canvas` `connectionCheck` were `false`. | `AC-LA-E6-04-01: the registry gives setup.connectionCheck: true for canvas across manifest and all profiles` (`1 ms`, `PASS`) | Temporary `connectionCheck: false` in `packages/channels/canvas/manifest.ts` → **`FAIL`** (`AssertionError: expected false to be true` at `connection-check.k0.test.ts:127:41`; `logs/e6-04-k0-negative-mutation.log`). Reverted and verified **`PASS`**. | **`PASS`** |
| **`AC-LA-E6-04-02`** | `K0` | The registry gives `setup.connectionCheck: true` for `lti-generic`. | `K-ADAPTER.lti-generic: dynamic registration (self), manual registration (operatorGrant), multiple deployments, content.multiple=true, setup.connectionCheck=true, 8-row tool-configuration` (`contract.test.ts:1156`, `PASS`), which compared `channelCaps['setup.connectionCheck']` against `Boolean(manifest.setup?.connectionCheck)` rather than literal `true`. | `AC-LA-E6-04-02: the registry gives setup.connectionCheck: true for lti-generic across manifest and all profiles` (`< 1 ms`, `PASS`) | Temporary `connectionCheck: false` in `packages/channels/lti-generic/manifest.ts` → **`FAIL`** (`AssertionError: expected false to be true` at `connection-check.k0.test.ts:147:41`; `logs/e6-04-k0-negative-mutation.log`). Reverted and verified **`PASS`**. | **`PASS`** |
| **`AC-LA-E6-04-03`** | `K0` | `moodle`, `blackboard`, and `brightspace` have no `setup.connectionCheck`. | • `K-CAP.moodle.setup.connectionCheck: false/absent capability -> 409 CAPABILITY_NOT_SUPPORTED (details.capability=setup.connectionCheck)`<br>• `K-CAP.blackboard.setup.connectionCheck: false/absent capability -> 409 CAPABILITY_NOT_SUPPORTED (details.capability=setup.connectionCheck)`<br>• `K-CAP.brightspace.setup.connectionCheck: false/absent capability -> 409 CAPABILITY_NOT_SUPPORTED (details.capability=setup.connectionCheck)`<br>(dynamically generated from `offGuards` in `contract.test.ts:873`). | `AC-LA-E6-04-03: moodle, blackboard, and brightspace have no setup.connectionCheck in manifest and compute setup.connectionCheck: false` (`< 1 ms`, `PASS`) | Temporary `connectionCheck: true` in `packages/channels/moodle/manifest.ts` → **`FAIL`** (`AssertionError: moodle manifest setup.connectionCheck must be absent/undefined: expected true to be undefined` at `connection-check.k0.test.ts:175:11`; `logs/e6-04-k0-negative-mutation.log`). Reverted and verified **`PASS`**. | **`PASS`** |
| **`AC-LA-E6-04-04`** | `K0` | The six legacy capability flags of every channel are unchanged (the K0 projection golden). | • `K-LEGACY.moodle: legacyProjection matches M1 baseline 6 flags and GET /app-api/lms-providers & GET /app-api/connections/:id keepcapabilities + channel/channelName/channelCapabilities`<br>• `K-LEGACY.canvas: legacyProjection matches M1 baseline 6 flags and GET /app-api/lms-providers & GET /app-api/connections/:id keepcapabilities + channel/channelName/channelCapabilities`<br>• `K-LEGACY.blackboard: legacyProjection matches M1 baseline 6 flags and GET /app-api/lms-providers & GET /app-api/connections/:id keepcapabilities + channel/channelName/channelCapabilities` | `AC-LA-E6-04-04: the six legacy capability flags of every channel (moodle, canvas, blackboard, lti-generic, brightspace) are unchanged` (`1 ms`, `PASS`) | Temporary wrong legacy flag expectation (`dynamicRegistration: false` vs `true` on `brightspace`) → **`FAIL`** (`AssertionError: brightspace default legacyProjection: expected { dynamicRegistration: true, …(5) } to deeply equal { dynamicRegistration: false, …(5) }` at `connection-check.k0.test.ts:208:120`; `logs/e6-04-k0-initial-pass.log`). Corrected and verified **`PASS`**. | **`PASS`** |

---

## 3. Command & Verification Log

1. **Baseline `npm run test:k0 -- --reporter=verbose` (`logs/test-k0-verbose.log`):**
   ```text
   Test Files  3 passed (3)
        Tests  149 passed (149)
     Duration  655ms
   ```
2. **New `LA-E6-04` K0 Suite (`logs/e6-04-k0-final-pass.log`):**
   ```text
   RUN  v5.0.5 /Users/quangnguyen/cogniate-qa-runs/LA/qa3-la-e404-r1/clone/tests/ltiaas/tasks-qa/LA-E6-04

    ✓ connection-check.k0.test.ts > LA-E6-04 K0: Channel capability flags for connection check (LD-5 public entry points) > AC-LA-E6-04-01: the registry gives setup.connectionCheck: true for canvas across manifest and all profiles 1ms
    ✓ connection-check.k0.test.ts > LA-E6-04 K0: Channel capability flags for connection check (LD-5 public entry points) > AC-LA-E6-04-02: the registry gives setup.connectionCheck: true for lti-generic across manifest and all profiles 0ms
    ✓ connection-check.k0.test.ts > LA-E6-04 K0: Channel capability flags for connection check (LD-5 public entry points) > AC-LA-E6-04-03: moodle, blackboard, and brightspace have no setup.connectionCheck in manifest and compute setup.connectionCheck: false 0ms
    ✓ connection-check.k0.test.ts > LA-E6-04 K0: Channel capability flags for connection check (LD-5 public entry points) > AC-LA-E6-04-04: the six legacy capability flags of every channel (moodle, canvas, blackboard, lti-generic, brightspace) are unchanged 1ms

    Test Files  1 passed (1)
         Tests  4 passed (4)
      Duration  104ms
   ```
3. **Clone Working Tree Verification After Temporary Wrong-Value Check:**
   - `git -C /Users/quangnguyen/cogniate-qa-runs/LA/qa3-la-e404-r1/clone status --short -- packages/channels` → empty (`0` modified product files).
