# LA-E3-07 QA-3 test suite: NRPS scope: channel values, Canvas JSON, Moodle row 13

Spec: `docs/architecture/ltiaas/tasks/LA-E3-07.md`, `LA-ADR-05` D4, `LA-ADR-01` D3, `cogniate-app-api-delta.md` §3.3, §5.

## Commands

- Host-only (`LA_LEVEL=k0`, no Docker):
  ```sh
  rm -rf node_modules/.vitest-cache node_modules/.vite
  LA_LEVEL=k0 LA_SCRATCH_CLONE="$PWD" LA_RUN_DIR="$HOME/cogniate-qa-runs/LA/run20/k0/LA-E3-07" \
    npx --no-install vitest run --config tests/ltiaas/tasks-core/LA-E3-07/vitest.config.mts --reporter=verbose
  ```
- SIM stack (`LA_LEVEL=k1sim`, requires explicit Lead `DOCKER-YES` window on slot 4):
  ```sh
  LA_LEVEL=k1sim LA_DOCKER_WINDOW=1 LA_SCRATCH_CLONE="$PWD" LA_RUN_DIR="$HOME/cogniate-qa-runs/LA/run20/k1sim/LA-E3-07" \
    npx --no-install vitest run --config tests/ltiaas/tasks-core/LA-E3-07/vitest.config.mts --reporter=verbose
  ```
