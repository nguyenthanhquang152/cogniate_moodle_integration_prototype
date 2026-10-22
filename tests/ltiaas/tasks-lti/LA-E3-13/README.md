# LA-E3-13: Deep Linking per-type item fields (D3e)

Owner: QA-4 (lane L2).
Spec: `docs/architecture/ltiaas/tasks/LA-E3-13.md`.
Design: `LA-ADR-05` D3e; contract delta §4.2 ("Per type" row).

## Suites

- `deep-linking-per-type.k0.test.ts`: Host-only (`LA_LEVEL=k0`) static, F1/F5 and unit checks for `AC-LA-E3-13-01` and `AC-LA-E3-13-02`.
- `deep-linking-per-type.k1sim.test.ts`: SIM-slot (`LA_LEVEL=k1sim`) HTTP/simulator acceptance tests for `AC-LA-E3-13-01` .. `AC-LA-E3-13-04`.
