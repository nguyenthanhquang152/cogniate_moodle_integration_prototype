# LTI 1.3 Channel Certification Kit (`tests/ltiaas/kit`)

This kit certifies every LMS channel against the 6 capability ports (`LA-ADR-01` §D3–§D6, `LA-ADR-02` §D1–§D8) and the pass rules of `tests/ltiaas/TEST-STRATEGY.md` §2.2–§2.6.

---

## 1. Directory Layout & Suite Order

- `channels/<id>.json` — Declarative channel capability, expectation, simulator trait, and source-citation fixtures (`moodle`, `canvas`, `blackboard`, `lti-generic`, `brightspace`, plus any newly onboarded channel).
- `lib/fixtures.ts` — Open-world fixture loader (`listChannelFixtureIds`, `loadAllChannelFixtures`, `resolveSelectedChannelIds`), TB-12 source citation auditor (`auditFixtureSources`), expected case catalog (`computeExpectedCaseList`, `computeExpectedGlobalCaseList`), bilateral capability verifier (`verifyBilateralCapabilities`), operator grant CLI arg builder (`buildOperatorGrantCliArgs`), and pass-rule engine (`evaluateChannelPassRule`).
- `lib/runtime.ts` — Run ledger (`initKitRunLedger`, `runKitCase`, `readAllExecutedCases`, `evaluateKitRunPassRule`, `writeKitRunSummaryArtifacts`), wave evidence loader (`loadWaveEvidenceFromRun`), thin wrappers over the frozen M1 helpers (`setupChannelBinding`, `launchOnChannel`, `openPlayOnChannel`, `openPickerOnChannel`, `liveKitCaseIo`), and recursive secret scanner (`scanAllLogsAndArtifactsForSecrets`).
- `lib/cases.ts` — Case bodies with injected I/O: `runFamilyGuardCase` (L4), `runPlatformStorageCase` (L10), `runSingleSelectRefusal` (D3 single select), `followPickerHandoff` (every picker case), `waitForLearnerSync` and `waitForThrottledDispatch` (A3). The suites call them with `liveKitCaseIo()` (bound to the frozen M1 helpers). `kit.k0.test.ts` calls the same functions with contract-shaped host fakes, so the selectors, request shapes and final comparisons are tested without Docker.
- `suites/` — The 6 per-port simulator suites plus `K-HYG`, ordered deterministically by `KitSuiteSequencer` in `vitest.config.mts` so `k-hyg.k1sim.test.ts` always runs strictly last:
  1. `suites/k1-reg.k1sim.test.ts` (`K1-REG`: `R1`, `R1-DEPLOYMENTS`, `R2`, `R3`, `R4`, `R5`, `R6`, `R-CHECK`)
  2. `suites/k1-cap.k1sim.test.ts` (`K1-CAP`: `C1`, `C2:<capability>`, `C3`)
  3. `suites/k1-launch.k1sim.test.ts` (`K1-LAUNCH`: `L1`..`L10`, plus once-per-run `GLOBAL:K1-LAUNCH:L-FAULTS`)
  4. `suites/k1-dl.k1sim.test.ts` (`K1-DL`: `D1`..`D8`, `D5-UNGRADED`)
  5. `suites/k1-ags.k1sim.test.ts` (`K1-AGS`: `A1`..`A6`)
  6. `suites/k1-nrps.k1sim.test.ts` (`K1-NRPS`: `N1`, plus once-per-run `GLOBAL:K1-NRPS:N2`)
  7. `suites/k-hyg.k1sim.test.ts` (`K-HYG`: `GLOBAL:K-HYG:H1`, per-channel `H2`, and `GLOBAL:K-HYG:SUMMARY`)
