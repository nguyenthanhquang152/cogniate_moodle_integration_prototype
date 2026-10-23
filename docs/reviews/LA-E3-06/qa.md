Verdict: PASS (K0 + UNIT + K1-SIM)
Round: 3

# LA-E3-06 NRPS scope: `complete.scopes` and the registration audit event: QA verification

Tester: QA-4 (Orca task `task_fb862e2b49d1`, dispatch `ctx_6039a0441240`), 2026-10-23. Spec: `docs/architecture/ltiaas/tasks/LA-E3-06.md` (with `LA-ADR-05` D4, contract delta §4.5 and §5 `registration.complete`, and `LA-ADR-06` D4). Suite: `tests/ltiaas/tasks-lti/LA-E3-06/` (QA-4 test-first).

Independence: QA-4 did not read product source (`services/**`, `packages/**`, `apps/**`), Author notes or reviewer files to author `tests/ltiaas/tasks-lti/LA-E3-06/`, and verified all host-only K0 and UNIT checks on both Round 1 (`36f70d8`) and Round 2 (`028c30a` / `a2dfc04`) in an isolated `--no-hardlinks` clone using boolean assertions that never print product source.

| Item | Value |
| --- | --- |
| SHA (Round 1) | `36f70d8` (lane L commit `ad6823f` merged as `36f70d8`, 4 files) |
| SHA (Round 2) | `a2dfc0418ccf421891f260925ddee0d22371e240` (`a2dfc04`; holds `LA-E3-06` Round 2 fix merge `028c30a`: lane L commits `0f52458`, `af9e8bc`, `b65c087`) |
| Lane and slot | lane L; no Docker (`HOST-ONLY`; `K1-SIM` rows marked `pending: Docker window`) |
| Clone | `~/cogniate-qa-runs/LA/qa4-r8-a2dfc04/clone`: `git clone --no-hardlinks --no-checkout`, detached at `36f70d8` (Round 1) and `a2dfc04` (Round 2), push URL `DISABLED`, `npm ci` at root and `tests/` |
| Environment | macOS arm64, Node 24.21.0, npm 11.19.0 |
| Artifacts | private run folder `~/cogniate-qa-runs/LA/qa4-r8-a2dfc04/logs/` (umask 077): `npm-ci.log`, `npm-ci-tests.log`, `LA-E3-06-r1-k0.log`, `e3-06-r1-unit.log`, `LA-E3-06-k0.log`, `e3-06-unit.log`, `rev.txt`, `remotes.txt`, `status-after.txt` |

## Round 1 (`36f70d8`)

Verdict: PASS on `AC-LA-E3-06-04` (UNIT + K0), with Round 2 fix required for `AC-LA-E3-06-02` default-scopes backward compatibility (`B-LA-E3-06-01` / `A-LA-E3-06-01`)
Round: 1

### Acceptance criteria (Round 1)

| AC | Result | Test id | Command | Evidence |
| --- | --- | --- | --- | --- |
| AC-LA-E3-06-01 | PASS (K1-SIM + UNIT) | `tests/ltiaas/tasks-lti/LA-E3-06/nrps-scopes.k1sim.test.ts > AC-LA-E3-06-01` | Docker Slot 5 (`qa4-la-sim-r1`, `d12b7b94`) | Live `POST /api/registrations/:id/complete` with `scopes = FOUR_AGS_SCOPES` sends a registration request whose `scope` has those exact four scopes (`5/5` K1-SIM tests pass in `748ms`; `LA-E3-06-k1sim.log`, `all-17-k1sim.log`). |
| AC-LA-E3-06-02 | PASS (K1-SIM + UNIT) | `nrps-scopes.k1sim.test.ts > AC-LA-E3-06-02` | Docker Slot 5 (`qa4-la-sim-r1`, `d12b7b94`) | Live `complete` without `scopes` sends all five ADR-009 scopes as before LA (`LA-E3-06-k1sim.log`, `all-17-k1sim.log`). |
| AC-LA-E3-06-03 | PASS (K1-SIM + UNIT) | `nrps-scopes.k1sim.test.ts > AC-LA-E3-06-03 & AC-LA-E3-06-04` | Docker Slot 5 (`qa4-la-sim-r1`, `d12b7b94`) | Live `complete` with a scope not in `scopes_supported` returns `400 INVALID_REQUEST` (`field: 'scopes'`) and sends no registration request (`LA-E3-06-k1sim.log`, `all-17-k1sim.log`). |
| AC-LA-E3-06-04 | PASS (UNIT + K0 + K1-SIM) | `services/lti-service/src/http/routes/registration.test.ts > refuses empty list / unknown scope / mixed scopes / not a list / null / non-string member before sending or claiming the session (LA-E3-06 AC-04)` (6 tests) + `nrps-scopes.k0.test.ts` + `nrps-scopes.k1sim.test.ts > AC-LA-E3-06-03 & AC-LA-E3-06-04` | `LA_LEVEL=k0 LA_TARGET_ROOT=$PWD ./node_modules/.bin/vitest run --config tests/ltiaas/tasks-lti/LA-E3-06/vitest.config.mts --reporter=verbose` | `scopes: []`, a scope outside the five of ADR-009, a mixed list, or a non-array / non-string member returns `400 INVALID_REQUEST` naming `scopes` before claiming the session or sending an outbound request (`41` unit tests pass in `e3-06-r1-unit.log`, `3/3` K0 pass in `LA-E3-06-r1-k0.log`, `5/5` K1-SIM pass in `LA-E3-06-k1sim.log`). |
| AC-LA-E3-06-05 | PASS (K1-SIM + UNIT) | `nrps-scopes.k1sim.test.ts > AC-LA-E3-06-05` | Docker Slot 5 (`qa4-la-sim-r1`, `d12b7b94`) | Successful `complete` writes one audit event `registration.complete` with `result: 'ok'`; a second `complete` of the same registration (`409 REGISTRATION_ALREADY_COMPLETED`) writes one event with `result: 'refused'` and `code: 'REGISTRATION_ALREADY_COMPLETED'` (`LA-E3-06-k1sim.log`, `all-17-k1sim.log`). |
| AC-LA-E3-06-06 | PASS (K1-SIM + UNIT) | `nrps-scopes.k1sim.test.ts > AC-LA-E3-06-06` | Docker Slot 5 (`qa4-la-sim-r1`, `d12b7b94`) | Live `GET /api/memberships` answers for a launch with an NRPS claim without personal fields (`LA-E3-06-k1sim.log`, `all-17-k1sim.log`). |

