Verdict: PASS (host-only K0 + UNIT; K1-SIM and MOODLE-LIVE pending: Docker window)
Round: 1

# LA-E5-22 App key provider (`APP_MASTER_KEY` blobs): QA verification

Tester: QA-2 (Orca task `task_f227f38d98c7`, dispatch `ctx_ba43aa38ddd0`, run `run_06d07dc77faf`), 2026-10-23. Spec: `docs/architecture/ltiaas/tasks/LA-E5-22.md` (`LA-ADR-06` D6 "Scope in LA", D10, D12; `LA-ADR-01` D5 `PortContext.seal`/`unseal`; `operability.md` §2, §4.4, §6.3; `security-delta.md` §10; `BD-A2-77..80`, `BD-A2-91`; `BD-A1-72`). Suite: `tests/ltiaas/tasks-ops/LA-E5-22/` (QA-2 test-first, authored in Round 1).

Independence: QA-2 authored `tests/ltiaas/tasks-ops/LA-E5-22/` from `docs/architecture/ltiaas/tasks/LA-E5-22.md`, `LA-ADR-06-service-operability.md` D6/D10/D12, `LA-ADR-01-channel-kernel.md` D5, `operability.md` §2/§4.4/§6.3, `security-delta.md` §10, and `build-decisions-A2.md` §37/§44 (`BD-A2-77..80`, `BD-A2-91`) / `build-decisions-A1.md` (`BD-A1-72`) before inspecting product source (`services/**`, `packages/**`, `apps/**`).

| Item | Value |
| --- | --- |
| SHA | `c62b373d18648efebb7b374566cfb0c926b6c2f6` (integration `c62b373`; merges lane K `f4545c7b` and `06cf4ca6`) |
| Lane and slot | lane K; no Docker (`HOST-ONLY`; `K1-SIM` row `AC-LA-E5-22-01` and `MOODLE-LIVE` row `AC-LA-E5-22-06` marked `pending: Docker window`) |
| Clone | `~/cogniate-qa-runs/LA/LA-E5-22/r1/clone`: `git clone --no-hardlinks --no-checkout`, detached at `c62b373d18648efebb7b374566cfb0c926b6c2f6`, push URL `no_push`, `npm ci` at root and `tests/`, `node_modules/.vitest-cache` and `node_modules/.vite` deleted before every Vitest run |
| Environment | macOS arm64, Node 24.21.0, npm 11.19.0 |
| Artifacts | `~/cogniate-qa-runs/LA/LA-E5-22/r1/logs/` (`qa2-k0-suite.log`, `la-e5-22-compose-e2e-secrets.log`, `la-e5-22-unit-tests.log`) |

## Acceptance criteria

