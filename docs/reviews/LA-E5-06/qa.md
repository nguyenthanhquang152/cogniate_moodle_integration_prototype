Verdict: PASS (K0 + UNIT + K1-SIM)
Round: 3

# LA-E5-06 Protocol wiring: resolver, status pages, session cap and the F5 rule: QA verification

## Round 2

Tester: QA-4 (Orca task `task_aaffbc25c5d7`, dispatch `ctx_620bf870df9a`), 2026-10-23. Fix round 1 merge: `0a46ca0` (integrated at `e2f6c90`). Suite: `tests/ltiaas/tasks-lti/LA-E5-06/` (updated in Round 2 with F5 end-of-literal and relative form probes and `account-status.ts` + `registration.test.ts` checks).

Independence: QA-4 did not read product source (`services/**`, `packages/**`, `apps/**`), Author notes or reviewer files to update `tests/ltiaas/tasks-lti/LA-E5-06/`, and verified all host-only K0, F5 infra and UNIT checks in an isolated `--no-hardlinks` clone of `e2f6c90` using boolean assertions that never print product source.

| Item | Value |
| --- | --- |
| SHA | `e2f6c904ba1a46f3e30a20fbd24d04d6ffbe93c7` (integration `e2f6c90`; holds `LA-E5-06` fix round 1 merge `0a46ca0`) |
| Lane and slot | lane L; no Docker (`HOST-ONLY`; `K1-SIM` rows marked `pending: Docker window`) |
| Clone | `~/cogniate-qa-runs/LA/qa4-r10-e2f6c90/clone`: `git clone --no-hardlinks --no-checkout`, detached at `e2f6c904ba1a46f3e30a20fbd24d04d6ffbe93c7`, push URL `DISABLED`, `npm ci` at root and `tests/` |
| Environment | macOS arm64, Node 24.21.0, npm 11.19.0 |
| Artifacts | private run folder `~/cogniate-qa-runs/LA/qa4-r10-e2f6c90/logs/` (umask 077): `npm-ci.log`, `npm-ci-tests.log`, `LA-E5-06-k0.log`, `e5-06-unit.log`, `e5-06-infra.log`, `rev.txt`, `remotes.txt`, `show-0a46ca0.txt`, `status-after.txt` |

### Round 2 Acceptance criteria and fix verification

