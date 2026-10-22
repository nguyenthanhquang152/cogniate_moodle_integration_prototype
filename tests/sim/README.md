# LTI 1.3 LMS Simulator (`tests/sim`)

The LMS simulator provides clean-room 1EdTech LTI 1.3 and LTI Advantage platforms for QA verification.

## Add a Simulator LMS (One Module + One Manifest Entry)

You do not edit `tests/sim/server.mjs` or `infra/scripts/lib.sh` to add a simulator LMS. Copy `tests/sim/generic/index.mjs` to start, then complete these three steps:

1. **Create the provider module** at `tests/sim/<folder>/index.mjs`:
   - Every folder under `tests/sim/` except `core/` and dot folders is loaded as a provider module at startup. Do not put helper folders under `tests/sim/`; a folder without `index.mjs` stops simulator startup (fail closed).
   - Export `createProviders(runtime)` returning a non-empty array of `createProvider(runtime, config)` objects.
   - `config.id` is the provider ID (for example `<folder>-sim` or `<folder>-sim-<variant>`), and its value must equal the `providers[].id` entry in `tests/sim/hosts.json`.
   - Use lower-case DNS hostnames ending in `.sim.test` for `auth.host`, `jwks.host`, `token.hosts`, `sites[].host`, and `pageHosts`.

2. **Add the provider entry to `tests/sim/hosts.json`**:
   - Add `{ "id": "<config.id>", "aliases": [...], "allowlist": [...] }` to the `providers` array.
   - `aliases` must contain the exact set of hostnames that the provider exposes (`provider.hosts`).
   - `allowlist` must be a subset of `aliases` and list only the hostnames that the LTI service calls server-to-server (JWKS, OAuth2 token, OpenID configuration, registration, AGS, and NRPS). Exclude browser-only `pageHosts`. Today the only browser-only alias is `canvas.school-a.sim.test` (the Canvas page host of M3).

3. **Make the new hosts live in the stack**:
   - Run `STACK_PROFILE=acceptance npm run stack:up` (during a booked Docker window). `stack:up` re-runs `gen-certs.sh` to issue a new QA leaf certificate (`infra/.certs/qa.crt`) with the updated SANs, writes the Compose alias override (`.tmp/compose.sim-hosts.yaml`), and updates the `acceptance` `OUTBOUND_PRIVATE_HOST_ALLOWLIST`. (`npm run stack:restart` does not issue a new QA leaf certificate.)
   - On the tool side, register a matching LTI profile in a channel folder (`packages/channels/<id>/lti-profiles.ts`) before running end-to-end launches.

## Config Fields (`createProvider(runtime, config)`)

| Field | Required | Meaning | Example (`tests/sim/generic/index.mjs`) |
| --- | --- | --- | --- |
| `id` | yes | Unique provider ID; must equal `providers[].id` in `tests/sim/hosts.json`. | `'generic-sim'` |
| `issuer` | yes | Platform `iss` URL (`https://...`, origin or origin + path). | `'https://generic.sim.test/lti'` |
| `family` | yes | 1EdTech `tool_platform.product_family_code` claim value. | `'generic'` |
| `deployments` | no | Array of deployment IDs for the provider. | `['deploy-generic-1', 'deploy-generic-2', 'deploy-generic-3']` |
| `deploymentFormat` | no | Set to `'uuid'` to require UUID deployment IDs unless `allowNonUuidDeployment` is set on the scenario. | `'uuid'` (`brightspace-sim`) |
| `auth` | yes | `{ host, path, methods }` for the OIDC authentication endpoint. | `{ host: 'generic.sim.test', path: '/lti/oidc/auth', methods: ['GET', 'POST'] }` |
| `jwks` | yes | `{ host, path }` for the platform public keyset endpoint. | `{ host: 'generic.sim.test', path: '/lti/jwks.json' }` |
| `token` | yes | `{ hosts, path, audience }` for OAuth2 `client_credentials` tokens (`audience`: `'string'`, `'array'`, or a fixed audience URI). | `{ hosts: ['token.generic.sim.test', 'generic.sim.test'], path: '/lti/oauth2/token', audience: 'string' }` |
| `dr` | no | `{ hosts, configPaths, registrationPaths, tokenFormat, defaultTokenHost, secondTokenHost, authorizationServer }` for Dynamic Registration. | `{ hosts: ['generic.sim.test', 'school-b.generic.sim.test'], configPaths: ['/lti/.well-known/openid-configuration', '/.well-known/openid-configuration'], registrationPaths: ['/lti/register'], tokenFormat: 'opaque-bearer' }` |
| `sites` | yes | Non-empty array of `{ host, lineitems, nrps, dlReturn }` service routes. | `[{ host: 'generic.sim.test', lineitems: '/lti/courses/course-1/lineitems', nrps: '/lti/courses/course-1/memberships', dlReturn: '/lti/deep-link/return' }]` |
| `pageHosts` | no | Browser-only `.sim.test` hosts that serve `/__frame` and `dlReturn` without token, AGS, or NRPS routes. | `[]` (`['canvas.school-a.sim.test']` on `canvas-sim-cloud`) |
| `dlData` | yes | Deep Linking `data` carrier (`'claim'` in the DL settings claim or `'query'` on `deep_link_return_url`). | `'claim'` |
| `dlSubject` | yes | Whether the Deep Linking response JWT must carry `sub = client_id`. | `false` |
| `dlWindowHint` | no | Whether Deep Linking items require `window: { targetName: '_blank' }` (default `true`). | `true` (`false` on `moodle-sim`) |
| `documentTarget` | no | Default `launch_presentation.document_target` (`'window'` or `'iframe'`, default `'window'`). | `'window'` |

