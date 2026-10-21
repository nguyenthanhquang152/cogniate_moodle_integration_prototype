Verdict: APPROVE
Round: 1

# Q-R1A-01 release-status repair: Reviewer-A source review (lens A)

Date: 2026-10-21. Reviewer: fresh independent Reviewer-A, Claude Code Opus 5.5, xhigh.
Task `task_6ba56f3cae0b`, dispatch `ctx_189e0b2fa152`.
Lens A: correctness, safe failure, lock ownership and status propagation.

This is a bounded source review of one product diff. It is not a storage redesign, not QA and not runtime acceptance.
The historical R1-A host QA FAIL (`be41847`) stays unchanged. This review gives no QA credit.

## 1. Result

| Id | Severity | Summary |
| --- | --- | --- |
| A-QR1-01 | MINOR | The new adjacent unit matrix does not add R-3 (not lost, then `INT` or `TERM`). The product passes R-3 in my probe. |

No BLOCKER and no MAJOR finding. The repair applies the frozen §3.7 rule on every supported lock path that I checked.
Section 7 lists observations that are not findings.

## 2. Pinned inputs

| Input | Identity | Check |
| --- | --- | --- |
| Target repair commit | `9f8ac625443931242edd8da301c3d4f0d3e34290` | read with `git show` only |
| Product parent | `01ce5bc2d2d26e4fb1226c5f4f19528fb9ed576b` | read with `git show` only |
| `infra/scripts/storage-oplock.sh` | `19d496b5e711cda8589ce7d1ad28070b59c23308f1154bf292b220dc098a4a6b` | equal to the brief; parent `90d24679…69ca96` |
| `infra/scripts/storage-oplock.test.mjs` | `ba14f34108f73f58c6f757797151520e588165f8888ae9bd9f9853613461fdcf` | equal to the brief; parent `e2b2224b…7c2131` |
| `infra/compat/storage-compat.sha256` | `7e3ae0ce88c76f18fd3871a6124c40b25a070f6e5ed194d802ce960a015e843f` | equal to the brief; parent `3337c585…2d2747` |
| Frozen design | `2362a20fc4cdd9c21c9283dc7099068c6565eb31` | conformance `1128b9c1…8265de`, ADR-012 `2b3b601b…a1d7d`. Both equal the brief, and both are unchanged at the target. |
| Design approvals | A `d8ca978`, B `f8c0d419` | design-only evidence. I did not use them as implementation acceptance. |

Normative boundary: conformance §3.6 (W-1), §3.7 (repair scope), §3.8 (R-1 to R-14 and the mutants), and ADR-012 §7 release step 1 and §12.

## 3. Scope proof

- `git diff --numstat 01ce5bc 9f8ac62 -- ':!docs'` lists exactly 3 files: the helper (+14/−3), the unit test (+60/−1) and the hash list (+1/−1). The total is 75 insertions and 5 deletions. The other commits in the range change only `docs/**`.
- The hash list changes only the `storage-oplock.sh` line. All four lines equal the target bytes (`shasum -c`: knobs, probe, runner and helper OK).
- The embedded JavaScript is byte-identical. The heredoc body is lines 15–349 in both versions: 335 lines, 21,161 bytes, SHA-256 `ed1a1af05b41a70c0b59f3a2a9315e947075fa8a980bf8f7d91178a3e40852ad` in both. There is still one `<<'JS'` at `:14` and one `JS` terminator at `:350`.
- The bash hunks are: the header comment `:8`; the trap name `:375`; the new comment `:384–385`; `|| true` → `|| STORAGE_LOCK_RELEASE_FAILED=1` at `:390`; the new handler `:393–400`. The `run` block `:405–429` does not change.
- These files do not change: `storage-compat.sh` (`65be43f2…`), `sqlite-lock-probe.mjs`, the knobs file and every guarded script.
- `pnpm-workspace.yaml` is not in the commit. It stays untracked in the worktree.

## 4. Checks against the frozen rule (§3.7)

All lines refer to `infra/scripts/storage-oplock.sh` at `9f8ac62`, unless the row names another file.

