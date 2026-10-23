Verdict: PASS (host-only K0 + UNIT; K1-SIM pending: Docker window)
Round: 1

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
| AC-LA-E3-03-01 | pending: Docker window (K1-SIM) | `tests/ltiaas/tasks-lti/LA-E3-03/launch-without-context.k1sim.test.ts > AC-LA-E3-03-01 & AC-LA-E3-03-02 & AC-LA-E3-03-03` | SIM Docker slot | Pending Docker window. Verified at host unit level in `services/cogniate-app/src/tool-pages/launch.test.ts > launch without context (LA-E3-03) > a learner launch with AGS opens the player; the resource link and the placement use context id "" (AC-LA-E3-03-01 at unit level)` (`93ms`; `e3-03-unit.log`). |
| AC-LA-E3-03-02 | pending: Docker window (K1-SIM) | `launch-without-context.k1sim.test.ts > AC-LA-E3-03-01 & AC-LA-E3-03-02 & AC-LA-E3-03-03` | SIM Docker slot | Pending Docker window. Verified at host unit level in `services/lti-service/src/lti/service-keys.test.ts > GET /api/idtoken of a launch without a context > has services.serviceKey and no launch.context (AC-LA-E3-03-02 at unit level)` (`102ms`; `e3-03-unit.log`). |
| AC-LA-E3-03-03 | pending: Docker window (K1-SIM) | `launch-without-context.k1sim.test.ts > AC-LA-E3-03-01 & AC-LA-E3-03-02 & AC-LA-E3-03-03` | SIM Docker slot | Pending Docker window (`e3-03-unit.log`). |
| AC-LA-E3-03-04 | pending: Docker window (K1-SIM) | `launch-without-context.k1sim.test.ts > AC-LA-E3-03-04` | SIM Docker slot | Pending Docker window. Verified at host unit level in `services/cogniate-app/src/tool-pages/launch.test.ts > launch without context (LA-E3-03) > without AGS and NRPS it still opens the player; no line item and no service key are stored (AC-LA-E3-03-04 at unit level)` (`95ms`) and `service-keys.test.ts > an NRPS claim alone also gives a key; no AGS and no NRPS gives none` (`17ms`; `e3-03-unit.log`). |
| AC-LA-E3-03-05 | pending: Docker window (K1-SIM) | `launch-without-context.k1sim.test.ts > AC-LA-E3-03-05` | SIM Docker slot | Pending Docker window. Verified at host unit level in `services/cogniate-app/src/tool-pages/launch.test.ts > launch without context (LA-E3-03) > two launches of one activity use one placement; another deployment or a context gives another (AC-LA-E3-03-05 at unit level)` (`91ms`; `e3-03-unit.log`). |
| AC-LA-E3-03-06 | pending: Docker window (K1-SIM) | `launch-without-context.k1sim.test.ts > AC-LA-E3-03-06` | SIM Docker slot | Pending Docker window. Verified at host unit level in `services/lti-service/src/lti/checks.test.ts > check 11: required claims > fails MISSING_CLAIM: no sub`. |
| AC-LA-E3-03-07 | PASS (UNIT + K0) | `services/lti-service/src/lti/service-keys.test.ts > serviceKeyForLaunch without a context (LA-ADR-05 D2) > two launches of the same activity get the same key; context "c1" gives another (AC-LA-E3-03-07)` + `launch-without-context.k0.test.ts` | `npx --no-install vitest run --reporter=verbose services/lti-service/src/lti/service-keys.test.ts` | Two launches without context of the same activity produce the same service key value (`16ms`); a launch with context `"c1"` of the same resource link id produces another value; deployment and resource link differences also produce distinct keys (`10ms`). `LA-E3-03-k0.log`, `e3-03-unit.log`. |
| AC-LA-E3-03-08 | PASS (UNIT + K0) | `services/cogniate-app/src/tool-pages/launch.test.ts > launch without context (LA-E3-03) > a deep-linking ltik (AC-LA-E3-03-08) on /tool/launch still gives the INVALID_LTIK page with reason not_resource_link` + `a deep-linking ltik without a context on /tool/launch still gives the INVALID_LTIK page with reason not_resource_link` + `launch-without-context.k0.test.ts` | `npx --no-install vitest run --reporter=verbose services/cogniate-app/src/tool-pages/launch.test.ts` | A `LtiDeepLinkingRequest` ltik on `/tool/launch` (with or without `context`) and a resource launch without a resource link and without a context still return the `INVALID_LTIK` page with reason `not_resource_link` (`92ms`, `89ms`, `89ms`). `LA-E3-03-k0.log`, `e3-03-unit.log`. |

## Other checks

- **File scope (`a722724`):** `git show --stat a722724` touches only `services/lti-service/src/lti/service-keys.ts`, `services/lti-service/src/lti/service-keys.test.ts`, `services/cogniate-app/src/tool-pages/launch.ts`, and `services/cogniate-app/src/tool-pages/launch.test.ts`. Does not touch `store/service-keys.ts`, `domain/launch.ts`, `app/results.ts`, or `lti/checks.ts`.
- **F1 and F5 fitness (`LA-E3-03-k0.log`):** Both `services/lti-service/src/lti/service-keys.ts` and `services/cogniate-app/src/tool-pages/launch.ts` pass F1 (`fitness:lms-names`) and F5 (`fitness:rules`) checks (`1206ms`).
- **`LA-IC-05` reviewed test-change list (plan LD-9):** Confirmed 0 frozen tests touched (`TEST-STRATEGY §4.7`; no frozen test expected the old `!context` refusal on a valid `LtiResourceLinkRequest`).
- **Clone cleanliness:** `git status --porcelain` in `~/cogniate-qa-runs/LA/qa4-r10-e2f6c90/clone` is empty after the run (`status-after.txt`, 0 bytes).

## Regression and time

R0: PASS (`4.63s` K0 suite `LA-E3-03-k0.log`, `2.89s` focused 3-file unit run with 49 tests `e3-03-unit.log`). `K1-SIM` (`AC-LA-E3-03-01`..`06`) is `pending: Docker window`.
