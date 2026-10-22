# LA-E5-14 Platform throttling answer `429 PLATFORM_RATE_LIMITED` — QA-4 test suite

Spec: `docs/architecture/ltiaas/tasks/LA-E5-14.md` (at `4c11521`, including BD-A2-15 and BD-A2-16). Design: `docs/architecture/ltiaas/contracts/lti-service-api-delta.md` §1.3, §1.6, §4.3, §6, §9; `docs/architecture/ltiaas/adr/LA-ADR-03-learning-record-core.md` D7 (`throttled`); `docs/architecture/ltiaas/adr/LA-ADR-04-refactor-and-migration.md` D8 (`LA-IC-11`); `docs/architecture/ltiaas/adr/LA-ADR-06-service-operability.md` D1 (`Retry-After` rule). Wave: B2 (lane L).

## Acceptance criteria map

| AC | Label | Verification owner | Summary |
| --- | --- | --- | --- |
| `AC-LA-E5-14-01` | `K1-SIM` | `throttling.k1sim.test.ts` (QA-4 SIM slot) | Simulator answers score POST with `429` and `Retry-After: 120`: `POST /api/lineitems/:id/scores` gives `429` with `details.message: 'PLATFORM_RATE_LIMITED'`, fixed `details.description` (BD-A2-15), header `Retry-After: 120` and `details.retryAfter: 120` (BD-A2-16). |
| `AC-LA-E5-14-02` | `K1-SIM` | `throttling.k1sim.test.ts` (QA-4 SIM slot) | Simulator answers `403` with a body that contains `Rate Limit Exceeded`: the call gives `429 PLATFORM_RATE_LIMITED` with `Retry-After: 60` and `details.retryAfter: 60` and no platform body text; a `403` with another body keeps today's answer (`502 PLATFORM_ERROR`). |
| `AC-LA-E5-14-03` | `K1-SIM` | `throttling.k1sim.test.ts` (QA-4 SIM slot) | Simulator token endpoint answers `429` without `Retry-After`: the API call gives `429 PLATFORM_RATE_LIMITED` with `Retry-After: 60` and `details.retryAfter: 60`. |
| `AC-LA-E5-14-04` | `K1-SIM` | `throttling.k1sim.test.ts` (QA-4 SIM slot) | Simulator answers `GET` memberships with `429`: `GET /api/memberships` gives `429 PLATFORM_RATE_LIMITED` with `Retry-After` and `details.retryAfter` equal to the same integer (1–3,600). |
| `AC-LA-E5-14-05` | `K1-SIM` | `throttling.k1sim.test.ts` (QA-4 SIM slot) | For one throttled score POST, the simulator records exactly one score request (no automatic retry), and `infra/.logs/lti-service.jsonl` has one `platform_rate_limited {platform_id, status, retry_after_s}` line. |
| `AC-LA-E5-14-06` | `UNIT` (+ `K0`) | Author unit test + `throttling.k0.test.ts` (QA-4 records; Reviewer-B checks quality) | `Retry-After: 7200` gives `3600`; `Retry-After: 0` gives `1`; an HTTP date 90 s ahead gives `90` (± 1); an unreadable value gives `60`; generic rule in `services/lti-service/src/http/retry-after.ts` (BD-A2-16); plus F1 count `0` on `error-mapping.ts`, `token-client.ts`, and `retry-after.ts`. |

## Running the suites

### 1. Typecheck and list (no Docker)

```sh
npx --prefix tests tsc --noEmit -p tests/ltiaas/tasks-lti/LA-E5-14/tsconfig.json
LA_LEVEL=k0 npx --prefix tests vitest list --config tests/ltiaas/tasks-lti/LA-E5-14/vitest.config.mts
LA_LEVEL=k1sim npx --prefix tests vitest list --config tests/ltiaas/tasks-lti/LA-E5-14/vitest.config.mts
```

### 2. K0 + UNIT verification (no Docker, against a clean clone at `<CLONE>`)

```sh
LA_TARGET_ROOT="<CLONE>" LA_RUN_DIR="<RUN_DIR>" LA_LEVEL=k0 \
  npx --prefix tests vitest run --config tests/ltiaas/tasks-lti/LA-E5-14/vitest.config.mts \
  tests/ltiaas/tasks-lti/LA-E5-14/throttling.k0.test.ts
```

### 3. K1-SIM acceptance (booked SIM slot, compose prefix `qa4-la-sim-r<round>`)

```sh
QA_PRODUCT_SHA="<40-char-sha>" QA_TEST_SHA="<40-char-sha>" LA_RUN_DIR="<RUN_DIR>" LA_LEVEL=k1sim \
  npx --prefix tests vitest run --config tests/ltiaas/tasks-lti/LA-E5-14/vitest.config.mts \
  tests/ltiaas/tasks-lti/LA-E5-14/throttling.k1sim.test.ts
```
