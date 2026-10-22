# LA-E5-11: App audit writer, operator policy, `app:audit list` (QA-2 Suite)

## Acceptance Criteria Coverage

| AC ID | Criterion | Evidence | Coverage Location |
| --- | --- | --- | --- |
| `AC-LA-E5-11-01` | Unit (migration test): `UPDATE audit_event …` in the app database fails with `audit_event is append-only`; old `connection` rows are unchanged. | `UNIT` | Author unit test in lane S1 (verified via `npm run check` / `R0`). |
| `AC-LA-E5-11-02` | Unit: with `STACK_PROFILE=production` and no `--operator`, the policy refuses with one line (`AP-07-04`, policy part). | `UNIT` | Author unit test in lane S1 (verified via `npm run check` / `R0`). |
| `AC-LA-E5-11-03` | Unit: with `STACK_PROFILE=production`, `OPERATORS=qa-op` and `--operator other`, the policy refuses; with `--operator qa-op` and both evidence fields it allows (`AP-07-04`, `AP-07-09`, policy part). | `UNIT` | Author unit test in lane S1 (verified via `npm run check` / `R0`). |
| `AC-LA-E5-11-04` | Unit: with `STACK_PROFILE=production`, a missing `--evidence-channel` or `--evidence-ref` is refused; `--evidence-channel verified-admin-launch` is refused; an `--evidence-ref` of 201 characters is refused (`AP-07-09`, policy part). | `UNIT` | Author unit test in lane S1 (verified via `npm run check` / `R0`). |
| `AC-LA-E5-11-05` | Unit: with `STACK_PROFILE=acceptance` and no flags, the policy allows with actor `unknown`; with `OPERATOR_NAME=ops1` the actor is `ops1` (`AP-07-05`, policy part). | `UNIT` | Author unit test in lane S1 (verified via `npm run check` / `R0`). |
| `AC-LA-E5-11-06` | Unit: the writer stores `details.evidence_channel`, `details.evidence_ref` and `details.note_present: true`, and never the note text; a `details` value above 4 KB is refused. | `UNIT` | Author unit test in lane S1 (verified via `npm run check` / `R0`). |
| `AC-LA-E5-11-07` | Unit: `app:audit list --connection <id> --limit 2` prints at most 2 JSON lines of that connection, newest first, and writes no event. | `UNIT` | Author unit test in lane S1 (verified via `npm run check` / `R0`). |
| `AC-LA-E5-11-08` | `docker compose exec cogniate-app npm run app:audit -- list` on a fresh stack exits 0 and prints no line. | `K1-SIM` | [`app-audit.test.ts`](./app-audit.test.ts) + [`run.mjs`](./run.mjs) |

## Host-Only Verification (No Docker)

```sh
npx --prefix tests tsc --noEmit -p tests/ltiaas/tasks-ops/LA-E5-11/tsconfig.json
npx --prefix tests vitest list --config tests/ltiaas/tasks-ops/LA-E5-11/vitest.config.mts
node --check tests/ltiaas/tasks-ops/LA-E5-11/run.mjs
```

## K1-SIM Execution (Requires Approved Docker Slot)

```sh
COMPOSE_PROJECT_NAME=qa2-la-sim-r1 PUBLIC_PORT=9443 STACK_SUBNET=172.20.0.0/16 \
  node tests/ltiaas/tasks-ops/LA-E5-11/run.mjs --sha <integration-sha> --replace-tests
```
