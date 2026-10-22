# LA-E4-03 The `lti-ags` record reporter, throttling and the read-back guard: QA-3 acceptance tests

Spec: `docs/architecture/ltiaas/tasks/LA-E4-03.md` (at `f01bfcd`). Design: `docs/architecture/ltiaas/adr/LA-ADR-03-learning-record-core.md` D5, D6, D7 (`429`, Fairness), D8, D9; `docs/architecture/ltiaas/adr/LA-ADR-04-refactor-and-migration.md` D8 (`LA-IC-11`, `LA-IC-15`); `docs/architecture/ltiaas/contracts/cogniate-app-api-delta.md` §6, §8; `docs/architecture/ltiaas/build-decisions-A1.md` BD-A1-27 (`LA-IC-15` at LA-E4-03); `tests/ltiaas/TEST-STRATEGY.md` §2.4 K1-AGS, §8 E4. QA-3 wrote these tests from the spec, contracts and ADRs only (test-first).

| AC | Label | Status | Owner / Test | Oracle |
| --- | --- | --- | --- | --- |
| AC-LA-E4-03-01 | UNIT | ready | `reporter.k0.test.ts` + Author unit test (`vitest run -t "AC-LA-E4-03-"`) | Mapping table: 2xx → `accepted`; `409` → `conflict` with per-channel `"{LMS} has a grade with a newer time"` (`LA-IC-15` / `BD-A1-27`); `400`, `403`, `404`, `422` → `rejected`; `401`, `5xx`, no answer → `retryable` (`uncertain` only after send began and answer was none or `5xx`); `429` with `PLATFORM_RATE_LIMITED` or `RATE_LIMITED` → `throttled` with `retryAt` from `Retry-After`. |
| AC-LA-E4-03-02 | K1-SIM | pending: Docker window | `reporter.k1sim.test.ts > AC-LA-E4-03-02` | K1-AGS A1–A6 pass on the Moodle-shaped `standard`, Canvas and Blackboard simulator channels (assertion `aud` forms, score body, status mapping including `LA-IC-15` per-channel `409` text, no send for staff preview, no send for a disabled connection, service URLs off the service origin refused). |
| AC-LA-E4-03-03 | K1-SIM | pending: Docker window | `reporter.k1sim.test.ts > AC-LA-E4-03-03` | Simulator answers a score POST with `429` and `Retry-After: 30`: row stays `pending`, try count does not rise, app logs `dispatch_throttled {dispatch_id, partition, retry_at}`, and next score POST to that platform comes >= 30 s later (`/__sim/records` times). |
| AC-LA-E4-03-04 | K1-SIM | pending: Docker window | `reporter.k1sim.test.ts > AC-LA-E4-03-04` | Fairness with transport gate (`hold_before` on score path of platform A): score of platform B is sent before release; two held rows of platform A are forwarded one at a time. |
| AC-LA-E4-03-05 | K1-SIM | pending: Docker window | `reporter.k1sim.test.ts > AC-LA-E4-03-05` | App restart (`npm run stack:restart -- cogniate-app`) while a send is held makes the row uncertain; after release, one confirmation send follows >= 5 s after the first accepted send (T5b P2 rule). |
| AC-LA-E4-03-06 | UNIT | ready | `reporter.k0.test.ts` + Author unit test (`vitest run -t "AC-LA-E4-03-"`) | With a test channel without `records.readBack`, `POST …/results/refresh` gives `409 CAPABILITY_NOT_SUPPORTED` with `details.capability = "records.readBack"`; baseline channels answer as before. |
| AC-LA-E4-03-07 | UNIT | ready | `reporter.k0.test.ts` + Author unit test (`vitest run -t "AC-LA-E4-03-"`) | Disabled `operatorGrant` connection: row becomes `failed` with `CONNECTION_DISABLED` and no POST; Resend and refresh give `409 CONNECTION_NOT_READY`. |
| AC-LA-E4-03-08 | UNIT | ready | `reporter.k0.test.ts` + Author unit test (`vitest run -t "AC-LA-E4-03-"`) | Outbox registration refuses a reporter with a policy other than `bestResult` (`everyRecord` is reserved for LC). |
| AC-LA-E4-03-09 | MOODLE-LIVE | pending: Docker window | Lead QA / QA-E2E Moodle slot | T5a, T5b and T7 × 1 give the baseline results. |

## K0 and UNIT-row run (AC-01, AC-06, AC-07, AC-08; no Docker)

1. Clone the task integration SHA into a new folder outside the repository (`git clone --no-hardlinks --no-checkout`, `git checkout --detach <SHA>`, push URL disabled) and run `npm ci` at the clone root.
2. From the clone root:

```sh
LA_LEVEL=k0 LA_SCRATCH_CLONE=$PWD LA_RUN_DIR=<new private folder outside the clone> \
  npx --no-install vitest run --config tests/ltiaas/tasks-core/LA-E4-03/vitest.config.mts --reporter=verbose
```

Artifacts in `LA_RUN_DIR` (umask 077): `e4-03-check-clean.log`, `e4-03-unit-rows.log`.

## K1-SIM run (AC-02, AC-03, AC-04, AC-05; pending: Docker window)

Booked SIM slot only (after the Lead grants a Docker window): project `qa3-la-sim-r<n>`, `PUBLIC_PORT` 9443, `STACK_SUBNET` 172.20.0.0/16 (TEST-STRATEGY §5.2). Lead QA also updates the G3 expected delta for `LA-IC-15` (`canvas/` and `blackboard/` `publications/B-conflict/results/0/scoreSyncs/0/lastError`).
