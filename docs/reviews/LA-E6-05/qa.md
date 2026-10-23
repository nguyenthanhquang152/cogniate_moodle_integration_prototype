Verdict: PASS (K0 + UNIT + K1-SIM)
Round: 1

# LA-E6-05 Connection health: record the key of an inline-key setup artifact (`packages/channels/canvas/app.ts`, `services/cogniate-app/src/kernel/**`): QA verification

Tester: QA-3 (Orca task `task_b937cc3de6cf`, dispatch `ctx_858db780926e`), 2026-10-23. Spec: `docs/architecture/ltiaas/tasks/LA-E6-05.md` (with `LA-ADR-08` D5, `data-model.md` §5a, and `cogniate-app-api-delta.md` §4.6). Suite: `tests/ltiaas/tasks-core/LA-E6-05/` (QA-3 test-first, authored in this round).

Independence: QA-3 authored `tests/ltiaas/tasks-core/LA-E6-05/` from `docs/architecture/ltiaas/tasks/LA-E6-05.md`, `LA-ADR-08` D5, `data-model.md` §5a, and `cogniate-app-api-delta.md` §4.6 without reading product source (`packages/channels/canvas/app.ts`, `services/cogniate-app/src/kernel/**`), Author notes or reviewer files (`services/cogniate-app/src/testkit.ts` lines 1–60 from Run 22 were used solely for the `QA_B` test user export name).

| Item | Value |
| --- | --- |
| SHA | `dc2a1b5ef06d1446aaa8225bfcff100248ed070a` (`dc2a1b5e`; holds `LA-E6-05` commit `8a73080` / merge `722b788b`) |
| Lane and slot | lane K; QA-3 Slot 4b (`DOCKER-YES` 12:53Z–14:00Z, stack `qa3-la-sim-r1`, `PUBLIC_PORT=9453`, `STACK_SUBNET=172.21.0.0/16`) |
| Clone | `~/cogniate-qa-runs/LA/qa3-slot4b-dc2a1b5e/clone`: `git clone --no-hardlinks --no-checkout`, detached at `dc2a1b5ef06d1446aaa8225bfcff100248ed070a`, push URL `DISABLED`, `npm ci` at root and `tests/`, `node_modules/.vitest-cache` and `node_modules/.vite` deleted before every Vitest run |
| Environment | macOS arm64, Node 24.21.0, npm 11.19.0, Docker Compose stack `qa3-la-sim-r1` (`dc2a1b5e`) |
| Artifacts | private run folders `~/cogniate-qa-runs/LA/qa3-slot4b-dc2a1b5e/` (umask 077): `artifacts/qa3-la-sim-r1-dc2a1b5e-2026-10-23T13-22-06-406Z/LA-E6-05/` (`vitest-k1sim.json`, `e6-05-k1sim-ac03.json`, `e6-05-k1sim-ac04.json`), `k0/LA-E6-05/` (`vitest-k0.log`, `e6-05-unit.log`, `e6-05-k0.log`, `e6-05-host-summary.json`, `head-sha.txt`, `status-after.txt` `0` bytes), `boundary/` (`before-ps.txt`, `after-ps.txt`, `before-networks.txt`, `after-networks.txt`, `before-volumes.txt`, `after-volumes.txt`, `host-ps-watcher.log`) |

## Acceptance criteria

