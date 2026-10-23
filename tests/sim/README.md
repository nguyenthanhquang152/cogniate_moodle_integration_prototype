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

## Fail-Closed Startup Rules (`README.md` §4b, `BD-A1-01` v1.1, `BD-A1-53`)

At startup, `loadProviders(runtime)` and `loadHostManifest(manifestPath)` in `tests/sim/server.mjs` validate `tests/sim/hosts.json` and all `tests/sim/<folder>/index.mjs` modules:

- Every directory under `tests/sim/` except `core` and dot directories must be a valid provider module with `index.mjs`.
- `version` must equal `1`, `providers` must be an array (`providers: []` is valid in `loadHostManifest`), and only `version` and `providers` top-level keys are valid.
- Every host in `aliases` and `allowlist` must be a lower-case DNS name (at most 253 characters, each label `[a-z0-9]` with inner `-` only and at most 63 characters) ending in `.sim.test`.
- The control host `lms-sim.test` is reserved and must never appear in `hosts.json`.
- Each host appears at most once in all `aliases` (inside one entry and across providers), and each `allowlist` entry appears at most once; any repeated host is refused (`BD-A1-53`).
- Every `allowlist` entry must be a subset of that provider's `aliases`.
- No host can belong to two different providers.
- Every loaded provider `config.id` must exist in `hosts.json`, and every `hosts.json` entry must have a loaded provider when the server starts (`loadProviders(runtime)` with no selection).
- Each provider's `hosts` array must equal its manifest entry's `aliases` set; a mismatch prints `missing in hosts.json: [...]; missing in the module: [...]`.

## Scenario Options (`POST /__sim/scenarios`)

`runtime.scenario(input)` validates every key against `SCENARIO_OPTIONS` and `DR_OPTIONS` (`tests/sim/core/runtime.mjs`). Unknown or misspelt keys fail closed with `400` (`Unknown scenario option "<key>" (did you mean "<closest>"?)`). Every option defaults to the baseline M1/M2 behaviour (and baseline `/__sim/records` keys) when omitted. Re-posting an existing `id` moves that scenario to the newest position and marks it as the active scenario for its provider. The active scenario of a provider is the scenario of its latest POST or latest auth request; `?scenario=<id>` overrides it.

### `scenario()` Return Shape

`POST /__sim/scenarios` returns `201`:

- `id`: Scenario ID (`login_hint`).
- `login`: Form fields for `POST` or `GET` to `/lti/login/<account>` (`iss`, `client_id`, `lti_deployment_id`, `login_hint`, `lti_message_hint`, `target_link_uri`, plus `lti_storage_target` when `storageTarget` is set).
- `registration`: Dynamic Registration helper fields (`openidConfiguration`, `registrationToken`, `tokenFormat`, `startUrl`).

### Canonical Top-Level Options (`SCENARIO_OPTIONS`)

