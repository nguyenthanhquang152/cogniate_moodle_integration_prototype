Verdict: PASS
Round: 6

# LA-E0-03 Golden outputs G1–G4 & LD-9 Expected-Delta Records: QA (Round 6 / Closeout Review Fix Round 1 — Golden v2 with Full Moodle Segment)

Tester: lead QA (Orca task `task_45f371c21b5d`, dispatch `ctx_0533e8383636`; Round 5 in `task_67cd3791548e`; Round 4 in `task_632c6557b3a6`; Round 3 in `task_9118512629f1`; Slots 2 & 3A in `task_0163f40d972e`), 2026-10-24. Spec: `docs/architecture/ltiaas/tasks/LA-E0-03.md`. Design: `tests/ltiaas/TEST-STRATEGY.md` §4.5–§4.7, `tests/ltiaas/GATE-RUN-PLAN.md` §2–§3. Reviews addressed: `docs/reviews/LA-E0-03/reviewer-a.md` (`A-LA-E0-03-01`) and `docs/reviews/LA-E0-03/reviewer-b.md` (`B-LA-E0-03-01`).

## Round 6 Summary (Closeout Review Fix Round 1 — Golden v2 with Full Moodle Segment on `baseline-3` `78971b03` and `4f10c5fd`)

### 1. Resolution of `A-LA-E0-03-01` & `B-LA-E0-03-01` (BLOCKER)

- **Golden v2 (`tests/ltiaas/golden/capture.golden.ts` & `tests/ltiaas/golden/run-golden.mjs`):**
  - Added the full Moodle-shaped standard flow (`moodle-sim` on `https://moodle.sim.test` from `LA-E7-02` / `LA-E7-05`) alongside `blackboard` and `canvas`, using only public surfaces and frozen M1 helpers (no product source read or imported):
    - **`G1` Moodle connection DTOs (`5` states):** `G1.connections["moodle-dynamic-pending"]`, `G1.connections["moodle-manual-pending"]`, `G1.connections["moodle-registered"]` (`Golden Moodle` on `https://moodle.sim.test`, `clientId: "golden-moodle-1"`, `deploymentId: "1"`), `G1.connections["moodle-connected"]`, and `G1.connections["moodle-disabled"]` (`Golden Moodle disabled` on library `B`, `clientId: "golden-moodle-2"`, `deploymentId: "2"`, after `DELETE /app-api/connections/:id`).
    - **`G2.moodle` (`oidc` + `records`):** OIDC login redirect parameters (`deep-linking`, `learner launch` to `https://moodle.sim.test/mod/lti/auth.php`) and `16` `/__sim/records` entries for `provider: "moodle-sim"` (`auth`, `jwks`, `deep-link`, `token`, `score` across `200`, `409`, `400`, `422`, and `503` answers).
    - **`G3.moodle` (`publications`, `deepLinkReturn`, `resend`, `connection`, `publicationList`):** all `6` publications (`A-sent`, `B-conflict`, `C-failed`, `C2-resend`, `D-superseded`, `E-pending`) with `GET /app-api/publications/:id/results` rows and `scoreSyncs` in all 5 required statuses (`sent`, `conflict`, `failed`, `superseded`, `pending`), Deep Linking return (`{ status: 200 }`), Resend answers (`failed` -> `200`, `sent` -> `409`, `superseded` -> `409`), `connection` DTO, and `publicationList`.
    - **`G4.moodle` (`pages`, `players`, `learnerLabels`):** all `13` channel tool pages (`picker`, `PUBLICATION_NOT_AVAILABLE`, `PICKER_USED`, `HANDOFF_USED`, `ROLE_NOT_ALLOWED`, `deep-link-with-resource-link`, `PUBLICATION_NOT_IN_CONNECTION`, `UNKNOWN_DEPLOYMENT`, `STATE_COOKIE_MISSING`, `INVALID_STATE`, `PROVIDER_PROFILE_MISMATCH`, `SERVICE_ORIGIN_MISMATCH`, `PLATFORM_NOT_ACTIVE-or-refusal`), `7` player entries (`shell`, `status-before`, `status-sent`, `status-conflict`, `status-failed`, `status-superseded-attempt`, `status-pending`), and `learnerLabels`.
    - **U1 seed (`u1-seed.json`, mode `0600`):** `connections.{blackboard,canvas,moodle}`, `publications.{blackboard,canvas,moodle}`, and `rows` across all 3 channels and all 5 statuses (`15` rows: `{blackboard,canvas,moodle}-{sent,conflict,failed,superseded,pending}`).
  - **100% Golden v1 Path & `<id:n>` Preservation:** The Moodle standard flow runs after the v1 sections (`G1.connectionList`, `G1.lmsProvidersAfter`, `G1.providersAfter`, `blackboard`, `canvas`, `G4.common`). Because `normalizeFile` assigns `<id:n>` in sorted-key order, `diff(v1, v2)` on `G1`–`G4` reports **only** the added keys (`G1.connections.moodle-{connected,disabled,registered}`, `G2.moodle`, `G3.moodle`, `G4.moodle`) and **zero changes** on any v1 path.
  - **Pre-`LA-E7-03` Baseline Overlay in `run-golden.mjs`:** On `baseline-3` (`78971b03`, which predates `LA-E7-03`), `run-golden.mjs` records the unmodified `acceptance` `ltiHealth` (`/healthz` `outbound_allowlist`) first, then adds `moodle.sim.test` to `SIM_LTI_HOSTS` in `infra/scripts/lib.sh` and `lms-sim` aliases in `infra/compose.yaml` in the temporary clone so `qa.crt` SANs and `lti-service` allow `moodle.sim.test`. On `4f10c5fd` (`lib.sh` already reads `tests/sim/hosts.json`), that branch is skipped.
- **Documentation & K0 Suite Updates (`tests/ltiaas/golden/README.md`, `tests/ltiaas/golden/golden.k0.test.mjs`):**
  - Updated `README.md` §2 (`u1-seed.json` claim) and §4 (`G1`–`G4` document layout table) for Golden v2 (`moodle`, `blackboard`, `canvas`).
  - Updated `golden.k0.test.mjs`: `AC-04 support` checks `G1.connections["moodle-{dynamic-pending,manual-pending,registered,connected,disabled}"]` and `G2`–`G4` across `['moodle', 'blackboard', 'canvas']` + `meta.goldenVersion === 2`; `AC-07 negative control` checks one `G1` field, one Moodle `G2` field (`moodle.oidc[0].endpoint`), and one Moodle `G3` field (`moodle.publications.A-sent.results[0].scoreSyncs[0].status`).