| Rule | Evidence | Result |
| --- | --- | --- |
| (a) Any nonzero release result is a failed release. It never ends the caller. | `:390` sets `STORAGE_LOCK_RELEASE_FAILED=1` for any nonzero `_storage_oplock_js release` status, without code parsing. Every branch of the function returns 0: `:387` `return 0`, the assignment, or the JS success. So `set -e` cannot fire on a plain call. | PASS |
| Release only once | `:387–388`: `STORAGE_LOCK_HELD` is checked, then set to 0 before the call. The handler `:398` calls the same function, so an earlier explicit release is not repeated. | PASS |
| (b) One EXIT rule selects the status | `:375` installs `_storage_lock_exit`. `:397` reads `$?` as its first command. `:398` releases when the lock is still held. `:399` changes only 0 to 1, and only after a failed release. No other code changes the status. | PASS |
| Earlier explicit release remembered | `STORAGE_LOCK_RELEASE_FAILED` is a global that nothing resets. `:399` reads it, also when the handler did not release. | PASS |
| Pre-existing nonzero statuses kept | `:399` requires `"$status" == 0`. When the handler does not call `exit`, bash keeps the status that started the exit. | PASS |
| (c) No option dependence; safe `set -u` defaults | `${STORAGE_LOCK_HELD:-0}` at `:387` and `${STORAGE_LOCK_RELEASE_FAILED:-0}` at `:399`. `status` is a local variable. The handler has no pipeline. The `STORAGE_LOCK_*` values at `:390` exist whenever `HELD` is 1, because `:366–369` set them before `:374`. | PASS |
| (d) `run` keeps `exit "$code"` and has no status rule of its own | `:419–424` do not change: `set +e`, `"$@"`, `code=$?`, `set -e`, `storage_lock_release`, `exit "$code"`. | PASS |
| Foreign record and lock ownership | The JS is unchanged. `release()` (`:170–181`) moves only a record that has its own `runId`. The bash part calls it under the same conditions as before. | PASS |
| Command and event non-regression | `:390` passes the same `--command "$STORAGE_LOCK_COMMAND"`, run id and pid. The event code is unchanged. | PASS |
| R1-A QA O-1 (quiet A6 release) | It is not touched: `quiet` at `:151`, `:163` and `:179` is unchanged. Acquire still exits at `:370–372`, before the trap. It stays a MINOR deferral to M4. | as designed |

Supported callers (exact target source):
- Guarded scripts: `stack-up.sh:13`, `stack-restart.sh:14`, `stack-reset.sh:15`, `stack-data.sh:32` and `storage-compat.sh:125`, `:142` and `:166`. None of them sets its own `EXIT` trap or calls `storage_lock_release`. So each one gets the new handler through `storage_lock_acquire`.
- `stack-up.sh:16` sources `lib.sh` again, and `lib.sh:329` sources the helper again. The helper's top level only defines functions, sets `_storage_oplock_dir` (`:353`) and has the main guard (`:405`). So the second source keeps the `HELD` and `FAILED` values and the trap.
- Copied wrapper `storage-compat.sh:149–179`: the old `lib.sh` at `b0b83a8` and `9f96f7b` has no trap and no `storage_lock`/`STORAGE_LOCK` name. Its `set -a` covers only the `.env` source (lines 20–23). The copied helper is sourced after it (`:165`). `status_check` (`:93–110`) does not read the lock. So a lost lock gives exit 1 from `exit "$code"` (`:179`) without "stop now" text. A failed check gives 1 with "stop now", as before.

## 5. R-1 to R-14 against the target tests and criteria

"Unit" means `infra/scripts/storage-oplock.test.mjs` at `9f8ac62`. "Probe" means my private host-only runs (§6).

