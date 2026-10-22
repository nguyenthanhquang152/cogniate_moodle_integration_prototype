# `LA-E1-10` Task Acceptance Suite (Lane L, QA-4)

Task spec: `docs/architecture/ltiaas/tasks/LA-E1-10.md`
Design: `docs/architecture/ltiaas/adr/LA-ADR-01-channel-kernel.md` (D6, D12), `docs/architecture/ltiaas/adr/LA-ADR-04-refactor-and-migration.md` (D1 S3, S7; D8 LA-IC-01), `docs/architecture/ltiaas/contracts/lti-service-api-delta.md` (§4.7).

## AC Coverage by Evidence Level

| AC | Evidence | Where verified |
| --- | --- | --- |
| `AC-LA-E1-10-01` | `K1-SIM` | `providers-and-texts.k1sim.test.ts` — `GET /api/providers` gives every profile `channel` (`standard` → `moodle`, Canvas profiles → `canvas`, Blackboard profiles → `blackboard`, each simulation profile → its channel), and every other field equals golden G1 (`lms` included: `standard` → `null`, `LA-IC-01`). |
| `AC-LA-E1-10-02` | `K1-SIM` | `providers-and-texts.k1sim.test.ts` + R1 runner — `POST /api/platforms` runtime create plan (`endpoints: admin` vs `endpoints: fixed`), plus M1 `sim` phase and M2 baseline results per test id. |
| `AC-LA-E1-10-03` | `UNIT` | Author unit tests (`services/lti-service/src/http/routes/platforms.test.ts > admin and fixed endpoint plans (AC-LA-E1-10-03)`). |
| `AC-LA-E1-10-04` | `K1-SIM` | `providers-and-texts.k1sim.test.ts` — Golden G4 compare (`G4.json` equal byte for byte to G-BASE `1b17261be97c4701b928fa9dc2fa74c6d23028f6/G4.json`) and live LTI service error and Moodle registration pages. |
| `AC-LA-E1-10-05` + `BD-A1-30` + `BD-A1-31` | `UNIT` + `K0` | Author unit tests (`services/lti-service/src/http/error-page.test.ts > uses a new channel text name in a login error page (AC-LA-E1-10-05)`, `services/lti-service/src/lti/codes.test.ts > reserved-issuer owner names (BD-A1-31)`, `packages/channel-kernel/src/legacy-wire.test.ts > keeps the frozen MOODLE_TOOL_MAY_EXIST text through the public kernel export (BD-A1-30)`) + `providers-and-texts.k0.test.ts`. |
| `AC-LA-E1-10-06` | `MOODLE-LIVE` | R2-lite on the booked Moodle slot: `T7` × 1 and `T2a`, `T2b`, `T3a`, `T3b`, `T3c`. |
| `AC-LA-E1-10-07` | `K0` | `providers-and-texts.k0.test.ts` — every core file of `LA-E1-10` has F1 count 0, except names imported from `legacy-wire.ts`, plus K0 checks for `channel`/`wireLms`, `BD-A1-30` (`pendingToolText`), and `BD-A1-31` (`Canvas or Blackboard`). |

## Commands

### 1. Typecheck (no Docker)

```sh
npx --prefix tests tsc --noEmit -p tests/ltiaas/tasks-lti/LA-E1-10/tsconfig.json
```

### 2. `K0` Suite (no Docker, inside a clone of the task SHA)

```sh
LA_LEVEL=k0 \
  QA_REPO_ROOT=/abs/path/to/clone \
  LA_SCRATCH_CLONE=/abs/path/to/clone \
  LA_RUN_DIR=/abs/path/to/private-run-dir \
  npx --no-install vitest run --config tests/ltiaas/tasks-lti/LA-E1-10/vitest.config.mts
```

### 3. `K1-SIM` Suite (booked SIM Docker slot, prefix `qa4-la-sim-r<N>`)

```sh
LA_LEVEL=k1sim \
  LA_SIM_STACK=1 \
  LA_GOLDEN_CAPTURE=/abs/path/to/golden-capture \
  LA_RUN_DIR=/abs/path/to/private-run-dir \
  PUBLIC_PORT=9443 \
  npx --no-install vitest run --config tests/ltiaas/tasks-lti/LA-E1-10/vitest.config.mts
```
