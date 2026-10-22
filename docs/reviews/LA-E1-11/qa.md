Verdict: PASS (host-only K0 + UNIT; K1-SIM and K2 pending: Docker window)
Round: 2

# LA-E1-11 S8 Portal shell, portal SDK and the channel portal modules: QA verification

Tester: QA-3 (Round 1: task `task_ee6c6506d56e` / `ctx_4ec2a34e6c0e`; Round 2: task `task_04af42599b39` / `ctx_9a0c491be3a8`), 2026-10-22. Spec: `docs/architecture/ltiaas/tasks/LA-E1-11.md` (with `BD-A1-24`, `BD-A1-25`, `BD-A1-26`, `BD-A1-32`, `BD-A1-44`, `BD-A1-49`, `BD-A1-50`, `BD-A1-51`). Suite: `tests/ltiaas/tasks-core/LA-E1-11/` (QA-3 test-first).

Independence: QA-3 did not read product source (`services/**`, `packages/**`, `apps/**`), Author notes or reviewer files. QA-3 verified all K0 and UNIT ACs in isolated `--no-hardlinks` clones (`5ec8a69` in Round 1; `d2166d7` in Round 2).

## Round 2

| Item | Value |
| --- | --- |
| SHA | `d2166d71fbd53432ea05f1a9b71a6e1e0ec690aa` (integration `d2166d7`; holds `LA-E1-11` fix round 1 commit `54da76f` over `e29f574`, initial merge `0d9aeda` over `004b5ee`) |
| Lane and slot | lane P; no Docker (HOST-ONLY; K1-SIM and K2 rows marked `pending: Docker window`) |
| Clone | `~/cogniate-qa-runs/LA/LA-E1-11/r2/clone`: `git clone --no-hardlinks --no-checkout`, detached at `d2166d71fbd53432ea05f1a9b71a6e1e0ec690aa`, push URL `DISABLED`, `npm ci` at root |
| Environment | macOS arm64, Node 24.21.0, npm 11.19.0 |
| Artifacts | private run folder `~/cogniate-qa-runs/LA/LA-E1-11/r2/` (umask 077): `npm-ci.log`, `k0-vitest.log`, `unit-rows-by-id.log`, `unit-rows-portal.log`, `k0/e1-11-check-clean.log`, `k0/e1-11-ac07-portal-build.log`, `k0/e1-11-ac08-eslint-portal.json`, `k0/e1-11-ac08-probe5.json`, `k0/e1-11-ac09-f1-deltas.json`, `status-after.txt` |

### Round 2 acceptance criteria

