# LA-E3-15 — Canvas Dynamic Registration, staged with an operator grant (`operatorGrant`)

QA-3 test-first suite for `docs/architecture/ltiaas/tasks/LA-E3-15.md` (`LA-ADR-05` D6, `LA-IC-14`, `BD-A1-103`, `BD-A1-104`, `BD-A1-106`, `BD-A1-107`).

## Modes

- `LA_LEVEL=k0` (`canvas-dr.k0.test.ts` — host-only, no Docker):
  - `R0`: `npm run check` on the clean clone + file-scope verification on `4a62acb6` (`2cc2aa5`), `07eab11d` (`dc98c43`), `d32a7a87` (`a03e15b`), and `75d81fad` (`dfe94ff`).
  - `AC-LA-E3-15-01` (K0): `capabilities('canvas')['binding.authority']` equals `{ manual: 'operatorGrant', dynamic: 'operatorGrant' }` and `capabilities('canvas')['registration.dynamic'] === true`.
  - `AC-LA-E3-15-02` (K0): `legacyCapabilities('canvas')` has `dynamicRegistration: true` and the other 5 flags unchanged; `npm run test:k0` passes.
  - `BD-A1-103` & `BD-A1-104`: Canvas `manifest.setup.bindingFields` includes the three `dynamic` rows (`clientId`, `deploymentId`, `grantCode`, `required: true`), and `packages/channels/canvas/README.md` Registration row describes `manual` and `dynamic` (always staged, both `operatorGrant`).
  - `BD-A1-106` & `BD-A1-107` (UNIT + in-process API/CLI checks for `AC-LA-E3-15-03` & `AC-LA-E3-15-04`):
    - `POST /app-api/connections` with `lms: 'canvas'`, `method: 'dynamic'` returns `201` with `bindingAuthority: 'operatorGrant'` and non-null `registrationUrl`.
    - `stageRegistration` accepts `binding_authority IN ('self', 'operatorGrant')`; `/tool/register` refuses an active `complete` answer on a non-`self` connection (`REGISTRATION_FAILED`, orphan deactivated).
    - `/tool/register` enforces fixed-issuer `registration.url === c.snapshot.issuer` before `complete` and staged `platform.siteUrl === connection.siteUrl` after `complete` (deactivating the staged platform on mismatch).
    - `app:grant issue` checks the staged Canvas platform (`client_id_mismatch`, `deployment_mismatch`, `staged_values_changed`), refuses `--accept-staged` on fixed-endpoint channels (`bound_values_not_allowed`), and issues a fixed-endpoint grant (`bound_values_json = null`) that redeems the staged Canvas connection via `{ clientId, deploymentId, grantCode }` and activates the existing staged platform without creating a second platform.
- `LA_LEVEL=k1sim` (`canvas-dr.k1sim.test.ts` — SIM Docker window):
  - `AC-LA-E3-15-03` (K1-SIM): Canvas DR on the Canvas simulator provider stages the platform (`active: false`), leaves `bindingAuthority: 'operatorGrant'` and `status: 'pending'`, and a learner launch gets `PLATFORM_NOT_ACTIVE`.
  - `AC-LA-E3-15-04` (K1-SIM): `app:grant issue` and redemption activate the staged Canvas platform (`active: true`); a learner launch and a score pass.