- `kit.k0.test.ts` — Host-only K0 self-test suite (`LA_LEVEL=k0`, 0 Docker calls). It also runs the case bodies of `lib/cases.ts` and the L7 verdict against contract-shaped fakes (a check-14 fake from the LA-ADR-01 D6 table, a storage login/launch/check fake from lti-service-api-delta §2.1–§2.2, picker pages, result-row sequences) with positive controls and wrong-product mutants.

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
- `expect.guardedFamilies`: The signed product families that the channel guards, with the guard level (`LA-ADR-01` §D2 `guardedFamilies`, §D6): `[]` when the channel guards no family, else entries `{ "family": "<lower case>", "level": "launch" | "registration" }`. A new channel uses `registration` (`launch` is only for the Canvas and Blackboard channels, load check 8). K1-LAUNCH L4 selects its probes and derives the expected outcome from these declarations of all fixtures; `auditFixtureSources` requires the array and its citation.
- `sim`: Simulator URLs, endpoints, `family`, `deployments`, `tokenAudience`, `tokenAudienceKind` (`"string"`, `"array"`, or `"fixed"`), `dlDataMode` (`"claim"` or `"query"`), `dlRequiresSub`, `privacyFloor` (`"none"` or `"allowlist"`), and `platformStorage` (`{ "frameName": "...", "allowedOrigin": "..." }` when the profile trait `platformStorage` is not `null`, `LA-ADR-05` §D1 rule 1a; `frameName` is the target that L10 sends as `lti_storage_target`; else `null`).
- `sources`: Map of field paths (`id`, `simProvider`, `simProfile`, `capabilities.<key>` for all 17 keys, `coveredBy`, `notBuilt`, `expect.legacyFlags`, `expect.toolConfigurationKeys`, `expect.guardedFamilies`, `sim`) to non-empty citations (`TB-12`).

### Step 3: Supply Current-Wave Evidence (`wave-evidence.json`) When `coveredBy` Is Non-Empty

If `<id>.json` (or `moodle.json` in a full run) declares any capability in `coveredBy`, the kit requires real disk evidence from the current wave (`AC-LA-E7-06-05`). Set `LA_WAVE_ID=<wave-id>` and write `wave-evidence.json` in `$LA_RUN_DIR/wave-evidence.json` (or point `LA_WAVE_EVIDENCE_FILE` to its path):

```json
{
  "waveId": "wave-B4",
  "suites": {
    "T3b": {
      "outcome": "PASS",
      "waveId": "wave-B4",
      "artifactPath": "artifacts/T3b/summary.json"
    },
    "T7": {
      "outcome": "PASS",
      "waveId": "wave-B4",
      "artifactPath": "artifacts/T7/summary.json"
    },
    "T8": {
      "outcome": "PASS",
      "waveId": "wave-B4",
      "artifactPath": "artifacts/T8/summary.json"
    }
  }
}
```

#### Per-Suite Artifact File Schema, Producer & Containment Rules (`verifyWaveSuiteArtifact`)

- **Producer**: During a wave run, the wave runner (or `writeWaveEvidenceToRun(manifest, runDir)`) writes one JSON summary file per executed live-LMS suite (`T3b`, `T7`, `T8`) inside `$LA_RUN_DIR` (for example `$LA_RUN_DIR/artifacts/T3b/summary.json`, `$LA_RUN_DIR/artifacts/T7/summary.json`, `$LA_RUN_DIR/artifacts/T8/summary.json`) and records their paths in `$LA_RUN_DIR/wave-evidence.json`.
- **Required Per-Suite Artifact JSON Schema**:
  ```json
  {
    "suite": "T8",
    "waveId": "wave-B4",
    "outcome": "PASS"
  }
  ```
- **Containment & Suite-Identity Verification Rules**:
  1. `currentWaveId` is derived **only** from explicit run input or `process.env.LA_WAVE_ID` (never from `waveEvidence.waveId`).
  2. Each `artifactPath` must resolve **inside** `$LA_RUN_DIR` (paths resolving outside `$LA_RUN_DIR` are rejected).
  3. Each referenced artifact file must exist on disk, be a non-empty regular JSON file, and satisfy all three content checks:
     - `typeof parsed.suite === "string" && parsed.suite === suiteName` (an anonymous file without `"suite"` or a `"T3b"` file reused for `"T7"` / `"T8"` is rejected).
     - `parsed.waveId === currentWaveId` (stale wave artifacts are rejected).
     - `parsed.outcome === "PASS"` (failed or pending suite artifacts are rejected).

The pass rule fails closed if `wave-evidence.json` is missing, if `currentWaveId` is unset, if `waveId` does not match `LA_WAVE_ID`, or if any suite named in `coveredBy` is missing, `"PENDING"`, `"FAIL"`, or fails `verifyWaveSuiteArtifact`.

