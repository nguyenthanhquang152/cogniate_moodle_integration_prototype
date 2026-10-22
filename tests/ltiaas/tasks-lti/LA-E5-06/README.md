# LA-E5-06 Acceptance Suite (`tests/ltiaas/tasks-lti/LA-E5-06`)

Independent test-first acceptance suite authored by QA-4 (lane L) from:
- `docs/architecture/ltiaas/tasks/LA-E5-06.md`
- `docs/architecture/ltiaas/adr/LA-ADR-06-service-operability.md` D1 rules 2, 5, 6; D2 rule 5
- `docs/architecture/ltiaas/contracts/lti-service-api-delta.md` §1.3, §1.5, §2.1–§2.4, §3
- `docs/architecture/ltiaas/build-decisions-A2.md` BD-A2-20 (`registration_session.client_key`)

## Suite Files

- `protocol-wiring.k0.test.ts` — Host-only (`LA_LEVEL=k0`) checks:
  - `AC-LA-E5-06-08` (`K0`): Fitness F5 check given probe text `'/lti/launch/'` at a product path outside `services/lti-service/src/accounts/` fails (`exit != 0`), and passes inside `services/lti-service/src/accounts/resolver.ts`.
  - Static boolean checks on `codes.ts` (`TOOL_ACCOUNT_SUSPENDED`, `REGISTRATION_SESSION_LIMIT`, `RATE_LIMITED`), `target.ts`, `login.ts`, `launch.ts`, `registration.ts`, `http/routes/protocol.ts`, `http/routes/registration.ts`, and `store/registrations.ts` (`client_key` written on insert and cleared to `NULL` on completion per `BD-A2-20`).
  - F1 (`fitness:lms-names`) and F5 (`fitness:rules`) checks on `LA-E5-06` core files.
  - `AC-LA-E5-06-09` (`UNIT`): Login target check accepts launch and Deep Linking URLs from `protocolUrls(account)` and refuses another account's URL.
- `protocol-wiring.k1sim.test.ts` — Container (`LA_LEVEL=k1sim`) checks against the `acceptance` profile + LMS simulator (`https://moodle.sim.test`) + operator API (`http://lti-service:4110`):
  - `AC-LA-E5-06-01`: Suspended account login gives `403` `TOOL_ACCOUNT_SUSPENDED` and no `Set-Cookie`; `cogniate` launch still passes.
  - `AC-LA-E5-06-02`: Suspended account `GET /lti/register/:account` gives `403` `TOOL_ACCOUNT_SUSPENDED` and simulator records no configuration fetch.
  - `AC-LA-E5-06-03`: Suspended account `GET /lti/keys/:account` gives `200` with keys.
  - `AC-LA-E5-06-04`: Closed account login gives `404` `UNKNOWN_TOOL_ACCOUNT` and `GET /lti/keys/:account` gives `404`.
  - `AC-LA-E5-06-05` & `AC-LA-E5-06-06`: With `registrationSessionsPerAddress = 3` and `registration` limit at 100/min, the 4th open session on an account gives `409` `REGISTRATION_SESSION_LIMIT` with no outbound fetch, while a second fresh account in the same minute opens a session (`200`); limits are restored in clean-up.
  - `AC-LA-E5-06-07`: Moodle-shaped simulator Dynamic Registration of `cogniate` sends `initiate_login_uri`, `redirect_uris`, `jwks_uri`, and `target_link_uri` equal to `protocolUrls` of `cogniate`.
  - `AC-LA-E5-06-10`: For a suspended account, `POST /lti/launch/<account>` with a valid state gives `403` `TOOL_ACCOUNT_SUSPENDED`, no `303`, and no `ltik`.

## Commands

```sh
# Host-only typecheck
npx --prefix tests tsc --noEmit -p tests/ltiaas/tasks-lti/LA-E5-06/tsconfig.json

# List all tests (K0 + K1-SIM)
LA_LEVEL=all npx --prefix tests vitest list --config tests/ltiaas/tasks-lti/LA-E5-06/vitest.config.mts

# Run K0 suite (host-only, no Docker)
LA_LEVEL=k0 npx --prefix tests vitest run --config tests/ltiaas/tasks-lti/LA-E5-06/vitest.config.mts
```
