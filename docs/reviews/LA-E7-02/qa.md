Verdict: PASS
Round: 4

# LA-E7-02 Simulator extension: data-driven provider loading, generic provider and D2L provider — QA verification (Round 4, host-only)

Tester: QA-E2E (Orca tasks `task_276ec50978aa`, `task_5a1930354a1f`, `task_35737c267107`, and `task_3ce1cd75a3b5`; dispatches `ctx_0d5ba806ddad`, `ctx_27c70bf6d702`, `ctx_d1fb21ad084b`, and `ctx_b5361e5c44f7`), 2026-10-23. Spec: `docs/architecture/ltiaas/tasks/LA-E7-02.md`. Design: `docs/architecture/ltiaas/README.md` §4b, `docs/architecture/ltiaas/build-decisions-A1.md` (`BD-A1-01` v1.1 and `BD-A1-53`), `docs/architecture/ltiaas/adr/LA-ADR-02-generic-lti-channel.md` D7, and `tests/ltiaas/TEST-STRATEGY.md` §2.5 and §2.8.

Independence: QA-E2E built the simulator extensions and self-tests from `LA-E7-02.md`, `README.md` §4b (`BD-A1-01` v1.1 and `BD-A1-53`), `LA-ADR-02` D7, `TEST-STRATEGY.md` §2.5 and §2.8, `tests/sim/**`, and the approved `LA-E7-03` infra manifest consumer (`b3af690` / `6ae0ebe:infra/scripts/lib.sh`). QA-E2E read no product source files (`services/**`, `apps/**`, `packages/**`), Author notes, or Author branches.

## Round 1 (Host-Only)

| Item | Value |
| --- | --- |
| Integration SHA | `b3af690` (`LA-E7-03` infra wiring of `tests/sim/hosts.json`) |
| Worktree | `la-qa` (`nguyenthanhquang152/la-qa`, base `a7609008`) |
| Lane and slot | Host-only (Docker ban active; K1-SIM stack runs wait for the LA Docker window) |
| Files delivered | `tests/sim/hosts.json`, `tests/sim/server.mjs`, `tests/sim/core/runtime.mjs`, `tests/sim/core/provider.mjs`, `tests/sim/core/loading.test.mjs`, `tests/sim/generic/index.mjs`, `tests/sim/generic/protocol.test.mjs`, `tests/sim/brightspace/index.mjs`, `tests/sim/brightspace/protocol.test.mjs`, `tests/sim/README.md`, `docs/reviews/LA-E7-02/qa.md` |
| Artifacts | `~/cogniate-qa-runs/LA/LA-E7-02/r1/`, `~/cogniate-qa-runs/LA/LA-E7-02/r2/`, `~/cogniate-qa-runs/LA/LA-E7-02/r3/` (umask 077) |

## Round 2 (Reviewer-A Round-1 Fixes, Host-Only)

| Finding | Severity | Resolution |
| --- | --- | --- |
| `A-LA-E7-02-01` | BLOCKER | Handled by A1 `BD-A1-36` / `LA-IC-16` in the golden compare (Lead QA); no change required in `tests/sim/**`. |
| `A-LA-E7-02-02` | MINOR | Fixed in the AC table below: `AC-LA-E7-02-02`..`AC-LA-E7-02-04` now match the exact spec AC IDs (`LA-E7-02.md`), the combined 6-provider load check is in a note below the table, and `AC-LA-E7-02-05` cites the direct checks of the committed `tests/sim/hosts.json` (`tests/sim/core/loading.test.mjs` and sourcing `b3af690:infra/scripts/lib.sh` against the committed manifest in `~/cogniate-qa-runs/LA/LA-E7-02/r2/committed-manifest-lib-sh.log`). |
| `A-LA-E7-02-03` | NIT | Fixed in `tests/sim/core/runtime.mjs` (`scenarios.delete(input.id)` before `scenarios.set(input.id, scenario)` so re-posting a scenario ID moves it to the newest position), verified in `tests/sim/core/loading.test.mjs`, and documented with all scenario options and defaults in `tests/sim/README.md`. |

## Round 3 (Reviewer-B Round-1 Fixes, Host-Only)

