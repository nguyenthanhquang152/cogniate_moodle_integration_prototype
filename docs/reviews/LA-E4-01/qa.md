Verdict: PASS
Round: 2

# QA Report: LA-E4-01 — Job runner in `packages/shared`

| Field | Value |
| --- | --- |
| Task | `LA-E4-01` (`docs/architecture/ltiaas/tasks/LA-E4-01.md`) |
| Reviewer | QA-3 |
| Round | 2 (Round 1 at `7f4275c`; Round 2 re-check at `3479be4` after lane R fix round 1 `06efe56` and BD-A1-10) |
| SHA tested | `3479be423e8c72d667296c7b2ac717d5771debc4` (integration `3479be4`; Round 1 SHA `7f4275c6f2875a1193d13fe2172778e35dd34fb0`) |
| Run mode | Host-only (`Docker: none` per task spec) |
| Run folders | `~/cogniate-qa-runs/LA/LA-E4-01/r1/` and `~/cogniate-qa-runs/LA/LA-E4-01/r2/` (umask `077`, clean `git clone --no-hardlinks`, push URL `DISABLED`) |
| Verdict | **PASS** |

---

## Round 2 (`3479be4` / lane R fix merge `06efe56`, BD-A1-10)

Tester: QA-3 (Orca task `task_443093f7301e`, dispatch `ctx_3dc20840b43e`), 2026-10-22.

- **Clone:** `~/cogniate-qa-runs/LA/LA-E4-01/r2/clone` detached at `3479be423e8c72d667296c7b2ac717d5771debc4` (`rev.txt`), push URL `DISABLED` (`remotes.txt`), `npm ci` (`npm-ci.log`).
- **Post-run worktree status:** `git status --porcelain` is empty (`status-after.txt`).
- **Scope check on fix merge `06efe56` (`e4-01-r2-merge-files.txt`):** `packages/shared/package.json`, `packages/shared/src/jobs.test.ts`, `packages/shared/src/jobs.testkit.ts`, `packages/shared/src/jobs.ts`.

### R0 `npm run check` (`~/cogniate-qa-runs/LA/LA-E4-01/r2/check.log`)

| Step | Result at `3479be4` (Round 2) | Result at `7f4275c` (Round 1) | Baseline at `1b17261` (`LA-E0-01`) |
| --- | --- | --- | --- |
| `lint` + `fitness:lms-names` + `fitness:rules` | PASS (0 errors) | PASS (0 errors) | PASS (0 errors) |
| `typecheck` | PASS (0 errors) | PASS (0 errors) | PASS (0 errors) |
| `test:unit` (`vitest run`) | **93 files; 1,333 passed, 5 skipped (1,338)** | 88 files; 1,281 passed, 5 skipped | 70 files; 1,123 passed, 5 skipped |
| `test:infra` (`node --test`) | **184 pass, 0 fail (20 suites)** | 136 pass, 0 fail (17 suites) | 111 pass, 0 fail (14 suites) |
| `test:k0` | **2 files; 42 passed, 0 failed** | 2 files; 42 passed, 0 failed | — |

### Round 2 Acceptance Criteria Matrix (`AC-LA-E4-01-01` .. `AC-LA-E4-01-12`, UNIT)

- `npx --no-install vitest run --reporter=verbose -t "AC-LA-E4-01-"` (`~/cogniate-qa-runs/LA/LA-E4-01/r2/unit-rows-by-id.log`): **20 passed** in `packages/shared/src/jobs.test.ts` (92 files / 1,318 tests skipped by name filter).
- `npx --no-install vitest run --reporter=verbose packages/shared/src/jobs` (`~/cogniate-qa-runs/LA/LA-E4-01/r2/unit-rows-jobs-verbose.log`): **1 file passed; 24 tests passed** in `154ms`.

