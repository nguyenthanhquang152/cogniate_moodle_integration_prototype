# LA-E6-04: Channel capability flags for connection check

Owner: QA-3 (`tests/ltiaas/tasks-qa/LA-E6-04/`).
Spec: [`docs/architecture/ltiaas/tasks/LA-E6-04.md`](../../../../docs/architecture/ltiaas/tasks/LA-E6-04.md).

## Acceptance Criteria Mapping

| AC | Level | Test File | Description |
| --- | --- | --- | --- |
| `AC-LA-E6-04-01` | `K0` | `connection-check.k0.test.ts` | The registry gives `setup.connectionCheck: true` for `canvas` across manifest and all registered profiles (`LD-5` public entry points). |
| `AC-LA-E6-04-02` | `K0` | `connection-check.k0.test.ts` | The registry gives `setup.connectionCheck: true` for `lti-generic` across manifest and all registered profiles (`LD-5` public entry points). |
| `AC-LA-E6-04-03` | `K0` | `connection-check.k0.test.ts` | `moodle`, `blackboard`, and `brightspace` have no `setup.connectionCheck` in `manifest.setup` and compute `setup.connectionCheck: false` across all profiles. |
| `AC-LA-E6-04-04` | `K0` | `connection-check.k0.test.ts` | The six legacy capability flags (`dynamicRegistration`, `operatorApproval`, `webServices`, `courseShell`, `addDeployment`, `canvasConfiguration`) of every channel (`moodle`, `canvas`, `blackboard`, `lti-generic`, `brightspace`) are unchanged. |

## Running

- **Host-only (`K0`, 0 Docker):**
  ```sh
  npx --no-install vitest run --config tests/ltiaas/tasks-qa/LA-E6-04/vitest.config.mts --reporter=verbose
  ```
