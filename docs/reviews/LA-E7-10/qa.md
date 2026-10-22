Verdict: FAIL
Round: 1

# LA-E7-10 Local CI script: QA verification

Tester: QA-3 (Orca task `task_7f8563662a4f`, dispatch `ctx_c82a2585129a`), 2026-10-22. Spec: `docs/architecture/ltiaas/tasks/LA-E7-10.md`. Suite: `tests/ltiaas/tasks-core/LA-E7-10/` (QA-3 test-first).

Independence: QA-3 did not read product source, Author notes or reviewer files. QA-3 ran `npm run ci:local` and `node --test infra/scripts/ci-local.test.mjs`, and read `infra/scripts/ci-local.sh` only as required by `AC-LA-E7-10-05` to parse and verify its reviewed allow list.

| Item | Value |
| --- | --- |
| SHA | `336448871c292d314bbae298254657de545d6013` (integration `3364488`; holds LA-E7-10 merge `a8b5517` / commit `ecd9af7`) |
| Lane and slot | lane R; no Docker (HOST-ONLY) |
| Clones | `~/cogniate-qa-runs/LA/LA-E7-10/r1/k0/clone-a` and `clone-b`: `git clone --no-hardlinks --no-checkout`, detached at `336448871c292d314bbae298254657de545d6013`, push URL `DISABLED` |
| Environment | macOS arm64, Node 24.21.0, npm 11.19.0 |
| Artifacts | private run folder `~/cogniate-qa-runs/LA/LA-E7-10/r1/` (umask 077): `k0-vitest.log`, `infra-ci-local-test.log`, `e7-10-merge-files.txt`, `k0/run-a1-clean.log`, `k0/run-a2-planted.log`, `k0/run-b-registry-unreachable.log`, `k0/ac05-allow-list.json`, `k0/summary.json` |

## Acceptance criteria

| AC | Result | Test id | Command | Evidence |
| --- | --- | --- | --- | --- |
| AC-LA-E7-10-01 | **FAIL** (K0) | `ci-local.k0.test.ts > AC-LA-E7-10-01` | `LA_TASK_SHA=336448871c292d314bbae298254657de545d6013 LA_RUN_DIR=~/cogniate-qa-runs/LA/LA-E7-10/r1/k0 npx --no-install vitest run --reporter=verbose --config tests/ltiaas/tasks-core/LA-E7-10/vitest.config.mts` (`npm run ci:local` in `clone-a`) | Steps 1 (`install`, 2.315 s; `node_modules` and `tests/node_modules` installed), 2 (`check`, 88.031 s), 3 (`audit`, 0.705 s, `advisoryIds: []`) and 4 (`sbom`, 0.205 s; `.tmp/ci/sbom.cdx.json` is CycloneDX 1.5 with 73 components) pass. **Step 5 (`secrets`, 0.417 s) fails with exit 1** on the clean clone of `3364488` due to 13 un-allowlisted hits in 7 tracked files merged from S1 (`LA-E5-01`, `LA-E5-02`, `LA-E5-08`) and `docs/reviews/LA-E5-02/reviewer-a.md` (table below). `k0/run-a1-clean.log` |
| AC-LA-E7-10-02 | PASS (K0) | `ci-local.k0.test.ts > AC-LA-E7-10-02` | `npm run ci:local` in `clone-a` with a random `ltis_` + 43 key planted on line 7 of a temporary tracked copy `qa-e710-plant-1792662540158.txt` | Exits 1; step 5 reports `{"file":"qa-e710-plant-1792662540158.txt","line":7,"rule":"api_key"}`; no 12-character substring of the planted value appears in stdout/stderr or under `.tmp/`; `git status --porcelain` in `clone-a` is empty after clean-up. `k0/run-a2-planted.log` |
| AC-LA-E7-10-03 | PASS (K0) | `ci-local.k0.test.ts > AC-LA-E7-10-03` | `npm run ci:local` in `clone-b` with `npm_config_registry` and proxy env vars pointed at a closed `127.0.0.1` port, empty npm cache and `npm_config_fetch_retries=0` | Prints `{"step":1,"name":"install","result":"network_unavailable","seconds":0.326}` (steps 2–5 report `"result":"skip","reason":"network_unavailable"`) and exits `2` in 0.435 s; no network step reports a pass. `k0/run-b-registry-unreachable.log` |
| AC-LA-E7-10-04 | PASS (K0) | `ci-local.k0.test.ts > AC-LA-E7-10-04` | as AC-01..03 | Each run outputs exactly five JSON lines in step order (`step` 1..5) with `name`, `result` and `seconds`; exit code is non-zero (`1` on `run-a1-clean` and `run-a2-planted`; `2` on `run-b-registry-unreachable`) whenever any step does not pass. `k0/summary.json` |
| AC-LA-E7-10-05 | **FAIL** (K0) | `ci-local.k0.test.ts > AC-LA-E7-10-05` | as AC-01 | All 64 entries in `allowList` in `infra/scripts/ci-local.sh` (`k0/ac05-allow-list.json`) name a tracked `file`, `rule`, SHA-256 base64 `fingerprint` and non-empty `reason`; however, **step 5 fails on the clean tree at `3364488`** with 13 un-allowlisted findings across 7 files added on the integration branch after `ecd9af7` branched from `dba6dd2`. `k0/run-a1-clean.log`, `k0/ac05-allow-list.json` |

