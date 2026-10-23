# LA-E3-16 — Canvas Dynamic Registration in the portal (`packages/channels/canvas/portal/**`)

QA-3 test-first suite for `docs/architecture/ltiaas/tasks/LA-E3-16.md` (`LA-ADR-05` D6, `LA-ADR-04` D5/D6, `B-LA-E3-16-01` / `ce9b4a6`).

## Modes

- `LA_LEVEL=k0` (`canvas-portal-dr.k0.test.ts` — host-only, no Docker):
  - Exclusive file-scope check on `4d31891` and `ce9b4a6` (`packages/channels/canvas/portal/**` and `apps/portal/src/{channels/ManifestWizard.tsx,sdk/index.ts}`; `0` edits to `packages/channels/canvas/{manifest.ts,app.ts,app/**}` or `services/**`) and `0` edits to `tests/acceptance/M2/**`.
  - `AC-LA-E3-16-01` (UNIT): With a Canvas manifest that has `manual` and `dynamic`, the create step shows both choices ("Developer key" `manual` selected by default, and "Dynamic Registration" `dynamic`); create with `dynamic` sends `method: "dynamic"`; create with `manual` sends the same request body as before; with a manifest that has only `manual`, no choice is shown.
  - `AC-LA-E3-16-02` (UNIT): A pending `dynamic` connection shows the registration URL with its copy button and expiry, and "Get registration URL" calls the renew route; it does not show the developer key JSON; a pending `manual` connection shows today's JSON step; once a `dynamic` connection is staged (`platform !== null`), renewal is not offered (`ce9b4a6` / `B-LA-E3-16-01`).
  - `AC-LA-E3-16-03` (UNIT): A pending `dynamic` connection with a staged platform shows Client ID and Deployment ID pre-filled from `platform.clientId` and `platform.deploymentIds[0]`, and an empty approval code; without a staged platform, it shows `"Finish the registration in Canvas. Then this page shows the values to check."` and no inputs.
  - `AC-LA-E3-16-05` (UNIT part): `packages/channels/canvas/portal/canvas.test.tsx` (and `apps/portal/src/channels/staged-wizard.test.tsx`) pass without edits to `tests/acceptance/M2/**`, and `canvas-steps.json` carries both `manual` and `dynamic` step instructions in STE.
- `LA_LEVEL=k1sim` (`canvas-portal-dr.k1sim.test.ts` — SIM Docker window):
  - `AC-LA-E3-16-04` (K1-SIM): Create a `dynamic` Canvas connection, run DR in the Canvas simulator, verify the staged platform pre-filled values (`platform.clientId`, `platform.deploymentIds[0]`), issue and redeem the operator grant, and reach `Active` (`status: 'registered'`).
