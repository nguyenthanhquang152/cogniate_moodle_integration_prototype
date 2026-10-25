# LA-E5-17 — Metrics, `/readyz`, production `/healthz` (QA-2, K1-SIM)

Owner: QA-2 (`tests/ltiaas/tasks-ops/LA-E5-17/**`).
Spec: `docs/architecture/ltiaas/tasks/LA-E5-17.md`, `operability.md` §4.2, §4.4, §5, `lti-service-api-delta.md` §2.5, `LA-ADR-06` D10.

## Coverage

| AC | Level | Covered in | What is checked |
| --- | --- | --- | --- |
| `AC-LA-E5-17-01` | `K1-SIM` | `observability.test.ts` | `GET http://lti-service:4110/metrics` from the `e2e` container (`acceptance` profile) returns `200` OpenMetrics text with `lti_http_requests_total`, `lti_rate_limited_total`, `lti_launch_total`, `lti_audit_events_total`, `lti_jwks_cache_age_seconds` (`BD-A2-54`), and `lti_ready` (`1`) |
| `AC-LA-E5-17-02` | `K1-SIM` | `observability.test.ts` | `GET https://lti.cogniate.test/metrics` through the proxy returns `404` |
| `AC-LA-E5-17-03` | `K1-SIM` | `observability.test.ts` | Public `GET /readyz` returns `200 {"status":"ready"}` with no `reasons` field (and operator `GET http://lti-service:4110/readyz` returns `200` with `status: "ready"`) |
| `AC-LA-E5-17-04` | `UNIT` | Author unit test | Key ring lacking a version that a row uses makes operator `/readyz` return `503` with `reasons` containing `key_version_missing` |
| `AC-LA-E5-17-05` | `UNIT` | Author unit test | With `STACK_PROFILE=production`, `GET /healthz` returns `{"status":"ok","service":"lti-service"}` |
| `AC-LA-E5-17-06` | `K1-SIM` | `observability.test.ts` | In the `acceptance` profile, `GET /healthz` equals the E0 golden `G1` (`G1.acceptance.ltiHealth`, no field change; `outbound_allowlist` verified under `LA-IC-16`) |
| `AC-LA-E5-17-07` | `K1-SIM` | `observability.test.ts` | An `http_request` line for `/lti/login/cogniate` has `tool_account_id: "cogniate"` and `path: "/lti/login/:account"`, an unmatched path logs `path: "<unmatched>"` (`BD-A2-61`), and no metric label or log field/value holds a name, e-mail, or `sub` |

## Host-only check (no Docker)

```sh
./node_modules/.bin/tsc -p tests/ltiaas/tasks-ops/LA-E5-17/tsconfig.json --noEmit
./node_modules/.bin/vitest list -c tests/ltiaas/tasks-ops/LA-E5-17/vitest.config.mts
node --check tests/ltiaas/tasks-ops/LA-E5-17/run.mjs
```

## SIM slot execution

```sh
COMPOSE_PROJECT_NAME=qa2-la-sim-r1 PUBLIC_PORT=9443 STACK_SUBNET=172.20.0.0/16 \
  node tests/ltiaas/tasks-ops/LA-E5-17/run.mjs --sha <integration-sha> --replace-tests
```
