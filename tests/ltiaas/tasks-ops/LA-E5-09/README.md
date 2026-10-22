# LA-E5-09: Key provider status, re-wrap job, legacy refusal (QA-2 Suite)

## Acceptance Criteria Coverage

| AC ID | Criterion | Evidence | Coverage Location |
| --- | --- | --- | --- |
| `AC-LA-E5-09-01` | On a stack with only `LTI_MASTER_KEY`, `GET /operator/v1/key-provider` shows `kind: local-keyring`, `activeVersion: legacy`, and one version `legacy` with `derivedCount` equal to the number of service keys. | `K1-SIM` | [`key-provider.test.ts`](./key-provider.test.ts) |
| `AC-LA-E5-09-02` | After QA writes `infra/.secrets/lti/keyring.json` = `{active: "k2", keys: {legacy: <LTI_MASTER_KEY>, k2: <new>}}` and restarts the LTI service, `activeVersion` is `k2`; after `POST …/signing-keys`, `sealedCount` of `k2` grows by 1 (`AP-06-24`). | `K1-SIM` | [`key-provider.test.ts`](./key-provider.test.ts) + [`run.mjs`](./run.mjs) |
| `AC-LA-E5-09-03` | `POST /operator/v1/key-provider/rewrap` gives `202 {job: "key-rewrap", traceId}`; when the job ends, `sealedCount` of every version except `k2` is 0, and `derivedCount` of `legacy` is unchanged (`AP-06-24`). | `K1-SIM` | [`key-provider.test.ts`](./key-provider.test.ts) |
| `AC-LA-E5-09-04` | After the re-wrap, a learner launch, a Deep Linking response, a token request and a score POST with an existing service key all pass (`AP-06-24`). | `K1-SIM` | [`key-provider.test.ts`](./key-provider.test.ts) |
| `AC-LA-E5-09-05` | The re-wrap writes one `job_run {job: "key-rewrap"}` line and two `key_provider.rewrap` audit events (request; job end with counts) (`AP-06-33`, second half; contract delta §5). | `K1-SIM` | [`key-provider.test.ts`](./key-provider.test.ts) |
| `AC-LA-E5-09-06` | Unit: a re-wrap stopped after the first batch and started again ends with the same result as one full run; a third run changes no row. | `UNIT` | Author unit test in lane S2 (verified via `npm run check` / `R0`). |
| `AC-LA-E5-09-07` | Unit: after a run that leaves no legacy blob, the setting `legacyBlobs: refused` exists, and `open` of a legacy blob fails with `key_open_failed {reason: "legacy_refused"}`. | `UNIT` | Author unit test in lane S2 (verified via `npm run check` / `R0`). |
| `AC-LA-E5-09-08` | Unit: a run that leaves at least one legacy blob does not set the refusal flag. | `UNIT` | Author unit test in lane S2 (verified via `npm run check` / `R0`). |

## Host-Only Verification (No Docker)

```sh
npx --prefix tests tsc --noEmit -p tests/ltiaas/tasks-ops/LA-E5-09/tsconfig.json
npx --prefix tests vitest list --config tests/ltiaas/tasks-ops/LA-E5-09/vitest.config.mts
node --check tests/ltiaas/tasks-ops/LA-E5-09/run.mjs
```

## K1-SIM Execution (Requires Approved Docker Slot)

```sh
COMPOSE_PROJECT_NAME=qa2-la-sim-r1 PUBLIC_PORT=9443 STACK_SUBNET=172.20.0.0/16 \
  node tests/ltiaas/tasks-ops/LA-E5-09/run.mjs --sha <integration-sha> --replace-tests
```