### 2. SIM Validation (`qalead-la-110`, `qalead-la-111`, `qalead-la-112`, `PUBLIC_PORT=9643`, `STACK_SUBNET=172.22.0.0/16`)

| Run | Project | Target SHA | Result | Capture / Secret Scan | Output |
| --- | --- | --- | --- | --- | --- |
| Baseline 1 (`g-base-v2-1`) | `qalead-la-110` | `78971b0300ab171029e8ce94dbba30db37b23dea` (`baseline-3` / `main`) | **PASS** (exit `0`) | `62 s` capture (`126 s` total), `184` secret values checked, `0` hits | `/Users/quangnguyen/cogniate-qa-runs/LA/LA-E0-03-r2/golden-base-1` (and port-normalized `:9643` -> `:9443` stored in `tests/ltiaas/golden/1b17261be97c4701b928fa9dc2fa74c6d23028f6/`) |
| Baseline 2 (`g-base-v2-2`) | `qalead-la-111` | `78971b0300ab171029e8ce94dbba30db37b23dea` (`baseline-3` / `main`) | **PASS** (exit `0`) | `60 s` capture (`123 s` total), `184` secret values checked, `0` hits | `/Users/quangnguyen/cogniate-qa-runs/LA/LA-E0-03-r2/golden-base-2` |
| Candidate (`cand-4f10c5fd`) | `qalead-la-112` | `4f10c5fd9ca4dd0a5f636b34d7454e0db7b6849c` (`quang/ltiaas-milestone` B/C merge) | **PASS** (exit `0`) | `64 s` capture (`116 s` total), `185` secret values checked, `0` hits | `/Users/quangnguyen/cogniate-qa-runs/LA/LA-E0-03-r2/golden-cand-4f10c5fd` (`-port9443`) |

- **`AC-LA-E0-03-04` Repeatability Proof (`qalead-la-110` vs `qalead-la-111` on `78971b03`):**
  - Command: `node tests/ltiaas/golden/compare.mjs --base /Users/quangnguyen/cogniate-qa-runs/LA/LA-E0-03-r2/golden-base-1 --candidate /Users/quangnguyen/cogniate-qa-runs/LA/LA-E0-03-r2/golden-base-2`
  - Output (`/Users/quangnguyen/cogniate-qa-runs/LA/LA-E0-03-r2/logs/compare-base1-vs-base2.txt`):
    ```text
    EQUAL: 0 differences (0 not explained), 0 expected changes missing; expected-delta files: none; 4 ms
    ```
- **Updated Acceptance Criteria (`AC-LA-E0-03-01`..`AC-LA-E0-03-09`, Round 6):**

| AC | Result | Evidence (Round 6 — Golden v2 with Moodle Segment) |
| --- | --- | --- |
| `AC-LA-E0-03-01` | **PASS** (`K1-SIM` + `K0`) | `G1.json` captures `default` and `acceptance` `providers`, `lmsProviders`, `ltiHealth`, `appHealth`, `toolConfiguration.{moodle,blackboard,canvas}`, `canvasConfiguration`, `connectionList`, and `connections` across `moodle` (`dynamic-pending`, `manual-pending`, `registered`, `connected`, `disabled`), `blackboard` (`pending`, `registered`, `connected`, `disabled`), and `canvas` (`pending`, `registered`, `connected`, `disabled`). |
| `AC-LA-E0-03-02` | **PASS** (`K1-SIM` + `K0`) | `G2.json` captures `oidc` (`deep-linking`, `learner launch`) and `/__sim/records` (`auth`, `jwks`, `deep-link`, `token`, `score`) for all three baseline channels: `moodle` (`16` records), `blackboard` (`17` records), and `canvas` (`18` records). `0` differences in `G2.{moodle,blackboard,canvas}` between `78971b03` and `4f10c5fd`. |
| `AC-LA-E0-03-03` | **PASS** (`K1-SIM` + `K0`) | `G3.json` and `G4.json` capture `publications` (`A-sent`, `B-conflict`, `C-failed`, `C2-resend`, `D-superseded`, `E-pending` with `results` and `scoreSyncs`), `deepLinkReturn`, `resend` (`failed`, `sent`, `superseded`), `connection`, `publicationList`, `13` tool pages, `7` player statuses, and `learnerLabels` for `moodle`, `blackboard`, and `canvas`, plus `G4.common.pages`. |
| `AC-LA-E0-03-04` | **PASS** (`K1-SIM`) | `g-base-v2-1` (`qalead-la-110`) vs `g-base-v2-2` (`qalead-la-111`) on `78971b0300ab171029e8ce94dbba30db37b23dea`: `EQUAL: 0 differences` (`4 ms`, `compare-base1-vs-base2.txt`). |
| `AC-LA-E0-03-05` | **PASS** (`K0` + `K1-SIM`) | `node --test tests/ltiaas/golden/golden.k0.test.mjs` (`12/12` pass in `447 ms`); `GOLDEN-SECRET-SCAN` `0` hits across `184` (`78971b03`) and `185` (`4f10c5fd`) secret values (`ids: { G1: 17, G2: 70, G3: 162, G4: 20 }`). |
| `AC-LA-E0-03-06` | **PASS** (`K0`) | `compare.mjs` compares Golden v2 `G-BASE` with itself in `23 ms` (`< 5,000 ms`) with no Docker. |
| `AC-LA-E0-03-07` | **PASS** (`K0`) | Negative controls in `golden.k0.test.mjs` fail with exit `1` and name the exact path and old/new values for `G1` (`acceptance.providers.profiles[1].issuer`), Moodle `G2` (`moodle.oidc[0].endpoint`), and Moodle `G3` (`moodle.publications.A-sent.results[0].scoreSyncs[0].status`). |
| `AC-LA-E0-03-08` | **PASS** (`K0` + `K1-SIM`) | `compare.mjs` on `4f10c5fd` against Golden v2 `G-BASE` with the Step 3 `LD-9` addendum r8 expected-delta dry run (`/Users/quangnguyen/cogniate-qa-runs/LA/LA-E0-03-r2/expected-r8-dryrun`): `EQUAL: 297 differences (0 not explained), 0 expected changes missing; 20 ms` (`compare-4f10c5fd-dryrun-r8.txt`). |
| `AC-LA-E0-03-09` | **PASS** (`K1-SIM`) | `G3.{moodle,blackboard,canvas}.publications.*.results` and `/Users/quangnguyen/cogniate-qa-runs/LA/LA-E0-03-r2/u1-seed-baseline3-v2.json` (`0600`) contain `connections.{blackboard,canvas,moodle}`, `publications.{blackboard,canvas,moodle}`, and `15` score-sync rows (`{blackboard,canvas,moodle}-{sent,conflict,failed,superseded,pending}`). |

