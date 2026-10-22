# LA-E1-06 migration 013 and the channel and authority reads: QA-3 acceptance tests

Spec: `docs/architecture/ltiaas/tasks/LA-E1-06.md`. Design: `docs/architecture/ltiaas/adr/LA-ADR-04-refactor-and-migration.md` D4 (rules 1–6), D1 S4, D8 (LA-IC-01); `docs/architecture/ltiaas/adr/LA-ADR-01-channel-kernel.md` D7, D11; `docs/architecture/ltiaas/data-model.md` §2; `docs/architecture/ltiaas/contracts/cogniate-app-api-delta.md` §1, §2; `tests/ltiaas/TEST-STRATEGY.md` §3.6, §4.5, §4.6, §4.7. QA-3 wrote the tests from these files only (test-first).

| AC | Label | Owner / Test | Oracle |
| --- | --- | --- | --- |
| AC-LA-E1-06-01 | UNIT | Author unit test | Migration test on a copy of every M1 fixture database: `connection.channel = lms`; `binding_authority` is `self` (`moodle`) or `operatorGrant` (`canvas`, `blackboard`); `binding_attempt.target_kind` is `exclusive_platform` (Canvas `initial`), `platform_deployment` (Canvas `add_deployment`) or `shared_deployment` (Blackboard); `binding_grant.bound_values` is `NULL`. |
| AC-LA-E1-06-02 | UNIT | Author unit test | A build from before migration `013` refuses a database whose ledger has it (ADR-011 §1 fact 4). |
| AC-LA-E1-06-03 | UNIT | Author unit test | Writer rules: baseline connection writes `lms` = channel id; test channels write behaviour class (`self` → `moodle`, `operatorGrant` exclusive → `canvas`, `operatorGrant` shared → `blackboard`); update never changes `channel`. |
| AC-LA-E1-06-04 | K0 | `migration-013.k0.test.ts > AC-LA-E1-06-04` | F5 `connection-lms`: probe SQL texts outside `services/cogniate-app/src/domain/connections.ts` that read `lms` of `connection` fail `fitness:rules -- --stdin --as <path>`; the connection repository and the clean tree pass. |
| AC-LA-E1-06-05 | K1-SIM | `golden-g1.k1sim.test.ts > AC-LA-E1-06-05` | Connection DTOs and `GET /app-api/lms-providers` entries show `channel`, `channelName` and `channelCapabilities` with the baseline values, and every baseline field equals the G-BASE golden under expected delta `LA-IC-01`. |
| AC-LA-E1-06-06 | UNIT | Author unit test | Routing and the disabled rule use stored `binding_authority`, not channel id: test channel `zz-test` with `operatorGrant` routes by `approved_deployment` and a disabled one fails its score row with `CONNECTION_DISABLED` and no POST; `self` routes by `lti_platform_id` and sends. |
| AC-LA-E1-06-07 | K1-SIM | Lead QA R1 run (tasks README §2) | M1 `sim` phase (394 rows) and M2 (64 cases) give the baseline result per test id. |
| AC-LA-E1-06-08 | K1-SIM | Lead QA migration phases + U1 (tasks README §2) | M1 `migration` and `snapshot-upgrade` phases give the baseline results, and U1 (TEST-STRATEGY §4.5) passes. |
| AC-LA-E1-06-09 | K0 | `migration-013.k0.test.ts > AC-LA-E1-06-09` | F1 counts of every core file changed by this task go down or stay (RQ-3), and the full F5 run (with `connection-lms`) exits 0 with 0 hits on the clean tree. |

## K0 run (AC-04, AC-09; no Docker)

1. Clone the task integration SHA into a new folder outside the repository (`git clone --no-hardlinks --no-checkout`, `git checkout --detach <SHA>`, push URL disabled) and run `npm ci` at the clone root.
2. From the clone root (pass `LA_BASE_SHA=<parent SHA before LA-E1-06>` if the task merge has multiple commits; default is `HEAD~1`):

```sh
LA_LEVEL=k0 LA_SCRATCH_CLONE=$PWD LA_BASE_SHA=<base SHA> LA_RUN_DIR=<new private folder outside the clone> \
  npx --no-install vitest run --config tests/ltiaas/tasks-core/LA-E1-06/vitest.config.mts
```

Artifacts in `LA_RUN_DIR` (umask 077): `e1-06-check-clean.log`, `e1-06-f5-clean.log`, `e1-06-ac04-connection-lms.log`, `e1-06-ac09-f1-deltas.json`.

## UNIT rows (AC-01, AC-02, AC-03, AC-06)

In the clone of the task SHA:

```sh
npx --no-install vitest run --reporter=verbose -t "AC-LA-E1-06-"
```

qa.md records the passing test names that cite each AC id (`AC-LA-E1-06-01`, `AC-LA-E1-06-02`, `AC-LA-E1-06-03`, `AC-LA-E1-06-06`). If no test name cites an AC id, qa.md says so, and Reviewer-B maps the test.

## K1-SIM golden compare (AC-05)

1. Booked SIM slot only (after the Lead grants a Docker window): project `qa3-la-sim-r<n>`, `PUBLIC_PORT` 9443, `STACK_SUBNET` 172.20.0.0/16 (TEST-STRATEGY §5.2). Run the LA-E0-03 golden capture at the task SHA (or reuse the Lead QA's R1 golden capture of the same SHA), then stop and remove the stack.
2. No Docker:

```sh
LA_LEVEL=k1sim LA_GOLDEN_CAPTURE=<capture folder> \
  LA_GOLDEN_BASELINE=tests/ltiaas/golden/1b17261be97c4701b928fa9dc2fa74c6d23028f6 \
  LA_EXPECTED_DELTA=tests/ltiaas/golden/expected/LA-IC-01.json \
  LA_RUN_DIR=<private folder> \
  npx --no-install vitest run --config tests/ltiaas/tasks-core/LA-E1-06/vitest.config.mts
```
