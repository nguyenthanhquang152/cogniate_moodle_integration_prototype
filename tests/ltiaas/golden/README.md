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
  [--expected LA-IC-01,LA-IC-04] \
  [--expected-dir tests/ltiaas/golden/expected]
```

### Arguments

| Option | Required | Description |
| --- | --- | --- |
| `--base <dir>` | Yes | Baseline capture directory containing `G1.json`–`G4.json`. |
| `--candidate <dir>` | Yes | Candidate capture directory containing `G1.json`–`G4.json`. |
| `--expected <list>` | No (default `""`) | Comma-separated list of `LA-IC` ids (resolved in `--expected-dir` as `<id>.json`) **or** paths to expected-delta `.json` files. |
| `--expected-dir <dir>` | No | Directory for `<LA-IC id>.json` files (default `tests/ltiaas/golden/expected`). |

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

- Each entry in `changes` has `file` (`"G1"`–`"G4"`), `path` (supports `*` for one object key or array index), and either `value` (exact JSON value) or `rule` (`"present"`, `"removed"`, `"string"`, `"boolean"`, `"number"`, `"object"`, `"array"`).
- Every difference must match at least one entry, and every entry must match at least one difference (otherwise it fails as `MISSING`).

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
