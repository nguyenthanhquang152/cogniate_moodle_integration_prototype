Verdict: PASS
Round: 2

# LA-E5-16 `Idempotency-Key` on create routes: QA verification

## Round 2 (fix round 1, `a36d4c5` at `836d579`)

Tester: QA-2 (Orca task `task_629a1e81d6ee`, dispatch `ctx_11b32368a088`), 2026-10-23. Spec: `docs/architecture/ltiaas/tasks/LA-E5-16.md` (with `BD-A2-51`, `BD-A2-56`, `BD-A2-57`, `BD-A2-58`, `B-LA-E5-16-02`). Suite: `tests/ltiaas/tasks-ops/LA-E5-16/` (updated in Round 2 with `BD-A2-56` / `BD-A2-57` / `BD-A2-58` rows).

Independence: QA-2 did not read product source (`services/**`, `packages/**`, `apps/**`), Author notes or reviewer files to write `tests/ltiaas/tasks-ops/LA-E5-16/` or during this host-only run on `836d579`. QA-2 verified all host-only UNIT, K0 and suite checks in an isolated `--no-hardlinks` clone of `836d579`.

| Item | Value |
| --- | --- |
| SHA | `836d579f2a42f7d44b6e470d1e74a17bb46aaee2` (integration `836d579`; holds `LA-E5-16` fix round 1 `a36d4c5`) |
| Lane and slot | lane S1; no Docker (`HOST-ONLY`; `K1-SIM` rows marked `pending: Docker window`) |
| Clone | `~/cogniate-qa-runs/LA/qa2-r7-836d579/clone`: `git clone --no-hardlinks`, detached at `836d579f2a42f7d44b6e470d1e74a17bb46aaee2`, push URL `DISABLED`, `npm ci` at root and `tests/` |
| Environment | macOS arm64, Node 24.21.0, npm 11.19.0 |
| Artifacts | private run folder `~/cogniate-qa-runs/LA/qa2-r7-836d579/logs/` (umask 077): `npm-ci-root.log`, `npm-ci-tests.log`, `check.log`, `e5-16-r2-unit.log`, `qa-suites-host.log`, `task-commits-stat.txt`, `head.txt`, `status-after.txt` |

### Round 2 acceptance criteria and fix rows

