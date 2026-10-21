Verdict: APPROVE
Round: 1

# M1 storage oracle repair: Reviewer-A

Lens: correctness, fail-closed behavior, storage acceptance conformance, boundary isolation and data integrity.
This is a source review of a host-side harness repair. **It gives no runtime acceptance credit.** No M1 row changes status because of this review.

## Identity and scope

| Item | Value |
| --- | --- |
| Role | Independent Reviewer-A. Fresh Claude Code session, requested model Opus 5.5 (`claude-opus-5-5`), xhigh effort. Blind review: this reviewer did not read the other review or other workers' messages. |
| Lifecycle | Run `run_ebe671ad72a9`, task `task_e455d24135cd`, dispatch `ctx_5a53cec57452`, session `orca_session_id:37ba13b5-edec-4bc6-b3d7-544a361c8760`. |
| Candidate | `0e83e3cb740f004a357449ebdcda2be14998339d` (tests tree `4c7e067feedc644f955afee37806f06e7273dd04`), parent `38d07a9`, product base `9cdd768`. |
| Reviewed diff | `git diff 38d07a9 0e83e3c`: `tests/host/storage-oracle.mjs`, `storage-oracle.selftest.mjs`, `storage-rows.mjs`, `storage-rows.selftest.mjs`, and the QA report `docs/reviews/M1/storage-oracle-repair-qa.md`. |
| Read | Charter, phase plan (current checkpoint), ADR-012 §5, §6, §11, §13, §14, `tasks/M1.md` AC-M1-41 rows `a-fresh`, `a-second-start`, `a-restart`, `b-oracle-*`, `c-selftest`, `e-content-missing`, `f-originals-back`; product `stack-up.sh`, `stack-restart.sh`, `lib.sh` (`storage_preflight`, `legacy_scan`), `sqlite-lock-probe.mjs` (selftest path, `logLines`); harness `storage-lane.mjs`, `storage-docker.mjs` (`fixtureArgs`, `serviceContainers`). |
| Not in scope | The import bind-source failure of `e-old-schema` and `e-content-missing`. The backend Author owns that diagnosis. This review does not judge its cause. |

Constraints kept: no Docker or daemon command, no source or test edit, no product test, no full suite, no commit. Only host-only focused checks ran, in a private root.

## Scope check

- `git diff 9cdd768 0e83e3c -- . ':!docs'` lists only the four test files. Product, infra, manifests and inventory files did not change.
- `git diff --check 38d07a9 0e83e3c` is clean.
- The four held files at the candidate have the "after" SHA-256 values that the QA report gives (`c94b0ad6…`, `c8f4a015…`, `65321138…`, `be61f274…`). The QA report at the candidate has SHA-256 `a534448899200817d520c285996d132e1dfb8b4226967aca6746141600603518`.

## Assessment against the acceptance requirements

### 1. `c-selftest` (tasks/M1.md AC-M1-41 (c); ADR-012 §5 self-test, §11 `storage-probe`)

Requirement: the candidate probe runs `selftest --folder self=/tmp/qa-selftest-<16 hex>` in a `storage-probe` container. The folder is a new folder in the container's own writable layer, with no volume and no bind for it. The result is three `storage_selftest` lines with `ok: true` and exit 0. The probe needs an existing empty folder (`sqlite-lock-probe.mjs:521`).

Finding: **conforms.**

