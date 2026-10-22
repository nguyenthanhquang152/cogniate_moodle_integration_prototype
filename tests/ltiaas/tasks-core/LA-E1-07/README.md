# LA-E1-07 ConnectionSetup port, authority strategies and baseline channel `app.ts`: QA-3 acceptance tests

Spec: `docs/architecture/ltiaas/tasks/LA-E1-07.md`. Design: `docs/architecture/ltiaas/adr/LA-ADR-01-channel-kernel.md` D1, D5, D6, D7, D9; `docs/architecture/ltiaas/adr/LA-ADR-07-security-and-tenancy.md` D2; `docs/architecture/ltiaas/contracts/cogniate-app-api-delta.md` §2, §7; `tests/ltiaas/TEST-STRATEGY.md` §2.3, §2.7, §3.2, §4.6, §4.7. QA-3 wrote these tests from the spec and design only (test-first).

| AC | Label | Status | Owner / Test | Oracle |
| --- | --- | --- | --- | --- |
| AC-LA-E1-07-01 | K0 | ready | `setup.k0.test.ts > AC-LA-E1-07-01` | K-ADAPTER for each baseline channel (`moodle`, `canvas`, `blackboard`): `toolConfiguration` rows equal the G1 golden rows; strict `parseBindingBody` refuses one unknown field and one missing field; `initialTarget` target kind is `exclusive_platform` (Canvas) or `shared_deployment` (Blackboard); only Moodle has `selfCreate`. |
| AC-LA-E1-07-02 | K0 | ready | `setup.k0.test.ts > AC-LA-E1-07-02` | Each baseline `app.ts` runs with a database stub and an LTI client stub that throw on any access, and every `ConnectionSetup` port call succeeds with no database call and no LTI call. |
| AC-LA-E1-07-03 | K0 | ready | `setup.k0.test.ts > AC-LA-E1-07-03` | `services/cogniate-app/src/kernel/ports.ts` exists, contains only types (AST check + 0 runtime exports), and a QA file that type-imports `ConnectionSetup`, `PortContext` and `ChannelSql` compiles under `tsc --noEmit`. |
| AC-LA-E1-07-04 | UNIT | ready | Author unit test (`services/cogniate-app/src/kernel/authority.test.ts`) | The strategy follows the stored authority, never the channel id: a test channel `zz-test` with `operatorGrant` binds by the two-phase redemption and is fenced out on disconnect; with `self` it binds without a grant, and disconnect sets `active: false` unconditionally. |
| AC-LA-E1-07-05 | UNIT | ready | Author unit test (`services/cogniate-app/src/kernel/authority.test.ts`) | `app:grant issue` on a `self` connection exits 1 and stores nothing; on an `operatorGrant` connection of a test channel it issues a code; `--purpose add_deployment` on a channel without `deployments.multiple` exits 1. |
| AC-LA-E1-07-06 | UNIT | ready | Author unit test (`services/cogniate-app/src/kernel/launch-router.test.ts`) | App LMS check: a profile whose channel is not the connection's channel is refused with log reason `lms_mismatch` and `connection_lms` = the channel id; a signed family guarded at the `launch` level by another channel is refused; a `registration`-level family is refused only on a platform of a `MANUAL_SELF_LEGACY_CHANNELS` channel, and otherwise only logged as `family_guard_mismatch`. |
| AC-LA-E1-07-07 | K1-SIM | pending: Docker window | `golden.k1sim.test.ts > AC-LA-E1-07-07` + Lead QA R1 run | R1 (M1 `sim` phase + M2) and golden G1, G3 and G4 equal the G-BASE baseline except for the `LA-IC-01` fields. |
| AC-LA-E1-07-08 | MOODLE-LIVE | pending: Docker window | Lead QA / QA-E2E R2-lite | R2-lite (`T7 × 1` and `T4b1`, `T4b2`) passes. |
| AC-LA-E1-07-09 | K0 | ready | `setup.k0.test.ts > AC-LA-E1-07-09` | `services/cogniate-app/src/providers/` no longer exists, and F1 counts of every core file changed by this task go down or stay (RQ-3). |
| AC-LA-E1-07-10 | UNIT | ready | Author unit test (`vitest run -t "AC-LA-E1-07-"`) | (`BD-A1-12`, `BD-A1-29`) For every profile in a channel's `app.ts` `profiles`, the profile exists in the same channel's `lti-profiles.ts`, and `sharing`, `serviceUrl` and `refusedHostSuffixes` equal its data; every manifest registration profile has an entry; a probe with a different value fails the test. |

## K0 run (AC-01, AC-02, AC-03, AC-09; no Docker)

1. Clone the task integration SHA into a new folder outside the repository (`git clone --no-hardlinks --no-checkout`, `git checkout --detach <SHA>`, push URL disabled) and run `npm ci` at the clone root.
2. From the clone root (pass `LA_BASE_SHA=<parent SHA before LA-E1-07>` if the task merge has multiple commits; default is `HEAD~1`):

```sh
LA_LEVEL=k0 LA_SCRATCH_CLONE=$PWD LA_BASE_SHA=<base SHA> LA_RUN_DIR=<new private folder outside the clone> \
  npx --no-install vitest run --config tests/ltiaas/tasks-core/LA-E1-07/vitest.config.mts --reporter=verbose
```

Artifacts in `LA_RUN_DIR` (umask 077): `e1-07-check-clean.log`, `e1-07-ac01-k-adapter.json`, `e1-07-ac02-no-db-no-lti.log`, `e1-07-ac03-ports-typecheck.log`, `e1-07-ac09-f1-deltas.json`.

## UNIT rows (AC-04, AC-05, AC-06, AC-10)

In the clone of the task SHA:

```sh
npx --no-install vitest run --reporter=verbose -t "AC-LA-E1-07-"
```

qa.md records the passing test names that cite each AC id (`AC-LA-E1-07-04`, `AC-LA-E1-07-05`, `AC-LA-E1-07-06`, `AC-LA-E1-07-10`).

## K1-SIM golden compare (AC-07; pending: Docker window)

1. Booked SIM slot only (after the Lead grants a Docker window): project `qa3-la-sim-r<n>`, `PUBLIC_PORT` 9443, `STACK_SUBNET` 172.20.0.0/16 (TEST-STRATEGY §5.2). Run the LA-E0-03 golden capture at the task SHA (or reuse the Lead QA's R1 golden capture of the same SHA), then stop and remove the stack.
2. No Docker:

```sh
LA_LEVEL=k1sim LA_GOLDEN_CAPTURE=<capture folder> \
  LA_GOLDEN_BASELINE=tests/ltiaas/golden/1b17261be97c4701b928fa9dc2fa74c6d23028f6 \
  LA_EXPECTED_DELTA=tests/ltiaas/golden/expected/LA-IC-01.json \
  LA_RUN_DIR=<private folder> \
  npx --no-install vitest run --config tests/ltiaas/tasks-core/LA-E1-07/vitest.config.mts --reporter=verbose
```
