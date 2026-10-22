Verdict: PASS
Round: 1

# LA-E7-02 Simulator extension: data-driven provider loading, generic provider and D2L provider — QA verification (Round 1, host-only)

Tester: QA-E2E (Orca task `task_276ec50978aa`, dispatch `ctx_0d5ba806ddad`), 2026-10-22. Spec: `docs/architecture/ltiaas/tasks/LA-E7-02.md`. Design: `docs/architecture/ltiaas/README.md` §4b, `docs/architecture/ltiaas/build-decisions-A1.md` (`BD-A1-01` v1.1), `docs/architecture/ltiaas/adr/LA-ADR-02-generic-lti-channel.md` D7, and `tests/ltiaas/TEST-STRATEGY.md` §2.5 and §2.8.

Independence: QA-E2E built the simulator extensions and self-tests from `LA-E7-02.md`, `README.md` §4b (`BD-A1-01` v1.1), `LA-ADR-02` D7, `TEST-STRATEGY.md` §2.5 and §2.8, `tests/sim/**`, and the approved `LA-E7-03` infra manifest consumer (`b3af690:infra/scripts/lib.sh` and `b3af690:infra/scripts/sim-hosts.test.mjs`). QA-E2E read no product source files (`services/**`, `apps/**`, `packages/**`), Author notes, or Author branches.

## Round 1 (Host-Only)

| Item | Value |
| --- | --- |
| Integration SHA | `b3af690` (`LA-E7-03` infra wiring of `tests/sim/hosts.json`) |
| Worktree | `la-qa` (`nguyenthanhquang152/la-qa`, base `a7609008`) |
| Lane and slot | Host-only (Docker ban active; K1-SIM stack runs wait for the LA Docker window) |
| Files delivered | `tests/sim/hosts.json`, `tests/sim/server.mjs`, `tests/sim/core/runtime.mjs`, `tests/sim/core/provider.mjs`, `tests/sim/core/loading.test.mjs`, `tests/sim/generic/index.mjs`, `tests/sim/generic/protocol.test.mjs`, `tests/sim/brightspace/index.mjs`, `tests/sim/brightspace/protocol.test.mjs`, `tests/sim/README.md`, `docs/reviews/LA-E7-02/qa.md` |
| Artifacts | `~/cogniate-qa-runs/LA/LA-E7-02/r1/` (umask 077): `sim-baseline-self-tests.log`, `sim-new-providers-self-tests.log`, `sim-all-self-tests.log`, `e7-03-manifest-compat.log` |

## Acceptance Criteria

All five `LA-E7-02` acceptance criteria have level `K1-SIM` and stay `pending: Docker window` until the Lead grants a Docker window. Their host-only simulator, loader, and manifest proofs are complete and recorded below.

