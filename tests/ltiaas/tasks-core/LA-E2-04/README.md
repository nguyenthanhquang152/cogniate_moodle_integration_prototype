# LA-E2-04 Grant bound values, staged registration in the app and operator CLI flags: QA-3 acceptance tests

Spec: `docs/architecture/ltiaas/tasks/LA-E2-04.md`. Design: `docs/architecture/ltiaas/adr/LA-ADR-02-generic-lti-channel.md` D2a, D5 item 10, D6; `docs/architecture/ltiaas/adr/LA-ADR-04-refactor-and-migration.md` D4 rules 1, 5; `docs/architecture/ltiaas/contracts/cogniate-app-api-delta.md` §3.4, §5, §7; `docs/architecture/ltiaas/data-model.md` §2; `docs/architecture/ltiaas/build-decisions-A1.md` BD-A1-59, BD-A1-79, BD-A1-87, BD-A1-90..92; `tests/ltiaas/TEST-STRATEGY.md` §2, §8 E2. QA-3 wrote these tests from the spec, contracts and ADRs only (test-first).

| AC | Label | Status | Owner / Test | Oracle |
| --- | --- | --- | --- | --- |
| AC-LA-E2-04-01 | UNIT | ready | `grant-staged.k0.test.ts` + Author unit test (`vitest run -t "AC-LA-E2-04-"`) | `app:grant issue` on an admin-value connection with no staged platform and without `--issuer`, `--auth-url`, `--token-url` or `--jwks-url` exits 1 and stores nothing (`bound_values_missing`); the same flags on a fixed-endpoint (Canvas) connection exit 1 (`bound_values_not_allowed`). |
| AC-LA-E2-04-02 | UNIT | ready | `grant-staged.k0.test.ts` + Author unit test (`vitest run -t "AC-LA-E2-04-"`) | The CLI prints the bound values before the code and marks each value whose host is not the issuer host; without `--confirm-foreign-hosts` it then exits 1 and stores nothing (`foreign_hosts_unconfirmed`); with it the grant row has `bound_values`. |
| AC-LA-E2-04-03 | K1-SIM | pending: Docker window | `grant-staged.k1sim.test.ts > AC-LA-E2-04-03` | Redemption of a manual `lti-generic` connection: a body whose `jwksUrl` differs from the grant gives `422 GRANT_MISMATCH` with `details.fields = ["jwksUrl"]`; equal values give `200`, status `registered` and an active platform. |
| AC-LA-E2-04-04 | K1-SIM | pending: Docker window | `grant-staged.k1sim.test.ts > AC-LA-E2-04-04` | Staged registration end to end: after an I-SELF-breaking DR, the connection DTO shows authority `operatorGrant` and status `pending`, `/tool/register` shows "Done. Cogniate checks this connection before it works. Ask your Cogniate operator for the approval code."; `app:grant issue --accept-staged` prints the staged values; the redemption with `{clientId, deploymentId, grantCode}` activates the staged platform with no new platform create; a learner launch then works and its score is sent. |
| AC-LA-E2-04-05 | UNIT | ready | `grant-staged.k0.test.ts` + Author unit test (`vitest run -t "AC-LA-E2-04-"`) | Writer test (LA-ADR-04 D4 rule 5 / BD-A1-90): the staged DR leaves `binding_authority = 'operatorGrant'` and `lms = 'canvas'`, written in the same transaction as the staged platform record (`stageRegistration` in `domain/connections.ts`). |
| AC-LA-E2-04-06 | UNIT | ready | `grant-staged.k0.test.ts` + Author unit test (`vitest run -t "AC-LA-E2-04-"`) | `--accept-staged` on a connection without a staged platform exits 1 and stores nothing (`not_staged`). |
| AC-LA-E2-04-07 | UNIT | ready | `grant-staged.k0.test.ts` + Author unit test (`vitest run -t "AC-LA-E2-04-"`) | `app:grant list` prints the bound values; `app:binding suspend` and `release` pick the record kind from the stored `target_kind`. |
| AC-LA-E2-04-08 | K1-SIM | pending: Docker window | `grant-staged.k1sim.test.ts > AC-LA-E2-04-08` + Lead QA / QA-3 K1 kit | Full kit for `lti-generic` on the generic simulator provider: K1-LAUNCH, K1-DL, K1-AGS (assertion `aud` from `{platformValue}`), K1-NRPS, K1-REG R1–R6 and K1-CAP pass under the pass rule of TEST-STRATEGY §2.6. |

## K0 and UNIT-row run (AC-01, AC-02, AC-05, AC-06, AC-07; no Docker)

1. Clone the task integration SHA into a new folder outside the repository (`git clone --no-hardlinks --no-checkout`, `git checkout --detach <SHA>`, push URL disabled) and run `npm ci` at the clone root.
2. Delete `node_modules/.vitest-cache` before every Vitest run, then from the clone root:

```sh
rm -rf node_modules/.vitest-cache
LA_LEVEL=k0 LA_SCRATCH_CLONE=$PWD LA_RUN_DIR=<new private folder outside the clone> \
  npx --no-install vitest run --config tests/ltiaas/tasks-core/LA-E2-04/vitest.config.mts --reporter=verbose
```

Artifacts in `LA_RUN_DIR` (umask 077): `e2-04-check-clean.log`, `e2-04-unit-by-ac.log`.

## K1-SIM run (AC-03, AC-04, AC-08; pending: Docker window)

Booked SIM slot only (after the Lead grants a Docker window): project `qa3-la-sim-r<n>`, `PUBLIC_PORT` 9453, `STACK_SUBNET` 172.21.0.0/16 (`tests/ltiaas/tasks-core/K1-SIM-RUN-PLAN.md`).
