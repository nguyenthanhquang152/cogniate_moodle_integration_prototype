Verdict: PASS (host-only K0 + UNIT; K1-SIM and MOODLE-LIVE pending: Docker window)
Round: 1

# LA-E1-09 S7 `{LMS}` texts in the app, the player and tracking; portal route allowlist: QA verification

Tester: QA-3 (Orca task `task_241dc471afe8`, dispatch `ctx_44be6cfd9586`), 2026-10-23. Spec: `docs/architecture/ltiaas/tasks/LA-E1-09.md` (with `BD-A1-30`, `BD-A1-56`, `BD-A1-57`, `LA-IC-19`). Suite: `tests/ltiaas/tasks-core/LA-E1-09/` (QA-3 test-first).

Independence: QA-3 did not read product source (`services/**`, `packages/**`, `apps/**`), Author notes or reviewer files. QA-3 verified all K0 and UNIT ACs in an isolated `--no-hardlinks` clone of `836d579`.

| Item | Value |
| --- | --- |
| SHA | `836d579f2a42f7d44b6e470d1e74a17bb46aaee2` (integration `836d579`; holds `LA-E1-09` merge `e770ff2` over `f38f16d`, including RQ-2 `9ac60c6` on `packages/shared/src/index.ts`, `BD-A1-56` app error table, `BD-A1-57` / `LA-IC-19` `410 RUNTIME_EXPIRED` session channel text, and `canvas-embedded.ts` → `embedded-session-help.ts`) |
| Lane and slot | lane K; no Docker (HOST-ONLY; K1-SIM and MOODLE-LIVE rows marked `pending: Docker window`) |
| Clone | `~/cogniate-qa-runs/LA/LA-E1-09/r1/clone`: `git clone --no-hardlinks --no-checkout`, detached at `836d579f2a42f7d44b6e470d1e74a17bb46aaee2`, push URL `DISABLED`, `npm ci` at root |
| Environment | macOS arm64, Node 24.21.0, npm 11.19.0 |
| Artifacts | private run folder `~/cogniate-qa-runs/LA/LA-E1-09/r1/` (umask 077): `npm-ci.log`, `k0-vitest.log`, `unit-rows-by-id.log`, `unit-rows-files.log`, `k0/e1-09-check-clean.log`, `k0/e1-09-ac06-f1-zero.json`, `k0/e1-09-unit-rows.log`, `status-after.txt` |

## Acceptance criteria

