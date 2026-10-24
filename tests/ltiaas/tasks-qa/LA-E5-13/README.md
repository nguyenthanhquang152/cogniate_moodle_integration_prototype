# LA-E5-13: Two-tenant isolation checks for the new routes

Owner: Lead QA (`tests/ltiaas/tasks-qa/LA-E5-13/`).
Spec: [`docs/architecture/ltiaas/tasks/LA-E5-13.md`](../../../../docs/architecture/ltiaas/tasks/LA-E5-13.md).

## Acceptance Criteria Mapping

| AC | Level | Test File | Description |
| --- | --- | --- | --- |
| `AC-LA-E5-13-01` | `K0` + `K1-SIM` | `oracle.ts`, `two-tenant-isolation.k0.test.ts`, `two-tenant-isolation.k1sim.test.ts` | Validates `GET /app-api/lms-providers` contracted `.lms` array across all 5 built channels (`moodle`, `canvas`, `blackboard`, `lti-generic`, `brightspace`) and seeds 7 Library B connection fixtures (`moodle-manual`, `blackboard`, `canvas`, `lti-generic-dynamic`, `lti-generic-manual`, `brightspace-dynamic`, `brightspace-manual`). Captures Library B's connection and publication DTOs before and after Library A's 100 foreign-ID route calls (`GET /app-api/connections/:id`, `POST /app-api/connections/:id/registration-url`, `GET /app-api/connections/:id/tool-configuration`, `PUT /app-api/connections/:id/platform` with admin-value and staged-DR bodies, `POST /app-api/connections/:id/deployments`, `GET /app-api/connections/:id/canvas-configuration`, `PUT /app-api/connections/:id/web-services`, `POST /app-api/publications`, `POST /app-api/connections/:id/check`, `GET /app-api/connections/:id/health`, `POST /app-api/connections/:id/verify`, `DELETE /app-api/connections/:id`, publication/results/version routes, and portal `/integrations/:channelId/:connectionId`), verifying HTTP `404`, zero outbound calls (`AP-07-01`), and zero changes to any persisted Library B DTO field (`status`, `bindingAuthority`, `siteUrl`, `serviceUrl`, `profile`, `platform`, `registrationUrl`, `webServices`, `capabilities`, `activities`, `learners`, `versionId`, full raw DTO). |
| `AC-LA-E5-13-02` | `K1-SIM` | `two-tenant-isolation.k1sim.test.ts` | `POST /tool/picker/:pickerId` (single and multi-select) and `POST /tool/picker/:pickerId/cancel` across libraries A and B return `400 PUBLICATION_NOT_AVAILABLE` / `403`, change nothing in library B (`activities` count, publication status, picker session), and post nothing to the Deep Linking return URL (`AP-07-01`). |
| `AC-LA-E5-13-03` | `K1-SIM` | `two-tenant-isolation.k1sim.test.ts` | Platform-storage login and cookie-less launch on account `cogniate` followed by `POST /lti/launch/qa-second/storage-check` with `Origin` = `PUBLIC_LTI_URL` origin and `cogniate`'s `check` and `value` returns `400 INVALID_STATE` (`detail: "storage_check_unknown_used_or_expired"`, not `storage_origin`), no `303`, and does not consume `cogniate`'s check (`A-LAB-01`). |
| `AC-LA-E5-13-05` | `K1-SIM` | `two-tenant-isolation.k1sim.test.ts` | With `qa-second`'s `admin`-scoped Bearer API key and `cogniate` ids, `POST /api/service-keys/revoke` (plus `/api/audit` and `/api/account` probes) returns `401`/`403`/`404` (or `revoked: 0` on `qa-second`'s own platform with `cogniate`'s scope ids), returns no `cogniate` row, and leaves `cogniate`'s service key active (`AP-07-02`). |
| `AC-LA-E5-13-06` | `K0` + `K1-SIM` | `two-tenant-isolation.k0.test.ts`, `two-tenant-isolation.k1sim.test.ts` | The frozen isolation ACs (`AC-T2-18`, `AC-T4-16`, `AC-T4-29`, `AC-T4-34`, `AC-T7-08`, `AC-T7-09`) remain intact in `tests/` (`K0`) and their two-tenant invariants pass on the live stack (`K1-SIM`). |

## Running

- **Host-only (`K0` static & contract checks, 0 Docker):**
  ```sh
  rm -rf node_modules/.vitest-cache
  LA_LEVEL=k0 npx vitest run --config tests/ltiaas/tasks-qa/LA-E5-13/vitest.config.mts
  ```
- **Live SIM stack (`K1-SIM` inside `e2e` container on a booked SIM slot):**
  ```sh
  LA_LEVEL=k1sim npx vitest run --config tests/ltiaas/tasks-qa/LA-E5-13/vitest.config.mts
  ```
