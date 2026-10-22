# LA-E1-02 kernel package, baseline manifests and the app registry: QA-3 acceptance tests

Spec: `docs/architecture/ltiaas/tasks/LA-E1-02.md`. Design: `docs/architecture/ltiaas/adr/LA-ADR-01-channel-kernel.md` D1–D4, D10, D11; `docs/architecture/ltiaas/adr/LA-ADR-04-refactor-and-migration.md` D1 S2, D2; `docs/architecture/ltiaas/README.md` §4; `tests/ltiaas/TEST-STRATEGY.md` §2.7, §3.1, §3.5 item 5. QA-3 wrote the tests from these files only (test-first).

| AC | Label | Test | Oracle |
| --- | --- | --- | --- |
| AC-LA-E1-02-01 | K0 | `registry.k0.test.ts > AC-LA-E1-02-01` | Each baseline manifest (`moodle`, `canvas`, `blackboard`) passes the schema, `manifest.id` equals the folder name, and `channels()` returns `['moodle', 'canvas', 'blackboard']` in order. |
| AC-LA-E1-02-02 | K0 | `registry.k0.test.ts > AC-LA-E1-02-02` | `legacyCapabilities(id)` equals the M1 six-flag capability object byte for byte for `moodle`, `canvas` and `blackboard` (cross-checked against G-BASE `G1.json`). |
| AC-LA-E1-02-03 | K0 | `registry.k0.test.ts > AC-LA-E1-02-03` | `ownerOfFamily('canvas') = 'canvas'`, `ownerOfFamily('blackboardlearn') = 'blackboard'`, `ownerOfFamily('moodle') = null`; `textName(null) = 'Moodle'`, `textName('canvas') = 'Canvas'`. |
| AC-LA-E1-02-04 | K0 | `registry.k0.test.ts > AC-LA-E1-02-04` | `loadChannelFolders([<product root>, <QA canary root>], 'app')` plus `buildChannelRegistry` loads the canary channel next to `moodle`, `canvas` and `blackboard`. Uses `tests/ltiaas/canary` when present, else generates a canary root in `LA_RUN_DIR/canary-root/` (outside the clone). |
| AC-LA-E1-02-05 | UNIT | Author unit test | Each load check built in this task (1–4, 6, 8) has a failing case that throws `RegistryError` with that check number and stops the app start with one `channel_registry_invalid {channel, reason}` line. |
| AC-LA-E1-02-06 | UNIT | Author unit test | App start calls the loader with one constant root; candidate environment variables, knobs or settings add no root and no extra channel. |
| AC-LA-E1-02-07 | DOC | `registry.k0.test.ts > AC-LA-E1-02-07 (DOC)` | `packages/channel-kernel/fitness-scope.json` lists the same classes and globs as `docs/architecture/ltiaas/README.md` §4 (`e1-02-ac07-fitness-scope.json`). |
| AC-LA-E1-02-08 | K0 | `registry.k0.test.ts > AC-LA-E1-02-08` | `npm run check` runs the K0 suite through the new root script line and exits 0 (`e1-02-check-clean.log`). |
| AC-LA-E1-02-09 | K1-SIM | `golden-g1.k1sim.test.ts > AC-LA-E1-02-09` | Golden G1 (`GET /app-api/lms-providers`, connection DTOs) equals the G-BASE baseline (through `../LA-E1-01/golden-binding.ts`). |
| AC-LA-E1-02-10 | K0 | `registry.k0.test.ts > AC-LA-E1-02-10` | `npm query .workspace` lists `packages/channel-kernel` and no path under `packages/channels/` (`e1-02-ac10-workspaces.json`). |
| AC-LA-E1-02-11 | UNIT | Author unit test | Authority rules (AP-07-07, AP-07-08, AP-07-10): `sharing: shared` with `self` fails (`shared_platform_self_authority`); authority outside `self` and `operatorGrant` (including reserved `verifiedAdminLaunch`) fails load check 1; non-legacy channel with `manual` → `self` fails (`manual_self_authority`); baseline `moodle` loads. |

## K0 and DOC run (no Docker)

1. Clone the task integration SHA into a new folder outside the repository (`git clone --no-hardlinks --no-checkout`, `git checkout --detach <SHA>`, push URL disabled) and run `npm ci` at the clone root.
2. From the clone root:

```sh
LA_LEVEL=k0 LA_SCRATCH_CLONE=$PWD LA_RUN_DIR=<new private folder outside the clone> \
  npx --no-install vitest run --config tests/ltiaas/tasks-core/LA-E1-02/vitest.config.mts
```

Artifacts in `LA_RUN_DIR` (umask 077): `e1-02-check-clean.log`, `e1-02-ac01-channels.json`, `e1-02-ac02-legacy-capabilities.json`, `e1-02-ac04-canary.json`, `e1-02-ac07-fitness-scope.json`, `e1-02-ac10-workspaces.json`.

## UNIT rows (AC-05, AC-06, AC-11)

In the clone of the task SHA:

```sh
npx --no-install vitest run --reporter=verbose -t "AC-LA-E1-02-"
```

qa.md records the passing test names that cite each AC id (`AC-LA-E1-02-05`, `AC-LA-E1-02-06`, `AC-LA-E1-02-11`). If no test name cites an AC id, qa.md says so, and Reviewer-B maps the test.

## K1-SIM golden compare (AC-09)

1. Booked SIM slot only (after the Lead grants a Docker window): project `qa3-la-sim-r<n>`, `PUBLIC_PORT` 9443, `STACK_SUBNET` 172.20.0.0/16 (TEST-STRATEGY §5.2). Run the LA-E0-03 golden capture at the task SHA, then stop and remove the stack.
2. No Docker:

```sh
LA_LEVEL=k1sim LA_GOLDEN_CAPTURE=<capture folder> \
  LA_GOLDEN_BASELINE=tests/ltiaas/golden/1b17261be97c4701b928fa9dc2fa74c6d23028f6 \
  LA_RUN_DIR=<private folder> \
  npx --no-install vitest run --config tests/ltiaas/tasks-core/LA-E1-02/vitest.config.mts
```
