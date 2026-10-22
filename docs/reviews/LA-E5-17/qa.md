Verdict: PASS
Round: 1

# LA-E5-17 Metrics, `/readyz`, production `/healthz`: QA verification

Tester: QA-2 (Orca task `task_00bf4a549499`, dispatch `ctx_4528c07049d5`), 2026-10-23. Spec: `docs/architecture/ltiaas/tasks/LA-E5-17.md` (with `BD-A2-52`, `BD-A2-54`). Suite: `tests/ltiaas/tasks-ops/LA-E5-17/` (QA-2 test-first, committed in `d40826d`).

Independence: QA-2 did not read product source (`services/**`, `packages/**`, `apps/**`), Author notes or reviewer files to write `tests/ltiaas/tasks-ops/LA-E5-17/` or during this host-only run on `5b5b3a2`. QA-2 verified all host-only UNIT, K0 and suite checks in an isolated `--no-hardlinks` clone of `5b5b3a2`.

| Item | Value |
| --- | --- |
| SHA | `5b5b3a2a91e7d8cb38b425e9c21d78b4c49cd943` (integration `5b5b3a2`; holds lane S1 `LA-E5-17` merge `880f5d6`, lane L `LA-E5-17 RQ-1` observer merges `151f6a9` and `f4530b9`, and QA-2 suite `d40826d`) |
| Lane and slot | lane S1 (with RQ-1 observer hooks in lane L); no Docker (`HOST-ONLY`; `K1-SIM` rows marked `pending: Docker window`) |
| Clone | `~/cogniate-qa-runs/LA/qa2-r6-5b5b3a2/clone`: `git clone --no-hardlinks --no-checkout`, detached at `5b5b3a2a91e7d8cb38b425e9c21d78b4c49cd943`, push URL `DISABLED`, `npm ci` at root and `tests/` |
| Environment | macOS arm64, Node 24.21.0, npm 11.19.0 |
| Artifacts | private run folder `~/cogniate-qa-runs/LA/qa2-r6-5b5b3a2/logs/` (umask 077): `npm-ci.log`, `check.log`, `e5-17-unit.log`, `e5-17-qa-host.log`, `task-merges-stat.txt`, `rev.txt`, `remotes.txt`, `status-after.txt` |

## Acceptance criteria

| AC | Result | Test id | Command | Evidence |
| --- | --- | --- | --- | --- |
| AC-LA-E5-17-01 | pending: Docker window | `tests/ltiaas/tasks-ops/LA-E5-17/observability.test.ts > AC-LA-E5-17-01` + Author unit tests: `services/lti-service/src/http/metrics.test.ts > metrics collection > exposes OpenMetrics only on the operator listener, outside operator auth`, `counts hard refusals and soft excesses even when warnings are sampled`, `counts committed audit writes and refusals, never rollbacks or caller-owned transactions`, `reads key gauges at scrape time and exposes only metadata`, `observes existing log signals once, before log level filtering, with no arbitrary fields` | `npx --no-install vitest run --reporter=verbose services/lti-service/src/http/metrics.test.ts services/lti-service/src/lti/jwks.test.ts services/lti-service/src/platform/token-client.test.ts && npx --prefix tests tsc --noEmit -p tests/ltiaas/tasks-ops/LA-E5-17/tsconfig.json && npx --prefix tests vitest list --config tests/ltiaas/tasks-ops/LA-E5-17/vitest.config.mts` | Waits for a SIM Docker window (`GET http://lti-service:4110/metrics` from the `e2e` container). Operator OpenMetrics exposition, unsampled rate-limit totals (`lti_rate_limited_total`), committed-only audit counts (`lti_audit_events_total`), scrape-time key gauges, and log-signal counters (`lti_http_requests_total`, `lti_launch_total`, `lti_ready`) pass now at unit level (`e5-17-unit.log`, `e5-17-qa-host.log`). |
| AC-LA-E5-17-02 | pending: Docker window | `tests/ltiaas/tasks-ops/LA-E5-17/observability.test.ts > AC-LA-E5-17-02` + `services/lti-service/src/http/metrics.test.ts > metrics collection > exposes OpenMetrics only on the operator listener, outside operator auth` | as AC-01 | Waits for a SIM Docker window (`GET https://lti.cogniate.test/metrics` through the proxy gives `404`). Public listener `/metrics` `404` passes now in `metrics.test.ts` (`e5-17-unit.log`). |
| AC-LA-E5-17-03 | pending: Docker window | `tests/ltiaas/tasks-ops/LA-E5-17/observability.test.ts > AC-LA-E5-17-03` + `services/lti-service/src/http/metrics.test.ts > health and readiness > AC-04: a stored signing key whose version is missing makes both listeners unready` | as AC-01 | Waits for a SIM Docker window (public `GET /readyz` gives `200 {"status":"ready"}` with no `reasons` field). Public vs operator `/readyz` response shape passes now in `metrics.test.ts` (`e5-17-unit.log`). |
| AC-LA-E5-17-04 | PASS (UNIT) | `services/lti-service/src/http/metrics.test.ts > health and readiness > AC-04: a stored signing key whose version is missing makes both listeners unready` + `detects missing or changed migrations without applying them` + `reports a closed database without leaking a driver error` | as AC-01 | When a key ring lacks a version that a stored row uses, operator `GET /readyz` returns `503` with `reasons` containing `key_version_missing` while public `GET /readyz` returns `503 {"status":"not_ready"}` with no `reasons`; `database` and `migrations` checks also fail closed without applying migrations or leaking driver errors (`AP-06-26`). `e5-17-unit.log` |
| AC-LA-E5-17-05 | PASS (UNIT) | `services/lti-service/src/http/metrics.test.ts > health and readiness > AC-05: production health contains only liveness and service` + `keeps the default health fields` + `keeps the acceptance health fields` | as AC-01 | With `STACK_PROFILE=production`, `GET /healthz` returns `200 {"status":"ok","service":"lti-service"}` with no extra fields, while `default` and `acceptance` keep their existing fields. `e5-17-unit.log` |
| AC-LA-E5-17-06 | pending: Docker window | `tests/ltiaas/tasks-ops/LA-E5-17/observability.test.ts > AC-LA-E5-17-06` + `services/lti-service/src/http/metrics.test.ts > health and readiness > keeps the acceptance health fields` | as AC-01 | Waits for a SIM Docker window (acceptance `GET /healthz` compared against E0 golden `G1`). Acceptance `/healthz` field preservation passes at unit level in `metrics.test.ts` (`e5-17-unit.log`). |
| AC-LA-E5-17-07 | pending: Docker window | `tests/ltiaas/tasks-ops/LA-E5-17/observability.test.ts > AC-LA-E5-17-07` + `services/lti-service/src/http/metrics.test.ts > metrics collection > keeps concurrent tenant labels separate and never labels an unregistered path value` | as AC-01 | Waits for a SIM Docker window (`http_request` line for `/lti/login/cogniate` carries `tool_account_id: "cogniate"` and no metric label or log field holds a name, e-mail or `sub`). Registered-only `tool_account_id` labeling and non-PII metric labels pass at unit level in `metrics.test.ts` (`e5-17-unit.log`). |
| BD-A2-52 / BD-A2-54 (JWKS and token series: `lti_platform_token_failures_total`, `lti_jwks_fetch_failures_total`, `lti_jwks_cache_age_seconds`) | pending: S1 BD-A2-54 join | `services/lti-service/src/lti/jwks.test.ts > JWKS fetch observer (LA-E5-17 RQ-1) > reports each waiting call with its own platform and the shared fetch time; reads cache age by URL`, `preserves verification with the default observer and with an observer that throws` + `services/lti-service/src/platform/token-client.test.ts > token result observer (LA-E5-17 RQ-1) > reports each shared request once, including every failure, and does not report cache hits`, `preserves results with the default observer and with an observer that throws` | as AC-01 | Lane L's observers (`onTokenResult({platformId, ok})`, per-waiter `onJwksFetch({platformId, ok, fetchedAt})` and `lastSuccessAt(jwksUrl)`) are merged (`151f6a9`, `f4530b9`) and pass 4 unit tests (`e5-17-unit.log`); lane S1's scrape-time join in `metrics.ts` is not built yet, so those series remain unexposed per `BD-A2-52` and are `pending: S1 BD-A2-54 join`. |

