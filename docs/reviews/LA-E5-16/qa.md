Verdict: PASS
Round: 1

# LA-E5-16 `Idempotency-Key` on create routes: QA verification

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