| AC | Label | Status | Passing test(s) citing AC ID (`packages/shared/src/jobs.test.ts`) |
| --- | --- | --- | --- |
| `AC-LA-E4-01-01` | `UNIT` | **PASS** | `queue store contract: reference SQLite store > AC-LA-E4-01-01: one conditional update takes the lease; a second taker gets false; another boot id records nothing` (`3ms`) |
| `AC-LA-E4-01-02` | `UNIT` | **PASS** | `queue store contract: reference SQLite store > AC-LA-E4-01-02: two runners, two due rows of one key: one lease at a time; the higher row only after the lower row has a result` (`4ms`) |
| `AC-LA-E4-01-03` | `UNIT` | **PASS** | 1. `queue store contract: reference SQLite store > AC-LA-E4-01-03: due gives rows round-robin over partitions, the oldest next_try_at first inside a partition` (`1ms`)<br>2. `job runner > AC-LA-E4-01-03: at most \`parallel\` runs at once (default 4), one per partition; perPartition 2 is refused at addQueue` (`2ms`) |
| `AC-LA-E4-01-04` | `UNIT` | **PASS** | 1. `job store contract: reference SQLite store > AC-LA-E4-01-04: after stop() a new start goes on at once; after a crash it waits until the old heartbeat is 30 s old` (`4ms`)<br>2. `queue store contract: reference SQLite store > AC-LA-E4-01-04: a start recovers at once the rows of its instance id, expired leases and rows without an owner; a live lease of another instance stays` (`5ms`)<br>3. `queue store contract: reference SQLite store > AC-LA-E4-01-04: after a crash a new start takes no lease and recovers nothing until the old heartbeat is 30 s old; the late result of the old boot id changes no row` (`3ms`) |
| `AC-LA-E4-01-05` | `UNIT` | **PASS** | 1. `job store contract: reference SQLite store > AC-LA-E4-01-05: a second live process with the same instance id gets job_instance_conflict and never takes a lease (worker: off)` (`3ms`)<br>2. `job store contract: reference SQLite store > AC-LA-E4-01-05: a runner whose row another process took stops leasing` (`3ms`) |
| `AC-LA-E4-01-06` | `UNIT` | **PASS** | 1. `job store contract: reference SQLite store > AC-LA-E4-01-06: stop() deletes the heartbeat row only after the run in flight ends; a start in the grace time waits` (`3ms`)<br>2. `job store contract: reference SQLite store > AC-LA-E4-01-06: stop() waits for the longest lease (60000 ms) when a run does not end` (`2ms`)<br>3. `job store contract: reference SQLite store > AC-LA-E4-01-06: stop() waits for the longest lease (120000 ms) when a run does not end` (`2ms`) |
| `AC-LA-E4-01-07` | `UNIT` | **PASS** | 1. `job store contract: reference SQLite store > AC-LA-E4-01-07: an interval run needs a free or expired single-run lease, else skipped_lease; runNow gives the result` (`6ms`)<br>2. `job store contract: reference SQLite store > AC-LA-E4-01-07: an interval run in this process blocks a second run even after its lease expires` (`2ms`) |
| `AC-LA-E4-01-08` | `UNIT` | **PASS** | `job runner > AC-LA-E4-01-08: each run has its own trace id and one job_run line; an error logs its class name only` (`2ms`) |
| `AC-LA-E4-01-09` (Could) | `UNIT` | **PASS** (built) | `job store contract: reference SQLite store > AC-LA-E4-01-09: a web runner with job_instance_conflict keeps waiting without a lease and starts when the other heartbeat stops` (`2ms`) |
| `AC-LA-E4-01-10` | `UNIT` | **PASS** | `queue store contract: reference SQLite store > AC-LA-E4-01-10: a running runner recovers an expired lease of another instance; the higher row follows the P2 confirmation rule; a late result changes no row` (`6ms`) |
| `AC-LA-E4-01-11` (BD-A1-10) | `UNIT` | **PASS** | 1. `job runner > AC-LA-E4-01-11: a poison row cools with capped backoff while its good neighbours run; success and restart reset it` (`22ms`)<br>2. `job runner > AC-LA-E4-01-11: a due batch of cooled rows does not hide the next healthy row` (`2ms`) |
| `AC-LA-E4-01-12` (BD-A1-10) | `UNIT` | **PASS** | `job runner > AC-LA-E4-01-12: refuses invalid instance ids and lease times above the timer maximum` (`4ms`) |

