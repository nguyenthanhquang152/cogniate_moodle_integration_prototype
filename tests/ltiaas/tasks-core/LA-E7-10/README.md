# LA-E7-10 local CI script: QA-3 acceptance tests (K0)

Spec: `docs/architecture/ltiaas/tasks/LA-E7-10.md`. Design: `docs/architecture/ltiaas/README.md` §4a. QA-3 wrote the tests from these two files only (test-first). No Docker.

| AC | Test (`ci-local.k0.test.ts`) | Oracle |
| --- | --- | --- |
| AC-LA-E7-10-01 | `AC-LA-E7-10-01: on a clean clone …` | Fresh clone `clone-a`: the lines of steps 1, 2, 4 and 5 say pass. A failed step 3 names a GHSA or CVE id in its line. `node_modules` and `tests/node_modules` exist. `.tmp/ci/sbom.cdx.json` is CycloneDX with components. |
| AC-LA-E7-10-02 | `AC-LA-E7-10-02: a planted ltis_ key …` | A random `ltis_` + 43 key goes into line 7 of a copy of `.gitignore`, and `git add` makes it tracked. Then: exit 1, the step 5 line says fail, and one output line names `<file>:7` (or the file and "line 7"). No 12-character part of the value appears in the output or in the files under `.tmp/`. The clean-up restores a clean `git status`. |
| AC-LA-E7-10-03 | `AC-LA-E7-10-03: with the npm registry unreachable …` | Fresh clone `clone-b`. The npm registry and every proxy variable point to a closed local port, with an empty npm cache and `fetch-retries=0`. Then: exit 2, `network_unavailable` in the output, and no pass line for steps 1 or 3. |
| AC-LA-E7-10-04 | `AC-LA-E7-10-04: one output line per step …` | In the AC-01 and AC-02 runs: exactly one line per step, in step order, each with the step name, a result and seconds. Exit 0 if and only if all five steps pass. The AC-03 run does not exit 0. |
| AC-LA-E7-10-05 | `AC-LA-E7-10-05: the clean tree passes step 5 …` | Step 5 passes in the AC-01 run. The allow list in `infra/scripts/ci-local/allow-list.mjs` (or `infra/scripts/ci-local.sh`) has entries. Each entry names a tracked file and has a reason. The parsed list goes to `ac05-allow-list.json`, and qa.md lists it. |

The step-line parser accepts common layouts, because the design fixes the content (name, result, seconds) and not the layout. A step line has a result word (`pass`, `ok`, `fail`, `error`, `network_unavailable`), a number of seconds, and a step name (`install`/`npm ci`, `check`, `audit`, `sbom`, `secret`) or a `step <n>` / `[n/5]` mark. If the real layout does not fit, QA changes only the parser and records it in qa.md. The assertions do not change.

## Run

From `tests/`, after `npm ci` there:

```sh
LA_TASK_SHA=<40-hex task SHA> LA_RUN_DIR=<new private folder outside the repo> \
  npx vitest run --config ltiaas/tasks-core/LA-E7-10/vitest.config.mts
```

- `LA_SRC_REPO` (optional) is the repository to clone from. The default is the repository of this file.
- The suite makes two clones of the SHA in `LA_RUN_DIR` (umask 077). It writes `run-a1-clean.log`, `run-a2-planted.log`, `run-b-registry-unreachable.log`, `ac05-allow-list.json` and `summary.json` (exit codes, seconds, step lines).
- The AC-01 and AC-02 runs read the npm registry (steps 1 and 3). The suite runs `npm run ci:local` three times. Two runs are full runs (`npm ci` twice, `npm run check`, audit, SBOM, scan), so expect about 5 min.
