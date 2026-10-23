Verdict: PASS
Round: 3

# LA-E5-09 Key provider status, re-wrap job, legacy refusal: QA verification

## K1-SIM Docker slot 1 (`4209dcb`, Batch 3 on `qa2-la-sim-r3`)

Tester: QA-2 (Orca task `task_0336155284b2`, dispatch `ctx_c5845e359f4b`, run `run_06d07dc77faf`), 2026-10-23. Verified in SIM slot 1 (`04:41Z–05:29Z`) on a clean `--no-hardlinks` clone of `4209dcb` (product code `77df44e`) in `~/cogniate-qa-runs/LA/qa2-sim-4209dcb/clone-batch3` (`COMPOSE_PROJECT_NAME=qa2-la-sim-r3`, `PUBLIC_PORT=9443`, `STACK_SUBNET=172.20.0.0/16`).

| AC | Result | Test id | Command | Evidence |
| --- | --- | --- | --- | --- |
| AC-LA-E5-09-01 .. 05 & BD-A2-50 | PASS (K1-SIM) | `tests/ltiaas/tasks-ops/LA-E5-09/key-provider.test.ts` (5 `K1-SIM` tests: `AC-LA-E5-09-01` .. `05` including `BD-A2-50` trace join) | `COMPOSE_PROJECT_NAME=qa2-la-sim-r3 PUBLIC_PORT=9443 STACK_SUBNET=172.20.0.0/16 node tests/ltiaas/tasks-ops/run-batch3.mjs --sha 4209dcb --workdir ~/cogniate-qa-runs/LA/qa2-sim-4209dcb/clone-batch3 --replace-tests` | All 5 `K1-SIM` tests pass (`container-LA-E5-09`, `5/5` passed in `13,816 ms`; artifacts at `tests/host/artifacts/qa2-la-sim-r3-4209dcb-2026-10-23T05-11-11-546Z`, log `~/cogniate-qa-runs/LA/qa2-sim-4209dcb/logs/batch-3.log`). |
| AC-LA-E5-09-06 .. 08 | PASS (UNIT) | `services/lti-service/src/jobs/key-rewrap.test.ts`, `packages/shared/src/key-provider.test.ts` | `npx --no-install vitest run services/lti-service/src/jobs/key-rewrap.test.ts packages/shared/src/key-provider.test.ts` | Verified in host-only pre-gate (`host-pregate.log`) and Round 2 below. |

---

## Round 2 (host-only at `5b5b3a2`)

Tester: QA-2 (Round 1: task `task_756d65316a50` / `ctx_eb2462bb36b5`; Round 2: task `task_00bf4a549499` / `ctx_4528c07049d5`), 2026-10-23. Spec: `docs/architecture/ltiaas/tasks/LA-E5-09.md` (with `BD-A2-36`, `BD-A2-38`, `BD-A2-42`, `BD-A2-43`, `BD-A2-50`). Suite: `tests/ltiaas/tasks-ops/LA-E5-09/` (QA-2 test-first, updated for `BD-A2-50` trace join in Round 2).

Independence: QA-2 did not read product source (`services/**`, `packages/**`, `apps/**`), Author notes or reviewer files to write `tests/ltiaas/tasks-ops/LA-E5-09/` or during Round 1 (`d40826d`) and Round 2 (`5b5b3a2`). QA-2 verified all host-only UNIT, K0 and suite checks in isolated `--no-hardlinks` clones.

## Round 2

