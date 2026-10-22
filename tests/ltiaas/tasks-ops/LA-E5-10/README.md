# LA-E5-10 signing-key lifecycle and A-T0-16: QA-2 acceptance tests

Spec: `docs/architecture/ltiaas/tasks/LA-E5-10.md`. Contract: `docs/architecture/ltiaas/contracts/lti-service-api-delta.md` §1.3, §2.3, §3, §5. Design: `docs/architecture/ltiaas/adr/LA-ADR-06-service-operability.md` D7 (AP-06-27 to AP-06-32). QA-2 wrote these tests from the spec, the contract and the ADR only (test-first).

## AC map

| AC id | Test id | Label | What it needs |
| --- | --- | --- | --- |
| `AC-LA-E5-10-01` | `AC-LA-E5-10-01` (`signing-keys.test.ts`) | `K1-SIM` | Running stack (`acceptance` profile): after `POST /operator/v1/accounts/cogniate/signing-keys` (next key B, active key A), `GET /lti/keys/cogniate` lists A first and B second (`Cache-Control: public, max-age=300`); a Deep Linking response JWT and a simulator token `client_assertion` JWT both have header `kid = A`. |
| `AC-LA-E5-10-02` | `AC-LA-E5-10-02` (`signing-keys.test.ts`) | `K1-SIM` | Running stack (`acceptance` profile): a second `POST /operator/v1/accounts/cogniate/signing-keys` while B is `next` gives `409 SIGNING_KEY_NEXT_EXISTS`. |
| `AC-LA-E5-10-03` | `AC-LA-E5-10-03` (`signing-keys.test.ts`) | `K1-SIM` | Running stack (`acceptance` profile): `POST /operator/v1/accounts/cogniate/signing-keys/:kid/activate` before the publish lead time (without `force`) gives `409 SIGNING_KEY_NOT_PUBLISHED_LONG_ENOUGH`. |
| `AC-LA-E5-10-04` | `AC-LA-E5-10-04` (`signing-keys.test.ts`) | `K1-SIM` | Running stack (`acceptance` profile): `POST …/activate {force: true}` makes new Deep Linking responses and simulator token `client_assertion` JWTs use `kid = B`; `GET /lti/keys/cogniate` lists B first and A second; the `signing_key.activate` audit event has `details.forced: true`. |
| `AC-LA-E5-10-05` | Author unit test (controlled clock, lead time 600 s) | `UNIT` | No Docker: activate at `published_at + 599 s` gives `409`; at `published_at + 600 s` it passes. QA records the Author unit test run in `qa.md`. |
| `AC-LA-E5-10-06` | `AC-LA-E5-10-06` (`signing-keys.test.ts`) | `K1-SIM` | Running stack (`acceptance` profile): a learner launch recorded while A is active, followed by force-activation of B, then a score POST using that launch's `serviceKey` succeeds (`204`, verified at `lms-sim` with `kid = B`); a teacher Deep Linking response signed with B is accepted by `lms-sim`. |
| `AC-LA-E5-10-07` | Author unit test (controlled clock, 30-day retirement window) | `UNIT` | No Docker: a key A created 40 days ago and retired now stays in the JWKS; at `retired_at + 30 days + 1 s` it leaves the JWKS. QA records the Author unit test run in `qa.md`. |
| `AC-LA-E5-10-08` | `AC-LA-E5-10-08` (`signing-keys.test.ts`) | `K1-SIM` | Running stack (`acceptance` profile): `POST …/signing-keys/<active kid>/retire {immediate: true}` gives `409 SIGNING_KEY_ACTIVE`; on retired key A it gives `200 {kid: A, status: "removed"}`, and A leaves `GET /lti/keys/cogniate` at once. |
| `AC-LA-E5-10-09` | `AC-LA-E5-10-09` (`signing-keys.test.ts`) | `K1-SIM` | Running stack (`acceptance` profile): each create, activate and retire writes one audit event (`signing_key.create`, `signing_key.activate`, `signing_key.retire`). |
| `AC-LA-E5-10-10` | Author unit test (migration test) | `UNIT` | No Docker: a `retired` row created 10 days before the migration stays in the JWKS with `retired_at` = migration time; a `retired` row created 40 days before becomes `removed`; the public key list before and after the migration is equal. QA records the Author unit test run in `qa.md`. |
| `AC-LA-E5-10-11` | Author unit test (controlled clock, temporary database) | `UNIT` | No Docker: `signing-key-cleanup` sets `removed` and `removed_at` and zeroes the private blob of a key at `retired_at + 30 days`, and leaves a key at `retired_at + 29 days` unchanged. QA records the Author unit test run in `qa.md`. |
| `AC-LA-E5-10-12` | Author unit test (`signing-key-cleanup` on migration-marked `removed` row) | `UNIT` | No Docker: the first `signing-key-cleanup` run zeroes the private blob of a row that the migration marked `removed`. QA records the Author unit test run in `qa.md`. |
| `AC-LA-E5-10-13` | Author unit test (`retire` on `next`, `SIGNING_KEY_WRONG_STATE`, `404`, `400`) | `UNIT` | No Docker: `retire {immediate: true}` on a `next` key sets `removed` and allows a new `next` key; invalid state transitions give `409 SIGNING_KEY_WRONG_STATE`; unknown/cross-account kids give `404 NOT_FOUND`; missing `immediate: true` gives `400 INVALID_REQUEST`. QA records the Author unit test run in `qa.md`. |

## How to run

### K1-SIM (booked SIM slot only)

```sh
COMPOSE_PROJECT_NAME=qa2-la-sim-r1 PUBLIC_PORT=9443 STACK_SUBNET=172.20.0.0/16 \
  node tests/ltiaas/tasks-ops/LA-E5-10/run.mjs --sha <integration sha> --replace-tests
```

### No-Docker checks (host-only)

```sh
npx --prefix tests tsc --noEmit -p tests/ltiaas/tasks-ops/LA-E5-10/tsconfig.json
npx --prefix tests vitest list --config tests/ltiaas/tasks-ops/LA-E5-10/vitest.config.mts
```
