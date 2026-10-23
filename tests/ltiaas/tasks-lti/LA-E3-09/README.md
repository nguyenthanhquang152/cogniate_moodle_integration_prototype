# LA-E3-09 QA Suite — Canvas Dynamic Registration in LTI Service (Profile Rule + Staged)

- **Owner:** QA-4 (`tests/ltiaas/tasks-lti/LA-E3-09/**`)
- **Lane:** `L`
- **Sources:**
  - `docs/architecture/ltiaas/tasks/LA-E3-09.md` (`AC-LA-E3-09-01` .. `AC-LA-E3-09-05`)
  - `docs/architecture/ltiaas/adr/LA-ADR-05-lti-advantage-completeness.md` D6
  - `docs/architecture/ltiaas/adr/LA-ADR-02-generic-lti-channel.md` D2, D5
  - `docs/architecture/ltiaas/adr/LA-ADR-04-refactor-and-migration.md` D8 `LA-IC-14`
  - `docs/architecture/ltiaas/build-decisions-A1.md` (`BD-A1-105`, `BD-A1-106`, `BD-A1-107`, `BD-A1-109`)
  - `docs/architecture/ltiaas/build-decisions-A2.md` (`BD-A2-89`, `BD-A2-92`, `BD-A2-93`, `BD-A2-94`, `BD-A2-95`)

## Suites

1. `canvas-dr.k0.test.ts` (`LA_LEVEL=k0`, host-only):
   - Static & contract checks for all 5 Canvas profiles (`dynamicRegistration` trait with `issuerRule: 'profile'`, `registrationToken: 'opaque-bearer'`, and the 3 Canvas `toolConfigurationExtensions`), kernel `ProfileSource` & LTI schema (`BD-A1-105`, `BD-A1-109`), profile-issuer DR origin rule & always-staged completion (`BD-A2-89`), pre-fetch floor Options A & Y (`BD-A2-93`, `BD-A2-94`, `BD-A2-95`), and `LA-IC-14`.
   - Fitness `F1` (`lms-names`) and `F5` (`rules`) checks on `packages/channel-kernel/src/profiles.ts`, `services/lti-service/src/profiles/schema.ts`, `services/lti-service/src/lti/registration.ts`, `services/lti-service/src/http/routes/registration.ts`, and `packages/channels/canvas/lti-profiles.ts`.
   - `AC-LA-E3-09-05` (`UNIT`) mixed-registry pre-fetch floor test + Author unit suites (`profiles/canvas.test.ts`, `profiles/traits.test.ts`, `lti/registration.test.ts`, `http/routes/registration.test.ts`, `packages/channel-kernel/src/profiles.test.ts`) + `npm run test:k0`.

2. `canvas-dr.k1sim.test.ts` (`LA_LEVEL=k1sim`, Docker SIM slot):
   - `AC-LA-E3-09-01` & `AC-LA-E3-09-02`: Canvas-shaped simulator Dynamic Registration creates an inactive platform (`active: false`) with the session's `bindingRef`, and sends the three Canvas extension members (`privacy_level: 'anonymous'`, `tool_id: 'cogniate'`, `vendor: 'Cogniate'`) and the four AGS scopes (`AP-05-29`).
   - `AC-LA-E3-09-03`: Before the grant, learner login is refused with `403 PLATFORM_NOT_ACTIVE`; after `app:grant issue` and redemption, the launch passes (`AP-05-29`).
   - `AC-LA-E3-09-04`: Configuration whose issuer is not the profile issuer, or with one endpoint that differs from the filled profile value, gives the refusal page with no platform row and no registration request at the simulator (`AP-05-30`).
   - `AC-LA-E3-09-05` (live stack check): Mixed-registry pre-fetch floor on `GET /lti/register/:account`.

## Commands

```bash
# Host-only K0 + UNIT gate
LA_LEVEL=k0 QA_REPO_ROOT="$CLONE" LA_TARGET_ROOT="$CLONE" \
  npx vitest run --config tests/ltiaas/tasks-lti/LA-E3-09/vitest.config.mts

# K1-SIM (Docker SIM slot)
QA_TASK=LA-E3-09 npm run stack:test
```
