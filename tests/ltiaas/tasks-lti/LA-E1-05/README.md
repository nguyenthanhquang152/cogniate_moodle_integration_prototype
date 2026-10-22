# LA-E1-05 S3 LTI profiles into the channel folders: QA-4 acceptance tests

Spec: `docs/architecture/ltiaas/tasks/LA-E1-05.md`. Design: `docs/architecture/ltiaas/adr/LA-ADR-01-channel-kernel.md` D4, D6, D11; `docs/architecture/ltiaas/adr/LA-ADR-04-refactor-and-migration.md` D1 S3, D8 (LA-IC-02); `docs/architecture/contracts/lti-service-api.md` §3.1, §3.8, §9.6, §9.13; `tests/ltiaas/TEST-STRATEGY.md` §3.2, §3.4, §3.6, §4.6. QA-4 wrote these tests from the spec, contracts and ADRs only (test-first).

| AC | Label | Owner / Test | Oracle |
| --- | --- | --- | --- |
| AC-LA-E1-05-01 | K1-SIM | `profiles.k1sim.test.ts > AC-LA-E1-05-01` | Golden G1 `GET /api/providers` equals the baseline in values and order (`standard`, the four Canvas profiles, `blackboard`, then `blackboard-sim`, `canvas-sim-cloud`). |
| AC-LA-E1-05-02 | K0 | `profiles.k0.test.ts > AC-LA-E1-05-02` | Through `services/lti-service/src/profiles/index.ts` (`listProfiles`, `findProfile`, `profileDefinition`) and `@cogniate/channel-kernel` (`PRIVACY_FLOOR_NONE_PROFILES`, `BASELINE_PROFILE_WIRE_LMS`, `loadChannelFolders`), each baseline profile has `endpoints`: `'admin'` (`standard`) or `'fixed'` (others); `privacyFloor`: `'none'` (`standard` only, `BD-A2-21`) or `'allowlist'` (others); `wireLms`: `null` (`standard`), `'canvas'`, or `'blackboard'`; `listOrder` integer with maximum baseline bound `70` (`BD-A1-23`); and `ProfileSource` kernel type (`BD-A1-21`). Simulation profiles exist only with simulations on. |
| AC-LA-E1-05-03 | UNIT | Author unit test | Check 14 refuses family `canvas` on a non-Canvas platform and `blackboardlearn` on a non-Blackboard platform with `PROVIDER_PROFILE_MISMATCH` (`detail family=<F>`); family `moodle`, an unknown family and no family pass. |
| AC-LA-E1-05-04 | UNIT | Author unit test | With a test registry that guards a family at the `registration` level: a launch with that family on a `standard` platform (`MANUAL_SELF_LEGACY_CHANNELS`) is refused (`PROVIDER_PROFILE_MISMATCH`) before storage; on another profile it passes and logs `family_guard_mismatch {platform_id, family}` at info level. |
| AC-LA-E1-05-05 | UNIT | Author unit test | Load check 7 (`BD-A1-06`, `BD-A2-21`, `BD-A1-23`) and load check 2: unknown trait/flag, source-supplied owner, invalid/non-standard `privacyFloor: 'none'`, invalid `wireLms`, new profile `listOrder <= 70`, duplicate profile id, or missing registration profile stops start with `channel_registry_invalid`. |
| AC-LA-E1-05-06 | UNIT | Author unit test | Text names: `lmsNameOf` and `lmsNameOfFamily` give today's values for every baseline profile and family; an unknown family gives `null` as today. |
| AC-LA-E1-05-07 | K1-SIM | `profiles.k1sim.test.ts > AC-LA-E1-05-07` | The LTI service starts and serves a Moodle-shaped launch with `PUBLIC_MOODLE_URL` absent from its environment, and `/healthz` equals the golden (LA-IC-02: the allowlist still comes from `MOODLE_HOST`). |
| AC-LA-E1-05-08 | K1-SIM | `profiles.k1sim.test.ts > AC-LA-E1-05-08` | Stored claims of a Canvas and a Blackboard simulator launch equal the golden G2 (`privacyFloor: 'allowlist'`); a Moodle-shaped launch keeps every claim (`privacyFloor: 'none'`). |
| AC-LA-E1-05-09 | K1-SIM | `profiles.k1sim.test.ts > AC-LA-E1-05-09` + Lead QA R1 run | R1: M1 `sim` phase and M2 give the baseline result per test id; the golden compare is equal. |
| AC-LA-E1-05-10 | MOODLE-LIVE | Lead QA / QA-E2E R2-lite run | R2-lite: T7 × 1 and the group "LTI service launch, profiles, platform calls, protocol routes" (`T2a,T2b,T3a,T3b,T3c`) give the baseline results. |
| AC-LA-E1-05-11 | K0 | `profiles.k0.test.ts > AC-LA-E1-05-11` | `packages/shared/src/config.ts` has F1 count 0; the F1 counts of every file of this task go down or stay (RQ-3). |

