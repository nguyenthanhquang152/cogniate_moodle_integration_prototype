Verdict: PASS (host-only K0 + UNIT; K1-SIM pending: Docker window)
Round: 1

# LA-E5-06 Protocol wiring: resolver, status pages, session cap and the F5 rule: QA verification

Tester: QA-4 (Orca task `task_fb862e2b49d1`, dispatch `ctx_6039a0441240`), 2026-10-23. Spec: `docs/architecture/ltiaas/tasks/LA-E5-06.md` (with `BD-A2-20`, `BD-A2-48`, `BD-A2-49`, `LA-ADR-06` D1 rules 2/5/6 and D2 rule 5, contract delta §1.3/§1.5/§2.2/§2.4). Suite: `tests/ltiaas/tasks-lti/LA-E5-06/` (QA-4 test-first, committed in `95540f2`).

Independence: QA-4 did not read product source (`services/**`, `packages/**`, `apps/**`), Author notes or reviewer files to author `tests/ltiaas/tasks-lti/LA-E5-06/`, and verified all host-only K0 and UNIT checks in an isolated `--no-hardlinks` clone of `a2dfc04` using boolean assertions that never print product source.

| Item | Value |
| --- | --- |
| SHA | `a2dfc0418ccf421891f260925ddee0d22371e240` (integration `a2dfc04`; holds `LA-E5-06` merge `028c30a`: lane L commits `af9bcf8`, `73ba9ce`, `87a5ada`) |
| Lane and slot | lane L; no Docker (`HOST-ONLY`; `K1-SIM` rows marked `pending: Docker window`) |
| Clone | `~/cogniate-qa-runs/LA/qa4-r8-a2dfc04/clone`: `git clone --no-hardlinks --no-checkout`, detached at `a2dfc0418ccf421891f260925ddee0d22371e240`, push URL `DISABLED`, `npm ci` at root and `tests/` |
| Environment | macOS arm64, Node 24.21.0, npm 11.19.0 |
| Artifacts | private run folder `~/cogniate-qa-runs/LA/qa4-r8-a2dfc04/logs/` (umask 077): `npm-ci.log`, `npm-ci-tests.log`, `LA-E5-06-k0.log`, `e5-06-unit.log`, `e5-06-infra.log`, `rev.txt`, `remotes.txt`, `status-after.txt` |

## Acceptance criteria

