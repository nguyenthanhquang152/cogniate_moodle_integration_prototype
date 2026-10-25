# LA-E5-18: Tenant ids in protocol log lines

Owner: QA-4 (lane L2).
Spec: `docs/architecture/ltiaas/tasks/LA-E5-18.md`.
Design: `LA-ADR-06` D10 (row "Tenant id in logs"); contract delta §6 (`login_rejected`, `launch_check_failed`, `launch_claims_minimized`, `launch_accepted`).

## Suites

- `protocol-tenant-logs.k0.test.ts`: Host-only (`LA_LEVEL=k0`) static, F1/F5 and unit checks for `AC-LA-E5-18-04` (plus unit checks for `AC-LA-E5-18-01` .. `05` in `login.test.ts` and `launch.test.ts`).
- `protocol-tenant-logs.k1sim.test.ts`: SIM-slot (`LA_LEVEL=k1sim`) HTTP/simulator acceptance tests for `AC-LA-E5-18-01` .. `AC-LA-E5-18-05`.
