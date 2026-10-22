Verdict: PASS
Round: 2

# LA-E7-02 Simulator extension: data-driven provider loading, generic provider and D2L provider — QA verification (Round 2, host-only)

Tester: QA-E2E (Orca tasks `task_276ec50978aa` and `task_5a1930354a1f`, dispatches `ctx_0d5ba806ddad` and `ctx_27c70bf6d702`), 2026-10-22. Spec: `docs/architecture/ltiaas/tasks/LA-E7-02.md`. Design: `docs/architecture/ltiaas/README.md` §4b, `docs/architecture/ltiaas/build-decisions-A1.md` (`BD-A1-01` v1.1), `docs/architecture/ltiaas/adr/LA-ADR-02-generic-lti-channel.md` D7, and `tests/ltiaas/TEST-STRATEGY.md` §2.5 and §2.8.

Independence: QA-E2E built the simulator extensions and self-tests from `LA-E7-02.md`, `README.md` §4b (`BD-A1-01` v1.1), `LA-ADR-02` D7, `TEST-STRATEGY.md` §2.5 and §2.8, `tests/sim/**`, and the approved `LA-E7-03` infra manifest consumer (`b3af690:infra/scripts/lib.sh`). QA-E2E read no product source files (`services/**`, `apps/**`, `packages/**`), Author notes, or Author branches.

## Round 1 (Host-Only)

| Item | Value |
| --- | --- |
| Integration SHA | `b3af690` (`LA-E7-03` infra wiring of `tests/sim/hosts.json`) |
| Worktree | `la-qa` (`nguyenthanhquang152/la-qa`, base `a7609008`) |
| Lane and slot | Host-only (Docker ban active; K1-SIM stack runs wait for the LA Docker window) |
| Files delivered | `tests/sim/hosts.json`, `tests/sim/server.mjs`, `tests/sim/core/runtime.mjs`, `tests/sim/core/provider.mjs`, `tests/sim/core/loading.test.mjs`, `tests/sim/generic/index.mjs`, `tests/sim/generic/protocol.test.mjs`, `tests/sim/brightspace/index.mjs`, `tests/sim/brightspace/protocol.test.mjs`, `tests/sim/README.md`, `docs/reviews/LA-E7-02/qa.md` |
| Artifacts | `~/cogniate-qa-runs/LA/LA-E7-02/r1/` and `~/cogniate-qa-runs/LA/LA-E7-02/r2/` (umask 077) |

## Round 2 (Reviewer-A Round-1 Fixes, Host-Only)

| Finding | Severity | Resolution |
| --- | --- | --- |
| `A-LA-E7-02-01` | BLOCKER | Handled by A1 `BD-A1-36` / `LA-IC-16` in the golden compare (Lead QA); no change required in `tests/sim/**`. |
| `A-LA-E7-02-02` | MINOR | Fixed in the AC table below: `AC-LA-E7-02-02`..`AC-LA-E7-02-04` now match the exact spec AC IDs (`LA-E7-02.md`), the combined 6-provider load check is in a note below the table, and `AC-LA-E7-02-05` cites the direct checks of the committed `tests/sim/hosts.json` (`tests/sim/core/loading.test.mjs` and sourcing `b3af690:infra/scripts/lib.sh` against the committed manifest in `~/cogniate-qa-runs/LA/LA-E7-02/r2/committed-manifest-lib-sh.log`). |
| `A-LA-E7-02-03` | NIT | Fixed in `tests/sim/core/runtime.mjs` (`scenarios.delete(input.id)` before `scenarios.set(input.id, scenario)` so re-posting a scenario ID moves it to the newest position), verified in `tests/sim/core/loading.test.mjs`, and documented with all scenario options and defaults in `tests/sim/README.md`. |

## Acceptance Criteria

All five `LA-E7-02` acceptance criteria have level `K1-SIM` and stay `pending: Docker window` until the Lead grants a Docker window. Their host-only simulator, loader, and manifest proofs are complete and recorded below.