---

## 3. Commands & Result Artifact Paths

### Host-Only K0 Self-Tests (0 Docker Calls)

```sh
LA_LEVEL=k0 npx --no-install vitest run --reporter=verbose --config tests/ltiaas/kit/vitest.config.mts
```

### Full K1-SIM Run (During a Booked Docker Window)

Run these commands from the repository root (`/repo` in the `e2e` container). `tests/acceptance/run-api.mjs` gives Vitest the config path `ltiaas/kit/vitest.config.mts`, relative to its working directory, so the runner must start in `tests/`: `npm --prefix tests run acceptance:api` does this. `node tests/acceptance/run-api.mjs` from the root does not: it resolves `<root>/ltiaas/kit/vitest.config.mts`, which does not exist (host probe with a fake Vitest, `docs/reviews/LA-E7-06/qa.md` Round 5).

```sh
# Run every discovered channel fixture (default selection; includes a newly dropped <id>.json):
LA_RUN_DIR=/tmp/kit-run LA_WAVE_ID=wave-B4 QA_TASK=K1 npm --prefix tests run acceptance:api

# The same, with the selection written out:
LA_RUN_DIR=/tmp/kit-run LA_WAVE_ID=wave-B4 QA_KIT_CHANNELS=all QA_TASK=K1 npm --prefix tests run acceptance:api

# Run a single channel or subset of channels:
LA_RUN_DIR=/tmp/kit-run QA_KIT_CHANNELS=canvas,lti-generic QA_TASK=K1 npm --prefix tests run acceptance:api

# Equivalent form: enter tests/ first
cd tests && LA_RUN_DIR=/tmp/kit-run QA_KIT_CHANNELS=canvas QA_TASK=K1 node acceptance/run-api.mjs
```

### Result Artifacts Written to `$LA_RUN_DIR` (or `tests/.tmp/kit-run` with the commands above)

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

---

## 5. Complete Design-Case-to-Assertion Map (`TEST-STRATEGY.md` §2.3–§2.8)