- The container command is `sh -c 'umask 077 && mkdir -m 0700 "$1" && shift && exec "$@"' c-selftest <folder> node /probe/sqlite-lock-probe.mjs selftest --run-id <hex16> --folder self=<folder>` (`storage-rows.mjs:251`). The probe arguments are the same as before.
- The folder is made **inside the container**, as `HOST_UID:HOST_GID` (`fixtureArgs` gives `--user hostUid:hostGid` and `storage-probe` has no root path). `/tmp` is in the container's writable layer: `fixtureArgs` adds no `--tmpfs`, `-v`, `--volume` or `--read-only`.
- The only mount stays the read-only probe file (`storage-docker.mjs:134`). The `hostNegativeDir` bind is added only when the spec names it, and `c-selftest` does not name it.
- Mode is 0700 from creation (`umask 077` and `mkdir -m 0700`). `mkdir` has no `-p`, so an existing path fails.
- The `&&` chain is fail-closed. A failed `mkdir` ends `sh` with a non-zero status. The probe does not run, and `expectExit(res, 0)` fails the row. `exec` gives the probe's exit code to Docker.
- The arguments go to Docker as an argument list (`storage-lane.mjs:94`, then `spawn` with no shell in `tests/host/lib.mjs:18`). So `$1` and `$@` expand only in the container shell.
- The node image entrypoint runs `sh` directly, because `sh` is a system command. Before the repair, the same entrypoint ran `node` directly. No `--entrypoint` change is needed.
- `logLines` writes to `/logs` only when that folder exists (`sqlite-lock-probe.mjs:469-472`). The probe container has no `/logs` mount, so the probe output stays on stdout only. That is the same as before.
- The row assertions did not change: exactly three lines; each scenario has `ok`, `expected` and `observed` equal to the contract value.

### 2. `a-fresh` preflight selection (tasks/M1.md AC-M1-41 (a); ADR-012 §5, §6; `stack-up.sh:58-95`)

Requirement: "The preflight summary `pass` is logged before the first service container is created. Both folders record `fsType`." On a first start, `stack:up` prints the `report` pass (legacy scan, `lib.sh:427`), then the `check --prepare` pass (`stack-up.sh:61`), and after `up --wait`, the `mark-started` pass (`stack-up.sh:90`). Only `check` gates the start.

Finding: **conforms.**

- `preflightOf` selects the summary by `mode === 'check'`, never by position (`storage-oracle.mjs:50-52`).
- **Fail-closed paths:**
  - no check summary → `summary: null`, so `Preflight summary pass` fails;
  - two check summaries → `StorageFail`;
  - a failed check with a passing `mark-started` stays failed;
  - a check summary without `ts` fails the ordering assertion;
  - an empty service list now fails (`services.length > 0`, `storage-rows.mjs:295`), where `Math.min()` gave a vacuous pass before;
  - an unparsable `Created` value gives `NaN`, and the comparison fails.
- `checkLines` holds only the lines of the selected check (same mode and runId). `fsType` is now read from those lines (`storage-rows.mjs:292`), so a `report` or `mark-started` line cannot satisfy it.
- The ordering assertion keeps its text and its `<=` bound. It now compares the check `ts` with the earliest `Created` of the lane's service containers. `serviceContainers` excludes one-off and `org.cogniate.storage` containers (`storage-docker.mjs:338`), so this is the "first service container".
- Both clocks come from the Docker VM: the probe container's `Date` and the engine's `Created`. The `9cdd768` log shows a 142 ms gap. The equality case (same millisecond) stays lenient, as QA states. This has no practical effect, and the repair did not change it.
- `firstStart: "completed"` is still proven by QA's own identity read (`assertPair`), not by the `mark-started` line.

### 3. runId selection (`a-fresh`, `a-second-start`, `a-restart`)

- `state.runIds` now starts with the a-fresh **check** runId (`storage-rows.mjs:305`), not the `mark-started` runId. `preflightRunId` (`:144`) returns the check runId of each later command. So "a new runId" for `a-second-start` and `a-restart` compares the check runId of each command with the earlier check runIds. That matches the contract text. See A-SOR-02 for an optional strengthening.
- `stack:restart` prints only `check` (`stack-restart.sh:34`). The new rows self-test models that case.

### 4. Direct `preflightOf` callers (all are in `storage-rows.mjs`)

I checked every caller in `tests/`. There are no callers outside `storage-rows.mjs` and the oracle self-test.

| Caller | Output of the command | Before | After | Assessment |
| --- | --- | --- | --- | --- |
| `preflightRunId` `:144` (`a-second-start` `:316`, `:322`; `a-restart` `:332`) | report + check, or check only | last summary (= check here) | check | same result; now by mode |
| `a-fresh` `:290-305` | report, check, mark-started | mark-started (**wrong**) | check | fixed |
| `a-second-start` `:321` | report + check | `lines.every(OK)` | unchanged | see A-SOR-01 |
| `bOracle` `:1110` | report + check | last summary (= check) | check | same result |
| `identityCase` `:1132` (`f-originals-back`) | report + check | `lines.every(OK)` | unchanged | see A-SOR-01 |

