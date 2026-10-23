# LA-E3-12: Small spec gaps (`scoreGiven: null`, NRPS `service_versions`, `trustedAudiences`)

Owner: QA-4 (lane L).
Spec: `docs/architecture/ltiaas/tasks/LA-E3-12.md`.
Design: `LA-ADR-05` D10; `LA-ADR-07` D8; contract delta §4.3, §4.4, §4.6; `LA-ADR-04` D8 `LA-IC-13`.

## Suites

- `small-spec-gaps.k0.test.ts`: Host-only (`LA_LEVEL=k0`) static, F1/F5 and unit checks for `AC-LA-E3-12-04` (plus unit checks for `scoreGiven: null`, NRPS `service_versions`, check 5 `trustedAudiences`, and migration `018`).
- `small-spec-gaps.k1sim.test.ts`: SIM-slot (`LA_LEVEL=k1sim`) HTTP/simulator acceptance tests for `AC-LA-E3-12-01` .. `AC-LA-E3-12-05`.