| Item | Value |
| --- | --- |
| SHA | `5b5b3a2a91e7d8cb38b425e9c21d78b4c49cd943` (integration `5b5b3a2`; holds `LA-E5-09` trace-join merge `676b7d9` (`1c02208`) over `3b14a84` and `09516e0`) |
| Lane and slot | lane S2 (with RQ-2 lines in S1 files); no Docker (`HOST-ONLY`; `K1-SIM` rows marked `pending: Docker window`) |
| Clone | `~/cogniate-qa-runs/LA/qa2-r6-5b5b3a2/clone`: `git clone --no-hardlinks --no-checkout`, detached at `5b5b3a2a91e7d8cb38b425e9c21d78b4c49cd943`, push URL `DISABLED`, `npm ci` at root and `tests/` |
| Environment | macOS arm64, Node 24.21.0, npm 11.19.0 |
| Artifacts | private run folder `~/cogniate-qa-runs/LA/qa2-r6-5b5b3a2/logs/` (umask 077): `npm-ci.log`, `check.log`, `e5-09-r2-unit.log`, `qa-suites-r2.log`, `task-merges-stat.txt`, `rev.txt`, `remotes.txt`, `status-after.txt` |

### Round 2 acceptance criteria

| AC | Result | Test id | Command | Evidence |
| --- | --- | --- | --- | --- |
| AC-LA-E5-09-01 | pending: Docker window | `tests/ltiaas/tasks-ops/LA-E5-09/key-provider.test.ts > AC-LA-E5-09-01` | `npx --prefix tests tsc --noEmit -p tests/ltiaas/tasks-ops/LA-E5-09/tsconfig.json && npx --prefix tests vitest list --config tests/ltiaas/tasks-ops/LA-E5-09/vitest.config.mts` | Waits for a SIM Docker window (`GET /operator/v1/key-provider` on a stack with only `LTI_MASTER_KEY`). Operator status route and sealed/derived counts pass in `services/lti-service/src/http/operator/key-provider.test.ts` and `services/lti-service/src/keys/sealed-columns.test.ts` (`e5-09-r2-unit.log`, `qa-suites-r2.log`). |
| AC-LA-E5-09-02 | pending: Docker window | `tests/ltiaas/tasks-ops/LA-E5-09/key-provider.test.ts > AC-LA-E5-09-02` | as AC-01 | Waits for a SIM Docker window (`infra/.secrets/lti/keyring.json` with `active: "k2"`, restart, `POST …/signing-keys` increments `k2` `sealedCount`). Keyring loading and sealed-column counting pass in `key-config.test.ts` and `sealed-columns.test.ts` (`e5-09-r2-unit.log`). |
| AC-LA-E5-09-03 | pending: Docker window | `tests/ltiaas/tasks-ops/LA-E5-09/key-provider.test.ts > AC-LA-E5-09-03` | as AC-01 | Waits for a SIM Docker window (`POST /operator/v1/key-provider/rewrap` → `202 {job: "key-rewrap", traceId}`, `503 NOT_READY` / `409 JOB_RUNNING` per `BD-A2-50`, and `sealedCount` moved to `k2`). Route and runner guards (`BD-A2-50`) pass in `http/operator/key-provider.test.ts` (13 cases, `e5-09-r2-unit.log`). |
| AC-LA-E5-09-04 | pending: Docker window | `tests/ltiaas/tasks-ops/LA-E5-09/key-provider.test.ts > AC-LA-E5-09-04` | as AC-01 | Waits for a SIM Docker window (learner launch, Deep Linking response, token request, and score POST with existing service key after re-wrap). |
| AC-LA-E5-09-05 | pending: Docker window | `tests/ltiaas/tasks-ops/LA-E5-09/key-provider.test.ts > AC-LA-E5-09-05` | as AC-01 | Waits for a SIM Docker window (`job_run {job: "key-rewrap"}` log line and two `key_provider.rewrap` audit events linked by `traceId`). Verified at unit level in `http/operator/key-provider.test.ts` (`e5-09-r2-unit.log`). |
| AC-LA-E5-09-06 | PASS (UNIT) | `services/lti-service/src/jobs/key-rewrap.test.ts > key-rewrap > AC-06: stop after one 100-row batch, resume to the full-run result, and change no blob on a third run` + `compare-and-set preserves a blob changed after selection and counts the skip` + `a failed batch rolls back all its changes, keeps earlier batches, audits the class only, and leaves refusal off` | `npx --no-install vitest run --reporter=verbose packages/shared/src/key-provider.test.ts services/lti-service/src/http/operator/key-provider.test.ts services/lti-service/src/jobs/key-rewrap.test.ts services/lti-service/src/keys/key-config.test.ts services/lti-service/src/keys/sealed-columns.test.ts services/lti-service/src/jobs/index.test.ts` | Stopping a re-wrap after the first 100-row batch records `outcome: "partial"` and resuming reaches the same state as a full run; a third run changes 0 rows (`BD-A2-36`). `e5-09-r2-unit.log` |
| AC-LA-E5-09-07 | PASS (UNIT) | `services/lti-service/src/jobs/key-rewrap.test.ts > key-rewrap > AC-07: authenticated legacy format is re-sealed even when legacy is active; row binding and derived keys survive` + `packages/shared/src/key-provider.test.ts > seal and open > a live refusal blocks legacy open and openSync, but preserves headered legacy-version blobs and derived keys` + `services/lti-service/src/keys/key-config.test.ts > loadKeyProvider > all loaded providers observe committed legacy refusal, keep other settings, and restore refusal after restart` | as AC-06 | After a complete run with no remaining legacy blob, `service_setting` stores `legacyBlobs: "refused"`, all providers observe the refusal live and across restarts, and opening an unheadered legacy blob fails with `key_open_failed {reason: "legacy_refused"}`. `e5-09-r2-unit.log` |
| AC-LA-E5-09-08 | PASS (UNIT) | `services/lti-service/src/jobs/key-rewrap.test.ts > key-rewrap > AC-08: a lease with 9999 ms left leaves legacy rows and the refusal setting unchanged` + `AC-08: a lease with 0 ms left leaves legacy rows and the refusal setting unchanged` + `BD-A2-38: re-wrap identifies a legacy IV that resembles an active cgk1 header` + `BD-A2-43: final verification finds a legacy row inserted after its table was processed` + `BD-A2-43: a final verification that reaches the lease margin stops without refusal` + `an unreadable blob prevents refusal and produces a failed event` | as AC-06 | Any run that stops early (`lease` margin `< 10 s`, abort signal, `legacy_remains` in final verification per `BD-A2-43`, or an unreadable blob) or encounters a legacy IV that resembles a `cgk1` header (`BD-A2-38`) does not set the refusal flag. `e5-09-r2-unit.log` |
| BD-A2-50 (`202` `traceId` is the trace of the job-end event) | PASS (UNIT; K1-SIM pending: Docker window) | `services/lti-service/src/http/operator/key-provider.test.ts > starts the actual on-demand runner, returns 202, and records one request event, one completion event and one job log` + `a failed run logs failed while its audit event records outcome failed with result ok` + `tests/ltiaas/tasks-ops/LA-E5-09/key-provider.test.ts > AC-LA-E5-09-05` | as AC-06 | `POST /operator/v1/key-provider/rewrap` passes the request `traceId` to `runner.runNow('key-rewrap', { traceId })` (`1c02208` in `676b7d9`), so the `202` `traceId` equals the `traceId` of both the operator request event, the `system:key-rewrap` job-end audit event, and the `job_run` log line (and `GET /operator/v1/audit?action=key_provider.rewrap&traceId=<traceId>` returns both events). `e5-09-r2-unit.log`, `qa-suites-r2.log` |

