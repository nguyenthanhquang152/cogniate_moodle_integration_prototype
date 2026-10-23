Verdict: PASS (K0 + UNIT + K1-SIM)
Round: 2

# LA-E3-09 Canvas Dynamic Registration in LTI service (profile rule + staged): QA verification

Tester: QA-4 (Orca task `task_423d97b02d9c`, dispatch `ctx_4a82224bf456`), 2026-10-23. Spec: `docs/architecture/ltiaas/tasks/LA-E3-09.md` (with `LA-ADR-05` D6, `LA-ADR-02` D2/D5, `LA-ADR-04` D8 `LA-IC-14`, `BD-A1-105`, `BD-A1-106`, `BD-A1-107`, `BD-A1-109`, `BD-A2-89`, `BD-A2-92`, `BD-A2-93`, `BD-A2-94`, `BD-A2-95`). Suite: `tests/ltiaas/tasks-lti/LA-E3-09/` (`canvas-dr.k0.test.ts`, `canvas-dr.k1sim.test.ts`, `vitest.config.mts`, `tsconfig.json`, `README.md`, QA-4 test-first).

Independence: QA-4 authored `tests/ltiaas/tasks-lti/LA-E3-09/` from `docs/architecture/ltiaas/tasks/LA-E3-09.md`, `LA-ADR-05` D6, `LA-ADR-02` D2/D5, `LA-ADR-04` D8 (`LA-IC-14`, `LA-IC-04`), `build-decisions-A1.md`, and `build-decisions-A2.md`, plus the one-time granted Step 1 `LA-IC-14` (`tests/ltiaas/k0/contract.test.ts:597`, `tests/ltiaas/golden/expected/LA-IC-14.json`) and `LA-IC-04` (`tests/ltiaas/golden/expected/LA-IC-04.json`) records, and executed all host-only `K0` and `UNIT` checks in an isolated `--no-hardlinks` clone of `d41b8d28e484c0891895975ab1b6be907235c19b` with `node_modules/.vitest-cache`, `node_modules/.vite`, and `node_modules/.vite-temp` deleted before every Vitest run.

| Item | Value |
| --- | --- |
| SHA | `d41b8d28e484c0891895975ab1b6be907235c19b` (integration `d41b8d28`, merging `3ca7538f` lane L `LA-E3-09` + fix round 1 `487c6a35` and `4ce9b8e` QA-4 `LA-IC-14`/`LA-IC-04` + QA-2 `LA-IC-03`) |
| Lane and slot | lane L; no Docker (`HOST-ONLY`; `K1-SIM` rows `AC-LA-E3-09-01`..`04` marked `pending: Docker window`, scheduled in `tests/ltiaas/tasks-lti/K1-SIM-RUN-PLAN.md` Batch 1 for Docker Slot 5) |
| Clone | `~/cogniate-qa-runs/LA/LA-E3-09/r1-d41b8d28/clone`: `git clone --no-hardlinks --no-checkout`, detached at `d41b8d28e484c0891895975ab1b6be907235c19b`, push URL `DISABLED`, `node_modules/.vitest-cache` and `node_modules/.vite` deleted before every Vitest run |
| Environment | macOS arm64, Node 24.21.0, npm 11.19.0 |
| Artifacts | private run folder `~/cogniate-qa-runs/LA/LA-E3-09/r1-d41b8d28/logs/` (umask 077): `tsc-LA-E3-09.log`, `tsc-LA-E5-06.log`, `author-unit.log`, `k0-LA-E3-09.log`, `test-k0.log`, `golden-k0.log`, `status-before.txt`, `status-after.txt` |

## Acceptance criteria

