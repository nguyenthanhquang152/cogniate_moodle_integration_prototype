Verdict: PASS (host checks; K1-SIM rows pending: Docker window)
Round: 5

# QA Review — `LA-E7-06` (`K1` Simulator Suites per Port, Channel Fixtures, and the Pass Rule)

- **Verdict:** `PASS` for the host checks of Round 5; every `K1-SIM` row stays `pending: Docker window`
- **Round:** `5` (Rounds 1–4: QA-4; Round 5: QA-K, the extra fix round of LA-H25 = (a); see "Round 5" at the end)
- **Task:** `LA-E7-06` — `K1` simulator suites per port, channel fixtures and the pass rule (Must, size L)
- **Reviewer:** QA-4 (lane `L2`, Rounds 1–4); QA-K (Claude Code Opus 5.5 xhigh, Round 5)
- **Integration SHA:** Round 5 on `b6bfbef2` with the Round 5 kit files on top (Round 4 on `f0f9402e`; Round 3 reviews on `f0f9402e` / `af36ad31`; Round 2 reviews on `89f72196`; Round 1 on `053ea576`)
- **Verification Mode:** Host-only authoring and `K0` / `DOC` verification (`0` Docker commands executed; `K1-SIM` rows marked `pending: Docker window`)
- **Scratch Run Directory (`umask 077`):** `/Users/quangnguyen/cogniate-qa-runs/LA/LA-E7-06/r5` (Round 4: `.../r4`)

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

---

## Round 4 (`f0f9402e` — Fix Round 3 / QA Round 4)

### 4.1 Resolution of Open Round 3 Findings (`reviewer-a.md` & `reviewer-b.md`)