| AC / Fix id | Result | Test id | Command | Evidence |
| --- | --- | --- | --- | --- |
| AC-LA-E5-06-01 | PASS (K1-SIM + UNIT) | `tests/ltiaas/tasks-lti/LA-E5-06/protocol-wiring.k1sim.test.ts > AC-LA-E5-06-01` | Docker Slot 5 (`qa4-la-sim-r1`, `d12b7b94`) | Suspended account login returns `403 TOOL_ACCOUNT_SUSPENDED` with no `Set-Cookie`, while `cogniate` launch still passes (`7/7` K1-SIM tests pass in `344ms`; `LA-E5-06-k1sim.log`, `all-17-k1sim.log`, `e5-06-unit.log`). |
| AC-LA-E5-06-02 | PASS (K1-SIM + UNIT) | `protocol-wiring.k1sim.test.ts > AC-LA-E5-06-02` | Docker Slot 5 (`qa4-la-sim-r1`, `d12b7b94`) | Suspended account `GET /lti/register/:account` returns `403 TOOL_ACCOUNT_SUSPENDED` and simulator records 0 configuration fetches (`LA-E5-06-k1sim.log`, `all-17-k1sim.log`). |
| AC-LA-E5-06-03 | PASS (K1-SIM + UNIT) | `protocol-wiring.k1sim.test.ts > AC-LA-E5-06-03` | Docker Slot 5 (`qa4-la-sim-r1`, `d12b7b94`) | Suspended account `GET /lti/keys/:account` returns `200` with JWKS keys (`LA-E5-06-k1sim.log`, `all-17-k1sim.log`). |
| AC-LA-E5-06-04 | PASS (K1-SIM + UNIT) | `protocol-wiring.k1sim.test.ts > AC-LA-E5-06-04` | Docker Slot 5 (`qa4-la-sim-r1`, `d12b7b94`) | Closed account login and `GET /lti/keys/:account` return `404 UNKNOWN_TOOL_ACCOUNT` (`LA-E5-06-k1sim.log`, `all-17-k1sim.log`). |
| AC-LA-E5-06-05 | PASS (K1-SIM + UNIT) | `protocol-wiring.k1sim.test.ts > AC-LA-E5-06-05 & AC-LA-E5-06-06` | Docker Slot 5 (`qa4-la-sim-r1`, `d12b7b94`) | 4th open registration session on an account returns `409 REGISTRATION_SESSION_LIMIT` with 0 outbound fetches (`LA-E5-06-k1sim.log`, `all-17-k1sim.log`). |
| AC-LA-E5-06-06 | PASS (K1-SIM + UNIT) | `protocol-wiring.k1sim.test.ts > AC-LA-E5-06-05 & AC-LA-E5-06-06` | Docker Slot 5 (`qa4-la-sim-r1`, `d12b7b94`) | In the same minute, registration start on a second fresh account from the same address opens a session (`200`/`303`) (`LA-E5-06-k1sim.log`, `all-17-k1sim.log`). |
| AC-LA-E5-06-07 | PASS (K1-SIM + UNIT) | `protocol-wiring.k1sim.test.ts > AC-LA-E5-06-07` | Docker Slot 5 (`qa4-la-sim-r1`, `d12b7b94`) | Moodle-shaped simulator Dynamic Registration of `cogniate` sends `initiate_login_uri`, `redirect_uris`, `jwks_uri`, and `target_link_uri` equal to `protocolUrls` of `cogniate` (`LA-E5-06-k1sim.log`, `all-17-k1sim.log`). |
| AC-LA-E5-06-08 | PASS (K0) | `protocol-wiring.k0.test.ts > AC-LA-E5-06-08 (K0): Fitness F5 check given probe text '/lti/launch/' outside services/lti-service/src/accounts/ fails, and inside passes` + `infra/scripts/fitness/protocol-urls.test.mjs` | `LA_LEVEL=k0 LA_TARGET_ROOT=$CLONE npx --no-install vitest run --config ltiaas/tasks-lti/LA-E5-06/vitest.config.mts` and `node --test infra/scripts/fitness/protocol-urls.test.mjs` | Rejects `'/lti/launch/'`, end-of-literal `'/lti/launch'` and relative `'lti/launch/'` outside `accounts/resolver.ts`, and allows inside `accounts/resolver.ts`. `LA-E5-06-k0.log`, `e5-06-infra.log`. |
| AC-LA-E5-06-09 | PASS (UNIT + K0) | `services/lti-service/src/lti/target.test.ts > isOwnLaunchTarget` (17 cases) + `protocol-wiring.k0.test.ts > AC-LA-E5-06-09 (UNIT)` | `npx --no-install vitest run --reporter=verbose services/lti-service/src/lti/target.test.ts` | `isOwnLaunchTarget` accepts launch and Deep Linking URLs from `protocolUrls(account)` and refuses another account's URL (`qa-second`) and other protocol endpoints. `LA-E5-06-k0.log`, `e5-06-unit.log`. |
| AC-LA-E5-06-10 | PASS (K1-SIM + UNIT) | `protocol-wiring.k1sim.test.ts > AC-LA-E5-06-10` | Docker Slot 5 (`qa4-la-sim-r1`, `d12b7b94`) | For a suspended account, `POST /lti/launch/<account>` with a valid state returns `403 TOOL_ACCOUNT_SUSPENDED` with no `303` and no `ltik` (`LA-E5-06-k1sim.log`, `all-17-k1sim.log`). |
| A-LA-E5-06-01 (parallel starts session cap) | PASS (UNIT + K0) | `services/lti-service/src/http/routes/registration.test.ts > dynamic registration (contract §2.4, §3.8) > A-LA-E5-06-01: parallel starts that wait for a slow configuration fetch open at most the cap sessions` | `npx --no-install vitest run --reporter=verbose services/lti-service/src/http/routes/registration.test.ts` | Re-checks the registration session cap and inserts the session in one transaction after the last `await`; parallel registration starts waiting on a slow OpenID configuration fetch open at most the configured cap sessions (`68ms`). `e5-06-unit.log`, `LA-E5-06-k0.log`. |
| A-LA-E5-06-02 (F5 end-of-literal and relative forms) | PASS (K0 + INFRA) | `protocol-wiring.k0.test.ts > AC-LA-E5-06-08 (K0)` + `infra/scripts/fitness/protocol-urls.test.mjs > A-LA-E5-06-02: a literal that ends at the endpoint and the relative form fail` | `node --test infra/scripts/fitness/protocol-urls.test.mjs` | F5 rule `protocol-urls` catches both end-of-literal (`'/lti/launch'`) and relative (`'lti/launch/' + id`) forms outside `accounts/resolver.ts`, while module paths and longer names pass (`4/4` tests in `protocol-urls.test.mjs`, `218ms`). `LA-E5-06-k0.log`, `e5-06-infra.log`. |
| B NITs (`lti/account-status.ts` + one resolver per request) | PASS (UNIT + K0) | `services/lti-service/src/lti/account-status.test.ts > statusGate (contract delta §1.5)` (4 cases) + `protocol-wiring.k0.test.ts` | `npx --no-install vitest run --reporter=verbose services/lti-service/src/lti/account-status.test.ts` | Status gate lives in `services/lti-service/src/lti/account-status.ts` (`4/4` tests in `account-status.test.ts`), passes F1 (0 hits) and F5, and protocol handlers resolve `protocolUrls(account)` once per request. `e5-06-unit.log`, `LA-E5-06-k0.log`. |

