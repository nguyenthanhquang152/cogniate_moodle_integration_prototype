# LA-E5-23 Async store port in the LTI service: QA-2 acceptance tests

Spec: `docs/architecture/ltiaas/tasks/LA-E5-23.md`. Design: `docs/architecture/ltiaas/adr/LA-ADR-06-service-operability.md` D4 (T0–T2), D13 (items 1–4); `docs/architecture/ltiaas/build-decisions-A2.md` §48 (`BD-A2-96`). QA-2 wrote these tests from the spec, contracts, ADRs and infra rules.

## AC map

| AC | Test / Runner | Label | Status | What it checks |
| --- | --- | --- | --- | --- |
| `AC-LA-E5-23-01` | `async-store.k0.test.ts` + `services/lti-service/src/store/port-boundary.test.ts` | `UNIT` + `K0` | ready (no Docker) | No production file outside `services/lti-service/src/store/**` and `services/lti-service/src/db/**` calls the database handle (`prepare`, `exec`, `transaction`, `afterCommit`), imports `node:sqlite` / `DatabaseSync`, imports synchronous `Db`-first-parameter store functions, or embeds raw SQL; excludes `*.test.ts` and `testkit*.ts`; a planted call in a scratch file outside `store/**` is detected and fails both the QA boundary scanner and `store/port-boundary.test.ts`. Also verifies atomic audited store operations (`LA-ADR-06` D13 item 3 & D4 T0–T2, `BD-A2-96`): a failure after the data change rolls back the change, the `audit_event` row, and `afterCommit` callbacks together. |
| `AC-LA-E5-23-02` | `async-store.k0.test.ts` + `npm run fitness:rules` + `fitness-sql-portability.test.mjs` + `fitness-audit-event-delete.test.mjs` | `UNIT` + `K0` | ready (no Docker) | All 6 F5 rules pass with 0 hits; `sql-portability` passes for every SQL statement and migration file in LA and fails for probes with `rowid`, `X''`, and SQLite date functions; `audit-event-delete` allows `DELETE FROM audit_event` only at `services/lti-service/src/store/audit-retention.ts` and rejects it at `jobs/audit-retention.ts` and `store/audit.ts`. |
| `AC-LA-E5-23-03` | `async-store.k0.test.ts` + `services/lti-service/src/store/port-boundary.test.ts` | `UNIT` + `K0` | ready (no Docker) | `services/lti-service/src/store/index.ts` lists the four in-memory states of `LA-ADR-06` D13 item 4 (`score clock`, `platform token cache`, `platform JWKS cache`, `rate-limit buckets`). |
| `AC-LA-E5-23-04` | SIM slot R2 regression (`T2a`, `T2b`, `T3a`, `T3b`, `T3c` + goldens `G1–G4`) | `K1-SIM` | `pending: Docker window` | LTI service suites `T2a`, `T2b`, `T3a`, `T3b` and `T3c` pass unchanged, and goldens `G1–G4` are equal. |

## Host-only K0 and UNIT checks (no Docker)

In a clean clone of the integration SHA (`rm -rf node_modules/.vitest-cache` before every Vitest run):

```sh
npx --prefix tests tsc --noEmit -p tests/ltiaas/tasks-ops/LA-E5-23/tsconfig.json
rm -rf node_modules/.vitest-cache
LA_LEVEL=k0 LA_SCRATCH_CLONE="$PWD" LA_RUN_DIR=~/cogniate-qa-runs/LA/LA-E5-23/r1/evidence \
  ./tests/node_modules/.bin/vitest run -c tests/ltiaas/tasks-ops/LA-E5-23/vitest.config.mts --reporter=verbose
```
