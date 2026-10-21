Verdict: APPROVE
Round: 1

# M1 storage harness repair: c-selftest folder and preflight summary selection (Reviewer-B)

Reviewer-B, 2026-10-21. Lens: "Can a human team own it?" (simplicity, test precision, scope, error handling, operability).
This is a source review of a bounded QA harness repair. **It gives no runtime acceptance credit.** No M1 row changes status because of this review. The failed `9cdd768` attempt stays FAIL.

## Identity and scope

| Item | Value |
| --- | --- |
| Role | Independent Reviewer-B. Blind: I did not read the other review or other workers' messages before this file. |
| Model | Claude Code Opus 5.5 (`claude-opus-5-5`), xhigh effort. |
| Lifecycle | Run `run_ebe671ad72a9`, task `task_a9ea9482127b`, dispatch `ctx_f734e56b84e5`. Session `orca_session_id:4bb99f55-4fec-43d6-9f40-d52fc3d67332`. |
| Candidate | `0e83e3cb740f004a357449ebdcda2be14998339d`. Parent `38d07a9`. Base tested product `9cdd768`. |
| Diff under review | `git diff 38d07a9 0e83e3c`: four test files and the QA report. `git diff 9cdd768 38d07a9` changes only `docs/`. No product, infra or build file changed. |
| Files reviewed | `tests/host/storage-oracle.mjs` (+12 −2), `storage-oracle.selftest.mjs` (+33 −1), `storage-rows.mjs` (+7 −4), `storage-rows.selftest.mjs` (+115 −1), and `docs/reviews/M1/storage-oracle-repair-qa.md`. |
| Contract read | Charter; phase plan checkpoint 07:54 UTC; ADR-012 §4, §5 and §11; `docs/architecture/tasks/M1.md` rows `a-fresh`, `a-second-start`, `a-restart`, `c-selftest`, `d-clean`. Product callers read only: `infra/scripts/stack-up.sh`, `stack-restart.sh`, `lib.sh` (`storage_preflight`, `legacy_scan`), `sqlite-lock-probe.mjs` (`selftest`). |
| Not in scope | The `e-old-schema` / `e-content-missing` Docker bind-source error. The backend Author owns that diagnosis. I did not review it. |

## Method and evidence

No Docker command, no daemon command, no stack, no product test and no full suite ran. I changed no repository file except this report.

Private root (mode 0700, made with umask 077): `/Users/quangnguyen/cogniate-qa-runs/storage-oracle-repair-reviewer-b-20261021T0813Z`.
`cand/` and `base/` are `git archive` copies of `tests/` at `0e83e3c` and `38d07a9`. Both use a symbolic link to the worktree's `tests/node_modules`. Host: macOS 27.0.1, Node v24.21.0.

| Check | Command | Result |
| --- | --- | --- |
| E1. Focused self-tests, candidate | `node --test --test-reporter=tap --test-timeout=60000 tests/host/storage-oracle.selftest.mjs tests/host/storage-rows.selftest.mjs` in `cand/`, umask 022 | exit 0, **18 of 18** PASS |
| E2. Same, parent | the same command in `base/` | exit 0, 14 of 14 PASS |
| E3. Reviewer mutants | `scripts/mutants.sh`: one exact replacement, applied once, in a fresh copy of `cand/tests` | see the mutant table |
| E4. "State OK" predicate | `scripts/state-ok-probe.mjs`: the unchanged predicate of `storage-rows.mjs:321` and `:1132`, through the candidate `preflightOf`, on three synthetic outputs | all three outputs pass the predicate (B-SOR-01) |
| E5. Held hashes | `git show 0e83e3c:<file> \| shasum -a 256` for the four test files, and the same at `38d07a9` | all eight values equal the QA report's "before" and "after" table |
| E6. Worktree | `git diff --quiet 0e83e3c -- tests/` | exit 0: the worktree `tests/` equals the candidate |
| E7. Leftovers | `ls /tmp \| grep qa-selftest` after E1–E3 | none |

Reviewer mutants (E3). These cover cases that the QA mutant set (m01–m12) does not name.

| Mutant | Replacement | Self-tests | Meaning |
| --- | --- | --- | --- |
| x1 | drop `umask 077 && ` | 18/18 PASS (survives) | The "private from creation" property is not tested (B-SOR-02). |
| x2 | `<= firstCreated` → `< firstCreated` | 18/18 PASS (survives) | The equality bound is not pinned (B-SOR-03). |
| x3 | `mkdir -m 0700` → `mkdir` (umask stays) | 18/18 PASS | Equivalent: the umask alone gives 0700. Not a gap. |
| x4 | `exec "$@"` → `"$@"` | 18/18 PASS | Equivalent: `sh` returns the last exit code. Not a gap. |
| x5 | select by `mode !== 'mark-started'`, then the last one | 2 FAIL | Killed. |

