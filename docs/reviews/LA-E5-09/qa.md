Verdict: PASS
Round: 1

# LA-E5-09 Key provider status, re-wrap job, legacy refusal: QA verification

Tester: QA-2 (Orca task `task_756d65316a50`, dispatch `ctx_eb2462bb36b5`), 2026-10-23. Spec: `docs/architecture/ltiaas/tasks/LA-E5-09.md` (with `BD-A2-36`, `BD-A2-38`, `BD-A2-42`, `BD-A2-43`, `BD-A2-50`). Suite: `tests/ltiaas/tasks-ops/LA-E5-09/` (QA-2 test-first, updated for `BD-A2-50` in `d40826d`).

Independence: QA-2 did not read product source (`services/**`, `packages/**`, `apps/**`), Author notes or reviewer files to write `tests/ltiaas/tasks-ops/LA-E5-09/` or during this host-only run on `d40826d`. QA-2 verified all host-only UNIT, K0 and suite checks in an isolated `--no-hardlinks` clone of `d40826d`.

| Item | Value |
| --- | --- |
| SHA | `d40826d765649b5ece01e23d26e53ccd2df7a14b` (integration `d40826d`; holds `LA-E5-09` Round 1 merge `09516e0`, fix round 1 merge `3b14a84`, and QA-2 suite `d40826d`) |
| Lane and slot | lane S2 (with RQ-2 lines in S1 files); no Docker (`HOST-ONLY`; `K1-SIM` rows marked `pending: Docker window`) |
| Clone | `~/cogniate-qa-runs/LA/qa2-r5-d40826d/clone`: `git clone --no-hardlinks --no-checkout`, detached at `d40826d765649b5ece01e23d26e53ccd2df7a14b`, push URL `DISABLED`, `npm ci` at root and `tests/` |
| Environment | macOS arm64, Node 24.21.0, npm 11.19.0 |
| Artifacts | private run folder `~/cogniate-qa-runs/LA/qa2-r5-d40826d/logs/` (umask 077): `npm-ci.log`, `check.log`, `e5-09-unit.log`, `e5-09-qa-host.log`, `task-merges-stat.txt`, `rev.txt`, `remotes.txt`, `status-after.txt` |

## Acceptance criteria

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

### R0 `npm run check` counts at `d40826d` (`check.log`)

| Suite | LA-E0-01 (`1b17261`) | At `d40826d` |
| --- | --- | --- |
| Vitest (`test:unit`) | 97 files; 1,351 passed, 5 skipped | 155 files; 2,498 passed, 5 skipped |
| Infra (`test:infra`, `node --test`) | 197 pass, 0 fail | 243 pass, 0 fail (23 suites) |
| K0 (`test:k0`) | — | 3 files; 121 passed |
| F1 (`fitness:lms-names`) | — | `F1 PASS: 20 files with hits, 74 hits` |
| F5 (`fitness:rules`) | — | `F5 PASS: 6 rules (audit-event-delete, channel-sql-tables, connection-lms, no-score-sync, protocol-urls, sql-portability), 0 hits` |

## Other checks

- **File scope (`09516e0` and fix round `3b14a84`):** Touches `services/lti-service/src/jobs/key-rewrap*.ts`, `services/lti-service/src/http/operator/key-provider*.ts`, `services/lti-service/src/keys/{key-config,sealed-columns}*.ts`, `packages/shared/src/key-provider*.ts`, and the RQ-2 lines in `services/lti-service/src/{main,api-errors.test,http/key-errors,http/operator/index,jobs/index*,store/settings,store/registrations,store/tool-keys}.ts` (`task-merges-stat.txt`). No app or channel files were touched.
- **Clone cleanliness:** `git status --porcelain` in `~/cogniate-qa-runs/LA/qa2-r5-d40826d/clone` is empty after the run (`status-after.txt`, 0 bytes).

## Regression and time

R0 (`npm run check` on the clean clone): PASS (`48.35 s` unit, `0.70 s` K0). Focused 6-file unit run (`e5-09-unit.log`, 70 tests): `1.23 s`. QA-2 host-only suite checks (`tsc --noEmit`, `vitest list` 5 `K1-SIM` cases, `node --check run.mjs`): PASS (`1.8 s`). `AC-LA-E5-09-01` .. `AC-LA-E5-09-05` (`K1-SIM`) and SIM area regressions are `pending: Docker window`.
