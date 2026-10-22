# Golden Capture and Compare Tool (`LA-E0-03`)

This folder holds the golden capture and compare tool for milestone LA (`docs/architecture/ltiaas/tasks/LA-E0-03.md`, `tests/ltiaas/TEST-STRATEGY.md` §4.6–§4.7).

- **Capture (`run-golden.mjs` + `capture.golden.ts`):** runs on a booked SIM Docker slot, captures `G1`–`G4` across the `default` and `acceptance` stack profiles, normalizes all values at capture, scans for secrets (`K-HYG` method, 0 hits), and writes `G1.json`–`G4.json` + `meta.json`.
- **Compare (`compare.mjs` + `lib/compare.mjs`):** runs on the host with **no Docker** in under 5 s. It compares a candidate capture folder against the G-BASE baseline (`tests/ltiaas/golden/1b17261be97c4701b928fa9dc2fa74c6d23028f6/`) and checks any named `LA-IC` expected-delta files.

---

## 1. Baseline Capture Folder

- **G-BASE baseline path:** `tests/ltiaas/golden/1b17261be97c4701b928fa9dc2fa74c6d23028f6/`
- **Exported constant:** `BASELINE` in `tests/ltiaas/golden/golden.k0.test.mjs` (`"1b17261be97c4701b928fa9dc2fa74c6d23028f6"`).

---

## 2. Capture CLI (`run-golden.mjs`, SIM Docker slot only)

Run only during a booked SIM Docker window, using your own `COMPOSE_PROJECT_NAME` prefix (`qa-la-sim-r<N>`, `qa2-la-sim-r<N>`, `qa3-la-sim-r<N>`, `qa4-la-sim-r<N>`):

```sh
COMPOSE_PROJECT_NAME=qa3-la-sim-r1 PUBLIC_PORT=9443 STACK_SUBNET=172.20.0.0/16 \
  node tests/ltiaas/golden/run-golden.mjs \
    --sha <commit-sha> \
    --label <run-label> \
    --out /abs/path/to/capture-out \
    [--workdir /abs/path/to/clone] \
    [--replace-tests --tests-from /abs/path/to/la-qa/tests]
```

### Arguments

