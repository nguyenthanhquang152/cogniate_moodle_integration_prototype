# LA-E4-07 QA-3 test suite: App metrics and readiness listener

Spec: `docs/architecture/ltiaas/tasks/LA-E4-07.md`, `docs/architecture/ltiaas/contracts/cogniate-app-api-delta.md` §8a, `docs/architecture/ltiaas/operability.md` §4.3–§4.4, `BD-A2-88`, `BD-A1-100`.

## Commands

- Host-only (`LA_LEVEL=k0`, no Docker):
  ```sh
  rm -rf node_modules/.vitest-cache node_modules/.vite
  LA_LEVEL=k0 LA_SCRATCH_CLONE="$PWD" LA_RUN_DIR="$HOME/cogniate-qa-runs/LA/LA-E4-07/r1/k0" \
    npx --no-install vitest run --config tests/ltiaas/tasks-core/LA-E4-07/vitest.config.mts --reporter=verbose
  ```
- SIM stack (`LA_LEVEL=k1sim`, requires explicit Lead `DOCKER-YES` window on slot 4):
  ```sh
  LA_LEVEL=k1sim LA_DOCKER_WINDOW=1 LA_SCRATCH_CLONE="$PWD" LA_RUN_DIR="$HOME/cogniate-qa-runs/LA/LA-E4-07/r1/k1sim" \
    npx --no-install vitest run --config tests/ltiaas/tasks-core/LA-E4-07/vitest.config.mts --reporter=verbose
  ```
