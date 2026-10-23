# LTI 1.3 Channel Certification Kit (`tests/ltiaas/kit`)

This kit certifies every LMS channel against the 6 capability ports (`LA-ADR-01` §D3–§D6, `LA-ADR-02` §D1–§D8) and the pass rules of `tests/ltiaas/TEST-STRATEGY.md` §2.2–§2.6.

---

## 1. Directory Layout & Suite Order

- `channels/<id>.json` — Declarative channel capability, expectation, simulator trait, and source-citation fixtures (`moodle`, `canvas`, `blackboard`, `lti-generic`, `brightspace`, plus any newly onboarded channel).
- `lib/fixtures.ts` — Open-world fixture loader (`listChannelFixtureIds`, `loadAllChannelFixtures`, `resolveSelectedChannelIds`), TB-12 source citation auditor (`auditFixtureSources`), expected case catalog (`computeExpectedCaseList`, `computeExpectedGlobalCaseList`), bilateral capability verifier (`verifyBilateralCapabilities`), operator grant CLI arg builder (`buildOperatorGrantCliArgs`), and pass-rule engine (`evaluateChannelPassRule`).
- `lib/runtime.ts` — Run ledger (`initKitRunLedger`, `runKitCase`, `readAllExecutedCases`, `evaluateKitRunPassRule`, `writeKitRunSummaryArtifacts`), wave evidence loader (`loadWaveEvidenceFromRun`), HTTP/simulator helpers, and recursive secret scanner (`scanAllLogsAndArtifactsForSecrets`).
- `suites/` — The 6 per-port simulator suites plus `K-HYG`, ordered deterministically by `KitSuiteSequencer` in `vitest.config.mts` so `k-hyg.k1sim.test.ts` always runs strictly last:
  1. `suites/k1-reg.k1sim.test.ts` (`K1-REG`: `R1`, `R1-DEPLOYMENTS`, `R2`, `R3`, `R4`, `R5`, `R6`, `R-CHECK`)
  2. `suites/k1-cap.k1sim.test.ts` (`K1-CAP`: `C1`, `C2:<capability>`, `C3`)
  3. `suites/k1-launch.k1sim.test.ts` (`K1-LAUNCH`: `L1`..`L10`, plus once-per-run `GLOBAL:K1-LAUNCH:L-FAULTS`)
  4. `suites/k1-dl.k1sim.test.ts` (`K1-DL`: `D1`..`D8`, `D5-UNGRADED`)
  5. `suites/k1-ags.k1sim.test.ts` (`K1-AGS`: `A1`..`A6`)
  6. `suites/k1-nrps.k1sim.test.ts` (`K1-NRPS`: `N1`, plus once-per-run `GLOBAL:K1-NRPS:N2`)
  7. `suites/k-hyg.k1sim.test.ts` (`K-HYG`: `GLOBAL:K-HYG:H1`, per-channel `H2`, and `GLOBAL:K-HYG:SUMMARY`)
- `kit.k0.test.ts` — Host-only K0 self-test suite (`LA_LEVEL=k0`, 0 Docker calls).

> **F1 Kit-Neutrality Rule (`AC-LA-E7-04-07`, `AC-LA-E7-06-01`)**: No file under `tests/ltiaas/kit/suites/**` may contain any LMS vendor/channel name (`moodle`, `canvas`, `blackboard`, `brightspace`, `sakai`, `schoology`, `d2l`, `instructure`, `anthology`, `lti-generic`). All branching in `suites/**` reads `fixture.capabilities`, `fixture.expect`, `fixture.sim`, `fixture.notBuilt`, and `fixture.coveredBy`.

---

## 2. How to Certify a New Channel (One Fixture File, Zero Suite Edits)

To certify a new channel `<id>`, you do **not** edit any file in `tests/ltiaas/kit/suites/**` or any shared channel list in `lib/fixtures.ts`. Follow these steps in order:

### Step 1: Ensure Simulator Provider & Host Manifest Exist

