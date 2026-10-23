Verdict: PASS (K0 + UNIT + K1-SIM)
Round: 2

# LA-E3-03 Launch without context: QA verification

Tester: QA-4 (Orca task `task_aaffbc25c5d7`, dispatch `ctx_620bf870df9a`), 2026-10-23. Spec: `docs/architecture/ltiaas/tasks/LA-E3-03.md` (`LA-ADR-05` D2, `LA-ADR-03` D2, contract delta §4.1, `LA-ADR-04` D8 `LA-IC-05`). Suite: `tests/ltiaas/tasks-lti/LA-E3-03/` (QA-4 test-first).

Independence: QA-4 did not read product source (`services/**`, `packages/**`, `apps/**`), Author notes or reviewer files to author `tests/ltiaas/tasks-lti/LA-E3-03/`, and verified all host-only K0 and UNIT checks in an isolated `--no-hardlinks` clone of `e2f6c90` using boolean assertions that never print product source.

| Item | Value |
| --- | --- |
| SHA | `e2f6c904ba1a46f3e30a20fbd24d04d6ffbe93c7` (integration `e2f6c90`; holds `LA-E3-03` merge `a722724`) |
| Lane and slot | lane L2; no Docker (`HOST-ONLY`; `K1-SIM` rows marked `pending: Docker window`) |
| Clone | `~/cogniate-qa-runs/LA/qa4-r10-e2f6c90/clone`: `git clone --no-hardlinks --no-checkout`, detached at `e2f6c904ba1a46f3e30a20fbd24d04d6ffbe93c7`, push URL `DISABLED`, `npm ci` at root and `tests/` |
| Environment | macOS arm64, Node 24.21.0, npm 11.19.0 |
| Artifacts | private run folder `~/cogniate-qa-runs/LA/qa4-r10-e2f6c90/logs/` (umask 077): `npm-ci.log`, `npm-ci-tests.log`, `LA-E3-03-k0.log`, `e3-03-unit.log`, `rev.txt`, `remotes.txt`, `show-a722724.txt`, `status-after.txt` |

## Acceptance criteria

