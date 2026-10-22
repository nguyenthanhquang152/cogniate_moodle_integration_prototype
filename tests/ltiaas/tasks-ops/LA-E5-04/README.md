# LA-E5-04 tenant model (account status, tool URLs, account resolver): QA-2 acceptance tests

Spec: `docs/architecture/ltiaas/tasks/LA-E5-04.md`. Contract: `docs/architecture/ltiaas/contracts/lti-service-api-delta.md` §1.1, §1.3, §1.5, §3, §5. Design: `docs/architecture/ltiaas/adr/LA-ADR-06-service-operability.md` D2 (AP-06-07 to AP-06-10). QA-2 wrote these tests from the spec, the contract and the ADR only (test-first).

## AC map

| AC id | Test id | Label | What it needs |
| --- | --- | --- | --- |
| `AC-LA-E5-04-01` | `AC-LA-E5-04-01` (`accounts.test.ts`) | `K1-SIM` | Running stack (`acceptance` profile): `POST /operator/v1/accounts` for two new account ids both give `201` with `status: "active"`, path-mode `protocolUrls`, an active signing key in `GET /lti/keys/:id`, and one `account.create` event each; repeating an id gives `409 ACCOUNT_ALREADY_EXISTS`. |
| `AC-LA-E5-04-02` | `AC-LA-E5-04-02` (`accounts.test.ts`) | `K1-SIM` | Running stack (`acceptance` profile): on a fresh account, after `PATCH /operator/v1/accounts/:id {launchUrl: "https://tool-b.test/launch"}`, a resource link launch redirects (`303`) to `https://tool-b.test/launch?…&ltik=…`, while `cogniate` still redirects to `{PUBLIC_APP_URL}/tool/launch`. |
| `AC-LA-E5-04-03` | `AC-LA-E5-04-03` (`accounts.test.ts`) | `K1-SIM` | Running stack (`acceptance` profile): `PATCH` with `launchUrl` values `http://x.test`, `https://u:p@x.test/a`, `https://x.test/a#f`, `{PUBLIC_CONTENT_URL}/launch`, and `{PUBLIC_LTI_URL}/launch` each give `400 INVALID_REQUEST` naming `launchUrl`, and leave the account unchanged. |
| `AC-LA-E5-04-04` | `AC-LA-E5-04-04` (`accounts.test.ts`) | `K1-SIM` | Running stack (`acceptance` profile): `PATCH /operator/v1/accounts/:id {publicBaseUrl: "https://t.test"}` gives `400 INVALID_REQUEST` naming `publicBaseUrl`. |
| `AC-LA-E5-04-05` | `AC-LA-E5-04-05` (`accounts.test.ts`) | `K1-SIM` | Running stack (`acceptance` profile): after `PATCH /operator/v1/accounts/qa-second {status: "suspended"}`, `GET /api/idtoken` with a valid `qa-second` `ltik` gives `403 TOOL_ACCOUNT_SUSPENDED`; `cogniate` calls still pass; after restoring `status: "active"` (in `finally`), the `qa-second` call gives `200` again. |
| `AC-LA-E5-04-06` | `AC-LA-E5-04-06` (`accounts.test.ts`) | `K1-SIM` | Running stack (`acceptance` profile): a `PATCH` that changes `status` writes one `account.status` event; a `PATCH` of `name` writes one `account.update` event. |
| `AC-LA-E5-04-07` | `AC-LA-E5-04-07` (`accounts.test.ts`) | `K1-SIM` | Running stack (`acceptance` profile): `PATCH … {claimPolicy: {mode: "allowlist", keep: {names: false, email: false, custom: false, lis: false}}}` gives `200` and `GET /operator/v1/accounts/:id` shows it; an unknown `mode` gives `400 INVALID_REQUEST`. |
| `AC-LA-E5-04-08` | `AC-LA-E5-04-08` (`accounts.test.ts` + `run.mjs` host action `qa2-lti-bootstrap`) | `K1-SIM` | Running stack (`acceptance` profile) + QA form (d) (`npm run lti:bootstrap -w services/lti-service -- --account <fresh> --name <n>`): the printed/saved `apiKey` gives `200` on `GET /api/platforms`; after `PATCH … {status: "closed"}` the same key gives `401`, one `account.status` event exists, and a later `PATCH` gives `409 ACCOUNT_CLOSED`. |
| `AC-LA-E5-04-09` | `AC-LA-E5-04-09` (`accounts.test.ts`) | `K1-SIM` | Running stack (`acceptance` profile): `POST /operator/v1/accounts/<fresh>/shared-platforms {profile: "blackboard-sim", clientId}` gives `201` and writes one `platform.create_shared` event; repeating with the same `clientId` gives `200` with the same platform id; another `clientId` gives `409 SHARED_PLATFORM_EXISTS`. |
| `AC-LA-E5-04-10` | Author unit test (`protocolUrls` of `cogniate` in path mode) | `UNIT` | No Docker: `protocolUrls` of `cogniate` in path mode equal today's URLs byte for byte. QA records the Author unit test run in `qa.md`. |
| `AC-LA-E5-04-11` | Author unit test (migration test on an M1 fixture database) | `UNIT` | No Docker: old rows read `status: active`, path mode, today's tool URLs, `claim_policy: null`, `service_key_write_scope: context`. QA records the Author unit test run in `qa.md`. |
| `AC-LA-E5-04-12` | Author unit test (`tool_account.api_key_hash` unusable random SHA-256) | `UNIT` | No Docker: a new account stores in `tool_account.api_key_hash` the SHA-256 of 32 random bytes, different for two new accounts; no API key passes for it until LA-E5-07 issues one. QA records the Author unit test run in `qa.md`. |

## How to run

### K1-SIM (booked SIM slot only)

```sh
COMPOSE_PROJECT_NAME=qa2-la-sim-r1 PUBLIC_PORT=9443 STACK_SUBNET=172.20.0.0/16 \
  node tests/ltiaas/tasks-ops/LA-E5-04/run.mjs --sha <integration sha> --replace-tests
```

### No-Docker checks (host-only)

```sh
npx --prefix tests tsc --noEmit -p tests/ltiaas/tasks-ops/LA-E5-04/tsconfig.json
npx --prefix tests vitest list --config tests/ltiaas/tasks-ops/LA-E5-04/vitest.config.mts
```
