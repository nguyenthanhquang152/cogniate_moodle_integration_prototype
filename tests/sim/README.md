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

- `version` must equal `1`, and only `version` and `providers` top-level keys are valid.
- Every host in `aliases` and `allowlist` must match `^[a-z0-9-]+(\.[a-z0-9-]+)*\.sim\.test$`.
- The control host `lms-sim.test` is reserved and must never appear in `hosts.json`.
- Every `allowlist` entry must be a subset of that provider's `aliases`.
- No host can belong to two providers.
- Every loaded provider ID must exist in `hosts.json`, and every `hosts.json` entry must have a loaded provider when the server starts.
- Each provider's `hosts` array must equal its manifest entry's `aliases` set.

## Host-Only Self-Tests

Run the simulator self-tests on the host without Docker:

```sh
node --test tests/sim/core/*.test.mjs tests/sim/canvas/protocol.test.mjs tests/sim/blackboard/protocol.test.mjs
node --test tests/sim/generic/protocol.test.mjs tests/sim/brightspace/protocol.test.mjs
```
