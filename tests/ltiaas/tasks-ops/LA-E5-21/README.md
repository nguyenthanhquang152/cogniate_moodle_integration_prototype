# LA-E5-21 — Production profile and secrets from files (QA-2, K1-SIM)

Owner: QA-2 (`tests/ltiaas/tasks-ops/LA-E5-21/**`).
Spec: `docs/architecture/ltiaas/tasks/LA-E5-21.md`, `LA-ADR-06` D12, `security-delta.md` §15, `operability.md` §2.

## Coverage

| AC | Level | Covered in | What is checked |
| --- | --- | --- | --- |
| `AC-LA-E5-21-01` | `K1-SIM` | `production-profile.test.ts` + `run.mjs` | One LTI service process started with `STACK_PROFILE=production` and an active test knob (tasks README §2 form (f): `docker compose ... run --rm --no-deps -e STACK_PROFILE=production -e LTIK_TTL_SECONDS=20 -e TEST_LTI_CLOCK_OFFSET_S=10 lti-service npm start` on QA's own project) exits `1` with one line `config_refused {reason: "test_knob_active"}` |
| `AC-LA-E5-21-02` | `UNIT` | Author unit test | Production with `LTI_PROVIDER_SIMULATION=on` is refused (`simulation_on`) |
| `AC-LA-E5-21-03` | `UNIT` | Author unit test | Production with non-empty `OUTBOUND_PRIVATE_HOST_ALLOWLIST` is refused (`private_host_allowlist`) |
| `AC-LA-E5-21-04` | `UNIT` | Author unit test | Production with `LTI_MASTER_KEY` in env is refused (`master_key_in_env`); `LTI_MASTER_KEY_FILE` starts |
| `AC-LA-E5-21-05` | `UNIT` | Author unit test | Production with empty `TRUSTED_PROXY_CIDRS` is refused (`no_trusted_proxy`) |
| `AC-LA-E5-21-06` | `UNIT` | Author unit test | Production with `OPERATOR_HOST=0.0.0.0` is refused (`operator_bind_not_loopback`) |
| `AC-LA-E5-21-07` | `K1-SIM` | `production-profile.test.ts` + `run.mjs` | Both the `default` profile (`stack:up`) and the `acceptance` profile (`test:acceptance`) start with today's environment values and their `GET /healthz` responses equal the E0 golden `G1` (`G1.default.ltiHealth` and `G1.acceptance.ltiHealth`, under `LA-IC-16`) |

## Host-only check (no Docker)

```sh
./node_modules/.bin/tsc -p tests/ltiaas/tasks-ops/LA-E5-21/tsconfig.json --noEmit
./node_modules/.bin/vitest list -c tests/ltiaas/tasks-ops/LA-E5-21/vitest.config.mts
node --check tests/ltiaas/tasks-ops/LA-E5-21/run.mjs
```

## SIM slot execution

```sh
COMPOSE_PROJECT_NAME=qa2-la-sim-r1 PUBLIC_PORT=9443 STACK_SUBNET=172.20.0.0/16 \
  node tests/ltiaas/tasks-ops/LA-E5-21/run.mjs --sha <integration-sha> --replace-tests
```