<!-- SCENARIO_OPTIONS_START -->
| Option | Type | Default | Scope | Effect |
| --- | --- | --- | --- | --- |
| `id` | `string` | required | scenario | Scenario ID (`^[A-Za-z0-9._:-]{1,120}$`); used as `login_hint`. |
| `provider` | `string` | required | scenario | Provider ID from `tests/sim/hosts.json`. |
| `clientId` | `string` | required | scenario / client | OAuth2 `client_id` and ID token `aud`. |
| `deploymentId` | `string` | required | scenario | LTI `deployment_id` (UUID required when `deploymentFormat === 'uuid'` unless `allowNonUuidDeployment: true`). |
| `siteHost` | `string` | required | scenario | `.sim.test` service host from `config.sites[].host`. |
| `pageHost` | `string` | `siteHost` | scenario | `.sim.test` browser host for `/__frame`, `return_url`, and Deep Linking return. |
| `messageType` | `string` | `'LtiResourceLinkRequest'` | scenario | `'LtiResourceLinkRequest'` or `'LtiDeepLinkingRequest'`. |
| `subject` | `string` | `'learner-1'` | scenario | ID token `sub` and expected AGS score `userId`. |
| `contextId` | `string` | `'context-1'` | scenario | `context.id` claim and NRPS `context.id`. |
| `resourceLinkId` | `string` | `'resource-link-1'` | scenario | `resource_link.id` claim. |
| `resource` | `string` | `'fixture'` | scenario | Resource query parameter on `target_link_uri` and AGS line item slug. |
| `roles` | `string[]` | `[Learner]` | scenario | LTI `roles` claim array. |
| `claims` | `object` | `{}` | scenario | Top-level ID token claim overrides (replaces `deep_linking_settings` if present). |
| `omit` | `string[]` | `[]` | scenario | Claim keys deleted from the signed ID token after `claims` overrides. |
| `fault` | `string` | `undefined` | scenario | `'wrong-issuer'`, `'wrong-audience'`, `'multi-aud-no-azp'`, `'multi-aud-wrong-azp'`, `'expired'`, `'future-iat'`, `'wrong-nonce'`, `'unknown-key'`, `'tampered'`, `'alg-none'`. |
| `scoreAnswers` | `Array<number \| Answer>` | `[]` | scenario | Queued answers for `POST .../scores` (falls back to `204` when exhausted). |
| `issuer` | `string` | `config.issuer` | scenario | Overrides ID token `iss`, Deep Linking expected `aud`, and OpenID configuration `issuer`. |
| `family` | `string` | `config.family` | scenario | Overrides `tool_platform.product_family_code`. |
| `documentTarget` | `'window' \| 'iframe'` | `config.documentTarget ?? 'window'` | scenario | Overrides `launch_presentation.document_target`. |
| `dlData` | `'claim' \| 'query'` | `config.dlData` | scenario | Deep Linking `data` carrier. |
| `dlSubject` | `boolean` | `config.dlSubject` | scenario | Whether the Deep Linking response JWT must carry `sub === clientId`. |
| `dlWindowHint` | `boolean` | `config.dlWindowHint ?? true` | scenario | Whether Deep Linking items require `window: { targetName: '_blank' }`. |
| `tokenAudience` | `'string' \| 'array' \| string` | `config.token.audience` | newest scenario of `clientId` | Expected `aud` on `POST` to the token endpoint. |
| `allowNonUuidDeployment` | `boolean` | `false` | scenario | Allows non-UUID `deploymentId` when provider `deploymentFormat === 'uuid'`. |
| `dr` | `object` | `undefined` | scenario | Dynamic Registration options object (validated against `DR_OPTIONS`). |
| `tokenAnswers` | `Array<number \| 'invalid_client' \| Answer>` | `[]` | newest scenario of `clientId` | Queued answers for `POST` to the token endpoint; adds `status` (and `retryAfter` / `error`) to the `token` record. |
| `nrpsAnswers` | `Array<number \| Answer>` | `[]` | scenario (`clientId` + `siteHost`) | Queued answers for `GET` on `site.nrps`; adds `status` (and `retryAfter`) to the `nrps` record. |
| `acceptMultiple` | `boolean` | `false` | scenario | Sets `deep_linking_settings.accept_multiple` and allows `1..20` returned items when `true`. |
| `acceptLineitem` | `boolean` | `undefined` | scenario | Sets `deep_linking_settings.accept_lineitem`; when `false`, returned items must omit `lineItem`. |
| `acceptMediaTypes` | `string` | `undefined` | scenario | Sets `deep_linking_settings.accept_media_types`. |
| `dlSettings` | `object` | `{}` | scenario | Merged into the default `deep_linking_settings` object before `claims` overrides. |
| `dlAllowCancel` | `boolean` | `false` | scenario | When `true`, allows `content_items: []` on Deep Linking return and records `itemCount` and `cancelled`. |
| `members` | `Array<object>` | `[]` | scenario (`clientId` + `siteHost`) | Membership list returned by `GET` on `site.nrps`; when set, adds `memberCount` to the `nrps` record. |
| `storageTarget` | `string` | `undefined` | active scenario (or `?scenario=<id>`) | Adds `lti_storage_target` to `login` and includes the hidden storage frame on `/__frame`. |
| `secondKey` | `boolean` | `false` | active scenario (or `?scenario=<id>`) | Signs the ID token with `signer2`, includes `kid` in the `auth` record, and exposes both keys on JWKS. |
| `jwksKeys` | `'first' \| 'both' \| 'second-only'` | `'first'` | active scenario (or `?scenario=<id>`) | Controls which signing keys appear on the JWKS endpoint. |
| `institutionAdmin` | `boolean` | `false` | scenario | Replaces the default Learner role with `'http://purl.imsglobal.org/vocab/lis/v2/institution/person#Administrator'`. |
| `extraAud` | `string \| string[]` | `undefined` | scenario | Sets `aud` to `[clientId, ...extraAud]` and `azp` to `clientId` (unless `azp` is set). |
| `azp` | `string \| null` | `undefined` | scenario | Overrides `azp` when `extraAud` is set (`null` omits `azp`). |
| `ungradedPlacement` | `boolean` | `false` | scenario | Appends `cogniate_placement=ungraded` to `target_link_uri` and requires Deep Linking items to omit `lineItem`. |
| `allowNullScore` | `boolean` | `false` | scenario | Allows a score `POST` with `scoreGiven` omitted. |
<!-- SCENARIO_OPTIONS_END -->

### Dynamic Registration Options (`scenario.dr`, `DR_OPTIONS`)