| AC | Result | Test id | Command | Evidence |
| --- | --- | --- | --- | --- |
| AC-LA-E1-09-01 | pending: Docker window (K1-SIM) | `golden.k1sim.test.ts > AC-LA-E1-09-01` | QA-3 SIM slot (`qa3-la-sim-r<n>`, `PUBLIC_PORT` 9443, `STACK_SUBNET` 172.20.0.0/16) | Pending SIM Docker window for Golden G4 comparison. |
| AC-LA-E1-09-02 | PASS (UNIT + K0) | `texts.k0.test.ts > BD-A1-56, BD-A1-57 (LA-IC-19), AC-LA-E1-09-02..04` + `services/cogniate-app/src/tool-pages/lms-texts.test.ts` (6 tests: player shell/play pages, `PLAY_NOT_FOUND`, runtime page and `410` text `LA-IC-19`, register confirm/done pages, quote/markup characters, error pages and stored `lastError`) + `apps/player/src/lms-name.test.ts` (17 tests: `AC-LA-E1-09-02: takes the server text name "Canvas"/"Blackboard"/"Moodle"/"your LMS"/"  D2L "/""/"   "`, no `data-lms-name`, markup-like name as text, shell polling, 410/404 runtime state responses) + `services/cogniate-app/src/tool-pages/embedded-session-help.test.ts` (2 tests) | `LA_LEVEL=k0 LA_SCRATCH_CLONE=$PWD LA_BASE_SHA=f38f16d LA_RUN_DIR=~/cogniate-qa-runs/LA/LA-E1-09/r1/k0 npx --no-install vitest run --config tests/ltiaas/tasks-core/LA-E1-09/vitest.config.mts --reporter=verbose` | With a test channel whose `names.text` is `your LMS`, tool pages, register pages, error pages, runtime `410` state responses, and player status texts fill `{LMS}` (e.g. `"Open the activity again in your LMS."`), while Moodle connections and sessions keep today's bytes unchanged. `k0/e1-09-unit-rows.log`, `unit-rows-files.log` |
| AC-LA-E1-09-03 | PASS (UNIT + K0) | `packages/tracking/src/status-text.test.ts > AC-LA-E1-09-03: the status texts fill {LMS} with the text name Moodle/Canvas/Blackboard/your LMS/Brightspace` + `AC-LA-E1-09-03: the Moodle texts are the T5a strings byte for byte` (6 tests) + `packages/tracking/src/tracking.test.ts` (60 tests) | as AC-02 | `packages/tracking` status texts return today's strings byte for byte for `Moodle`, `Canvas`, and `Blackboard`, and accept any text name (`your LMS`, `Brightspace`). `k0/e1-09-unit-rows.log`, `unit-rows-files.log` |
| AC-LA-E1-09-04 | PASS (UNIT + K0) | `services/cogniate-app/src/app/portal.test.ts > AC-LA-E1-09-04: every registry channel id, a test channel included, gets the portal routes` + `AC-LA-E1-09-04: an id that is not in the registry keeps the unknown-path answer, with or without a session` (2 tests) | as AC-02 | The app serves the portal for `/integrations/<id>/connect` and `/integrations/<id>/<connectionId>` for every registry channel id (test channel included) and preserves the unknown-path response for unregistered ids. `k0/e1-09-unit-rows.log` |
| AC-LA-E1-09-05 | pending: Docker window (MOODLE-LIVE) | Lead QA / QA-E2E R2-lite (`T7 × 1`, `T4b2`, `T5a`, `T6`) | Moodle slot | Pending Docker window. |
| AC-LA-E1-09-06 | PASS (K0 + UNIT) | `texts.k0.test.ts > AC-LA-E1-09-06` + `BD-A1-56, BD-A1-57 (LA-IC-19), AC-LA-E1-09-02..04` + `packages/channel-kernel/src/legacy-wire.test.ts` (3 tests) | as AC-02 | All 22 core files in `LA-E1-09` scope (`services/cogniate-app/src/tool-pages/**`, `content-host/server.ts`, `app/portal.ts`, `app/api-errors.ts`, `app/reject-info.ts`, `packages/tracking/src/{status-text,html}.ts`, `packages/shared/src/html.ts`, `apps/player/src/**`) have `0` F1 hits and `0` in `f1-baseline.json`, `canvas-embedded.ts` is renamed to `embedded-session-help.ts`, no closed 3-LMS union remains, `BD-A1-56` removes `MOODLE_WS_ERROR`/`MBZ_NOT_SUPPORTED`/`WS_TOKEN_INVALID`/`WS_FUNCTIONS_MISSING`/`MBZ_BUILD_LIMIT` from `app/api-errors.ts` and freezes `PLATFORM_IN_USE`/`DEPLOYMENT_IN_USE`/`DEPLOYMENT_FIXED` in `legacy-wire.ts`, and tree-wide F1 drops `20 files / 74 hits → 9 files / 29 hits` (`-45` hits). `k0/e1-09-ac06-f1-zero.json` |

### Intended-change scan (`LA-IC-19` / `BD-A1-57` and `BD-A1-56`)