| Finding ID | Fix Implemented | Test | Probe Result |
| :--- | :--- | :--- | :--- |
| `A-LA-E7-06-01` (`AC-LA-E7-06-05`) | Updated `verifyWaveSuiteArtifact()` in `tests/ltiaas/kit/lib/fixtures.ts` (`line 1117`) to require `typeof parsed.suite === 'string' && parsed.suite === suiteName` (rejecting both anonymous `{ waveId, outcome: "PASS" }` files and artifacts whose `suite` field names a different suite), and documented the artifact JSON schema (`{ "suite": "<T3b\|T7\|T8>", "waveId": "<LA_WAVE_ID>", "outcome": "PASS" }`), producer, and `$LA_RUN_DIR` containment rule in `tests/ltiaas/kit/README.md` §3.1. | `tests/ltiaas/kit/kit.k0.test.ts` (`AC-LA-E7-06-05 / A-LA-E7-06-01 / B-LA-E7-06-01`) | **PASS** — Anonymous `{ waveId, outcome: "PASS" }` artifact and reused `T3b` artifact pointing at `T7`/`T8` both fail `evaluateChannelPassRule()` and `evaluateKitRunPassRule()` with `"suite mismatch in artifact (`undefined` !== `T3b`)"` and `"suite mismatch in artifact (`T3b` !== `T7`)"`. |
| `B-LA-E7-06-01` (`AC-LA-E7-06-05`) | Enforced `typeof parsed.suite === 'string' && parsed.suite === suiteName` in `verifyWaveSuiteArtifact()` (`tests/ltiaas/kit/lib/fixtures.ts:1117`) and updated `writeWaveEvidenceToRun()` (`tests/ltiaas/kit/lib/runtime.ts:627`) to write per-suite JSON artifacts when materializing wave evidence. | `tests/ltiaas/kit/kit.k0.test.ts` (`AC-LA-E7-06-05 / A-LA-E7-06-01 / B-LA-E7-06-01`) + Reviewer B host probe (`/tmp/reviewer-b-e706r3-probes.cjs`) | **PASS** — Reviewer B probes `"one anonymous PASS artifact cannot certify all three named frozen suites"`, `"control named T3b artifact cannot also certify T7/T8"`, `"control three named current-wave PASS artifacts pass"`, `"control absent current-wave identity fails"`, and `"control contradictory artifact fails"` all pass (`5/5`). |
| `A-LA-E7-06-08` | Fixed all contract and helper mismatches across `tests/ltiaas/kit/lib/{fixtures,runtime}.ts` and `tests/ltiaas/kit/suites/k1-*.k1sim.test.ts`: (1) `loadChannelManifestCapabilities()` resolves capabilities from `getChannelsDir()` when `manifestsRoot`/`QA_CHANNEL_MANIFESTS_DIR` is unset (without importing product source modules); (2) `session()` maps `'B'` and `/(?:^|[-_])b(?:$|[-_])/i` labels to account `'B'`; (3) `setupChannelBinding()` passes `options.library ?? 'A'`, sends `profile: fixture.simProfile` on `POST /app-api/connections`, sends contract-exact `PUT /app-api/connections/:id/platform` (`grantCode`, `authenticationEndpoint`, `accessTokenEndpoint`, `jwksUrl`, `tokenAudience`), and reads flat `connection.platform.id`; (4) `openPickerOnChannel()` follows `/tool/deep-link?ltik=...` `303` handoff to `/tool/picker/:pickerId`; (5) `runDynamicRegistrationHandshake()` uses `connection.registrationUrl` and follows the 3-step `/lti/register/cogniate` -> `GET /tool/register` -> `POST /tool/register` flow; (6) `k1-cap` `C1` reads flat `Connection` DTO and `Object.keys(toolCfg.json.fields)`; (7) `k1-reg` `R1`/`R1-DEPLOYMENTS`/`R2`/`R-CHECK` use `PUT /app-api/connections/:id/platform`, `POST /app-api/connections/:id/deployments` (`{ deploymentId, grantCode }`), `GET /app-api/connections/:id/canvas-configuration` (`placementUrls`), and `overall: 'pass' \| 'fail'`; (8) `k1-launch` `L3`/`L9` and `k1-dl` `D5`/`D7` follow the `/tool/launch` or `/tool/deep-link` `303` handoff before asserting `403`/`404` or `picker.status === 200`; (9) `k1-ags` `A3` consumes `waitSync` as a sync object (`synced.status === 'sent'`, `synced.tries >= 2`). | `tests/ltiaas/kit/kit.k0.test.ts` (`A-LA-E7-06-07 / A-LA-E7-06-08 / B-LA-E7-06-02 / B-LA-E7-06-07` & `A-LA-E7-06-08 / B-LA-E7-06-07`) | **PASS** — `tsc --noEmit` exits `0` across both `tests/ltiaas/kit/tsconfig.json` and `tests/tsconfig.json`; `kit.k0.test.ts` static & runtime contract checks pass. |
| `B-LA-E7-06-07` | Resolved all 5 host-executable contract breaks reproduced by Reviewer B's probe (`loadChannelManifestCapabilities(canvas)` default path, `setupChannelBinding` `profile` & `grantCode`, `session()` `'A'`/`'B'` selection on L9 library labels, `openPickerOnChannel()` handoff redirect, and `k1-ags` `A3` `waitSync` sync-object handling). | `tests/ltiaas/kit/kit.k0.test.ts` + Reviewer B host probe (`/tmp/reviewer-b-e706r3-probes.cjs`) | **PASS** — All Reviewer B `fixtures.ts` and `runtime.ts` probes (`C1 default manifest loader resolves a shipped channel`, `setup selects fixture simulator profile`, `setup redemption sends documented grantCode`, `setup redemption excludes unknown approvalCode`, `L9 generated library labels select distinct A and B accounts`, `picker helper follows handoff to the picker page`) pass (`100%`). |
| `A-LA-E7-06-07` | Completed all remaining design-mandated assertions across `K1-LAUNCH`, `K1-DL`, `K1-AGS`, `K1-NRPS`, `K1-REG`, and `K1-CAP`: added `deriveExpectedFamilyGuardOutcome()` and `validateFamilyGuardLaunchObservation()` in `lib/fixtures.ts` and wired `L4` to pre-derive the exact `400 PROVIDER_PROFILE_MISMATCH` vs `303` + `family_guard_mismatch` log expectation before launching; added `verifyContextlessSharedPlacement()` in `lib/fixtures.ts` and wired `L7` to poll until both learners' rows reach `sent` and share one `activity.resourceLinkId`; expanded `L1`, `L3`, `L5`, `L6`, `L8`, `L9`, `L10`, `D3`, `D6`, `D7`, `A1`..`A6`, `N1`, `N2`, `R1`..`R6`, `R-CHECK`, and `C3`; added Section 5 (Design-Case-to-Assertion Map) in `tests/ltiaas/kit/README.md`. | `tests/ltiaas/kit/kit.k0.test.ts` (`A-LA-E7-06-07 / B-LA-E7-06-02: L4 family-guard pre-derived oracle and L7 contextless one-placement validator pass positive controls and reject swapped/duplicate mutants`) | **PASS** — Swapped L4 mutant (`303` on launch-guarded foreign family or `400` on registration-guarded foreign family for non-`self` channel) and duplicate-placement L7 mutant (`rl-ctxless-1` vs `rl-ctxless-2`) are both rejected by K0 unit tests. |
| `B-LA-E7-06-02` | Eliminated post-hoc status branching in `L4` (`k1-launch.k1sim.test.ts:206-232`) and fixed `L7` (`k1-launch.k1sim.test.ts:358-401`), `A3` (`k1-ags.k1sim.test.ts:190-275`), `C2` (`lib/runtime.ts:1544-1602`), and `R6` (`k1-reg.k1sim.test.ts:471-579`). | `tests/ltiaas/kit/kit.k0.test.ts` (`A-LA-E7-06-07 / B-LA-E7-06-02`) | **PASS** — Pre-derived L4 oracle and L7 one-placement invariant verified across all 5 channels and mutant controls in `kit.k0.test.ts`. |
| `A-LA-E7-06-09` (`AC-LA-E7-06-08`) | Added `selectProtocolControlFixture()` in `tests/ltiaas/kit/lib/fixtures.ts` (`line 371`) and updated `GLOBAL:K1-LAUNCH:L-FAULTS` (`k1-launch.k1sim.test.ts:666`) and `GLOBAL:K1-NRPS:N2` (`k1-nrps.k1sim.test.ts:147`) to always select the `generic-sim` protocol-control fixture from `loadAllChannelFixtures()` (never falling back to `fixtures[0]`) while keeping `tests/ltiaas/kit/suites/**` 100% F1-clean. | `tests/ltiaas/kit/kit.k0.test.ts` (`A-LA-E7-06-09: selectProtocolControlFixture selects lti-generic (generic-sim) and throws when missing or duplicated`) | **PASS** — `selectProtocolControlFixture()` returns `lti-generic` (`generic-sim`), throws when `lti-generic` is removed instead of falling back to `moodle`, and throws on duplicate protocol-control fixtures; F1 scan across `suites/**` has `0` hits. |
| `B-LA-E7-06-06` (`LA-E8-01`) | Removed the hardcoded `expect(beforeIds.length).toBe(5)` assertion in `tests/ltiaas/kit/kit.k0.test.ts` (`line 175`) and replaced it with dynamic `expect(beforeIds.length).toBeGreaterThanOrEqual(5)` and `expect(afterIds.length).toBe(beforeIds.length + 1)` so adding a 6th `<id>.json` file in `tests/ltiaas/kit/channels/` passes all K0 tests without editing any shared list or test expectation. | `tests/ltiaas/kit/kit.k0.test.ts` (`B-LA-E7-06-06 / LA-E8-01: open-world channel discovery onboards a new <id>.json fixture and passes runShippedChannelsAudit with zero shared-list edits`) + live 6th-file canary run in `tests/ltiaas/kit/channels/canary-six.json` | **PASS** — Verified both via the temp-dir K0 test and by writing a 6th fixture file `tests/ltiaas/kit/channels/canary-six.json` and running `LA_LEVEL=k0 npx --no-install vitest run --config tests/ltiaas/kit/vitest.config.mts` (`16/16 passed`). |

