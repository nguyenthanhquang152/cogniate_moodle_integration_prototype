# LA-E5-15 — Service key revoke, re-issue epoch, write scope (QA-2, K1-SIM)

Owner: QA-2 (`tests/ltiaas/tasks-ops/LA-E5-15/**`).
Spec: `docs/architecture/ltiaas/tasks/LA-E5-15.md`, `lti-service-api-delta.md` §1.3, §3, §4.8, §5, `LA-ADR-06` D8, `LA-ADR-07` D7, `BD-A2-47`.

## Coverage

| AC | Level | Covered in | What is checked |
| --- | --- | --- | --- |
| `AC-LA-E5-15-01` | `K1-SIM` | `service-keys.test.ts` | `POST /api/service-keys/revoke {platformId}` with an `admin` key returns `200 { revoked: n }` (`n >= 1`); repeating with no active keys returns `200 { revoked: 0 }` and unknown `platformId` returns `404 UNREGISTERED_PLATFORM` (`BD-A2-47`); a score `POST` with the revoked service key returns the same `401` (`INVALID_SERVICE_AUTH_AUTHORIZATION_HEADER`) as an unknown service key |
| `AC-LA-E5-15-02` | `K1-SIM` | `service-keys.test.ts` | A revoke with `{ platformId, resourceLinkId }` revokes only that resource link (`revoked: 1`); the service key of another resource link on the same platform still returns `204` (`2xx`) on a score `POST` |
| `AC-LA-E5-15-03` | `K1-SIM` | `service-keys.test.ts` | After a revoke, the next learner launch of the same resource link shows a `services.serviceKey` in `GET /api/idtoken` that differs from the revoked value, and a score `POST` with it returns `204` (`2xx`) |
| `AC-LA-E5-15-04` | `UNIT` | Author unit test | Epoch 0 derived key value equals today's value for the same fixture row; epoch 1 differs |
| `AC-LA-E5-15-05` | `K1-SIM` | `service-keys.test.ts` | Verifies `serviceKeyWriteScope: "resource-link"` on a fresh account and on `cogniate` (restored to `"context"` in `finally`, tasks README §2 form (h)): a score `POST` (and line item `PUT`) with the service key of resource link A to the line item of resource link B gives `403 SERVICE_KEY_SCOPE`; the same `POST` to resource link A's own `lineitem` gives `204` (`2xx`) |
| `AC-LA-E5-15-06` | `K1-SIM` | `service-keys.test.ts` | With `serviceKeyWriteScope: "resource-link"`, an `LTIK-AUTH-V2` score `POST` from resource link A to resource link B's line item in the same course returns `204` (no `SERVICE_KEY_SCOPE`) |
| `AC-LA-E5-15-07` | `K1-SIM` | `service-keys.test.ts` | A key with scopes `["launch"]` on `POST /api/service-keys/revoke` returns `403 API_KEY_SCOPE_MISSING`; every successful revoke (tenant `POST /api/service-keys/revoke` and operator `POST /operator/v1/accounts/:id/service-keys/revoke`) writes one `service_key.revoke` audit event; `GET /operator/v1/accounts/:id/platforms` (`BD-A2-53`) returns `200 { platforms }` with no secret fields, `404 NOT_FOUND` on an unknown account, `200` on a closed account, and writes no audit event |

## Host-only check (no Docker)

```sh
./node_modules/.bin/tsc -p tests/ltiaas/tasks-ops/LA-E5-15/tsconfig.json --noEmit
./node_modules/.bin/vitest list -c tests/ltiaas/tasks-ops/LA-E5-15/vitest.config.mts
node --check tests/ltiaas/tasks-ops/LA-E5-15/run.mjs
```

## SIM slot execution

```sh
COMPOSE_PROJECT_NAME=qa2-la-sim-r1 PUBLIC_PORT=9443 STACK_SUBNET=172.20.0.0/16 \
  node tests/ltiaas/tasks-ops/LA-E5-15/run.mjs --sha <integration-sha> --replace-tests
```
