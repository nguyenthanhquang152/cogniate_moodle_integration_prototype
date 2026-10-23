# QA Review — `LA-E7-06` (`K1` Simulator Suites per Port, Channel Fixtures, and the Pass Rule)

- **Verdict:** `PASS`
- **Round:** `2`
- **Task:** `LA-E7-06` — `K1` simulator suites per port, channel fixtures and the pass rule (Must, size L)
- **Reviewer:** QA-4 (lane `L2`)
- **Integration SHA:** `4e453a7cdfda6d5ddae777b849e13bb917a1a8fd` (`4e453a7c`; Round 1 on `053ea576`)
- **Verification Mode:** Host-only authoring and `K0` / `DOC` verification (`0` Docker commands executed; `K1-SIM` rows marked `pending: Docker window`)
- **Scratch Run Directory (`umask 077`):** `/Users/quangnguyen/cogniate-qa-runs/LA/LA-E7-06/r2`

---

## 1. Acceptance Criteria Matrix (`AC-LA-E7-06-01` .. `AC-LA-E7-06-08` + `AC-LA-E7-04-07`)

| AC ID | Kind | Status | Evidence & Notes |
| :--- | :---: | :---: | :--- |
| `AC-LA-E7-06-01` | `K1-SIM` | `pending: Docker window` | Authored `tests/ltiaas/kit/suites/{k1-launch,k1-dl,k1-ags,k1-nrps,k1-reg,k1-cap,k-hyg}.k1sim.test.ts`, `tests/ltiaas/kit/lib/{fixtures,runtime}.ts`, `tests/ltiaas/kit/vitest.config.mts`, and the `QA_TASK=K1` / `QA_TASK=LA-E7-06` selector in `tests/acceptance/run-api.mjs`. Expected `RUN` and `N/A` case counts per channel are verified in `kit.k0.test.ts` (see §2). |
| `AC-LA-E7-06-02` | `K0` | **PASS** | Verified in `tests/ltiaas/kit/kit.k0.test.ts` (`AC-LA-E7-06-02`): removing one expected case from the executed list fails `verifyExecutedCases` and `evaluateChannelPassRule` with `"missing case: <caseId>"`; running one unexpected case fails with `"extra case: <caseId>"`. |
| `AC-LA-E7-06-03` | `K1-SIM` | `pending: Docker window` | Capability-gated `N/A` rule, `C2:<capability>` requirement for off guarded capabilities (`deployments.multiple` -> `addDeployment`, `setup.artifacts` -> `canvasConfiguration`, `siteApi.token` -> `webServices`, `publish.createCourse` -> `courseShell`, `setup.connectionCheck` -> `setup.connectionCheck`), and `notBuilt` exclusion (`content.ungraded` until `LA-E3-08`) are verified on the host in `kit.k0.test.ts` (`AC-LA-E7-06-03`); live HTTP `409 CAPABILITY_NOT_SUPPORTED` probes with `noServiceCalls` are wired in `k1-cap.k1sim.test.ts` for the SIM Docker window. |
| `AC-LA-E7-06-04` | `K1-SIM` | `pending: Docker window` | Host bilateral equality (`verifyBilateralCapabilities`) against `@cogniate/channel-kernel` (`computeCapabilities`, `legacyProjection`) and negative extra-key / missing-key probes pass in `kit.k0.test.ts` (`AC-LA-E7-06-04`); live `GET /app-api/lms-providers`, `GET /app-api/connections/:id`, and `GET /app-api/connections/:id/tool-configuration` assertions are wired in `k1-cap.k1sim.test.ts` (`C1`). |
| `AC-LA-E7-06-05` | `K1-SIM` | `pending: Docker window` | `tests/ltiaas/kit/channels/moodle.json` `coveredBy` cites `T3b`, `T7`, `T8` for `registration.dynamic` (`["T3b", "T7"]`), `siteApi.token` (`["T8"]`), `publish.createCourse` (`["T8"]`), and `export.packages` (`["T8"]`). Verified in `kit.k0.test.ts` (`AC-LA-E7-06-05`) that `evaluateChannelPassRule` passes when `T3b`, `T7`, `T8` are recorded `PASS` and fails when any referenced wave-pass suite is not `PASS`. |
| `AC-LA-E7-06-06` | `K1-SIM` | `pending: Docker window` | `tests/ltiaas/kit/suites/k-hyg.k1sim.test.ts` (`H1`) and `scanAllLogsAndArtifactsForSecrets` in `tests/ltiaas/kit/lib/runtime.ts` scan `lti-service`, `cogniate-app`, `lms-sim` logs, `/__sim/secrets`, and run artifacts for all captured tokens, assertions, cookies, and grant codes. |
| `AC-LA-E7-06-07` | `DOC` | **PASS** | All 5 channel fixtures in `tests/ltiaas/kit/channels/{moodle,canvas,blackboard,lti-generic,brightspace}.json` record design citations (`LA-ADR-01 §D3/§D6/§D11`, `LA-ADR-02 §D1..D7`, `LA-ADR-05 §D1..D7`, `LA-ADR-07 §D3`, `LA-ADR-08 §D4`, `ADR-011 §5–§6`, `cogniate-app-api-delta.md §1–§3`, `LA-IC-01`, `LA-IC-14`, `TEST-STRATEGY.md §2.4–§2.6 & §9.2 item 11`) for every section and every one of the 17 capability keys; verified by `auditFixtureSources` in `kit.k0.test.ts` (`0` product-code references, `TB-12`). |
| `AC-LA-E7-06-08` | `K1-SIM` | `pending: Docker window` | `PROTOCOL_SECURITY_FAULTS` (all 12 faults from `tests/acceptance/M1/blackboard/20-protocol.test.ts`: `altered-signature`, `unknown-key`, `unknown-kid`, `none`, `hs256`, `wrong-issuer`, `wrong-audience`, `multi-aud-no-azp`, `multi-aud-wrong-azp`, `expired`, `future-iat`, `wrong-nonce`) is verified against `20-protocol.test.ts` in `kit.k0.test.ts` (`AC-LA-E7-06-08`) and wired into `k1-launch.k1sim.test.ts` (`L-FAULTS`). |
| `AC-LA-E7-04-07` | `K0` | **PASS** | Every file in `tests/ltiaas/kit/suites/**` (`7 / 7` suite files) passes `npm run fitness:lms-names -- --stdin --as services/cogniate-app/src/zz-kit-suite-check.ts` with `0` hits (verified both in `kit.k0.test.ts` and in `tests/ltiaas/fitness/fitness-probes.test.ts`). |