### 4.2 Round 4 Host Verification Commands & Results (`f0f9402e`)

1. **TypeScript Check (`tests/ltiaas/kit/tsconfig.json` and `tests/tsconfig.json`):**
   ```sh
   ./node_modules/.bin/tsc --noEmit -p tests/ltiaas/kit/tsconfig.json && ./node_modules/.bin/tsc --noEmit -p tests/tsconfig.json
   ```
   - Exit code: `0` (`0` errors across all kit and test files).

2. **Kit `K0` + `DOC` Self-Tests (`tests/ltiaas/kit/kit.k0.test.ts`):**
   ```sh
   LA_LEVEL=k0 npx --no-install vitest run --reporter=verbose --config tests/ltiaas/kit/vitest.config.mts
   ```
   - Result: **1 passed (1), 16 passed (16)** in `186ms` (also verified **16 passed (16)** with a temporary 6th fixture `tests/ltiaas/kit/channels/canary-six.json` present in `channels/`).

3. **F1 Kit-Neutrality Check (`tests/ltiaas/kit/suites/**`):**
   ```sh
   grep -REin '(moodle|canvas|blackboard|brightspace|sakai|schoology|d2l|instructure|anthology|lti-generic)' tests/ltiaas/kit/suites/
   ```
   - Exit code: `1` (`0` matches across all 7 suite files).

4. **Reviewer B Host-Only Probe Suite (`/tmp/reviewer-b-e706r3-probes.cjs` against `la-qa`):**
   - Result: **17 / 17** kit (`fixtures.ts` & `runtime.ts`) probes **PASS** (`manifestError: ""`).



---

## Round 5