| AC | Result | Test id | Command | Evidence |
| --- | --- | --- | --- | --- |
| AC-LA-E1-11-01 | PASS (UNIT) | `apps/portal/src/channels/shell.test.tsx > manifest portal shell > renders one card for every discovered channel and the data-only channel`, `keeps the graduation-cap logo on the baseline card and connect page`, `renders all four default steps from shell-canary manifest data`, `routes moodle/canvas/blackboard through its real module with the baseline verification screen`, `keeps moodle/canvas/blackboard/shell-canary available when profile discovery fails, then honors explicit not-ready data`, `renders the real moodle/canvas/blackboard wizard while profile discovery is still pending`, `keeps the moodle/canvas/blackboard Open link next to Go to Courses` + `packages/channel-kernel/src/registry.test.ts > accepts only the closed card icon name and keeps mark required` + `apps/portal/src/channels/presentation.test.tsx` (no AC id in test name, Reviewer-B maps) | `npx --no-install vitest run --reporter=verbose apps/portal/src/channels/shell.test.tsx apps/portal/src/channels/presentation.test.tsx packages/channel-kernel/src/registry.test.ts` | Every registered manifest (via its real portal module) and a data-only test manifest (`shell-canary`) renders one card and the four wizard steps; `card.icon` preserves the graduation-cap icon (`BD-A1-49`); `LA-IC-18` and the `Open` link next to `Go to Courses` are preserved (`BD-A1-50`); `ga`/`preview` channels remain usable when profile discovery fails or is pending (`BD-A1-51`). `unit-rows-portal.log` |
| AC-LA-E1-11-02 | PASS (UNIT) | `apps/portal/src/channels/shell.test.tsx > manifest portal shell > rejects an unknown channel at /integrations/unknown/connect`, `rejects an unknown channel at /integrations/unknown/con_shell`, `rejects another channel's connection even when its legacy lms field matches` + `apps/portal/src/multi-lms.test.ts > shows not found without exposing connection settings at /integrations/blackboard/canvas`, `/integrations/unknown/canvas`, `/integrations/canvas/foreign` + `apps/portal/src/api.test.ts` (9 decoded extension-path guard tests; no AC id in test name, Reviewer-B maps) | `npx --no-install vitest run --reporter=verbose apps/portal/src/channels/shell.test.tsx apps/portal/src/multi-lms.test.ts apps/portal/src/api.test.ts` | Generic routes `/integrations/:channelId/connect` and `/integrations/:channelId/:connectionId` render known channels, show "not found" without exposing connection settings on unknown/cross-channel routes, and `api.ts` rejects decoded traversal/origin escapes (`/%2e%2e`, `/%2f`, `/%5c`, `/%zz`, `//other.test`). `unit-rows-portal.log` |
| AC-LA-E1-11-03 | PASS (UNIT) | `apps/portal/src/channels/shell.test.tsx > manifest portal shell > the real moodle/canvas/blackboard module obeys stored authority even when its method is unchanged`, `selects the verification step from a test manifest's self/operatorGrant authority`, `uses stored authority after dynamic registration stages a self test connection`, `keeps the reserved admin-launch authority separate from an operator grant` (8 tests; no AC id in test name, Reviewer-B maps) | `npx --no-install vitest run --reporter=verbose apps/portal/src/channels/shell.test.tsx` | Real Moodle, Canvas and Blackboard modules and generic shell wizard obey stored `bindingAuthority` (`BD-A1-24`, `BD-A1-44`): `self` shows the first-launch step, `operatorGrant` shows the approval-code step, and `adminLaunch` stays separate. `unit-rows-portal.log` |
| AC-LA-E1-11-04 | pending: Docker window (K2) | QA-E2E K2 U1 | QA-E2E Docker slot | Pending Docker window (K2 U1 by QA-E2E). |
| AC-LA-E1-11-05 | pending: Docker window (K2) | QA-E2E K2 U2 | QA-E2E Docker slot | Pending Docker window (K2 U2 by QA-E2E). |
| AC-LA-E1-11-06 | pending: Docker window (K1-SIM) | Lead QA R1 (`M1 --phase sim` + `M2`) + T6 subset | Lead QA SIM slot | Pending Docker window. |
| AC-LA-E1-11-07 | PASS (K0) | `portal-shell.k0.test.ts > AC-LA-E1-11-07` | `LA_LEVEL=k0 LA_SCRATCH_CLONE=$PWD LA_BASE_SHA=004b5ee LA_RUN_DIR=~/cogniate-qa-runs/LA/LA-E1-11/r2/k0 npx --no-install vitest run --config tests/ltiaas/tasks-core/LA-E1-11/vitest.config.mts --reporter=verbose` | `npm run build -w apps/portal` exits `0`; built CSS in `apps/portal/dist/assets/*.css` contains utility classes from `packages/channels/moodle/portal/**` and emits the unique probe class `z-[4711]` placed only in `packages/channels/moodle/portal/zz-qa-tailwind-probe.tsx`. `k0/e1-11-ac07-portal-build.log` |
| AC-LA-E1-11-08 | PASS (K0) | `portal-shell.k0.test.ts > AC-LA-E1-11-08` | as AC-07 | Direct ESLint run on `packages/channels/{moodle,canvas,blackboard}/portal/**` exits `0` with `0` errors across all channel portal files (`k0/e1-11-ac08-eslint-portal.json`), and LA-E1-03 probe (5) (`packages/channels/canvas/portal/index.tsx` importing `apps/portal/src/Integrations`) exits `1` with a severity-2 error (`k0/e1-11-ac08-probe5.json`). |
| AC-LA-E1-11-09 | PASS (K0) | `portal-shell.k0.test.ts > AC-LA-E1-11-09` | as AC-07 | Legacy portal LMS files (`apps/portal/src/connect/{canvas,blackboard}`, `MoodleSteps.tsx`, `MoodleBackup.tsx`, `MoodleCourse.tsx`, `WebServices.tsx`) do not exist on disk or in git; `apps/portal/src/Integrations.tsx` has `0` F1 hits (`13 → 0`); and portal F1 hits dropped further in Round 2 from `18 → 15` (`api.ts` `4 → 0`, `types.ts` `5 → 2`). `k0/e1-11-ac09-f1-deltas.json` |

