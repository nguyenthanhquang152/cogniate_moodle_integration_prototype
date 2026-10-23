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

### Reviewed `LD-9` Expected-Delta Records (`LA-IC-03`, `LA-IC-04`, `LA-IC-12`, `LA-IC-13`, `LA-IC-14`, `LA-IC-15`, `LA-IC-16`, `LA-IC-17`, `LA-IC-18`, `LA-IC-19`, `LA-IC-20`, `LA-IC-21`)

| Id | File | Golden fields changed | Frozen tests touched | Notes |
| --- | --- | --- | --- | --- |
| `LA-IC-03` | `tests/ltiaas/golden/expected/LA-IC-03.json` | **None** (`changes: []`; `G1`–`G4` do not execute Dynamic Registration) | **None** (`0` frozen tests; scan of `T3b/{1-registration.spec.ts:18-95,2-update.spec.ts:18-78,3-negative.spec.ts:32-70}`, `T4b1/{1-connect.spec.ts:58-94,3-security.spec.ts:42-103}`, `e2e/1-scenario-a.spec.ts:58-95`, and `golden/capture.golden.ts:80-176,183-261` confirmed real Moodle 5.2.4 serves a query-free OpenID Configuration at `${urls.moodle}/mod/lti/openid-configuration.php` with `LtiDeepLinkingRequest`, while the frozen `T3b` `AC-T3-05` fixture lacks `LtiDeepLinkingRequest` but already fails earlier at check 3 with `400 ISSUER_MISMATCH` as before; `2` QA-4 LA task tests affected: (a) `tests/ltiaas/tasks-lti/LA-E3-06/nrps-scopes.k1sim.test.ts:171-230` updated by QA-4 in `18fa1d3` / `dbc80e9` to serve `${issuer}/mod/lti/openid-configuration.php` with `product_family_code: 'moodle'` and `LtiDeepLinkingRequest`, and (b) `tests/ltiaas/tasks-lti/LA-E5-06/protocol-wiring.k1sim.test.ts:145-168,404-465`, where `createMoodleDrScenario` takes `reg.openidConfiguration` with `?scenario=<id>` from `tests/sim/core/runtime.mjs:303-304`, starting a session when broader DR profiles are loaded so `AC-LA-E5-06-02` and start-only `AC-LA-E5-06-05..06` do not call complete, whereas `AC-LA-E5-06-07` at `:434-444` completes with default `profile: 'standard'` and fails `400 INVALID_REQUEST` / `configuration_path_mismatch` until QA-4 updates `createMoodleDrScenario` at `:145-168` to use a query-free `issuer + '/mod/lti/openid-configuration.php'` URL; Author unit tests updated in `865c3d0`: `lti/{registration,codes}.test.ts`, `http/routes/registration.test.ts`, `store/registrations.test.ts`, `channel-kernel/src/manifest.test.ts`) | `LA-ADR-02` D2/D5, `LA-ADR-04` D8 |
| `LA-IC-04` | `tests/ltiaas/golden/expected/LA-IC-04.json` | `G1.canvasConfiguration["jwk=inline"].scopes[4]` (`removed`), `G1.canvasConfiguration["jwk=url"].scopes[4]` (`removed`), `G1.toolConfiguration.moodle[12].value` (`"Do not use this service"`) | `3` frozen acceptance tests: `tests/acceptance/M1/canvas/31-canvas-grants.test.ts:114-120,154-163` (`M1-19.canvas.json`, `M1-19.canvas.inline-key`), `tests/acceptance/M1/common/00-profiles.test.ts:93-108` (`M1-19.common.moodle-configuration`), `tests/acceptance/T4b1/1-connect.spec.ts:96-124` (`AC-T4-10`) (direct lti-service DR calls without `scopes` in `T3b`, `LA-E2-02`, and `LA-E3-06 AC-02` keep the 5-scope fallback; browser suites `T6`, `U1`, `U2`, `M2` read live API responses; Author unit tests updated in `a390edb`: `canvas/app/configuration.test.ts`, `moodle/app.test.ts`, `cogniate-app/src/app/{canvas-configuration,connect}.test.ts`; LA suites: `tests/ltiaas/tasks-core/LA-E3-07/nrps-scopes.{k0,k1sim}.test.ts`) | `LA-ADR-05` D4, `LA-ADR-01` D3, `LA-ADR-04` D8 |
| `LA-IC-12` | `tests/ltiaas/golden/expected/LA-IC-12.json` | **None at `LA-E3-04`** (`changes: []`; `G1`–`G4` do not capture Deep Linking `GET /api/idtoken` or empty Deep Linking calls; `LA-E3-05` will add `"Cancel"` to `G4.{blackboard,canvas}.pages.picker.text`) | **None** (`0` frozen tests; scan of `T3a/1-deep-linking.spec.ts:46-54`, `T3a/3-negative.spec.ts:57-78`, `T3c/1-endpoints.spec.ts:80-115,229-236`, `M1/canvas/21-canvas-protocol.test.ts:40-46`, `lib/moodle-dl.ts:330`, `e2e/lib/moodle.ts:413`, `e2e/M2/07-sim-scenario.m2.ts:36`, and `golden/capture.golden.ts:90-105` confirmed no frozen test sends `contentItems: []` expecting `400` or checks `launch.deepLinkingSettings` by whole-object equality; Author unit tests updated in `3344520`: `lti/deep-linking.test.ts`, `http/routes/compat.test.ts`, `lti/idtoken.test.ts`) | `LA-ADR-05` D3, `LA-ADR-04` D8 |
| `LA-IC-13` | `tests/ltiaas/golden/expected/LA-IC-13.json` | **None** (`changes: []`; `G1`–`G4` grade with numeric scores, do not capture `/api/platforms` DTOs or call `/api/memberships`, and use the simulator's single `clientId` audience) | **None** (`0` frozen tests; scan of `T3a/2-scores.spec.ts:33-35,77-95`, `T3a/3-negative.spec.ts:80-170`, `T3b/{1-registration.spec.ts:85-93,2-update.spec.ts:74-76,4-line-items.spec.ts:45-95}`, `T3c/1-endpoints.spec.ts:157-195,241-256`, `T2b/qa-platform.test.ts:82-90`, `M1/common/00-profiles.test.ts:49-61,76-80`, `M1/blackboard/{10-deployments.test.ts:17-60,20-protocol.test.ts:12-29,47,40-routing-grades.test.ts:135-144}`, `M1/canvas/{11-canvas-platforms.test.ts:16-70,21-canvas-protocol.test.ts:73,181-203,41-canvas-grades.test.ts:306-316}`, `sim/core/provider.mjs:66,76`, and `golden/capture.golden.ts:80-176,183-261` confirmed no frozen test posts `scoreGiven: null` expecting `400`, sends NRPS `service_versions` without `'2.0'`, or asserts `Object.keys` on `/api/platforms` where `trustedAudiences: []` is returned; the only frozen multi-audience test `T2b/qa-platform.test.ts:82-90` (`AC-T2-24`) omits `azp` and already expects `INVALID_ISSUER_OR_AUDIENCE`; Author unit tests updated in `a2dfc04`: `platform/ags.test.ts`, `platform/platform.test.ts`, `lti/checks.test.ts`, `lti/idtoken.test.ts`, `http/routes/platforms.test.ts`, `store/platforms.test.ts`) | `LA-ADR-05` D10, `LA-ADR-07` D8, `LA-ADR-04` D8 |
| `LA-IC-14` | `tests/ltiaas/golden/expected/LA-IC-14.json` | `13` paths across `G1` and `G3`: `G1.{acceptance,default}.lmsProviders.lms[1].capabilities.dynamicRegistration` (`true`), `G1.{acceptance,default}.lmsProviders.lms[1].methods[1]` (`"dynamic"`), `G1.lmsProvidersAfter.lms[1].capabilities.dynamicRegistration` (`true`), `G1.lmsProvidersAfter.lms[1].methods[1]` (`"dynamic"`), `G1.connectionList.connections[0..1].capabilities.dynamicRegistration` (`true`), `G1.connections["canvas-{connected,disabled,pending,registered}"].capabilities.dynamicRegistration` (`true`), `G3.canvas.connection.capabilities.dynamicRegistration` (`true`) | `3` frozen M1 cases in `tests/acceptance/M1/canvas/11-canvas-platforms.test.ts:218-265` (`M1-15.canvas.dto`, `M1-15.canvas.dynamic-refused`, `M1-15.canvas.lms-providers`); K0 legacy flag oracle updated in `tests/ltiaas/k0/contract.test.ts:597`; QA task suites touched: `tests/ltiaas/tasks-lti/LA-E2-01/profile-traits.k0.test.ts:123-156`, `tests/ltiaas/tasks-core/LA-E1-02/registry.k0.test.ts:80-87,181-203`, `tests/ltiaas/tasks-core/LA-E3-15/canvas-dr-app.k0.test.ts`, `tests/ltiaas/tasks-lti/LA-E3-09/canvas-dr.{k0,k1sim}.test.ts` | `LA-ADR-05` D6, `BD-A1-103..107`, `BD-A2-89`, `LA-ADR-04` D8 |
| `LA-IC-15` | `tests/ltiaas/golden/expected/LA-IC-15.json` | `G3.blackboard.publications.B-conflict.results[0].scoreSyncs[0].lastError` (`"... (Blackboard has a grade with a newer time)"`) and `G3.canvas.publications.B-conflict.results[0].scoreSyncs[0].lastError` (`"... (Canvas has a grade with a newer time)"`) | **None** (`0` frozen tests; scan of `T6/4-results.spec.ts:83-85`, `T5b/4-conflict-resend.spec.ts:76-81`, `M1/blackboard/40-routing-grades.test.ts:145-158`, `M1/canvas/41-canvas-grades.test.ts:318-329`, `e2e/M2/{05-publish-results.m2.ts:34-57,07-sim-scenario.m2.ts:66-106}`, `golden/capture.golden.ts:144-169`, `G3.json:363,1076`, and `G4.json:121-136,312-327` confirmed `T6` and `T5b` run on a Moodle connection while `M1`/`M2` do not assert the `409` conflict `lastError` suffix; Author unit tests updated in `a285bdb`: `services/cogniate-app/src/drivers/lti-ags/reporter.test.ts:55-57`, `packages/tracking/src/tracking.test.ts:235-250`; LA suites: `tests/ltiaas/tasks-core/LA-E4-03/reporter.{k0,k1sim}.test.ts`) | `BD-A1-27`, `LA-ADR-04` D8 |
| `LA-IC-16` | `tests/ltiaas/golden/expected/LA-IC-16.json` | `G1.acceptance.ltiHealth.outbound_allowlist` (rule `sim-hosts-allowlist` when `LA-IC-16` is in `expected`: `.sim.test` entries equal as a set the union of `allowlist` hosts in `tests/sim/hosts.json` at the compared SHA; non-`.sim.test` entries equal G-BASE `["moodle.test", "qa-platform.test", "evil.test"]`; `default.*Health.outbound_allowlist` and `acceptance.appHealth.outbound_allowlist` stay strictly equal to G-BASE) | **None** (`0` frozen tests; scan of `golden/capture.golden.ts:183-193`, `T1/tls-health.test.ts:119-128`, `T2b/zz-logs.spec.ts:39-40`, `M1/common/{00-profiles.test.ts:23-29,90-simulation-gates.test.ts:16-18}`, `e2e/{0-start.spec.ts:11-22,9-end.spec.ts:6-17,host/run-m2.mjs:125-135}`; `tests/ltiaas/tasks-lti/LA-E1-05/profiles.k1sim.test.ts` `AC-LA-E1-05-07` and `AC-LA-E1-05-09` compare via `diff`/`compareCaptures` with this rule) | `BD-A1-36`, `LA-ADR-04` D8 |
| `LA-IC-17` | `tests/ltiaas/golden/expected/LA-IC-17.json` | **None** (`changes: []`) | **None** (`0` frozen tests; scan of `T4b1/1-connect.spec.ts:128-134`, `T4b1/3-security.spec.ts:116`, `T4b1/4-adoption.spec.ts:17-24,54,65,75`, `T6/2-connect.spec.ts:133,148-151`, `M1/canvas/41-canvas-grades.test.ts:89-90`, `M1/canvas/61-canvas-containment.test.ts:156-158`, `lib/portal.ts:28`, `e2e/2-scenario-b.spec.ts:52`, `golden/capture.golden.ts:194-200`, and `acceptance/lib/qa-platform.ts:43` confirmed every Moodle/standard `PUT /app-api/connections/:id/platform` body sends only the 6 documented keys `issuer`, `clientId`, `deploymentId`, `authenticationEndpoint`, `accessTokenEndpoint`, `jwksUrl`, while golden capture leaves G1 Moodle connections `pending` and makes no app `PUT /app-api/connections/:id/platform` call) | `BD-A1-41`, `LA-ADR-04` D8 |
| `LA-IC-18` | `tests/ltiaas/golden/expected/LA-IC-18.json` | **None** (`changes: []`; `G1`–`G4` capture API DTOs, simulator records, and tool pages, not portal UI components) | **None** (`0` frozen tests; scan in `LA-IC-18.json` of `tests/e2e/M2/00..08`, `tests/e2e/{1-scenario-a,2-scenario-b}.spec.ts`, `tests/acceptance/T6/{1,2,3,5}-*.spec.ts`, and `golden/capture.golden.ts:80-176,178-261` confirmed (a) `PublishDialog` names `lmsNames[result.lms]` / `lmsNames[connection.lms]`, which stays `'Moodle'` in U1/U2 and is not rendered by M2 pre-publish/close checks, (b) `Connect.tsx` passes `manifest.card.color` to `IntegrationLogo` and no frozen test asserts the Connect-page logo colour class, and (c) `IntegrationLogo` adds `title={name}` and no frozen test asserts the logo `title` attribute) | `BD-A1-50`, `LA-ADR-04` D8 |
| `LA-IC-19` | `tests/ltiaas/golden/expected/LA-IC-19.json` | **None** (`changes: []`; `G1`–`G4` do not capture expired content-host `/rt/{token}/*` `410 RUNTIME_EXPIRED` responses) | **None** (`0` frozen tests; scan of `T5a/6-negative.spec.ts:75-84`, `T5a/1-content.spec.ts:69-85`, `acceptance/lib/t5.ts:305-331,364-390`, `M1/common/{course.ts:51-70,moodle-http.ts:63-68}`, `M1/canvas/{canvas.ts:114-120,browser.ts:192-199,70-canvas-browser.spec.ts:25-80}`, `e2e/{lib/learner.ts:40-65,M2/07-sim-scenario.m2.ts:38-65}`, `host/run-t5.mjs:183-193`, and `golden/capture.golden.ts:80-176,227-261` confirmed only `AC-T5-15` triggers `410 RUNTIME_EXPIRED` — on a Moodle session where bytes are unchanged — and asserts only status `410` and code `'RUNTIME_EXPIRED'`; Author unit test updated in `379f905` / `e770ff2`: `services/cogniate-app/src/tool-pages/lms-texts.test.ts`) | `BD-A1-57`, `LA-ADR-01` D12, `LA-ADR-04` D8 |
| `LA-IC-20` | `tests/ltiaas/golden/expected/LA-IC-20.json` | **None** (`changes: []`; `G1`–`G4` do not render portal `ChannelErrorNotice` / `ProviderErrorNotice` / `providerErrorMessage`, and server-side `LEGACY_APP_ERROR_TEXT` and `LEGACY_SELF_BINDING_TEXT` stay unchanged) | **None** (`0` frozen tests; scan of `e2e/M2/lib/m2.ts:35-53`, `e2e/M2/02-canvas-wizard.m2.ts:28-61,210-219`, `e2e/M2/03-blackboard-wizard.m2.ts:38-48,105-107`, `acceptance/T6/2-connect.spec.ts:148-152`, `acceptance/lib/portal.ts:176-181`, `acceptance/T4b1/4-adoption.spec.ts:54-68`, `e2e/{1-scenario-a.spec.ts:58-75,2-scenario-b.spec.ts:62-78}`, and `golden/capture.golden.ts:80-176,183-261` confirmed `ChannelErrorNotice` replaces only the five codes, baseline `texts.errors` keep `SITE_RULE_1` in all 3 manifests, `PLATFORM_IN_USE` in Moodle with the server sentence `"This {LMS} tool is already registered with Cogniate. In {LMS}, make a new tool for this library and use its values."` filled byte for byte, `SITE_RULE_5` and `PLATFORM_IN_USE` in Canvas, and `DEPLOYMENT_IN_USE` and `DEPLOYMENT_FIXED` in Blackboard byte for byte, while generic fallback appears only where a channel has no own text for one of the five codes, every M2 browser check runs on the channel that owns the text, and no T6/T4b1/U1/U2/M2 browser test triggers a portal notice for a code where the channel has no own text; Author unit tests updated in `2877245`, `ac1c339`, and `d252e02`: `channel-kernel/src/{manifest,legacy-wire}.test.ts`, `portal/src/connect/provider-errors.test.tsx`, `portal/src/channels/shell.test.tsx`, `channels/{canvas/portal/canvas,blackboard/portal/blackboard}.test.tsx`, `portal/src/portal.test.ts`) | `BD-A1-63`, `BD-A1-81`, `LA-ADR-01` D2/D12, `LA-ADR-04` D8 |
| `LA-IC-21` | `tests/ltiaas/golden/expected/LA-IC-21.json` | **None** (`changes: []`; `G1`–`G4` make no `POST /api/registrations/:id/complete` call) | **None** (`0` frozen tests; scan of `T3b/{1-registration.spec.ts:60-94,2-update.spec.ts:61-77,3-negative.spec.ts:18-30}`, `T4b1/{1-connect.spec.ts:67-94,4-adoption.spec.ts:15-80}`, `e2e/1-scenario-a.spec.ts:58-95`, and `golden/capture.golden.ts:80-176,183-261` confirmed a DR update keeps the stored `active` value on both `updatePlatformId` and duplicate-client paths while `autoActivate` applies only to a new platform, the app never sends `updatePlatformId`, and `AC-T3-26` updates the platform created in `AC-T3-03` which is already `active === true`; Author unit test updated in `f8fa4ff`: `services/lti-service/src/http/routes/registration.test.ts`) | `BD-A1-93`, `BD-A2-86`, `LA-ADR-02` D5, `LA-ADR-04` D8 |

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
