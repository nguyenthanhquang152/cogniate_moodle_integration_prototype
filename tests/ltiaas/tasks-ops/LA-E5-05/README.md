# LA-E5-05 LTI CLIs as operator API clients: QA-2 acceptance tests

Spec: `docs/architecture/ltiaas/tasks/LA-E5-05.md`. Contract: `docs/architecture/ltiaas/contracts/lti-service-api-delta.md` §3 ("CLI mapping"), §5. Design: `docs/architecture/ltiaas/adr/LA-ADR-06-service-operability.md` D3 ("CLIs", AP-06-12), D7 ("CLI"), `docs/architecture/ltiaas/operability.md` §6.1, §6.2, and build decisions `BD-A2-02`, `BD-A2-14`, `BD-A2-33`, `BD-A2-34`. QA-2 wrote these tests from the spec, the contract and the design only (test-first).

## AC map

| AC id | Test id | Label | What it needs |
| --- | --- | --- | --- |
| `AC-LA-E5-05-01` | `AC-LA-E5-05-01` (`cli.test.ts` + `run.mjs` setup) | `K1-SIM` | Fresh stack (`acceptance` profile): `npm run lti:bootstrap -w services/lti-service -- --account cogniate --name Cogniate` (and a fresh account via QA form (d)) prints one JSON line with keys `account`, `created`, `kid`, `apiKey` (`created: true`, `ltis_…` key that passes `GET /api/platforms`). |
| `AC-LA-E5-05-02` | `AC-LA-E5-05-02` (`cli.test.ts`) | `K1-SIM` | Running stack (`acceptance` profile): the bootstrap run writes one `account.create` event and one `api_key.issue` event with actor `operator:<name of the key file>`. |
| `AC-LA-E5-05-03` | `AC-LA-E5-05-03` (`cli.test.ts` + QA form (d)) | `K1-SIM` | Running stack (`acceptance` profile): a second `lti:bootstrap` run without flags prints `created: false` and no `apiKey`, and writes no `api_key.issue` audit event. |
| `AC-LA-E5-05-04` | `AC-LA-E5-05-04` (`cli.test.ts` + QA form (d)) | `K1-SIM` | Running stack (`acceptance` profile), fresh account: `lti:bootstrap --rotate-api-key` calls `POST …/api-keys` with `revokeOthers: true` (`BD-A2-33`), prints a new `apiKey`, revokes every previous active key (`401`), passes with the new key (`200`), and writes one `api_key.issue` audit event with `details.revokedKeyIds`. |
| `AC-LA-E5-05-05` | `AC-LA-E5-05-05` (`cli.test.ts` + QA form (d)) | `K1-SIM` | Running stack (`acceptance` profile), fresh account: `lti:bootstrap --rotate-signing-key` retires any waiting `next` key immediately (`BD-A2-14`), creates and force-activates a new signing key, prints the new `kid`, `GET /lti/keys/<account>` lists it first, and one `signing_key.activate` audit event has `details.forced: true`. |
| `AC-LA-E5-05-06` | `AC-LA-E5-05-06` (`cli.test.ts`) | `K1-SIM` | Running stack (`acceptance` profile): `lti:shared-platform` for an existing shared platform with the same client id exits `0`, prints the same platform id output as today, and creates no second platform; a different client id exits `1`. |
| `AC-LA-E5-05-07` | `AC-LA-E5-05-07` (`cli.test.ts` + QA form (e)) | `K1-SIM` | Running stack (`acceptance` profile): with `infra/.secrets/lti-operator-key` renamed for one CLI run (and restored in `finally`), `lti:bootstrap` deletes the `infra/.secrets/lti/lti-operator-key` copy (`BD-A2-34`), exits `1` with one line naming the key file, and `lti.db` does not change (no new audit event, account not created). |
| `AC-LA-E5-05-08` | `AC-LA-E5-05-08` (`cli.test.ts` + `run.mjs` setup) | `K1-SIM` | Running stack (`acceptance` profile): `npm run seed` twice on the same volume (`BD-A2-02`) passes on both runs; the second run issues no operator key and no API key. |

## How to run

### K1-SIM (booked SIM slot only)

```sh
COMPOSE_PROJECT_NAME=qa2-la-sim-r1 PUBLIC_PORT=9443 STACK_SUBNET=172.20.0.0/16 \
  node tests/ltiaas/tasks-ops/LA-E5-05/run.mjs --sha <integration sha> --replace-tests
```

### No-Docker checks (host-only)

```sh
npx --prefix tests tsc --noEmit -p tests/ltiaas/tasks-ops/LA-E5-05/tsconfig.json
npx --prefix tests vitest list --config tests/ltiaas/tasks-ops/LA-E5-05/vitest.config.mts
```
