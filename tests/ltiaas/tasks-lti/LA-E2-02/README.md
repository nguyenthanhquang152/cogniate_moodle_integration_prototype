# LA-E2-02 Acceptance Suite (`tests/ltiaas/tasks-lti/LA-E2-02`)

Independent test-first acceptance suite authored by QA-4 (lane L) from:
- `docs/architecture/ltiaas/tasks/LA-E2-02.md`
- `docs/architecture/ltiaas/adr/LA-ADR-02-generic-lti-channel.md` D2a, D5 (items 1–8, 10)
- `docs/architecture/ltiaas/adr/LA-ADR-04-refactor-and-migration.md` D8 `LA-IC-03`
- `docs/architecture/ltiaas/contracts/lti-service-api-delta.md` §2.4, §4.5
- `docs/architecture/ltiaas/data-model.md` §4.2 (LTI migration `021`: `registration_session.token_kind CHECK`)
- `docs/architecture/ltiaas/build-decisions-A1.md` (`BD-A1-43`, `BD-A1-54`/`55`, `BD-A1-59`/`68`, `BD-A1-75`/`76`/`77`, `BD-A1-83`/`84`, `BD-A1-87`/`88`/`89`)

## Suite Files

- `dynamic-registration.k0.test.ts` — Host-only (`LA_LEVEL=k0`) checks:
  - Static and schema checks: LTI migration `021` (`registration_session.token_kind TEXT NULL CHECK (token_kind IN ('scope-jwt', 'opaque-bearer'))`, `BD-A1-77`), removal of legacy `clientAssertionAudArray` (`BD-A1-75`) and explicit `dynamicRegistration: null` on Canvas and Blackboard profiles (`BD-A1-83`), `TOOL_MAY_EXIST` registration text key (`BD-A1-87`), profile identity on explicit update and duplicate-client paths (`BD-A1-88`, `REGISTRATION_UPDATE_NOT_ALLOWED` with `profile_mismatch`), credentials written as one set without `COALESCE` keeping a stale `client_assertion_aud` (`BD-A1-89`), two-phase `familyGuardVerdict` call sites (`BD-A1-43`, `BD-A1-54`, `BD-A1-55`), and `ISSUER_MISMATCH` / `INVALID_OPENID_CONFIGURATION` registration help keys (`BD-A1-59`, `BD-A1-68`).
  - F1 (`fitness:lms-names`) and F5 (`fitness:rules`) checks on `LA-E2-02` core files and migration `021`.
  - `AC-LA-E2-02-01` (`UNIT`): Rule table per profile (D5 items 1–8, 10), migration `021`, `TOOL_MAY_EXIST`, profile identity, and credential-set replacement unit tests.
- `dynamic-registration.k1sim.test.ts` — Container (`LA_LEVEL=k1sim`) checks against the `acceptance` SIM stack:
  - `AC-LA-E2-02-02`, `AC-LA-E2-02-03`, `AC-LA-E2-02-06`: I-SELF holding vs broken (`endpointsOnIssuerOrigin`, staged inactive platform, `403 PLATFORM_NOT_ACTIVE` on learner login, `profile` and `grantedScopes`).
  - `AC-LA-E2-02-04`: Configuration endpoint on a fixed host of Canvas/Blackboard simulator profile refused with `PLATFORM_URL_NOT_IN_PROFILE`.
  - `AC-LA-E2-02-05`: Capability checks (`PROVIDER_PROFILE_MISMATCH`, missing `LtiDeepLinkingRequest`, missing channel scope).
  - `AC-LA-E2-02-07` & `AC-LA-E2-02-09`: `LA-IC-03` (`issuer + /mod/lti/openid-configuration.php` accepted; other path on same site refused) and channel-aware DR texts.

## Commands

```sh
# Host-only typecheck
npx --prefix tests tsc --noEmit -p tests/ltiaas/tasks-lti/LA-E2-02/tsconfig.json

# Run K0 suite (host-only, no Docker)
rm -rf node_modules/.vitest-cache
LA_LEVEL=k0 QA_TASK=LA-E2-02 npm --prefix tests run acceptance:api
```
