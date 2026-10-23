Verdict: PASS (K0 + UNIT + K1-SIM)
Round: 2

# LA-E5-14 Platform throttling answer `429 PLATFORM_RATE_LIMITED`: QA verification

Tester: QA-4 (Orca task `task_ab4dd9ea915c`, dispatch `ctx_7cab5197cadd`), 2026-10-22. Spec: `docs/architecture/ltiaas/tasks/LA-E5-14.md` (with `BD-A2-15` and `BD-A2-16`). Suite: `tests/ltiaas/tasks-lti/LA-E5-14/` (QA-4 test-first, committed in `3efa55a`).

Independence: QA-4 did not read product source, Author notes or reviewer files to write `tests/ltiaas/tasks-lti/LA-E5-14/` or during this Round 1 run on `b3af690`. `throttling.k0.test.ts` checks `error-mapping.ts`, `token-client.ts`, `retry-after.ts` and `api-errors.ts` only through F1 (`npm run --silent fitness:lms-names -- --stdin --as <path>`) and boolean `.includes()` assertions that never print file contents, and discovers Author unit tests by name through the Vitest reporter. (Run-2 disclosure carried forward for completeness: during fail-closed K0 testing of `LA-E3-04` and `LA-E3-01` on `104793a` in run 2, Vitest's `toContain` failure diff printed snippets of `idtoken.ts` and `login.ts`, after which all static K0 checks in `LA-E5-14`, `LA-E3-04`, `LA-E3-06` and `LA-E3-01` were switched to boolean `.includes()`/regex assertions; zero product source was printed in run 3.)

| Item | Value |
| --- | --- |
| SHA | `b3af69059a6529b1b2882b72c1869b50749f91e6` (integration `b3af690`; holds the LA-E5-14 product merge `3c7221d8ea7d08f5da30a60cd747439e401b0784` and QA-4's suite `3efa55a`) |
| Lane and slot | lane L (with RQ-2 commits for `api-errors.ts`, `http/retry-after.ts`, `http/app.ts` and `lti/codes.ts`); no Docker (HOST-ONLY; another run holds exclusive Docker) |
| Clone | `~/cogniate-qa-runs/LA/LA-E5-14/r1/clone`: `git clone --no-hardlinks --no-checkout`, detached at `b3af69059a6529b1b2882b72c1869b50749f91e6`, push URL `DISABLED`, `npm ci` at root |
| Environment | macOS arm64, Node 24.21.0, npm 11.19.0 |
| Artifacts | private run folder `~/cogniate-qa-runs/LA/LA-E5-14/r1/` (umask 077): `npm-ci.log`, `k0-vitest.log`, `k0/e5-14-k0.json`, `k0/e5-14-unit.log`, `unit-rows-files-verbose.log`, `check.log`, `e5-14-merge-files.txt`, `rev.txt`, `remotes.txt`, `status-after.txt` |

## Acceptance criteria

| AC | Result | Test id | Command | Evidence |
| --- | --- | --- | --- | --- |
| AC-LA-E5-14-01 | PASS (K1-SIM + UNIT) | `throttling.k1sim.test.ts > [SIM] AC-LA-E5-14-01` (`{case:LA-E5-14-01}`) | Docker Slot 5 (`qa4-la-sim-r1`, `d12b7b94`) | Live simulator score POST `429` with `Retry-After: 120` returns `429` with `details.message: 'PLATFORM_RATE_LIMITED'`, header `Retry-After: 120`, `details.retryAfter: 120`, and fixed description `'The platform asked us to wait before another request.'` (`5/5` K1-SIM tests pass in `1701ms`; `LA-E5-14-k1sim.log`, `all-17-k1sim.log`). |
| AC-LA-E5-14-02 | PASS (K1-SIM + UNIT) | `throttling.k1sim.test.ts > [SIM] AC-LA-E5-14-02` (`{case:LA-E5-14-02}`) | Docker Slot 5 (`qa4-la-sim-r1`, `d12b7b94`) | Live simulator `403` with `Rate Limit Exceeded` in body returns `429 PLATFORM_RATE_LIMITED`, while `403` with another body keeps `502 PLATFORM_ERROR` (`LA-E5-14-k1sim.log`, `all-17-k1sim.log`). |
| AC-LA-E5-14-03 | PASS (K1-SIM + UNIT) | `throttling.k1sim.test.ts > [SIM] AC-LA-E5-14-03` (`{case:LA-E5-14-03}`) | Docker Slot 5 (`qa4-la-sim-r1`, `d12b7b94`) | Live simulator token endpoint `429` without `Retry-After` returns `429 PLATFORM_RATE_LIMITED` with `Retry-After: 60` and `details.retryAfter: 60` (`LA-E5-14-k1sim.log`, `all-17-k1sim.log`). |
| AC-LA-E5-14-04 | PASS (K1-SIM) | `throttling.k1sim.test.ts > [SIM] AC-LA-E5-14-04` (`{case:LA-E5-14-04}`) | Docker Slot 5 (`qa4-la-sim-r1`, `d12b7b94`) | Live simulator `GET` memberships `429` returns `429 PLATFORM_RATE_LIMITED` on `GET /api/memberships` (`LA-E5-14-k1sim.log`, `all-17-k1sim.log`). |
| AC-LA-E5-14-05 | PASS (K1-SIM + UNIT) | `throttling.k1sim.test.ts > [SIM] AC-LA-E5-14-05` (`{case:LA-E5-14-05}`) | Docker Slot 5 (`qa4-la-sim-r1`, `d12b7b94`) | One throttled score POST records 1 simulator score request with no automatic retry and logs 1 `platform_rate_limited {platform_id, status, retry_after_s}` event (`LA-E5-14-k1sim.log`, `lti-service-after-LA-E5-14.log`, `all-17-k1sim.log`). |
| AC-LA-E5-14-06 | PASS (UNIT + K0) | `throttling.k0.test.ts > AC-LA-E5-14-06 (K0 + F1)` + Author tests: `services/lti-service/src/platform/error-mapping.test.ts > platform Retry-After (AC-LA-E5-14-06)` (15 cases), `> platform throttle errors` (7 cases), `services/lti-service/src/http/retry-after.test.ts > Retry-After seconds (BD-A2-16)` (11 cases), `> API error Retry-After header and body` (8 cases), `services/lti-service/src/platform/token-client.test.ts > token client throttle handling` (6 cases), `services/lti-service/src/api-errors.test.ts > LTI service API codes (contract §1.3)` (2 cases) | `LA_LEVEL=k0 QA_REPO_ROOT=$PWD LA_SCRATCH_CLONE=$PWD LA_RUN_DIR=~/cogniate-qa-runs/LA/LA-E5-14/r1/k0 npx --no-install vitest run --reporter=verbose --config tests/ltiaas/tasks-lti/LA-E5-14/vitest.config.mts` and `npx --no-install vitest run --reporter=verbose services/lti-service/src/platform/error-mapping.test.ts services/lti-service/src/platform/token-client.test.ts services/lti-service/src/http/retry-after.test.ts services/lti-service/src/api-errors.test.ts` | `Retry-After: 7200` → `3600`, `0` → `1`, `120` → `120`, HTTP date 90 s ahead → `90` (plus RFC 850 and ANSI C GMT forms), `undefined` / empty / unreadable / fractional / negative / `Infinity` / multi-value / overflow → `60`; generic `retryAfterSeconds` rule in `services/lti-service/src/http/retry-after.ts` (BD-A2-16) and fixed description `'The platform asked us to wait before another request.'` in `api-errors.ts` (BD-A2-15); F1 count `0` on `error-mapping.ts`, `token-client.ts`, and `retry-after.ts` (RQ-3). Reviewer-B checks test quality. `k0/e5-14-k0.json`, `k0/e5-14-unit.log`, `unit-rows-files-verbose.log`, `k0-vitest.log` |

### R0 `npm run check` counts (`check.log`)

| Count | LA-E0-01 (`1b17261`) | `b3af690` |
| --- | --- | --- |
| Vitest (`test:unit`) | 70 files; 1,123 passed, 5 skipped | 113 files; 2,013 passed, 5 skipped |
| Infra (`node --test`) | 111 pass, 0 fail (14 suites) | 207 pass, 0 fail (21 suites) |
| K0 (`test:k0`) | — | 3 files; 118 passed, 3 todo |
| Fitness (`fitness:lms-names`, `fitness:rules`) | — | F1 PASS (74 files with hits, 590 hits); F5 PASS (3 rules, 0 hits) |

`git status --porcelain` in the clone is empty after the run (`status-after.txt`).

## Other checks

- The LA-E5-14 merge `3c7221d` edits `services/lti-service/src/platform/{error-mapping,error-mapping.test,token-client,token-client.test,ags,nrps}.ts`, `services/lti-service/src/{main,testkit}.ts`, and the RQ-2 files `services/lti-service/src/{api-errors,api-errors.test}.ts`, `services/lti-service/src/http/{retry-after,retry-after.test,app}.ts`, `services/lti-service/src/lti/codes.ts` (`e5-14-merge-files.txt`), and touches no app files.
- All three F1 core files of this task (`services/lti-service/src/platform/error-mapping.ts`, `services/lti-service/src/platform/token-client.ts`, `services/lti-service/src/http/retry-after.ts`) have `0` F1 hits and `0` in `infra/scripts/fitness/f1-baseline.json` (`k0/e5-14-k0.json`).

## Regression and time

R0: `npm run check` on the clean clone (PASS, 110.86 s). Area regressions (T2a, T2b, T3a, T3b, T3c, T5a, T5b) and `AC-LA-E5-14-01` .. `AC-LA-E5-14-05` (`K1-SIM`) are pending a Docker window. Measured time of the K0 suite: `throttling.k0.test.ts` 5.82 s (`5,734 ms`, including the 21-file `platform` + `http` unit run); focused 4-file unit run (`error-mapping.test.ts`, `token-client.test.ts`, `retry-after.test.ts`, `api-errors.test.ts`): 1.12 s (49 tests).