QA-K (Claude Code Opus 5.5, xhigh, a new QA session; LA-H25 = (a): one extra fix round after the 3 rounds of QA-4). Scope: kit code and this file only.

- **Base:** integration `b6bfbef2`. Its `tests/ltiaas/kit/**` is byte-equal to la-qa `70088264` (QA commit `30b5eb24`, the Round 4 review pin `3a8b0e6f`). Private clone `~/cogniate-qa-runs/LA/LA-E7-06/r5/clone` (`git clone --no-hardlinks`, `umask 077`); the la-qa working-tree kit is copied on top for every run.
- **Mode:** host only, `0` Docker commands, no stack runner. The `K1-SIM` rows stay `pending: Docker window`.
- **Independence:** I did not read product source (`services/**`, `packages/**`, `apps/**`). Facts come from `docs/architecture/contracts/*.md`, `docs/architecture/ltiaas/contracts/*.md`, LA-ADR-01/02/05, the frozen helpers (`tests/acceptance/M1/common/*`, `tests/acceptance/lib/*`), `tests/sim/**`, and QA tests and reports for facts (`tests/ltiaas/tasks-lti/LA-E3-01`, `LA-E3-02`; `docs/reviews/LA-E2-03/qa.md` AC-LA-E2-03-11). Where a reviewer cites product lines, the oracle uses the contract text.
- **Reviewer probe files:** the Round 4 paths (`/tmp/la-review-a-29f08bae897a/reviewer-r4.*`, `/tmp/reviewer-b-e706r4-*.cjs`, `/tmp/review-b-e706-r4-mwv0u9p0`) do not exist on this host any more (`/tmp` was cleared). So every Round 4 counterexample and probe is written as a K0 probe in `tests/ltiaas/kit/kit.k0.test.ts` (list in R5.2).
- **Design change:** the case bodies that the reviewers found wrong now live in `lib/cases.ts` with injected I/O. The suites call them with `liveKitCaseIo()` (bound to the frozen M1 `launch`, `beginLaunch`, `formPost`, `httpsRequest`, `logEvents`). K0 calls the same functions with contract-shaped host fakes, so K0 runs the real selectors, request shapes and final comparisons.

### R5.1 Open findings

