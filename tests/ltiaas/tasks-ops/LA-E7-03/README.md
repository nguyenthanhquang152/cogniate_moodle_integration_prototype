# LA-E7-03 — Infra Wiring of the Simulator Host Manifest (QA-2 Test Suite)

Test-first `K0` and `K1-SIM` suites for **LA-E7-03** (`docs/architecture/ltiaas/tasks/LA-E7-03.md`, `docs/architecture/ltiaas/README.md` §4b, build decisions `BD-A1-01`, `BD-A1-07`, `BD-A1-08`).

## Acceptance Criteria Map

| AC ID | Test ID (Vitest) | Label | What It Needs |
| --- | --- | --- | --- |
| `AC-LA-E7-03-01` | `[AC-LA-E7-03-01] with today’s three simulator providers in the host manifest, the acceptance stack has the same aliases, SANs and allowlist entries as before` | `K1-SIM` | Host runner (`run.mjs`) + running stack (`STACK_PROFILE=acceptance`) + `e2e` container: compares `docker compose config` (`lms-sim` aliases and `lti-service` / `cogniate-app` `OUTBOUND_PRIVATE_HOST_ALLOWLIST`), `infra/.certs/qa.crt` SANs, `/healthz` `outbound_allowlist`, and compose network DNS resolution for `blackboard-sim`, `canvas-sim-cloud`, and `canvas-sim-self` |
| `AC-LA-E7-03-02` | `[AC-LA-E7-03-02] a new entry in the host manifest adds its host to the aliases, the SANs and the acceptance allowlist after stack:up, with no edit of infra/compose.yaml or infra/scripts/lib.sh` | `K1-SIM` | Host runner (`run.mjs`) + running stack (`STACK_PROFILE=acceptance`) + `e2e` container: appends `zz-qa2-sim` (`aliases: ["zz-qa2.sim.test", "page.zz-qa2.sim.test"]`, `allowlist: ["zz-qa2.sim.test"]`) to `tests/sim/hosts.json`, runs `STACK_PROFILE=acceptance npm run stack:up`, verifies compose aliases, `qa.crt` SANs, `/healthz` allowlist (including `zz-qa2.sim.test` and excluding browser-only `page.zz-qa2.sim.test`), DNS resolution in `e2e`, and clean `git status` on `infra/compose.yaml` and `infra/scripts/lib.sh` (restoring `tests/sim/hosts.json` in `finally`) |
| `AC-LA-E7-03-03` | `[AC-LA-E7-03-03] the default profile has no simulator host in its allowlist or aliases, and /healthz of the default profile equals the golden` | `K1-SIM` | Host runner (`run.mjs`) + running stack (`STACK_PROFILE=default`) + `e2e` container: checks `docker compose config` allowlists and active services in `default` profile and compares `lti-service` and `cogniate-app` `/healthz` against `tests/ltiaas/golden/1b17261be97c4701b928fa9dc2fa74c6d23028f6/G1.json` |
| `AC-LA-E7-03-04` | `[AC-LA-E7-03-04] npm run test:infra passes and stack:up with tests/sim/hosts.json leaves git status under infra/ clean while enforcing BD-A1-01/BD-A1-08` | `K0` | Host-only (`hosts-manifest.k0.test.ts`, no real Docker): runs `npm run test:infra` and runs `stack-up.sh` / `gen-certs.sh` with a fake `docker` executable in a temporary git checkout, verifying `git status --porcelain -- infra/` is empty (generated compose override is under `.tmp/`) and verifying `BD-A1-08` fail-closed behavior on a bad `tests/sim/hosts.json` |

## Commands

- **Typecheck (no Docker):**
  ```sh
  npx --prefix tests tsc --noEmit -p tests/ltiaas/tasks-ops/LA-E7-03/tsconfig.json
  ```
- **List tests (no Docker):**
  ```sh
  LA_LEVEL=k0 npx --prefix tests vitest list -c tests/ltiaas/tasks-ops/LA-E7-03/vitest.config.mts
  npx --prefix tests vitest list -c tests/ltiaas/tasks-ops/LA-E7-03/vitest.config.mts
  ```
- **Run `K0` suite (`AC-LA-E7-03-04`, no Docker):**
  ```sh
  LA_LEVEL=k0 npx --prefix tests vitest run -c tests/ltiaas/tasks-ops/LA-E7-03/vitest.config.mts
  ```
- **Full `K0` + `K1-SIM` run (requires a Docker window and an isolated QA clone):**
  ```sh
  node tests/ltiaas/tasks-ops/LA-E7-03/run.mjs
  ```