| AC / Item | Result | Test id | Command | Evidence |
| --- | --- | --- | --- | --- |
| AC-LA-E5-16-01 | pending: Docker window | `tests/ltiaas/tasks-ops/LA-E5-16/idempotency.test.ts > AC-LA-E5-16-01` | `npx --prefix tests tsc --noEmit -p tests/ltiaas/tasks-ops/LA-E5-16/tsconfig.json && npx --prefix tests vitest list --config tests/ltiaas/tasks-ops/LA-E5-16/vitest.config.mts` | Waits for a SIM Docker window (two `POST /api/lineitems` calls with the same `Idempotency-Key` and body return the same status/body and the simulator records 1 line item create). Route-level replay passes at unit level in `services/lti-service/src/http/idempotency.test.ts` (`e5-16-r2-unit.log`, `qa-suites-host.log`). |
| AC-LA-E5-16-02 | pending: Docker window | `tests/ltiaas/tasks-ops/LA-E5-16/idempotency.test.ts > AC-LA-E5-16-02` | as AC-01 | Waits for a SIM Docker window (same `Idempotency-Key` with another body gives `422 IDEMPOTENCY_KEY_REUSED` with the `BD-A2-58` description and no second simulator call). Passes at unit level in `store/idempotency.test.ts` and `http/idempotency.test.ts` (`e5-16-r2-unit.log`). |
| AC-LA-E5-16-03 | pending: Docker window | `tests/ltiaas/tasks-ops/LA-E5-16/idempotency.test.ts > AC-LA-E5-16-03` | as AC-01 | Waits for a SIM Docker window (two `POST /api/platforms` calls with the same key and body return the same platform id and list one platform). Passed at unit level in `http/idempotency.test.ts > replays reordered JSON for either API key of the account and audits the stored target with the current actor` (`e5-16-r2-unit.log`). |
| AC-LA-E5-16-04 | PASS (UNIT) | `services/lti-service/src/http/idempotency.test.ts > AC-04: a concurrent line item call gets 409 while the first runs, with no admin audit event` + `idempotency on real admin routes (BD-A2-51) > writes a refused admin event for a running claim and mirrors a stored 4xx on replay` + `services/lti-service/src/store/idempotency.test.ts > AC-04: arbitrates claims across independent SQLite connections, then replays the stored answer` + `abandons running claims older than 60 seconds and fences a late old owner` | `npx --no-install vitest run --reporter=verbose services/lti-service/src/http/idempotency.test.ts services/lti-service/src/store/idempotency.test.ts services/lti-service/src/api-errors.test.ts` | While the first request is in flight (`state = running`, within 60 s), a concurrent call with the same `(tool_account_id, key)` gets `409 IDEMPOTENCY_IN_PROGRESS` with `Retry-After` and `details.retryAfter` (at least 1 s until the 60 s claim ends) and the `BD-A2-58` description (`"A request with this Idempotency-Key is still running. Retry after the time in Retry-After."`), and claims older than 60 s are fenced and reclaimable (`BD-A2-51`, `BD-A2-58`). `e5-16-r2-unit.log` |
| AC-LA-E5-16-05 | pending: Docker window | `tests/ltiaas/tasks-ops/LA-E5-16/idempotency.test.ts > AC-LA-E5-16-05` | as AC-01 | Waits for a SIM Docker window (`qa-second` using the same key does not see `cogniate`'s record and creates its own object). Passed at unit level in `http/idempotency.test.ts > isolates tenants and rechecks authentication before a replay` (`e5-16-r2-unit.log`). |
| AC-LA-E5-16-06 | PASS (UNIT) | `services/lti-service/src/store/idempotency.test.ts > AC-06: expires completed answers at 24 hours without deleting unrelated old rows` | as AC-04 | With a controlled clock, a completed idempotency record older than 24 hours (`expires_at <= now`) is ignored/replaced on the next claim with the same key without deleting unrelated rows. `e5-16-r2-unit.log` |
| AC-LA-E5-16-07 | pending: Docker window | `tests/ltiaas/tasks-ops/LA-E5-16/idempotency.test.ts > AC-LA-E5-16-07` | as AC-01 | Waits for a SIM Docker window (create requests without `Idempotency-Key` behave as before). Verified at unit level in `http/idempotency.test.ts > keeps requests without the header and other methods outside the plugin` (`e5-16-r2-unit.log`). |
| BD-A2-56 (same key and body from another platform, deployment or course gives 422) | PASS (UNIT); K1-SIM pending: Docker window | `services/lti-service/src/http/idempotency.test.ts > line item target (BD-A2-56) > replays only for the same platform, deployment, course and line items URL, for a ltik or a service key` + `idempotency on real admin routes (BD-A2-51) > replays deployment creation with decoded params but refuses another platform, route or body` + `tests/ltiaas/tasks-ops/LA-E5-16/idempotency.test.ts > AC-LA-E5-16-02` | as AC-04 + as AC-01 | The fingerprint carries the resolved target per scheme (`POST /api/platforms/:id/deployments`: decoded path `:id`; `POST /api/lineitems`: `{platformId, deploymentId, contextId, lineItemsUrl}` for `LTIK-AUTH-V2` and `SERVICE-AUTH-V1`). Sending the same `Idempotency-Key` and body from another platform, deployment, course (`contextId`), or `lineItemsUrl` returns `422 IDEMPOTENCY_KEY_REUSED` with the `BD-A2-58` description. `e5-16-r2-unit.log`, `qa-suites-host.log` |
| BD-A2-56 (a refused target is never stored or replayed) | PASS (UNIT); K1-SIM pending: Docker window | `services/lti-service/src/http/idempotency.test.ts > line item target (BD-A2-56) > gives a deactivated platform 403 PLATFORM_NOT_ACTIVE, not a replay, and keeps the stored answer` + `idempotency on real admin routes (BD-A2-51) > gives a deleted platform the route refusal, not a stored deployment (BD-A2-56)` + `tests/ltiaas/tasks-ops/LA-E5-16/idempotency.test.ts > BD-A2-56` | as AC-04 + as AC-01 | The idempotency lookup runs after authentication, rate limits and the read-only target checks (`agsContext` / `platformOf`). A deactivated platform gets `403 PLATFORM_NOT_ACTIVE` (not a stored replay), a deleted/unknown platform on `/api/platforms/:id/deployments` gets `404 UNREGISTERED_PLATFORM`, and a refused target is never claimed or stored. `e5-16-r2-unit.log`, `qa-suites-host.log` |
| BD-A2-57 (a platform `429` or `Retry-After` answer is not stored; the retry runs) | PASS (UNIT); K1-SIM pending: Docker window | `services/lti-service/src/http/idempotency.test.ts > frees the key after a 5xx or a platform 429, so the next call reaches the platform (BD-A2-57)` + `idempotency on real admin routes (BD-A2-51) > does not store an answer that carries Retry-After (BD-A2-57)` + `services/lti-service/src/store/idempotency.test.ts > frees failed claims and never stores a 5xx, a 429 or a redirect (BD-A2-57)` + `tests/ltiaas/tasks-ops/LA-E5-16/idempotency.test.ts > BD-A2-57` | as AC-04 + as AC-01 | Only `2xx`, or `4xx` other than `429`, without `Retry-After`, is stored. A `5xx`, a `429` (`429 PLATFORM_RATE_LIMITED`), or any answer carrying `Retry-After` abandons the claim so the next request with the same `Idempotency-Key` and body executes and reaches the platform. `e5-16-r2-unit.log`, `qa-suites-host.log` |
| BD-A2-58 & B-LA-E5-16-02 (`409` `retryAfter` + `Retry-After`, `409`/`422` texts, `onReady` route check) | PASS (UNIT) | `services/lti-service/src/http/idempotency.test.ts > AC-04: a concurrent line item call gets 409 while the first runs, with no admin audit event` + `stops the start when a selected route template is not registered (B-LA-E5-16-02)` + `services/lti-service/src/api-errors.test.ts` | as AC-04 | `409 IDEMPOTENCY_IN_PROGRESS` sets `details.retryAfter` (seconds until the 60 s claim ends, at least 1) and header `Retry-After`; `409` and `422` use the `BD-A2-58` descriptions; an `onReady` check refuses startup if a selected route template has no registered `POST` route. `e5-16-r2-unit.log` |

### R0 `npm run check` counts at `836d579` (`check.log`)

| Suite | LA-E0-01 (`1b17261`) | Round 1 (`d40826d`) | Round 2 (`836d579`) |
| --- | --- | --- | --- |
| Vitest (`test:unit`) | 97 files; 1,351 passed, 5 skipped | 155 files; 2,498 passed, 5 skipped | 169 files; 2,743 passed, 5 skipped |
| Infra (`test:infra`, `node --test`) | 197 pass, 0 fail | 243 pass, 0 fail (23 suites) | 252 pass, 0 fail (23 suites) |
| K0 (`test:k0`) | — | 3 files; 121 passed | 3 files; 121 passed |
| F1 (`fitness:lms-names`) | — | `F1 PASS: 20 files with hits, 74 hits` | `F1 PASS: 9 files with hits, 29 hits` |
| F5 (`fitness:rules`) | — | `F5 PASS: 6 rules, 0 hits` | `F5 PASS: 6 rules (audit-event-delete, channel-sql-tables, connection-lms, no-score-sync, protocol-urls, sql-portability), 0 hits` |

### Round 2 other checks and timing

- **File scope (`a36d4c5`):** Touches only `services/lti-service/src/api-errors.ts`, `services/lti-service/src/http/idempotency.ts`, `services/lti-service/src/http/idempotency.test.ts`, `services/lti-service/src/store/idempotency.ts`, and `services/lti-service/src/store/idempotency.test.ts` (`task-commits-stat.txt`).
- **Clone cleanliness:** `git status --porcelain` in `~/cogniate-qa-runs/LA/qa2-r7-836d579/clone` is empty after the run (`status-after.txt`, 0 bytes).
- **Timing:** Focused 3-file unit run (`e5-16-r2-unit.log`, 31 tests): `2.01 s`. QA-2 host-only suite checks (`tsc --noEmit`, `vitest list` 7 `K1-SIM` cases, `node --check run.mjs`): PASS (`qa-suites-host.log`).

---

## Round 1 (at `d40826d`)

Tester: QA-2 (Orca task `task_756d65316a50`, dispatch `ctx_eb2462bb36b5`), 2026-10-23. Spec: `docs/architecture/ltiaas/tasks/LA-E5-16.md` (with `BD-A2-51`, `Q-LAB-04`). Suite: `tests/ltiaas/tasks-ops/LA-E5-16/` (QA-2 test-first, committed in `d40826d`).

Independence: QA-2 did not read product source (`services/**`, `packages/**`, `apps/**`), Author notes or reviewer files to write `tests/ltiaas/tasks-ops/LA-E5-16/` or during this host-only run on `d40826d`. QA-2 verified all host-only UNIT, K0 and suite checks in an isolated `--no-hardlinks` clone of `d40826d`.

| Item | Value |
| --- | --- |
| SHA | `d40826d765649b5ece01e23d26e53ccd2df7a14b` (integration `d40826d`; holds `LA-E5-16` merge `6ae0ebe` and QA-2 suite `d40826d`) |
| Lane and slot | lane S1; no Docker (`HOST-ONLY`; `K1-SIM` rows marked `pending: Docker window`) |
| Clone | `~/cogniate-qa-runs/LA/qa2-r5-d40826d/clone`: `git clone --no-hardlinks --no-checkout`, detached at `d40826d765649b5ece01e23d26e53ccd2df7a14b`, push URL `DISABLED`, `npm ci` at root and `tests/` |
| Environment | macOS arm64, Node 24.21.0, npm 11.19.0 |
| Artifacts | private run folder `~/cogniate-qa-runs/LA/qa2-r5-d40826d/logs/` (umask 077): `npm-ci.log`, `check.log`, `e5-16-unit.log`, `e5-16-qa-host.log`, `task-merges-stat.txt`, `rev.txt`, `remotes.txt`, `status-after.txt` |

## Acceptance criteria

| AC | Result | Test id | Command | Evidence |
| --- | --- | --- | --- | --- |
| AC-LA-E5-16-01 | pending: Docker window | `tests/ltiaas/tasks-ops/LA-E5-16/idempotency.test.ts > AC-LA-E5-16-01` | `npx --prefix tests tsc --noEmit -p tests/ltiaas/tasks-ops/LA-E5-16/tsconfig.json && npx --prefix tests vitest list --config tests/ltiaas/tasks-ops/LA-E5-16/vitest.config.mts` | Waits for a SIM Docker window (two `POST /api/lineitems` calls with the same `Idempotency-Key` and body return the same status/body and the simulator records 1 line item create). Route-level replay passes at unit level in `services/lti-service/src/http/idempotency.test.ts` (`e5-16-unit.log`, `e5-16-qa-host.log`). |
| AC-LA-E5-16-02 | pending: Docker window | `tests/ltiaas/tasks-ops/LA-E5-16/idempotency.test.ts > AC-LA-E5-16-02` | as AC-01 | Waits for a SIM Docker window (same `Idempotency-Key` with another body gives `422 IDEMPOTENCY_KEY_REUSED` and no second simulator call). Fingerprint checks (`method`, `route`, decoded `params`, RFC 8785 canonical JSON `bodyHash` per `BD-A2-51`) pass at unit level in `store/idempotency.test.ts` and `http/idempotency.test.ts` (`e5-16-unit.log`). |
| AC-LA-E5-16-03 | pending: Docker window | `tests/ltiaas/tasks-ops/LA-E5-16/idempotency.test.ts > AC-LA-E5-16-03` | as AC-01 | Waits for a SIM Docker window (two `POST /api/platforms` calls with the same key and body return the same platform id and list one platform). Passed at unit level in `http/idempotency.test.ts > replays reordered JSON for either API key of the account and audits the stored target with the current actor` (`e5-16-unit.log`). |
| AC-LA-E5-16-04 | PASS (UNIT) | `services/lti-service/src/http/idempotency.test.ts > AC-04: a concurrent line item call gets 409 while the first runs, with no admin audit event` + `idempotency on real admin routes (BD-A2-51) > writes a refused admin event for a running claim and mirrors a stored 4xx on replay` + `services/lti-service/src/store/idempotency.test.ts > AC-04: arbitrates claims across independent SQLite connections, then replays the stored answer` + `abandons running claims older than 60 seconds and fences a late old owner` | `npx --no-install vitest run --reporter=verbose services/lti-service/src/http/idempotency.test.ts services/lti-service/src/store/idempotency.test.ts services/lti-service/src/api-errors.test.ts` | While the first request is in flight (`state = running`, within 60 s), a concurrent call with the same `(tool_account_id, key)` gets `409 IDEMPOTENCY_IN_PROGRESS` (writing one refused admin audit event on admin routes and none on `/api/lineitems`), and claims older than 60 s are fenced and reclaimable (`BD-A2-51`). `e5-16-unit.log` |
| AC-LA-E5-16-05 | pending: Docker window | `tests/ltiaas/tasks-ops/LA-E5-16/idempotency.test.ts > AC-LA-E5-16-05` | as AC-01 | Waits for a SIM Docker window (`qa-second` using the same key does not see `cogniate`'s record and creates its own object). Tenant isolation and pre-replay authentication pass at unit level in `http/idempotency.test.ts > isolates tenants and rechecks authentication before a replay` (`e5-16-unit.log`). |
| AC-LA-E5-16-06 | PASS (UNIT) | `services/lti-service/src/store/idempotency.test.ts > AC-06: expires completed answers at 24 hours without deleting unrelated old rows` + `migration 017 preserves existing accounts and adds an empty table` + `frees failed claims and never stores a 5xx or redirect` | as AC-04 | With a controlled clock, a completed idempotency record older than 24 hours (`expires_at <= now`) is deleted/ignored on the next claim with the same key and the new request executes freshly without deleting unrelated rows. `e5-16-unit.log` |
| AC-LA-E5-16-07 | pending: Docker window | `tests/ltiaas/tasks-ops/LA-E5-16/idempotency.test.ts > AC-LA-E5-16-07` | as AC-01 | Waits for a SIM Docker window (create requests without `Idempotency-Key` behave as before). Verified at unit level in `http/idempotency.test.ts > keeps requests without the header and other methods outside the plugin` (`e5-16-unit.log`). |

### R0 `npm run check` counts at `d40826d` (`check.log`)

| Suite | LA-E0-01 (`1b17261`) | At `d40826d` |
| --- | --- | --- |
| Vitest (`test:unit`) | 97 files; 1,351 passed, 5 skipped | 155 files; 2,498 passed, 5 skipped |
| Infra (`test:infra`, `node --test`) | 197 pass, 0 fail | 243 pass, 0 fail (23 suites) |
| K0 (`test:k0`) | — | 3 files; 121 passed |
| F1 (`fitness:lms-names`) | — | `F1 PASS: 20 files with hits, 74 hits` |
| F5 (`fitness:rules`) | — | `F5 PASS: 6 rules (audit-event-delete, channel-sql-tables, connection-lms, no-score-sync, protocol-urls, sql-portability), 0 hits` |

## Other checks

- **File scope (`6ae0ebe`):** `LA-E5-16` touches `services/lti-service/src/db/migrations/017_idempotency_record.sql`, `services/lti-service/src/store/idempotency*.ts`, `services/lti-service/src/http/idempotency*.ts`, `services/lti-service/src/http/app.ts`, `services/lti-service/src/api-errors*.ts`, and `services/lti-service/src/store/audit*.ts` (opaque idempotency key retention per `BD-A2-51`) (`task-merges-stat.txt`). Does not edit `routes/admin.ts` or `routes/services.ts`.
- **Clone cleanliness:** `git status --porcelain` in `~/cogniate-qa-runs/LA/qa2-r5-d40826d/clone` is empty after the run (`status-after.txt`, 0 bytes).

## Regression and time

R0 (`npm run check` on the clean clone): PASS (`48.35 s` unit, `0.70 s` K0). Focused 3-file unit run (`e5-16-unit.log`, 26 tests): `2.29 s`. QA-2 host-only suite checks (`tsc --noEmit`, `vitest list` 5 `K1-SIM` cases, `node --check run.mjs`): PASS (`1.7 s`). `AC-LA-E5-16-01` .. `03`, `05`, `07` (`K1-SIM`) and SIM area regressions are `pending: Docker window`.