No guarded command prints two check summaries, so the new `checks.length <= 1` guard cannot fail a valid run. The `runIds` and `lines` fields did not change.

### 5. Preserved items

- **Inventory 488/233.** No inventory, manifest, SEQUENCE or NEEDS line changed. The diff has only the `c-selftest` and `a-fresh` hunks in `storage-rows.mjs`. `node --test tests/host/storage-inventory.selftest.mjs` passes 3/3 (416 + 72 = 488; conditional row rules). I did not rerun the broad harness-only command, because there is no concrete concern. QA's joined inventory (Canvas 233) stands, by construction.
- **`content_missing`.** The `e-content-missing` and `e-old-schema` assertions (`storage-rows.mjs:1048-1066`) did not change. The import and restore halves still need exit 1 with `content_missing` and a `storage_content_check` line `result: content_missing`. The repair does not accept the bind-source error as `content_missing`.
- **Pre-start ordering.** The assertion stays and is now stricter (non-empty service list).

## Independent host-only evidence

Private root: `/tmp/rev-a-sor.0KyYls` (mode 0700). The trees come from `git archive` of the candidate and of `9cdd768`. `tests/node_modules` is a symbolic link to the worktree. No Docker command ran. After every run, no `/tmp/qa-selftest-*` folder remained.

| Check | Result |
| --- | --- |
| Candidate: `node --test tests/host/storage-rows.selftest.mjs tests/host/storage-oracle.selftest.mjs` | **18/18 PASS** (worktree and private copy). |
| New self-tests against the `9cdd768` code | **4 FAIL**, 14 PASS. The `a-fresh` and `a-restart` cases fail with the run's message "Preflight pass is logged before the first service container is created". The oracle case and the `c-selftest` case also fail. This reproduces QA C1 independently. |
| `storage-inventory.selftest.mjs` | 3/3 PASS. |
| Real probe through the row command | The real row procedure builds the `c-selftest` command on a fake lane. I ran it on the host, with only `/probe/sqlite-lock-probe.mjs` changed to a copy of the candidate probe (SHA-256 prefix `cb665e4e21b5`, equal to the worktree file). Result: exit **0**; `normal:pass`, `no-hold:lock_not_enforced`, `holder-dies:probe_error`, each `ok: true`; folder mode `700`; folder empty afterwards and removed. |

My own mutants. Each is one exact replacement in a copy of the candidate tree, run against both self-tests:

| Mutant | Result |
| --- | --- |
| X1 `summaries.at(-1)` (the old selection) | killed (oracle, `a-fresh`, `a-restart` cases) |
| X3 `&&` → `;` in the `c-selftest` script | killed (the reused path runs the probe) |
| X4 no `shift` | killed |
| X5 `Math.max` (last container, not first) | killed |
| X6 `checkLines` by mode only | killed (foreign-runId case) |
| X8 no two-check guard | killed |
| X9 last summary that is not `mark-started` | killed ("not by position" case) |
| X10 `mkdir -m 0755`, no umask | killed (mode `755`) |
| X11 `state.runIds` from the last runId of the command | killed |
| X2 `<=` → `<` | survives: a strengthening; the equality case is not tested (see §2) |
| X7 `checkLines` by runId only | survives: equivalent while runIds differ between modes (`randomBytes(8)` for each call, `storage-oplock.sh:390`) |
| X12 `state.runIds` = every runId of the command | killed: the self-tests pin the narrower set (see A-SOR-02) |

Evidence files (SHA-256, first 12 characters): `bin/mut.mjs` `ec5f6cd1dc41`, `bin/real-probe.mjs` `201179cd3c9c`, `mutants.json` `a442e307dafd`, `real-probe-held.json` `995b86041fbc`, `selftest-held.tap` `42aae3cc4e38`, `selftest-newtests-oldcode.tap` `99bae889a5d0`.