## Defect blocking AC-LA-E7-10-01 and AC-LA-E7-10-05 on integration SHA `3364488`

`LA-E7-10` commit `ecd9af7` was authored on top of `dba6dd2` (`LA-E4-01`), before S1's `LA-E5-01`, `LA-E5-02`, `LA-E5-08` and `docs/reviews/LA-E5-02/reviewer-a.md` landed on the integration branch. When `npm run ci:local` runs on the clean integration tree `3364488`, step 5 (`secrets`) fails (`exit 1`) with 13 findings (`k0/run-a1-clean.log` line 9):

| Tracked file | Line(s) | Rule | Origin |
| --- | --- | --- | --- |
| `docs/reviews/LA-E5-02/reviewer-a.md` | 21 | `api_key` | Reviewer-A prose mention of `ltis_test` |
| `services/lti-service/src/cli/bootstrap.test.ts` | 28 | `secret_assignment` | `LA-E5-08` unit test |
| `services/lti-service/src/config.test.ts` | 5 | `secret_assignment` | `LA-E5-01` unit test |
| `services/lti-service/src/http/routes/platforms-audit.test.ts` | 97 | `api_key` | `LA-E5-02` unit test |
| `services/lti-service/src/keys/key-config.test.ts` | 53, 55, 64, 70, 72, 76, 99 | `secret_assignment` (7 hits) | `LA-E5-01` unit test |
| `services/lti-service/src/main.test.ts` | 49 | `secret_assignment` | `LA-E5-01` unit test |
| `services/lti-service/src/store/audit.test.ts` | 81 | `api_key` | `LA-E5-02` unit test |

## Other checks

- **Author infra test (R0):** `node --test infra/scripts/ci-local.test.mjs` passes all 15 tests in 3.85 s (`infra-ci-local-test.log`), and full `npm run check` inside step 2 of `npm run ci:local` passes (88 unit files / 1,300 passed, 5 skipped; 152 infra tests; 42 K0 tests).
- **File scope:** task commit `ecd9af7` (merged as `a8b5517`) touches `infra/scripts/ci-local.sh`, `infra/scripts/ci-local.test.mjs`, `package.json` and `package-lock.json` (`e7-10-merge-files.txt`).
- **QA parser note (`tests/ltiaas/tasks-core/LA-E7-10/README.md`):** updated `parseSteps` and `parseAllowList` in `tests/ltiaas/tasks-core/LA-E7-10/ci-local.k0.test.ts` to parse the script's JSON step lines (`{"step":n,"name":...,"result":...,"seconds":...}`) and JS/JSON `const allowList = [ ... ]` entries. No test assertion was changed.
- **Reviewed allow list (`k0/ac05-allow-list.json`, 64 entries across 25 tracked files):** `infra/compat/storage-compat.sha256` (4 `master_key`), `infra/e2e/Dockerfile` (1 `master_key`), `infra/fixtures/courses.sha256` (2 `master_key`), `infra/moodle/SPIKE-NOTES.md` (1 `master_key`), `packages/shared/src/crypto.test.ts` (1 `master_key`), `packages/shared/src/jobs.test.ts` (1 `api_key`), `packages/shared/src/logger.test.ts` (2 `secret_assignment`, 1 `api_key`), `services/cogniate-app/src/config.test.ts` (1 `secret_assignment`), `services/cogniate-app/src/config.ts` (1 `secret_assignment`), `services/lti-service/src/http/app.ts` (1 `secret_assignment`), `services/lti-service/src/http/auth.test.ts` (1 `api_key`), `tests/acceptance/M1/common/99-logs.test.ts` (2 `private_key`), `tests/acceptance/T6/3-courses.spec.ts` (1 `master_key`), `tests/acceptance/lib/course-fixtures.ts` (2 `master_key`), `tests/e2e/host/run-{m2,t7}.mjs` (4 `master_key`), `tests/fixtures/multi-lms/provider-sources.json` (2 `master_key`), `tests/host/run-{m1,t1,t4a,t4b,t5,t8}.mjs` (12 `master_key`), `tests/host/storage-docker.mjs` (2 `master_key`), `tests/host/storage-lane.mjs` (1 `secret_assignment`), `tests/host/storage-lane.selftest.mjs` (1 `secret_assignment`), `tests/host/storage-private-scan.selftest.mjs` (1 `secret_assignment`), `tests/host/storage-rows.selftest.mjs` (18 `secret_assignment`, 1 `master_key`).

## Regression and time

R0: `npm run check` inside step 2 of `npm run ci:local` (PASS, 88.031 s) and `node --test infra/scripts/ci-local.test.mjs` (15/15 PASS, 3.85 s). Measured time of the new K0 suite: `ci-local.k0.test.ts` 175.4 s (`run-a1-clean` 91.8 s, `run-a2-planted` 81.3 s, `run-b-registry-unreachable` 0.4 s).