## K0 run (AC-02, AC-11; no Docker)

1. Clone the task integration SHA into a new folder outside the repository (`git clone --no-hardlinks`), checkout the task SHA, and run `npm ci`.
2. From the clone root:

```sh
LA_LEVEL=k0 QA_REPO_ROOT=$PWD LA_BASE_SHA=<base SHA> LA_RUN_DIR=<private run folder> \
  npx --prefix /Users/quangnguyen/orca/workspaces/cogniate_moodle_integration_prototype/la-qa/tests \
  vitest run --config /Users/quangnguyen/orca/workspaces/cogniate_moodle_integration_prototype/la-qa/tests/ltiaas/tasks-lti/LA-E1-05/vitest.config.mts
```

Artifacts in `LA_RUN_DIR` (umask 077): `e1-05-ac02-traits.json`, `e1-05-ac11-f1-deltas.json`.

## UNIT rows (AC-03, AC-04, AC-05, AC-06; no Docker)

In the clone of the task SHA:

```sh
npx vitest run --reporter=verbose -t "AC-LA-E1-05-0[3-6]"
```

## K1-SIM run (AC-01, AC-07, AC-08, AC-09; SIM slot only)

Booked SIM slot only (after the Lead grants a Docker window): compose project `qa4-la-sim-r<n>`, `PUBLIC_PORT=9443`, `STACK_SUBNET=172.20.0.0/16` (`docs/architecture/ltiaas/tasks/README.md` §2).

1. Start the acceptance stack in the task clone (`STACK_PROFILE=acceptance COMPOSE_PROJECT_NAME=qa4-la-sim-r<n> PUBLIC_PORT=9443 STACK_SUBNET=172.20.0.0/16 npm run gen-env && STACK_PROFILE=acceptance npm run stack:up && npm run seed && npm run seed:lti-manual`).
2. For `AC-LA-E1-05-07`, recreate `lti-service` with `PUBLIC_MOODLE_URL` absent from its environment via `.tmp/compose.knobs.yaml` (`{"services":{"lti-service":{"environment":{"PUBLIC_MOODLE_URL":null}}}}`) and wait for `lti-service` health.
3. Run the K1-SIM suite inside the `e2e` container (`docs/architecture/ltiaas/tasks/README.md` §2 form (f)):

```sh
COMPOSE_PROJECT_NAME=qa4-la-sim-r<n> docker compose --project-directory infra -p qa4-la-sim-r<n> \
  -f infra/compose.yaml --env-file .env --profile test run --rm -T \
  -e QA_PRODUCT_SHA=<sha> -e QA_TEST_SHA=<qa-sha> -e LA_LEVEL=k1sim \
  e2e npx --prefix /repo/tests vitest run \
  --config /repo/tests/ltiaas/tasks-lti/LA-E1-05/vitest.config.mts
```

4. Stop and remove the `qa4-la-sim-r<n>` stack (`npm run stack:down` and remove project volumes).