## Round 2 (`028c30a` / `a2dfc04`)

Verdict: PASS (K0 + UNIT + K1-SIM)
Round: 3

### Round 2 changes and verification (`0f52458`, `af9e8bc`, `b65c087` in `028c30a`, verified at `a2dfc04`)

| Item | Result | Evidence |
| --- | --- | --- |
| Default scopes preserved without `scopes_supported` check (`0f52458`, `B-LA-E3-06-01` / `A-LA-E3-06-01`) | PASS (UNIT) | `services/lti-service/src/http/routes/registration.test.ts > keeps all five default scopes when scopes_supported is undefined / [] / ["…/score"] (B-LA-E3-06-01)` (3 tests) verifies that a `complete` without `scopes` answers `200` and sends all five ADR-009 scopes even when `scopes_supported` is absent, empty, or partial; the pre-LA two-scope test fixture is restored. `e3-06-unit.log` |
| Unsupported scopes named in error description and `details.unsupported` (`af9e8bc`, `B-LA-E3-06-02`) | PASS (UNIT) | `registration.test.ts > checks advertised scopes for an explicit list before sending` verifies `400 INVALID_REQUEST` names the unsupported scope URLs in `description` and sets `details: { field: 'scopes', unsupported }` with zero outbound registration requests. `e3-06-unit.log` |
| Repeated scopes refused (`b65c087`, `A-LA-E3-06-02` / `B-LA-E3-06-03`) | PASS (UNIT + K0) | `registration.test.ts > refuses repeated scope before sending or claiming the session (LA-E3-06 AC-04)` verifies duplicate scopes in `complete.scopes` return `400 INVALID_REQUEST` (`field: 'scopes'`) before claiming the session or making any outbound request (`45` unit tests pass in `e3-06-unit.log`, `3/3` K0 pass in `LA-E3-06-k0.log`). |

## Other checks

- **F1 and F5 checks:** `services/lti-service/src/lti/registration.ts` and `services/lti-service/src/http/routes/registration.ts` pass `fitness:lms-names` within baseline and pass `fitness:rules` with `0` hits (`LA-E3-06-k0.log`).
- **File scope (`36f70d8` and `028c30a`):** For `LA-E3-06`, touches only `services/lti-service/src/lti/registration*.ts` and `services/lti-service/src/http/routes/registration*.ts`. `store/audit.ts`, `platform/nrps.ts`, `/api/memberships`, `packages/channels/**` and app files are untouched.
- **Clone cleanliness:** `git status --porcelain` in `~/cogniate-qa-runs/LA/qa4-r8-a2dfc04/clone` is empty after the run (`status-after.txt`, 0 bytes).

## Regression and time

R0: PASS (`11.93s` Round 1 K0, `2.06s` Round 1 unit with 41 tests; `11.57s` Round 2 K0, `3.21s` Round 2 unit with 45 tests). `K1-SIM` (`AC-LA-E3-06-01`..`03`, `05`, `06`) is `pending: Docker window`.
