# LA-E1-09 `{LMS}` texts in app, player and tracking, and portal route allowlist: QA-3 acceptance tests

Spec: `docs/architecture/ltiaas/tasks/LA-E1-09.md`. Design: `docs/architecture/ltiaas/adr/LA-ADR-01-channel-kernel.md` D2 (`names`), D5; `docs/architecture/ltiaas/adr/LA-ADR-04-refactor-and-migration.md` D2, D3; `tests/ltiaas/TEST-STRATEGY.md` §3.2, §4.6 G4, §4.7. QA-3 wrote these tests from the spec and design only (test-first).

| AC | Label | Status | Owner / Test | Oracle |
| --- | --- | --- | --- | --- |
| AC-LA-E1-09-01 | K1-SIM | pending: Docker window | `golden.k1sim.test.ts > AC-LA-E1-09-01` | Golden G4: every app tool error page per baseline channel, learner labels and player status texts equal the G-BASE baseline byte for byte. |
| AC-LA-E1-09-02 | UNIT | ready | Author unit test (`vitest run -t "AC-LA-E1-09-"`) | With a test channel whose `names.text` is `your LMS`, texts fill `{LMS}` (for example `"Open the activity again in your LMS."`); with Moodle channel the same text is today's text. |
| AC-LA-E1-09-03 | UNIT | ready | Author unit test (`vitest run -t "AC-LA-E1-09-"`) | Status texts of `packages/tracking` give today's strings for `Moodle`, `Canvas` and `Blackboard`, and accept any text name. |
| AC-LA-E1-09-04 | UNIT | ready | Author unit test (`vitest run -t "AC-LA-E1-09-"`) | App serves the portal for `/integrations/<id>/connect` and `/integrations/<id>/<connectionId>` for every registry channel id (test channel included); an id not in the registry keeps today's unknown-path answer. |
| AC-LA-E1-09-05 | MOODLE-LIVE | pending: Docker window | Lead QA / QA-E2E R2-lite | R2-lite (`T7 × 1`, `T4b2`, `T5a`, `T6`) passes. |
| AC-LA-E1-09-06 | K0 | ready | `texts.k0.test.ts > AC-LA-E1-09-06` | The F1 counts of every file of this task are `0` (except `legacy-wire.ts` names), `services/cogniate-app/src/tool-pages/canvas-embedded.ts` is renamed to `embedded-session-help.ts`, no closed 3-LMS name union remains in these files, and RQ-3 holds. |

## K0 run (AC-06; no Docker)

1. Clone the task integration SHA into a new folder outside the repository (`git clone --no-hardlinks --no-checkout`, `git checkout --detach <SHA>`, push URL disabled) and run `npm ci` at the clone root.
2. From the clone root (pass `LA_BASE_SHA=<parent SHA before LA-E1-09>` if the task merge has multiple commits; default is `HEAD~1`):

```sh
LA_LEVEL=k0 LA_SCRATCH_CLONE=$PWD LA_BASE_SHA=<base SHA> LA_RUN_DIR=<new private folder outside the clone> \
  npx --no-install vitest run --config tests/ltiaas/tasks-core/LA-E1-09/vitest.config.mts --reporter=verbose
```

Artifacts in `LA_RUN_DIR` (umask 077): `e1-09-check-clean.log`, `e1-09-ac06-f1-zero.json`.

## UNIT rows (AC-02, AC-03, AC-04)

In the clone of the task SHA:

```sh
npx --no-install vitest run --reporter=verbose -t "AC-LA-E1-09-"
```

`qa.md` records the passing test names that cite each AC id (`AC-LA-E1-09-02`, `AC-LA-E1-09-03`, `AC-LA-E1-09-04`).

## K1-SIM golden compare (AC-01; pending: Docker window)

1. Booked SIM slot only (after the Lead grants a Docker window): project `qa3-la-sim-r<n>`, `PUBLIC_PORT` 9443, `STACK_SUBNET` 172.20.0.0/16 (TEST-STRATEGY §5.2). Run the LA-E0-03 golden capture at the task SHA (or reuse the Lead QA's R1 golden capture of the same SHA), then stop and remove the stack.
2. No Docker:

```sh
LA_LEVEL=k1sim LA_GOLDEN_CAPTURE=<capture folder> \
  LA_GOLDEN_BASELINE=tests/ltiaas/golden/1b17261be97c4701b928fa9dc2fa74c6d23028f6 \
  LA_RUN_DIR=<private folder> \
  npx --no-install vitest run --config tests/ltiaas/tasks-core/LA-E1-09/vitest.config.mts --reporter=verbose
```
