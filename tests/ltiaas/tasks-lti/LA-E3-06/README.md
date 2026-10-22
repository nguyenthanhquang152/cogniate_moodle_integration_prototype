# LA-E3-06 QA Suite (QA-4, Lane L)

Test-first acceptance suite for [LA-E3-06](../../../../docs/architecture/ltiaas/tasks/LA-E3-06.md) ("NRPS scope: `complete.scopes` and the registration audit event").

## Files

- `nrps-scopes.k0.test.ts` — Host-only (`LA_LEVEL=k0`, no Docker) checks for `AC-LA-E3-06-04` (`UNIT`), F1 (`lms-names`) baseline compliance on `services/lti-service/src/lti/registration.ts` and `services/lti-service/src/http/routes/registration.ts`, and execution of the `lti-service` unit tests.
- `nrps-scopes.k1sim.test.ts` — `K1-SIM` (`LA_LEVEL=k1sim`) HTTP acceptance suite covering `AC-LA-E3-06-01`, `AC-LA-E3-06-02`, `AC-LA-E3-06-03`, `AC-LA-E3-06-04`, `AC-LA-E3-06-05`, and `AC-LA-E3-06-06`.
- `vitest.config.mts` — Vitest config (`LA_LEVEL=k0` or `LA_LEVEL=k1sim`, `LA_TARGET_ROOT` override).
- `tsconfig.json` — TypeScript project extending `tests/ltiaas/tsconfig.json`.

## Commands

Host-only (`K0` + unit verification):

```sh
LA_LEVEL=k0 npx --prefix tests vitest run --config tests/ltiaas/tasks-lti/LA-E3-06/vitest.config.mts
```

Inside the `e2e` container on the `acceptance` profile (`K1-SIM`):

```sh
LA_LEVEL=k1sim npx --prefix /repo/tests vitest run --config /repo/tests/ltiaas/tasks-lti/LA-E3-06/vitest.config.mts
```