Before running K1-SIM for `<id>`, ensure its simulator provider (`simProvider` in `<id>.json`) is registered in `tests/sim/<folder>/index.mjs` and `tests/sim/hosts.json` (see `tests/sim/README.md`), or set `"simProvider": "generic-sim"` if the channel uses the generic 1EdTech LTI 1.3 simulator.

### Step 2: Create `tests/ltiaas/kit/channels/<id>.json`

Copy `tests/ltiaas/kit/channels/lti-generic.json` to `tests/ltiaas/kit/channels/<id>.json` and populate all required fields:

- `id`: Channel identifier matching `packages/channels/<id>/manifest.ts`.
- `source`: Top-level architecture and primary-source citation string.
- `simProvider`: Simulator provider ID from `tests/sim/hosts.json`.
- `simProfile`: LTI profile ID from `packages/channels/<id>/lti-profiles.ts`.
- `capabilities`: All 17 keys from `LA-ADR-01` §D3 (`binding.authority`, `content.multiple`, `content.ungraded`, `deployments.multiple`, `export.packages`, `launch.topLevelContinue`, `launch.windowHint`, `platform.sharing`, `publish.createCourse`, `records.readBack`, `records.reporters`, `registration.dynamic`, `registration.scopes`, `setup.artifacts`, `setup.connectionCheck`, `site.serviceOrigin`, `siteApi.token`).
- `coveredBy`: Map of positive capabilities covered by frozen live-LMS wave suites (for example `{ "siteApi.token": ["T8"] }`). Leave `{}` when all positive capabilities are exercised directly on the simulator.
- `notBuilt`: Map of unbuilt capabilities to their open architecture item or task ID (for example `{ "content.ungraded": "LA-ADR-05 §D5 / LA-E3-08" }`).
- `expect.legacyFlags`: The 6 legacy booleans (`dynamicRegistration`, `operatorApproval`, `webServices`, `courseShell`, `addDeployment`, `canvasConfiguration`), which must equal the `LA-ADR-01` §D11 derivation (`auditFixtureSources` checks this automatically).
- `expect.toolConfigurationKeys`: Ordered list of row `key` strings returned by `GET /app-api/connections/:id/tool-configuration`.
- `sim`: Simulator URLs, endpoints, `family`, `deployments`, `tokenAudience`, `tokenAudienceKind` (`"string"`, `"array"`, or `"fixed"`), `dlDataMode` (`"claim"` or `"query"`), `dlRequiresSub`, `privacyFloor` (`"none"` or `"allowlist"`), and `platformStorage` (`{ "frameName": "...", "allowedOrigin": "..." }` or `null`).
- `sources`: Map of field paths (`id`, `simProvider`, `simProfile`, `capabilities.<key>` for all 17 keys, `coveredBy`, `notBuilt`, `expect.legacyFlags`, `expect.toolConfigurationKeys`, `sim`) to non-empty citations (`TB-12`).

### Step 3: Supply Current-Wave Evidence (`wave-evidence.json`) When `coveredBy` Is Non-Empty

If `<id>.json` (or `moodle.json` in a full run) declares any capability in `coveredBy`, the kit requires real disk evidence from the current wave (`AC-LA-E7-06-05`). Set `LA_WAVE_ID=<wave-id>` and write `wave-evidence.json` in `$LA_RUN_DIR/wave-evidence.json` (or point `LA_WAVE_EVIDENCE_FILE` to its path):

```json
{
  "waveId": "wave-B4",
  "suites": {
    "T3b": {
      "outcome": "PASS",
      "waveId": "wave-B4",
      "artifactPath": "/abs/path/to/T3b/summary.json"
    },
    "T7": {
      "outcome": "PASS",
      "waveId": "wave-B4",
      "artifactPath": "/abs/path/to/T7/summary.json"
    },
    "T8": {
      "outcome": "PASS",
      "waveId": "wave-B4",
      "artifactPath": "/abs/path/to/T8/summary.json"
    }
  }
}
```

The pass rule fails closed if `wave-evidence.json` is missing, if `waveId` does not match `LA_WAVE_ID`, or if any suite named in `coveredBy` is missing, `"PENDING"`, `"FAIL"`, or lacks an `artifactPath`.

