# LA-E5-16 — `Idempotency-Key` (QA-2, K1-SIM)

Owner: QA-2 (`tests/ltiaas/tasks-ops/LA-E5-16/**`).
Spec: `docs/architecture/ltiaas/tasks/LA-E5-16.md`, `lti-service-api-delta.md` §1.3, §4.9, §7, `LA-ADR-06` D9.

## Coverage

| AC | Level | Covered in | What is checked |
| --- | --- | --- | --- |
| `AC-LA-E5-16-01` | `K1-SIM` | `idempotency.test.ts` | Two `POST /api/lineitems` calls with the same `Idempotency-Key` and body return the same `201` status and body, and the simulator (`/__sim/records`) records exactly one line item create; invalid `Idempotency-Key` grammar (`[A-Za-z0-9_-]{1,64}`) returns `400 INVALID_REQUEST` naming the header |
| `AC-LA-E5-16-02` | `K1-SIM` | `idempotency.test.ts` | Reusing the same `Idempotency-Key` with another body, course (`contextId`), or deployment returns `422 IDEMPOTENCY_KEY_REUSED` with the `BD-A2-58` description, and the simulator records no second call (`BD-A2-56`) |
| `AC-LA-E5-16-03` | `K1-SIM` | `idempotency.test.ts` | Two `POST /api/platforms` calls with the same `Idempotency-Key` and body return `201` with the same platform `id`, and `GET /api/platforms` lists one platform (also checks `POST /api/platforms/:id/deployments` idempotency and `422 IDEMPOTENCY_KEY_REUSED`) |
| `AC-LA-E5-16-04` | `UNIT` | Author unit test | Concurrent second request while the first runs returns `409 IDEMPOTENCY_IN_PROGRESS` with `Retry-After` and `details.retryAfter` (`BD-A2-58`) |
| `AC-LA-E5-16-05` | `K1-SIM` | `idempotency.test.ts` | The same `Idempotency-Key` used by account `qa-second` does not see the record of account `cogniate` (its call runs and creates its own platform object) |
| `AC-LA-E5-16-06` | `UNIT` | Author unit test | Record older than 24 hours is ignored (controlled clock) |
| `AC-LA-E5-16-07` | `K1-SIM` | `idempotency.test.ts` | Requests without `Idempotency-Key` behave as before (two `POST /api/lineitems` calls record two simulator creates; duplicate `POST /api/platforms` returns `409 PLATFORM_ALREADY_EXISTS`) |
| `BD-A2-56` | `K1-SIM` + `UNIT` | `idempotency.test.ts` + Author unit test | A refused target (`403 PLATFORM_NOT_ACTIVE` on a deactivated platform, `404 UNREGISTERED_PLATFORM` on an unknown platform) is never stored or replayed |
| `BD-A2-57` | `K1-SIM` + `UNIT` | `idempotency.test.ts` + Author unit test | A platform `429` (`Retry-After`) is not stored, so the retry with the same `Idempotency-Key` runs and creates the line item |
| `BD-A2-71` & `BD-A2-75` | `K1-SIM` + `UNIT` | `idempotency.test.ts` + Author unit test | A credential without the `lineitem` scope gets `403 SERVICE_NOT_AVAILABLE` (not a stored `201`) and its refused preflight is not stored so an authorized retry reaches the platform (`BD-A2-71`); an `ltik` and a service key of a no-context launch (`LA-E3-03`) share `contextId: ""` and one fingerprint (`BD-A2-75`) |

## Host-only check (no Docker)

```sh
./node_modules/.bin/tsc -p tests/ltiaas/tasks-ops/LA-E5-16/tsconfig.json --noEmit
./node_modules/.bin/vitest list -c tests/ltiaas/tasks-ops/LA-E5-16/vitest.config.mts
node --check tests/ltiaas/tasks-ops/LA-E5-16/run.mjs
```

## SIM slot execution

```sh
COMPOSE_PROJECT_NAME=qa2-la-sim-r1 PUBLIC_PORT=9443 STACK_SUBNET=172.20.0.0/16 \
  node tests/ltiaas/tasks-ops/LA-E5-16/run.mjs --sha <integration-sha> --replace-tests
```
