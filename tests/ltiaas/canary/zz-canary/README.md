# Canary LMS (`zz-canary`)

Test-only channel folder used by the K0 contract suite (`tests/ltiaas/k0/contract.test.ts`, LA-E7-01, fitness check F4).
K0 passes `tests/ltiaas/canary` as a second root to `loadChannelFolders`; the product registry (`packages/channels`) never loads this folder.

To use this folder as a template for a new channel with an `app.ts` adapter:
1. Copy the folder to `packages/channels/<channel-id>/`.
2. Update `id`, `names`, `card` (`order` to a product order), `availability` (from `'simulation-only'` to `'ga'` or `'preview'`), `registration` profiles, and `lti.guardedFamilies` in `manifest.ts`.
3. Define the real and simulation LTI 1.3 profiles in `lti-profiles.ts` (keep `wireLms` omitted).
4. Implement the `ConnectionSetup` port methods in `app.ts`.

## Channel facts

| Fact | Value | Source |
| --- | --- | --- |
| Channel id | `zz-canary` | LA-E7-01, LA-ADR-01 D4 |
| Availability | `simulation-only` (test-only; `card.order: 990`) | LA-ADR-01 D4 |
| Registration | `manual` with `operatorGrant`, profile `zz-canary-sim` (`endpoints: fixed`) | LA-ADR-01 D5, D6 |
| Tool configuration | `channel` (`app.ts` implements `ConnectionSetup`) | LA-ADR-01 D5 (BD-A1-20) |