### R0 `npm run check` counts at `5b5b3a2` (`check.log`)

| Suite | LA-E0-01 (`1b17261`) | At `5b5b3a2` |
| --- | --- | --- |
| Vitest (`test:unit`) | 97 files; 1,351 passed, 5 skipped | 164 files; 2,625 passed, 5 skipped |
| Infra (`test:infra`, `node --test`) | 197 pass, 0 fail | 252 pass, 0 fail (23 suites) |
| K0 (`test:k0`) | — | 3 files; 121 passed |
| F1 (`fitness:lms-names`) | — | `F1 PASS: 20 files with hits, 74 hits` |
| F5 (`fitness:rules`) | — | `F5 PASS: 6 rules (audit-event-delete, channel-sql-tables, connection-lms, no-score-sync, protocol-urls, sql-portability), 0 hits` |

## Other checks

- **File scope (`880f5d6`, `151f6a9`, `f4530b9`):** Lane S1 (`880f5d6`) touches `services/lti-service/src/http/{metrics,metrics.test,app,rate-limit}.ts`, `services/lti-service/src/http/operator/index.ts`, `services/lti-service/src/store/audit.ts`, and `services/lti-service/src/main.ts`; lane L RQ-1 (`151f6a9`, `f4530b9`) touches `services/lti-service/src/lti/jwks*.ts` and `services/lti-service/src/platform/token-client*.ts` (`task-merges-stat.txt`). Does not edit `lti/login.ts`, `lti/launch.ts`, or app files.
- **Clone cleanliness:** `git status --porcelain` in `~/cogniate-qa-runs/LA/qa2-r6-5b5b3a2/clone` is empty after the run (`status-after.txt`, 0 bytes).

## Regression and time

R0 (`npm run check` on the clean clone): PASS (`52.20 s` unit, `1.47 s` K0). Focused 3-file unit run (`e5-17-unit.log`, 30 tests): `1.62 s`. QA-2 host-only suite checks (`tsc --noEmit`, `vitest list` 5 `K1-SIM` cases, `node --check run.mjs`): PASS (`1.6 s`). `AC-LA-E5-17-01..03, 06, 07` (`K1-SIM`) and SIM area regressions are `pending: Docker window`; JWKS and token series are `pending: S1 BD-A2-54 join`.