### 3. Step 3 Audit: Exact `LA-IC` Expected-Delta Change List for `LD-9` Addendum r8

Per the task brief, QA did **not** edit any approved `tests/ltiaas/golden/expected/LA-IC-*.json` file in `la-qa`. Comparing `4f10c5fd` against Golden v2 `G-BASE` (`compare-4f10c5fd-before-r8.txt`) shows `297` total differences: `280` already explained by the existing 13 `LA-IC` files (`0` missing) plus **exactly `17` new Moodle differences** (`16` in `LA-IC-01` and `1` in `LA-IC-12`). Dry-run files with these exact additions are saved at `/Users/quangnguyen/cogniate-qa-runs/LA/LA-E0-03-r2/expected-r8-dryrun/{LA-IC-01,LA-IC-12}.json`.

1. **`tests/ltiaas/golden/expected/LA-IC-01.json` (`+16` exact-value entries, `259` -> `275` in `changes` and `ld9.goldenFields`):**
   - Let `<moodleChannelCapabilities>` be the existing Moodle `channelCapabilities` object already pinned at `connections.moodle-manual-pending.channelCapabilities` in `LA-IC-01.json`:
     `{"binding.authority":{"dynamic":"self","manual":"self"},"content.multiple":false,"content.ungraded":false,"deployments.multiple":false,"export.packages":["mbz"],"launch.topLevelContinue":false,"launch.windowHint":false,"platform.sharing":"exclusive","publish.createCourse":true,"records.readBack":true,"records.reporters":["lti-ags"],"registration.dynamic":true,"registration.scopes":["https://purl.imsglobal.org/spec/lti-ags/scope/lineitem","https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly","https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly","https://purl.imsglobal.org/spec/lti-ags/scope/score"],"setup.artifacts":[],"setup.connectionCheck":false,"site.serviceOrigin":false,"siteApi.token":true}`
   - Add `12` `G1` entries to `changes` (and prefixed with `G1.` to `ld9.goldenFields`):
     - `{ "file": "G1", "path": "connections.moodle-connected.bindingAuthority", "value": "self" }`
     - `{ "file": "G1", "path": "connections.moodle-connected.channel", "value": "moodle" }`
     - `{ "file": "G1", "path": "connections.moodle-connected.channelCapabilities", "value": <moodleChannelCapabilities> }`
     - `{ "file": "G1", "path": "connections.moodle-connected.channelName", "value": "Moodle" }`
     - `{ "file": "G1", "path": "connections.moodle-disabled.bindingAuthority", "value": "self" }`
     - `{ "file": "G1", "path": "connections.moodle-disabled.channel", "value": "moodle" }`
     - `{ "file": "G1", "path": "connections.moodle-disabled.channelCapabilities", "value": <moodleChannelCapabilities> }`
     - `{ "file": "G1", "path": "connections.moodle-disabled.channelName", "value": "Moodle" }`
     - `{ "file": "G1", "path": "connections.moodle-registered.bindingAuthority", "value": "self" }`
     - `{ "file": "G1", "path": "connections.moodle-registered.channel", "value": "moodle" }`
     - `{ "file": "G1", "path": "connections.moodle-registered.channelCapabilities", "value": <moodleChannelCapabilities> }`
     - `{ "file": "G1", "path": "connections.moodle-registered.channelName", "value": "Moodle" }`
   - Add `4` `G3` entries to `changes` (and prefixed with `G3.` to `ld9.goldenFields`):
     - `{ "file": "G3", "path": "moodle.connection.bindingAuthority", "value": "self" }`
     - `{ "file": "G3", "path": "moodle.connection.channel", "value": "moodle" }`
     - `{ "file": "G3", "path": "moodle.connection.channelCapabilities", "value": <moodleChannelCapabilities> }`
     - `{ "file": "G3", "path": "moodle.connection.channelName", "value": "Moodle" }`
2. **`tests/ltiaas/golden/expected/LA-IC-12.json` (`+1` exact-value entry, `2` -> `3` in `changes` and `ld9.goldenFields`):**
   - Add `1` `G4` entry to `changes` (and `"G4.moodle.pages.picker.text"` to `ld9.goldenFields`):
     - `{ "file": "G4", "path": "moodle.pages.picker.text", "value": "Select a Cogniate course Select a Cogniate course Moodle course: QA course Choose one course M1 course-<id:15> SCORM 1.2 Version 1 · Package: M1 QA M1 course-<id:16> SCORM 1.2 Version 1 · Package: M1 QA M1 course-<id:17> SCORM 1.2 Version 1 · Package: M1 QA M1 course-<id:18> SCORM 1.2 Version 1 · Package: M1 QA M1 course-<id:19> SCORM 1.2 Version 1 · Package: M1 QA M1 course-<id:20> SCORM 1.2 Version 1 · Package: M1 QA Add to Moodle Cancel" }`
