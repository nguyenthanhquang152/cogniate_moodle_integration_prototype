# LA-E3-05 Acceptance & Verification Suite (`QA-4`)

Task: **LA-E3-05 — Deep Linking completeness: picker multi-select, cancel and `acceptLineItem`** (Lane `L2`).

## Sources

- `docs/architecture/ltiaas/tasks/LA-E3-05.md`
- `docs/architecture/ltiaas/adr/LA-ADR-05-lti-advantage-completeness.md` D3 (`AP-05-12`..`AP-05-18`, `BD-A2-87`)
- `docs/architecture/ltiaas/data-model.md` §5b (`picker_pick`, app migration `018`)

## Suites

- `picker-completeness.k0.test.ts` (`LA_LEVEL=k0`, host-only):
  - Verifies app migration `018` (`picker_pick` table and backfill from `picker_session`), cancel route (`POST /tool/picker/{pickerId}/cancel`, `"No course was added."`), `PLACEMENT_NOT_GRADED` (`403`, `picker_rejected {reason: "placement_not_graded"}`), and multi-select (`1..20` items in list order, `PUBLICATION_NOT_AVAILABLE`).
  - Runs `F1` (`npm run fitness:lms-names`) and `F5` (`npm run fitness:rules`) on `services/cogniate-app/src/tool-pages/picker.ts`, `services/cogniate-app/src/domain/pickers.ts`, `services/cogniate-app/src/domain/launch.ts`, and migration `018`.
  - Runs the `cogniate-app` unit and migration suites for `AC-LA-E3-05-09` and `AC-LA-E3-05-10`.
- `picker-completeness.k1sim.test.ts` (`LA_LEVEL=k1sim`, SIM Docker slot):
  - Covers `AC-LA-E3-05-01`, `02`, `03`, `05`, `06`, `07`, `08`, `12` (`pending: Docker window`).
- `AC-LA-E3-05-04` and `AC-LA-E3-05-11` (`MOODLE-LIVE`, QA-E2E): `pending: Docker window`.