| Finding | Severity | Resolution |
| --- | --- | --- |
| `B-LA-E7-02-01` | MINOR | Aligned `loadHostManifest` and `isSimHost` in `tests/sim/server.mjs` to `README.md` §4b (`BD-A1-01` v1.1): strict DNS-label rule (`^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$` per label, `<= 253` chars, ending in `.sim.test`, forbidding `lms-sim.test`), merging repeated `aliases` and `allowlist` hosts inside one entry, and accepting `"providers": []` in `loadHostManifest`. Added a 27-case shared table test in `tests/sim/core/loading.test.mjs` running both `loadHostManifest` and `infra/scripts/lib.sh` (`require_sim_hosts acceptance`) on every case (27/27 agree). Remaining `infra/scripts/lib.sh` differences vs `README.md` §4b are listed below for routing to S1. |
| `B-LA-E7-02-02` | MINOR | Updated `tests/sim/README.md` with the `createProvider(runtime, config)` config fields table (with examples from `tests/sim/generic/index.mjs`), the `config.id === providers[].id` rule, the every-folder-is-a-module rule, Step 3 (`STACK_PROFILE=acceptance npm run stack:up` to regenerate `qa.crt`, `.tmp/compose.sim-hosts.yaml`, and `OUTBOUND_PRIVATE_HOST_ALLOWLIST`, plus registering a matching LTI profile on the tool side), and the single glob command (`node --test 'tests/sim/core/*.test.mjs' 'tests/sim/*/protocol.test.mjs'`). |
| `B-LA-E7-02-03` | NIT | Updated startup errors in `tests/sim/server.mjs` to print the exact host diff (`missing in hosts.json: [...]; missing in the module: [...]`) and to report an unloaded manifest entry without guessing a module name (`Manifest entry <id> has no loaded provider; a module under tests/sim/<folder>/ must export a provider with id <id>`). |
| `B-LA-E7-02-04` | NIT | Split `tests/sim/core/loading.test.mjs` into 7 named `test(...)` blocks plus 27 `await t.test(...)` subtests in the shared `hosts.json` table test (34/34 passing in `loading.test.mjs`). |
| `B-LA-E7-02-05` | NIT | Added the note in `tests/sim/README.md` Step 2 that today the only browser-only alias is `canvas.school-a.sim.test` (the Canvas page host of M3). |

### Remaining `infra/scripts/lib.sh` Differences from `README.md` §4b (`BD-A1-01` v1.1) (For Lane S1)

1. **`infra/scripts/lib.sh:89-98` (Missing `tests/sim/hosts.json`, `README.md` §4b "No file", `BD-A1-01` Change 2)**: When `tests/sim/hosts.json` is absent (`! -e "$manifest" && ! -L "$manifest"`), `lib.sh` still falls back to the 8 fixed M1 hosts (`SIM_LTI_HOSTS` / `SIM_ALIASES`) with `return 0`. Now that `LA-E7-02` has committed `tests/sim/hosts.json`, `README.md` §4b ("No file") and `BD-A1-01` Change 2 state that S1 removes the fixed fallback lists so a missing `tests/sim/hosts.json` is treated as a bad file (`SIM_HOSTS_ERROR`).
2. **`infra/scripts/lib.sh:134-138` (One host in two providers, `README.md` §4b "Fail closed (simulator)" / `BD-A1-01` Change 3)**: `lib.sh` merges a host that appears in two different `providers[]` entries (`aliases.add(host)`), whereas `tests/sim/server.mjs` (`loadHostManifest` and `loadProviders`) refuses when one host is claimed by two providers (`Duplicate simulator host <host> across providers <A> and <B>`) because each host maps to one provider.
3. **`infra/scripts/lib.sh:123` (`providers[].id` format, `README.md` §4b `providers[].id`)**: `lib.sh` checks only `typeof provider.id === 'string' && provider.id.trim()`, whereas `tests/sim/server.mjs` enforces `^[a-z0-9][a-z0-9-]*$` (kebab-case).

## Round 4 (Reviewer-A Round-3 Fix: `BD-A1-53` Repeated-Host Refusal, Host-Only)