### R0 `npm run check` counts at `d2166d7` (`k0/e1-11-check-clean.log`)

| Suite | Round 1 (`5ec8a69`) | Round 2 (`d2166d7`) |
| --- | --- | --- |
| Vitest (`test:unit`) | 130 files; 2,166 passed, 5 skipped | 147 files; 2,403 passed, 5 skipped |
| Infra (`test:infra`, `node --test`) | 211 pass, 0 fail | 230 pass, 0 fail |
| K0 (`test:k0`) | 3 files; 121 passed | 3 files; 121 passed |
| F1 (`fitness:lms-names`) | `F1 PASS: 32 files with hits, 184 hits` | `F1 PASS: 20 files with hits, 74 hits` |
| F5 (`fitness:rules`) | `F5 PASS: 3 rules, 0 hits` | `F5 PASS: 5 rules (audit-event-delete, channel-sql-tables, connection-lms, no-score-sync, sql-portability), 0 hits` |

### Round 2 other checks

- **File scope (`e29f574..54da76f`):** Fix round 1 touches `apps/portal/**`, `packages/channels/{moodle,canvas,blackboard}/portal/**`, `packages/channel-kernel/src/{manifest,registry.test}.ts` and `packages/channels/moodle/manifest.ts` (authorized by `BD-A1-49` RQ-2 for `card.icon`), `vitest.config.ts`, and `infra/scripts/fitness/f1-baseline.json`.
- **Clone cleanliness:** `git status --porcelain` in `~/cogniate-qa-runs/LA/LA-E1-11/r2/clone` is empty after the run (`status-after.txt`, 0 bytes).
- **Measured time (Round 2):** `portal-shell.k0.test.ts` `134.08s` (`AC-07` `1.47s`, `AC-08` `1.13s`, `AC-09` `47.56s`, `npm run check` in `beforeAll` `83.9s`); portal + registry unit suites (8 files, 141 tests) `1.58s`.

---

## Round 1

| Item | Value |
| --- | --- |
| SHA | `5ec8a699a554a4043fe91c6f6903380a0c2f53d4` (integration `5ec8a69`; holds `LA-E1-11` merge `0d9aeda` over base `004b5ee`) |
| Lane and slot | lane P; no Docker (HOST-ONLY; K1-SIM and K2 rows marked `pending: Docker window`) |
| Clone | `~/cogniate-qa-runs/LA/LA-E1-11/r1/clone`: `git clone --no-hardlinks --no-checkout`, detached at `5ec8a699a554a4043fe91c6f6903380a0c2f53d4`, push URL `DISABLED`, `npm ci` at root |
| Environment | macOS arm64, Node 24.21.0, npm 11.19.0 |
| Artifacts | private run folder `~/cogniate-qa-runs/LA/LA-E1-11/r1/` (umask 077): `npm-ci.log`, `k0-vitest.log`, `unit-rows-by-id.log`, `unit-rows-portal.log`, `k0/e1-11-check-clean.log`, `k0/e1-11-ac07-portal-build.log`, `k0/e1-11-ac08-eslint-portal.json`, `k0/e1-11-ac08-probe5.json`, `k0/e1-11-ac09-f1-deltas.json`, `status-after.txt` |

