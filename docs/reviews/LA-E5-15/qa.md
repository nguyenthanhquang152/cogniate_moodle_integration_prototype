Verdict: PASS
Round: 1

# LA-E5-15 Service key revocation, re-issue and write scope: QA verification

Tester: QA-2 (Orca task `task_756d65316a50`, dispatch `ctx_eb2462bb36b5`), 2026-10-23. Spec: `docs/architecture/ltiaas/tasks/LA-E5-15.md` (with `BD-A2-12`, `BD-A2-47`, `Q-LAB-04`). Suite: `tests/ltiaas/tasks-ops/LA-E5-15/` (QA-2 test-first, committed in `d40826d`).

Independence: QA-2 did not read product source (`services/**`, `packages/**`, `apps/**`), Author notes or reviewer files to write `tests/ltiaas/tasks-ops/LA-E5-15/` or during this host-only run on `d40826d`. QA-2 verified all host-only UNIT, K0 and suite checks in an isolated `--no-hardlinks` clone of `d40826d`.

| Item | Value |
| --- | --- |
| SHA | `d40826d765649b5ece01e23d26e53ccd2df7a14b` (integration `d40826d`; holds `LA-E5-15` merge `e67819c` and QA-2 suite `d40826d`) |
| Lane and slot | lane S2 (with RQ-2 lines in S1 and L files); no Docker (`HOST-ONLY`; `K1-SIM` rows marked `pending: Docker window`) |
| Clone | `~/cogniate-qa-runs/LA/qa2-r5-d40826d/clone`: `git clone --no-hardlinks --no-checkout`, detached at `d40826d765649b5ece01e23d26e53ccd2df7a14b`, push URL `DISABLED`, `npm ci` at root and `tests/` |
| Environment | macOS arm64, Node 24.21.0, npm 11.19.0 |
| Artifacts | private run folder `~/cogniate-qa-runs/LA/qa2-r5-d40826d/logs/` (umask 077): `npm-ci.log`, `check.log`, `e5-15-unit.log`, `e5-15-qa-host.log`, `task-merges-stat.txt`, `rev.txt`, `remotes.txt`, `status-after.txt` |

## Acceptance criteria

