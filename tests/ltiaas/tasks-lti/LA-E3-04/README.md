# LA-E3-04 Deep Linking completeness: service part — QA-4 test suite

Spec: `docs/architecture/ltiaas/tasks/LA-E3-04.md` (at `4c11521`). Design: `docs/architecture/ltiaas/adr/LA-ADR-05-lti-advantage-completeness.md` D3 (D3a service, D3c service, D3d); `docs/architecture/ltiaas/contracts/lti-service-api-delta.md` §4.1, §4.2; `docs/architecture/ltiaas/adr/LA-ADR-04-refactor-and-migration.md` D8 (`LA-IC-12`). Wave: B2 (lane L).

## Acceptance criteria map

| AC | Label | Verification owner | Summary |
| --- | --- | --- | --- |
| `AC-LA-E3-04-01` | `K1-SIM` | `deep-linking.k1sim.test.ts` (QA-4 SIM slot) | `POST /api/deeplinking {contentItems: []}` on a Deep Linking launch gives `200`, and the signed JWT has `content_items: []` (`AP-05-12`). |
| `AC-LA-E3-04-02` | `K1-SIM` | `deep-linking.k1sim.test.ts` (QA-4 SIM slot) | The same empty request on a launch with `accept_multiple: false` gives `200` (`AP-05-12`). |
| `AC-LA-E3-04-03` | `UNIT` (+ `K0`, `K1-SIM`) | Author unit test + `deep-linking.k0.test.ts` + `deep-linking.k1sim.test.ts` | With `accept_multiple: false`, two items give `400 INVALID_CONTENT_ITEM`; 21 items give `400 INVALID_CONTENT_ITEM` for any launch. |
| `AC-LA-E3-04-04` | `K1-SIM` | `deep-linking.k1sim.test.ts` (QA-4 SIM slot) | With `accept_lineitem: false`, an item with `lineItem` gives `400 INVALID_CONTENT_ITEM`; the same item without `lineItem` gives `200` (`AP-05-13`). |
| `AC-LA-E3-04-05` | `K1-SIM` | `deep-linking.k1sim.test.ts` (QA-4 SIM slot) | `GET /api/idtoken` of a Deep Linking launch whose settings have `accept_lineitem` and `accept_media_types` shows `acceptLineItem` and `acceptMediaTypes` with the same values (`AP-05-14`). |
| `AC-LA-E3-04-06` | `UNIT` (+ `K0`, `K1-SIM`) | Author unit test + `deep-linking.k0.test.ts` + `deep-linking.k1sim.test.ts` | `GET /api/idtoken` of a Deep Linking launch without these settings has no `acceptLineItem` and no `acceptMediaTypes` member. |
| `AC-LA-E3-04-07` | `UNIT` (+ `K0`, `K1-SIM`) | Author unit test + `deep-linking.k0.test.ts` + `deep-linking.k1sim.test.ts` | `/api/deeplinking/message` and `/api/deeplinking/form` give the same answers as `/api/deeplinking` for the inputs of `AC-01` and `AC-04`. |

## Reviewed test-change list for `LA-IC-12` (service part, plan LD-9)

QA scanned `tests/acceptance/**` and `tests/e2e/**` for assertions that:
1. Send `contentItems: []` to `/api/deeplinking*` and expect HTTP `400`, or
2. Perform a closed/whole-object equality check on `launch.deepLinkingSettings` in `GET /api/idtoken`.

Result: **0 frozen acceptance or E2E tests** fail on `LA-IC-12` (`tests/acceptance/T3a/1-deep-linking.spec.ts:52` checks only `t.launch.deepLinkingSettings?.acceptTypes`). Any pre-LA unit test in `services/lti-service/src/lti/deep-linking.test.ts` or `idtoken.test.ts` that asserted `400` on `contentItems: []` is updated by the Author in `LA-E3-04`.

## Running the suites

### 1. Typecheck and list (no Docker)

```sh
npx --prefix tests tsc --noEmit -p tests/ltiaas/tasks-lti/LA-E3-04/tsconfig.json
LA_LEVEL=k0 npx --prefix tests vitest list --config tests/ltiaas/tasks-lti/LA-E3-04/vitest.config.mts
LA_LEVEL=k1sim npx --prefix tests vitest list --config tests/ltiaas/tasks-lti/LA-E3-04/vitest.config.mts
```

### 2. K0 + UNIT verification (no Docker, against a clean clone at `<CLONE>`)

```sh
LA_TARGET_ROOT="<CLONE>" LA_RUN_DIR="<RUN_DIR>" LA_LEVEL=k0 \
  npx --prefix tests vitest run --config tests/ltiaas/tasks-lti/LA-E3-04/vitest.config.mts \
  tests/ltiaas/tasks-lti/LA-E3-04/deep-linking.k0.test.ts
```

### 3. K1-SIM acceptance (booked SIM slot, compose prefix `qa4-la-sim-r<round>`)

```sh
QA_PRODUCT_SHA="<40-char-sha>" QA_TEST_SHA="<40-char-sha>" LA_RUN_DIR="<RUN_DIR>" LA_LEVEL=k1sim \
  npx --prefix tests vitest run --config tests/ltiaas/tasks-lti/LA-E3-04/vitest.config.mts \
  tests/ltiaas/tasks-lti/LA-E3-04/deep-linking.k1sim.test.ts
```