## Acceptance criteria

| AC | Result | Test id | Command | Evidence |
| --- | --- | --- | --- | --- |
| AC-LA-E1-11-01 | PASS (UNIT) | `apps/portal/src/channels/shell.test.tsx > manifest portal shell > renders one card for every discovered channel and the data-only channel` + `renders all four default steps from moodle/canvas/blackboard/shell-canary manifest data` + `uses the generic connect route without a portal module and submits manifest fields` + `hides an unlisted simulation channel's card and rejects its direct route` + `apps/portal/src/channels/presentation.test.tsx` (9 tests; no AC id in test name, Reviewer-B maps) | `npx --no-install vitest run --reporter=verbose apps/portal/src/channels/shell.test.tsx apps/portal/src/channels/presentation.test.tsx` | Every registered manifest and a test manifest with no portal module (`shell-canary`) renders one card and the four default wizard steps; `simulation-only` channels follow `BD-A1-26`; `ConnectionError` slot and shell fallback follow `BD-A1-32`. `unit-rows-portal.log` |
| AC-LA-E1-11-02 | PASS (UNIT) | `apps/portal/src/channels/shell.test.tsx > manifest portal shell > rejects an unknown channel at /integrations/unknown/connect`, `rejects an unknown channel at /integrations/unknown/con_shell`, `rejects another channel's connection even when its legacy lms field matches` + `apps/portal/src/multi-lms.test.ts > shows not found without exposing connection settings at /integrations/blackboard/canvas`, `/integrations/unknown/canvas`, `/integrations/canvas/foreign` (6 tests; no AC id in test name, Reviewer-B maps) | `npx --no-install vitest run --reporter=verbose apps/portal/src/channels/shell.test.tsx apps/portal/src/multi-lms.test.ts` | Generic routes `/integrations/:channelId/connect` and `/integrations/:channelId/:connectionId` render known channels and show the "not found" view without exposing connection settings for unknown channels or cross-channel connections. `unit-rows-portal.log` |
| AC-LA-E1-11-03 | PASS (UNIT) | `apps/portal/src/channels/shell.test.tsx > manifest portal shell > selects the verification step from moodle/canvas/blackboard authority`, `uses stored authority after dynamic registration stages a self connection`, `keeps the reserved admin-launch authority separate from an operator grant` (5 tests; no AC id in test name, Reviewer-B maps) | `npx --no-install vitest run --reporter=verbose apps/portal/src/channels/shell.test.tsx` | Verification step follows stored `bindingAuthority` (`BD-A1-24`): `self` (Moodle) shows the first-launch step; `operatorGrant` (Canvas, Blackboard) shows the approval-code step; `adminLaunch` stays separate. `unit-rows-portal.log` |
| AC-LA-E1-11-04 | pending: Docker window (K2) | QA-E2E K2 U1 | QA-E2E Docker slot | Pending Docker window (K2 U1 by QA-E2E). |
| AC-LA-E1-11-05 | pending: Docker window (K2) | QA-E2E K2 U2 | QA-E2E Docker slot | Pending Docker window (K2 U2 by QA-E2E). |
| AC-LA-E1-11-06 | pending: Docker window (K1-SIM) | Lead QA R1 (`M1 --phase sim` + `M2`) + T6 subset | Lead QA SIM slot | Pending Docker window. |
| AC-LA-E1-11-07 | PASS (K0) | `portal-shell.k0.test.ts > AC-LA-E1-11-07` | `LA_LEVEL=k0 LA_SCRATCH_CLONE=$PWD LA_BASE_SHA=004b5ee LA_RUN_DIR=~/cogniate-qa-runs/LA/LA-E1-11/r1/k0 npx --no-install vitest run --config tests/ltiaas/tasks-core/LA-E1-11/vitest.config.mts --reporter=verbose` | `npm run build -w apps/portal` exits `0`; built CSS in `apps/portal/dist/assets/*.css` contains utility classes used in `packages/channels/moodle/portal/**` and emits the unique probe class `z-[4711]` placed only in `packages/channels/moodle/portal/zz-qa-tailwind-probe.tsx` via `@source "../../../packages/channels/*/portal";`. `k0/e1-11-ac07-portal-build.log` |
| AC-LA-E1-11-08 | PASS (K0) | `portal-shell.k0.test.ts > AC-LA-E1-11-08` | as AC-07 | Direct ESLint run on `packages/channels/{moodle,canvas,blackboard}/portal/**` exits `0` with `0` errors across all channel portal files (`k0/e1-11-ac08-eslint-portal.json`), and the LA-E1-03 probe (5) (`packages/channels/canvas/portal/index.tsx` importing `apps/portal/src/Integrations`) exits `1` with a severity-2 error (`k0/e1-11-ac08-probe5.json`). |
| AC-LA-E1-11-09 | PASS (K0) | `portal-shell.k0.test.ts > AC-LA-E1-11-09` | as AC-07 | `apps/portal/src/connect/canvas/`, `apps/portal/src/connect/blackboard/`, `MoodleSteps.tsx`, `MoodleBackup.tsx`, `MoodleCourse.tsx` and `WebServices.tsx` no longer exist in core (on disk or tracked in git); `apps/portal/src/Integrations.tsx` has `0` F1 hits (`13 → 0`, Moodle-only ready rule gone); and portal F1 hits dropped from `315 → 18` (`App.tsx` `13 → 0`, `IntegrationLogo.tsx` `2 → 0`, `Integrations.tsx` `13 → 0`, `Connect.tsx` `5 → 0`, `ConnectionSetup.tsx` `11 → 0`, `ConnectionStatus.tsx` `8 → 0`, `DisconnectDialog.tsx` `6 → 0`, `ProviderSetup.tsx` `4 → 0`, `CoursePackage.tsx` `4 → 0`, `Publications.tsx` `7 → 0`, `PublishDialog.tsx` `8 → 1`, `lms.ts` `11 → 0`, `types.ts` `11 → 5`, `ui.tsx` `6 → 0`). `k0/e1-11-ac09-f1-deltas.json` |