| Finding | Fix | Test or probe (K0 unless named) | Result |
| :--- | :--- | :--- | :--- |
| `A-LA-E7-06-07` (L4, L7) | **L4:** new fixture field `expect.guardedFamilies` (LA-ADR-01 D2/D6, LA-ADR-02 D1/D3/D4; cited per fixture; audited). `selectFamilyGuardProbes` takes the probes from the declared levels of all fixtures, before any launch: a `launch`-level family of another channel (required; explicit error if none), a `registration`-level family of another channel (when one exists), and a family that no fixture guards. `deriveExpectedFamilyGuardOutcome`: `launch` → `400 PROVIDER_PROFILE_MISMATCH`; `registration` → `400` on a `MANUAL_SELF_LEGACY_CHANNELS` platform (`manual === 'self'`, load check 6), else `303` + LTI log; unguarded → `303` and no log. `runFamilyGuardCase` reads `family_guard_mismatch` from the **`lti-service`** log with `platform_id` and the family. **L7:** the suite's only final comparison is `verifyContextlessSharedPlacement(collectContextlessPlacementObservation(...))`; the comparisons with the external `sharedRlId` are removed. | `(L4): fixture guard data equals LA-ADR-01 D6, and the L4 selector picks probes ...` (Blackboard → `canvas`; Canvas → `desire2learn`, not `moodle`; `moodle` unguarded → pass); `(L4): the L4 case body passes on a check-14 fake ...` (5 targets; mutants: registration refusal, app-log-only, no log, launch guard passes, `moodle` guarded); `(L7): the L7 verdict accepts contract-shaped answers with an internal placement id ...` (`rl_9f2c41` ≠ launch id passes); static check: `sharedRlId` only in launch patches | PASS |
| `A-LA-E7-06-08` (picker, L10, D3, C1) | **Picker:** `followPickerHandoff` returns the observed status; the `303 → 200` rewrite is removed. **L10:** `runPlatformStorageCase`: the auth URL is the JSON-parsed value of the page's one `<script type="application/json">` block on the same endpoint as the plain `302` `Location`; the state is that URL's `state`; the check comes from the storage-check page's JSON block (`check`); `POST /lti/launch/cogniate/storage-check` sends only `check` and `value` with `Origin` = the LTI origin. **D3:** the form field is `publicationId`, repeated (`buildPickerSelectionForm`), posted in the picker list order; item order is read from each item's `url` `resource` (the old oracle compared kit-local titles that the product never saw). **C1:** no manifest operand (it was a copy of the fixture). C1 compares the fixture with the registry entry of `GET /app-api/lms-providers` (exactly one entry, `lms` = `channel` = fixture id; the public projection of the manifest, delta §2) and with the connection DTO, both directions; tool configuration must be an array. | `(picker): ... a redirect loop stays 303` (loop 303; control 200; refusal 403); `(L10): the L10 case body completes on a contract-shaped storage fake ...` (Canvas, lti-generic; Moodle, Blackboard, Brightspace); `(L10): escaped JSON pages, script-built check form, and wrong storage behaviour` (regex URL has no `state`; `parseForm` throws `HTML form action present`); `(D3): picker selection uses the repeated publicationId field ...` (plural field gives 0 ids); `(C1 operand): ... a registry capability that differs from the fixture fails` | PASS |
| `B-LA-E7-06-02` (L4, L7, A3) | **L4:** as A-07 (no inference from `operatorGrant`/DR; `moodle` declares `[]`). **L7:** the verdict requires exactly one row per learner, one placement id on both rows, `stats.activities === 1` on the publication (read before the no-AGS launches), a `sent` sync per row, and every score call of each learner on `<launch line item path>/scores` (`services.assignmentAndGrades.lineItemId` of that learner's `/api/idtoken`). **A3:** `503`: `waitForLearnerSync` waits for the learner's sync with `tries >= 1`, then asserts `pending`, `tries === 1`. `429`: `waitForThrottledDispatch` waits for the learner's score call and a `dispatch_throttled` line, then asserts `pending`, `tries === 0`, one call. | `(L4)` tests above; `(L7)`: duplicate row for one learner → `duplicate result rows`; both calls to `lineitems/other-item/scores` → 2 line-item errors; two ids → `name 2 placements`; `stats.activities` 2 → error; unsent; no call; no line item; `(A3): the A3 waits return only after a tried send` (pre-send `pending`/`tries 0` row is skipped; timeouts fail) | PASS |
| `B-LA-E7-06-07` (picker, L10) | **Picker:** as A-08; L8's staff-picker `status` assertion now sees the real status. **L10:** documented body and `Origin` for every check request; wrong value, replay and unknown check each use an otherwise valid request on their own check and are told apart by the LTI log detail (`storage_mismatch` or `storage_check_unknown_used_or_expired`); empty value → `STATE_COOKIE_MISSING` with the help text; foreign `Origin` first leaves the check usable; bad signature → `INVALID_SIGNATURE` (AP-05-07). `pendingId` and `state` fields are gone. | `(picker)` and both `(L10)` tests; the fake records each check request: all have exactly `["check","value"]`, the accepted one has the LTI origin; mutants (replay accepted, wrong value accepted, no log, target ignored) fail the case body | PASS |
| Lead item (`docs/reviews/LA-E8-01/reviewer-a.md` Round 3, `A-LA-E8-01-06`) | Kit README K1 commands now use `npm --prefix tests run acceptance:api` from the repository root (or `cd tests && node acceptance/run-api.mjs`), with the reason; default artifact path is `tests/.tmp/kit-run`. | Host probe (fake Vitest that only prints the config path; no stack): `~/cogniate-qa-runs/LA/LA-E7-06/r5/cmd-probe.log`. Old form from the root: `resolved .../fake-repo/ltiaas/kit/vitest.config.mts`, `exists: false`, exit 2. New form: `cwd .../fake-repo/tests`, `exists: true`, exit 0; `cd tests && node acceptance/run-api.mjs`: exit 0. | PASS |
| QA-K extra (status of launch refusals) | security.md §2.2: every launch check failure gives an error page with status `400` or `401`; the frozen M1 `20-protocol.test.ts` checks the code and accepts the status it gets. The kit pinned `400`. New `launchRefused` (lib/cases.ts): status `400` or `401`, exact `data-error-code`, no `Location`. Used for L2 (`INVALID_SIGNATURE`, `INVALID_ISSUER_OR_AUDIENCE`), L7 (`MISSING_CLAIM`), the 12 L-FAULTS codes, and L10 launch-path refusals. `PROVIDER_PROFILE_MISMATCH` stays `400` (lti-service-api.md §2 page table); storage-check refusals stay `400` (delta §2.2); `UNKNOWN_DEPLOYMENT` stays `400` and `*_NOT_ACTIVE` `403`, as the frozen M1 tests assert them. | `(L10): escaped JSON pages, ...`: `400` and `401` pages pass; `403`, a page with `Location`, and a wrong code fail | PASS |
| QA-K extra (found while fixing L10) | `channels/lti-generic.json` `sim.platformStorage` was `null`, but the `lti-generic` profile is `{ from-login, authOrigin }` (LA-ADR-05 D1 rule 1a; LA-E2-03 AC-LA-E2-03-11, K0 PASS in `docs/reviews/LA-E2-03/qa.md`). With `null`, L10 on `lti-generic` expected a `302` where the product answers the `200` login page. Now `{ frameName: post_message_forwarding, allowedOrigin: https://generic.sim.test }`, cited. | `(L10): the L10 case body completes ...` runs the storage path for `lti-generic` | PASS |

### R5.2 Reviewer Round 4 probes run (rewritten as K0 probes; the probe files were gone)

| Reviewer probe (Round 4 text) | K0 probe | Result |
| :--- | :--- | :--- |
| A: L4 selector on Blackboard has no candidate (`undefined.sim`) | L4 table: Blackboard → `canvas:launch_guarded:refuse`; case body runs for Blackboard; no launch-guard fixtures → explicit error | PASS |
| A: L4 on Canvas picks `moodle` as registration-guarded; the real verdict is pass | L4 table: Canvas → `desire2learn:...:warn_passthrough`, `moodle:unguarded:pass`; mutant `guardMoodle` fails | PASS |
| A: L4 warning read from the app log | mutant `appLogOnly` fails; the case reads `lti-service` with `platform_id` | PASS |
| A: L7 shared `rl_…` id ≠ external id; suite equality throws | L7 positive with `rl_9f2c41`; static check: no `toBe(sharedRlId)` | PASS |
| A: picker redirect loop becomes `200`; control: real `200` passes | picker probe: loop `303`, control `200` | PASS |
| A: L10 regex auth URL differs and has no `state` (`&`) | regex result has no `state`; JSON-parsed URL has it | PASS |
| A: L10 `parseForm` throws on the storage-check page | `parseForm` throws `HTML form action present`; `readStorageCheckToken` reads `check` | PASS |
| A: D3 posts `publicationIds` | plural field gives `getAll('publicationId') = []`; suite uses `buildPickerSelectionForm` | PASS |
| A: C1 manifest operand is a fixture copy (mutation passes) | C1 operand probe: one registry value differs → only that error; extra key → error | PASS |
| B: actual Blackboard L4 callback throws | `runFamilyGuardCase` for all 5 targets on the check-14 fake | PASS |
| B: Moodle declares `guardedFamilies: []`; helper treats `moodle` as guarded | fixture guard data equals the frozen LA-ADR-01 D6 table | PASS |
| B: L7 second row for one learner and one id → `ok: true` | `duplicate result rows for learner1` | PASS |
| B: L7 both score paths to another line item → `ok: true` | 2 `expected the launch line item` errors | PASS |
| B: L7 "duplicate placement" control changed the id only | two ids → `name 2 placements`; one id with `stats.activities` 2 → error | PASS |
| B: A3 `waitSync('pending')` returns the pre-send `tries 0` row | `waitForLearnerSync` returns the `tries 1` row on read 4 | PASS |
| B: picker loop → `200`; controls normal `303 → 200` and `403` refusal | picker probe: `303`, `200`, `403` | PASS |
| B: L10 Canvas callback sends `{check, value: '', state}` and no `Origin`; `400 INVALID_STATE` fails the expected `303` | L10 body on the storage fake: each request has `["check","value"]`; accepted one has the LTI origin | PASS |
| B: wrong-value and missing-row requests reuse the bad shape (`pendingId`) | wrong value, replay and unknown check use `check`/`value` + `Origin`, told apart by log detail; static check: no `pendingId` | PASS |
| B: one real sixth fixture `channels/review-canary.json` with the unchanged K0 command | canary copied from `lti-generic`, `brightspace`, `canvas` in turn: `23/23` each; file removed | PASS |
| B: kit TypeScript check | `tsc --noEmit -p tests/ltiaas/kit/tsconfig.json` exit 0 | PASS |

Mutation check (private clone only, then restored): sending `state` instead of `value` fails 2 L10 probes; reading the L4 warning from `cogniate-app` fails the L4 body probe; removing the L7 duplicate-row and line-item checks fails the L7 probe.

### R5.3 Earlier closed findings stay closed

`A-01`/`B-01` (wave evidence: named, current-wave, on-disk artifacts), `A-02`/`B-03` (C1 rejects missing, `null` and array maps for all four API maps), `A-03`/`B-05` (hygiene inputs and leaks), `A-04`/`B-04` (ledger, unselected-channel records), `A-05` (grant CLI), `A-06` (D5 `PLACEMENT_NOT_GRADED`, unchanged), `A-09` (protocol-control fixture), `A-10`/`B-08` (level aliases), `B-06` (one-file onboarding: K0 `23/23` with a real sixth fixture, three variants). Their K0 tests run unchanged in the `23/23` run, except the C1 test, which drops only the removed manifest operand.

### R5.4 Host verification (Round 5)

| Check | Command (in the private clone) | Result | Time | Log |
| :--- | :--- | :--- | :--- | :--- |
| Kit K0 | `LA_LEVEL=k0 npx --no-install vitest run --reporter=verbose --config tests/ltiaas/kit/vitest.config.mts` | **23/23 PASS** (was 16/16) | 180 ms | `r5/kit-k0.log` |
| Root K0 | `npm run test:k0` | **149/149 PASS**, 3 files | 625 ms | `r5/test-k0.log` |
| Kit typecheck | `npx --no-install tsc --noEmit -p tests/ltiaas/kit/tsconfig.json` | exit 0 | — | `r5/kit-tsc.log` |
| Tests typecheck | `npx --no-install tsc --noEmit -p tests/tsconfig.json` | exit 0 | — | `r5/tests-tsc.log` |
| F1 suite neutrality | `grep -rniE '(moodle\|canvas\|blackboard\|brightspace\|sakai\|schoology\|d2l\|instructure\|anthology\|lti-generic)' tests/ltiaas/kit/suites/` | 0 hits | — | — |

Baseline before the fix on the same clone: kit K0 16/16, root K0 149/149, kit typecheck exit 0.

### R5.5 Pending and notes

- `AC-LA-E7-06-01`, `-03`, `-04`, `-05`, `-06`, `-08`: `pending: Docker window` (K1-SIM). The changed live paths (L4, L7, L10, D3, A3, C1, every picker case) are proven on the host only.
- Contract gaps sent with the ask command (`msg_8f4aaa9cbbb7`; A-07, A-08, B-02, B-07) are now ruled (dispatch `ctx_4dc13937f316`, see R5.6): (1) D3, A1 `BD-A1-120`: two `publicationId` values on a single-select picker give the `400` page `PUBLICATION_NOT_AVAILABLE` with no JWT and no Deep Linking return, and the picker stays unused (the earlier default "at most one item" is replaced); (2) L10, A2 `BD-A2-112`: the check value is the member `check` of the storage-check page's one `<script id="lti-storage-data" type="application/json">` block (members `postUrl`, `check`, `target`, `origin`, `key`, `messageId`; never the state, the state hash or the tool URL); the hidden-input fallback is removed; (3) L7, A1 `BD-A1-120`: the default stands, `stats.activities` counts placements (two contextless launches on one resource link and deployment give 1).
- L4 on Brightspace has no registration-level probe: no other channel guards a family at that level (recorded as a note in the case report).
- Changed files: `tests/ltiaas/kit/lib/{cases.ts (new),fixtures.ts,runtime.ts}`, `tests/ltiaas/kit/suites/{k1-launch,k1-dl,k1-ags,k1-cap}.k1sim.test.ts`, `tests/ltiaas/kit/channels/{moodle,canvas,blackboard,lti-generic,brightspace}.json`, `tests/ltiaas/kit/kit.k0.test.ts`, `tests/ltiaas/kit/README.md`, this file. Other files that show as changed in the shared worktree are not from this round.

### R5.6 Rulings applied (dispatch `ctx_4dc13937f316`; base: la-qa `7859b25b`, integration `29fcb01d`)

| Ruling | Fix | Test or probe (K0) | Result |
| :--- | :--- | :--- | :--- |
| A1 `BD-A1-120` (D3; `A-LA-E7-06-08`, `B-LA-E7-06-02`) | New case body `runSingleSelectRefusal` (lib/cases.ts), called by the D3 single-select branch: two ids (repeated `publicationId`) must give status `400`, the error page `PUBLICATION_NOT_AVAILABLE`, no `Location` and no `JWT` field; then one id on the **same** picker must give `200` and a JWT with exactly that item. The suite also checks that the simulator has no `deep-link` record (no Deep Linking return). The "at most one item" oracle and the fresh-picker control are removed. | `(D3, ruling A1 BD-A1-120): two ids on a single-select picker give 400 PUBLICATION_NOT_AVAILABLE ...` on a picker-route fake; mutants fail: first id accepted (`200`), picker marked used by the refusal (control `410`), another code, a JWT on the refusal page | PASS |
| A2 `BD-A2-112` (L10; `A-LA-E7-06-08`, `B-LA-E7-06-07`) | `readStorageCheckData`: exactly one `<script id="lti-storage-data" type="application/json">` block, `JSON.parse`, a non-empty string member `check`; no hidden-input fallback. `runPlatformStorageCase` also fails when the block carries the state of that login. The K0 storage fake now renders the ruled block (members `postUrl`, `check`, `target`, `origin`, `key`, `messageId`). | `(L10): escaped JSON pages, script-built check form, and wrong storage behaviour`: mutants fail: `check` only in a hidden input (`no string member "check"`), block without `id="lti-storage-data"`, block that carries the state. Runner mutation (fallback put back, private clone only): that probe fails, 1 of 24 | PASS |
| A1 `BD-A1-120` (L7) | No change: `stats.activities === 1` stays in the L7 verdict. | `(L7)` probe unchanged | PASS |

Host checks after the rulings (private clone `b6bfbef2` + this kit):

| Check | Result | Time | Log |
| :--- | :--- | :--- | :--- |
| Kit K0 (`LA_LEVEL=k0 npx --no-install vitest run --reporter=verbose --config tests/ltiaas/kit/vitest.config.mts`) | **24/24 PASS** | 356 ms | `r5/kit-k0-rulings.log` |
| Root K0 (`npm run test:k0`) | **149/149 PASS**, 3 files | 771 ms | `r5/test-k0-rulings.log` |
| Kit typecheck (`npx --no-install tsc --noEmit -p tests/ltiaas/kit/tsconfig.json`) | exit 0 | — | `r5/kit-tsc-rulings.log` |
| F1 suite neutrality (grep of LMS names in `tests/ltiaas/kit/suites/`) | 0 hits | — | — |

Changed files in this step: `tests/ltiaas/kit/lib/cases.ts`, `tests/ltiaas/kit/suites/k1-dl.k1sim.test.ts`, `tests/ltiaas/kit/kit.k0.test.ts`, `tests/ltiaas/kit/README.md`, this file. `0` Docker commands; K1-SIM rows stay `pending: Docker window`.

### R5.7 C1 capability levels (dispatch `ctx_e470057191bd`; `A-LA-E7-06-08`, `reviewer-a.md` Round 5)

| Finding | Fix | Test or probe | Result |
| :--- | :--- | :--- | :--- |
| `A-LA-E7-06-08` "C1 requires profile-only keys in the channel-level provider map" | `fixtures.ts`: `PROFILE_LEVEL_CAPABILITY_KEYS` = the LA-ADR-01 D3 rows whose source is an LTI profile trait (`platform.sharing`, `site.serviceOrigin`); `CHANNEL_LEVEL_CAPABILITY_KEYS` = every other catalog key (no hard-coded count). `verifyBilateralCapabilities` compares the `GET /app-api/lms-providers` map with the channel-level keys only (a profile-level key there is an error) and the connection DTO with every key; both directions, exact values, unknown keys fail. C1 suite title and comment, README C1 row updated; the product API is unchanged. | K0 `(C1 levels, Round 5)`: the key lists equal the D3 table (parsed from `LA-ADR-01-channel-kernel.md`); for all 5 fixtures a 15-key provider map with a 17-key connection passes; a provider map with a profile trait, a provider map without `deployments.multiple`, and a connection without a profile trait each fail with that one error; a fixture mismatch and an unknown key still fail. Earlier C1 tests now use the channel-level provider shape. Reviewer-A probe `/tmp/la-review-a-5bbade125d93/reviewer-r5.probe.test.ts` (copied read-only into the private clone, then removed): 11/12 checks pass; the one failure is the C1 check that asserts the old defect (line 85), which now receives `[]` for the real 15-key provider and 17-key Canvas connection maps (`r5/reviewer-a-r5-probe-replay.log`). | PASS |

Host checks (private clone `b6bfbef2` + this kit): kit K0 **25/25 PASS** (225 ms, `r5/kit-k0-c1levels.log`); `npm run test:k0` **149/149 PASS**, 3 files (809 ms, `r5/test-k0-c1levels.log`); kit typecheck exit 0 (`r5/kit-tsc-c1levels.log`); F1 0 hits. Changed files: `tests/ltiaas/kit/lib/fixtures.ts`, `tests/ltiaas/kit/suites/k1-cap.k1sim.test.ts`, `tests/ltiaas/kit/kit.k0.test.ts`, `tests/ltiaas/kit/README.md`, this file. `0` Docker commands; K1-SIM rows stay `pending: Docker window`.
