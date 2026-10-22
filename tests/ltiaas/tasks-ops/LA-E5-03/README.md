# LA-E5-03 — Rate Limits (QA-2 Test Suite)

Test-first `K1-SIM` suite for **LA-E5-03** (`docs/architecture/ltiaas/tasks/LA-E5-03.md`, `docs/architecture/ltiaas/contracts/lti-service-api-delta.md` §1.3, §1.4, §3, §6, and `LA-ADR-06` D1).

## Acceptance Criteria Map

| AC ID | Test ID (Vitest) | Label | What It Needs |
| --- | --- | --- | --- |
| `AC-LA-E5-03-01` | `AC-LA-E5-03-01 on a fresh account, with its api limit set to 5 per minute, burst 5, the 6th GET /api/idtoken within one minute gives 429 RATE_LIMITED with Retry-After >= 1; a cogniate request in the same second gives 200` | `K1-SIM` | Running stack (`STACK_PROFILE=acceptance`) + `e2e` container: creates a fresh account, sets `limits.api = { ratePerMinute: 5, burst: 5 }`, verifies 6th `GET /api/idtoken` gives `429 RATE_LIMITED` (`Retry-After >= 1`) while `cogniate` gives `200` |
| `AC-LA-E5-03-02` | `AC-LA-E5-03-02 with protocol set to 3 per minute, burst 3 (PATCH /operator/v1/rate-limits), the 4th login from one address within one minute gives the 429 page with data-error-code="RATE_LIMITED" and no Set-Cookie` | `K1-SIM` | Running stack (`STACK_PROFILE=acceptance`) + `e2e` container (restores `protocol: null` in `finally`) |
| `AC-LA-E5-03-03` | `AC-LA-E5-03-03 untrusted peer: with protocol at 3 per minute, four logins sent from the e2e container straight to the LTI service, each with another X-Forwarded-For value, give 429 on the 4th` | `K1-SIM` | Running stack (`STACK_PROFILE=acceptance`) + `e2e` container sending direct HTTP requests to `http://lti-service:4100/lti/login/cogniate` with distinct `X-Forwarded-For` values (`203.0.113.1`..`4`) |
| `AC-LA-E5-03-04` | `AC-LA-E5-03-04 trusted peer: a limited request through the proxy logs rate_limited with client_ip = the e2e container address, not the proxy address` | `K1-SIM` | Running stack (`STACK_PROFILE=acceptance`) + `e2e` container + `infra/.logs/lti-service.jsonl` |
| `AC-LA-E5-03-05` | `AC-LA-E5-03-05 with auth_failure at 30 per minute, burst 30, 31 requests with unknown API keys from one address in one minute give 429 on the 31st; a request with a valid key from that address then also gets 429 until Retry-After has passed` | `K1-SIM` | Running stack (`STACK_PROFILE=acceptance`) + `e2e` container (waits for `Retry-After` and restores `auth_failure: null` in `finally`) |
| `AC-LA-E5-03-06` | `AC-LA-E5-03-06 200 GET /api/idtoken calls in one minute with the valid cogniate key and random ltiks each give 401 INVALID_LTIK_AUTH_AUTHORIZATION_HEADER, never 429; the next call with a valid ltik gives 200` | `K1-SIM` | Running stack (`STACK_PROFILE=acceptance`) + `e2e` container |
| `AC-LA-E5-03-07` | `AC-LA-E5-03-07 with protocol_account at 3 per minute, 10 logins for cogniate with an unknown iss in one minute each get their normal error page (no 429), one rate_limit_soft {class: "protocol_account"} line exists, and a valid simulator launch of cogniate then passes` | `K1-SIM` | Running stack (`STACK_PROFILE=acceptance`) + `e2e` container + `infra/.logs/lti-service.jsonl` |
| `AC-LA-E5-03-08` | `AC-LA-E5-03-08 GET /healthz is never limited; after PATCH /operator/v1/rate-limits the next request uses the new value, and one settings.rate_limits audit event exists` | `K1-SIM` | Running stack (`STACK_PROFILE=acceptance`) + `e2e` container |
| `AC-LA-E5-03-09` | `AC-LA-E5-03-09 GET /operator/v1/rate-limits shows each class with source (operator, env or default); a PATCH with an unknown class or a value below 1 gives 400 INVALID_REQUEST and changes nothing` | `K1-SIM` | Running stack (`STACK_PROFILE=acceptance`) + `e2e` container |
| `AC-LA-E5-03-10` | *(Author unit test: two IPv6 addresses in one /64 share one bucket; two /64 prefixes do not)* | `UNIT` | Covered by Author unit tests (`npm run test:unit`) |
| `AC-LA-E5-03-11` | `AC-LA-E5-03-11 with keys set to 3 per minute, burst 3, the 4th GET /lti/keys/cogniate from one address within one minute gives 429 with Retry-After; /healthz from that address still answers` | `K1-SIM` | Running stack (`STACK_PROFILE=acceptance`) + `e2e` container |
| `AC-LA-E5-03-12` | `AC-LA-E5-03-12 with admin set to 3 per minute, burst 3, for a fresh account’s key, the 4th GET /api/platforms within one minute gives 429 RATE_LIMITED, while an api call of the same key still passes` | `K1-SIM` | Running stack (`STACK_PROFILE=acceptance`) + `e2e` container |

## Commands

- **Typecheck (no Docker):**
  ```sh
  npx --prefix tests tsc --noEmit -p tests/ltiaas/tasks-ops/LA-E5-03/tsconfig.json
  ```
- **List tests (no Docker):**
  ```sh
  npx --prefix tests vitest list -c tests/ltiaas/tasks-ops/LA-E5-03/vitest.config.mts
  ```
- **Full `K1-SIM` run (requires a Docker window and an isolated QA clone):**
  ```sh
  COMPOSE_PROJECT_NAME=qa2-la-sim-r1 PUBLIC_PORT=9443 STACK_SUBNET=172.20.0.0/16 \
    node tests/ltiaas/tasks-ops/LA-E5-03/run.mjs --sha <integration-sha> --replace-tests
  ```