| AC | Result | Test id | Command | Evidence |
| --- | --- | --- | --- | --- |
| AC-LA-E3-03-01 | PASS (K1-SIM + UNIT) | `tests/ltiaas/tasks-lti/LA-E3-03/launch-without-context.k1sim.test.ts > AC-LA-E3-03-01 & AC-LA-E3-03-02 & AC-LA-E3-03-03` | Docker Slot 5 (`qa4-la-sim-r1`, `d12b7b94`) | Live learner launch without `context` claim and with AGS opens the player and syncs grade to the simulator (`4/4` K1-SIM tests pass in `74ms`; `LA-E3-03-k1sim.log`, `all-17-k1sim.log`). |
| AC-LA-E3-03-02 | PASS (K1-SIM + UNIT) | `launch-without-context.k1sim.test.ts > AC-LA-E3-03-01 & AC-LA-E3-03-02 & AC-LA-E3-03-03` | Docker Slot 5 (`qa4-la-sim-r1`, `d12b7b94`) | Live `GET /api/idtoken` for a launch without `context` returns `services.serviceKey` and omits `launch.context` (`LA-E3-03-k1sim.log`, `all-17-k1sim.log`). |
| AC-LA-E3-03-03 | PASS (K1-SIM + UNIT) | `launch-without-context.k1sim.test.ts > AC-LA-E3-03-01 & AC-LA-E3-03-02 & AC-LA-E3-03-03` | Docker Slot 5 (`qa4-la-sim-r1`, `d12b7b94`) | Live score POST with `serviceKey` from a context-free launch succeeds (`204`) and reaches the simulator (`LA-E3-03-k1sim.log`, `all-17-k1sim.log`). |
| AC-LA-E3-03-04 | PASS (K1-SIM + UNIT) | `launch-without-context.k1sim.test.ts > AC-LA-E3-03-04` | Docker Slot 5 (`qa4-la-sim-r1`, `d12b7b94`) | Live launch without `context`, AGS, and NRPS opens the player with no `services.serviceKey` (`LA-E3-03-k1sim.log`, `all-17-k1sim.log`). |
| AC-LA-E3-03-05 | PASS (K1-SIM + UNIT) | `launch-without-context.k1sim.test.ts > AC-LA-E3-03-05` | Docker Slot 5 (`qa4-la-sim-r1`, `d12b7b94`) | Two context-free launches of the same activity get the same `serviceKey`, while a different deployment or a launch with `context` gets a distinct `serviceKey` (`LA-E3-03-k1sim.log`, `all-17-k1sim.log`). |
| AC-LA-E3-03-06 | PASS (K1-SIM + UNIT) | `launch-without-context.k1sim.test.ts > AC-LA-E3-03-06` | Docker Slot 5 (`qa4-la-sim-r1`, `d12b7b94`) | Live launch without `sub` or without `resource_link.id` is refused with `400 MISSING_CLAIM` (`LA-E3-03-k1sim.log`, `all-17-k1sim.log`). |
| AC-LA-E3-03-07 | PASS (UNIT + K0) | `services/lti-service/src/lti/service-keys.test.ts > serviceKeyForLaunch without a context (LA-ADR-05 D2) > two launches of the same activity get the same key; context "c1" gives another (AC-LA-E3-03-07)` + `launch-without-context.k0.test.ts` | `npx --no-install vitest run --reporter=verbose services/lti-service/src/lti/service-keys.test.ts` | Two launches without context of the same activity produce the same service key value (`16ms`); a launch with context `"c1"` of the same resource link id produces another value; deployment and resource link differences also produce distinct keys (`10ms`). `LA-E3-03-k0.log`, `e3-03-unit.log`. |
| AC-LA-E3-03-08 | PASS (UNIT + K0) | `services/cogniate-app/src/tool-pages/launch.test.ts > launch without context (LA-E3-03) > a deep-linking ltik (AC-LA-E3-03-08) on /tool/launch still gives the INVALID_LTIK page with reason not_resource_link` + `a deep-linking ltik without a context on /tool/launch still gives the INVALID_LTIK page with reason not_resource_link` + `launch-without-context.k0.test.ts` | `npx --no-install vitest run --reporter=verbose services/cogniate-app/src/tool-pages/launch.test.ts` | A `LtiDeepLinkingRequest` ltik on `/tool/launch` (with or without `context`) and a resource launch without a resource link and without a context still return the `INVALID_LTIK` page with reason `not_resource_link` (`92ms`, `89ms`, `89ms`). `LA-E3-03-k0.log`, `e3-03-unit.log`. |

## Other checks

- **File scope (`a722724`):** `git show --stat a722724` touches only `services/lti-service/src/lti/service-keys.ts`, `services/lti-service/src/lti/service-keys.test.ts`, `services/cogniate-app/src/tool-pages/launch.ts`, and `services/cogniate-app/src/tool-pages/launch.test.ts`. Does not touch `store/service-keys.ts`, `domain/launch.ts`, `app/results.ts`, or `lti/checks.ts`.
- **F1 and F5 fitness (`LA-E3-03-k0.log`):** Both `services/lti-service/src/lti/service-keys.ts` and `services/cogniate-app/src/tool-pages/launch.ts` pass F1 (`fitness:lms-names`) and F5 (`fitness:rules`) checks (`1206ms`).
- **`LA-IC-05` reviewed test-change list (plan LD-9):** Confirmed 0 frozen tests touched (`TEST-STRATEGY §4.7`; no frozen test expected the old `!context` refusal on a valid `LtiResourceLinkRequest`).
- **Clone cleanliness:** `git status --porcelain` in `~/cogniate-qa-runs/LA/qa4-r10-e2f6c90/clone` is empty after the run (`status-after.txt`, 0 bytes).

## Regression and time

R0: PASS (`4.63s` K0 suite `LA-E3-03-k0.log`, `2.89s` focused 3-file unit run with 49 tests `e3-03-unit.log`). `K1-SIM` (`AC-LA-E3-03-01`..`06`) is `pending: Docker window`.