Evidence SHA-256 (first 12): `scripts/mutants.sh` `0a6d9cd487c4`, `scripts/state-ok-probe.mjs` `23449dfa6007`, `evidence/selftest-cand.tap` `084c498cc39f`, `evidence/selftest-base.tap` `8d6c08f0011b`, `evidence/mutant-x1…x5.tap` `4b99ae4b848b`, `6eafc6cc8711`, `12bbcc968058`, `f023f540a63b`, `aef90aa2bb8d`, `evidence/state-ok-probe.json` `a63547016d7b`. The files hold only synthetic values and test names. No secret was read.

## Assessment against the acceptance requirements

I judged the code against the contract text, not against the QA conclusions.

| Requirement | Source | Finding |
| --- | --- | --- |
| `c-selftest`: a new folder in the probe container's own writable layer; no volume and no bind for that folder | M1.md `c-selftest`; ADR-012 §11 `storage-probe` | **Met.** The container runs `sh -c 'umask 077 && mkdir -m 0700 "$1" && shift && exec "$@"' c-selftest <folder> node /probe/… selftest …`. `fixtureArgs` for `storage-probe` adds only the read-only probe bind when `hostNegativeDir` is absent. The self-test asserts the exact `--mount` list, and no `-v`, `--volume` or `--tmpfs`. |
| The folder is mode 0700 and new | Lead brief | **Met.** `mkdir` has no `-p`, so an existing path fails and the probe does not run (self-test: second run). The stub sees mode `700` and the host uid. `umask 077` makes the folder 0700 from creation with busybox `mkdir -m` (it creates with the umask mode, then runs `chmod`). See B-SOR-02 for the missing comment and test. |
| The probe argument list does not change | ADR-012 §5 | **Met.** The self-test pins `['node', probe, 'selftest', '--run-id', <hex16>, '--folder', 'self=<folder>']` after the wrapper. |
| `a-fresh`: "the preflight summary `pass` is logged before the first service container is created" | M1.md `a-fresh` | **Met.** `stack-up.sh:59–95` prints `report` (legacy scan), then `check --prepare`, then `up`, then `mark-started` only for a pending pair. `stack-restart.sh:34` prints only `check`. Only `check` gates the start. `preflightOf` now selects the single `check` summary by mode. The `<=` bound and the assertion text are unchanged. |
| Fail-closed handling | Lead brief | **Met, and stricter.** No check summary → `summary: null` → "Preflight summary pass" fails. Two check summaries → `StorageFail`. No service container → the ordering check fails (before: `Math.min()` gave `Infinity`, a vacuous pass). An unparseable `ts` or `created` gives `NaN` and fails. The runner keeps stdout and stderr apart (`lib.mjs` `run`), and the probe writes JSON only to stdout, so a duplicate check line cannot come from stream merging. |
| `fsType` for both folders | M1.md `a-fresh` | **Met.** It is read from `checkLines` only. Before, a `report` or `mark-started` line could satisfy it. |
| Relevant runId selection ("a new runId") | M1.md `a-second-start`, `a-restart` | **Met.** `state.runIds` starts with the check runId. Later rows compare new check runIds with it. This also fixes a second start whose pair is still pending (`report`, `check`, `mark-started`): it now gives the check runId, not the `mark-started` runId. |
| Inventory 488 / Canvas 233 | phase plan | **Unchanged by construction.** The diff does not touch `SEQUENCE`, `NEEDS`, row ids, labels, phases or `storage-inventory.mjs`. Self-test 9 ("each of the 70 storage-phase rows exactly once") passes in E1. I did not rerun the harness-only inventory: no concrete concern needs it. |
| `content_missing` assertions | M1.md `e-content-missing` | **Unchanged.** `storage-rows.mjs:1048–1066` are outside the diff. |

### Direct `preflightOf` callers

| Caller | Output of the command | Result |
| --- | --- | --- |
| `preflightRunId` (`:144`) | used by the rows below | correct: the check summary |
| `a-fresh` (`:290–305`) | `report`, `check`, `mark-started` | correct (the defect fixed) |
| `a-second-start`, second `stack:up` (`:316`) | `report`, `check` | correct |
| `a-second-start`, after stop (`:321–322`) | `report`, `check` | runId correct; "State OK" still judges mixed lines (B-SOR-01) |
| `a-restart` (`:332`) | `check` | correct |
| `bOracle` (`:1110`) | `report`, `check` | correct |
| `identityCase` (`:1132`) | `report`, `check` | "State OK" still judges mixed lines and needs no summary (B-SOR-01) |

Read-only observation, no finding: `storage-compat-route.mjs:230` takes the first summary by position. It is not a `preflightOf` caller and is outside the four owned files. Old builds print no storage lines, so the first summary is the wrapper's `check --prepare`. No defect is shown.

## Findings

No BLOCKER. No MAJOR. One MINOR and three NIT.

### B-SOR-01 — MINOR — `tests/host/storage-rows.mjs:321`, `:1132`

**Problem.** Two "State OK" assertions still judge `preflightOf(res).lines` (all modes), not the new `checkLines`. They pass when the check prints no folder line, and `identityCase` also passes when the command prints no preflight line at all.

