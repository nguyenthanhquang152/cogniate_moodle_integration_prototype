# LA-E2-05 QA-3 test suite

Spec: `docs/architecture/ltiaas/tasks/LA-E2-05.md` (`LA-ADR-02` D1, D4, D8; `LA-ADR-01` D2, D5, D6; `cogniate-app-api-delta.md` §3.3; `BD-A1-78`, `BD-A1-80`, `BD-A1-94`, `BD-A1-95`).

## Host-only K0, UNIT, and DOC run (`AC-LA-E2-05-01`, `-02`, `-03`, `-06` host part, `-08`, `-09`)

```sh
rm -rf node_modules/.vitest-cache tests/node_modules/.vitest-cache
LA_LEVEL=k0 LA_SCRATCH_CLONE="$PWD" LA_E2_K_DONE_SHA=678eb72 LA_E2_05_SHA=a3d9434 LA_RUN_DIR="$HOME/cogniate-qa-runs/LA/LA-E2-05/r1/k0" \
  npx --no-install vitest run --config tests/ltiaas/tasks-core/LA-E2-05/vitest.config.mts --reporter=verbose
```

## K1-SIM run (`AC-LA-E2-05-04`, `-05`, `-06`, `-10`; requires booked SIM Docker window)

```sh
rm -rf node_modules/.vitest-cache tests/node_modules/.vitest-cache
LA_LEVEL=k1sim PUBLIC_PORT=9455 LA_RUN_DIR="$HOME/cogniate-qa-runs/LA/LA-E2-05/r1/k1sim" \
  npx --no-install vitest run --config tests/ltiaas/tasks-core/LA-E2-05/vitest.config.mts --reporter=verbose
```
