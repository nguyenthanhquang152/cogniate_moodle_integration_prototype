Verdict: PASS
Round: 2

# LA-E5-03 Rate limits: QA verification

Tester: QA-2 (Orca task `task_756d65316a50`, dispatch `ctx_eb2462bb36b5`), 2026-10-23. Spec: `docs/architecture/ltiaas/tasks/LA-E5-03.md` (with `BD-A2-16`..`BD-A2-20`, `BD-A2-30`, `Q-LAB-04`). Suite: `tests/ltiaas/tasks-ops/LA-E5-03/` (QA-2 test-first, committed in `e77aeb5` and updated in `d680e7f`).

Independence: QA-2 did not read product source (`services/**`, `packages/**`, `apps/**`), Author notes or reviewer files to write `tests/ltiaas/tasks-ops/LA-E5-03/` or during this host-only run on `d40826d`. QA-2 verified all host-only UNIT, K0 and suite checks on the Round 2 state (`8706619` over Round 1 `9cbd043`) in an isolated `--no-hardlinks` clone of `d40826d`.

| Item | Value |
| --- | --- |
| SHA | `d40826d765649b5ece01e23d26e53ccd2df7a14b` (integration `d40826d`; holds `LA-E5-03` request 1 in `3c7221d`, request 2 in `4a2234d`, Round 1 merge `9cbd043`, Round 2 fix merge `8706619`, and QA-2 suite `d680e7f`) |
| Lane and slot | lane S1 (with request 1 in L `lti/codes.ts` and request 2 in S2 `http/auth.ts`); no Docker (`HOST-ONLY`; `K1-SIM` rows marked `pending: Docker window`) |
| Clone | `~/cogniate-qa-runs/LA/qa2-r5-d40826d/clone`: `git clone --no-hardlinks --no-checkout`, detached at `d40826d765649b5ece01e23d26e53ccd2df7a14b`, push URL `DISABLED`, `npm ci` at root and `tests/` |
| Environment | macOS arm64, Node 24.21.0, npm 11.19.0 |
| Artifacts | private run folder `~/cogniate-qa-runs/LA/qa2-r5-d40826d/logs/` (umask 077): `npm-ci.log`, `check.log`, `e5-03-unit.log`, `e5-03-qa-host.log`, `task-merges-stat.txt`, `rev.txt`, `remotes.txt`, `status-after.txt` |

## Acceptance criteria