---

## 2. Pre-Computed Expected Case Matrix per Channel (`computeExpectedCaseList`)

| Channel | Simulator Provider | `K1-LAUNCH` | `K1-DL` | `K1-AGS` | `K1-NRPS` | `K1-REG` | `K1-CAP` | Expected `RUN` | `N/A` | Off Capabilities Tested by `C2` |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| `moodle` | `moodle-sim` | `11 RUN` (`0 N/A`) | `7 RUN` (`2 N/A`: `D5`, `D7`) | `6 RUN` (`0 N/A`) | `1 RUN` (`0 N/A`) | `1 RUN` (`5 N/A`: `R2`..`R6`) | `5 RUN` (`C1`, `3×C2`, `C3`) | **31** | **7** | `deployments.multiple` (`addDeployment`), `setup.artifacts` (`canvasConfiguration`), `setup.connectionCheck` (`setup.connectionCheck`) |
| `canvas` | `canvas-sim-cloud` | `11 RUN` (`0 N/A`) | `7 RUN` (`2 N/A`: `D5`, `D7`) | `6 RUN` (`0 N/A`) | `1 RUN` (`0 N/A`) | `5 RUN` (`1 N/A`: `R1`) | `4 RUN` (`C1`, `2×C2`, `C3`) | **34** | **3** | `siteApi.token` (`webServices`), `publish.createCourse` (`courseShell`) |
| `blackboard` | `blackboard-sim` | `11 RUN` (`0 N/A`) | `7 RUN` (`2 N/A`: `D5`, `D7`) | `6 RUN` (`0 N/A`) | `1 RUN` (`0 N/A`) | `2 RUN` (`R2`, `R4-GUARD`; `5 N/A`) | `7 RUN` (`C1`, `5×C2`, `C3`) | **34** | **7** | `deployments.multiple` (`addDeployment`), `setup.artifacts` (`canvasConfiguration`), `siteApi.token` (`webServices`), `publish.createCourse` (`courseShell`), `setup.connectionCheck` (`setup.connectionCheck`) |
| `lti-generic` | `generic-sim` | `11 RUN` (`0 N/A`) | `8 RUN` (`1 N/A`: `D7`) | `6 RUN` (`0 N/A`) | `1 RUN` (`0 N/A`) | `6 RUN` (`0 N/A`) | `5 RUN` (`C1`, `3×C2`, `C3`) | **37** | **1** | `setup.artifacts` (`canvasConfiguration`), `siteApi.token` (`webServices`), `publish.createCourse` (`courseShell`) |
| `brightspace` | `brightspace-sim` | `11 RUN` (`0 N/A`) | `7 RUN` (`2 N/A`: `D5`, `D7`) | `6 RUN` (`0 N/A`) | `1 RUN` (`0 N/A`) | `5 RUN` (`1 N/A`: `R6`) | `6 RUN` (`C1`, `4×C2`, `C3`) | **36** | **3** | `setup.artifacts` (`canvasConfiguration`), `siteApi.token` (`webServices`), `publish.createCourse` (`courseShell`), `setup.connectionCheck` (`setup.connectionCheck`) |

