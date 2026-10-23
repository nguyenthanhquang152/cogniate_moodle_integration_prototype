Verdict: PASS (host-only K0 + UNIT; K1-SIM and MOODLE-LIVE pending: Docker window)
Round: 1

# LA-E3-07 NRPS scope: channel values, Canvas JSON, Moodle row 13: QA verification

Tester: QA-3 (task `task_e59ce20f8f0f` / `ctx_e6263da242a0`), 2026-10-23. Spec: `docs/architecture/ltiaas/tasks/LA-E3-07.md` (with `LA-ADR-05` D4, `LA-ADR-01` D3, `cogniate-app-api-delta.md` §3.3). Suite: `tests/ltiaas/tasks-core/LA-E3-07/` (QA-3 test-first).

Independence: QA-3 did not read product implementation files (`services/**`, `packages/**`, `apps/**`) except the existing test file `services/cogniate-app/src/app/canvas-configuration.test.ts` (lines 1-60, inspected to check how `testApp` is wired for Canvas connections; disclosed per independence rules). QA-3 verified all K0 and host/unit checks in an isolated `--no-hardlinks` clone at `326ceae8db2faeb438481e4f6f1bd704b4ced697` (`~/cogniate-qa-runs/LA/run20/clone`).

## Round 1

| Item | Value |
| --- | --- |
| SHA | `326ceae8db2faeb438481e4f6f1bd704b4ced697` (integration `326ceae`; holds `LA-E3-07` commit `a390edb`) |
| Lane and slot | lane K; no Docker in run 20 (HOST-ONLY; `K1-SIM` and `MOODLE-LIVE` rows marked `pending: Docker window`) |
| Clone | `~/cogniate-qa-runs/LA/run20/clone`: `git clone --no-hardlinks --no-checkout`, detached at `326ceae8db2faeb438481e4f6f1bd704b4ced697`, push URL `DISABLED`, `npm ci` at root and `npm --prefix tests ci` |
| Environment | macOS arm64, Node 24.21.0, npm 11.19.0 |
| Artifacts | private run folder `~/cogniate-qa-runs/LA/run20/k0/LA-E3-07/` (umask 077): `vitest.log`, `e3-07-check-clean.log`, `e3-07-ac01-scopes.json`, `e3-07-k0.log`, `e3-07-api-checks.json`, `e3-07-unit.log`, `../status-after.txt` |

### Round 1 acceptance criteria

| AC | Result | Test id | Command | Evidence |
| --- | --- | --- | --- | --- |
| AC-LA-E3-07-01 | PASS (K0) | `nrps-scopes.k0.test.ts > AC-LA-E3-07-01: registration.scopes of moodle, canvas, blackboard (and all loaded channels) equals the 4 AGS scopes in order and contains no NRPS scope` + `tests/ltiaas/k0/manifest.k0.test.ts` | `LA_LEVEL=k0 LA_SCRATCH_CLONE=$PWD LA_RUN_DIR=~/cogniate-qa-runs/LA/run20/k0/LA-E3-07 npx --no-install vitest run --config tests/ltiaas/tasks-core/LA-E3-07/vitest.config.mts --reporter=verbose` | `registration.scopes` for `moodle`, `canvas`, `blackboard`, `lti-generic` and `brightspace` equals `["https://purl.imsglobal.org/spec/lti-ags/scope/lineitem", "https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly", "https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly", "https://purl.imsglobal.org/spec/lti-ags/scope/score"]` in exact order, with no NRPS scope (`contextmembership.readonly` or `nrps`); `npm run test:k0` passes (`148/148`). `e3-07-ac01-scopes.json`, `e3-07-k0.log` |
| AC-LA-E3-07-02 | pending: Docker window (K1-SIM; host extension route + UNIT verified PASS) | `nrps-scopes.k0.test.ts > Host-only API & UNIT checks for AC-LA-E3-07-02 and AC-LA-E3-07-03` + `packages/channels/canvas/app/configuration.test.ts > AC-LA-E3-07-02` (2 tests) + `services/cogniate-app/src/app/canvas-configuration.test.ts` (5 tests); `nrps-scopes.k1sim.test.ts > AC-LA-E3-07-02` | as AC-01 | Host verification confirms the Canvas `GET canvas-configuration` extension route (`jwk=url` and `jwk=inline`) and HTTP `GET /app-api/connections/:id/canvas-configuration` return `scopes` equal to the 4 AGS scopes with no NRPS scope (`e3-07-api-checks.json`, `e3-07-unit.log`). Live `K1-SIM` check is `pending: Docker window`. |
| AC-LA-E3-07-03 | pending: Docker window (K1-SIM + MOODLE-LIVE; host API + UNIT verified PASS) | `nrps-scopes.k0.test.ts > Host-only API & UNIT checks for AC-LA-E3-07-02 and AC-LA-E3-07-03` + `packages/channels/moodle/app.test.ts > AC-LA-E3-07-03 (unit part)` + `services/cogniate-app/src/app/connect.test.ts` (34 tests); `nrps-scopes.k1sim.test.ts > AC-LA-E3-07-03` | as AC-01 | Host HTTP `GET /app-api/connections/:id/tool-configuration` on a Moodle manual connection returns 16 rows with row 12 (`key: "ags"`) unchanged and row 13 (`key: "nrps"`, `label: "IMS LTI Names and Role Provisioning"`) equal to `"Do not use this service"` (`e3-07-api-checks.json`, `e3-07-unit.log`). Live `K1-SIM` and `MOODLE-LIVE` Dynamic Registration (`scope` string without `contextmembership.readonly`) checks are `pending: Docker window`. |

### R0 `npm run check` counts at `326ceae` (`e3-07-check-clean.log`)

| Suite | Count at `326ceae` |
| --- | --- |
| Vitest (`test:unit`) | 191 files; 3,086 passed, 5 skipped |
| Infra (`test:infra`, `node --test`) | 254 pass, 0 fail |
| K0 (`test:k0`) | 3 files; 148 passed |
| F1 (`fitness:lms-names`) | `F1 PASS: 0 files with hits, 0 hits` |
| F5 (`fitness:rules`) | `F5 PASS: 6 rules (audit-event-delete, channel-sql-tables, connection-lms, no-score-sync, protocol-urls, sql-portability), 0 hits` |

### Other checks

- **File scope (`a390edb^..a390edb`):** Touches only `packages/channels/{moodle,canvas,blackboard}` (`manifest.ts`, `moodle/app.ts`, `moodle/app.test.ts`, `canvas/app/configuration.ts`, `canvas/app/configuration.test.ts`) and golden `G1.json` + unit test updates; zero core source files (`services/cogniate-app/src/kernel/**`, `services/lti-service/src/kernel/**`).
- **Clone cleanliness:** `git status --porcelain` in `~/cogniate-qa-runs/LA/run20/clone` is empty after the run (`status-after.txt`, 0 bytes).
- **Measured time:** `nrps-scopes.k0.test.ts` (2 tests) `85.88s` (`npm run check` in `beforeAll` `81.9s`, `AC-01` `884ms`, `AC-02/AC-03` host + 53 unit tests `3.00s`).
