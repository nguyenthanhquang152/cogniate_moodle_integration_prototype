# LA-E3-02 QA Suite (QA-4, Lane L)

Test-first acceptance suite for [LA-E3-02](../../../../docs/architecture/ltiaas/tasks/LA-E3-02.md) ("Platform storage: storage check and Canvas trait values").

## Files

- `platform-storage-check.k0.test.ts` — Host-only (`LA_LEVEL=k0`, no Docker) checks for Rule 1a Canvas `platformStorage` trait values (`{ targetFrame: 'from-login', origin: 'authOrigin' }` on every Canvas profile including `canvas-sim-cloud`; `null` on `standard` and Blackboard), static contract checks on `storage-pages.ts`, `store/storage-checks.ts`, `launch.ts`, `protocol.ts`, and the `storage_check` migration, F1 (`lms-names`) and F5 (`rules`) checks, and `AC-LA-E3-02-04` (`UNIT`) controlled-clock 120 s expiry and 10-minute cleanup unit tests.
- `platform-storage-check.k1sim.test.ts` — `K1-SIM` (`LA_LEVEL=k1sim`) HTTP acceptance suite covering `AC-LA-E3-02-01`..`AC-LA-E3-02-03` and `AC-LA-E3-02-05`..`AC-LA-E3-02-12` (note: K2 browser cases `AC-LA-E3-02-08` U4 and `AC-LA-E3-02-09` AP-05-06 also run in QA-E2E's browser suite).
- `vitest.config.mts` — Vitest config (`LA_LEVEL=k0` or `LA_LEVEL=k1sim`, `LA_TARGET_ROOT` override).
- `tsconfig.json` — TypeScript project extending `tests/ltiaas/tsconfig.json`.

## LA-IC-06 Reviewed Test-Change List (Plan LD-9)

- **Expected test changes**: None (empty list). Today's M1 and golden simulator scenarios omit `lti_storage_target` unless a test explicitly requests `platformStorage: true` or `lti_storage_target`, so existing `from-login` Canvas simulator logins continue to receive `302` (`AP-05-01`).

## Commands

Host-only (`K0` + unit verification):

```sh
LA_LEVEL=k0 npx --prefix tests vitest run --config tests/ltiaas/tasks-lti/LA-E3-02/vitest.config.mts
```

Inside the `e2e` container on the `acceptance` profile (`K1-SIM`):

```sh
LA_LEVEL=k1sim npx --prefix /repo/tests vitest run --config /repo/tests/ltiaas/tasks-lti/LA-E3-02/vitest.config.mts
```
