# LA-E3-11: AGS extras: submission times, `scoringUserId`, URL-keyed members

Owner: QA-4 (lane L).
Spec: `docs/architecture/ltiaas/tasks/LA-E3-11.md`.
Design: `LA-ADR-05` D9; contract delta §4.3 (`submission`, `scoringUserId`, URL-keyed members).

## Suites

- `ags-extras.k0.test.ts`: Host-only (`LA_LEVEL=k0`) static, F1/F5 and unit checks for `AC-LA-E3-11-03` and `AC-LA-E3-11-05`.
- `ags-extras.k1sim.test.ts`: SIM-slot (`LA_LEVEL=k1sim`) HTTP/simulator acceptance tests for `AC-LA-E3-11-01` .. `AC-LA-E3-11-05`.
