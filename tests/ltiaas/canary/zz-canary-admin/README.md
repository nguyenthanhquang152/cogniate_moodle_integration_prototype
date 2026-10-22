# Canary Admin LMS (`zz-canary-admin`)

Test-only admin-value channel folder without `app.ts` (`tests/ltiaas/k0/contract.test.ts`, LA-E7-01, LA-E2-03 AC-05).
Demonstrates an admin-value LTI 1.3 channel (`endpoints: 'admin'`, `lti.toolConfiguration: 'none'`) served by the kernel admin-value setup adapter with no `app.ts`.

To use this folder as a template for an admin-value channel without `app.ts`:
1. Copy the folder to `packages/channels/<channel-id>/`.
2. Update `id`, `names`, `card` (`order` to a product order), `availability`, and `registration` profiles in `manifest.ts`.
3. Define the `endpoints: 'admin'` profiles in `lti-profiles.ts` (`privacyFloor: 'allowlist'`, `wireLms` omitted).

## Channel facts

| Fact | Value | Source |
| --- | --- | --- |
| Channel id | `zz-canary-admin` | LA-E7-01, LA-E2-03 AC-05 |
| Availability | `simulation-only` (test-only; `card.order: 991`) | LA-ADR-01 D4 |
| Registration | `manual` with `operatorGrant`, profile `zz-canary-admin-sim` (`endpoints: admin`) | LA-ADR-01 D5 |
| Tool configuration | `none` (no `app.ts`; kernel admin-value setup adapter) | LA-ADR-01 D5 |
| `records.readBack` | `false` (exercises the `records.readBack` capability guard in K0) | LA-ADR-01 D3 |