| AC | Result | Test id | Command | Evidence |
| --- | --- | --- | --- | --- |
| AC-LA-E5-22-01 | pending: Docker window (`K1-SIM`, upgrade route `U1`) | `tests/ltiaas/tasks-ops/LA-E5-22/run.mjs` + `tests/ltiaas/tasks-ops/LA-E5-22/u1.test.ts` (`LA-E5-22-U1OLD`, `AC-LA-E5-22-01`) | `COMPOSE_PROJECT_NAME=qa2-la-sim-r1 PUBLIC_PORT=9443 STACK_SUBNET=172.20.0.0/16 node tests/ltiaas/tasks-ops/LA-E5-22/run.mjs --sha <candidate-sha> --old-sha <pre-LA-E5-22-sha>` | `K1-SIM` upgrade route `U1` suite authored and typechecked (`u1.test.ts`, `run.mjs`); test listing verified for `QA_LA_PHASE=old` and `QA_LA_PHASE=new`. Execution deferred to a booked Docker SIM window. |
| AC-LA-E5-22-02 | PASS (`UNIT` + `K0`) | `tests/ltiaas/tasks-ops/LA-E5-22/app-key-provider.k0.test.ts > Rows 5, 6, 7, 8, 9` + `services/cogniate-app/src/app/sealing.test.ts > AC-LA-E5-22-02` + `services/cogniate-app/src/app/sealing-start.test.ts` | `LA_LEVEL=k0 LA_SCRATCH_CLONE="$PWD" LA_RUN_DIR=~/cogniate-qa-runs/LA/LA-E5-22/r1/logs ./tests/node_modules/.bin/vitest run -c tests/ltiaas/tasks-ops/LA-E5-22/vitest.config.mts --reporter=verbose` | Values sealed after the change start with the `"cgk1"` versioned header and open with matching AAD; legacy blobs (encrypted with `encrypt(masterKey, plaintext)` without header or AAD) also open on a temporary SQLite database (`qa2-k0-suite.log`, `la-e5-22-unit-tests.log`). |
| AC-LA-E5-22-03 | PASS (`UNIT` + `K0`) | `tests/ltiaas/tasks-ops/LA-E5-22/app-key-provider.k0.test.ts > Rows 5, 6, 7, 8, 9` + `services/cogniate-app/src/app/sealing.test.ts > AC-LA-E5-22-03` + `services/cogniate-app/src/kernel/port-context.test.ts` | same | Associated data `app:<table>:<column>:<library_id>:<row key>` binds `connection.ws_token_encrypted` (row key `id`), `connection.ref_token_encrypted` (row key `ref_token_hash`), `resource_link.service_key_encrypted` (`id`), and `picker_session.ltik_encrypted` (`id`). A blob copied to another library's row, another row key, or another column throws `KeyProviderError` (`key_open_failed`); `PortContext.seal`/`unseal` also enforces library, connection, and column binding and rejects `connectionId === null` (`qa2-k0-suite.log`, `la-e5-22-unit-tests.log`). |
| AC-LA-E5-22-04 | PASS (`UNIT` + `K0`) | `tests/ltiaas/tasks-ops/LA-E5-22/app-key-provider.k0.test.ts > Rows 5, 6, 7, 8, 9` + `services/cogniate-app/src/app/sealing.test.ts > AC-LA-E5-22-04` | same | `runtimeTokenFor(TEST_MASTER_KEY, "ply_golden0000000000000000")` produces `'8EuoxYc7NuEdg5c8LoOwSIMR0KrMD_5FIPW4Jv73PtI'`, byte-identical to `HMAC-SHA256(TEST_MASTER_KEY, "runtime-token:" + playId)` base64url via `macSync('runtime-token', 'legacy', ...)` (`qa2-k0-suite.log`, `la-e5-22-unit-tests.log`). |
| AC-LA-E5-22-05 | PASS (`UNIT` + `K0`) | `tests/ltiaas/tasks-ops/LA-E5-22/app-key-provider.k0.test.ts > Rows 1, 2, 3, 4` + `services/cogniate-app/src/config.test.ts > AC-LA-E5-22-05` + `services/cogniate-app/src/app/sealing.test.ts > readAppStartupKeys` | same | `APP_MASTER_KEY_FILE` yields the exact same key bytes as `APP_MASTER_KEY` (case-insensitive hex comparison). Verified all 10 `BD-A2-91` / `BD-A1-72` / `BD-A2-77..80` rows (table below). |
| AC-LA-E5-22-06 | pending: Docker window (`MOODLE-LIVE`, `A-LAB-09`) | Moodle live lane (`A-LAB-09`) | Moodle live lane | Deferred to the Moodle live lane (`pending: Docker window`). |

## Detailed verification of the 10 `LA-E5-22` / `BD-A2-91` UNIT & K0 items