### Round 2 Regression and time

- **QA-4 K0 Suite (`LA-E5-06-k0.log`)**: **1 file passed, 5/5 tests passed (`17.51s`)**.
- **Focused Unit Suite (`e5-06-unit.log`)**: **11 test files passed, 120/120 tests passed (`2.21s`)**.
- **F5 Infra Suite (`e5-06-infra.log`)**: **4/4 tests passed (`0.22s`)**.
- **Clone cleanliness (`status-after.txt`)**: `git status --porcelain` in `~/cogniate-qa-runs/LA/qa4-r10-e2f6c90/clone` is empty (`0` bytes).

---

## Round 1

Tester: QA-4 (Orca task `task_fb862e2b49d1`, dispatch `ctx_6039a0441240`), 2026-10-23. Spec: `docs/architecture/ltiaas/tasks/LA-E5-06.md` (with `BD-A2-20`, `BD-A2-48`, `BD-A2-49`, `LA-ADR-06` D1 rules 2/5/6 and D2 rule 5, contract delta §1.3/§1.5/§2.2/§2.4). Suite: `tests/ltiaas/tasks-lti/LA-E5-06/` (QA-4 test-first, committed in `95540f2`).

Independence: QA-4 did not read product source (`services/**`, `packages/**`, `apps/**`), Author notes or reviewer files to author `tests/ltiaas/tasks-lti/LA-E5-06/`, and verified all host-only K0 and UNIT checks in an isolated `--no-hardlinks` clone of `a2dfc04` using boolean assertions that never print product source.

| Item | Value |
| --- | --- |
| SHA | `a2dfc0418ccf421891f260925ddee0d22371e240` (integration `a2dfc04`; holds `LA-E5-06` merge `028c30a`: lane L commits `af9bcf8`, `73ba9ce`, `87a5ada`) |
| Lane and slot | lane L; no Docker (`HOST-ONLY`; `K1-SIM` rows marked `pending: Docker window`) |
| Clone | `~/cogniate-qa-runs/LA/qa4-r8-a2dfc04/clone`: `git clone --no-hardlinks --no-checkout`, detached at `a2dfc0418ccf421891f260925ddee0d22371e240`, push URL `DISABLED`, `npm ci` at root and `tests/` |
| Environment | macOS arm64, Node 24.21.0, npm 11.19.0 |
| Artifacts | private run folder `~/cogniate-qa-runs/LA/qa4-r8-a2dfc04/logs/` (umask 077): `npm-ci.log`, `npm-ci-tests.log`, `LA-E5-06-k0.log`, `e5-06-unit.log`, `e5-06-infra.log`, `rev.txt`, `remotes.txt`, `status-after.txt` |

### Round 1 Acceptance criteria

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

### Round 1 Regression and time

R0: PASS (`10.38s` K0 suite, `2.85s` focused 8-file unit run with 79 tests, `0.16s` F5 infra test). `K1-SIM` (`AC-LA-E5-06-01`..`07`) is `pending: Docker window`.