---

## 3. Host Verification Commands & Results (`053ea576`)

1. **TypeScript Check (`tests/ltiaas/kit/tsconfig.json`):**
   ```sh
   npx tsc -p tests/ltiaas/kit/tsconfig.json --noEmit
   ```
   - Exit code: `0` (`0` errors across all files in `tests/ltiaas/kit/**`).

2. **Kit `K0` + `DOC` Suite (`tests/ltiaas/kit/kit.k0.test.ts`):**
   ```sh
   LA_LEVEL=k0 npx --no-install vitest run --reporter=verbose --config tests/ltiaas/kit/vitest.config.mts
   ```
   - Result: **1 passed (1), 8 passed (8)** in `1.05s` (`/Users/quangnguyen/cogniate-qa-runs/LA/LA-E7-06/r1/logs/kit-k0.log`).

3. **F1 Kit-Neutrality Probe (`AC-LA-E7-04-07` in `tests/ltiaas/fitness/fitness-probes.test.ts`):**
   ```sh
   LA_SCRATCH_CLONE="/Users/quangnguyen/cogniate-qa-runs/LA/LA-E7-06/r1/clone" \
   LA_RUN_DIR="/Users/quangnguyen/cogniate-qa-runs/LA/LA-E7-06/r1/logs" \
     npx --no-install vitest run --reporter=verbose --config tests/ltiaas/fitness/vitest.config.mts -t "AC-LA-E7-04-07"
   ```
   - Result: **PASS** (`0` F1 LMS-name hits across all 7 files in `tests/ltiaas/kit/suites/**`, and planted hit caught).

4. **QA Independence & Docker Discipline:**
   - Only design docs (`docs/architecture/ltiaas/**`), existing QA tests (`tests/**`), and the public `@cogniate/channel-kernel` K0 surface were read/called.
   - `0` Docker commands were executed.

---

## Round 2 (`4e453a7c` — Fix Round 1 / QA Round 2)

### 2.1 Resolution of `reviewer-a.md` (`A-LA-E7-06-01`..`07`), `reviewer-b.md` (`B-LA-E7-06-01`..`06`), and `LA-E8-01` Finding 1