| # | Item | Result | Evidence |
| --- | --- | --- | --- |
| 1 | Settings and file mode rule (`APP_MASTER_KEY_FILE`, no group/world bit, `fstat` on descriptor, `production` refuses `secret_file_mode`, non-production warns `secret_file_mode_open`, hex key case-insensitive, `AC-LA-E5-22-05`) | PASS | `app-key-provider.k0.test.ts > Rows 1, 2, 3, 4` + `services/cogniate-app/src/config.test.ts` (`12/12` passed). |
| 2 | Missing ring fallback (`DEFAULT_APP_KEYRING_FILE === '/run/secrets/app-keys/keyring.json'`; missing ring falls back to `APP_MASTER_KEY(_FILE)` as active `legacy`) | PASS | `app-key-provider.k0.test.ts > Rows 1, 2, 3, 4` + `services/cogniate-app/src/app/sealing.test.ts`. |
| 3 | Ring rules (ring-only start works when ring holds `legacy`; ring without `legacy` throws `key_ring_invalid`; `APP_MASTER_KEY(_FILE)` next to ring must equal `legacy` key) | PASS | `app-key-provider.k0.test.ts > Rows 1, 2, 3, 4` + `services/cogniate-app/src/app/sealing.test.ts`. |
| 4 | Production refusal `app_master_key_in_env` (`STACK_PROFILE=production` with `APP_MASTER_KEY` in env throws `ConfigRefusedError` with `reason: 'app_master_key_in_env'` and `APP_MASTER_KEY_IN_ENV_MESSAGE`) | PASS | `app-key-provider.k0.test.ts > Rows 1, 2, 3, 4` + `services/cogniate-app/src/config.test.ts`. |
| 5 | Sealed values start with `"cgk1"` header and open; legacy blobs also open (`AC-LA-E5-22-02`) | PASS | `app-key-provider.k0.test.ts > Rows 5, 6, 7, 8, 9` + `services/cogniate-app/src/app/sealing.test.ts` + `sealing-start.test.ts`. |
| 6 | AAD row binding (`app:<table>:<column>:<library_id>:<row key>`, cross-library/row/column rejection, bound handle fail-closed, `PortContext.seal`/`unseal`, `AC-LA-E5-22-03`) | PASS | `app-key-provider.k0.test.ts > Rows 5, 6, 7, 8, 9` + `sealing.test.ts` + `sealing-start.test.ts` + `port-context.test.ts`. |
| 7 | `runtimeTokenFor` byte-identical to pre-LA golden (`AC-LA-E5-22-04`) | PASS | `app-key-provider.k0.test.ts > Rows 5, 6, 7, 8, 9` + `sealing.test.ts`. |
| 8 | `app:keys status\|rewrap` (counts, operator policy `evidenceRequired: false`, authenticated metadata re-sealing a crafted colliding legacy blob whose 12-byte IV starts with `"cgk1\x02k2_iv12"`, compare-and-set batching, one `key_provider.rewrap` audit event) | PASS | `app-key-provider.k0.test.ts > Rows 5, 6, 7, 8, 9` + `services/cogniate-app/src/cli/keys.test.ts` (`8/8` passed) + `sealing-start.test.ts` (`3/3` passed). |
| 9 | Readiness `key_version_missing` (`readiness(db, keys)` and operator `/readyz` return `503 { status: 'not_ready', reasons: ['key_version_missing'] }` when a stored blob references a version missing from the ring) | PASS | `app-key-provider.k0.test.ts > Rows 5, 6, 7, 8, 9` + `services/cogniate-app/src/app/metrics.test.ts` (`26/26` passed). |
| 10 | Compose secrets check (`infra/.secrets/app-keys/` mounted read-only at `/run/secrets/app-keys` on `cogniate-app`, hidden from `e2e` by its own `tmpfs`, created `0700` by `stack-up.sh` and `prepare_e2e`, verified by `infra/scripts/compose-e2e-secrets.test.mjs`) | PASS | `app-key-provider.k0.test.ts > Row 10` + `node --test infra/scripts/compose-e2e-secrets.test.mjs` (`3/3` pass) + `npm run test:infra` (`255/255` pass). |

## Other checks

- **QA-2 `LA-E5-22` K0 + UNIT suite (`qa2-k0-suite.log`):** `4/4` tests passed in `8.88s` (including `8` Author unit test files / `70/70` tests in `la-e5-22-unit-tests.log`).
- **Typecheck (`npm run typecheck` + `tests/ltiaas/tasks-ops/LA-E5-22/tsconfig.json`):** `0` errors across all workspaces and `tests/ltiaas/tasks-ops/LA-E5-22`.
- **Fitness F1 (`npm run fitness:lms-names`):** `F1 PASS: 0 files with hits, 0 hits`.
- **Fitness F5 (`npm run fitness:rules`):** `F5 PASS: 6 rules (audit-event-delete, channel-sql-tables, connection-lms, no-score-sync, protocol-urls, sql-portability), 0 hits`.
- **Infra (`npm run test:infra`):** `255` pass, `0` fail (`26.96s`).
