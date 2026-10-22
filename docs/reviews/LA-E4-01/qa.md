# QA Report: LA-E4-01 — Job runner in `packages/shared`

| Field | Value |
| --- | --- |
| Task | `LA-E4-01` (`docs/architecture/ltiaas/tasks/LA-E4-01.md`) |
| Reviewer | QA-3 |
| Round | 1 |
| SHA tested | `7f4275c6f2875a1193d13fe2172778e35dd34fb0` (integration branch `7f4275c`; product commit `89d5ec5`) |
| Run mode | Host-only (`Docker: none` per task spec) |
| Run folder | `~/cogniate-qa-runs/LA/LA-E4-01/r1/` (umask `077`, clean `git clone --no-hardlinks` detached at `7f4275c6f2875a1193d13fe2172778e35dd34fb0`, push URL `DISABLED`) |
| Verdict | **PASS** |

---

## 1. Environment & Clone Hygiene

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

## 2. R0 Regression Gate (`npm run check`)

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

## 3. Acceptance Criteria Matrix (UNIT)

All ten ACs in `docs/architecture/ltiaas/tasks/LA-E4-01.md` carry the `UNIT` evidence label (Author unit tests with a temporary SQLite store and a controlled clock, plus the reusable store-contract suite in `packages/shared/src/jobs.testkit.ts`). Could item `AC-LA-E4-01-09` is built and verified.

### 3.1 Verbose UNIT Run Summary

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

### 3.2 AC-to-Test Mapping (`AC-LA-E4-01-01` .. `AC-LA-E4-01-10`)

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

### 3.3 Additional Edge-Case Tests in `packages/shared/src/jobs.test.ts`

1. `job runner > addQueue and addInterval refuse bad limits and duplicate names` (`7ms`)
2. `job runner > runNow after stop gives stopped and never runs the handler` (`8ms`)
3. `job runner > an interval throw logs job_run failed with the error class name and releases the lease` (`8ms`)
4. `job runner > a queue handler throw releases the lease so the row can run again` (`16ms`)

---

## 4. Verdict

**PASS** — `npm run check` (R0) and all 10 UNIT acceptance criteria (`AC-LA-E4-01-01` through `AC-LA-E4-01-10`, including Could item `AC-LA-E4-01-09`) pass at `7f4275c6f2875a1193d13fe2172778e35dd34fb0`. Docker-level outbox proof follows in `LA-E4-02` and `LA-E4-03` per task spec.