Additional unlabeled tests in `packages/shared/src/jobs.test.ts` (4 passed):
1. `job store contract: reference SQLite store > heartbeat row: a free or 30 s old row can be claimed; heartbeat and delete only by its boot id` (`3ms`)
2. `job runner > interval jobs run at start and every everyMs, each run with one lease (25 min with 10 min: 3 runs)` (`9ms`)
3. `job runner > kick polls a queue job at once; stop() aborts the signal of the runs in flight` (`2ms`)
4. `job runner > checks names, the instance id and the add order` (`2ms`)

---

## 1. Environment & Clone Hygiene (Round 1 at `7f4275c`)

- **Clone path:** `~/cogniate-qa-runs/LA/LA-E4-01/r1/repo`
- **Checked-out commit:** `7f4275c6f2875a1193d13fe2172778e35dd34fb0` (`~/cogniate-qa-runs/LA/LA-E4-01/r1/rev.txt`)
- **Remote config:** `origin` push URL set to `DISABLED` (`~/cogniate-qa-runs/LA/LA-E4-01/r1/remotes.txt`)
- **Install:** `npm ci` (`~/cogniate-qa-runs/LA/LA-E4-01/r1/npm-ci.log`, added 417 packages, 0 errors)
- **Post-run worktree status:** `git status --porcelain` is empty (`~/cogniate-qa-runs/LA/LA-E4-01/r1/status-after.txt`)
- **Scope check on product commit `89d5ec5` (`git diff-tree -r --name-only 89d5ec5^1 89d5ec5` in `~/cogniate-qa-runs/LA/LA-E4-01/r1/e4-01-merge-files.txt`):**
  - `packages/shared/src/index.ts`
  - `packages/shared/src/jobs.test.ts`
  - `packages/shared/src/jobs.testkit.ts`
  - `packages/shared/src/jobs.ts`
  - Matches the "May edit" list in `docs/architecture/ltiaas/tasks/LA-E4-01.md` (and adds reusable `jobs.testkit.ts` for the store-contract test suite required by Scope).

---

## 2. R0 Regression Gate (`npm run check`, Round 1)

Log: `~/cogniate-qa-runs/LA/LA-E4-01/r1/check.log`

| Step | Result at `7f4275c` (`LA-E4-01`) | Baseline at `1b17261` (`LA-E0-01`) |
| --- | --- | --- |
| `lint` | PASS (0 errors) | PASS (0 errors) |
| `typecheck` (`tsc -b`) | PASS (0 errors) | PASS (0 errors) |
| `build` (`tsc -b`) | PASS (0 errors) | PASS (0 errors) |
| `test:unit` (`vitest run`) | **88 test files passed**; **1,281 tests passed**, 5 skipped (1,286 total) | 70 test files passed; 1,123 tests passed, 5 skipped (1,128 total) |
| `test:infra` (`node --test`) | **136 pass, 0 fail** (17 suites) | 111 pass, 0 fail |
| `test:k0` (`vitest run --config vitest.k0.config.ts`) | **2 test files passed**; **42 tests passed**, 0 failed | 2 test files passed; 42 tests passed, 0 failed |

---

## 3. Acceptance Criteria Matrix (UNIT, Round 1)

All ten ACs in Round 1 carried the `UNIT` evidence label (Author unit tests with a temporary SQLite store and a controlled clock, plus the reusable store-contract suite in `packages/shared/src/jobs.testkit.ts`). Could item `AC-LA-E4-01-09` is built and verified.

### 3.1 Verbose UNIT Run Summary (Round 1)

- **Command 1 (AC ID filter per `tests/ltiaas/tasks-core/LA-E4-01/README.md`):**
  ```sh
  npx --no-install vitest run --reporter=verbose -t "AC-LA-E4-01-"
  ```
  - **Log:** `~/cogniate-qa-runs/LA/LA-E4-01/r1/unit-rows-by-id.log`
  - **Result:** **15 passed** in `packages/shared/src/jobs.test.ts` (87 files skipped by name filter; 1,271 tests skipped)
- **Command 2 (Full `packages/shared/src/jobs.test.ts` file run):**
  ```sh
  npx --no-install vitest run --reporter=verbose packages/shared/src/jobs
  ```
  - **Log:** `~/cogniate-qa-runs/LA/LA-E4-01/r1/unit-rows-jobs-verbose.log`
  - **Result:** **1 test file passed (1)**; **19 tests passed (19)** in `528ms`

### 3.2 AC-to-Test Mapping (`AC-LA-E4-01-01` .. `AC-LA-E4-01-10`, Round 1)