| Case | Target unit evidence | Probe | Note |
| --- | --- | --- | --- |
| R-1 | Sourced, both option sets: `:257`. Run path: the existing `:80` (exit 0, released, own command, no `.tmp` entry). | pass | |
| R-2 | Sourced, both option sets: `:258`. Run path: the existing `:223` (7, no entry). | pass | |
| R-3 | Only the existing `:225` (sourced, `TERM`, no options, 143, released). | P1: sourced ×3 option sets and the run path; 143/130; released; no entry | A-QR1-01 |
| R-4 | Sourced, both: `:259`. Run: `:280`. `expectEnd` (`:241–254`) asserts the event list, own command/runId/pid, owner F, F byte-identical and only the lock folder. | pass | |
| R-5 | Sourced `:260`, run `:281`: owner null, no entry. | pass | |
| R-6 | Sourced `:261` (exit 7) and `:262` (`false`; a `set -e` error under `set -euo pipefail`). Run `:282`. | pass | |
| R-7 | Sourced `:263–264`, run `:283–284`: 143 and 130, events and F as R-4. | pass | |
| R-8 | (i) `:265`, (ii) `:266`, (iii) `:268`, both option sets (`:270`). (iii) calls `storage_lock_release` as a plain command on its own line, with no condition and no wrapper. The run path is covered by R-1, R-4 and R-6. Two events only, so there is no second release. | pass | |
| R-9 | Existing tests: `:104` (re-entry), `:115` (A6 active), `:133` (listing failure; not installed), `:151` (`docker rm`), `:195` (A3 invalid). The unit suite does not cover `operation_in_progress` (120 s wait). | not run by me | The code path (`:370–372` and the JS) is unchanged. |
| R-10 | Existing `:104`. | not run by me | Unchanged path. |
| R-11 | Not in the unit suite (old-build route). | P3: pair on the copied wrapper, identical stubs. Control: 0 and `storage-compat status: OK`. Lost: 1, F kept, empty stderr (no "stop now"). The parent gives 0 for the lost run. | Harness method, not a QA old-SHA clone |
| R-12 | `storage-compat.test.mjs:334–336` compares the list with the current files. | I checked all 4 lines; my P3 `enable` copies are byte-identical to the repair bytes. | Hash mutant refusal (`storage-compat.test.mjs:160`, `:238`) not run by me |
| R-13 | JS identical (§3). Command assertions at `:97`, `:215` and `:245`. | Parent vs target, 29 selected cases: only the 9 lost-then-0 cases differ (parent 0, target 1). | Full R1-A checks are QA |
| R-14 | Existing `:294`; JS identical. | not run by me | |

The Author's claims (test:infra 111/111; root check 1123 pass and 5 skips) are context only. I did not repeat them.

### Mutant families (§3.8)

I ran the 29 selected cases (the 22 new sourced cases, the 5 new run cases, and `:206` and `:221`) against each mutant copy. The target passes 29/29 on `/bin/bash` 3.2.57.

| Family | My mutant (one change to a private copy) | Detected by (failing target cases) |
| --- | --- | --- |
| Release result discarded | `:390` `|| true` | R-4, R-5, R-8 (ii), both option sets; run R-4 and R-5; `:206` (9 fail) |
| Lost overrides every status | `:399` without `"$status" == 0` | R-6 (7), R-7, R-8 (iii), both option sets; run R-6 and R-7 (11 fail) |
| Only the `run` path repaired | trap back to `storage_lock_release`, plus a `code=1` rule in `run` | sourced R-4, R-5 and R-8 (ii), both option sets; `:206` (7 fail; run cases pass) |
| Only the trap path repaired | handler resets `FAILED=0` at entry | run R-4 and R-5; `:206`; R-8 (ii), both option sets (5 fail) |
| Status depends on options | (a) `${STORAGE_LOCK_RELEASE_FAILED}` without a default; (b) release returns 1; (c) `| cat` before `||` | (a) `set -euo pipefail` R-1, R-2 and R-8 (i), plus `:221`; (b) `set -euo pipefail` R-6, R-7 and R-8 (iii), plus run R-6; (c) no options R-4, R-5 and R-8 (ii), plus `:206` |
| Explicit release ends the caller through `set -e` | mutant (b) | `set -euo pipefail` R-8 (iii): 1, not 7 |
| Handler uses only its own result | the same as "only the trap path" | R-8 (ii), both option sets: 0, not 1 |
| Release removes or moves F | JS `:173` `if (!k)` | 19 cases (F bytes and event lists) |

All eight families are detected. No family is equivalent.

## 6. Probes (host only; private)

Preconditions: macOS 27.0.1 arm64. `/bin/bash` 3.2.57 is the only bash on `PATH`. Node v24.21.0.
- Private root: `/Users/quangnguyen/cogniate-review-runs/q-r1a-01-reviewer-a-20261021T1455Z`. Folders are 0700 and files 0600 from creation (umask 077). Stubs are 0700. `TMPDIR` and `HOME` are inside the root. `env -i` was used. A fake `docker` comes first on `PATH`.
- No real Docker, Compose, network, service, install or setting. No product, test or other docs edit.
- All files were extracted with `git show` from the pinned SHAs. Mutants and probe tests exist only in the private root.
- `MANIFEST.sha256`: 56 entries, SHA-256 `48f5b0c784400c159d94b8570c425aa4d6219089cb1a2aeebd40d9355098a5df`. The scratch folders `tmp/` and `home/` are not listed.