| AC | Result | Test id | Command | Evidence |
| --- | --- | --- | --- | --- |
| AC-LA-E5-03-01 | pending: Docker window | `tests/ltiaas/tasks-ops/LA-E5-03/rate-limits.test.ts > AC-LA-E5-03-01` | `npx --prefix tests tsc --noEmit -p tests/ltiaas/tasks-ops/LA-E5-03/tsconfig.json && npx --prefix tests vitest list --config tests/ltiaas/tasks-ops/LA-E5-03/vitest.config.mts` | Waits for a SIM Docker window (fresh account `api` limit `5/min, burst 5` → 6th `GET /api/idtoken` gives `429 RATE_LIMITED` while `cogniate` gives `200`). Verified at unit level in `services/lti-service/src/http/rate-limit-http.test.ts > accounts stay isolated, and account edits apply to the next authenticated request` (`e5-03-unit.log`, `e5-03-qa-host.log`). |
| AC-LA-E5-03-02 | pending: Docker window | `tests/ltiaas/tasks-ops/LA-E5-03/rate-limits.test.ts > AC-LA-E5-03-02` | as AC-01 | Waits for a SIM Docker window (`protocol` `3/min, burst 3` → 4th login gives `429` HTML page with `data-error-code="RATE_LIMITED"` and no `Set-Cookie`). Verified at unit level in `rate-limit-http.test.ts > rejects an exhausted protocol address before any database read and returns a page without a cookie` (`e5-03-unit.log`). |
| AC-LA-E5-03-03 | pending: Docker window | `tests/ltiaas/tasks-ops/LA-E5-03/rate-limits.test.ts > AC-LA-E5-03-03` | as AC-01 | Waits for a SIM Docker window (untrusted peer spoofing `X-Forwarded-For` directly to LTI service gets `429` on 4th login). Verified at unit level in `rate-limit-http.test.ts > ignores spoofed X-Forwarded-For from an untrusted socket` (`e5-03-unit.log`). |
| AC-LA-E5-03-04 | pending: Docker window | `tests/ltiaas/tasks-ops/LA-E5-03/rate-limits.test.ts > AC-LA-E5-03-04` | as AC-01 | Waits for a SIM Docker window (trusted proxy logs `rate_limited` with `client_ip` = `e2e` container address, plus DNS retry/logging from Round 2 `8706619`). Verified at unit level in `rate-limit-http.test.ts > uses the actual client behind a trusted proxy and logs that address` and `rate-limit.test.ts > trusted proxy addresses` (4 cases, `e5-03-unit.log`). |
| AC-LA-E5-03-05 | pending: Docker window | `tests/ltiaas/tasks-ops/LA-E5-03/rate-limits.test.ts > AC-LA-E5-03-05` | as AC-01 | Waits for a SIM Docker window (`auth_failure` `30/min, burst 30` → 31st bad key gives `429` and blocks valid keys from that address until `Retry-After`). Verified at unit level in `rate-limit-http.test.ts > a key failure exhausts its address for both invalid and valid callers until refill` (`e5-03-unit.log`). |
| AC-LA-E5-03-06 | pending: Docker window | `tests/ltiaas/tasks-ops/LA-E5-03/rate-limits.test.ts > AC-LA-E5-03-06` | as AC-01 | Waits for a SIM Docker window (200 calls with valid `cogniate` API key and random `ltik` values each give `401`, never `429`, and the next valid `ltik` gives `200`). Verified at unit level in `rate-limit-http.test.ts > checks api/admin only after full auth; bad ltiks or service keys do not spend auth_failure` (`e5-03-unit.log`). |
| AC-LA-E5-03-07 | pending: Docker window | `tests/ltiaas/tasks-ops/LA-E5-03/rate-limits.test.ts > AC-LA-E5-03-07` | as AC-01 | Waits for a SIM Docker window (`protocol_account` soft class logs `rate_limit_soft` at most once per minute and never refuses). Verified at unit level in `rate-limit-http.test.ts > keeps soft protocol accounts non-blocking and registration/keys address buckets separate` and `rate-limit.test.ts > soft account classes never refuse and log at most once per minute per bucket` (`e5-03-unit.log`). |
| AC-LA-E5-03-08 | pending: Docker window | `tests/ltiaas/tasks-ops/LA-E5-03/rate-limits.test.ts > AC-LA-E5-03-08` | as AC-01 | Waits for a SIM Docker window (`GET /healthz` never limited; `PATCH /operator/v1/rate-limits` applies immediately and writes one `settings.rate_limits` audit event). Verified at unit level in `rate-limit-http.test.ts > publishes operator changes to the public listener immediately` and `http/operator/rate-limits.test.ts` (`e5-03-unit.log`). |
| AC-LA-E5-03-09 | pending: Docker window | `tests/ltiaas/tasks-ops/LA-E5-03/rate-limits.test.ts > AC-LA-E5-03-09` | as AC-01 | Waits for a SIM Docker window (`GET /operator/v1/rate-limits` shows each class with `source` and `registrationSessionsPerAddress`/`registrationSessionsSource` per `BD-A2-18`; invalid `PATCH` gives `400 INVALID_REQUEST`). Verified at unit level in `http/operator/rate-limits.test.ts` (9 cases, `e5-03-unit.log`). |
| AC-LA-E5-03-10 | PASS (UNIT) | `services/lti-service/src/http/rate-limit.test.ts > class policy > AC-LA-E5-03-10: IPv6 addresses share a /64 bucket, but not two prefixes` + `trusted proxy addresses > trusts CIDRs only, uses the closest untrusted forwarded hop, and groups its IPv6 prefix` + `token buckets > evicts the least recently used key, separates classes, and enforces the 100,000 bound` | `npx --no-install vitest run --reporter=verbose services/lti-service/src/http/rate-limit.test.ts services/lti-service/src/http/rate-limit-http.test.ts services/lti-service/src/http/operator/rate-limits.test.ts services/lti-service/src/store/settings.test.ts services/lti-service/src/http/retry-after.test.ts services/lti-service/src/http/auth.test.ts` | Two IPv6 addresses in the same `/64` prefix share one bucket while two different `/64` prefixes use separate buckets; the bucket map enforces the 100,000-key LRU bound; `BD-A2-30` `details.limit` and `trace_id` / `key_id` fields pass across all 7 hard classes; and `store/settings.test.ts` verifies migration `012` and the per-(address, account) registration session cap (`BD-A2-20`). `e5-03-unit.log` |
| AC-LA-E5-03-11 | pending: Docker window | `tests/ltiaas/tasks-ops/LA-E5-03/rate-limits.test.ts > AC-LA-E5-03-11` | as AC-01 | Waits for a SIM Docker window (`keys` set to `3/min, burst 3` → 4th `GET /lti/keys/cogniate` gives `429` with `Retry-After` while `/healthz` still answers). Verified at unit level in `rate-limit-http.test.ts` (`e5-03-unit.log`). |
| AC-LA-E5-03-12 | pending: Docker window | `tests/ltiaas/tasks-ops/LA-E5-03/rate-limits.test.ts > AC-LA-E5-03-12` | as AC-01 | Waits for a SIM Docker window (`admin` set to `3/min, burst 3` on a fresh account's key → 4th `GET /api/platforms` gives `429 RATE_LIMITED` while an `api` call of the same key passes). |
| AC-LA-E5-03-13 | PASS (UNIT) | `services/lti-service/src/http/retry-after.test.ts > Retry-After seconds (BD-A2-16)` (11 cases: `120 → 120`, `7200 → 3600`, `0 → 1`, `-20 → 1`, `1.2 → 2`, `NaN / Infinity / -Infinity / undefined / null / non-number → 60`) + `API error Retry-After header and body` (8 cases) | as AC-10 | `retryAfterSeconds` returns `1` for `0`, `3600` for `7200`, and `60` for non-numeric inputs; for any API error with `details.retryAfter`, the error handler sends `Retry-After` equal to `details.retryAfter` in the JSON body, and sends no `Retry-After` header when `details.retryAfter` is absent (`BD-A2-16`, `BD-A2-19`). `e5-03-unit.log` |

### R0 `npm run check` counts at `d40826d` (`check.log`)

| Suite | LA-E0-01 (`1b17261`) | At `d40826d` |
| --- | --- | --- |
| Vitest (`test:unit`) | 97 files; 1,351 passed, 5 skipped | 155 files; 2,498 passed, 5 skipped |
| Infra (`test:infra`, `node --test`) | 197 pass, 0 fail | 243 pass, 0 fail (23 suites) |
| K0 (`test:k0`) | — | 3 files; 121 passed |
| F1 (`fitness:lms-names`) | — | `F1 PASS: 20 files with hits, 74 hits` |
| F5 (`fitness:rules`) | — | `F5 PASS: 6 rules (audit-event-delete, channel-sql-tables, connection-lms, no-score-sync, protocol-urls, sql-portability), 0 hits` |

## Other checks

- **File scope (`3c7221d`, `4a2234d`, `9cbd043`, and Round 2 fix `8706619`):** Touches `services/lti-service/src/http/rate-limit*.ts`, `services/lti-service/src/store/settings*.ts`, `services/lti-service/src/http/operator/{index,rate-limits*}.ts`, `services/lti-service/src/http/{app,retry-after*}.ts`, `services/lti-service/src/db/migrations/012_service_setting.sql`, `infra/compose.yaml` (`TRUSTED_PROXY_CIDRS=proxy`), request 1 in `services/lti-service/src/lti/codes.ts`, and request 2 in `services/lti-service/src/http/auth.ts` (`task-merges-stat.txt`). Does not touch `store/accounts.ts` or app files.
- **Clone cleanliness:** `git status --porcelain` in `~/cogniate-qa-runs/LA/qa2-r5-d40826d/clone` is empty after the run (`status-after.txt`, 0 bytes).

## Regression and time

R0 (`npm run check` on the clean clone): PASS (`48.35 s` unit, `0.70 s` K0). Focused 6-file unit run (`e5-03-unit.log`, 66 tests): `0.96 s`. QA-2 host-only suite checks (`tsc --noEmit`, `vitest list` 11 `K1-SIM` cases, `node --check run.mjs`): PASS (`1.7 s`). `AC-LA-E5-03-01` .. `09`, `11`, `12` (`K1-SIM`) and SIM area regressions are `pending: Docker window`.
