# QA Review — `LA-E7-06` (`K1` Simulator Suites per Port, Channel Fixtures, and the Pass Rule)

- **Verdict:** `PASS`
- **Round:** `3`
- **Task:** `LA-E7-06` — `K1` simulator suites per port, channel fixtures and the pass rule (Must, size L)
- **Reviewer:** QA-4 (lane `L2`)
- **Integration SHA:** `89f72196` (Round 2 reviews on `89f72196` / Fix Round 1 `c1bf5c7a` / `5dcb2406`; Round 2 on `4e453a7c`; Round 1 on `053ea576`)
- **Verification Mode:** Host-only authoring and `K0` / `DOC` verification (`0` Docker commands executed; `K1-SIM` rows marked `pending: Docker window`)
- **Scratch Run Directory (`umask 077`):** `/Users/quangnguyen/cogniate-qa-runs/LA/LA-E7-06/r3`

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

---

## Round 3 (`89f72196` — Fix Round 2 / QA Round 3)

### 3.1 Resolution of Open Round 2 Findings (`reviewer-a.md` & `reviewer-b.md`)

| Finding ID | Fix Implemented | Test or Probe |
| :--- | :--- | :--- |
| `A-LA-E7-06-08` / `B-LA-E7-06-07` | Restored frozen `tests/acceptance/M1/common/{client,course}.ts` and `tests/acceptance/lib/{app,logs,lti,paths}.ts` imports in `tests/ltiaas/kit/lib/runtime.ts` and replaced ad-hoc HTTP/CLI helpers across `runtime.ts` and `tests/ltiaas/kit/suites/{k1-reg,k1-cap,k1-launch,k1-dl,k1-ags,k1-nrps,k-hyg}.k1sim.test.ts` with the documented contracts (`session` -> `__Host-cog_session`, `app`, `publication` -> `createCourse` + `uploadVersion` + `POST /app-api/publications`, `openPlay` + `commitGrade` + `results` + `waitSync`, `beginLaunch` + `launch` + `preparedLaunch` on `/lti/login/cogniate` and `/lti/launch/cogniate`, `admin` `Bearer`, `service` `SERVICE-AUTH-V1`, `ltiApi` `LTIK-AUTH-V2`, `GET /app-api/lms-providers` `{ lms: [...] }`, `openPickerOnChannel` + `pick` + `returnDeepLink` + `r.kind === 'deep-link'`, and `readServiceLogs` reading `LOGS_DIR/<service>.jsonl`). | `npx tsc --noEmit` across `tests/ltiaas/kit/**` (`0` errors) and `tests/ltiaas/kit/kit.k0.test.ts` (`13 passed`). |
| `A-LA-E7-06-05` | Updated `buildOperatorGrantCliArgs()` and `buildOperatorGrantNpmArgs()` (`--workspace @cogniate/cogniate-app run app:grant -- issue ...`) in `tests/ltiaas/kit/lib/fixtures.ts` to remove invalid `--lms`, include required `--note`, and keep `--service-url` and `--client-id` across initial, `add_deployment`, and `acceptStaged` grants; added `parseOperatorGrantOutput()` extracting the 43-char base64url approval code (`/(?<![\w-])[A-Za-z0-9_-]{43}(?![\w-])/g`) and `grt_...` grant ID per `M1/common/client.ts:115-121` and wired `issueOperatorGrantForChannel()` to `cli('app:grant', args)`. | `tests/ltiaas/kit/kit.k0.test.ts` (`A-LA-E7-06-05: buildOperatorGrantCliArgs, buildOperatorGrantNpmArgs, and parseOperatorGrantOutput match the shipped app:grant CLI contract across initial, add_deployment, and acceptStaged flows`). |
| `A-LA-E7-06-01` / `B-LA-E7-06-01` (`AC-LA-E7-06-05`) | Removed `input.waveEvidence?.waveId` fallback from `evaluateChannelPassRule()`, `evaluateKitRunPassRule()`, `loadWaveEvidenceFromRun()`, and `k-hyg.k1sim.test.ts` (`H2`/`SUMMARY`); added `deriveCurrentWaveIdFromRun()` in `lib/runtime.ts` and `verifyWaveSuiteArtifact()` in `lib/fixtures.ts` requiring every `coveredBy` suite's `artifactPath` to resolve inside the current run folder (`runDir`), exist on disk as a non-empty file, and parse as JSON with `suite === suiteName`, `waveId === currentWaveId`, and `outcome === 'PASS'`. | `tests/ltiaas/kit/kit.k0.test.ts` (`AC-LA-E7-06-05 / A-LA-E7-06-01 / B-LA-E7-06-01`: negative probes for omitted `currentWaveId` + old `wave-evidence.json`, missing artifact file, outside-run-folder path, and contradictory `outcome: "FAIL"` artifact file). |
| `A-LA-E7-06-04` / `B-LA-E7-06-04` (`AC-LA-E7-06-02`) | Updated `evaluateKitRunPassRule()` in `tests/ltiaas/kit/lib/runtime.ts` to inspect every record in `input.executedRecords` and fail (`globalErrors.push('unexpected channel record: ...')`, incrementing `totalFailed` or `totalSkipped`) whenever any record has a `channelId` that is neither `'GLOBAL'` nor in the selected `input.fixtures` set. | `tests/ltiaas/kit/kit.k0.test.ts` (`AC-LA-E7-06-02 / A-LA-E7-06-04 / B-LA-E7-06-04`: negative probes injecting `unexpected:K1-REG:R99` (`FAIL`) and `brightspace:K1-LAUNCH:L1` (`PASS` when only `canvas` is selected) into `evaluateKitRunPassRule`). |
| `A-LA-E7-06-07` / `B-LA-E7-06-02` | Expanded `A3` (`k1-ags.k1sim.test.ts`) to cover `204` (`sent`), `400/404/422` (`failed`), `409` (`conflict`, `'has a grade with a newer time'`), `503` (`pending`, `tries >= 1`), and `429 Retry-After: 60` (`pending`, `tries === 0`, `dispatch_throttled` log event, and `1` simulator `score` call); expanded `L7` (`k1-launch.k1sim.test.ts`) to cover contextless launch score commit (`waitSync('sent')`), second learner on same `resourceLinkId` sharing placement, contextless launch without AGS (`lastError === 'No gradebook column: the activity has no AGS line item.'` and `noServiceCalls`), and `omit: ['sub']` (`400 MISSING_CLAIM`); updated `C2` (`lib/runtime.ts`, `k1-cap.k1sim.test.ts`) to assert both `noServiceCalls(cursor)` and `logEvents('outbound_request', since, {}, 'lti-service' \| 'cogniate-app') === []`; expanded `R6` (`k1-reg.k1sim.test.ts`) to cover `/tool/register` off-origin DR staging (`status: 'pending'`, `403 PLATFORM_NOT_ACTIVE`, `--accept-staged`), `/api/registrations/dynamic/{preview,complete}` (`endpointsOnIssuerOrigin: false`, `active: false`), and active `POST /api/platforms` refusals (`400 PLATFORM_URL_NOT_ON_ISSUER_ORIGIN`, `400 PLATFORM_URL_NOT_IN_PROFILE`). | `npx tsc --noEmit` across `tests/ltiaas/kit/suites/*.ts` (`0` errors) and F1 neutrality check (`0` hits across `tests/ltiaas/kit/suites/**`). |
| `A-LA-E7-06-09` (`AC-LA-E7-06-08`) | Restored `PROTOCOL_SECURITY_FAULTS` in `tests/ltiaas/kit/lib/fixtures.ts` to the exact 12 `[fault, expectedCode]` pairs from `tests/acceptance/M1/blackboard/20-protocol.test.ts` and `tests/sim/core/crypto.mjs` (`altered-signature`, `unknown-key`, `unknown-kid`, `none`, `hs256`, `wrong-issuer`, `wrong-audience`, `multi-aud-no-azp`, `multi-aud-wrong-azp`, `expired`, `future-iat`, `wrong-nonce`) and asserted `denied(result.response, expectedCode, 400)` in `GLOBAL:K1-LAUNCH:L-FAULTS`. | `tests/ltiaas/kit/kit.k0.test.ts` (`AC-LA-E7-06-08 / A-LA-E7-06-09`: cross-checks `PROTOCOL_SECURITY_FAULTS` against both `tests/acceptance/M1/blackboard/20-protocol.test.ts` and `tests/sim/core/crypto.mjs`). |
| `A-LA-E7-06-10` / `B-LA-E7-06-08` | Added `resolveKitLevel()` and `isK1SimLevelEnabled()` in `tests/ltiaas/kit/lib/fixtures.ts` and `tests/ltiaas/kit/vitest.config.mts`, wired `isK1SimEnabled()` in `lib/runtime.ts` to `isK1SimLevelEnabled()` accepting `k0`, `k1sim`, `k1-sim` (and `k1`), and `all` consistently, and removed `describe.skip` from `tests/ltiaas/kit/suites/*.k1sim.test.ts`. | `tests/ltiaas/kit/kit.k0.test.ts` (`A-LA-E7-06-10 / B-LA-E7-06-08: LA_LEVEL accepts k0, k1sim, k1-sim, and all consistently across vitest.config.mts and runtime`). |
| `B-LA-E7-06-06` | Updated `resolveSelectedChannelIds()` in `tests/ltiaas/kit/lib/fixtures.ts` to return all discovered fixtures (`listChannelFixtureIds(dir)`) when `QA_KIT_CHANNELS` is unset or `'all'`, and extracted `runShippedChannelsAudit(dir)` in `tests/ltiaas/kit/kit.k0.test.ts` to audit any number of discovered fixtures (`>= 5`) without hardcoding `length === 5`. | `tests/ltiaas/kit/kit.k0.test.ts` (`One-file onboarding / B-LA-E7-06-06: adding a 6th channel fixture file is discovered by listChannelFixtureIds, resolveSelectedChannelIds, and runShippedChannelsAudit with zero shared-list edits`). |

