# LA-E3-03 QA Test Suite — Launch without context

Authored by QA-4 (independent test author, lane L2) from only:
- `docs/architecture/ltiaas/tasks/LA-E3-03.md`
- `docs/architecture/ltiaas/adr/LA-ADR-05-lti-advantage-completeness.md` D2
- `docs/architecture/ltiaas/adr/LA-ADR-03-learning-record-core.md` D2
- `docs/architecture/ltiaas/contracts/lti-service-api-delta.md` §4.1
- `docs/architecture/ltiaas/adr/LA-ADR-04-refactor-and-migration.md` D8 (`LA-IC-05`)

## Files
- `launch-without-context.k0.test.ts` — Host-only K0 static, F1/F5 fitness, and UNIT test runner (`AC-LA-E3-03-07`, `AC-LA-E3-03-08`).
- `launch-without-context.k1sim.test.ts` — K1-SIM acceptance tests (`AC-LA-E3-03-01`..`AC-LA-E3-03-06`, gated on `RUN_LA_SIM_TESTS=1`).