| Finding ID(s) | Severity | Summary of Defect | Fix Implemented & K0 Verification | Status |
| :--- | :---: | :--- | :--- | :---: |
| `A-LA-E7-06-01`, `B-LA-E7-06-01` (`AC-LA-E7-06-05`) | BLOCKER | `DEFAULT_WAVE_PASS_RESULTS` hardcoded `T3b: 'PASS'`, `T7: 'PASS'`, `T8: 'PASS'` in `lib/fixtures.ts` and `k-hyg.k1sim.test.ts`, letting `coveredBy` capabilities pass with no real wave evidence. | Removed `DEFAULT_WAVE_PASS_RESULTS` completely. Added `WaveEvidenceManifest` (`{ waveId, suites: Record<string, { outcome, waveId, artifactPath }> }`) and `loadWaveEvidenceFromRun()` in `lib/runtime.ts` reading `$LA_WAVE_EVIDENCE_FILE` / `$LA_RUN_DIR/wave-evidence.json` and `$LA_WAVE_ID`. `evaluateChannelPassRule()` and `k-hyg.k1sim.test.ts` (`H2`) now fail closed whenever wave evidence is missing, unreadable, has a stale `waveId`, lacks `artifactPath`, or has outcome `PENDING` or `FAIL`. Verified in `kit.k0.test.ts` (`AC-LA-E7-06-05 / A-LA-E7-06-01 / B-LA-E7-06-01`). | **FIXED & VERIFIED** |
| `A-LA-E7-06-02`, `B-LA-E7-06-03` (`AC-LA-E7-06-04`) | BLOCKER | `verifyBilateralCapabilities` treated `providerChannelCapabilities`, `providerLegacyFlags`, `connectionChannelCapabilities`, `connectionLegacyFlags`, and `toolConfigurationKeys` as optional, passing when API fields were `undefined`, `null`, or `[]`. | Made all 5 capability/flag maps and `toolConfigurationKeys` required in `BilateralEqualityInput` and added strict runtime `isPlainObject()` and `Array.isArray()` validation at the start of `verifyBilateralCapabilities()`. Added negative K0 probes in `kit.k0.test.ts` setting each field independently to `undefined`, `null`, and `[]` and asserting `ok === false`. | **FIXED & VERIFIED** |
| `A-LA-E7-06-03`, `B-LA-E7-06-05` (`AC-LA-E7-06-06`) | BLOCKER / MAJOR | `scanAllLogsAndArtifactsForSecrets` never fetched `/__sim/records`, treated missing service logs as empty strings (`ok: true`), only read top-level files in `LA_RUN_DIR`, and skipped artifact scanning when `LA_RUN_DIR` was unset. | Rebuilt `scanAllLogsAndArtifactsForSecrets()` in `lib/runtime.ts` to require and scan all 4 source categories: (1) `/__sim/secrets` + local private secret store (`secretCount > 0`), (2) non-empty `lti-service`, `cogniate-app`, and `lms-sim` logs, (3) non-empty `/__sim/records?since=0` payload, and (4) recursive walk (`walkArtifactFiles()`) of the redacted evidence tree (`evidence/**`). Missing any input records `missingInputs` and sets `ok: false`. Verified with missing-input and planted-leak probes across logs, `/__sim/records`, and nested `evidence/deep/redacted.json` in `kit.k0.test.ts`. | **FIXED & VERIFIED** |
| `A-LA-E7-06-04`, `B-LA-E7-06-04` (`AC-LA-E7-06-02`) | BLOCKER | `readAllExecutedCases()` deduplicated into a `Map` (overwriting `FAIL` with later `PASS`), suites only recorded `PASS` at the end of `it(...)`, `skippedCount` was hardcoded to `0`, records lacked `runId`, and `sequencer: undefined` did not prevent Vitest from reordering cached suites. | Added `KitSuiteSequencer extends BaseSequencer` in `vitest.config.mts` and `orderKitSuiteSpecs()` in `lib/fixtures.ts` to deterministically order `k-hyg.k1sim.test.ts` strictly last. Added `initKitRunLedger()`, `runKitCase()` (`try/catch` recording `FAIL` before rethrowing), and `recordSkippedCase()`. `readAllExecutedCases()` now returns the full chronological array without deduplicating; `evaluateChannelPassRule()` and `evaluateKitRunPassRule()` reject any `FAIL`, `SKIP`, duplicate/retried case (`retries: 0`), or stale `runId`, and `writeKitRunSummaryArtifacts()` writes `k1-kit-summary.{md,json}` before asserting. Verified in `kit.k0.test.ts`. | **FIXED & VERIFIED** |
| `A-LA-E7-06-05` | BLOCKER | `issueOperatorGrantForChannel` passed `--service` instead of `--service-url` and omitted `--client-id` when `options.purpose === 'add_deployment'`. | Extracted `buildOperatorGrantCliArgs()` in `lib/fixtures.ts` and wired it into `issueOperatorGrantForChannel()`. It always passes `--client-id <clientId>` (for initial, `add_deployment`, and `acceptStaged` flows) and passes `--service-url <serviceUrl>` (never `--service`) when `site.serviceOrigin` is `true`. Verified across `canvas`, `blackboard`, `lti-generic`, and `brightspace` in `kit.k0.test.ts`. | **FIXED & VERIFIED** |
| `A-LA-E7-06-06`, `A-LA-E7-06-07`, `B-LA-E7-06-02` (`AC-LA-E7-06-01`, `AC-LA-E7-06-08`) | BLOCKER | `computeExpectedCaseList` and the K1-SIM suites omitted or weakened design cases (`L2`..`L4`, `L6`..`L10`, `D3`..`D6`, `A1`..`A6`, `N1`/`N2`, `R1`..`R6`, `C3`), ran `L-FAULTS` per channel instead of once per run, and gated `D5`/`D6` behind `content.ungraded`. | Rebuilt `computeExpectedCaseList()`, `computeExpectedGlobalCaseList()`, all 5 channel fixtures (removing ad-hoc `supports*OnSim` flags and adding `platformStorage`), and all 6 port suites (`k1-launch`, `k1-dl`, `k1-ags`, `k1-nrps`, `k1-reg`, `k1-cap`). `L1`..`L10`, `D1`..`D8` (including `D5` `403 PLACEMENT_NOT_GRADED` with 0 DL calls and `D6` `/api/idtoken` `acceptLineItem`/`acceptMediaTypes`), `A1`..`A6`, `N1`, `R1`..`R6`, `C1`..`C3`, and `H2` now run per channel, while `GLOBAL:K1-LAUNCH:L-FAULTS`, `GLOBAL:K1-NRPS:N2`, and `GLOBAL:K-HYG:H1` run once per kit run. Verified in `kit.k0.test.ts`. | **FIXED & VERIFIED** |
| `B-LA-E7-06-06`, `LA-E8-01` finding 1 | MAJOR | `tests/ltiaas/kit/README.md` lacked complete operational steps (`wave-evidence.json`, `hosts.json`, artifact paths, failure outputs), and `loadAllChannelFixtures()` used a fixed 5-channel array instead of open-world directory discovery. | Updated `listChannelFixtureIds()`, `loadAllChannelFixtures()`, and `resolveSelectedChannelIds()` in `lib/fixtures.ts` to discover any `<id>.json` in `channels/` with zero shared-list edits, verified by a 6th-channel canary test (`canary-lms.json`) in `kit.k0.test.ts`. Expanded `tests/ltiaas/kit/README.md` with step-by-step onboarding, `wave-evidence.json` schema, commands, artifact paths, and failure output examples. | **FIXED & VERIFIED** |