**Evidence.** E4 (`state-ok-probe.json`) runs the unchanged predicate through the candidate `preflightOf`:
- no preflight line → `every(state OK)` is `true`, `summary: null` (`identityCase` needs no summary, so the row records "state OK");
- `report` lines OK and a passing check summary without folder lines → `true` (`a-second-start` passes, because `preflightRunId` needs only the summary);
- the check has only the `lti` line → `true`.

The product prints the check lines on every exit 0 (`stack-up.sh:61–66`), so no current product output reaches these cases. The risk is a silent pass after a later product or harness change. The repair added `checkLines` for exactly this mixed-mode problem but applied it only to `a-fresh`. QA disclosed this as a limitation and kept it out of the bounded scope.

**Fix (narrow).** Add one helper in `storage-rows.mjs` and use it at both lines:
`const checkStateOk = (pf) => pf.summary?.result === 'pass' && ['lti', 'app'].every((f) => pf.checkLines.some((l) => l.folder === f)) && pf.checkLines.every((l) => l.state === 'OK');`
Add one self-test case with a check summary but no check folder lines. Safe to defer.

### B-SOR-02 — NIT — `tests/host/storage-rows.mjs:247–251`

**Problem.** `umask 077` is the part that keeps the folder private from creation, but the comment does not say so and no test pins it. The umask also passes to the probe through `exec`.

**Evidence.** Mutant x1 (drop `umask 077 && `) passes 18 of 18. Busybox `mkdir -m` makes the folder with the umask mode first and runs `chmod` after. Without the umask, the folder is briefly 0755. Inside a `--network none`, single-user container this has no real exposure. The inherited umask makes the probe's selftest scratch files 0600. This does not change the lock result.

**Fix.** Add one comment sentence: "umask 077: busybox `mkdir -m` creates with the umask mode, then chmods; the probe inherits it and writes only scratch files." Optionally assert in the c-selftest self-test that the script starts with `umask 077 && mkdir -m 0700`.

### B-SOR-03 — NIT — `tests/host/storage-rows.selftest.mjs:94–96`

**Problem.** The boundary cases test 1 ms after and 1 ms before the check, but not equality. The QA report names `<=` as the deliberate bound, so the documented behavior is not pinned.

**Evidence.** Mutant x2 (`<=` → `<`) passes 18 of 18.

**Fix.** Add one case: `created: { ...CREATED, proxy: '2026-10-21T07:40:09.248Z' }` must pass.

### B-SOR-04 — NIT — `tests/host/storage-oracle.mjs:54`, `storage-oracle.selftest.mjs:46`

**Problem.** `preflightOf().runIds` (every runId of the command, all modes) has no caller in any row. The new self-test now asserts it, so the dead field is fixed in place. A reader can mistake it for the runId set that the rows use (`state.runIds`, check runIds only).

**Evidence.** `grep -rn '\.runIds' tests --exclude-dir=node_modules`: only `state.runIds` in `storage-rows.mjs` and `first.runIds` in the self-test.

**Fix.** Remove the field and its assertion, or rename it to `allRunIds` with a one-line comment. Safe to defer.

## Lens notes (no finding)

- **Simplicity.** The `sh -c` wrapper is the smallest correct form. `--tmpfs` would not be the writable layer. `--workdir` would let the Docker daemon create the folder, with an owner and mode that the row does not set. `$0` is `c-selftest`, so shell errors name the row.
- **Test precision.** The new self-tests run the real row procedures (`defineRows`) on a fake lane, use the real `fixtureArgs`, and run the real `c-selftest` command on the host `sh` with a stub that has the probe's exact prerequisite. Failure cases match exact messages, not message fragments. The fixtures carry the `9cdd768` run ids and times, so a reader can trace them to the failed run.
- **Error handling.** The two-check guard throws `StorageFail` with a clear message. A `mkdir` failure exits 1 and the row note says "probe selftest: expected exit 0, got 1". The command log (`core.mjs:122–129`) keeps the `mkdir` stderr, so the cause stays visible.
- **Operability.** The host self-test creates the real `/tmp/qa-selftest-<16 hex>` path to keep the command exact. It registers cleanup before it runs the command. E7 found no leftover.
- **QA report precision.** The line counts, caller line numbers, ms deltas (142 ms after, 148 ms before) and all eight file hashes match the candidate. The report states its limits correctly: no container ran, busybox was not run on this host, and the fake lane does not show the product order.

## Limitations

- Source and host-only review. Busybox `sh` and `mkdir` in `node:24.22.0-alpine3.24`, the image entrypoint (`docker-entrypoint.sh` execs `sh` because `command -v sh` succeeds), and the overlay writable layer are not run here. `c-selftest` still needs a Docker run in a new window.
- I did not rerun the harness-only runner, typecheck or inventory. The diff gives no concrete reason to doubt QA's results.
- The `e-old-schema` bind-source failure is not reviewed and is not resolved by this repair.