| Finding | Severity | Resolution |
| --- | --- | --- |
| `A-LA-E7-02-05` | BLOCKER | Aligned `loadHostManifest` in `tests/sim/server.mjs` and `tests/sim/README.md` with `README.md` §4b and `BD-A1-53` (and S1's `6ae0ebe` `infra/scripts/lib.sh` update): `loadHostManifest` now refuses any host repeated inside one entry's `aliases` (`Duplicate simulator alias host <host> in <id>`) or `allowlist` (`Duplicate simulator allowlist host <host> in <id>`), and no longer merges repeated entries. Flipped the shared table test case in `tests/sim/core/loading.test.mjs` to `'refuses repeated alias and allowlist host inside one entry'` (expected `false`) and added explicit error-message assertions for repeated alias and repeated allowlist hosts. All 27 shared `hosts.json` table cases agree between `loadHostManifest` and `6ae0ebe:infra/scripts/lib.sh` (`35/35` in `loading.test.mjs`, `58/58` across all 5 simulator test files in `~/cogniate-qa-runs/LA/LA-E7-02/r4/`). Note: S1's `6ae0ebe` commit also closed all three Round-3 `infra/scripts/lib.sh` differences listed above under `BD-A1-53`. |

## Acceptance Criteria

All five `LA-E7-02` acceptance criteria have level `K1-SIM` and stay `pending: Docker window` until the Lead grants a Docker window. Their host-only simulator, loader, and manifest proofs are complete and recorded below.

| AC | Result | Test id | Command | Evidence |
| --- | --- | --- | --- | --- |
| AC-LA-E7-02-01 | pending: Docker window | `tests/sim/core/loading.test.mjs`, `tests/sim/blackboard/protocol.test.mjs`, `tests/sim/canvas/protocol.test.mjs` | `node --test 'tests/sim/core/*.test.mjs' 'tests/sim/*/protocol.test.mjs'` | **Host-only PASS (58/58 tests, 1.67 s)**: `tests/sim/server.mjs` discovers provider modules from disk and validates `tests/sim/hosts.json` fail-closed (`BD-A1-01` v1.1 and `BD-A1-53`). All baseline M1/M2 simulator self-tests and shared manifest table tests pass (`~/cogniate-qa-runs/LA/LA-E7-02/r4/sim-all-self-tests.log`). Live M1 `sim` phase and M2 stack regression wait for the Docker window. |
| AC-LA-E7-02-02 | pending: Docker window | `tests/sim/core/loading.test.mjs` (`adding a new LMS takes one module folder and one hosts.json entry with zero edits to server.mjs`) | `node --test tests/sim/core/loading.test.mjs` | **Host-only PASS**: Adding `sakai/index.mjs` (`sakai-sim`) in a temporary copy of `tests/sim/` fails closed without a `hosts.json` entry (`Unlisted simulator provider sakai-sim`) and loads cleanly as a 7th provider when one entry is added to `hosts.json`, with zero edits to `tests/sim/server.mjs` or `infra/**` (`sim-loading-table-tests.log`). Live stack restart proof waits for the Docker window. |
| AC-LA-E7-02-03 | pending: Docker window | `tests/sim/generic/protocol.test.mjs` (`generic-sim` and `moodle-sim`) | `node --test tests/sim/generic/protocol.test.mjs` | **Host-only PASS**: `tests/sim/generic/index.mjs` provides `generic-sim` (issuer with path `https://generic.sim.test/lti`, token on second host `token.generic.sim.test` and same-host `generic.sim.test`, multiple deployments `deploy-generic-1..3` on one registration, recording each request in `/__sim/records`) and `moodle-sim` (Moodle-shaped config with `issuer = https://moodle.sim.test`, `/mod/lti/*.php` routes, `dlWindowHint: false`). Live K1-SIM stack run waits for the Docker window. |
| AC-LA-E7-02-04 | pending: Docker window | `tests/sim/brightspace/protocol.test.mjs` (`brightspace-sim`) | `node --test tests/sim/brightspace/protocol.test.mjs` | **Host-only PASS**: `tests/sim/brightspace/index.mjs` provides `brightspace-sim` with token on `auth.brightspace.sim.test/core/connect/token`, assertion `aud = "https://api.brightspace.sim.test/auth/token"` (rejecting `aud = tokenUrl` or array `aud`), `product_family_code = "desire2learn"`, and UUID deployment IDs (`deploymentFormat: 'uuid'`). Live K1-SIM stack run waits for the Docker window. |
| AC-LA-E7-02-05 | pending: Docker window | `tests/sim/core/loading.test.mjs` (`loadHostManifest and infra/scripts/lib.sh agree on shared hosts.json table cases` and `committed tests/sim/hosts.json matches all 6 providers`), `6ae0ebe:infra/scripts/lib.sh` | `node --test tests/sim/core/loading.test.mjs` | **Host-only PASS (35/35 tests, 1.61 s)**: `tests/sim/core/loading.test.mjs` and `6ae0ebe:infra/scripts/lib.sh` validate the committed `tests/sim/hosts.json` and 26 additional shared table cases (`~/cogniate-qa-runs/LA/LA-E7-02/r4/sim-loading-table-tests.log`): `SIM_ALIASES` has 17 hosts (all 16 provider aliases + `lms-sim.test`) and `SIM_LTI_HOSTS` has 15 server-to-server allowlist hosts (excluding browser-only `canvas.school-a.sim.test`), with zero errors. Live `stack:up` K1-SIM verification waits for the Docker window. |

Note: All 6 providers (`blackboard-sim`, `canvas-sim-cloud`, `canvas-sim-self`, `generic-sim`, `moodle-sim`, `brightspace-sim`) load together in one runtime (`loadProviders(runtime)` with no selection in `tests/sim/core/loading.test.mjs`) and pass all 58 host-only tests/subtests across the 5 simulator test files (`~/cogniate-qa-runs/LA/LA-E7-02/r4/sim-all-self-tests.log`).

## Host-Only Suite Timings

| Suite | Command | Result | Measured time |
| --- | --- | --- | --- |
| Loader + shared `hosts.json` table test (`loadHostManifest` vs `infra/scripts/lib.sh`) | `node --test tests/sim/core/loading.test.mjs` | 35 passed, 0 failed | 1.61 s |
| Combined simulator self-tests (all `core/*.test.mjs` and `*/protocol.test.mjs`) | `node --test 'tests/sim/core/*.test.mjs' 'tests/sim/*/protocol.test.mjs'` | 58 passed, 0 failed | 1.67 s |