## Fail-Closed Startup Rules (`README.md` §4b, `BD-A1-01` v1.1)

At startup, `loadProviders(runtime)` and `loadHostManifest(manifestPath)` in `tests/sim/server.mjs` validate `tests/sim/hosts.json` and all `tests/sim/<folder>/index.mjs` modules:

- Every directory under `tests/sim/` except `core` and dot directories must be a valid provider module with `index.mjs`.
- `version` must equal `1`, `providers` must be an array (`providers: []` is valid in `loadHostManifest`), and only `version` and `providers` top-level keys are valid.
- Every host in `aliases` and `allowlist` must be a lower-case DNS name (at most 253 characters, each label `[a-z0-9]` with inner `-` only and at most 63 characters) ending in `.sim.test`.
- The control host `lms-sim.test` is reserved and must never appear in `hosts.json`.
- Repeated hosts inside one provider entry's `aliases` or `allowlist` are merged to one host.
- Every `allowlist` entry must be a subset of that provider's `aliases`.
- No host can belong to two different providers.
- Every loaded provider `config.id` must exist in `hosts.json`, and every `hosts.json` entry must have a loaded provider when the server starts (`loadProviders(runtime)` with no selection).
- Each provider's `hosts` array must equal its manifest entry's `aliases` set; a mismatch prints `missing in hosts.json: [...]; missing in the module: [...]`.

## Scenario Options (`POST /__sim/scenarios`)

Every new option defaults to the baseline M1/M2 behaviour when you omit it. When you post a scenario with an existing `id`, `runtime.scenario` moves that scenario to the newest position so per-client lookups (`byClient`) always use the most recently posted scenario of that `clientId`:

- **Core / provider overrides (`LA-E7-02`)**: `issuer`, `family`, `documentTarget`, `dlData` (`'claim'` or `'query'`), `dlSubject` (boolean), `dlWindowHint` (boolean, default `true`), `tokenAudience` (`'string'`, `'array'`, or a custom audience URI), `allowNonUuidDeployment` (boolean).
- **Dynamic Registration (`LA-E7-05`)**: `dr` object or top-level `secondTokenHost`, `tokenHost`, `tokenEndpoint`, `authorizationServer`, `registrationTokenFormat` (`'opaque-bearer'` or `'moodle-scope-jwt'`), `dr.operation` (`'new'` or `'update'`), `scopesSupported`, `messagesSupported`.
- **Throttling (`LA-E7-05`)**: `scoreAnswers`, `tokenAnswers` (or `tokenAnswer` / `tokenStatus` / `tokenError`), `nrpsAnswers` / `membershipsAnswers` (each item can set `status`, `retryAfter`, `headers`, `message`, `error`).
- **Deep Linking (`LA-E7-05`)**: `acceptMultiple`, `acceptLineitem`, `acceptMediaTypes`, `dlSettings` / `deepLinkingSettings`; the return endpoint accepts `content_items: []` (Cancel) and `1..20` items when `accept_multiple` is true.
- **NRPS (`LA-E7-05`)**: `members` (or `nrpsMembers`, default `[]`).
- **Platform storage (`LA-E7-05`)**: `storageTarget` (or `platformStorage: true`, default omitted).
- **Should / Could (`LA-E7-05`)**: `secondKey` / `useSecondKey` / `jwksKeys`, `institutionAdmin` / `adminRole`, `tokenError: 'invalid_client'`, `extraAud`, `ungradedPlacement`.

## Host-Only Self-Tests

Run all simulator self-tests on the host without Docker using one glob command:

```sh
node --test 'tests/sim/core/*.test.mjs' 'tests/sim/*/protocol.test.mjs'
```
