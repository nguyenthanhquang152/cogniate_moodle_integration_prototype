# LA-E2-06 QA-3 test suite: `brightspace` Dynamic Registration, staged with a grant

Spec: `docs/architecture/ltiaas/tasks/LA-E2-06.md`, `LA-ADR-02` D2a, D4, D5 item 10, D6.

## Commands

- Host-only (`LA_LEVEL=k0`, no Docker):
  ```sh
  rm -rf node_modules/.vitest-cache node_modules/.vite
  LA_LEVEL=k0 LA_SCRATCH_CLONE="$PWD" LA_RUN_DIR="$HOME/cogniate-qa-runs/LA/run20/k0/LA-E2-06" \
    npx --no-install vitest run --config tests/ltiaas/tasks-core/LA-E2-06/vitest.config.mts --reporter=verbose
  ```
- SIM stack (`LA_LEVEL=k1sim`, requires explicit Lead `DOCKER-YES` window on slot 4):
  ```sh
  LA_LEVEL=k1sim LA_DOCKER_WINDOW=1 LA_SCRATCH_CLONE="$PWD" LA_RUN_DIR="$HOME/cogniate-qa-runs/LA/run20/k1sim/LA-E2-06" \
    npx --no-install vitest run --config tests/ltiaas/tasks-core/LA-E2-06/vitest.config.mts --reporter=verbose
  ```