### R0 `npm run check` counts at `5b5b3a2` (`check.log`)

| Suite | Round 1 (`d40826d`) | Round 2 (`5b5b3a2`) |
| --- | --- | --- |
| Vitest (`test:unit`) | 155 files; 2,498 passed, 5 skipped | 164 files; 2,625 passed, 5 skipped |
| Infra (`test:infra`, `node --test`) | 243 pass, 0 fail (23 suites) | 252 pass, 0 fail (23 suites) |
| K0 (`test:k0`) | 3 files; 121 passed | 3 files; 121 passed |
| F1 (`fitness:lms-names`) | `F1 PASS: 20 files with hits, 74 hits` | `F1 PASS: 20 files with hits, 74 hits` |
| F5 (`fitness:rules`) | `F5 PASS: 6 rules, 0 hits` | `F5 PASS: 6 rules, 0 hits` |

### Round 2 other checks

- **File scope (`1c02208` in `676b7d9`):** Touches `services/lti-service/src/http/operator/{key-provider,key-provider.test}.ts` (`task-merges-stat.txt`).
- **Clone cleanliness:** `git status --porcelain` in `~/cogniate-qa-runs/LA/qa2-r6-5b5b3a2/clone` is empty after the run (`status-after.txt`, 0 bytes).
- **Measured time (Round 2):** Focused 6-file unit run (`e5-09-r2-unit.log`, 70 tests): `1.39 s`; QA-2 host-only suite checks (`tsc --noEmit`, `vitest list` 5 `K1-SIM` cases, `node --check run.mjs`): `1.6 s`.