| Id | Change | Verification | Golden (`G1`–`G4`) impact | Frozen test scan (`tests/acceptance/**`, `tests/e2e/**`, `tests/ltiaas/golden/**`) |
| --- | --- | --- | --- | --- |
| `LA-IC-19` (`BD-A1-57`) | `GET /rt/{token}/state` `410 RUNTIME_EXPIRED` body names the session's channel (`"…Open the activity again in {LMS}."`); Moodle bytes unchanged (`"…Open the activity again in Moodle."`); Canvas, Blackboard, and test channel (`your LMS`) sessions name their LMS | `services/cogniate-app/src/tool-pages/lms-texts.test.ts > AC-LA-E1-09-02: runtime page (content origin) > the runtime page and the 410 text name the session's channel (LA-IC-19); a Moodle session keeps today's bytes` + `apps/player/src/lms-name.test.ts > AC-LA-E1-09-02: reads the runtime body before a 410 state response (Canvas / your LMS)` + `texts.k0.test.ts > BD-A1-56, BD-A1-57 (LA-IC-19), AC-LA-E1-09-02..04` | **None** (`G1`–`G4` do not capture expired runtime `/rt/{token}/state` `410` responses) | **None** (`0` affected frozen tests: `git grep -n RUNTIME_EXPIRED -- tests/acceptance tests/e2e tests/ltiaas/golden` matches only `tests/acceptance/T5a/6-negative.spec.ts:2,75,83`, which runs on a Moodle connection where the bytes are unchanged and asserts only `late.status === 410` and `code(late.json) === 'RUNTIME_EXPIRED'`; `tests/acceptance/M1/{canvas/canvas.ts:118,canvas/browser.ts:193,common/moodle-http.ts:66,common/course.ts:55}` call `/rt/${runtimeToken}/state` on active sessions expecting `200`) |
| `BD-A1-56` | Remove `MOODLE_WS_ERROR`, `MBZ_NOT_SUPPORTED`, `WS_TOKEN_INVALID`, `WS_FUNCTIONS_MISSING`, `MBZ_BUILD_LIMIT` from `services/cogniate-app/src/app/api-errors.ts` (sent by the Moodle channel table since `LA-E1-08`); freeze M1 default texts of `PLATFORM_IN_USE`, `DEPLOYMENT_IN_USE`, `DEPLOYMENT_FIXED` in `legacy-wire.ts` | `texts.k0.test.ts` + `packages/channel-kernel/src/legacy-wire.test.ts > keeps the M1 default texts of the app error codes byte for byte (LA-E1-09)` | **None** | **None** |

### R0 `npm run check` counts at `836d579` (`k0/e1-09-check-clean.log`)

| Suite | LA-E0-01 baseline (`1b17261`) | At `836d579` |
| --- | --- | --- |
| Vitest (`test:unit`) | 97 files; 1,351 passed, 5 skipped | 169 files; 2,743 passed, 5 skipped |
| Infra (`test:infra`, `node --test`) | 197 pass, 0 fail | 252 pass, 0 fail |
| K0 (`test:k0`) | — | 3 files; 121 passed |
| F1 (`fitness:lms-names`) | — | `F1 PASS: 9 files with hits, 29 hits` |
| F5 (`fitness:rules`) | — | `F5 PASS: 6 rules (audit-event-delete, channel-sql-tables, connection-lms, no-score-sync, protocol-urls, sql-portability), 0 hits` |

## Other checks

- **File scope (`f38f16d..e770ff2`):** `LA-E1-09` touches only files allowed by `docs/architecture/ltiaas/tasks/LA-E1-09.md` (`apps/player/src/**`, `packages/channel-kernel/src/legacy-wire*`, `packages/shared/src/{html,index}.ts` with RQ-2 `9ac60c6`, `packages/tracking/src/{status-text*,tracking.test.ts}`, `services/cogniate-app/src/{app,content-host,tool-pages}/**`, and `infra/scripts/fitness/f1-baseline.json`). Neither `packages/tracking/src/outcome.ts`, `services/lti-service/**`, nor `apps/portal/**` were edited.
- **Clone cleanliness:** `git status --porcelain` in `~/cogniate-qa-runs/LA/LA-E1-09/r1/clone` is empty after the run (`status-after.txt`, 0 bytes). Note: the first `npm run check` invocation inside `texts.k0.test.ts` encountered the known host-load timing flake in `infra/scripts/sqlite-lock-probe.test.mjs:155:3`; re-running passed `252/252` infra tests cleanly.

## Regression and time

R0 (`npm run check` on the clean clone): PASS. Golden G4 (`AC-01`) and R2-lite (`AC-05`): `pending: Docker window`. Measured time of `texts.k0.test.ts`: `157.19s` (`AC-06` `22.26s`, `BD-A1-56/57 & UNIT rows` `1.84s`, `npm run check` in `beforeAll` `133.1s`); standalone 8 unit files (93 tests) `2.18s`.