| AC | Label | Status | Passing test(s) citing AC ID (`packages/shared/src/jobs.test.ts`) |
| --- | --- | --- | --- |
| `AC-LA-E4-01-01` | `UNIT` | **PASS** | `queue store contract: reference SQLite store > AC-LA-E4-01-01: one conditional update takes the lease; a second taker gets false; another boot id records nothing` (`22ms`) |
| `AC-LA-E4-01-02` | `UNIT` | **PASS** | `queue store contract: reference SQLite store > AC-LA-E4-01-02: two runners, two due rows of one key: one lease at a time; the higher row only after the lower row has a result` (`15ms`) |
| `AC-LA-E4-01-03` | `UNIT` | **PASS** | 1. `queue store contract: reference SQLite store > AC-LA-E4-01-03: due gives rows round-robin over partitions, the oldest next_try_at first inside a partition` (`10ms`)<br>2. `job runner > AC-LA-E4-01-03: at most \`parallel\` runs at once (default 4), one per partition; perPartition 2 is refused at addQueue` (`41ms`) |
| `AC-LA-E4-01-04` | `UNIT` | **PASS** | 1. `job store contract: reference SQLite store > AC-LA-E4-01-04: after stop() a new start goes on at once; after a crash it waits until the old heartbeat is 30 s old` (`12ms`)<br>2. `queue store contract: reference SQLite store > AC-LA-E4-01-04: a start recovers at once the rows of its instance id, expired leases and rows without an owner; a live lease of another instance stays` (`11ms`)<br>3. `queue store contract: reference SQLite store > AC-LA-E4-01-04: after a crash a new start takes no lease and recovers nothing until the old heartbeat is 30 s old; the late result of the old boot id changes no row` (`17ms`) |
| `AC-LA-E4-01-05` | `UNIT` | **PASS** | 1. `job store contract: reference SQLite store > AC-LA-E4-01-05: a second live process with the same instance id gets job_instance_conflict and never takes a lease (worker: off)` (`12ms`)<br>2. `job store contract: reference SQLite store > AC-LA-E4-01-05: a runner whose row another process took stops leasing` (`18ms`) |
| `AC-LA-E4-01-06` | `UNIT` | **PASS** | 1. `job store contract: reference SQLite store > AC-LA-E4-01-06: stop() deletes the heartbeat row only after the run in flight ends; a start in the grace time waits` (`14ms`)<br>2. `job store contract: reference SQLite store > AC-LA-E4-01-06: stop() deletes the heartbeat row after leaseMs when a run does not end` (`15ms`) |
| `AC-LA-E4-01-07` | `UNIT` | **PASS** | `job store contract: reference SQLite store > AC-LA-E4-01-07: an interval run needs a free or expired single-run lease, else skipped_lease; runNow gives the result` (`10ms`) |
| `AC-LA-E4-01-08` | `UNIT` | **PASS** | `job runner > AC-LA-E4-01-08: each run has its own trace id and one job_run line; an error logs its class name only` (`14ms`) |
| `AC-LA-E4-01-09` (Could) | `UNIT` | **PASS** (built) | `job store contract: reference SQLite store > AC-LA-E4-01-09: a web runner with job_instance_conflict keeps waiting without a lease and starts when the other heartbeat stops` (`12ms`) |
| `AC-LA-E4-01-10` | `UNIT` | **PASS** | `queue store contract: reference SQLite store > AC-LA-E4-01-10: a running runner recovers an expired lease of another instance; the higher row follows the P2 confirmation rule; a late result changes no row` (`20ms`) |

---

## 4. Verdict

**PASS** — In Round 2 at `3479be423e8c72d667296c7b2ac717d5771debc4` (merge `06efe56`), `npm run check` (R0) and all 12 UNIT acceptance criteria (`AC-LA-E4-01-01` through `AC-LA-E4-01-12`, including Could item `AC-LA-E4-01-09` and the BD-A1-10 additions `AC-LA-E4-01-11` and `AC-LA-E4-01-12`) pass across 20 AC-tagged tests / 24 total tests in `packages/shared/src/jobs.test.ts` (`154ms`). Docker-level outbox proof follows in `LA-E4-02` and `LA-E4-03` per task spec.
