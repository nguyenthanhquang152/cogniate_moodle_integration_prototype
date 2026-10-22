# LA-E4-05 Worker process mode and the production refusal: QA-3 acceptance tests

Spec: `docs/architecture/ltiaas/tasks/LA-E4-05.md` (at `f01bfcd`). Design: `docs/architecture/ltiaas/adr/LA-ADR-03-learning-record-core.md` D7 (rows Instance id, Worker process; Reviewer-B B-LAD-09); `docs/architecture/ltiaas/operability.md` (topology); `docs/architecture/ltiaas/data-model.md` §3 ("Worker check"); `tests/ltiaas/TEST-STRATEGY.md` §4.6 G3, §8 E4. QA-3 wrote these tests from the spec, contracts and ADRs only (test-first).

| AC | Label | Status | Owner / Test | Oracle |
| --- | --- | --- | --- | --- |
| AC-LA-E4-05-01 | UNIT | ready | `worker.k0.test.ts` + Author unit test (`vitest run -t "AC-LA-E4-05-"`) | With `APP_JOB_RUNNER=off`, the web process serves pages and API and logs no `job_run` line; a score stays `pending`. |
| AC-LA-E4-05-02 | UNIT | ready | `worker.k0.test.ts` + Author unit test (`vitest run -t "AC-LA-E4-05-"`) | `npm run worker` alone (with the web process off) sends the pending score; the row becomes `sent`. |
| AC-LA-E4-05-03 | UNIT | ready | `worker.k0.test.ts` + Author unit test (`vitest run -t "AC-LA-E4-05-"`) | In the `production` profile, a worker start while a live `web` runner row exists (and a web start while a live `worker` row exists) exits 1 with `config_refused {reason: "job_runner_twice"}`. |
| AC-LA-E4-05-04 | UNIT | ready | `worker.k0.test.ts` + Author unit test (`vitest run -t "AC-LA-E4-05-"`) | Two runner processes with distinct instance ids on one database send each due row once (no duplicate score POST in the test LTI client). |
| AC-LA-E4-05-05 | K1-SIM | pending: Docker window | `golden.k1sim.test.ts > AC-LA-E4-05-05` | On the SIM lane with the default settings (runner in the web process), the score rows of the golden script equal the golden G3. |

## K0 and UNIT-row run (AC-01, AC-02, AC-03, AC-04; no Docker)

1. Clone the task integration SHA into a new folder outside the repository (`git clone --no-hardlinks --no-checkout`, `git checkout --detach <SHA>`, push URL disabled) and run `npm ci` at the clone root.
2. From the clone root:

```sh
LA_LEVEL=k0 LA_SCRATCH_CLONE=$PWD LA_RUN_DIR=<new private folder outside the clone> \
  npx --no-install vitest run --config tests/ltiaas/tasks-core/LA-E4-05/vitest.config.mts --reporter=verbose
```

Artifacts in `LA_RUN_DIR` (umask 077): `e4-05-check-clean.log`, `e4-05-unit-rows.log`.

## K1-SIM golden compare (AC-05; pending: Docker window)

1. Booked SIM slot only (after the Lead grants a Docker window): project `qa3-la-sim-r<n>`, `PUBLIC_PORT` 9443, `STACK_SUBNET` 172.20.0.0/16 (TEST-STRATEGY §5.2). Run the LA-E0-03 golden capture at the task SHA (or reuse the Lead QA's R1 golden capture of the same SHA), then stop and remove the stack.
2. No Docker:

```sh
LA_LEVEL=k1sim LA_GOLDEN_CAPTURE=<capture folder> \
  LA_GOLDEN_BASELINE=tests/ltiaas/golden/1b17261be97c4701b928fa9dc2fa74c6d23028f6 \
  LA_EXPECTED_DELTA=LA-IC-15 \
  LA_RUN_DIR=<private folder> \
  npx --no-install vitest run --config tests/ltiaas/tasks-core/LA-E4-05/vitest.config.mts --reporter=verbose
```
