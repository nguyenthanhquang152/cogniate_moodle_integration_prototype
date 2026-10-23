# LA-E6-05: Connection health — record the key of an inline-key setup artifact

QA-3 task suite for `docs/architecture/ltiaas/tasks/LA-E6-05.md` (`LA-ADR-08` D5, `data-model.md` §5a, app contract §4.6).

## Commands

- **K0 + UNIT (no Docker):**
  ```sh
  LA_LEVEL=k0 LA_SCRATCH_CLONE=$PWD LA_RUN_DIR=~/cogniate-qa-runs/LA/qa3-slot4b-dc2a1b5e/k0/LA-E6-05 \
    npx --no-install vitest run --config tests/ltiaas/tasks-core/LA-E6-05/vitest.config.mts
  ```
- **K1-SIM (Docker SIM slot):**
  ```sh
  QA_TASK=LA-E6-05 LA_LEVEL=k1sim \
    npx --no-install vitest run --config tests/ltiaas/tasks-core/LA-E6-05/vitest.config.mts
  ```