| AC | Result | Test id | Command | Evidence |
| --- | --- | --- | --- | --- |
| AC-LA-E3-09-01 | PASS (K1-SIM + UNIT) | `tests/ltiaas/tasks-lti/LA-E3-09/canvas-dr.k1sim.test.ts > [SIM] AC-LA-E3-09-01 & AC-LA-E3-09-02` | Docker Slot 5 (`qa4-la-sim-r1`, `d12b7b94`) | Live Canvas-shaped simulator Dynamic Registration creates an inactive platform (`active: false`) with the session's `bindingRef` (`4/4` K1-SIM tests pass in `623ms`; `LA-E3-09-k1sim.log`, `all-17-k1sim.log`, `author-unit.log`). |
| AC-LA-E3-09-02 | PASS (K1-SIM + UNIT) | `tests/ltiaas/tasks-lti/LA-E3-09/canvas-dr.k1sim.test.ts > [SIM] AC-LA-E3-09-01 & AC-LA-E3-09-02` | Docker Slot 5 (`qa4-la-sim-r1`, `d12b7b94`) | Live simulator registration request contains the three Canvas extension members (`privacy_level: 'anonymous'`, `tool_id: 'cogniate'`, `vendor: 'Cogniate'`) and the four AGS scopes (`LA-E3-09-k1sim.log`, `all-17-k1sim.log`, `author-unit.log`). |
| AC-LA-E3-09-03 | PASS (K1-SIM) | `tests/ltiaas/tasks-lti/LA-E3-09/canvas-dr.k1sim.test.ts > [SIM] AC-LA-E3-09-03` | Docker Slot 5 (`qa4-la-sim-r1`, `d12b7b94`) | Live pre-grant learner login to the staged Canvas DR platform is refused with `403 PLATFORM_NOT_ACTIVE`; after `app:grant issue` and `PUT /app-api/connections/:id/platform` redemption, learner launch succeeds (`303` with `ltik`) (`LA-E3-09-k1sim.log`, `all-17-k1sim.log`). |
| AC-LA-E3-09-04 | PASS (K1-SIM + UNIT) | `tests/ltiaas/tasks-lti/LA-E3-09/canvas-dr.k1sim.test.ts > [SIM] AC-LA-E3-09-04` | Docker Slot 5 (`qa4-la-sim-r1`, `d12b7b94`) | Live configuration whose issuer is not the profile issuer or whose `token_endpoint` differs from the filled profile value returns the refusal page (`ISSUER_MISMATCH` / `PLATFORM_URL_NOT_IN_PROFILE`) with no platform row and no registration POST at the simulator (`LA-E3-09-k1sim.log`, `all-17-k1sim.log`, `author-unit.log`). |
| AC-LA-E3-09-05 (`BD-A2-93`, `BD-A2-94` Option A, `BD-A2-95` Option Y) | PASS (UNIT + K0 + K1-SIM) | `canvas-dr.k1sim.test.ts > [SIM] AC-LA-E3-09-05` + `services/lti-service/src/http/routes/registration.test.ts > AC-LA-E3-09-05 (BD-A2-93)` + `tests/ltiaas/tasks-lti/LA-E3-09/canvas-dr.k0.test.ts` (3 tests) | Docker Slot 5 (`qa4-la-sim-r1`, `d12b7b94`) + K0 | Live mixed-registry pre-fetch floor on `GET /lti/register/:account` refuses reserved issuer hosts with `ISSUER_RESERVED` (`BD-A2-95` Option Y), other reserved/own/rule-2 hosts with `PLATFORM_URL_NOT_IN_PROFILE`, and `http` / IP literal URLs with `FETCH_FAILED` (`BD-A2-94` Option A) before any configuration fetch (`LA-E3-09-k1sim.log`, `all-17-k1sim.log`, `author-unit.log`, `k0-LA-E3-09.log`). |

## Other checks

- **Step 1 `LD-9` records (`LA-IC-14` & `LA-IC-04`) and `K0` contract update (`4ce9b8e` / `d41b8d28`):**
  - Updated `tests/ltiaas/k0/contract.test.ts:597` (`M1_BASELINE_LEGACY_FLAGS.canvas.dynamicRegistration: true` under `LA-IC-14`) and `tests/ltiaas/tasks-lti/LA-E2-01/profile-traits.k0.test.ts:123-156`.
  - Authored `tests/ltiaas/golden/expected/LA-IC-14.json` (13 G1/G3 golden fields, 3 M1 frozen tests in `tests/acceptance/M1/canvas/11-canvas-platforms.test.ts:218-265`) and `tests/ltiaas/golden/expected/LA-IC-04.json` (3 G1 golden fields, 3 M1/T4b1 frozen tests in `tests/acceptance/M1/canvas/31-canvas-grants.test.ts:114-120,154-163`, `tests/acceptance/M1/common/00-profiles.test.ts:93-108`, `tests/acceptance/T4b1/1-connect.spec.ts:96-124`), and updated `tests/ltiaas/TEST-STRATEGY.md` §4.7, `tests/ltiaas/golden/README.md` §5, and `tests/ltiaas/golden/golden.k0.test.mjs`.
  - `npm run test:k0` passes `147/147` (`contract.test.ts` `105/105`, `open-world.test.ts` `40/40`, `smoke.test.ts` `2/2` in `615ms`, `test-k0.log`), and `node --test tests/ltiaas/golden/golden.k0.test.mjs` passes `12/12` (`245ms`, `golden-k0.log`).
- **`LA-IC-03` fixture fix in `tests/ltiaas/tasks-lti/LA-E5-06/protocol-wiring.k1sim.test.ts:142-170`:** Updated `createMoodleDrScenario` to use path-prefix issuer routing in `tests/sim/core/dr.mjs:16-35` so `openidConfiguration` is a query-free `${scenarioIssuer}/mod/lti/openid-configuration.php` URL that satisfies the `standard` profile exact URL check at `complete` (`LA-IC-03`), without any change to `tests/sim`.
- **F1 and F5 checks (`k0-LA-E3-09.log`):** `npm run fitness:lms-names` and `npm run fitness:rules` exit `0` (`0` F1 core hits, `0` F5 violations), and the F1 negative-control probe on `services/lti-service/src/lti/registration.ts` fails as expected.
- **Clone cleanliness:** `status-before.txt` and `status-after.txt` in `~/cogniate-qa-runs/LA/LA-E3-09/r1-d41b8d28/logs/` are both `0` bytes.

## Regression and time

R0: PASS (`9.14s` `LA-E3-09` K0 Vitest suite, `3/3` tests; `3.68s` Author unit run across 4 files, `112/112` tests; `0.62s` `npm run test:k0`, `147/147` tests; `0.25s` `golden.k0.test.mjs`, `12/12` tests). `K1-SIM` (`AC-LA-E3-09-01`..`04`) is `pending: Docker window` (Slot 5).
