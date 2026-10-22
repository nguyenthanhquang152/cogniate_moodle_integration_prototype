# LA-E5-12 App CLI wiring (`--operator`, evidence flags, audit events): QA-3 acceptance tests

Spec: `docs/architecture/ltiaas/tasks/LA-E5-12.md` (at `f01bfcd`). Design: `docs/architecture/ltiaas/adr/LA-ADR-07-security-and-tenancy.md` D4, D5; `docs/architecture/ltiaas/adr/LA-ADR-06-service-operability.md` D4 rule 4; `docs/architecture/ltiaas/contracts/cogniate-app-api-delta.md` §7; `docs/architecture/ltiaas/build-decisions-A2.md` BD-A2-45 (`evaluateOperatorPolicy`, `operators_ambiguous`, `connection_id` on every grant and binding event). QA-3 wrote these tests from the spec, contracts and ADRs only (test-first).

| AC | Label | Status | Owner / Test | Oracle |
| --- | --- | --- | --- | --- |
| AC-LA-E5-12-01 | K1-SIM | pending: Docker window | `cli-audit.k1sim.test.ts > AC-LA-E5-12-01` | With `STACK_PROFILE=production` in the CLI process, `app:grant issue …` without `--operator` exits 1 with one line; `app:grant list` shows no new grant and `app:audit list` shows no new event (AP-07-04). |
| AC-LA-E5-12-02 | K1-SIM | pending: Docker window | `cli-audit.k1sim.test.ts > AC-LA-E5-12-02` | With `STACK_PROFILE=production` and `OPERATORS=qa-op`, `app:grant issue … --operator other …` exits 1 and stores nothing (AP-07-04); also when both `OPERATORS` and `OPERATORS_FILE` are set (`BD-A2-45` `operators_ambiguous`), exits 1 and stores nothing. |
| AC-LA-E5-12-03 | K1-SIM | pending: Docker window | `cli-audit.k1sim.test.ts > AC-LA-E5-12-03` | With `STACK_PROFILE=production`, `app:grant issue … --operator qa-op` without `--evidence-channel` or without `--evidence-ref` exits 1 and stores nothing (AP-07-09). |
| AC-LA-E5-12-04 | K1-SIM | pending: Docker window | `cli-audit.k1sim.test.ts > AC-LA-E5-12-04` | With `STACK_PROFILE=production`, `app:grant issue … --operator qa-op --evidence-channel support-call --evidence-ref QA-1` succeeds; its one audit event has `details.evidence_channel`, `details.evidence_ref`, `details.note_present`, `connection_id`, and no note text (AP-07-09). |
| AC-LA-E5-12-05 | K1-SIM | pending: Docker window | `cli-audit.k1sim.test.ts > AC-LA-E5-12-05` | In the `acceptance` profile, the M1 grant and binding commands without the new flags work unchanged; their events have actor `unknown` (or the `OPERATOR_NAME` value) (AP-07-05). |
| AC-LA-E5-12-06 | K1-SIM | pending: Docker window | `cli-audit.k1sim.test.ts > AC-LA-E5-12-06` | Every `app:grant issue`, `revoke`, `app:binding suspend` and `release` run writes exactly one event with the operator name, the connection, the result and `note_present`, visible in `app:audit list --connection <id>` (AP-07-06). |
| AC-LA-E5-12-07 | K1-SIM | pending: Docker window | `cli-audit.k1sim.test.ts > AC-LA-E5-12-07` | `app:grant revoke` of a redeemed grant exits 1 and writes one event with `result: refused` (AP-07-06). |
| AC-LA-E5-12-08 | UNIT | ready | `cli-audit.k0.test.ts` + Author unit test (`vitest run -t "AC-LA-E5-12-"`) | When the local change of a command fails inside its transaction, no audit event is stored. |

## K0 and UNIT-row run (AC-08; no Docker)

1. Clone the task integration SHA into a new folder outside the repository (`git clone --no-hardlinks --no-checkout`, `git checkout --detach <SHA>`, push URL disabled) and run `npm ci` at the clone root.
2. From the clone root:

```sh
LA_LEVEL=k0 LA_SCRATCH_CLONE=$PWD LA_RUN_DIR=<new private folder outside the clone> \
  npx --no-install vitest run --config tests/ltiaas/tasks-core/LA-E5-12/vitest.config.mts --reporter=verbose
```

Artifacts in `LA_RUN_DIR` (umask 077): `e5-12-check-clean.log`, `e5-12-unit-rows.log`.

## K1-SIM run (AC-01 to AC-07; pending: Docker window)

Booked SIM slot only (after the Lead grants a Docker window):

```sh
COMPOSE_PROJECT_NAME=qa3-la-sim-r1 PUBLIC_PORT=9443 STACK_SUBNET=172.20.0.0/16 \
  node tests/ltiaas/tasks-core/LA-E5-12/run.mjs --sha <integration-sha> --replace-tests
```