| Option | Required | Description |
| --- | --- | --- |
| `--sha <commit>` | Yes (unless `--checkout`) | Product/integration commit to clone and capture. |
| `--label <name>` | No (default `capture`) | Lowercase alphanumeric + `-` label (`/^[a-z0-9-]+$/`). |
| `--out <abs-dir>` | Yes | Absolute directory where `G1.json`–`G4.json` and `meta.json` are written. |
| `--workdir <abs-dir>` | No | Clone directory (default `~/cogniate-qa-runs/<project>-<sha8>-<time>`). |
| `--replace-tests` | No | Copy `--tests-from` (default: this repo's `tests/`) into the clone before running. |
| `--tests-from <dir>` | No | Source `tests/` folder when `--replace-tests` is used. |

### Output Files in `--out`

- `G1.json`, `G2.json`, `G3.json`, `G4.json`: normalized JSON documents (sorted keys, `<id:n>` placeholders per file, `<t>` timestamps, `<redacted:len>` secrets, `<public-key:len>` JWK material, `DROP` keys removed).
- `meta.json`: `{ goldenVersion, productSha, label, project, capturedAt, captureSeconds, totalSeconds, normalization, secretValuesChecked, secretHits: 0 }`.
- Private U1 seed state stays inside the clone at `tests/acceptance/artifacts/golden/<label>/private/u1-seed.json` (mode `0600`).

---

## 3. Compare CLI (`compare.mjs`, No Docker)

```sh
node tests/ltiaas/golden/compare.mjs \
  --base tests/ltiaas/golden/1b17261be97c4701b928fa9dc2fa74c6d23028f6 \
  --candidate /abs/path/to/capture-out \
  [--expected LA-IC-01,LA-IC-04,LA-IC-16] \
  [--expected-dir tests/ltiaas/golden/expected] \
  [--sim-hosts tests/sim/hosts.json]
```

### Arguments

| Option | Required | Description |
| --- | --- | --- |
| `--base <dir>` | Yes | Baseline capture directory containing `G1.json`–`G4.json`. |
| `--candidate <dir>` | Yes | Candidate capture directory containing `G1.json`–`G4.json`. |
| `--expected <list>` | No (default `""`) | Comma-separated list of `LA-IC` ids (resolved in `--expected-dir` as `<id>.json`) **or** paths to expected-delta `.json` files. |
| `--expected-dir <dir>` | No | Directory for `<LA-IC id>.json` files (default `tests/ltiaas/golden/expected`). |
| `--sim-hosts <path>` | No | Override path to `tests/sim/hosts.json` for the `LA-IC-16` simulator-allowlist rule. |

### Exit Codes

- `0`: Every difference is explained by a named expected-delta entry, and every named expected-delta entry matched at least one difference.
- `1`: One or more unexplained differences (`DIFF ...`) or missing expected changes (`MISSING ...`).
- `2`: Invalid CLI arguments or missing/malformed input file.

### Output Format (stdout)

Each difference or missing expected change is printed on its own line before the final summary line:

```text
DIFF <G1|G2|G3|G4> <path> (<changed|added|removed>): <old-json|(absent)> -> <new-json|(absent)>
EXPECTED <G1|G2|G3|G4> <path> (<changed|added|removed>): <old-json|(absent)> -> <new-json|(absent)> [<LA-IC-id>]
MISSING <G1|G2|G3|G4> <path>: expected change missing [<LA-IC-id>] (value <json> | rule <rule>)
EQUAL: <total> differences (0 not explained), 0 expected changes missing; expected-delta files: <ids|none>; <ms> ms
```

When the compare fails, the summary line starts with `DIFFERENT:` instead of `EQUAL:`.

---

## 4. Document Layout (`G1`–`G4`)

Paths in `DIFF`, `EXPECTED`, `MISSING` and expected-delta files use dot notation for identifier keys (`a.b`), `["key"]` for keys with other characters (for example `connections["moodle-manual-pending"]`), and `[i]` for array elements:

| File | Top-level sections | Content |
| --- | --- | --- |
| `G1` | `G1.default.{providers,lmsProviders,ltiHealth,appHealth}` | `GET /api/providers`, `GET /app-api/lms-providers`, and both `/healthz` bodies in the `default` profile |
| `G1` | `G1.acceptance.{providers,lmsProviders,ltiHealth,appHealth}` | Same four documents in the `acceptance` profile |
| `G1` | `G1.connections["<channel>-<state>"]`, `G1.connectionList` | Connection DTOs (`moodle-dynamic-pending`, `moodle-manual-pending`, `blackboard-pending`, `blackboard-registered`, `blackboard-connected`, `blackboard-disabled`, `canvas-pending`, `canvas-registered`, `canvas-connected`, `canvas-disabled`) and `GET /app-api/connections` |
| `G1` | `G1.toolConfiguration.{moodle,blackboard,canvas}` | `GET /app-api/connections/:id/tool-configuration` per baseline channel |
| `G1` | `G1.canvasConfiguration["jwk=url" \| "jwk=inline"]` | `GET /app-api/connections/:id/canvas-configuration` in both forms |
| `G1` | `G1.lmsProvidersAfter`, `G1.providersAfter` | `GET /app-api/lms-providers` and `GET /api/providers` after all connections exist |
| `G2` | `G2.{blackboard,canvas}.{oidc,records}` | OIDC redirect parameters and `/__sim/records` transcript (`auth`, `jwks`, `deep-link`, `token`, `score`) |
| `G3` | `G3.{blackboard,canvas}.{publications,deepLinkReturn,resend,connection,publicationList}` | App API transcript (`A-sent`, `B-conflict`, `C-failed`, `C2-resend`, `D-superseded`, `E-pending` with `results` and `scoreSyncs`; Resend answers for `failed`, `sent`, `superseded`) |
| `G4` | `G4.{blackboard,canvas}.{pages,players,learnerLabels}`, `G4.common.pages` | Tool HTML pages (`picker`, `PUBLICATION_NOT_AVAILABLE`, `PICKER_USED`, `HANDOFF_USED`, `ROLE_NOT_ALLOWED`, `deep-link-with-resource-link`, `PUBLICATION_NOT_IN_CONNECTION`, `UNKNOWN_DEPLOYMENT`, `STATE_COOKIE_MISSING`, `INVALID_STATE`, `PROVIDER_PROFILE_MISMATCH`, `SERVICE_ORIGIN_MISMATCH`, `PLATFORM_NOT_ACTIVE-or-refusal`), player statuses, learner labels |

---

## 5. Expected-Delta File Format (`tests/ltiaas/golden/expected/<LA-IC id>.json`)

```json
{
  "id": "LA-IC-01",
  "approval": "docs/reviews/LA-E1-02/qa.md",
  "changes": [
    { "file": "G1", "path": "acceptance.lmsProviders.lms[*].channel", "rule": "string" },
    { "file": "G1", "path": "acceptance.lmsProviders.lms[*].channelName", "rule": "string" },
    { "file": "G1", "path": "acceptance.lmsProviders.lms[*].channelCapabilities", "rule": "object" }
  ]
}
```

- Each entry in `changes` has `file` (`"G1"`–`"G4"`), `path` (supports `*` for one object key or array index), and either `value` (exact JSON value) or `rule` (`"present"`, `"removed"`, `"string"`, `"boolean"`, `"number"`, `"object"`, `"array"`, `"sim-hosts-allowlist"`).
- Every difference must match at least one entry, and every entry must match at least one difference (otherwise it fails as `MISSING`).

### Reviewed `LD-9` Expected-Delta Records (`LA-IC-12`, `LA-IC-13`, `LA-IC-15`, `LA-IC-16`, `LA-IC-17`, `LA-IC-18`)

| Id | File | Golden fields changed | Frozen tests touched | Notes |
| --- | --- | --- | --- | --- |
| `LA-IC-12` | `tests/ltiaas/golden/expected/LA-IC-12.json` | **None at `LA-E3-04`** (`changes: []`; `G1`–`G4` do not capture Deep Linking `GET /api/idtoken` or empty Deep Linking calls; `LA-E3-05` will add `"Cancel"` to `G4.{blackboard,canvas}.pages.picker.text`) | **None** (`0` frozen tests; scan of `T3a/1-deep-linking.spec.ts:46-54`, `T3a/3-negative.spec.ts:57-78`, `T3c/1-endpoints.spec.ts:80-115,229-236`, `M1/canvas/21-canvas-protocol.test.ts:40-46`, `lib/moodle-dl.ts:330`, `e2e/lib/moodle.ts:413`, `e2e/M2/07-sim-scenario.m2.ts:36`, and `golden/capture.golden.ts:90-105` confirmed no frozen test sends `contentItems: []` expecting `400` or checks `launch.deepLinkingSettings` by whole-object equality; Author unit tests updated in `3344520`: `lti/deep-linking.test.ts`, `http/routes/compat.test.ts`, `lti/idtoken.test.ts`) | `LA-ADR-05` D3, `LA-ADR-04` D8 |
| `LA-IC-13` | `tests/ltiaas/golden/expected/LA-IC-13.json` | **None** (`changes: []`; `G1`–`G4` do not call `/api/platforms`, `/api/memberships`, or post `scoreGiven: null`, and all golden launches use a single `aud` equal to `clientId`) | **None** (`0` frozen tests; scan of `T3a/3-negative.spec.ts:95-175`, `T3b/1-registration.spec.ts:85-93`, `T3b/2-update.spec.ts:74-76`, `T3b/4-line-items.spec.ts:45-95`, `T3c/1-endpoints.spec.ts:157-260`, `T2b/qa-platform.test.ts:82-90`, `M1/common/00-profiles.test.ts:49-60`, `M1/blackboard/{10-deployments.test.ts:17-60,20-protocol.test.ts:12-29,47,40-routing-grades.test.ts:135-144}`, `M1/canvas/{11-canvas-platforms.test.ts:16-70,21-canvas-protocol.test.ts:73,181-203,41-canvas-grades.test.ts:310-317}`, and `golden/capture.golden.ts:80-176,183-261` confirmed no frozen test posts `scoreGiven: null` expecting `400`, sends NRPS `service_versions` without `'2.0'`, launches with an untrusted extra `aud`, or asserts `Object.keys` on `/api/platforms`; Author unit tests updated in `a2dfc04`: `platform/ags.test.ts`, `platform/platform.test.ts`, `lti/checks.test.ts`, `lti/idtoken.test.ts`, `http/routes/platforms.test.ts`, `store/platforms.test.ts`) | `LA-ADR-05` D10, `LA-ADR-07` D8, `LA-ADR-04` D8 |
| `LA-IC-15` | `tests/ltiaas/golden/expected/LA-IC-15.json` | `G3.blackboard.publications.B-conflict.results[0].scoreSyncs[0].lastError` (`"... (Blackboard has a grade with a newer time)"`) and `G3.canvas.publications.B-conflict.results[0].scoreSyncs[0].lastError` (`"... (Canvas has a grade with a newer time)"`) | **None** (`0` frozen tests; scan of `T6/4-results.spec.ts:83-85`, `T5b/4-conflict-resend.spec.ts:76-81`, `M1/blackboard/40-routing-grades.test.ts:145-157`, `M1/canvas/41-canvas-grades.test.ts:318-329`, `e2e/M2/{05-publish-results.m2.ts:34-90,07-sim-scenario.m2.ts:66-106}`, `golden/capture.golden.ts:144-169`, `G3.json:93,315`, and `G4.json:45-56,144-155` confirmed `T6` and `T5b` run on a Moodle connection while `M1`/`M2` do not assert the `409` conflict `lastError` suffix; Author unit tests updated in `a285bdb`: `packages/tracking/src/tracking.test.ts`, `services/cogniate-app/src/drivers/lti-ags/reporter.test.ts`; LA suites: `tests/ltiaas/tasks-core/LA-E4-03/reporter.{k0,k1sim}.test.ts`) | `BD-A1-21`, `LA-ADR-04` D8 |
| `LA-IC-16` | `tests/ltiaas/golden/expected/LA-IC-16.json` | `G1.acceptance.ltiHealth.outbound_allowlist` (rule `sim-hosts-allowlist` when `LA-IC-16` is in `expected`: `.sim.test` entries equal as a set the union of `allowlist` hosts in `tests/sim/hosts.json` at the compared SHA; non-`.sim.test` entries equal G-BASE `["moodle.test", "qa-platform.test", "evil.test"]`; `default.*Health.outbound_allowlist` and `acceptance.appHealth.outbound_allowlist` stay strictly equal to G-BASE) | **None** (`0` frozen tests; scan of `golden/capture.golden.ts:183-193`, `T1/tls-health.test.ts:119-128`, `T2b/zz-logs.spec.ts:39-40`, `M1/common/{00-profiles.test.ts:23-29,90-simulation-gates.test.ts:16-18}`, `e2e/{0-start.spec.ts:11-22,9-end.spec.ts:6-17,host/run-m2.mjs:125-135}`; `tests/ltiaas/tasks-lti/LA-E1-05/profiles.k1sim.test.ts` `AC-LA-E1-05-07` and `AC-LA-E1-05-09` compare via `diff`/`compareCaptures` with this rule) | `BD-A1-36`, `LA-ADR-04` D8 |
| `LA-IC-17` | `tests/ltiaas/golden/expected/LA-IC-17.json` | **None** (`changes: []`) | **None** (`0` frozen tests; scan of `T4b1/1-connect.spec.ts:128-134`, `T4b1/3-security.spec.ts:116`, `T4b1/4-adoption.spec.ts:17-24,54,65,75`, `T6/2-connect.spec.ts:133,148-151`, `M1/canvas/41-canvas-grades.test.ts:89-90`, `M1/canvas/61-canvas-containment.test.ts:156-158`, `lib/portal.ts:28`, `e2e/2-scenario-b.spec.ts:52`, `golden/capture.golden.ts:194-200`, and `acceptance/lib/qa-platform.ts:43` confirmed every Moodle/standard `PUT /app-api/connections/:id/platform` body sends only the 6 documented keys `issuer`, `clientId`, `deploymentId`, `authenticationEndpoint`, `accessTokenEndpoint`, `jwksUrl`, while golden capture leaves G1 Moodle connections `pending` and makes no app `PUT /app-api/connections/:id/platform` call) | `BD-A1-41`, `LA-ADR-04` D8 |
| `LA-IC-18` | `tests/ltiaas/golden/expected/LA-IC-18.json` | **None** (`changes: []`; `G1`–`G4` capture API DTOs, simulator records, and tool pages, not portal UI components) | **None** (`0` frozen tests; scan in `LA-IC-18.json` of `tests/e2e/M2/00..08`, `tests/e2e/{1-scenario-a,2-scenario-b}.spec.ts`, `tests/acceptance/T6/{1,2,3,5}-*.spec.ts`, and `golden/capture.golden.ts:80-176,178-261` confirmed (a) `PublishDialog` names `lmsNames[result.lms]` / `lmsNames[connection.lms]`, which stays `'Moodle'` in U1/U2 and is not rendered by M2 pre-publish/close checks, (b) `Connect.tsx` passes `manifest.card.color` to `IntegrationLogo` and no frozen test asserts the Connect-page logo colour class, and (c) `IntegrationLogo` adds `title={name}` and no frozen test asserts the logo `title` attribute) | `BD-A1-50`, `LA-ADR-04` D8 |

---

## 6. Importing in QA-2, QA-3 and QA-4 Suites

Task suites can import the compare library and the ready-made binding directly from `tests/ltiaas/golden/lib/compare.mjs` (typed via `compare.d.mts`):

```ts
import {
  cliBinding,
  compareCaptures,
  differingPaths,
  captureDocuments,
  G1_LMS_PROVIDERS_AND_CONNECTIONS,
  loadCapture,
  loadExpectedDelta,
  report,
} from '../../../golden/lib/compare.mjs';
```

### Binding for `tests/ltiaas/tasks-core/LA-E1-01/golden-binding.ts`

In `golden-binding.ts`, replace `BINDING` and `G1_PROVIDERS_AND_CONNECTIONS` with:

```ts
import { cliBinding, G1_LMS_PROVIDERS_AND_CONNECTIONS } from '../../../golden/lib/compare.mjs';

export const BINDING: Binding = cliBinding;
export const G1_PROVIDERS_AND_CONNECTIONS = G1_LMS_PROVIDERS_AND_CONNECTIONS;
```

- `cliBinding.compare(baseline, capture, expectedDelta)` runs `node tests/ltiaas/golden/compare.mjs --base <baseline> --candidate <capture> [--expected <expectedDelta>]`.
- `cliBinding.differingPaths(report)` returns `<file>.<path>` for every `DIFF` and `MISSING` line in the CLI output (for example `G1.acceptance.lmsProviders.lms[0].channel`).
- `cliBinding.documents(captureDir)` returns all `<file>`, `<file>.<section>`, and `<file>.<section>.<subKey>` document ids present in `captureDir` (plus `G1/app-api/lms-providers`).
- `G1_LMS_PROVIDERS_AND_CONNECTIONS` matches `G1.default.lmsProviders`, `G1.acceptance.lmsProviders`, `G1.lmsProvidersAfter`, `G1.connections`, and `G1.connectionList`.