## Assessment of the QA report

The QA report's facts match the code and my checks: the two causes, the caller table, the C1 cross results, the held hashes and the stated limits. I did not rely on its conclusions. I checked each requirement above against the contract and the product scripts. QA lists the A-SOR-01 gap as a limitation. I agree that it is outside the two confirmed defects.

## Findings

No BLOCKER. No MAJOR.

### A-SOR-01 — MINOR — `tests/host/storage-rows.mjs:321`, `tests/host/storage-rows.mjs:1132`

**Problem.** Two "State OK" oracles still use `preflightOf(res).lines.every((l) => l.state === 'OK')`. This checks every mode, and it passes when there are no lines.

**Evidence.**
- `Array.prototype.every` on an empty list is `true`.
- At `:1132` (`identityCase`, used for `f-originals-back`), there is no other preflight assertion. A `stack:up` with exit 0 and no `storage_preflight` line would pass "State OK" there.
- A `stack:up` that printed only an `OK` report, and no check, would also pass.
- At `:321`, `preflightRunId` on `:322` needs a check summary `pass`, so only the mixed-mode part applies.
- This gap was there before the repair and is not a regression. Today `stack-up.sh:61-66` always prints the check before exit 0, and other rows in the same phase need a check pass. So no current false PASS is shown.

**Remedy (narrow).** Use the new API at both lines: `const pf = preflightOf(res); check(pf.summary?.result === 'pass' && pf.checkLines.length === 2 && pf.checkLines.every((l) => l.state === 'OK'), 'State OK');`. Add one self-test case: a `stack:up` output with no check lines must fail. This is safe to defer. It does not block this repair.

### A-SOR-02 — NIT — `tests/host/storage-rows.mjs:305`, `:144`; `tests/host/storage-rows.selftest.mjs:89`, `:113`

**Problem.** "A new runId" compares a command's check runId only with earlier **check** runIds. A later check that reused an earlier `report` or `mark-started` runId would not be found. The self-tests pin this narrower set, so the stricter variant (mutant X12) fails them.

**Evidence.** Mutant X12 (`state.runIds = new Set(pf.runIds)`) is killed by `:89` and `:113`. Product runIds come from `crypto.randomBytes(8)` for each call (`storage-oplock.sh:390`), so a real reuse is very unlikely. The contract text ("a new runId") does not name the modes.

**Remedy (optional).** Keep the check runId as the selected value, but add every runId of each command (`pf.runIds`) to the seen set. Update the two self-test expectations. No action is needed for this repair.

### A-SOR-03 — NIT — `tests/host/storage-rows.selftest.mjs:132`

**Problem.** The host run of the exact `c-selftest` command makes `/tmp/qa-selftest-<16 hex>` in the shared host `/tmp`, outside the test's private temp folder. The test registers a recursive, forced removal of that path **before** it proves that the test made the path.

**Evidence.** The `t.after(() => fs.rmSync(folder, { recursive: true, force: true }))` call comes before the first `spawnSync` (`:145`). If the path already existed, `mkdir` would fail (correct). But the cleanup would still remove a folder that the test did not make. The name has 64 random bits, so the practical risk is negligible.

**Remedy (optional).** Before the cleanup is registered, assert `!fs.existsSync(folder)`. Another option: register the cleanup only after the first run shows that the folder is new.

## Limits of this review

- Source review and host-only checks only. No container ran. The busybox `sh` and `mkdir` in `node:24.22.0-alpine3.24`, the image entrypoint, and lock enforcement on the container overlay layer are not verified here. A runtime round must still show `c-selftest` PASS.
- `a-fresh` was checked with a fake lane. The real product order comes only from the `9cdd768` log and the runtime round.
- The `e-old-schema` and `e-content-missing` bind-source failure is not reviewed. Until its diagnosis ends, those rows stay FAIL or not run.
- This review gives no runtime acceptance credit. All M1 rows keep their current status. All 32 real-LMS rows stay UNVERIFIED.

## Counts

BLOCKER 0, MAJOR 0, MINOR 1 (A-SOR-01), NIT 2 (A-SOR-02, A-SOR-03).
