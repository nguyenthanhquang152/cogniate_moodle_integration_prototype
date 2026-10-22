# LTI 1.3 LMS Simulator (`tests/sim`)

The LMS simulator provides clean-room 1EdTech LTI 1.3 and LTI Advantage platforms for QA verification.

## Add a Simulator LMS (One Module + One Manifest Entry)

You do not edit `tests/sim/server.mjs` or `infra/scripts/lib.sh` to add a simulator LMS. Add a provider in two steps:

1. **Create the provider module** at `tests/sim/<name>/index.mjs`:
   - Export `createProviders(runtime)` that returns a non-empty array of `createProvider(runtime, config)` objects.
   - Use `.sim.test` hostnames for `auth.host`, `jwks.host`, `token.hosts`, `sites[].host`, and `pageHosts`.

2. **Add the provider entry to `tests/sim/hosts.json`**:
   - Add `{ "id": "<provider-id>", "aliases": [...], "allowlist": [...] }` to the `providers` array.
   - `aliases` must contain the exact set of hostnames that the provider exposes (`provider.hosts`).
   - `allowlist` must be a subset of `aliases` and list only the hostnames that the tool calls server-to-server (JWKS, OAuth2 token, AGS, and NRPS). Exclude browser-only `pageHosts`.

## Fail-Closed Startup Rules

At startup, `loadProviders(runtime)` in `tests/sim/server.mjs` validates `tests/sim/hosts.json` and all `tests/sim/<name>/index.mjs` modules:

- Every directory under `tests/sim/` except `core` and dot directories must be a valid provider module with `index.mjs`.
- `version` must equal `1`, and only `version` and `providers` top-level keys are valid.
- Every host in `aliases` and `allowlist` must match `^[a-z0-9-]+(\.[a-z0-9-]+)*\.sim\.test$`.
- The control host `lms-sim.test` is reserved and must never appear in `hosts.json`.
- Every `allowlist` entry must be a subset of that provider's `aliases`.
- No host can belong to two providers.
- Every loaded provider ID must exist in `hosts.json`, and every `hosts.json` entry must have a loaded provider when the server starts.
- Each provider's `hosts` array must equal its manifest entry's `aliases` set.

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

Run the simulator self-tests on the host without Docker:

```sh
node --test tests/sim/core/*.test.mjs tests/sim/canvas/protocol.test.mjs tests/sim/blackboard/protocol.test.mjs
node --test tests/sim/generic/protocol.test.mjs tests/sim/brightspace/protocol.test.mjs
```