### R0 `npm run check` counts at `5ec8a69` (`k0/e1-11-check-clean.log`)

| Suite | Count at `5ec8a69` |
| --- | --- |
| Vitest (`test:unit`) | 130 files; 2,166 passed, 5 skipped |
| Infra (`test:infra`, `node --test`) | 211 pass, 0 fail |
| K0 (`test:k0`) | 3 files; 121 passed |
| F1 (`fitness:lms-names`) | `F1 PASS: 32 files with hits, 184 hits` |
| F5 (`fitness:rules`) | `F5 PASS: 3 rules (audit-event-delete, connection-lms, sql-portability), 0 hits` |

## Other checks

- **File scope (`004b5ee..0d9aeda`):** `LA-E1-11` touches `apps/portal/**`, `packages/channels/{moodle,canvas,blackboard}/portal/**`, `packages/channels/tsconfig.portal.json`, `vitest.config.ts` (RQ-2 K-file config lines), and `infra/scripts/fitness/{f1-baseline.json,fitness.test.mjs}`. No `packages/channels/*/{manifest,app,lti-profiles}.ts` or service files were edited in `0d9aeda`.
- **Clone cleanliness:** `git status --porcelain` in `~/cogniate-qa-runs/LA/LA-E1-11/r1/clone` is empty after the run (`status-after.txt`, 0 bytes).

## Regression and time

R0 (`npm run check` and `npm run build -w apps/portal` on the clean clone): PASS. R1 + T6 subset (`AC-06`) and K2 U1–U2 (`AC-04`, `AC-05`): `pending: Docker window`. Measured time of `portal-shell.k0.test.ts`: `180.6s` (`AC-07` `2.4s`, `AC-08` `1.8s`, `AC-09` `35.0s`, `npm run check` in `beforeAll` `141.4s`).