---

### 2.2 Updated Pre-Computed Expected Case Matrix (`computeExpectedCaseList` + `computeExpectedGlobalCaseList`)

- **Global Once-Per-Run Cases (`3 RUN`):** `GLOBAL:K1-LAUNCH:L-FAULTS`, `GLOBAL:K1-NRPS:N2`, `GLOBAL:K-HYG:H1`.
- **Per-Channel Cases:**

| Channel | Simulator Provider | `K1-LAUNCH` | `K1-DL` | `K1-AGS` | `K1-NRPS` | `K1-REG` | `K1-CAP` | `K-HYG` | Expected `RUN` | `N/A` (Capability-Gated) | Off Capabilities Tested by `C2` |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| `moodle` | `moodle-sim` | `10 RUN` (`L1`..`L10`) | `8 RUN` (`D1`..`D8`; `1 N/A`: `D5-UNGRADED`) | `6 RUN` (`A1`..`A6`) | `1 RUN` (`N1`) | `6 RUN` (`R1`..`R6`; `2 N/A`: `R1-DEPLOYMENTS`, `R-CHECK`) | `5 RUN` (`C1`, `3×C2`, `C3`) | `1 RUN` (`H2`) | **37** | **3** | `deployments.multiple`, `setup.artifacts`, `setup.connectionCheck` |
| `canvas` | `canvas-sim-cloud` | `10 RUN` (`L1`..`L10`) | `8 RUN` (`D1`..`D8`; `1 N/A`: `D5-UNGRADED`) | `6 RUN` (`A1`..`A6`) | `1 RUN` (`N1`) | `8 RUN` (`R1`, `R1-DEPLOYMENTS`, `R2`..`R6`, `R-CHECK`) | `4 RUN` (`C1`, `2×C2`, `C3`) | `1 RUN` (`H2`) | **38** | **1** | `siteApi.token`, `publish.createCourse` |
| `blackboard` | `blackboard-sim` | `10 RUN` (`L1`..`L10`) | `8 RUN` (`D1`..`D8`; `1 N/A`: `D5-UNGRADED`) | `6 RUN` (`A1`..`A6`) | `1 RUN` (`N1`) | `5 RUN` (`R1`, `R2`, `R4`, `R5`, `R6`; `3 N/A`: `R1-DEPLOYMENTS`, `R3`, `R-CHECK`) | `8 RUN` (`C1`, `6×C2`, `C3`) | `1 RUN` (`H2`) | **39** | **4** | `registration.dynamic`, `deployments.multiple`, `setup.artifacts`, `siteApi.token`, `publish.createCourse`, `setup.connectionCheck` |
| `lti-generic` | `generic-sim` | `10 RUN` (`L1`..`L10`) | `8 RUN` (`D1`..`D8`; `1 N/A`: `D5-UNGRADED`) | `6 RUN` (`A1`..`A6`) | `1 RUN` (`N1`) | `8 RUN` (`R1`, `R1-DEPLOYMENTS`, `R2`..`R6`, `R-CHECK`) | `5 RUN` (`C1`, `3×C2`, `C3`) | `1 RUN` (`H2`) | **39** | **1** | `setup.artifacts`, `siteApi.token`, `publish.createCourse` |
| `brightspace` | `brightspace-sim` | `10 RUN` (`L1`..`L10`) | `8 RUN` (`D1`..`D8`; `1 N/A`: `D5-UNGRADED`) | `6 RUN` (`A1`..`A6`) | `1 RUN` (`N1`) | `7 RUN` (`R1`, `R1-DEPLOYMENTS`, `R2`..`R6`; `1 N/A`: `R-CHECK`) | `6 RUN` (`C1`, `4×C2`, `C3`) | `1 RUN` (`H2`) | **39** | **2** | `setup.artifacts`, `siteApi.token`, `publish.createCourse`, `setup.connectionCheck` |