<!-- DR_OPTIONS_START -->
| Option | Type | Default | Effect |
| --- | --- | --- | --- |
| `dr.issuer` | `string` | `scenario.issuer ?? config.issuer` | `issuer` in OpenID configuration; if it has a path prefix, endpoints in the document and route matcher use that prefix. |
| `dr.secondTokenHost` | `boolean` | `false` | Places `token_endpoint` on `config.dr.secondTokenHost`. |
| `dr.tokenHost` | `string` | `config.dr.defaultTokenHost` | `.sim.test` hostname for `token_endpoint`. |
| `dr.tokenEndpoint` | `string` | computed | Full `token_endpoint` URL in OpenID configuration. |
| `dr.authorizationServer` | `string \| null` | `config.dr.authorizationServer ?? null` | `authorization_server` claim in OpenID configuration. |
| `dr.tokenFormat` | `'opaque-bearer' \| 'moodle-scope-jwt'` | `config.dr.tokenFormat ?? 'opaque-bearer'` | Registration Bearer token format. |
| `dr.operation` | `'new' \| 'update'` | `'new'` | Sets the Moodle-style registration JWT `scope` to `'reg'` (`'new'`) or `'reg-update'` (`'update'`). |
| `dr.updateId` | `string` | `scenario.deploymentId` | `sub` claim of a Moodle-style `'reg-update'` registration JWT. |
| `dr.registrationToken` | `string` | auto-generated | Custom registration Bearer token value (opaque or JWT). |
| `dr.strictOpaque` | `boolean` | `false` | Refuses a 3-part JWT when `tokenFormat` is `'opaque-bearer'`. |
| `dr.enforceToken` | `boolean` | `false` | Requires the registration `Authorization: Bearer` token to equal `scenario.registration.registrationToken`. |
| `dr.scopesSupported` | `string[]` | `['openid', ...SCOPES]` | `scopes_supported` array in OpenID configuration. |
| `dr.messagesSupported` | `Array<object>` | resource link + Deep Linking | `messages_supported` array in OpenID configuration. |
| `dr.grantedScope` | `string` | requested `body.scope` | `scope` returned in the registration response. |
<!-- DR_OPTIONS_END -->

### Legacy Aliases (Kept Only for Frozen `LA-E5-14` Test Compatibility)

<!-- LEGACY_ALIASES_START -->
| Legacy Alias | Canonical Option | Used By |
| --- | --- | --- |
| `tokenAnswer` | `tokenAnswers` | `tests/ltiaas/tasks-lti/LA-E5-14/throttling.k1sim.test.ts` |
| `tokenStatus` | `tokenAnswers` | `tests/ltiaas/tasks-lti/LA-E5-14/throttling.k1sim.test.ts` |
| `nrpsAnswer` | `nrpsAnswers` | `tests/ltiaas/tasks-lti/LA-E5-14/throttling.k1sim.test.ts` |
| `membershipsAnswers` | `nrpsAnswers` | `tests/ltiaas/tasks-lti/LA-E5-14/throttling.k1sim.test.ts` |
| `membershipsAnswer` | `nrpsAnswers` | `tests/ltiaas/tasks-lti/LA-E5-14/throttling.k1sim.test.ts` |
| `nrpsStatus` | `nrpsAnswers` | `tests/ltiaas/tasks-lti/LA-E5-14/throttling.k1sim.test.ts` |
| `membershipsStatus` | `nrpsAnswers` | `tests/ltiaas/tasks-lti/LA-E5-14/throttling.k1sim.test.ts` |
<!-- LEGACY_ALIASES_END -->

### Queued Answer Objects (`scoreAnswers`, `tokenAnswers`, `nrpsAnswers`)

Each entry in `scoreAnswers`, `tokenAnswers`, or `nrpsAnswers` can be an HTTP status number (for example `429` or `503`), `'invalid_client'` (for `tokenAnswers`), or an object `{ status, retryAfter, headers, message, body, error, persistent }`:

- `retryAfter`: Sets the `Retry-After` response header and records `retryAfter` in `/__sim/records`.
- `headers`: Additional HTTP response headers.
- `message` (or `body`): Error message string in the JSON response body.
- `error`: Error code in the JSON response body (for example `'invalid_client'` or `'rate_limit_exceeded'`).
- `persistent`: When `true`, keeps the entry at the front of the queue instead of advancing the index.

### Query Parameters and Reserved Bearer Tokens

- **OpenID configuration URL query parameters**: `?scenario=<id>` selects the scenario; `?second_token_host=1`, `?token_host=<host>`, and `?authorization_server=<val>` override the corresponding fields when not set on `scenario.dr`.
- **JWKS and `/__frame` query parameters**: `?scenario=<id>` selects the scenario for `secondKey` / `jwksKeys` and `storageTarget`; `/__frame` also accepts `?storage=<target>` or reads `login_hint` / `lti_storage_target` from its `url` parameter.
- **Reserved invalid registration Bearer tokens**: `Authorization: Bearer invalid` and `Authorization: Bearer bad-token` are always rejected with `400` on `POST` to the registration endpoint.

## Host-Only Self-Tests

Run all simulator self-tests on the host without Docker using one glob command:

```sh
node --test 'tests/sim/core/*.test.mjs' 'tests/sim/*/protocol.test.mjs'
```