---

## 3. Commands & Result Artifact Paths

### Host-Only K0 Self-Tests (0 Docker Calls)

```sh
LA_LEVEL=k0 npx --no-install vitest run --reporter=verbose --config tests/ltiaas/kit/vitest.config.mts
```

### Full K1-SIM Run (During a Booked Docker Window)

```sh
# Run the 5 baseline channels:
LA_RUN_DIR=/tmp/kit-run LA_WAVE_ID=wave-B4 QA_TASK=K1 node tests/acceptance/run-api.mjs

# Run all channels in tests/ltiaas/kit/channels/*.json (including newly dropped <id>.json):
LA_RUN_DIR=/tmp/kit-run LA_WAVE_ID=wave-B4 QA_KIT_CHANNELS=all QA_TASK=K1 node tests/acceptance/run-api.mjs

# Run a single channel or subset of channels:
LA_RUN_DIR=/tmp/kit-run QA_KIT_CHANNELS=canvas,lti-generic QA_TASK=K1 node tests/acceptance/run-api.mjs
```

### Result Artifacts Written to `$LA_RUN_DIR` (or `.tmp/kit-run`)

- `kit-run-meta.json` — Run identity (`runId`, `startedAt`, `channels`).
- `kit-executed-cases.jsonl` — Append-only chronological ledger of every `PASS`, `FAIL`, and `SKIP` case record with `runId` and `timestamp`.
- `k1-kit-summary.md` & `k1-kit-summary.json` — Human-readable Markdown table and structured JSON report emitted by `K-HYG` (`writeKitRunSummaryArtifacts`) before the final pass-rule assertion.
- `evidence/*.json` — Redacted evidence artifacts scanned recursively by `K-HYG` (`H1`).

---

## 4. Failure Output Examples (`evaluateChannelPassRule` & `K-HYG`)

- **Missing case**:
  `missing case: canvas:K1-LAUNCH:L1`
- **Extra (unregistered or N/A) case**:
  `extra case: canvas:K1-LAUNCH:L999`
- **Failed case**:
  `failed case: canvas:K1-LAUNCH:L1 (expected 200 to equal 302)`
- **Duplicate or retried case (`retries: 0` rule)**:
  `duplicate/retried case: canvas:K1-LAUNCH:L1 (recorded 2 times: FAIL -> PASS)`
- **Skipped case (`skipped === 0` rule)**:
  `skipped case: canvas:K1-DL:D1 (skipped in test)`
- **Stale run record**:
  `stale run record: canvas:K1-LAUNCH:L1 (record runId="run-old" !== active runId="run-current")`
- **Missing negative capability guard (`C2`)**:
  `missing C2 guard for false/empty capability "deployments.multiple" (blackboard:K1-CAP:C2:deployments.multiple)`
- **Illegal `N/A` case**:
  `illegal N/A: canvas:K1-REG:R-ILLEGAL-NA is marked NA but capability "registration.dynamic" is true/non-empty`
  `illegal N/A: blackboard:K1-REG:R3 requires passing negative guard "blackboard:K1-CAP:C2:registration.dynamic"`
- **`coveredBy` missing / stale / pending / failed wave evidence**:
  `missing wave evidence: capability "siteApi.token" on "moodle" requires wave-evidence.json (wave evidence file not found at .../wave-evidence.json)`
  `stale wave evidence: manifest waveId "wave-B1-old" !== current wave "wave-B4" for capability "siteApi.token"`
  `pending wave suite: capability "siteApi.token" on "moodle" coveredBy "T8" is PENDING`
  `failed wave suite: capability "siteApi.token" on "moodle" coveredBy "T8" has outcome "FAIL"`
- **`K-HYG` missing inputs or secret leak**:
  `missingInputs: ["service:lti-service", "sim:records", "artifact:redacted-evidence"]`
  `hits: [{ "source": "artifact:evidence/deep/redacted.json", "secretPrefix": "super-..." }]`
