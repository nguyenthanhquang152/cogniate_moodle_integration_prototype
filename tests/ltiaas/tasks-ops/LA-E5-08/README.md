# LA-E5-08 key provider (versioned envelopes): QA-2 acceptance tests

Spec: `docs/architecture/ltiaas/tasks/LA-E5-08.md`. Design: `docs/architecture/ltiaas/adr/LA-ADR-06-service-operability.md` D6; `docs/architecture/ltiaas/operability.md` §2, §6.3; `docs/architecture/ltiaas/data-model.md` §4. QA-2 wrote these tests from the spec, the contract and the design only (test-first).

## AC map

| AC | Test id (`u1.test.ts` / `run.mjs`) | Label | What it needs |
| --- | --- | --- | --- |
| AC-LA-E5-08-01 | `AC-LA-E5-08-01` host row (`candidateStart` in `run.mjs`) + `AC-LA-E5-08-01 (registration session) …` + `AC-LA-E5-08-01 (tool key) …` (`u1.test.ts`, `QA_LA_PHASE=new`) | K1-SIM | Upgrade route U1 (`--old-sha` → `--sha` on the same volumes), `LTI_MASTER_KEY` only (no key-ring file), `LA-E5-08-U1OLD` and `LA-E5-08-U1REG` state from `QA_LA_PHASE=old` |
| AC-LA-E5-08-02 | `AC-LA-E5-08-02 U1: the generation-0 service key keeps its exact value; a score POST with the old service key passes` (`u1.test.ts`, `QA_LA_PHASE=new`) | K1-SIM | Upgrade route U1, generation-0 service key from `LA-E5-08-U1OLD` (`QA_LA_PHASE=old`), Blackboard-sim score POST |
| AC-LA-E5-08-03 | Author unit test (`mac('service-key', 'legacy', input)` equals today's derivation for a fixed fixture) | UNIT | No Docker (`npm run check` in the clone; Reviewer-B checks test quality) |
| AC-LA-E5-08-04 | Author unit test (value sealed with `k2` and AAD `A` opens with `A` and fails with other AAD) | UNIT | No Docker (`npm run check`) |
| AC-LA-E5-08-05 | Author unit test (blob copied from `cogniate` `tool_key` to `qa-second` fails open → `500 INTERNAL_ERROR` with trace id and `key_open_failed {table: "tool_key"}`) | UNIT | No Docker (`npm run check`) |
| AC-LA-E5-08-06 | Author unit test (legacy blob without header opens with version `legacy`) | UNIT | No Docker (`npm run check`) |
| AC-LA-E5-08-07 | Author unit test (key ring `{active: "k2", keys: {legacy, k2}}` seals `"cgk1"` blob with version `k2`) | UNIT | No Docker (`npm run check`) |
| AC-LA-E5-08-08 | Author unit test (missing referenced key version makes `ready()` fail and logs `key_provider_not_ready {version}`) | UNIT | No Docker (`npm run check`) |
| AC-LA-E5-08-09 | Author unit test (controlled clock: active private JWK decrypted at most once per 10 minutes per `kid`) | UNIT | No Docker (`npm run check`) |
| AC-LA-E5-08-10 | Author unit migration test (M1 fixture database: old `service_key` rows have `derivation_version = legacy` and unchanged key values) | UNIT | No Docker (`npm run check`) |

## K1-SIM run on upgrade route U1 (booked SIM slot only)

```sh
COMPOSE_PROJECT_NAME=qa2-la-sim-r1 PUBLIC_PORT=9443 STACK_SUBNET=172.20.0.0/16 \
  node tests/ltiaas/tasks-ops/LA-E5-08/run.mjs --sha <candidate-sha> --old-sha <pre-key-provider-sha>
```

`run.mjs` starts the old build (`QA_LA_PHASE=old`), creates a Blackboard-sim binding, launch, Deep Linking response, score POST and Moodle Dynamic Registration session, stops `cogniate-app` and `lti-service`, switches code to `--sha` on the same volumes with only `LTI_MASTER_KEY`, starts the candidate stack, and runs `QA_LA_PHASE=new`.

## UNIT rows (AC-03 to AC-10; no Docker)

In a clean clone of the task SHA:

```sh
npm run check
npx vitest run --reporter=verbose -t "AC-LA-E5-08-(0[3-9]|10)"
```

## No-Docker checks (host-only)

```sh
npx --prefix tests tsc --noEmit -p tests/ltiaas/tasks-ops/LA-E5-08/tsconfig.json
QA_LA_PHASE=old npx --prefix tests vitest list --config tests/ltiaas/tasks-ops/LA-E5-08/vitest.config.mts
QA_LA_PHASE=new npx --prefix tests vitest list --config tests/ltiaas/tasks-ops/LA-E5-08/vitest.config.mts
# Fail-closed without a stack or phase (exits non-zero):
npx --prefix tests vitest run --config tests/ltiaas/tasks-ops/LA-E5-08/vitest.config.mts
QA_LA_PHASE=new npx --prefix tests vitest run --config tests/ltiaas/tasks-ops/LA-E5-08/vitest.config.mts
node tests/ltiaas/tasks-ops/LA-E5-08/run.mjs
```
