# LA-E5-02 audit log (LTI service): QA-2 acceptance tests

Spec: `docs/architecture/ltiaas/tasks/LA-E5-02.md`. Contract: `docs/architecture/ltiaas/contracts/lti-service-api-delta.md` §3, §5. Design: `docs/architecture/ltiaas/adr/LA-ADR-06-service-operability.md` D4 (AP-06-14 to AP-06-17). QA-2 wrote these tests from the spec, the contract and the ADR only (test-first).

## AC map

| AC id | Test id | Label | What it needs |
| --- | --- | --- | --- |
| `AC-LA-E5-02-01` | `AC-LA-E5-02-01` (`audit.test.ts`) | `K1-SIM` | Running stack (`acceptance` profile): `POST /api/platforms` (201) + `GET /operator/v1/audit?action=platform.create` on `http://lti-service:4110`; checks `actor` (`api_key:bootstrap-cogniate` or `api_key:<id>`), `toolAccountId: "cogniate"`, `result: "ok"`, `traceId`, and that an unauthenticated `POST /api/platforms` (401) writes no event. |
| `AC-LA-E5-02-02` | `AC-LA-E5-02-02` (`audit.test.ts`) | `K1-SIM` | Running stack (`acceptance` profile): duplicate `POST /api/platforms` giving `409 PLATFORM_ALREADY_EXISTS` writes one `platform.create` event with `result: "refused"` and `code: "PLATFORM_ALREADY_EXISTS"`. |
| `AC-LA-E5-02-03` | `AC-LA-E5-02-03` (`audit.test.ts`) | `K1-SIM` | Running stack (`acceptance` profile): `PATCH /api/platforms/:id` (`platform.update`), `POST /api/platforms/:id/deployments` (`deployment.create`), `PATCH /api/platforms/:id/deployments/:deploymentId` (`deployment.update`), and `DELETE /api/platforms/:id` (`platform.delete`) each write one `ok` event with the contract delta §5 action and target type. |
| `AC-LA-E5-02-04` | `AC-LA-E5-02-04` (`audit.test.ts`) | `K1-SIM` | Running stack (`acceptance` profile): `POST /operator/v1/operator-keys` (`operator_key.issue`) and `POST /operator/v1/operator-keys/:id/revoke` (`operator_key.revoke`) write events with `actor: operator:<name>`; `lti:operator init` writes `operator_key.issue` with `actor: system:bootstrap`. |
| `AC-LA-E5-02-05` | `AC-LA-E5-02-05` (`audit.test.ts`) | `K1-SIM` | Running stack (`acceptance` profile): `GET /api/platforms` writes no audit event; `GET /operator/v1/audit` writes one `audit.read` event. |
| `AC-LA-E5-02-06` | `AC-LA-E5-02-06` (`audit.test.ts`) | `K1-SIM` | Running stack (`acceptance` profile): `GET /operator/v1/audit?toolAccountId=qa-second` returns only `qa-second` events and excludes `cogniate` and operator-global events. |
| `AC-LA-E5-02-07` | Author unit test (migration test) | `UNIT` | No Docker: `UPDATE audit_event …` fails with `audit_event is append-only` (AP-06-15). QA records the Author unit test run in `qa.md`; Reviewer-B checks test quality. |
| `AC-LA-E5-02-08` | Author unit test (transaction rollback) | `UNIT` | No Docker: if the platform change fails after the audit insert in the same transaction, neither the change nor the event is stored. QA records the Author unit test run in `qa.md`. |
| `AC-LA-E5-02-09` | `AC-LA-E5-02-09` (`audit.test.ts`) | `K1-SIM` | Running stack (`acceptance` profile): secret scan across every `GET /operator/v1/audit` response body of the run (and a full paginated sweep) finds no API key (`ltis_`), operator key (`ltio_`), private JWK component, `ltik`, `serviceKey`, or SHA-256 secret hash. |
| `AC-LA-E5-02-10` | `AC-LA-E5-02-10` (`audit.k0.test.ts`) | `K0` | No Docker: `npm run --silent fitness:rules -- --stdin --as <path>` (F5 check-one-text mode) fails on `DELETE FROM audit_event` at product paths outside `services/lti-service/src/jobs/audit-retention.ts` and passes at the retention job path. |

## How to run

### K0 (no Docker)

```sh
LA_LEVEL=k0 npx --prefix tests vitest run --config tests/ltiaas/tasks-ops/LA-E5-02/vitest.config.mts
```

### K1-SIM + K0 (booked SIM slot only)

```sh
COMPOSE_PROJECT_NAME=qa2-la-sim-r1 PUBLIC_PORT=9443 STACK_SUBNET=172.20.0.0/16 \
  node tests/ltiaas/tasks-ops/LA-E5-02/run.mjs --sha <integration sha> --replace-tests
```

### No-Docker checks (host-only)

```sh
npx --prefix tests tsc --noEmit -p tests/ltiaas/tasks-ops/LA-E5-02/tsconfig.json
LA_LEVEL=k0 npx --prefix tests vitest list --config tests/ltiaas/tasks-ops/LA-E5-02/vitest.config.mts
npx --prefix tests vitest list --config tests/ltiaas/tasks-ops/LA-E5-02/vitest.config.mts
```