3. **All Other `LA-IC` Records (`0` Golden Path Changes from Golden v2):**
   - **`LA-IC-04.json`:** `0` new golden path changes (stays at `3` entries: `G1.canvasConfiguration["jwk=inline"].scopes[4]`, `G1.canvasConfiguration["jwk=url"].scopes[4]`, and `G1.toolConfiguration.moodle[12].value`; `G2.moodle.records` token requests ask only for the 2 AGS scopes `lineitem` and `score` on both `78971b03` and `4f10c5fd`, so `G2.moodle` has `0` differences).
   - **`LA-IC-15.json`:** `0` new golden path changes (stays at `2` entries for `blackboard` and `canvas`; on `78971b03`, `G3.moodle.publications.B-conflict.results[0].scoreSyncs[0].lastError` already ended with `"(Moodle has a grade with a newer time)"`, which is identical on `4f10c5fd`).
   - **`LA-IC-03.json` & `LA-IC-17.json`:** `0` golden path changes (`changes: []`); optional `ld9.scanChecked`/`ld9.scanResult` prose note that Golden v2 binds `moodle-registered` and `moodle-disabled` via manual `PUT /app-api/connections/:id/platform` with the 6 documented keys (`issuer`, `clientId`, `deploymentId`, `authenticationEndpoint`, `accessTokenEndpoint`, `jwksUrl`) and does not invoke Dynamic Registration.
   - **`LA-IC-24` (`BD-A1-121`):** `0` golden path changes (`changes: []`, `frozenTestsTouched: []` per `LA-ADR-04` D8; `G4.moodle.pages.PROVIDER_PROFILE_MISMATCH` sends `otherFamily: "canvas"` and receives `400 PROVIDER_PROFILE_MISMATCH` identically on `78971b03` and `4f10c5fd`).

### 4. Round 6 Docker Boundary Records (`/Users/quangnguyen/cogniate-qa-runs/LA/LA-E0-03-r2/docker-records/`)

- **Before (`2026-10-24T15:38:07Z`):** `before-ps-a.txt` (`0` containers), `before-32-volumes.txt` (`32` protected volumes, `0` bytes diff vs D2 `before-32-volumes-inspect.json`), `before-networks.txt`.
- **After (`2026-10-24T15:56:53Z`):** `after-qalead-11x-containers.txt` (`0`), `after-qalead-11x-volumes.txt` (`0`), `after-qalead-11x-networks.txt` (`0`), `diff-32-volumes.txt` (`0` lines / `0` bytes diff on `docker volume inspect` across all 32 protected volumes).
- **Watchers:** `host-ps-watcher.log` and `docker-events-watch.jsonl` ran continuously throughout `qalead-la-110`, `qalead-la-111`, and `qalead-la-112` while `< 2` LA stacks were active.

---

## Round 5 Archive (Slot 3B Wave-End Candidate Golden Capture `G1–G4` & Compare on `80133d6b`)

- **Wave-End Candidate Capture (`qalead-la-10`, Slot 3B, `2026-10-23T16:57Z–16:59Z`):**
  - Command: `COMPOSE_PROJECT_NAME=qalead-la-10 PUBLIC_PORT=9473 STACK_SUBNET=172.23.0.0/16 node tests/ltiaas/golden/run-golden.mjs --sha 80133d6b662dd4fb8e18a9eed62e3160d2b2a1c5 --source /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end --workdir .../qalead-la-10-golden --replace-tests --tests-from .../src-wave-end/tests --out /Users/quangnguyen/cogniate-qa-runs/LA/LA-E7-08/slot3b-80133d6b/golden-capture-80133d6b662dd4fb8e18a9eed62e3160d2b2a1c5`
  - Result: **Exit `0`** (`PRE`, `CLONE`, `H1`, `GOLDEN-DEFAULT`, `GOLDEN-CAPTURE` in `52 s`, `GOLDEN-SECRET-SCAN` `129 tracked secret values / 0 hits`, `GOLDEN-OUT`, `TEARDOWN` `0 containers, 0 volumes, 0 networks left`; log `/Users/quangnguyen/cogniate-qa-runs/LA/LA-E7-08/slot3b-80133d6b/logs/slot3b-1-golden-capture.log`).