| AC | Result | Test id | Command | Evidence |
| --- | --- | --- | --- | --- |
| AC-LA-E5-15-01 | pending: Docker window | `tests/ltiaas/tasks-ops/LA-E5-15/service-keys.test.ts > AC-LA-E5-15-01` | `npx --prefix tests tsc --noEmit -p tests/ltiaas/tasks-ops/LA-E5-15/tsconfig.json && npx --prefix tests vitest list --config tests/ltiaas/tasks-ops/LA-E5-15/vitest.config.mts` | Waits for a SIM Docker window (`POST /api/service-keys/revoke {platformId}` → `200 {revoked: n}` with `n >= 1`, and revoked service key gives the same `401` as an unknown service key). Unit checks pass now in `services/lti-service/src/store/service-keys.test.ts` and `services/lti-service/src/http/routes/service-key-admin.test.ts` (`e5-15-unit.log`, `e5-15-qa-host.log`). |
| AC-LA-E5-15-02 | pending: Docker window | `tests/ltiaas/tasks-ops/LA-E5-15/service-keys.test.ts > AC-LA-E5-15-02` | as AC-01 | Waits for a SIM Docker window (revoke with `resourceLinkId` revokes only that resource link while another resource link on the same platform still gets `2xx`). Filter isolation passes at unit level in `store/service-keys.test.ts > combines every revoke filter, limits it to the account and counts only newly revoked rows` (`e5-15-unit.log`). |
| AC-LA-E5-15-03 | pending: Docker window | `tests/ltiaas/tasks-ops/LA-E5-15/service-keys.test.ts > AC-LA-E5-15-03` | as AC-01 | Waits for a SIM Docker window (next learner launch after revoke issues a different `services.serviceKey` that passes score POST while the old key stays `401`). Epoch advancement passes at unit level in `store/service-keys.test.ts > a revoked key stays invalid while the next launch advances the epoch exactly once` (`e5-15-unit.log`). |
| AC-LA-E5-15-04 | PASS (UNIT) | `services/lti-service/src/store/service-keys.test.ts > service keys with the key provider (LA-E5-08) > AC-LA-E5-15-04: epoch 0 keeps the golden inputs; epoch 1 adds a length-framed epoch part` + `service keys (contract §3.3) > a revoked key stays invalid while the next launch advances the epoch exactly once` + `rolls back a failed re-issue without losing its revocation or advancing the epoch` | `npx --no-install vitest run --reporter=verbose services/lti-service/src/store/service-keys.test.ts services/lti-service/src/http/auth-scope.test.ts services/lti-service/src/http/operator/service-keys.test.ts services/lti-service/src/http/routes/service-key-admin.test.ts services/lti-service/src/api-errors.test.ts` | For the same `(account, platform, deployment, context, resourceLink)` tuple, `epoch = 0` produces the exact pre-LA-E5-15 derived key, while `epoch = 1` appends a length-framed epoch field and produces a different key. `e5-15-unit.log` |
| AC-LA-E5-15-05 | pending: Docker window | `tests/ltiaas/tasks-ops/LA-E5-15/service-keys.test.ts > AC-LA-E5-15-05` | as AC-01 | Waits for a SIM Docker window (`serviceKeyWriteScope: "resource-link"` on a fresh account gives `403 SERVICE_KEY_SCOPE` on another resource link's line item and `2xx` on its own). Unit checks for `BD-A2-47` (fast path on `claims.ags.lineitem`, guarded AGS GET, 10-min TTL / 10,000-entry LRU cache, propagation of `PLATFORM_ERROR` and `PLATFORM_RATE_LIMITED`) pass in `http/auth-scope.test.ts` (8 cases, `e5-15-unit.log`). |
| AC-LA-E5-15-06 | pending: Docker window | `tests/ltiaas/tasks-ops/LA-E5-15/service-keys.test.ts > AC-LA-E5-15-06` | as AC-01 | Waits for a SIM Docker window (`LTIK-AUTH-V2` score POST with `serviceKeyWriteScope: "resource-link"` is unaffected). Verified at unit level in `http/auth-scope.test.ts > accepts the claimed lineitem without a GET and leaves other auth/account modes unchanged` (`e5-15-unit.log`). |
| AC-LA-E5-15-07 | pending: Docker window | `tests/ltiaas/tasks-ops/LA-E5-15/service-keys.test.ts > AC-LA-E5-15-07` | as AC-01 | Waits for a SIM Docker window (key with `scopes: ["launch"]` on `POST /api/service-keys/revoke` gets `403 API_KEY_SCOPE_MISSING`; tenant and operator revokes each write one `service_key.revoke` audit event). Unit checks pass in `http/operator/service-keys.test.ts` (`BD-A2-12` suspended/closed account revokes allowed) and `http/routes/service-key-admin.test.ts` (9 cases, `e5-15-unit.log`). |

### R0 `npm run check` counts at `d40826d` (`check.log`)

| Suite | LA-E0-01 (`1b17261`) | At `d40826d` |
| --- | --- | --- |
| Vitest (`test:unit`) | 97 files; 1,351 passed, 5 skipped | 155 files; 2,498 passed, 5 skipped |
| Infra (`test:infra`, `node --test`) | 197 pass, 0 fail | 243 pass, 0 fail (23 suites) |
| K0 (`test:k0`) | — | 3 files; 121 passed |
| F1 (`fitness:lms-names`) | — | `F1 PASS: 20 files with hits, 74 hits` |
| F5 (`fitness:rules`) | — | `F5 PASS: 6 rules (audit-event-delete, channel-sql-tables, connection-lms, no-score-sync, protocol-urls, sql-portability), 0 hits` |

## Other checks

- **File scope (`e67819c`):** Touches `services/lti-service/src/db/migrations/016_service_key_epoch.sql`, `services/lti-service/src/store/service-keys*.ts`, `services/lti-service/src/http/{auth,auth-scope.test}.ts`, `services/lti-service/src/http/routes/service-key-admin*.ts`, `services/lti-service/src/http/operator/service-keys*.ts`, and RQ-2 wiring in `services/lti-service/src/{api-errors.test,http/app,http/key-errors,http/operator/index,http/routes/compat,http/routes/services}.ts` (`task-merges-stat.txt`). No app or channel files were touched.
- **Clone cleanliness:** `git status --porcelain` in `~/cogniate-qa-runs/LA/qa2-r5-d40826d/clone` is empty after the run (`status-after.txt`, 0 bytes).

## Regression and time

R0 (`npm run check` on the clean clone): PASS (`48.35 s` unit, `0.70 s` K0). Focused 5-file unit run (`e5-15-unit.log`, 31 tests): `0.89 s`. QA-2 host-only suite checks (`tsc --noEmit`, `vitest list` 6 `K1-SIM` cases, `node --check run.mjs`): PASS (`1.7 s`). `AC-LA-E5-15-01` .. `03` and `05` .. `07` (`K1-SIM`) and SIM area regressions are `pending: Docker window`.