---

## Round 1

| Item | Value |
| --- | --- |
| SHA | `d40826d765649b5ece01e23d26e53ccd2df7a14b` (integration `d40826d`; holds `LA-E5-09` Round 1 merge `09516e0`, fix round 1 merge `3b14a84`, and QA-2 suite `d40826d`) |
| Lane and slot | lane S2 (with RQ-2 lines in S1 files); no Docker (`HOST-ONLY`; `K1-SIM` rows marked `pending: Docker window`) |
| Clone | `~/cogniate-qa-runs/LA/qa2-r5-d40826d/clone`: `git clone --no-hardlinks --no-checkout`, detached at `d40826d765649b5ece01e23d26e53ccd2df7a14b`, push URL `DISABLED`, `npm ci` at root and `tests/` |
| Environment | macOS arm64, Node 24.21.0, npm 11.19.0 |
| Artifacts | private run folder `~/cogniate-qa-runs/LA/qa2-r5-d40826d/logs/` (umask 077): `npm-ci.log`, `check.log`, `e5-09-unit.log`, `e5-09-qa-host.log`, `task-merges-stat.txt`, `rev.txt`, `remotes.txt`, `status-after.txt` |

### Round 1 acceptance criteria

| AC | Result | Test id | Command | Evidence |
| --- | --- | --- | --- | --- |
| AC-LA-E5-09-01 | pending: Docker window | `tests/ltiaas/tasks-ops/LA-E5-09/key-provider.test.ts > AC-LA-E5-09-01` | `npx --prefix tests tsc --noEmit -p tests/ltiaas/tasks-ops/LA-E5-09/tsconfig.json && npx --prefix tests vitest list --config tests/ltiaas/tasks-ops/LA-E5-09/vitest.config.mts` | Waits for a SIM Docker window (`GET /operator/v1/key-provider` on a stack with only `LTI_MASTER_KEY`). Operator status route and sealed/derived counts pass now in `services/lti-service/src/http/operator/key-provider.test.ts` and `services/lti-service/src/keys/sealed-columns.test.ts` (`e5-09-unit.log`, `e5-09-qa-host.log`). |
| AC-LA-E5-09-02 | pending: Docker window | `tests/ltiaas/tasks-ops/LA-E5-09/key-provider.test.ts > AC-LA-E5-09-02` | as AC-01 | Waits for a SIM Docker window (`infra/.secrets/lti/keyring.json` with `active: "k2"`, restart, `POST …/signing-keys` increments `k2` `sealedCount`). Keyring loading and sealed-column counting pass in `key-config.test.ts` and `sealed-columns.test.ts` (`e5-09-unit.log`). |
| AC-LA-E5-09-03 | pending: Docker window | `tests/ltiaas/tasks-ops/LA-E5-09/key-provider.test.ts > AC-LA-E5-09-03` | as AC-01 | Waits for a SIM Docker window (`POST /operator/v1/key-provider/rewrap` → `202 {job: "key-rewrap", traceId}`, `503 NOT_READY` / `409 JOB_RUNNING` per `BD-A2-50`, and `sealedCount` moved to `k2`). Route and runner guards (`BD-A2-50`: `503` on idle/waiting/stopping/off/missing runner with `Retry-After: 30` and no audit event; `409` on live lease with one refused audit event) pass in `http/operator/key-provider.test.ts` (13 cases, `e5-09-unit.log`). |
| AC-LA-E5-09-04 | pending: Docker window | `tests/ltiaas/tasks-ops/LA-E5-09/key-provider.test.ts > AC-LA-E5-09-04` | as AC-01 | Waits for a SIM Docker window (learner launch, Deep Linking response, token request, and score POST with existing service key after re-wrap). |
| AC-LA-E5-09-05 | pending: Docker window | `tests/ltiaas/tasks-ops/LA-E5-09/key-provider.test.ts > AC-LA-E5-09-05` | as AC-01 | Waits for a SIM Docker window (`job_run {job: "key-rewrap"}` log line and two `key_provider.rewrap` audit events linked by `traceId`). Verified at unit level in `http/operator/key-provider.test.ts > starts the actual on-demand runner, returns 202, and records one request event, one completion event and one job log` (`e5-09-unit.log`). |
| AC-LA-E5-09-06 | PASS (UNIT) | `services/lti-service/src/jobs/key-rewrap.test.ts > key-rewrap > AC-06: stop after one 100-row batch, resume to the full-run result, and change no blob on a third run` + `compare-and-set preserves a blob changed after selection and counts the skip` + `a failed batch rolls back all its changes, keeps earlier batches, audits the class only, and leaves refusal off` | `npx --no-install vitest run --reporter=verbose packages/shared/src/key-provider.test.ts services/lti-service/src/http/operator/key-provider.test.ts services/lti-service/src/jobs/key-rewrap.test.ts services/lti-service/src/keys/key-config.test.ts services/lti-service/src/keys/sealed-columns.test.ts services/lti-service/src/jobs/index.test.ts` | Stopping a re-wrap after the first 100-row batch records `outcome: "partial"` and resuming reaches the same state as a full run; a third run changes 0 rows (`BD-A2-36`). `e5-09-unit.log` |
| AC-LA-E5-09-07 | PASS (UNIT) | `services/lti-service/src/jobs/key-rewrap.test.ts > key-rewrap > AC-07: authenticated legacy format is re-sealed even when legacy is active; row binding and derived keys survive` + `packages/shared/src/key-provider.test.ts > seal and open > a live refusal blocks legacy open and openSync, but preserves headered legacy-version blobs and derived keys` + `services/lti-service/src/keys/key-config.test.ts > loadKeyProvider > all loaded providers observe committed legacy refusal, keep other settings, and restore refusal after restart` | as AC-06 | After a complete run with no remaining legacy blob, `service_setting` stores `legacyBlobs: "refused"`, all providers observe the refusal live and across restarts (rejecting malformed persisted settings at start per fix round `3b14a84`), and opening an unheadered legacy blob fails with `key_open_failed {reason: "legacy_refused"}`. `e5-09-unit.log` |
| AC-LA-E5-09-08 | PASS (UNIT) | `services/lti-service/src/jobs/key-rewrap.test.ts > key-rewrap > AC-08: a lease with 9999 ms left leaves legacy rows and the refusal setting unchanged` + `AC-08: a lease with 0 ms left leaves legacy rows and the refusal setting unchanged` + `BD-A2-38: re-wrap identifies a legacy IV that resembles an active cgk1 header` + `BD-A2-43: final verification finds a legacy row inserted after its table was processed` + `BD-A2-43: a final verification that reaches the lease margin stops without refusal` + `an unreadable blob prevents refusal and produces a failed event` | as AC-06 | Any run that stops early (`lease` margin `< 10 s`, abort signal, `legacy_remains` in final verification per `BD-A2-43`, or an unreadable blob) or encounters a legacy IV that resembles a `cgk1` header (`BD-A2-38`) does not set the refusal flag. `e5-09-unit.log` |