| AC | Result | Test id | Command | Evidence |
| --- | --- | --- | --- | --- |
| AC-LA-E7-02-01 | pending: Docker window | `tests/sim/core/loading.test.mjs`, `tests/sim/blackboard/protocol.test.mjs`, `tests/sim/canvas/protocol.test.mjs` | `node --test tests/sim/core/*.test.mjs tests/sim/canvas/protocol.test.mjs tests/sim/blackboard/protocol.test.mjs` | **Host-only PASS (10/10 tests, 880 ms)**: `tests/sim/server.mjs` discovers provider modules from disk and validates `tests/sim/hosts.json` fail-closed (`BD-A1-01` v1.1). Baseline M1/M2 simulator self-tests pass with exact 10/10 count (`sim-baseline-self-tests.log`). Live M1 `sim` phase and M2 stack regression wait for the Docker window. |
| AC-LA-E7-02-02 | pending: Docker window | `tests/sim/core/loading.test.mjs` (`sakai-sim` scratch module + manifest entry) | `node --test tests/sim/core/loading.test.mjs` | **Host-only PASS**: Adding `sakai/index.mjs` (`sakai-sim`) in a temporary copy of `tests/sim/` fails closed without a `hosts.json` entry (`Unlisted simulator provider sakai-sim`) and loads cleanly as a 7th provider when one entry is added to `hosts.json`, with zero edits to `tests/sim/server.mjs` or `infra/**`. Live stack restart proof waits for the Docker window. |
| AC-LA-E7-02-03 | pending: Docker window | `tests/sim/generic/protocol.test.mjs` (`generic-sim` and `moodle-sim`) | `node --test tests/sim/generic/protocol.test.mjs` | **Host-only PASS**: `tests/sim/generic/index.mjs` provides `generic-sim` (issuer with path `https://generic.sim.test/lti`, token on second host `token.generic.sim.test` and same-host `generic.sim.test`, multiple deployments `deploy-generic-1..3` on one registration, recording each request in `/__sim/records`) and `moodle-sim` (Moodle-shaped config with `issuer = https://moodle.sim.test`, `/mod/lti/*.php` routes, `dlWindowHint: false`). Live K1-SIM stack run waits for the Docker window. |
| AC-LA-E7-02-04 | pending: Docker window | `tests/sim/brightspace/protocol.test.mjs` (`brightspace-sim`) | `node --test tests/sim/brightspace/protocol.test.mjs` | **Host-only PASS**: `tests/sim/brightspace/index.mjs` provides `brightspace-sim` with token on `auth.brightspace.sim.test/core/connect/token`, assertion `aud = "https://api.brightspace.sim.test/auth/token"` (rejecting `aud = tokenUrl` or array `aud`), `product_family_code = "desire2learn"`, and UUID deployment IDs (`deploymentFormat: 'uuid'`). Live K1-SIM stack run waits for the Docker window. |
| AC-LA-E7-02-05 | pending: Docker window | `tests/sim/core/loading.test.mjs` (committed `tests/sim/hosts.json`), `b3af690:infra/scripts/lib.sh` (`load_sim_hosts` / `require_sim_hosts`) | `source infra/scripts/lib.sh && require_sim_hosts` (in a temp copy with the committed `tests/sim/hosts.json`) | **Host-only PASS**: `tests/sim/core/loading.test.mjs` and `b3af690:infra/scripts/lib.sh` read the committed `tests/sim/hosts.json` directly (`committed-manifest-lib-sh.log`): `SIM_ALIASES` has 17 hosts (all 16 provider aliases + `lms-sim.test`) and `SIM_LTI_HOSTS` has 15 server-to-server allowlist hosts (excluding browser-only `canvas.school-a.sim.test`), with zero errors. Live `stack:up` K1-SIM verification (compose aliases, `qa.crt` SANs, and `acceptance`-only allowlist) waits for the Docker window. |

Note: All 6 providers (`blackboard-sim`, `canvas-sim-cloud`, `canvas-sim-self`, `generic-sim`, `moodle-sim`, `brightspace-sim`) also load together in one runtime (`loadProviders(runtime)` with no selection in `tests/sim/core/loading.test.mjs`) and pass all 23 host-only self-tests across the 5 simulator test files (`sim-all-self-tests.log`).

## Host-Only Suite Timings

| Suite | Command | Result | Measured time |
| --- | --- | --- | --- |
| Baseline simulator self-tests (M1/M2 + loader/manifest fail-closed checks) | `node --test tests/sim/core/*.test.mjs tests/sim/canvas/protocol.test.mjs tests/sim/blackboard/protocol.test.mjs` | 10 passed, 0 failed | 0.88 s |
| New simulator provider self-tests (`generic`, `moodle-sim`, `brightspace`) | `node --test tests/sim/generic/protocol.test.mjs tests/sim/brightspace/protocol.test.mjs` | 13 passed, 0 failed | 0.99 s |
| Combined simulator self-tests (all 5 test files) | `node --test tests/sim/core/*.test.mjs tests/sim/blackboard/protocol.test.mjs tests/sim/canvas/protocol.test.mjs tests/sim/generic/protocol.test.mjs tests/sim/brightspace/protocol.test.mjs` | 23 passed, 0 failed | 1.32 s |
| Committed `tests/sim/hosts.json` check via `b3af690:infra/scripts/lib.sh` | `source infra/scripts/lib.sh && require_sim_hosts` (in temp copy) | 17 aliases, 15 allowlist hosts, exit 0 | 0.08 s |