| AC | Result | Test id | Command | Evidence |
| --- | --- | --- | --- | --- |
| AC-LA-E5-06-01 | pending: Docker window (K1-SIM) | `tests/ltiaas/tasks-lti/LA-E5-06/protocol-wiring.k1sim.test.ts > AC-LA-E5-06-01` | SIM Docker slot | Pending Docker window. Verified at host unit level in `services/lti-service/src/http/routes/protocol.test.ts > gates suspended before state consumption or outbound work, with the required key policy` (`e5-06-unit.log`). |
| AC-LA-E5-06-02 | pending: Docker window (K1-SIM) | `protocol-wiring.k1sim.test.ts > AC-LA-E5-06-02` | SIM Docker slot | Pending Docker window. Verified at host unit level in `protocol.test.ts > gates closed before state consumption or outbound work, with the required key policy` (`e5-06-unit.log`). |
| AC-LA-E5-06-03 | pending: Docker window (K1-SIM) | `protocol-wiring.k1sim.test.ts > AC-LA-E5-06-03` | SIM Docker slot | Pending Docker window. Verified at host unit level in `protocol.test.ts` (JWKS `200` for `suspended` and `404 UNKNOWN_TOOL_ACCOUNT` for `closed` and unknown accounts; `e5-06-unit.log`). |
| AC-LA-E5-06-04 | pending: Docker window (K1-SIM) | `protocol-wiring.k1sim.test.ts > AC-LA-E5-06-04` | SIM Docker slot | Pending Docker window. Verified at host unit level in `services/lti-service/src/lti/storage-check.test.ts > gates account status before origin and consumption, and allows the same check after reactivation` (`e3-02-unit.log`). |
| AC-LA-E5-06-05 | pending: Docker window (K1-SIM) | `protocol-wiring.k1sim.test.ts > AC-LA-E5-06-05` | SIM Docker slot | Pending Docker window. Verified at host unit level in `services/lti-service/src/http/routes/registration.test.ts > enforces the session cap before fetching, per account, and releases capacity on completion and expiry` (`e5-06-unit.log`). |
| AC-LA-E5-06-06 | pending: Docker window (K1-SIM) | `protocol-wiring.k1sim.test.ts > AC-LA-E5-06-06` | SIM Docker slot | Pending Docker window. Verified at host unit level in `registration.test.ts > enforces the session cap before fetching, per account, and releases capacity on completion and expiry` (`e5-06-unit.log`). |
| AC-LA-E5-06-07 | pending: Docker window (K1-SIM) | `protocol-wiring.k1sim.test.ts > AC-LA-E5-06-07` | SIM Docker slot | Pending Docker window. Verified at host unit level in `registration.test.ts > enforces the session cap before fetching, per account, and releases capacity on completion and expiry` and `services/lti-service/src/store/registrations.test.ts > keeps the address key only while the registration is open (BD-A2-20)` (`e5-06-unit.log`). |
| AC-LA-E5-06-08 | PASS (K0) | `protocol-wiring.k0.test.ts > AC-LA-E5-06-08 (K0): Fitness F5 check given probe text '/lti/launch/' outside services/lti-service/src/accounts/ fails, and inside passes` + `infra/scripts/fitness/protocol-urls.test.mjs` | `LA_LEVEL=k0 LA_TARGET_ROOT=$PWD ./node_modules/.bin/vitest run --config tests/ltiaas/tasks-lti/LA-E5-06/vitest.config.mts --reporter=verbose` and `node --test infra/scripts/fitness/protocol-urls.test.mjs` | `fitness:rules --stdin --as services/lti-service/src/lti/probe.ts` with `export const u = base + '/lti/launch/' + id;` exits non-zero (`1`) and names `protocol-urls`; probes on `lti/login.ts` and `http/routes/protocol.ts` exit non-zero and name `protocol-urls`; `accounts/resolver.ts` and the clean tree exit `0` (`F5 PASS: 6 rules (audit-event-delete, channel-sql-tables, connection-lms, no-score-sync, protocol-urls, sql-portability), 0 hits`). `LA-E5-06-k0.log`, `e5-06-infra.log` |
| AC-LA-E5-06-09 | PASS (UNIT + K0) | `services/lti-service/src/lti/target.test.ts > isOwnLaunchTarget` (17 cases, including `accepts https://lti.cogniate.test/lti/launch/cogniate`, `accepts https://lti.cogniate.test/lti/launch/cogniate?resource=seed`, `refuses https://lti.cogniate.test/lti/launch/qa-second`) + `protocol-wiring.k0.test.ts > AC-LA-E5-06-09 (UNIT)` | `./node_modules/.bin/vitest run --reporter=verbose services/lti-service/src/lti/target.test.ts` | `isOwnLaunchTarget` accepts launch and Deep Linking URLs from `protocolUrls(account)` and refuses another account's URL (`qa-second`), other protocol endpoints (`/lti/login/`, `/lti/keys/`, `/lti/register/`), fragments, credentials, `http:` and foreign origins. `LA-E5-06-k0.log`, `e5-06-unit.log` |

### Additional K0 and unit checks (`LA-E5-06-k0.log`, `e5-06-unit.log`)

- **Page codes and action lines:** `protocol-wiring.k0.test.ts > Static check: lti/codes.ts` verifies `TOOL_ACCOUNT_SUSPENDED`, `REGISTRATION_SESSION_LIMIT` and `RATE_LIMITED` along with their contract delta §2.2 / §2.4 action lines.
- **Resolver and `BD-A2-20` wiring (`BD-A2-48`, `BD-A2-49`):** `protocol-wiring.k0.test.ts > Static check: resolver calls, status gates, session cap, and BD-A2-20 registration_session.client_key wiring` and `store/registrations.test.ts > keeps the address key only while the registration is open (BD-A2-20)` verify `protocolUrls(account)` usage across `target.ts`, `login.ts`, `launch.ts`, `registration.ts` and `deep-linking.ts`, and verify `client_key` is stored on open registration sessions and cleared to `NULL` on completion.

## Other checks

- **File scope (`028c30a`):** Touches `services/lti-service/src/lti/{target,login,launch,registration,deep-linking,checks,codes}*.ts`, `services/lti-service/src/http/routes/{protocol,registration}*.ts`, `services/lti-service/src/http/service-context.ts`, `services/lti-service/src/store/registrations*.ts` (`BD-A2-20` RQ-2), `services/lti-service/src/store/settings.test.ts` (`73ba9ce` RQ-2), and `infra/scripts/fitness/{rules/protocol-urls.mjs,protocol-urls.test.mjs}`. Does not touch `accounts/resolver.ts`, `store/accounts.ts`, `http/app.ts`, `http/auth.ts` or app files.
- **Clone cleanliness:** `git status --porcelain` in `~/cogniate-qa-runs/LA/qa4-r8-a2dfc04/clone` is empty after the run (`status-after.txt`, 0 bytes).

## Regression and time

R0: PASS (`10.38s` K0 suite, `2.85s` focused 8-file unit run with 79 tests, `0.16s` F5 infra test). `K1-SIM` (`AC-LA-E5-06-01`..`07`) is `pending: Docker window`.
