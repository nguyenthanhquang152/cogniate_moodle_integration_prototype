# LA-E3-01 QA Suite (QA-4, Lane L)

Test-first acceptance suite for [LA-E3-01](../../../../docs/architecture/ltiaas/tasks/LA-E3-01.md) ("Platform storage: login page and state columns").

## Files

- `platform-storage-login.k0.test.ts` — Host-only (`LA_LEVEL=k0`, no Docker) checks for `AC-LA-E3-01-01`..`AC-LA-E3-01-09` (`UNIT`), F1 (`lms-names`) and F5 (`sql-portability`) checks on `storage-pages.ts`, `login.ts`, `states.ts`, and the `oidc_state` migration, profile registry `platformStorage` checks, and execution of the `lti-service` unit and migration tests.
- `platform-storage-login.k1sim.test.ts` — `K1-SIM` (`LA_LEVEL=k1sim`) HTTP acceptance suite covering `AC-LA-E3-01-10` (`AP-05-01`; `K1-LAUNCH L10` regression part).
- `vitest.config.mts` — Vitest config (`LA_LEVEL=k0` or `LA_LEVEL=k1sim`, `LA_TARGET_ROOT` override).
- `tsconfig.json` — TypeScript project extending `tests/ltiaas/tsconfig.json`.

## Commands

Host-only (`K0` + unit verification):

```sh
LA_LEVEL=k0 npx --prefix tests vitest run --config tests/ltiaas/tasks-lti/LA-E3-01/vitest.config.mts
```

Inside the `e2e` container on the `acceptance` profile (`K1-SIM`):

```sh
LA_LEVEL=k1sim npx --prefix /repo/tests vitest run --config /repo/tests/ltiaas/tasks-lti/LA-E3-01/vitest.config.mts
```