| Probe | Result | Evidence |
| --- | --- | --- |
| Selected unit cases: target, parent and 8 mutants | §5 | `out/*.tap`; target `1c1d7247…`, parent `0158829a…` |
| P1 R-3, not lost, `TERM`/`INT`; sourced with no options, `set -euo pipefail` and `set -u`; and the run path | 143/130, released, no entry | `out/direct-target.txt` `e1630bff…` |
| P2 release error without `storage_lock_lost` (`.tmp` mode 0500, so the rename fails with `EACCES`) | 0 → 1; 7 stays 7; an explicit failed release, then `true` and `exit 0` → 1; the same under all 3 option sets and on `run` | same file |
| P3 R-11 pair with the target `storage-compat.test.mjs` harness (temp git repo, old `lib.sh` from `b0b83a8`, `enable` from the repair bytes, marker retargeted; the fake `npm` writes F at the end of the command when `F` is set) | target: control 0 + OK, lost 1 + F kept + empty stderr; parent: lost 0 | `out/r11.json` `5ba841f0…`, `out/r11-parent.json` `856d172b…` |
| P4 bash 3.2: an `EXIT` trap in the main shell, with `$(…)` and `( … )` | the trap runs once, in the main shell only | `out/subshell-trap.txt` `57816e3e…` |

## 7. Findings

### A-QR1-01 (MINOR): the unit matrix leaves out R-3

- File: `infra/scripts/storage-oplock.test.mjs:256–292` (the `SOURCED` and `RUN` tables).
- Problem: conformance §3.7 asks the Author to add the §3.8 host cases that the unit suite can run. The new tables have no R-3 row. The existing `:225` covers only sourced `TERM` with no options. Sourced `INT`, R-3 under `set -euo pipefail`, and the run-path R-3 are not in the unit suite.
- Evidence: §5 table. Probe P1 shows that the target product passes all of these. The INT/TERM traps (`:376–377`) did not change. None of the eight mutant families needs R-3 for detection.
- Effect: coverage only. No wrong status was seen. Independent QA must still run R-3 on both paths and with both option sets (§3.8). This finding does not waive that.
- Suggested fix (safe to defer): add `['R-3 not lost, then TERM', 'kill -TERM $$; sleep 5', 143, 'released']` and an INT row to `SOURCED`, and the `$PPID` forms to `RUN`.

### Observations (no change requested)

- O-A1 (environment input): `STORAGE_LOCK_RELEASE_FAILED` is not set at acquire. If a caller's environment exports `STORAGE_LOCK_RELEASE_FAILED=1`, a clean holder exits 1 (probe P2 file, `O-ENV` rows, all option sets). No product path exports it: it is a plain shell assignment, and `set -a` is active only while `lib.sh` sources `.env`. This matches §3.7 (c) ("unset means no failed release"). The failure goes in the fail-closed direction. It is an unsupported precondition, not a supported-path defect.
- O-A2 (pre-existing JS, out of scope): after a release error other than a lost lock, the own lock folder stays. It becomes stale after the holder ends (A5 reclaims it). The JS writes the raw `EACCES` text with an absolute path to stderr, and it logs no terminal event. The repair is bash-only by design (§3.7), so this is unchanged. I list it only for M4 context, next to R1-A QA O-1.
- O-A3 (copied helper): an `enable` made before this commit keeps the old helper and the old hash list on the old-build route. That route then still gives exit 0 after a lost lock, until `disable` and then `enable` from the repair SHA (conformance §4.5 M4 note). R-11 QA must use a fresh `enable` from `9f8ac62`.
- O-A4 (comment accuracy): the comments at `:8`, `:384–385` and `:393–395` describe the code correctly.

## 8. Limits

- Bash: only `/bin/bash` 3.2.57 on this host. I did not test bash 4 or 5, or Linux.
- Not tested: untrapped signals such as `HUP` (outside the ADR rule) and `SIGKILL` (no release, by design).
- P3 uses the unit-harness method (a temp repo with a retargeted marker). It is not the QA old-SHA clone. The fake `npm` writes F at the end of the command, not after it returns. The release sees the same lost state.
- I did not run R-9, R-10, R-12 hash-mutant refusal, R-14, `npm run test:infra` or the root `npm run check`. They are unchanged code paths or Author claims.
- Independence: I did not read the peer implementation review, any current QA result or map, in-progress harness diffs or reports, or the Author's report. The worktree HEAD moved to `9a715ed` during the review. That commit changes only `docs/team/board.md` and `docs/team/multi-lms-plan.md`, so the reviewed product bytes are unchanged.