---

### 2.3 Round 2 Host Verification Commands & Results (`4e453a7c`)

1. **TypeScript Check (`tests/ltiaas/kit/tsconfig.json`):**
   ```sh
   npx tsc -p tests/ltiaas/kit/tsconfig.json --noEmit
   ```
   - Exit code: `0` (`0` errors across `tests/ltiaas/kit/**`).

2. **Kit `K0` + `DOC` Self-Tests (`tests/ltiaas/kit/kit.k0.test.ts`):**
   ```sh
   LA_LEVEL=k0 npx --no-install vitest run --reporter=verbose --config tests/ltiaas/kit/vitest.config.mts
   ```
   - Result: **1 passed (1), 10 passed (10)** in `144ms` (`/Users/quangnguyen/cogniate-qa-runs/LA/LA-E7-06/r2/k0-kit-selftest.log`).

3. **F1 Kit-Neutrality Check (`tests/ltiaas/kit/suites/**`):**
   ```sh
   grep -REi '(moodle|canvas|blackboard|brightspace|sakai|schoology|d2l|instructure|anthology|lti-generic)' tests/ltiaas/kit/suites/ | wc -l
   ```
   - Result: `0` hits across all 7 suite files; `AC-LA-E7-04-07` fitness probe also **PASS**.

4. **Root `K0` Suite (`npm run test:k0`):**
   ```sh
   npm run test:k0
   ```
   - Result: **3 passed (3), 145 passed (145)** in `836ms` (`/Users/quangnguyen/cogniate-qa-runs/LA/LA-E7-06/r2/test-k0.log`).
