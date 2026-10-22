# LA-E2-01 Acceptance Suite (`tests/ltiaas/tasks-lti/LA-E2-01`)

Independent test-first acceptance suite authored by QA-4 (lane L) from:
- `docs/architecture/ltiaas/tasks/LA-E2-01.md`
- `docs/architecture/ltiaas/adr/LA-ADR-02-generic-lti-channel.md` D2, D2a
- `docs/architecture/ltiaas/adr/LA-ADR-01-channel-kernel.md` D4 load check 7
- `docs/architecture/ltiaas/contracts/lti-service-api-delta.md` §4.6.1, §4.7
- `docs/architecture/ltiaas/data-model.md` §4 (`platform.client_assertion_aud`, `platform.granted_scopes`)

## Suite Files

- `profile-traits.k0.test.ts` — Host-only (`LA_LEVEL=k0`) checks:
  - `AC-LA-E2-01-01` (`K0`): Trait table check that every baseline profile has the D2 values (`standard`, Canvas cloud + `canvas-sim-cloud`, `canvas-self-hosted`, `blackboard` + `blackboard-sim`).
  - Static boolean checks on `lti/platform-rules.ts` (`endpointOrigins`, `any-https`, `PLATFORM_URL_NOT_ON_ISSUER_ORIGIN`, `PLATFORM_URL_NOT_IN_PROFILE`), `platform/token-client.ts` (`clientAssertionAud`, `assertionDeploymentId`, `grantedScopes`), `http/routes/platforms.ts`, `store/platforms.ts`, and the E2 LTI migration (`client_assertion_aud`, `granted_scopes`).
  - F1 (`fitness:lms-names`) and F5 (`fitness:rules`) checks on `LA-E2-01` core files.
  - `AC-LA-E2-01-02`, `04`, `05`, `06`, `07`, `09` (`UNIT`): Load check 7, I-SELF active/staged platform create rules, refused fixed/issuer hosts, `clientAssertionAud`/`deployment_id`, `granted_scopes`, and migration unit tests.
- `profile-traits.k1sim.test.ts` — Container (`LA_LEVEL=k1sim`) checks against the `acceptance` profile + LMS simulator:
  - `AC-LA-E2-01-03`: `GET /api/providers` shows `endpoints`, `issuerKind`, and `endpointOrigins` for every profile with §4.7 values; every older field equals Golden G1 (`LA-IC-01` expected delta, E2-K part).
  - `AC-LA-E2-01-08`: Golden G2 token requests (assertion claims, `aud` form, scopes) of the three baseline channels (`blackboard-sim`, `canvas-sim-cloud`, `standard` on `moodle-sim`) equal the baseline.

## Reviewed Test-Change List (`LA-IC-01`)

- `GET /api/providers` adds the three E2-K trait fields (`endpoints`, `issuerKind`, `endpointOrigins`) alongside `channel` (E1) to each profile entry (`LA-IC-01`); all older fields of the baseline profiles remain identical to Golden G1.

## Commands

```sh
# Host-only typecheck
npx --prefix tests tsc --noEmit -p tests/ltiaas/tasks-lti/LA-E2-01/tsconfig.json

# List all tests (K0 + K1-SIM)
LA_LEVEL=all npx --prefix tests vitest list --config tests/ltiaas/tasks-lti/LA-E2-01/vitest.config.mts

# Run K0 suite (host-only, no Docker)
LA_LEVEL=k0 npx --prefix tests vitest run --config tests/ltiaas/tasks-lti/LA-E2-01/vitest.config.mts
```
