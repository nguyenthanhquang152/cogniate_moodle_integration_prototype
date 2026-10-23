# LTI 1.3 Channel Certification Kit (`K1` — `tests/ltiaas/kit`)

Channel-parameterised LTI 1.3 / LTI Advantage certification kit (`LA-E7-06`, `TEST-STRATEGY.md` §2.1–§2.6).

## Layout

- `channels/<id>.json` — Design-sourced channel fixtures (`moodle.json`, `canvas.json`, `blackboard.json`, `lti-generic.json`, `brightspace.json`). Every value records its design source (`LA-ADR-01 D3`, `LA-ADR-02`, `LA-ADR-05`, `LA-ADR-07`, `LA-ADR-08`, `ADR-011`, `LA-IC-01`, `LA-IC-14`; `TB-12`).
- `lib/fixtures.ts` — Fixture loader, `TB-12` design-source auditor, expected case list generator (`computeExpectedCaseList`), bilateral capability comparator (`verifyBilateralCapabilities`), and pass-rule evaluator (`evaluateChannelPassRule`, `verifyExecutedCases`).
- `lib/runtime.ts` — Thin channel-neutral glue that imports (never copies) the M1 acceptance helpers (`tests/acceptance/M1/common/{client,course}.ts`) and drives connection binding, Dynamic Registration, launches, Deep Linking, AGS, NRPS, capability guards, and `K-HYG` secret scanning from `ChannelFixture`.
- `suites/*.k1sim.test.ts` — Six per-port simulator suites (`k1-launch`, `k1-dl`, `k1-ags`, `k1-nrps`, `k1-reg`, `k1-cap`) plus `k-hyg.k1sim.test.ts`. Files in `suites/**` contain zero LMS or channel names and are checked by `AC-LA-E7-04-07` (`npm run fitness:lms-names`).
- `kit.k0.test.ts` — Host-only `K0` and `DOC` suite verifying `AC-LA-E7-06-02`..`05`, `-07`, `-08`, and `AC-LA-E7-04-07`.

## Commands

- **Host-only `K0` + `DOC` verification (no Docker):**
  ```sh
  LA_LEVEL=k0 npx --no-install vitest run --config tests/ltiaas/kit/vitest.config.mts
  ```
- **Inside the `e2e` container during a booked SIM Docker window (`K1-SIM`):**
  ```sh
  # Default baseline channels (moodle, canvas, blackboard):
  QA_TASK=K1 npm run acceptance:api

  # Specific channel subset or all 5 channels (moodle, canvas, blackboard, lti-generic, brightspace):
  QA_TASK=K1 QA_KIT_CHANNELS=all npm run acceptance:api
  ```
