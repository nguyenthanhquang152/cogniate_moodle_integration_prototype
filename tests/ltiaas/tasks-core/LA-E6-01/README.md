# LA-E6-01 — Connection check (`POST /api/platforms/:id/check`, `POST /app-api/connections/:id/check`, portal panel)

QA-3 test-first suite for `docs/architecture/ltiaas/tasks/LA-E6-01.md` (`LA-ADR-08` D4/D6, `lti-service-api-delta.md` §2.6/§5/§6, `cogniate-app-api-delta.md` §3.7, `BD-A2-98`, `BD-A2-99`, and fix round 1 `195930c1`).

## Modes

- `LA_LEVEL=k0` (`connection-check.k0.test.ts` — host-only, no Docker):
  - `R0`: `npm run check` on the clean clone + K0 `setup.connectionCheck` capability check (`canvas` and `lti-generic` `true`; `moodle`, `blackboard`, `brightspace` absent/false).
  - `AC-LA-E6-01-09` (UNIT) + Author unit suites (`platform-check.test.ts`, `platform-check-keys.test.ts` for fix round 1 `invalid_jwks` when any `keys` entry is not an object with string `kty`, `connection-check.test.ts`, `ConnectionCheck.test.tsx`, `shell.test.tsx`).
  - Host-only in-process `testApp` verification for `AC-LA-E6-01-01`..`05`, `-07`, `-08`, and `BD-A2-98` / `BD-A2-99`:
    - `200 { result: 'ok', checkedAt, details }` when `jwks.ok` and `token.ok`; logs `connection_check` with `token_result` (`token_result.ok === true`, not `[redacted]`) and no token or assertion value.
    - `200 { result: 'failed' }` when `token.ok === false` (`detail: 'invalid_client'`, `'no_granted_scope'`, etc.) or `jwks.ok === false` (`detail: 'invalid_jwks'`); connection `status` unchanged.
    - `429 RATE_LIMITED` on a second check of the same connection within 60 s (`Retry-After` header and `details.retryAfter`).
    - `409 CONNECTION_NOT_READY` on a pending or staged (inactive) connection, with `0` LTI check calls.
    - `409 CAPABILITY_NOT_SUPPORTED` (`details.capability = 'setup.connectionCheck'`) on `moodle`, `blackboard`, and `brightspace`.
    - `404` on another library's connection, with `0` LTI check calls.
- `LA_LEVEL=k1sim` (`connection-check.k1sim.test.ts` — SIM Docker window):
  - `AC-LA-E6-01-01`..`08`, `AC-LA-E6-01-10` against the live stack and Canvas/Blackboard simulator.
