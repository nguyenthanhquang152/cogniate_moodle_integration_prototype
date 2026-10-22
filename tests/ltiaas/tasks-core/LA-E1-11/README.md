# LA-E1-11 Portal shell, portal SDK and channel portal modules: QA-3 acceptance tests

Spec: `docs/architecture/ltiaas/tasks/LA-E1-11.md`. Design: `docs/architecture/ltiaas/adr/LA-ADR-01-channel-kernel.md` D1, D5, D8; `docs/architecture/ltiaas/README.md` §4, §5; `tests/ltiaas/TEST-STRATEGY.md` §2.4 (K2 U1, U2), §3.2, §3.4, §3.5. QA-3 wrote these tests from the spec and design only (test-first).

| AC | Label | Status | Owner / Test | Oracle |
| --- | --- | --- | --- | --- |
| AC-LA-E1-11-01 | UNIT | ready | Author unit test (`vitest run -t "AC-LA-E1-11-"`) | A registry with a new test channel `zz-test` renders a card for `zz-test` on the Integrations page with `manifest.card.title`, `description`, `mark` and `color` and a working `/integrations/zz-test/connect` route, with no edit of a portal core file. |
| AC-LA-E1-11-02 | UNIT | ready | Author unit test (`vitest run -t "AC-LA-E1-11-"`) | On a `zz-test` connection with no `portal/` module, the generic wizard renders `manifest.setup.createFields`, `bindingFields` and `texts.adminSteps`. |
| AC-LA-E1-11-03 | UNIT | ready | Author unit test (`vitest run -t "AC-LA-E1-11-"`) | The publish dialog shows the course-shell option only when `channelCapabilities['publish.createCourse']` is true, and the package view shows the `.mbz` export only when `channelCapabilities['export.packages']` has `"mbz"`. |
| AC-LA-E1-11-04 | K2 | pending: Docker window | QA-E2E U1 | One Integrations card per registered channel, rendered from the manifest (browser test U1). |
| AC-LA-E1-11-05 | K2 | pending: Docker window | QA-E2E U2 | The setup wizard steps "show, collect, verify, enable" from the manifest (browser test U2). |
| AC-LA-E1-11-06 | K1-SIM | pending: Docker window | Lead QA R1 + T6 subset | R1 (M1 `sim` phase + M2) and the portal subset of T6 pass. |
| AC-LA-E1-11-07 | K0 | ready | `portal-shell.k0.test.ts > AC-LA-E1-11-07` | `npm run build -w apps/portal` passes, and the built CSS contains a utility class used in `packages/channels/moodle/portal/**` (plus a unique probe class placed only in `packages/channels/moodle/portal/`). |
| AC-LA-E1-11-08 | K0 | ready | `portal-shell.k0.test.ts > AC-LA-E1-11-08` | F3: the clean tree has 0 ESLint errors on `packages/channels/*/portal/**` (no import into portal code outside `apps/portal/src/sdk/`), and the LA-E1-03 probe (5) still fails. |
| AC-LA-E1-11-09 | K0 | ready | `portal-shell.k0.test.ts > AC-LA-E1-11-09` | `apps/portal/src/connect/canvas/`, `apps/portal/src/connect/blackboard/`, `MoodleSteps.tsx`, `MoodleBackup.tsx`, `MoodleCourse.tsx` and `WebServices.tsx` no longer exist in core; the Moodle-only ready rule in `apps/portal/src/Integrations.tsx` is gone; and F1 counts of the portal files go down or stay (RQ-3). |

## K0 run (AC-07, AC-08, AC-09; no Docker)

1. Clone the task integration SHA into a new folder outside the repository (`git clone --no-hardlinks --no-checkout`, `git checkout --detach <SHA>`, push URL disabled) and run `npm ci` at the clone root.
2. From the clone root (pass `LA_BASE_SHA=<parent SHA before LA-E1-11>` if the task merge has multiple commits; default is `HEAD~1`):

```sh
LA_LEVEL=k0 LA_SCRATCH_CLONE=$PWD LA_BASE_SHA=<base SHA> LA_RUN_DIR=<new private folder outside the clone> \
  npx --no-install vitest run --config tests/ltiaas/tasks-core/LA-E1-11/vitest.config.mts --reporter=verbose
```

Artifacts in `LA_RUN_DIR` (umask 077): `e1-11-check-clean.log`, `e1-11-ac07-portal-build.log`, `e1-11-ac08-eslint-portal.json`, `e1-11-ac08-probe5.json`, `e1-11-ac09-f1-deltas.json`.

## UNIT rows (AC-01, AC-02, AC-03)

In the clone of the task SHA:

```sh
npx --no-install vitest run --reporter=verbose -t "AC-LA-E1-11-"
```

qa.md records the passing test names that cite each AC id (`AC-LA-E1-11-01`, `AC-LA-E1-11-02`, `AC-LA-E1-11-03`).

## K1-SIM and K2 rows (AC-04, AC-05, AC-06; pending: Docker window)

- `AC-LA-E1-11-04` (`K2` U1) and `AC-LA-E1-11-05` (`K2` U2): run by QA-E2E on a booked Docker slot (`tests/ltiaas/TEST-STRATEGY.md` §2.4).
- `AC-LA-E1-11-06` (`K1-SIM`): R1 (`sim` phase + M2) and the portal subset of T6, run by Lead QA on a booked SIM Docker slot (`docs/architecture/ltiaas/tasks/README.md` §2).