| Suite File | Case Code | Scope | Contract & Safety Assertions |
| --- | --- | --- | --- |
| `suites/k1-cap.k1sim.test.ts` | `C1` | Per channel | Bilateral equality (`verifyBilateralCapabilities`, AC-LA-E7-06-04) of `fixture.capabilities` (17 keys) with two API operands: the registry entry of `GET /app-api/lms-providers` (exactly one entry with `lms` = `channel` = the fixture id; channel-level `channelCapabilities`, the public projection of the manifest, cogniate-app-api-delta §2) and the connection DTO (`channelCapabilities`, `channel`). Both directions: no missing key, no extra key, equal values. The six legacy flags of both equal `expect.legacyFlags`; the tool-configuration rows (an array) give the ordered keys of `expect.toolConfigurationKeys`. The kit has no separate manifest operand (no fixture self-comparison). |
| `suites/k1-cap.k1sim.test.ts` | `C2:<cap>` | Per false/empty guarded capability | Calls the guarded route (`runCapabilityGuardProbe`) and verifies HTTP status (`422`/`409`/`403`), error code (`CAPABILITY_NOT_SUPPORTED` / `PLACEMENT_NOT_GRADED`), `noServiceCalls(cursor)`, and zero `outbound_request` log events in `lti-service` and `cogniate-app`. |
| `suites/k1-cap.k1sim.test.ts` | `C3` | Per channel | `DELETE /app-api/connections/:id` returns `204`, connection `status` becomes `'disabled'`, launch on disconnected connection refuses with `403 PLATFORM_NOT_ACTIVE` (dedicated) or `403 DEPLOYMENT_NOT_ACTIVE` (shared), while a second connection on the same channel continues launching (`303`). |
| `suites/k1-reg.k1sim.test.ts` | `R1` | Per channel | Manual connection + platform binding with required fields; `GET .../canvas-configuration?jwk=url\|inline` when `setup.artifacts` is non-empty; strict body on `PUT /app-api/connections/:id/platform` refuses unknown/missing fields with `422 INVALID_PLATFORM_VALUES`; `POST /app-api/connections` refuses IP literal, localhost, and own hosts with `422 INVALID_SITE_URL`. |
| `suites/k1-reg.k1sim.test.ts` | `R1-DEPLOYMENTS` | Channels with `deployments.multiple: true` | `POST /app-api/connections/:id/deployments` with `add_deployment` `grantCode` returns `200` with second deployment in `platform.deploymentIds`, and launch on second deployment returns `303`. |
| `suites/k1-reg.k1sim.test.ts` | `R2` | Per channel | On `operatorGrant` channels: bogus `grantCode` returns `403 GRANT_INVALID`, mismatched `deploymentId` returns `422 GRANT_MISMATCH` (`details.fields` contains `'deploymentId'`), and matching `grantCode` returns `200` (`status: 'registered'`). On `self` channels: `app:grant issue` exits non-zero. |
| `suites/k1-reg.k1sim.test.ts` | `R3` | Channels with `registration.dynamic: true` | Full DR handshake via `connection.registrationUrl` (`GET /lti/register/cogniate` -> `GET /tool/register` -> `POST /tool/register`): path-prefix issuer, `authorization_server` stored as `tokenAudience`, simulator `registration` record `scopes` contains the 4 AGS scopes, alternate DR token format (`opaque-bearer` vs `moodle-scope-jwt`), refusal (`400 PLATFORM_CONFIGURATION_INVALID`) when `LtiDeepLinkingRequest` or required AGS scope is missing, and DR family guard (`400 PROVIDER_PROFILE_MISMATCH`). |
| `suites/k1-reg.k1sim.test.ts` | `R4` | Per channel | `POST /api/platforms` with a reserved issuer is refused with `400` (`ISSUER_RESERVED` / `PLATFORM_URL_NOT_IN_PROFILE`). |
| `suites/k1-reg.k1sim.test.ts` | `R5` | Per channel | `GET /app-api/connections/:id/tool-configuration` returns row keys matching `fixture.expect.toolConfigurationKeys` in exact order. |
| `suites/k1-reg.k1sim.test.ts` | `R6` | Per channel | Origin binding `I-SELF` negative (`AP-07-11`): off-origin DR via `/tool/register` stages connection (`status: 'pending'`, `bindingAuthority: 'operatorGrant'`), unapproved launch refuses with `403 PLATFORM_NOT_ACTIVE` and `noServiceCalls`, `--accept-staged` grant activates connection (`200 registered`); direct `GET /lti/register/cogniate` + `GET /api/registrations/:id` (`endpointsOnIssuerOrigin: false`) + `POST /api/registrations/:id/complete` (`active: false`); active `POST /api/platforms` refuses off-origin (`400 PLATFORM_URL_NOT_ON_ISSUER_ORIGIN`) and cross-profile host (`400 PLATFORM_URL_NOT_IN_PROFILE`). |
| `suites/k1-reg.k1sim.test.ts` | `R-CHECK` | Channels with `setup.connectionCheck: true` | `POST /app-api/connections/:id/check` returns `200` with `result: 'ok'` (`details.jwks.ok: true`, `details.token.ok: true`) on valid credentials and `result: 'failed'` (`details.token.ok: false`) when simulator returns `invalid_client`. |
| `suites/k1-launch.k1sim.test.ts` | `L1` | Per channel | Resource-link launch returns `303` with `ltik`; `GET /api/idtoken` returns `ltiVersion: '1.3.0'`, `user.id`, `user.roles`, `platform.{id,clientId,deploymentId,productFamilyCode,siteUrl,profile}`, `launch.{type,target,context,resourceLink}`, `services.serviceKey`, and `platform.serviceUrl` / `services.assignmentAndGrades.lineItemId` on split-origin channels. |
| `suites/k1-launch.k1sim.test.ts` | `L2` | Per channel | Profile-dependent faults `unknown-key` (`INVALID_SIGNATURE`) and `wrong-issuer` (`INVALID_ISSUER_OR_AUDIENCE`) refused with an error page, status `400` or `401` (`launchRefused`, security.md §2.2), with `noServiceCalls`; rotated signing key (`rotatedKey: true`) succeeds (`303`) via JWKS refresh. |
| `suites/k1-launch.k1sim.test.ts` | `L3` | Per channel | Unregistered deployment refused (`UNKNOWN_DEPLOYMENT`) with `noServiceCalls`; deactivated deployment (`PATCH .../deployments/:id { active: false }`) refused with `403 DEPLOYMENT_NOT_ACTIVE` and `noServiceCalls`. |
| `suites/k1-launch.k1sim.test.ts` | `L4` | Per channel | `runFamilyGuardCase` (lib/cases.ts). `selectFamilyGuardProbes` reads `expect.guardedFamilies` of all fixtures and fixes the probes and outcomes before any launch: (1) a family that another channel guards at the `launch` level (required; an explicit error when no fixture declares one) → `400` page `PROVIDER_PROFILE_MISMATCH`, no `Location`; (2) a family that another channel guards at the `registration` level, when one exists → `400 PROVIDER_PROFILE_MISMATCH` on a `MANUAL_SELF_LEGACY_CHANNELS` platform (`binding.authority.manual === 'self'`, load check 6), else `303` and an LTI service log `family_guard_mismatch` with this `platform_id` and the family; (3) a family that no fixture guards → `303` and no such log line. Shipped selection: Moodle `canvas`/`desire2learn` refused, `generic` passes; Canvas `blackboardlearn` refused, `desire2learn` passes with the log, `moodle` passes; Blackboard and `lti-generic` `canvas` refused, `desire2learn` with the log, `moodle` passes; Brightspace `canvas` refused, `moodle` passes (no other registration-level family exists). |
| `suites/k1-launch.k1sim.test.ts` | `L5` | Per channel | Claim minimization policy: on `allowlist` channels, personal claims (`name`, `given_name`, `family_name`, `email`), `lis`, and `custom` are stripped from raw and normalized `/api/idtoken` and `launch_claims_minimized` is logged; on `full` channels, `user.name` and `launch.custom` are preserved. |
| `suites/k1-launch.k1sim.test.ts` | `L6` | Per channel | `document_target: 'iframe'` redirects to `/play/:playId/embedded` (`200`, contains `<script` iff `launch.topLevelContinue === true`); `document_target: 'window'` redirects to `/play/:playId` (never `/embedded`). |
| `suites/k1-launch.k1sim.test.ts` | `L7` | Per channel | Contextless launch (`AP-05-08..11`): two learners launch without the `context` claim on one launch resource link. The only final comparison is `verifyContextlessSharedPlacement(collectContextlessPlacementObservation(...))`: each learner has exactly one result row; both rows name the same placement `activity.resourceLinkId` (the internal `rl_…` id, never compared with the launch `resource_link.id`); the publication has one placement (`stats.activities === 1`, read before the no-AGS launches); each row has a `sent` sync; each learner's simulator score calls go to `<launch line item path>/scores` on the line item host (`services.assignmentAndGrades.lineItemId` of that learner's `/api/idtoken`). A contextless launch without AGS has no `serviceKey` and records `'No gradebook column: the activity has no AGS line item.'` with `noServiceCalls`; a launch without `sub` gives the `MISSING_CLAIM` page (status `400` or `401`). |
| `suites/k1-launch.k1sim.test.ts` | `L8` | Per channel | Learner launch creates graded play (`GET /app-api/play/:id/status` -> `preview: false`); instructor launch creates preview play (`preview: true`); Deep Linking opens picker (`200`) for instructor and returns `403 ROLE_NOT_ALLOWED` for learner. |
| `suites/k1-launch.k1sim.test.ts` | `L9` | Per channel | Two distinct libraries (`bA.library !== bB.library`) on the same channel: Library A picker lists `pubA` and excludes `pubB`; launching `pubB` on Connection A returns `404 PUBLICATION_NOT_IN_CONNECTION`; Library A `GET /app-api/publications/:pubB/results` returns `404 NOT_FOUND`. |
| `suites/k1-launch.k1sim.test.ts` | `L10` | Per channel | `runPlatformStorageCase` (lib/cases.ts; AP-05-01, -02, -04, -05, -07; lti-service-api-delta §2.1, §2.2). Every channel: a login without `lti_storage_target` answers `302` with the state cookie; a state cookie of another login gives `400` or `401`; launch-path refusals (`STATE_COOKIE_MISSING`, `INVALID_SIGNATURE`) accept status `400` or `401` (security.md §2.2), storage-check refusals are `400` (lti-service-api-delta §2.2). `sim.platformStorage` `null`: a login with a target also answers `302`, and a launch without the cookie gives the `STATE_COOKIE_MISSING` page. `sim.platformStorage` set: the login with the target answers `200` with the state cookie; the auth URL is the value of the page's one `<script type="application/json">` block on the same endpoint as the `302` `Location` (JSON-parsed, so `\u0026` is decoded); the launch without the cookie answers the `200` storage-check page; the check is the member `check` of its one `<script id="lti-storage-data" type="application/json">` block (ruling A2 BD-A2-112; no other source), and that block never carries the state. `POST /lti/launch/cogniate/storage-check` sends the form fields `check` and `value` (the state) with the LTI `Origin`: a foreign `Origin` gives `INVALID_STATE` and leaves the check unused, then the right value gives `303` with an ltik; a second use gives `INVALID_STATE` (log `storage_check_unknown_used_or_expired`); a wrong value on a fresh check gives `INVALID_STATE` (log `storage_mismatch`); an empty value gives `STATE_COOKIE_MISSING` with the storage help text; an unknown check gives `INVALID_STATE` (log `storage_check_unknown_used_or_expired`); a bad signature on the storage path gives `INVALID_SIGNATURE`, not the storage-check page. |
| `suites/k1-launch.k1sim.test.ts` | `GLOBAL:K1-LAUNCH:L-FAULTS` | Once per run (`selectProtocolControlFixture` -> `lti-generic`) | Control launch succeeds (`303`), then all 12 `PROTOCOL_SECURITY_FAULTS` are refused with the exact error code on an error page with status `400` or `401` and no redirect (`launchRefused`; security.md §2.2, as the frozen M1 `20-protocol.test.ts`), and `noServiceCalls`. |
| `suites/k1-dl.k1sim.test.ts` | `D1` | Per channel | Picker selection posts verified `LtiDeepLinkingResponse` JWT (`signatureOk: true`, `iss`, `aud`, `deployment_id`, `nonce`, `sub` iff `dlRequiresSub`, `data` claim vs return URL query by `dlDataMode`, `window.targetName` iff `launch.windowHint`). |
| `suites/k1-dl.k1sim.test.ts` | `D2` | Per channel | Single graded Deep Linking item carries `type: 'ltiResourceLink'` and `lineItem.scoreMaximum === 100`. |
| `suites/k1-dl.k1sim.test.ts` | `D3` | Per channel | The picker POST uses the form field `publicationId`, repeated (`buildPickerSelectionForm`; cogniate-app-api.md §6, LA-ADR-05 D3b), in the picker list order. `content.multiple === true` with `accept_multiple: true`: checkboxes, `200`, one JWT with 3 items whose `url` `resource` values equal the posted order. `content.multiple === false` (`runSingleSelectRefusal`, ruling A1 BD-A1-120): radios only; two ids give the `400` page `PUBLICATION_NOT_AVAILABLE` with no JWT and no Deep Linking return (no simulator `deep-link` record); the picker stays unused, so one id on the same picker then gives exactly that item. `POST /api/deeplinking` (`{ contentItems }`) refuses >1 items when `accept_multiple === false` and >20 items (`400 INVALID_CONTENT_ITEM`). |
| `suites/k1-dl.k1sim.test.ts` | `D4` | Per channel | `POST /tool/picker/:pickerId/cancel` with foreign `Origin` returns `403 ORIGIN_NOT_ALLOWED` without consuming the picker session; valid `Origin` returns signed JWT with `content_items: []`. |
| `suites/k1-dl.k1sim.test.ts` | `D5` | Per channel | With `accept_lineitem: false`: `POST /api/deeplinking` refuses item with `lineItem` (`400 INVALID_CONTENT_ITEM`) and accepts item without `lineItem` (`200 { message, target }`); app picker returns `403 PLACEMENT_NOT_GRADED` with `noServiceCalls` when `content.ungraded === false`. |
| `suites/k1-dl.k1sim.test.ts` | `D5-UNGRADED` | Channels with `content.ungraded: true` (built) | Picker succeeds (`200`) with `accept_lineitem: false` and emits `ltiResourceLink` without `lineItem`. |
| `suites/k1-dl.k1sim.test.ts` | `D6` | Per channel | `GET /api/idtoken` includes `launch.deepLinkingSettings.acceptLineItem` and `acceptMediaTypes` when sent and omits them when absent. |
| `suites/k1-dl.k1sim.test.ts` | `D7` | Per channel | Learner Deep Linking launch is refused at picker (`403`) with `noServiceCalls`. |
| `suites/k1-dl.k1sim.test.ts` | `D8` | Per channel | Two consecutive Deep Linking responses carry distinct `nonce` claims. |
| `suites/k1-ags.k1sim.test.ts` | `A1` | Per channel | Cold-cache score sync triggers token request whose verified assertion matches `clientId`, `tokenAudience` (`string`, `array`, or `fixed`), and single scope in `registration.scopes`; when `records.readBack === true`, `POST /app-api/publications/:id/results/refresh` returns `200`. |
| `suites/k1-ags.k1sim.test.ts` | `A2` | Per channel | `POST /api/lineitems/:lineItemId/scores` forwards `application/vnd.ims.lis.v1.score+json` with ADR-010 fields (`userId`, `scoreGiven`, `scoreMaximum`, `activityProgress`, `gradingProgress`, `scoringUserId`, `submission.submittedAt`, `https://` extension key kept, non-URL key dropped). |
| `suites/k1-ags.k1sim.test.ts` | `A3` | Per channel | Outbox status mapping: `204 -> sent` (one simulator score call), `400/404/422 -> failed`, `409 -> conflict` with `'has a grade with a newer time'`. `503`: `waitForLearnerSync` waits until the learner's sync shows a tried send (`tries >= 1`; a new row is also `pending` with `tries 0`), then the sync is `pending` with `tries === 1` (next try 5 s later). `429 Retry-After: 60`: `waitForThrottledDispatch` waits for the learner's simulator score call and a `dispatch_throttled` app log line, then the sync is `pending` with `tries === 0` and there is exactly one score call. |
| `suites/k1-ags.k1sim.test.ts` | `A4` | Per channel | Instructor preview commit creates no score syncs (`scoreSyncs.length === 0`) and makes zero simulator calls (`noServiceCalls`). |
| `suites/k1-ags.k1sim.test.ts` | `A5` | Per channel | Disconnecting connection (`DELETE /app-api/connections/:id -> 204`) before grade commit marks sync `failed` with `CONNECTION_DISABLED` and makes zero simulator calls (`noServiceCalls`). |
| `suites/k1-ags.k1sim.test.ts` | `A6` | Per channel | Off-origin URLs on `POST /api/lineitems/:id/scores`, `GET /api/lineitems/:id/scores`, and `GET /api/lineitems?url=...` are refused with `400` and `noServiceCalls`. |
| `suites/k1-nrps.k1sim.test.ts` | `N1` | Per channel | Cold-cache grade sync token requests never ask for NRPS scope; `fixture.capabilities['registration.scopes']`, `canvas-configuration` `scopes`, and DR `registration` scopes contain the 4 AGS scopes only and never NRPS. |
| `suites/k1-nrps.k1sim.test.ts` | `GLOBAL:K1-NRPS:N2` | Once per run (`selectProtocolControlFixture` -> `lti-generic`) | `GET /api/memberships` with NRPS 2.0 returns members with `userId` and `roles` and without personal fields (`name`, `email`, `givenName`, `familyName`); `service_versions: ['1.0']` is refused or marked unavailable; upstream `429 Retry-After: 45` is propagated as `429` with `45`. |
| `suites/k-hyg.k1sim.test.ts` | `GLOBAL:K-HYG:H1`, `H2`, `SUMMARY` | Strictly last (`KitSuiteSequencer`) | `H1` scans `lti-service`, `cogniate-app`, `lms-sim` logs, `/__sim/records`, and recursive `$LA_RUN_DIR` artifacts against `/__sim/secrets` and captured secrets (`missingInputs: []`, `hits: []`); `H2` runs `evaluateChannelPassRule` per channel; `SUMMARY` writes `k1-kit-summary.{md,json}` and asserts `evaluateKitRunPassRule` (`ok: true`, `totalFailed: 0`, `totalSkipped: 0`). |

