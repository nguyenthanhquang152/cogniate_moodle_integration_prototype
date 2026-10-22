# `LA-E1-10` Task Acceptance Suite (Lane L, QA-4)

Task spec: `docs/architecture/ltiaas/tasks/LA-E1-10.md`
Design: `docs/architecture/ltiaas/adr/LA-ADR-01-channel-kernel.md` (D6, D12), `docs/architecture/ltiaas/adr/LA-ADR-04-refactor-and-migration.md` (D1 S3, S7; D8 LA-IC-01), `docs/architecture/ltiaas/contracts/lti-service-api-delta.md` (§4.7).

## AC Coverage by Evidence Level

| AC | Evidence | Where verified |
| --- | --- | --- |
| `AC-LA-E1-10-01` | `K1-SIM` | `providers-and-texts.k1sim.test.ts` — `GET /api/providers` gives every profile `channel` (`standard` → `moodle`, Canvas profiles → `canvas`, Blackboard profiles → `blackboard`, each simulation profile → its channel), and every other field equals golden G1 (`lms` included: `standard` → `null`, `LA-IC-01`). |
| `AC-LA-E1-10-02` | `K1-SIM` | `providers-and-texts.k1sim.test.ts` + R1 runner — `POST /api/platforms` runtime create plan (`endpoints: admin` vs `endpoints: fixed`), plus M1 `sim` phase and M2 baseline results per test id. |
| `AC-LA-E1-10-03` | `UNIT` | Author unit tests (run via `npm run check` / `npx --no-install vitest run --reporter=verbose -t "AC-LA-E1-10-"`). |
| `AC-LA-E1-10-04` | `K1-SIM` | `providers-and-texts.k1sim.test.ts` — Golden G4 compare (`G4.json` equal byte for byte to G-BASE `1b17261be97c4701b928fa9dc2fa74c6d23028f6/G4.json`) and live LTI service error and Moodle registration pages. |
| `AC-LA-E1-10-05` | `UNIT` | Author unit tests (test channel with `names.text: 'your LMS'` renders `"your LMS"` on LTI service error page where Moodle renders `"Moodle"`). |
| `AC-LA-E1-10-06` | `MOODLE-LIVE` | R2-lite on the booked Moodle slot: `T7` × 1 and `T2a`, `T2b`, `T3a`, `T3b`, `T3c`. |
| `AC-LA-E1-10-07` | `K0` | `providers-and-texts.k0.test.ts` — every core file of `LA-E1-10` has F1 count 0, except names imported from `legacy-wire.ts`. |

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