| AC | Result | Test id | Command | Evidence |
| --- | --- | --- | --- | --- |
| AC-LA-E7-02-01 | pending: Docker window | `tests/sim/core/loading.test.mjs`, `tests/sim/blackboard/protocol.test.mjs`, `tests/sim/canvas/protocol.test.mjs` | `node --test tests/sim/core/*.test.mjs tests/sim/canvas/protocol.test.mjs tests/sim/blackboard/protocol.test.mjs` | **Host-only PASS (10/10 tests, 540 ms)**: `tests/sim/server.mjs` discovers provider modules from disk and validates `tests/sim/hosts.json` fail-closed (`BD-A1-01` v1.1). Baseline M1/M2 simulator self-tests pass with exact 10/10 count (`sim-baseline-self-tests.log`), and adding a scratch LMS (`sakai-sim`) takes one module + one manifest entry with zero edits to `server.mjs`. Live M1/M2 stack regression waits for the Docker window. |
| AC-LA-E7-02-02 | pending: Docker window | `tests/sim/generic/protocol.test.mjs` (`generic-sim` and `moodle-sim`) | `node --test tests/sim/generic/protocol.test.mjs` | **Host-only PASS (4/4 tests)**: `tests/sim/generic/index.mjs` provides `generic-sim` (issuer with path `https://generic.sim.test/lti`, token on second host `token.generic.sim.test` and same-host `generic.sim.test`, multiple deployments `deploy-generic-1..3` on one registration) and `moodle-sim` (Moodle-shaped config with `issuer = https://moodle.sim.test`, `/mod/lti/*.php` routes, `dlWindowHint: false`). Live K1-SIM stack run waits for the Docker window (`sim-new-providers-self-tests.log`). |
| AC-LA-E7-02-03 | pending: Docker window | `tests/sim/brightspace/protocol.test.mjs` (`brightspace-sim`) | `node --test tests/sim/brightspace/protocol.test.mjs` | **Host-only PASS (4/4 tests)**: `tests/sim/brightspace/index.mjs` provides `brightspace-sim` with token on `auth.brightspace.sim.test/core/connect/token`, assertion `aud = "https://api.brightspace.sim.test/auth/token"` (rejecting `aud = tokenUrl` or array `aud`), `product_family_code = "desire2learn"`, and UUID deployment IDs (`deploymentFormat: 'uuid'`). Live K1-SIM stack run waits for the Docker window (`sim-new-providers-self-tests.log`). |
| AC-LA-E7-02-04 | pending: Docker window | `tests/sim/core/loading.test.mjs`, `tests/sim/generic/protocol.test.mjs`, `tests/sim/brightspace/protocol.test.mjs` | `node --test tests/sim/core/*.test.mjs tests/sim/blackboard/protocol.test.mjs tests/sim/canvas/protocol.test.mjs tests/sim/generic/protocol.test.mjs tests/sim/brightspace/protocol.test.mjs` | **Host-only PASS (18/18 tests, 636 ms)**: All 6 providers (`blackboard-sim`, `canvas-sim-cloud`, `canvas-sim-self`, `generic-sim`, `moodle-sim`, `brightspace-sim`) load together in one runtime and pass OIDC launch, Deep Linking, AGS score/lineitem, and NRPS checks. Live K1-SIM stack run waits for the Docker window (`sim-all-self-tests.log`). |
| AC-LA-E7-02-05 | pending: Docker window | `tests/sim/core/loading.test.mjs`, `b3af690:infra/scripts/sim-hosts.test.mjs` | `node --test infra/scripts/sim-hosts.test.mjs` (with `tests/sim/hosts.json`) | **Host-only PASS (31/31 tests, 17.0 s)**: `b3af690:infra/scripts/lib.sh` parses `tests/sim/hosts.json` cleanly, populates all 16 simulator aliases + `lms-sim.test` and all 15 server-to-server allowlist hosts (excluding browser-only `canvas.school-a.sim.test`), and generates `qa.crt` SANs with zero edits to `infra/**` (`e7-03-manifest-compat.log`). Live `stack:up` K1-SIM verification waits for the Docker window. |

## Host-Only Suite Timings

| Suite | Command | Result | Measured time |
| --- | --- | --- | --- |
| Baseline simulator self-tests (M1/M2 + loader/manifest fail-closed checks) | `node --test tests/sim/core/*.test.mjs tests/sim/canvas/protocol.test.mjs tests/sim/blackboard/protocol.test.mjs` | 10 passed, 0 failed | 0.54 s |
| New simulator provider self-tests (`generic`, `moodle-sim`, `brightspace`) | `node --test tests/sim/generic/protocol.test.mjs tests/sim/brightspace/protocol.test.mjs` | 8 passed, 0 failed | 0.43 s |
| Combined simulator self-tests (all 5 test files) | `node --test tests/sim/core/*.test.mjs tests/sim/blackboard/protocol.test.mjs tests/sim/canvas/protocol.test.mjs tests/sim/generic/protocol.test.mjs tests/sim/brightspace/protocol.test.mjs` | 18 passed, 0 failed | 0.64 s |
| `LA-E7-03` manifest consumer compatibility (`b3af690`) | `node --test infra/scripts/sim-hosts.test.mjs` (against `tests/sim/hosts.json`) | 31 passed, 0 failed | 17.02 s |
