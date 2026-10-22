# LA-E5-01 operator listener, operator keys, `lti:operator init`: QA-2 acceptance tests

Spec: `docs/architecture/ltiaas/tasks/LA-E5-01.md`. Contract: `docs/architecture/ltiaas/contracts/lti-service-api-delta.md` §1.2, §1.3, §3. Design: `docs/architecture/ltiaas/adr/LA-ADR-06-service-operability.md` D3; `docs/architecture/ltiaas/operability.md` §2, §6.4. QA-2 wrote these tests from the spec, the contract and the design only (test-first).

## AC map

| AC | Test id (`operator-keys.test.ts` / `run.mjs`) | Label | What it needs |
| --- | --- | --- | --- |
| AC-LA-E5-01-01 | `AC-LA-E5-01-01 acceptance profile: GET http://lti-service:4110/operator/v1/operator-keys …` | K1-SIM | `acceptance` stack, `infra/.secrets/lti-operator-key`, QA form (h) |
| AC-LA-E5-01-02 | `AC-LA-E5-01-02 the same path on the public host https://lti.cogniate.test gives 404 …` | K1-SIM | `acceptance` stack, public proxy `https://lti.cogniate.test` |
| AC-LA-E5-01-03 | `AC-LA-E5-01-03 a tenant API key (ltis_…) in OPERATOR-AUTH-V1 …` | K1-SIM | `acceptance` stack, `cogniate` tenant API key and operator key |
| AC-LA-E5-01-04 | `AC-LA-E5-01-04` (host row in `run.mjs`: `defaultProfileBind` + `acceptanceBindControl`) | K1-SIM | `default` profile `service_started` log line (`operator_bind: "127.0.0.1:4110"`), plus `acceptance` control (`"0.0.0.0:4110"`) |
| AC-LA-E5-01-05 | `AC-LA-E5-01-05 docker compose exec lti-service npm run lti:operator -- init --name qa …` | K1-SIM | `acceptance` stack, QA form (c) via host action `qa2-operator-init` (`mode: "plain"`) |
| AC-LA-E5-01-06 | `AC-LA-E5-01-06 init --if-none …` (`operator-keys.test.ts`) + `AC-LA-E5-01-06` host row (`secondSeed` in `run.mjs`) | K1-SIM | QA form (c) `init --if-none` in container; second `npm run seed` on the same volume on host (`infra/.secrets/lti-operator-key` unchanged) |
| AC-LA-E5-01-07 | `AC-LA-E5-01-07 init --replace --name qa revokes every operator key …` | K1-SIM | QA form (c) `init --replace --name qa` via host action; host updates `infra/.secrets/lti-operator-key` (operability §6.4) |
| AC-LA-E5-01-08 | `AC-LA-E5-01-08 POST /operator/v1/operator-keys with expiresAt 59 minutes or 1 year + 1 day ahead …` | K1-SIM | `acceptance` stack, QA form (h) `POST /operator/v1/operator-keys` |
| AC-LA-E5-01-09 | `AC-LA-E5-01-09 the issue answer shows operatorKey once; GET /operator/v1/operator-keys lists …` | K1-SIM | `acceptance` stack, QA form (h) `POST` and `GET /operator/v1/operator-keys` |
| AC-LA-E5-01-10 | `AC-LA-E5-01-10 revoke of the key that sends the request gives 409 OPERATOR_KEY_IN_USE …` | K1-SIM | `acceptance` stack, QA form (h) `POST /operator/v1/operator-keys/:id/revoke` |
| AC-LA-E5-01-11 | Author unit test (controlled clock; `expires_at + 1 s` → `401`, `expires_at − 1 s` → pass) | UNIT | No Docker (`npm run check` in the clone; Reviewer-B checks test quality) |
| AC-LA-E5-01-12 | Author unit test (log redaction of `ltio_` values) | UNIT | No Docker (`npm run check` in the clone; Reviewer-B checks test quality) |
| LA-E5-01-HYG | `LA-E5-01-HYG no operator key value of this run is in a service log (infra/.logs)` | K1-SIM | `infra/.logs/*.jsonl` after the suite run |

## K1-SIM run (booked SIM slot only)

```sh
COMPOSE_PROJECT_NAME=qa2-la-sim-r1 PUBLIC_PORT=9443 STACK_SUBNET=172.20.0.0/16 \
  node tests/ltiaas/tasks-ops/LA-E5-01/run.mjs --sha <task-sha> --replace-tests
```

`run.mjs` requires `tests/acceptance/run-api.mjs` to route `QA_TASK=LA-E5-01` to `ltiaas/tasks-ops/LA-E5-01/vitest.config.mts`.

## UNIT rows (AC-11, AC-12; no Docker)

In a clean clone of the task SHA:

```sh
npm run check
npx vitest run --reporter=verbose -t "AC-LA-E5-01-1[12]"
```

## No-Docker checks (host-only)

```sh
node --test tests/ltiaas/tasks-ops/LA-E5-01/cli-output.selftest.mjs
npx --prefix tests tsc --noEmit -p tests/ltiaas/tasks-ops/LA-E5-01/tsconfig.json
npx --prefix tests vitest list --config tests/ltiaas/tasks-ops/LA-E5-01/vitest.config.mts
# Fail-closed without a stack (exits 1 on missing infra/.secrets/lti-operator-key):
npx --prefix tests vitest run --config tests/ltiaas/tasks-ops/LA-E5-01/vitest.config.mts
```
