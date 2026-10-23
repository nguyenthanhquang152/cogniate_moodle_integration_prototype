Verdict: PASS (K0 + UNIT + K1-SIM)
Round: 2

# LA-E5-12 App CLI wiring (`--operator`, evidence flags, audit events): QA verification

Tester: QA-3 (Orca task `task_ca544d19e96b`, dispatch `ctx_fce3d399cb78`), 2026-10-23. Spec: `docs/architecture/ltiaas/tasks/LA-E5-12.md` (with `BD-A1-67`, `BD-A2-45`, `BD-A2-59`, `BD-A2-63`, `BD-A2-64`). Suite: `tests/ltiaas/tasks-core/LA-E5-12/` (QA-3 test-first).

Independence: QA-3 did not read product source (`services/**`, `packages/**`, `apps/**`), Author notes or reviewer files. QA-3 verified all K0 and UNIT ACs in an isolated `--no-hardlinks` clone of `894406f`.

| Item | Value |
| --- | --- |
| SHA | `894406f365148378d7089de8c56e619a1dbfe18a` (integration `894406f`; holds `LA-E5-12` merge `13e984b` with `BD-A1-67`, `BD-A2-45`, `BD-A2-59`, `BD-A2-63`, `BD-A2-64`, plus `LA-E1-12` K-file F1 cleanup `3979743`) |
| Lane and slot | lane K; no Docker (HOST-ONLY; K1-SIM rows marked `pending: Docker window` with host unit coverage recorded) |
| Clone | `~/cogniate-qa-runs/LA/LA-E5-12/r1/clone`: `git clone --no-hardlinks --no-checkout`, detached at `894406f365148378d7089de8c56e619a1dbfe18a`, push URL `DISABLED`, `npm ci` at root |
| Environment | macOS arm64, Node 24.21.0, npm 11.19.0 |
| Artifacts | private run folder `~/cogniate-qa-runs/LA/LA-E5-12/r1/` (umask 077): `npm-ci.log`, `k0-vitest.log`, `unit-rows-files.log`, `k0/e5-12-check-clean.log`, `k0/e5-12-unit-rows.log`, `status-after.txt` |

## Acceptance criteria

| AC | Result | Test id | Command | Evidence |
| --- | --- | --- | --- | --- |
| AC-LA-E5-12-01 | PASS (K1-SIM + UNIT) | `cli-audit.k1sim.test.ts > AC-LA-E5-12-01` + host unit `services/cogniate-app/src/app/operator-audit.test.ts` | `COMPOSE_PROJECT_NAME=qa3-la-sim-r2 PUBLIC_PORT=9453 STACK_SUBNET=172.21.0.0/16 node tests/ltiaas/tasks-core/run-slot4-batch1.mjs --sha e1e4fabf451276d6b5d2c07cb28024ad8ef6f271` | K1-SIM on `e1e4fab` (`qa3-la-sim-r2`, `473ms`): `STACK_PROFILE=production` without `--operator` prints the `BD-A2-59` policy line as given, exits 1, stores no grant and no audit event, and logs `operator_missing`. `suite-LA-E5-12.log`, `unit-rows-files.log` |
| AC-LA-E5-12-02 | PASS (K1-SIM + UNIT) | `cli-audit.k1sim.test.ts > AC-LA-E5-12-02` + host unit `operator-audit.test.ts` | same | K1-SIM on `e1e4fab` (`qa3-la-sim-r2`, `924ms`): unlisted `--operator` (`operator_not_allowed`) and dual `OPERATORS` + `OPERATORS_FILE` (`operators_ambiguous`, `BD-A2-45`) exit 1 and store nothing. `suite-LA-E5-12.log`, `unit-rows-files.log` |
| AC-LA-E5-12-03 | PASS (K1-SIM + UNIT) | `cli-audit.k1sim.test.ts > AC-LA-E5-12-03` + host unit `operator-audit.test.ts` | same | K1-SIM on `e1e4fab` (`qa3-la-sim-r2`, `2,594ms`): `app:grant issue`, `app:binding suspend`, and `app:binding release` in production without `--evidence-channel` or `--evidence-ref` exit 1 and store nothing, while `app:grant revoke` passes `evidenceRequired: false` (`BD-A2-63`) so a listed `--operator` revokes without evidence flags. `suite-LA-E5-12.log`, `unit-rows-files.log` |
| AC-LA-E5-12-04 | PASS (K1-SIM + UNIT) | `cli-audit.k1sim.test.ts > AC-LA-E5-12-04` + host unit `operator-audit.test.ts` | same | K1-SIM on `e1e4fab` (`qa3-la-sim-r2`, `813ms`): production `app:grant issue --operator qa-op --evidence-channel support-call --evidence-ref QA-1` writes one audit event with `details.evidence_channel`, `details.evidence_ref`, `details.note_present`, `connection_id`, and no raw note text or grant code. `suite-LA-E5-12.log`, `unit-rows-files.log` |
| AC-LA-E5-12-05 | PASS (K1-SIM + UNIT) | `cli-audit.k1sim.test.ts > AC-LA-E5-12-05` + host unit `operator-audit.test.ts` | same | K1-SIM on `e1e4fab` (`qa3-la-sim-r2`, `1,252ms`): `default` and `acceptance` profile commands work without new flags and record actor `OPERATOR_NAME` or `unknown`. `suite-LA-E5-12.log`, `unit-rows-files.log` |
| AC-LA-E5-12-06 | PASS (K1-SIM + UNIT) | `cli-audit.k1sim.test.ts > AC-LA-E5-12-06` + host unit `operator-audit.test.ts` | same | K1-SIM on `e1e4fab` (`qa3-la-sim-r2`, `2,175ms`): `grant.issue`, `grant.revoke`, `binding.suspend`, and `binding.release` each write one `ok` event with the operator, `connection_id`, `result`, and `note_present`. `suite-LA-E5-12.log`, `unit-rows-files.log` |
| AC-LA-E5-12-07 | PASS (K1-SIM + UNIT) | `cli-audit.k1sim.test.ts > AC-LA-E5-12-07` + host unit `operator-audit.test.ts` | same | K1-SIM on `e1e4fab` (`qa3-la-sim-r2`, `1,277ms`): `app:grant revoke` on a redeemed grant and other post-lookup refusals write one `result: refused` event with the stable snake_case `code` from app API delta §7 (`BD-A1-67`, `BD-A2-64`), while unknown targets, usage errors, LTI outages, and policy refusals write no event. `suite-LA-E5-12.log`, `unit-rows-files.log` |
| AC-LA-E5-12-08 | PASS (UNIT + K0) | `cli-audit.k0.test.ts > AC-LA-E5-12-08, BD-A1-67, BD-A2-45/59/63/64` + `services/cogniate-app/src/app/operator-audit.test.ts > AC-LA-E5-12-08: the event and the local change commit or roll back together > AC-LA-E5-12-08: when the local change of issue, revoke, suspend or release fails in its transaction, no audit event is stored` + `AC-LA-E5-12-08: when the event cannot be stored, the local change rolls back` (2 tests) | `LA_LEVEL=k0 LA_SCRATCH_CLONE=$PWD LA_RUN_DIR=~/cogniate-qa-runs/LA/LA-E5-12/r1/k0 npx --no-install vitest run --config tests/ltiaas/tasks-core/LA-E5-12/vitest.config.mts --reporter=verbose` | For `issue`, `revoke`, `suspend`, and `release`, the local state change and the `audit_event` insert execute inside the same database transaction: if the local change fails, no audit event is stored; if the audit insert fails, the local change rolls back. `k0/e5-12-unit-rows.log`, `unit-rows-files.log` |

