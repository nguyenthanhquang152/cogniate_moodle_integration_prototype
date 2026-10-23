# QA Review — `LA-E7-06` (`K1` Simulator Suites per Port, Channel Fixtures, and the Pass Rule)

- **Verdict:** `PASS`
- **Round:** `1`
- **Task:** `LA-E7-06` — `K1` simulator suites per port, channel fixtures and the pass rule (Must, size L)
- **Reviewer:** QA-4 (lane `L2`)
- **Integration SHA:** `053ea576f1e07834b359c8e7297f1effedcf1f57` (`053ea576`, product code identical to `02f5d42006fb8a4319790a2a5009b91fb7c32dc3` / `02f5d420`)
- **Verification Mode:** Host-only authoring and `K0` / `DOC` verification (`0` Docker commands executed; `K1-SIM` rows marked `pending: Docker window`)
- **Scratch Run Directory (`umask 077`):** `/Users/quangnguyen/cogniate-qa-runs/LA/LA-E7-06/r1`

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