### 3.2 Round 3 Host Verification Commands & Results (`89f72196`)

1. **TypeScript Check (`tests/ltiaas/kit/**` and `tests/tsconfig.json`):**
   ```sh
   npx tsc --noEmit --ignoreConfig --target ES2022 --lib ES2023,DOM --module ESNext --moduleResolution Bundler --strict --skipLibCheck --esModuleInterop --resolveJsonModule --types node tests/ltiaas/kit/lib/fixtures.ts tests/ltiaas/kit/lib/runtime.ts tests/ltiaas/kit/kit.k0.test.ts tests/ltiaas/kit/vitest.config.mts tests/ltiaas/kit/suites/*.ts
   npx tsc --noEmit -p tests/tsconfig.json
   ```
   - Exit code: `0` (`0` errors; `/Users/quangnguyen/cogniate-qa-runs/LA/LA-E7-06/r3/tsc.log`).

2. **Kit `K0` + `DOC` Self-Tests (`tests/ltiaas/kit/kit.k0.test.ts`):**
   ```sh
   LA_LEVEL=k0 npx vitest run --config tests/ltiaas/kit/vitest.config.mts
   ```
   - Result: **1 passed (1), 13 passed (13)** in `170ms` (`/Users/quangnguyen/cogniate-qa-runs/LA/LA-E7-06/r3/vitest-kit-k0.log`).

3. **F1 Kit-Neutrality Check (`tests/ltiaas/kit/suites/**`):**
   ```sh
   grep -rni -E '(moodle|canvas|blackboard|brightspace|sakai|schoology|d2l|instructure|anthology)' tests/ltiaas/kit/suites/
   ```
   - Exit code: `1` (`0` matches across all 7 suite files; `AC-LA-E7-04-07` fitness probe also **PASS** in `/Users/quangnguyen/cogniate-qa-runs/LA/LA-E7-06/r3/vitest-f1.log`).

4. **Root `K0` Suite (`npm run test:k0`):**
   ```sh
   npm run test:k0
   ```
   - Result: **3 passed (3), 145 passed (145)** in `973ms` (`/Users/quangnguyen/cogniate-qa-runs/LA/LA-E7-06/r3/npm-test-k0.log`).