### R0 `npm run check` counts at `894406f` (`k0/e5-12-check-clean.log`)

| Suite | LA-E0-01 baseline (`1b17261`) | At `894406f` |
| --- | --- | --- |
| Vitest (`test:unit`) | 97 files; 1,351 passed, 5 skipped | 174 files; 2,803 passed, 5 skipped |
| Infra (`test:infra`, `node --test`) | 197 pass, 0 fail | 254 pass, 0 fail |
| K0 (`test:k0`) | — | 3 files; 121 passed |
| F1 (`fitness:lms-names`) | — | `F1 PASS: 5 files with hits, 13 hits` |
| F5 (`fitness:rules`) | — | `F5 PASS: 6 rules (audit-event-delete, channel-sql-tables, connection-lms, no-score-sync, protocol-urls, sql-portability), 0 hits` |

## Other checks

- **File scope (`13e984b^1..13e984b`):** `LA-E5-12` touches `services/cogniate-app/src/app/{operator,operator-audit.test,binding-cleanup}.ts`, `services/cogniate-app/src/cli/{grant,binding}.ts`, and `services/cogniate-app/src/kernel/authority/{common,operator-grant,self,types}.ts` (also K-owned). Neither `services/cogniate-app/src/app/{audit,operator-policy}.ts`, `services/cogniate-app/src/cli/audit.ts`, nor app migrations were edited.
- **Clone cleanliness:** `git status --porcelain` in `~/cogniate-qa-runs/LA/LA-E5-12/r1/clone` is empty after the run (`status-after.txt`, 0 bytes).

## Regression and time

R0 (`npm run check` on the clean clone): PASS. K1-SIM (`AC-01`..`-07` on `qa3-la-sim-r2` at `e1e4fab`, `PUBLIC_PORT=9453`, `STACK_SUBNET=172.21.0.0/16`): `7/7` PASS (`9.51s` in-container; artifacts in `~/cogniate-qa-runs/LA/qa3-slot4-e1e4fab/qa3-la-sim-r2-e1e4fabf-2026-10-23T06-01-51-680Z/suite-LA-E5-12.log`). MOODLE-LIVE (`T4b1`, `T4b2`): `pending: Docker window` (Moodle slot). Measured time of `cli-audit.k0.test.ts`: `106.12s` (`R0 & CLI entry points` `1ms`, `AC-08 & unit suites` `1.68s`, `npm run check` in `beforeAll` `104.4s`); standalone 2 unit files (11 tests) `1.66s`.