| AC | Result | Test id | Command | Evidence |
| --- | --- | --- | --- | --- |
| AC-LA-E6-05-01 | PASS (UNIT + K0 host DB check) | `tests/ltiaas/tasks-core/LA-E6-05/artifact-key-kid.k0.test.ts` + `packages/channels/canvas/app/configuration.test.ts` + `services/cogniate-app/src/app/canvas-configuration.test.ts` | `LA_LEVEL=k0 LA_SCRATCH_CLONE=$PWD LA_RUN_DIR=~/cogniate-qa-runs/LA/qa3-slot4b-dc2a1b5e/k0/LA-E6-05 npx --no-install vitest run --config tests/ltiaas/tasks-core/LA-E6-05/vitest.config.mts` | Temporary-database unit and K0 tests confirm `GET /app-api/connections/:id/canvas-configuration?jwk=inline` returns `200`, embeds the first JWKS key (`kid: "kid-inline-active-01"`), and writes `"kid-inline-active-01"` into `connection.artifact_key_kid` (`GET /app-api/connections/:id/health` reports `keys.artifactKeyKid: "kid-inline-active-01", keys.artifactKeyCurrent: true`). `e6-05-unit.log`, `e6-05-host-summary.json` |
| AC-LA-E6-05-02 | PASS (UNIT + K0 host DB check) | `artifact-key-kid.k0.test.ts` + `packages/channels/canvas/app/configuration.test.ts` + `services/cogniate-app/src/app/canvas-configuration.test.ts` | same | Temporary-database unit and K0 tests confirm `GET /app-api/connections/:id/canvas-configuration?jwk=url` (and default `GET /app-api/connections/:id/canvas-configuration`) writes `NULL` into `connection.artifact_key_kid` even after a prior `jwk=inline` export (`artifactKeyKidAfterUrl: null`). `e6-05-unit.log`, `e6-05-host-summary.json` |
| AC-LA-E6-05-03 | PASS (K1-SIM + UNIT) | `tests/ltiaas/tasks-core/LA-E6-05/artifact-key-kid.k1sim.test.ts > AC-LA-E6-05-03: Canvas JSON answers (jwk=url and jwk=inline) equal the golden JSON of LA-E3-07 and LA-E3-14 (no new member) and record artifact_key_kid` | `node tests/ltiaas/tasks-core/run-slot4b.mjs --batch r1 --stack qa3-la-sim-r1 --port 9453 --subnet 172.21.0.0/16` | `134.3 ms`: On the live stack (`PUBLIC_ORIGIN=http://localhost:9453`), `GET /app-api/connections/:id/canvas-configuration` and `?jwk=url` byte-for-byte equal the `LA-E3-07` golden JSON (with `public_jwk_url: "http://localhost:9453/lti/keys"` and top-level keys `["description","extensions","oidc_initiation_url","public_jwk_url","scopes","target_link_uri","title"]` — no extra members), while `?jwk=inline` matches the `LA-E3-14` golden JSON structure (replacing `public_jwk_url` with `public_jwk` holding the active RS256 JWK `lti-2026-10-23-f42dd19b` and 0 extra members) and updates `connection.artifact_key_kid` (`"lti-2026-10-23-f42dd19b"` after `jwk=inline`, `null` after `jwk=url`). `e6-05-k1sim-ac03.json` |
| AC-LA-E6-05-04 | PASS (K1-SIM + K0 host DB check) | `artifact-key-kid.k1sim.test.ts > AC-LA-E6-05-04: exporting another library connection gives 404 and writes nothing to connection.artifact_key_kid` | same | `113.2 ms`: Exporting `qa-a@cogniate.local`'s connection as `qa-b@cogniate.local` via `?jwk=inline` and `?jwk=url` returns `404` for both and leaves `connection.artifact_key_kid` unchanged (`null` when initially `null`, and `"lti-2026-10-23-f42dd19b"` when set before the cross-tenant attempt). `e6-05-k1sim-ac04.json`, `e6-05-host-summary.json` |

## Other checks

- **Exclusive file scope (`artifact-key-kid.k0.test.ts`):**
  - `git diff --name-only 8a73080^1 8a73080` touches only `packages/channels/canvas/app.ts`, `packages/channels/canvas/app/configuration.ts`, `packages/channels/canvas/app/configuration.test.ts`, `services/cogniate-app/src/kernel/mount.ts`, `services/cogniate-app/src/kernel/types.ts`, `services/cogniate-app/src/repositories/connections.ts`, and `services/cogniate-app/src/app/canvas-configuration.test.ts` (`0` edits to `services/cogniate-app/src/app/connection-health.ts`, `services/cogniate-app/src/domain/connection-events.ts`, or `apps/portal/**`).
- **Companion health view integration (`LA-E6-02` `AC-02` & `AC-03`):**
  - Verified on `qa3-la-sim-r1` that `LA-E6-05`'s `artifact_key_kid` write drives `LA-E6-02` `AC-02` (`keys.artifactKeyCurrent === true` right after `?jwk=inline` download) and `AC-03` (`keys.artifactKeyCurrent === false` after `lti-service` key rotation).
- **Measured time:** `LA-E6-05` K0 suite `2.20s` (`2/2` K0 tests passed; `2` Author unit test files in `1.47s`; `145/145` K0 contract tests in `559ms`); `LA-E6-05` K1-SIM suite `250ms` (`2/2` K1-SIM tests passed on `qa3-la-sim-r1`).
