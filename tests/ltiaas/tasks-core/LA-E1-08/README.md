# LA-E1-08 Extension ports P5–P7, PortContext and Moodle/Canvas channel features: QA-3 acceptance tests

Spec: `docs/architecture/ltiaas/tasks/LA-E1-08.md`. Design: `docs/architecture/ltiaas/adr/LA-ADR-01-channel-kernel.md` D5, D6, D10; `docs/architecture/ltiaas/adr/LA-ADR-07-security-and-tenancy.md` D2; `docs/architecture/ltiaas/contracts/cogniate-app-api-delta.md` §3, §4, §7; `docs/architecture/ltiaas/build-decisions-A1.md` BD-A1-20, BD-A1-28, BD-A1-29; `tests/ltiaas/TEST-STRATEGY.md` §2.7, §3.2, §4.6, §4.7. QA-3 wrote these tests from the spec and design only (test-first).

| AC | Label | Status | Owner / Test | Oracle |
| --- | --- | --- | --- | --- |
| AC-LA-E1-08-01 | K1-SIM | pending: Docker window | `golden.k1sim.test.ts > AC-LA-E1-08-01` | Golden G1 Canvas configuration JSON (`G1.canvasConfiguration["jwk=url"]` and `G1.canvasConfiguration["jwk=inline"]`) equals the G-BASE baseline. |
| AC-LA-E1-08-02 | K1-SIM | pending: Docker window | Lead QA / QA-3 K1-CAP C2 (M1 values) | Guards with M1 values: Blackboard `PUT …/web-services` → `409 CAPABILITY_NOT_SUPPORTED` (`details.capability = "webServices"`), `GET …/canvas-configuration` → `409` (`canvasConfiguration`); Moodle `POST …/deployments` → `409` (`addDeployment`); Canvas publish with `createMoodleCourse` → `409` (`courseShell`), each with the three network oracles. |
| AC-LA-E1-08-03 | UNIT | ready | Author unit test (`vitest run -t "AC-LA-E1-08-"`) | `ChannelSql` refuses a statement without `:library_id` with error `channel_sql_unscoped`; with two libraries, a bound statement of library A returns no row of library B. |
| AC-LA-E1-08-04 | K0 | ready | `extensions.k0.test.ts > AC-LA-E1-08-04` | F5 `channel-sql-tables` refuses a probe statement in `packages/channels/moodle/app/` that names an undeclared table or column, allows declared `storage` tables/columns, passes on the clean tree, and baseline `app.ts` adapters expose P5–P7 ports (`BD-A1-20`, `BD-A1-28`). |
| AC-LA-E1-08-05 | UNIT | ready | Author unit test (`vitest run -t "AC-LA-E1-08-"`) | A publish hook whose `dtoFields` returns a name not in `legacy-wire.ts` is refused; `moodleCourse`, `shellStatus` and `shellError` appear in the publication DTO as before. |
| AC-LA-E1-08-06 | UNIT | ready | Author unit test (`vitest run -t "AC-LA-E1-08-"`) | Frozen paths answer as before (`GET …/canvas-configuration`, `PUT …/web-services`, `POST …/deployments`, `…/mbz`, `…/download?kind=mbz`). |
| AC-LA-E1-08-07 | K1-SIM | pending: Docker window | Lead QA R1 run | R1 (`sim` phase + M2) passes. |
| AC-LA-E1-08-08 | MOODLE-LIVE | pending: Docker window | Lead QA / QA-E2E R2-lite | R2-lite (`T7 × 1` + T8 Moodle-only features) passes. |
| AC-LA-E1-08-09 | K0 | ready | `extensions.k0.test.ts > AC-LA-E1-08-09` | The six removed core files (`canvas-configuration.ts`, `canvas-deployments.ts`, `web-services.ts`, `mbz.ts`, `mbz-builds.ts`, `moodle-ws.ts`) no longer exist, and F1 counts of every core file changed by this task go down or stay (RQ-3). |

## K0 run (AC-04, AC-09; no Docker)

1. Clone the task integration SHA into a new folder outside the repository (`git clone --no-hardlinks --no-checkout`, `git checkout --detach <SHA>`, push URL disabled) and run `npm ci` at the clone root.
2. From the clone root (pass `LA_BASE_SHA=<parent SHA before LA-E1-08>` if the task merge has multiple commits; default is `HEAD~1`):

```sh
LA_LEVEL=k0 LA_SCRATCH_CLONE=$PWD LA_BASE_SHA=<base SHA> LA_RUN_DIR=<new private folder outside the clone> \
  npx --no-install vitest run --config tests/ltiaas/tasks-core/LA-E1-08/vitest.config.mts --reporter=verbose
```

Artifacts in `LA_RUN_DIR` (umask 077): `e1-08-check-clean.log`, `e1-08-ac04-f5-and-ports.json`, `e1-08-ac09-f1-deltas.json`.

## UNIT rows (AC-03, AC-05, AC-06)

In the clone of the task SHA:

```sh
npx --no-install vitest run --reporter=verbose -t "AC-LA-E1-08-"
```

`qa.md` records the passing test names that cite each AC id (`AC-LA-E1-08-03`, `AC-LA-E1-08-05`, `AC-LA-E1-08-06`).

## K1-SIM golden compare (AC-01; pending: Docker window)

1. Booked SIM slot only (after the Lead grants a Docker window): project `qa3-la-sim-r<n>`, `PUBLIC_PORT` 9443, `STACK_SUBNET` 172.20.0.0/16 (TEST-STRATEGY §5.2). Run the LA-E0-03 golden capture at the task SHA (or reuse the Lead QA's R1 golden capture of the same SHA), then stop and remove the stack.
2. No Docker:

```sh
LA_LEVEL=k1sim LA_GOLDEN_CAPTURE=<capture folder> \
  LA_GOLDEN_BASELINE=tests/ltiaas/golden/1b17261be97c4701b928fa9dc2fa74c6d23028f6 \
  LA_RUN_DIR=<private folder> \
  npx --no-install vitest run --config tests/ltiaas/tasks-core/LA-E1-08/vitest.config.mts --reporter=verbose
```