- **Wave-End Golden Compare with All 13 Approved `LD-9` Records (`AC-LA-E0-03-08` & `AC-LA-E7-08-03`):**
  - Command: `node tests/ltiaas/golden/compare.mjs --base tests/ltiaas/golden/1b17261be97c4701b928fa9dc2fa74c6d23028f6 --candidate /Users/quangnguyen/cogniate-qa-runs/LA/LA-E7-08/slot3b-80133d6b/golden-capture-80133d6b662dd4fb8e18a9eed62e3160d2b2a1c5-port9443 --expected "LA-IC-01,LA-IC-03,LA-IC-04,LA-IC-12,LA-IC-13,LA-IC-14,LA-IC-15,LA-IC-16,LA-IC-17,LA-IC-18,LA-IC-19,LA-IC-20,LA-IC-21"`
  - Result (after aligning the slot `PUBLIC_PORT=9473` to `G-BASE`'s `:9443` in `G1`/`G2` URL strings):
    ```text
    EQUAL: 280 differences (0 not explained), 0 expected changes missing; expected-delta files: LA-IC-01, LA-IC-03, LA-IC-04, LA-IC-12, LA-IC-13, LA-IC-14, LA-IC-15, LA-IC-16, LA-IC-17, LA-IC-18, LA-IC-19, LA-IC-20, LA-IC-21; 26 ms
    ```
  - All **`280` expected differences** (`259` `LA-IC-01`, `3` `LA-IC-04` now active on `80133d6b`, `2` `LA-IC-12`, `13` `LA-IC-14` now active on `80133d6b`, `2` `LA-IC-15`, `1` `LA-IC-16`) matched 100% with **`0` unexplained differences** and **`0` missing expected changes** (`/Users/quangnguyen/cogniate-qa-runs/LA/LA-E7-08/slot3b-80133d6b/logs/slot3b-1-golden-compare-port-aligned.txt`).
  - Zero differences in `G2` (`blackboard` and `canvas` OIDC login, token assertion claims, Deep Linking items, and AGS score payloads are byte-for-byte identical to `G-BASE`).

---

## Round 4 Archive (LD-9 Round 7 Metadata Fixes, Host-Only)

- **`B-LD9-13` (MAJOR, `LA-IC-01.json`, `README.md`, `TEST-STRATEGY.md`):**
  - Replaced the incorrect claim that the `LD-1` open-world rewrites landed in `LA-E0-02` prior to `G-BASE` with the actual state at `G-BASE` (`1b17261be97c4701b928fa9dc2fa74c6d23028f6`) and on integration (`195930c1` / `7db4f2c5`): the `6` frozen files (`tests/acceptance/M1/common/00-profiles.test.ts:40-49`, `tests/acceptance/M1/common/90-simulation-gates.test.ts:19`, `tests/acceptance/M1/canvas/11-canvas-platforms.test.ts:255`, `tests/host/run-m1.mjs:296,301`, `tests/e2e/host/run-m2.mjs:124`, and `tests/e2e/M2/01-cards.m2.ts:11-21`) still hold closed-world assertions on integration; their open-world rewrite (plus shared helpers `tests/acceptance/lib/open-world.{mjs,d.mts}`) is owned by task **`LA-E0-04`** (`docs/reviews/LA-E0-04/qa.md`; whereas `LA-E0-02` records the baseline), is staged on `la-qa` in commit **`f0a7b306`**, and lands at the **wave-end gate** after `LD-1` list approval (`0` additional frozen-test edits are authorized by `LA-IC-01` after `LD-1`).
- **`B-LD9-14` (MINOR) & `A-LA-LD9-16` (NIT) (`LA-IC-01.json`, `LA-IC-04.json`, `README.md`, `TEST-STRATEGY.md`):**
  - Updated all `authorUnitTestChanges` (`10` entries) and `qaTaskTestChanges` (`11` entries) in `LA-IC-01.json` to existing file:line paths at `195930c1` (`packages/channel-kernel/src/{registry.test.ts:71-106,153-260,capabilities.test.ts:17-46,manifest.test.ts:9-170,legacy-wire.test.ts:5-25}`, `services/lti-service/src/profiles/{channel-registry.test.ts:41-183,traits.test.ts:14-104}`, `services/cogniate-app/src/app/{connections.test.ts:21-69,lti-generic.test.ts:23-85,connection-check.test.ts:40-90}`, `services/cogniate-app/src/kernel/setup/admin-value.test.ts:47-225`, `packages/channels/brightspace/channel.test.ts:11-80`, `tests/ltiaas/tasks-core/LA-E1-01/{check.k0,golden-g1.k1sim}.test.ts`, `tests/ltiaas/tasks-core/LA-E1-06/{migration-013.k0,golden-g1.k1sim}.test.ts`, `tests/ltiaas/tasks-lti/LA-E1-10/providers-and-texts.{k0,k1sim}.test.ts`, `tests/ltiaas/tasks-core/LA-E2-03/lti-generic.{k0,k1sim}.test.ts`), and explicitly noted that `LA-E1-01` and `LA-E1-06` `golden-g1.k1sim.test.ts` call `expectGoldenEqual` via `tests/ltiaas/tasks-core/LA-E1-01/golden-binding.ts:25-36` where `BINDING` is still `{}` pending QA-3 wiring `cliBinding`.
  - Updated `LA-IC-04.json:26`, `README.md:133`, and `TEST-STRATEGY.md:441` so `tests/ltiaas/tasks-core/LA-E3-07/nrps-scopes.k1sim.test.ts` accurately records that at `7db4f2c5:12-18` it was a plain `describe` placeholder asserting `expect(process.env.LA_DOCKER_WINDOW).toBe('1')` (with no `describe.skipIf` or simulator calls), and in `ff6ad387` / `8143e669` at `195930c1:1-99` it implements `AC-LA-E3-07-02` (`:30-52`), `AC-LA-E3-07-03` (`:54-78`), and `AC-LA-E3-07-06` (`:80-98`).
- **`A-LA-LD9-15` (NIT, `LA-IC-14.json`, `README.md`, `TEST-STRATEGY.md`):**
  - Updated `LA-IC-14.json:66` to cite `packages/channels/canvas/portal/CanvasCreate.tsx:13-17` and its conditional initializer `useState(methods.includes("manual") ? "manual" : methods[0] ?? "manual")`, and updated `LA-IC-14.json:42,50-51`, `README.md:136`, and `TEST-STRATEGY.md:450` to cite the landed `tests/ltiaas/tasks-core/LA-E3-15/canvas-dr.{k0,k1sim}.test.ts` (`c19164fd` / `603107a4`).
- **Verification (Host-Only, No Docker, at `195930c1b56c7b78bfaa7776cbeec6da40cf4f87`):**
  - `node --test tests/ltiaas/golden/golden.k0.test.mjs`: `12/12` PASS (`514 ms`, log `/Users/quangnguyen/cogniate-qa-runs/LA/LD9/r7/golden-k0.log`), including on-disk path resolution checks for every `LA-IC-01` `authorUnitTestChanges` and `qaTaskTestChanges` entry and regression assertions for `B-LD9-13`, `B-LD9-14`, `A-LA-LD9-15`, and `A-LA-LD9-16`.
  - `npm run test:k0` in scratch clone `/Users/quangnguyen/cogniate-qa-runs/LA/LD9/r7/clone` (`195930c1`): `3` test files, `145/145` PASS (`1.69 s`, log `/Users/quangnguyen/cogniate-qa-runs/LA/LD9/r7/test-k0.log`).

---

## Round 3 Archive (LD-9 Round 6 Fixes, Host-Only)

- **`LA-IC-01` (`A-LA-LD9-11` MAJOR, `A-LA-LD9-12` MAJOR, `B-LD9-10` MAJOR):**
  - Replaced all wildcard (`[*]`) and type-only (`string`, `object`, `array`, `present`) rules in `tests/ltiaas/golden/expected/LA-IC-01.json` with `259` per-index / per-key exact `value` entries (`0` wildcard paths, `0` `rule` entries).
  - Updated `LA-IC-01.json` to match current integration HEAD (`d26d7018`): `brightspace` (`lms[4]`) offers `methods: ["dynamic", "manual"]`, `capabilities.dynamicRegistration: true`, `channelCapabilities["registration.dynamic"]: true`, and `channelCapabilities["binding.authority"]: { "dynamic": "self", "manual": "operatorGrant" }` (`LA-E2-06`); `canvas` (`lms[1]`) and `lti-generic` (`lms[3]`) set `channelCapabilities["setup.connectionCheck"]: true` (`LA-E6-04`); `canvas` includes the `dynamic` registration entry (`LA-E3-15`); and `moodle`, `canvas`, and `blackboard` carry the 4 AGS scopes (`LA-E3-07`).
  - Added the complete `ld9` metadata block (`epic`, `design`, `goldenFields`, `authorUnitTestChanges`, `qaTaskTestChanges`, `testChanges`, `frozenTestsTouched`, `scanChecked`, `scanResult`) to `LA-IC-01.json` and documented `LA-IC-01` in `tests/ltiaas/golden/README.md` §5 and `tests/ltiaas/TEST-STRATEGY.md` §4.7.
  - Added `LA-IC-01` standalone, combined (`13` LD-9 records, `280` differences explained), and `10` negative-control checks in `tests/ltiaas/golden/golden.k0.test.mjs` proving that any mutated or missing `channel`, `channelCapabilities`, `bindingAuthority`, `endpointOrigins`, `registration`, `setup.connectionCheck`, or `brightspace` `dynamicRegistration` value fails `compareCaptures`.
- **NITs / MINORs on `LA-IC-03`, `LA-IC-04`, `LA-IC-12`, `LA-IC-14`, `LA-IC-21` (`A-LA-LD9-10`, `A-LA-LD9-13..15`, `B-LD9-11..12`):**
  - `LA-IC-03.json`, `README.md`, `TEST-STRATEGY.md`: noted that QA-4 landed the query-free `createMoodleDrScenario` update in `tests/ltiaas/tasks-lti/LA-E5-06/protocol-wiring.k1sim.test.ts` at `a27a5607` / `d12b7b94`.
  - `LA-IC-04.json`, `README.md`, `TEST-STRATEGY.md`, `golden.k0.test.mjs`: updated the M1 Moodle configuration line range to `tests/acceptance/M1/common/00-profiles.test.ts:115-130` (row 13 at `:126`), clarified `moodle/app.test.ts` vs `moodle/manifest.ts`, noted `tests/ltiaas/tasks-core/LA-E3-07/nrps-scopes.k1sim.test.ts` is a `LA_DOCKER_WINDOW` placeholder while `LA-E3-06` covers K1-SIM `complete.scopes`, and cited `registration.test.ts` for the 5-scope default fallback.
  - `LA-IC-12.json`, `README.md`, `TEST-STRATEGY.md`, `golden.k0.test.mjs`: recorded that `LA-E3-05` (`8c65424` / `7c0ba57`, `picker.test.ts`, `launch.test.ts`) has landed and contributes the `2` `G4.{blackboard,canvas}.pages.picker.text` replacements (`0` frozen-test changes), and removed the legacy `ic12.changes.length === 0` branch in `golden.k0.test.mjs`.
  - `LA-IC-14.json`: cited `d12b7b94` (`a27a5607`) for `LA-E3-09` and the QA-3 branch for `LA-E3-15`, fixed line ranges for `00-profiles.test.ts:82-145` and `03-snapshot-controls.test.ts:1-24`, and noted `LA-E3-16` (`4c9809ff` / `4d318919`) defaults `CanvasCreate` to `'manual'` so `02-canvas-wizard.m2.ts` continues through the manual path unchanged.
  - `LA-IC-21.json`: aligned the `tests/ltiaas/tasks-lti/LA-E2-02/dynamic-registration.k1sim.test.ts:149-348` description with `LA-IC-03.json`.
- **Verification (Host-Only, No Docker):**
  - `node --test tests/ltiaas/golden/golden.k0.test.mjs`: `12/12` PASS (`380 ms`).
  - `npm run test:k0` in scratch clone `/Users/quangnguyen/cogniate-qa-runs/LA/LD9/r6/clone` (`d26d7018`): `3` test files, `145/145` PASS (`596 ms`).

---

## Round 2 Archive — Slots 2 and 3A Complete (2026-10-23)

Independence: QA wrote the golden capture and compare tool (`tests/ltiaas/golden/**`) from the task spec, `TEST-STRATEGY.md` §4.6–§4.7, the public API contracts and the frozen M1 helpers. QA read no product source, no Author notes and no reviewer file.

| Item | Value |
| --- | --- |
| Base SHA (`G-BASE`, Slot 2) | `1b17261be97c4701b928fa9dc2fa74c6d23028f6` (G-BASE `bd368ff`, product `9f8ac62`) |
| Candidate SHA (Slot 3A) | `8f1eceadb8e4e116ec34deb6dbb85f142741f7fc` (`8f1ecea`: Merge lane R `LA-E4-07` fix round 1; pre-`LA-E3-15` `4a62acb` and pre-`LA-E3-07` `a390edb`) |
| Lane and slots | Authorized `DOCKER-YES` window `05:31Z–06:25Z` (`msg_24b22de2951f`): Slot 2 (`qalead-la-1`, `qalead-la-2`) and Slot 3A (`qalead-la-3`), `PUBLIC_PORT=9473`, `STACK_SUBNET=172.23.0.0/16`, one stack at a time (`05:31:42Z–05:40:19Z`) |
| Golden tool files | `tests/ltiaas/golden/README.md`, `tests/ltiaas/golden/compare.mjs`, `tests/ltiaas/golden/run-golden.mjs`, `tests/ltiaas/golden/capture.golden.ts`, `tests/ltiaas/golden/vitest.config.mts`, `tests/ltiaas/golden/golden.k0.test.mjs`, `tests/ltiaas/golden/lib/compare.{mjs,d.mts}`, `tests/ltiaas/golden/lib/normalize.{mjs,d.mts}`, `tests/ltiaas/golden/1b17261be97c4701b928fa9dc2fa74c6d23028f6/{G1,G2,G3,G4,meta}.json`, `tests/ltiaas/golden/expected/LA-IC-{01,03,04,12,13,14,15,16,17,18,19,20,21}.json` |
| Run artifacts | Slot 2: `/Users/quangnguyen/cogniate-qa-runs/LA/LA-E0-03/r2-docker/` (`golden-1`, `golden-2`, `u1-seed-1b17261.json` `0600`, `logs/`); Slot 3A: `/Users/quangnguyen/cogniate-qa-runs/LA/LA-E7-08/r1-docker/` (`golden-cand`, `golden-cand-port9443`, `expected/`, `logs/`) |

## Acceptance criteria

| AC | Result | Test id | Command | Evidence |
| --- | --- | --- | --- | --- |
| AC-LA-E0-03-01 | PASS (K1-SIM + K0) | `golden capture v1` (`g-base-1` on `qalead-la-1`, `g-base-2` on `qalead-la-2`) + `AC-04 support: the stored capture is complete (G1-G4, meta)` | `COMPOSE_PROJECT_NAME=qalead-la-1 PUBLIC_PORT=9473 STACK_SUBNET=172.23.0.0/16 node tests/ltiaas/golden/run-golden.mjs --sha 1b17261be97c4701b928fa9dc2fa74c6d23028f6 --label g-base-1 --out .../golden-1` | `G1.json` captured on two fresh stacks (`default` and `acceptance` `GET /api/providers`, `GET /app-api/lms-providers`, both `/healthz` bodies, connection DTOs for Moodle/Blackboard/Canvas across `pending`/`registered`/`connected`/`disabled`, tool-configuration rows per baseline channel, and Canvas configuration JSON `jwk=url` and `jwk=inline` with inline public key placeholder). Port-normalized (`:9473` → `:9443`) `golden-1` compares `EQUAL: 0 differences` (`3 ms`) against `tests/ltiaas/golden/1b17261be97c4701b928fa9dc2fa74c6d23028f6/G1.json` (`compare-stored-vs-1-port9443.txt`). |
| AC-LA-E0-03-02 | PASS (K1-SIM + K0) | `golden capture v1` (`G2.blackboard`, `G2.canvas`) | same | `G2.json` stores OIDC parameters, token requests (assertion claims, `aud` form, scopes), score bodies, and Deep Linking response claims and items from `/__sim/records` for both `blackboard` (`17` records) and `canvas` (`18` records); `0` differences vs stored baseline (`compare-stored-vs-1-port9443.txt`). |
| AC-LA-E0-03-03 | PASS (K1-SIM + K0) | `golden capture v1` (`G3`, `G4`) | same | `G3.json` stores connection DTOs, publications (`A-sent`, `B-conflict`, `C-failed`, `C2-resend`, `D-superseded`, `E-pending`), results API rows, score sync rows, and Resend answers (`failed`, `sent`, `superseded`). `G4.json` stores all tool error pages per channel (`picker`, `PUBLICATION_NOT_AVAILABLE`, `PICKER_USED`, `HANDOFF_USED`, `ROLE_NOT_ALLOWED`, `deep-link-with-resource-link`, `PUBLICATION_NOT_IN_CONNECTION`, `UNKNOWN_DEPLOYMENT`, `STATE_COOKIE_MISSING`, `INVALID_STATE`, `PROVIDER_PROFILE_MISMATCH`, `SERVICE_ORIGIN_MISMATCH`, `DEPLOYMENT_NOT_ACTIVE`, plus `common` `INVALID_LTIK`, `PICKER_NOT_FOUND`, `PLAY_NOT_FOUND`), learner labels, and player status texts. `0` differences vs stored baseline. |
| AC-LA-E0-03-04 | PASS (K1-SIM) | `g-base-1` (`qalead-la-1`, `48 s` capture) vs `g-base-2` (`qalead-la-2`, `45 s` capture) | `node tests/ltiaas/golden/compare.mjs --base .../golden-1 --candidate .../golden-2` | `EQUAL: 0 differences (0 not explained), 0 expected changes missing; expected-delta files: none; 5 ms` (`logs/compare-1-vs-2.txt`). |
| AC-LA-E0-03-05 | PASS (K0 + K1-SIM) | `AC-05 normalization`, `AC-05 drop list`, `AC-05 secret scan`, `GOLDEN-SECRET-SCAN` | `node --test tests/ltiaas/golden/golden.k0.test.mjs` | `12/12` pass (`255 ms`); `0` secret hits across `g-base-1` (`128` tracked secret values), `g-base-2` (`128` values), `cand-8f1ecea` (`129` values), `tests/ltiaas/golden/1b17261be97c4701b928fa9dc2fa74c6d23028f6/`, and all `13` `tests/ltiaas/golden/expected/LA-IC-*.json` files. |
| AC-LA-E0-03-06 | PASS (K0) | `AC-06 compare without Docker: the CLI compares the stored capture with itself in under 5 s` | `node --test tests/ltiaas/golden/golden.k0.test.mjs` | `24 ms` (`< 5,000 ms`), `EQUAL: 0 differences`. |
| AC-LA-E0-03-07 | PASS (K0) | `AC-07 negative control: one changed field in a copy of the capture fails and is named with the old and new value` | `node --test tests/ltiaas/golden/golden.k0.test.mjs` | Exits `1` and prints `DIFF G1 acceptance.providers.profiles[1].issuer (changed)`. |
| AC-LA-E0-03-08 | PASS (K0 + K1-SIM) | `AC-08 expected delta`, `cliBinding`, Slot 3A compare on `8f1eceadb8e4e116ec34deb6dbb85f142741f7fc` | `node tests/ltiaas/golden/compare.mjs --base .../golden-1 --candidate .../golden-cand --expected "LA-IC-01,LA-IC-03,LA-IC-12,LA-IC-13,LA-IC-15,LA-IC-16,LA-IC-17,LA-IC-18,LA-IC-19,LA-IC-20,LA-IC-21"` | Exits `0` in `26–29 ms`: `EQUAL: 264 differences (0 not explained), 0 expected changes missing` (`logs/compare-8f1ecea.txt` and `logs/compare-8f1ecea-vs-stored-1b17261.txt`). |
| AC-LA-E0-03-09 | PASS (K1-SIM) | `golden capture v1` U1 seed rows (`u1-seed-1b17261.json` + `G3.{blackboard,canvas}.publications.*.results`) | Verified in `g-base-1`, `g-base-2`, and `cand-8f1ecea` | For both `blackboard` and `canvas`, `GET /app-api/publications/:id/results` in `G3.json` and `u1-seed-1b17261.json` (`0600`) contain score sync rows in all 5 required statuses: `sent` (`tries: 1`), `conflict` (`tries: 1`), `failed` (`tries: 1`), `superseded` (`tries: 2`), and `pending` (`tries: 2`). |

## Slot 3A Candidate Capture & Compare on Integration SHA `8f1ecea` (`8f1eceadb8e4e116ec34deb6dbb85f142741f7fc`)

- **Why `8f1ecea`:** Integration SHA `8f1eceadb8e4e116ec34deb6dbb85f142741f7fc` (Merge lane R `LA-E4-07` fix round 1; Lead check green: `3079` unit, `254` infra on rerun, `149` K0, `F1` `0`, `F5` `6`) precedes the two E3 merges whose LD-9 records were pending at slot start (`LA-E3-15` `4a62acb` for `LA-IC-14` and `LA-E3-07` `a390edb` for `LA-IC-04`).
- **Capture (`qalead-la-3`):** `COMPOSE_PROJECT_NAME=qalead-la-3 PUBLIC_PORT=9473 STACK_SUBNET=172.23.0.0/16` completed in `1m 48s` (`45 s` in-container capture, `129` tracked secret values, `0` secret hits, `0` leftover Docker resources).
- **Expected-Delta Set Used (`11` IDs):**
  1. `LA-IC-01` (`tests/ltiaas/golden/expected/LA-IC-01.json` — additive `channel`, `channelName`, `channelCapabilities`, `family`, `registration` on `G1.*.lmsProviders.lms[*]`; `channel`, `channelName`, `channelCapabilities`, `bindingAuthority` on `G1.connections[*]`, `G1.connectionList.connections[*]`, and `G3.{blackboard,canvas}.connection`; `channel`, `endpoints`, `issuerKind`, `endpointOrigins` on `G1.*.providers.profiles[*]`; plus the E2 `lti-generic` and `brightspace` entries in `G1.*.lmsProviders.lms[3..4]` and `G1.*.providers.profiles[6..9]`, with all `8` baseline profiles verified `100%` equal on every baseline field).
  2. `LA-IC-03` (`tests/ltiaas/golden/expected/LA-IC-03.json` — Moodle `standard` DR `path-prefix` issuer rule and full-URL equality check; `0` golden diffs on baseline).
  3. `LA-IC-12` (`tests/ltiaas/golden/expected/LA-IC-12.json` — Deep Linking `Cancel` button text on `G4.blackboard.pages.picker.text` and `G4.canvas.pages.picker.text` from `LA-E3-05`, plus `LA-E3-04` service part; `2` golden diffs explained).
  4. `LA-IC-13` (`tests/ltiaas/golden/expected/LA-IC-13.json` — Could gaps `scoreGiven: null`, NRPS `service_versions`, `trustedAudiences`; `0` golden diffs on baseline).
  5. `LA-IC-15` (`tests/ltiaas/golden/expected/LA-IC-15.json` — `G3.{blackboard,canvas}.publications.B-conflict.results[0].scoreSyncs[0].lastError` channel-parameterized `409 PLATFORM_CONFLICT` text; `2` golden diffs explained).
  6. `LA-IC-16` (`tests/ltiaas/golden/expected/LA-IC-16.json` — `G1.acceptance.ltiHealth.outbound_allowlist` `.sim.test` set comparison against `tests/sim/hosts.json`; `1` golden diff explained).
  7. `LA-IC-17` (`tests/ltiaas/golden/expected/LA-IC-17.json` — `BD-A1-41` strict `POST /app-api/connections` schema; `0` golden diffs on baseline).
  8. `LA-IC-18` (`tests/ltiaas/golden/expected/LA-IC-18.json` — `BD-A1-50` shared-platform unconfigured portal notice; `0` golden diffs on baseline).
  9. `LA-IC-19` (`tests/ltiaas/golden/expected/LA-IC-19.json` — `BD-A1-57` launch `family_guard_mismatch` warning vs refusal; `0` golden diffs on baseline).
  10. `LA-IC-20` (`tests/ltiaas/golden/expected/LA-IC-20.json` — `BD-A1-63`/`81`/`90` `ChannelErrorNotice` fallback; `0` golden diffs on baseline).
  11. `LA-IC-21` (`tests/ltiaas/golden/expected/LA-IC-21.json` — `BD-A1-93` DR update preserves stored `active` value; `0` golden diffs on baseline).
- **Comparison Result:**
  - `g-base-1` (`:9473`) vs `cand-8f1ecea` (`:9473`): `EQUAL: 264 differences (0 not explained), 0 expected changes missing; expected-delta files: LA-IC-01, LA-IC-03, LA-IC-12, LA-IC-13, LA-IC-15, LA-IC-16, LA-IC-17, LA-IC-18, LA-IC-19, LA-IC-20, LA-IC-21; 29 ms` (`exit 0`).
  - Committed `tests/ltiaas/golden/1b17261be97c4701b928fa9dc2fa74c6d23028f6` (`:9443`) vs port-normalized `cand-8f1ecea-port9443` (`:9443`): `EQUAL: 264 differences (0 not explained), 0 expected changes missing; 26 ms` (`exit 0`).
  - Zero differences in `G2` (`blackboard` and `canvas` OIDC, token assertions, Deep Linking items, and score payloads are byte-for-byte identical to `G-BASE`).

## Docker Boundary Records (`GATE-RUN-PLAN.md` §3.2, §3.3)

- **Before-slot snapshot (`05:31:42Z`):** `/Users/quangnguyen/cogniate-qa-runs/LA/LA-E0-03/r2-docker/logs/before-{ps,networks,volumes,volumes-inspect}.{txt,json}` (`0` running containers; networks `bridge`, `host`, `none`; `32` protected baseline volumes).
- **After-slot snapshot (`05:40:19Z`):** `/Users/quangnguyen/cogniate-qa-runs/LA/LA-E7-08/r1-docker/logs/after-{ps,networks,volumes,volumes-inspect}.{txt,json}` (`0` running containers; networks `bridge`, `host`, `none`; `32` protected baseline volumes).
- **Boundary diffs:** `0` diffs on `docker ps`, `0` diffs on `docker network ls`, `0` diffs on `docker volume ls -q`, `0` diffs on `docker volume inspect` JSON (`375` lines), and `0` leftover `qalead-la-*` containers, volumes, or networks.
- **Background watcher:** `/Users/quangnguyen/cogniate-qa-runs/LA/LA-E0-03/r2-docker/logs/docker-ps-watch.log` confirmed at most one `qalead-la-<n>` stack ran at any time during `05:31Z–05:40Z`.

---

## Round 1 Archive (2026-10-22, Host-Only Tool Verification)

- Built `tests/ltiaas/golden/**` and verified `AC-LA-E0-03-05..08` (`K0`, `9/9` pass in `212 ms`) while `AC-LA-E0-03-01..04, 09` awaited an authorized LA Docker window.
