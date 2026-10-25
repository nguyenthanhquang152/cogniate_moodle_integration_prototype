# LA-E5-07 — API Key Lifecycle (QA-2 Test Suite)

Test-first `K1-SIM` suite for **LA-E5-07** (`docs/architecture/ltiaas/tasks/LA-E5-07.md`, `docs/architecture/ltiaas/contracts/lti-service-api-delta.md` §1.2, §1.3, §3, §5, `LA-ADR-06` D5, and build decisions `BD-A2-09`, `BD-A2-10`, `BD-A2-12`).

## Acceptance Criteria Map

| AC ID | Test ID (Vitest) | Label | What It Needs |
| --- | --- | --- | --- |
| `AC-LA-E5-07-01` | `AC-LA-E5-07-01 after the migration, the existing cogniate key still passes LTIK-AUTH-V2, SERVICE-AUTH-V1 and Bearer calls` | `K1-SIM` | Running stack (`STACK_PROFILE=acceptance`) + `e2e` container: checks the `cogniate` `bootstrap` key row (`prefix: null` on backfilled rows per `BD-A2-09`, scopes `["launch","admin"]`) and verifies `Bearer`, `LTIK-AUTH-V2`, and `SERVICE-AUTH-V1` requests |
| `AC-LA-E5-07-02` | `AC-LA-E5-07-02 with two active keys, both pass; after revoke of the first, it gives 401 and the second passes` | `K1-SIM` | Running stack (`STACK_PROFILE=acceptance`) + `e2e` container: issues 2 keys on a fresh account, verifies both pass `GET /api/platforms`, revokes the first (`POST /operator/v1/accounts/:id/api-keys/:keyId/revoke`), and verifies the first gives `401` while the second gives `200` |
| `AC-LA-E5-07-03` | `AC-LA-E5-07-03 a third issue with two active keys gives 409 API_KEY_LIMIT` | `K1-SIM` | Running stack (`STACK_PROFILE=acceptance`) + `e2e` container |
| `AC-LA-E5-07-04` | `AC-LA-E5-07-04 a key with scopes ["launch"] gets 200 on GET /api/idtoken and 403 API_KEY_SCOPE_MISSING on GET /api/platforms; a key with scopes ["admin"] gets 403 API_KEY_SCOPE_MISSING on GET /api/idtoken` | `K1-SIM` | Running stack (`STACK_PROFILE=acceptance`) + `e2e` container + QA platform launch on a fresh account |
| `AC-LA-E5-07-05` | `AC-LA-E5-07-05 an issue with expiresAt 59 minutes ahead, or 2 years and 1 day ahead, gives 400 INVALID_REQUEST with the field expiresAt` | `K1-SIM` | Running stack (`STACK_PROFILE=acceptance`) + `e2e` container |
| `AC-LA-E5-07-06` | *(Author unit test with controlled clock)* | `UNIT` | Covered by Author unit tests (`npm run test:unit`) |
| `AC-LA-E5-07-07` | `AC-LA-E5-07-07 the issue answer shows apiKey once; GET .../api-keys shows prefix, label, scopes and dates, and never the key or its hash` | `K1-SIM` | Running stack (`STACK_PROFILE=acceptance`) + `e2e` container |
| `AC-LA-E5-07-08` | `AC-LA-E5-07-08 each issue and revoke writes one audit event (api_key.issue, api_key.revoke) with actor operator:<name> and no key value` | `K1-SIM` | Running stack (`STACK_PROFILE=acceptance`) + `e2e` container: queries `GET /operator/v1/audit` for `api_key.issue` (`ok` and `refused`) and `api_key.revoke`, plus secret scan |
| `AC-LA-E5-07-09` | *(Author unit migration test on M1 fixture DB)* | `UNIT` | Covered by Author unit tests (`npm run test:unit`) |
| `AC-LA-E5-07-10` | *(Author unit test for `last_used_at` 1-min throttle)* | `UNIT` | Covered by Author unit tests (`npm run test:unit`) |
| `AC-LA-E5-07-11` | `AC-LA-E5-07-11 on a fresh account with two API keys, after PATCH /operator/v1/accounts/<id> {status: "closed"}, GET .../api-keys shows revokedAt on both keys` | `K1-SIM` | Running stack (`STACK_PROFILE=acceptance`) + `e2e` container (also checks `409 ACCOUNT_CLOSED` on issue and idempotent `200` on revoke per `BD-A2-12`) |
| `AC-LA-E5-07-12` | `AC-LA-E5-07-12 a revoked key gives the unknown-key 401 on LTIK-AUTH-V2 and SERVICE-AUTH-V1 as well as on Bearer routes` | `K1-SIM` | Running stack (`STACK_PROFILE=acceptance`) + `e2e` container: compares revoked key vs unknown key on `Bearer`, `LTIK-AUTH-V2`, and `SERVICE-AUTH-V1` |
| `AC-LA-E5-07-13` | *(Author unit test (`BD-A2-12`): on a `closed` account, `POST …/api-keys` gives `409 ACCOUNT_CLOSED`, issues no key and writes one `refused` event; `GET …/api-keys` gives `200`; revoke of an already revoked key gives `200` with the first `revokedAt`; on a `suspended` account the issue gives `201`)* | `UNIT` | Covered by Author unit tests (`npm run test:unit`) |

## Commands

- **Typecheck (no Docker):**
  ```sh
  npx --prefix tests tsc --noEmit -p tests/ltiaas/tasks-ops/LA-E5-07/tsconfig.json
  ```
- **List tests (no Docker):**
  ```sh
  npx --prefix tests vitest list -c tests/ltiaas/tasks-ops/LA-E5-07/vitest.config.mts
  ```
- **Full `K1-SIM` run (requires a Docker window and an isolated QA clone):**
  ```sh
  COMPOSE_PROJECT_NAME=qa2-la-sim-r1 PUBLIC_PORT=9443 STACK_SUBNET=172.20.0.0/16 \
    node tests/ltiaas/tasks-ops/LA-E5-07/run.mjs --sha <integration-sha> --replace-tests
  ```
