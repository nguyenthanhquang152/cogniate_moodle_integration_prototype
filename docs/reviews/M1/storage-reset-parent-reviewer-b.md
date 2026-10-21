Verdict: APPROVE
Round: 1

# M1 storage reset parent repair: combined design and implementation review (Reviewer-B)

Reviewer-B, 2026-10-21. Lens: "Can a human team own it?" (simplicity, maintainability, test evidence, error handling, operator clarity, bounded scope).
This is a **source and design review only**. **It gives no runtime acceptance credit.** RA/RC, Q1/Q2, both 488-row rounds, the legacy suites, fresh M2 and three T7 runs stay required. No row, assertion, label or count changes because of this review.

## 1. Identity and scope

| Item | Value |
| --- | --- |
| Role | Independent Reviewer-B. Blind: I did not read Reviewer-A's report or messages. I read the Author report only after my own code and design assessment. |
| Model | Claude Code Opus 5.5 (`claude-opus-5-5`), xhigh effort. No subworkers. |
| Lifecycle | Run `run_ebe671ad72a9`, task `task_e3cf59427b28`, dispatch `ctx_6bc12b42a365`. Session `orca_session_id:9a063447-468f-44c9-be31-7f03b514354e`. |
| Candidate | `89fb4b48ee388faff3060fe1a161a9f9d064de93` (parent `8e17065`). Tests tree `4c7e067feedc644f955afee37806f06e7273dd04` (unchanged). |
| Design | `35d093d7a807391e779edf514d4ad2b63e8e0e66`: ADR-012 revision 3.4 (§3, §7, §15, §16) and `docs/architecture/tasks/storage-reset-parent-repair.md`. |
| Files reviewed | `infra/scripts/stack-reset.sh` (SHA-256 `aad3fbc1…8e10`), `infra/scripts/stack-reset.test.mjs` (new, `509157fc…32e2`), `infra/README.md` `stack:reset` row only (`a6de93d9…5efc`). All three hashes match the Author report. |
| HEAD at review | `3ec795e`. `git diff 89fb4b4 HEAD` is empty for `infra`, `tests`, `services`, `apps`, `packages` and `package.json`. |
| Read-only context | Charter; plan checkpoints 08:57 and 09:06 UTC; ADR-012 §4 and §15; `lib.sh` (`prepare_content_folders`, `confirm_stack_delete`, `require_own_project`); `storage-compat.sh` `content_folders`; `e2e-reset.sh`; `qa-suite.sh`; `build-runner.sh`; `infra/compose.yaml` binds; `tests/host/storage-rows.mjs` `d-content-folder`; `tests/host/run-t8.mjs`; `tests/host/run-m1.mjs` legacy list; `tests/e2e/host/run-t7.mjs` confirm checks. |
| Author evidence | `AUTHOR-REPORT.md`, SHA-256 `ab4fbdd3c8b72ee6cc6d67ef2c373b08d8fc9d13d4c163f814d2c13bb77151a5` (checked). Mutation `results.json` SHA-256 `93557eb3…4877` (checked). |

## 2. Method

No Docker daemon command, no Compose command, no stack and no full suite ran. I changed no repository file except this report.

Private scratch (umask 077, mode 0700): `/var/folders/_h/pjt6zzrj46sctnb18tsmbzgw0000gn/T/rb-srp-scratch.x6qEfU`. Host: macOS 27.0.1, Node v24.21.0.

| Check | Result |
| --- | --- |
| `node --test infra/scripts/stack-reset.test.mjs`, `TMPDIR` in scratch, umask 077 | 8/8 pass, 0 skip |
| Same, umask 022 | 8/8 pass, 0 skip. Both temp folders are empty after the run. |
| Old/new probe: copies of the four scripts from `89fb4b4^` and `89fb4b4` (the three helpers are byte-equal), fake `docker` on `PATH`, six cases E1–E6 (§6) | as in §6 |
| Same-mode `chmod` and empty `find` probe | `chmod 700` on a `0700` folder leaves `ctime` unchanged (nanosecond read). `find … -exec rm -rf {} +` with no entry runs no `rm` and exits 0. |
| Author mutation records | 9 variants and the frozen `a784522` control each fail the case that the brief names. I read the diffs of M3, M5a and M6: each is a one-place edit at the stated anchor. |

Probe script SHA-256 `805232117a912f31cd00788bb7528d2f32a84fa140695df2d76a8557917306f1`; fake `docker` `711dda47b1fedc84167bb08f0d914e1c44ea4f88a0ee25fe816240d922704e40`.

## 3. Summary

The repair is small and easy to own. It changes one removal in one script. It uses the same three-part test as `prepare_content_folders`, so a reader can find its twin. The unit file uses strong oracles (inode, SHA-256, mode, owner, exact Docker call list), and each mutation fails the case that the brief predicts. I found no BLOCKER and no MAJOR.

| ID | Severity | Where | One line |
| --- | --- | --- | --- |
| B-SRP-01 | MINOR | brief line 35; ADR-012 line 708 | "The product reset never makes topology R2" is true only for a `P` in the §4 state. |
| B-SRP-02 | MINOR | ADR-012 line 706; `stack-reset.sh:38–52` | The written contract does not state the stop-at-first-error order that KEEP-SPLIT accepts. |
| B-SRP-03 | MINOR | brief line 147 | "Q1 and T7 exercise it" (build queue) claims more than these gates measure. |
| B-SRP-04 | NIT | `infra/README.md:49`; `stack-reset.sh:10–11` | Two operator texts are imprecise after the change. |
| B-SRP-05 | NIT | `stack-reset.test.mjs:194` | U6 plants `.hidden` but no assertion reads it. |

All five are text or test-precision items. None needs a product behavior change.

## 4. Design assessment (ADR-012 revision 3.4 and the brief)

### 4.1 Proven, inferred and unknown

| Class | Statement | Source |
| --- | --- | --- |
| Proven (20/20 each, plain `docker run`, scratch) | R2: delete and make `P` again, then a new child → `bind source path does not exist`, also after retries to 5.1 s. R3: keep `P`, delete and make only the child → visible. R1: new parent and child → visible. R3b: a moved-away grandchild → `ENOENT`, no stale view. | brief §1 |
| Proven (unit, host) | The candidate keeps the inode of a host-user `P`, removes every entry and sets `0700`. | §5 below |
| Inference (labeled in the brief) | The same holds for `uploads` and for legacy files in `P`. The failure is new with the ADR-012 nested binds. | brief §1, §2 |
| Unknown (labeled) | The mechanism inside Docker Desktop, the upper bound of the R2 window, and what ends it. | brief §1 |
| Diagnostic only | RD (move `P` away, make it again): 20/20 fresh, no refusal. The plan records timing and destination differences and no positive control in that window. | plan checkpoint 09:06 UTC (I did not read the RD report) |

The brief keeps these classes apart. I agree that Option A rests on R2/R3 and on the pending RA/RC pair, with RC as the positive control. RD and R2 differ (move against delete) and the cause is not known. So RD does not show that any other parent replacement is safe. It also gives no acceptance credit.

### 4.2 Option A

Option A is the smallest change that removes the measured trigger from the product path. The rejected options are correctly rejected: a retry or a sleep guesses an unknown window; `create_host_path: true` can make a root-owned folder; Option B has no measured next step. I agree with each row of the brief §3 contract check, with two precision items (B-SRP-01, B-SRP-03).

### 4.3 KEEP-SPLIT (Lead decision `msg_2583d56e6293`)

My independent judgment: **acceptable, and simpler than the alternative.**
- The old single `rm -rf` (`89fb4b4^`, `stack-reset.sh:37`) tried all six paths, then exited 1. The candidate stops at the first failed path (`stack-reset.sh:38`, `45–52`). Probe E1 shows both behaviors.
- Safety holds. A failure leaves more data, never less. Nothing outside the checkout changes. The exit is 1 and no success line prints. ADR §15 promises erasure only "after exit 0".
- The "continue, then fail" order would need a deferred-status variable around three removal steps. That adds code for no safety gain.
- The gap is the written contract, not the code: see B-SRP-02.

## 5. Implementation assessment

| Property | Evidence | Result |
| --- | --- | --- |
| Rule runs only after guard, lock, `require_docker`, `require_own_project`, sweep and a successful `down -v` (or label removal) | `stack-reset.sh:14–35` unchanged; rule at `:44–51`. U5 (a) failed `down`, (b) compat marker, (c) other checkout; mutations M5a, M5b. | Pass |
| Same test as `prepare_content_folders`: link, then directory, then owner | `stack-reset.sh:45` equals `lib.sh:355` and `storage-compat.sh:63` | Pass |
| Absent `P` stays absent | U2; M7 | Pass |
| Linked `P` removed as a link; target unchanged | U3 (target `0750`, so a followed `chmod` is visible); M3; probe E5 (dangling link) | Pass |
| Non-directory `P` removed | U4 | Pass |
| Other-owner `P` removed as before | By reading: the branch runs the old `rm -rf "$content"`. It needs root to test. | Pass (reading) |
| Dot names removed | U1 (`.hidden`, `.hidden-dir/x`, `uploads/.tmp/u1`); M2; probe E4 (`-rf`, a name with a newline, `..dots`, a FIFO, a link to a file) | Pass |
| No removal outside the checkout | U1 (link entry), U3, probe E4 (nested links, also a link whose text ends in `/`): the outside folder is unchanged | Pass |
| Kept `P` has mode `0700` | U1 from `0755`; M4. `chmod` runs every time, but on this host a same-mode `chmod` changes nothing (§2). | Pass |
| A failure gives exit not 0 and no success line | U6; M6. Probes E1–E3: exit 1, no success line. BSD `find` returns the failed `rm` status. | Pass |
| No new delay, retry, Docker call, refusal code or `lib.sh` change | Diff; U1 asserts the exact Docker call list (`ps`, `info`, `ps`, `compose … down -v --remove-orphans`) | Pass |
| Operator output | The success line names "the empty folder infra/.data/cogniate-app/" only when it stays (U1 against U2–U4) | Pass |

Test quality notes (no finding):
- U5 (c) is a useful addition beyond the brief. M5b fails all three U5 cases.
- Equivalent mutants exist and are harmless: no `-maxdepth 1`; a trailing `/` on the kept-folder branch; `-L` at depth 1 (`rm -rf` does not follow a link operand).
- The fixture does not copy `build-runner.sh`, so the sweep (`|| true`) is silent in the test. This is acceptable: the rule does not depend on it.
- The no-`.env` label path has no unit case. Its code is unchanged and `set -e` stops a failed `docker rm`/`volume rm`. The brief does not ask for this case.

Interactions with unchanged code (read-only):
- `confirm_stack_delete` (`lib.sh:247–265`): after a reset with no later start, the empty `P` counts as data, so `e2e:reset` and `test:e2e` ask, or stop without a terminal. This fails closed and the brief states it. Runners pass `--yes` or `E2E_CONFIRM=1` (`run-t7.mjs`, `storage-rows.mjs:464`). The T7 confirm checks run on a stack with data, so they expect the question anyway.
- `prepare_content_folders` accepts the kept `P` and makes `packages` and `uploads` with `0700`.
- The three-part test now has three copies (`lib.sh`, `storage-compat.sh`, `stack-reset.sh`). The brief forbids a `lib.sh` change, and the comment names the twin, so this is acceptable now. A later `lib.sh` edit can share one helper.

## 6. Probe evidence (host-only, fake `docker`)

Each case ran on a fresh scratch checkout with a space in its path. "Old" is `89fb4b4^`; "new" is `89fb4b4`.

| Case | Setup | Old | New |
| --- | --- | --- | --- |
| E1 | `.secrets/app/locked` is `0500` with a file; `P` has `cogniate.db` | exit 1; `P` and `.logs` removed | exit 1; `P` (same inode, 1 entry) and `.logs` stay. No success line in both. |
| E2 | `P` is `0500` (host user) with entries | exit 1; entries stay | exit 1; entries stay; `rm` errors only |
| E3 | `P` is `0000` | exit 1 (`rm: … Permission denied`) | exit 1 (`find: … Permission denied`) |
| E4 | odd names, FIFO, nested links to an outside folder | exit 0; `P` absent | exit 0; `P` same inode, empty, `0700`; outside folder unchanged |
| E5 | `P` is a dangling link | exit 0; absent | exit 0; absent |
| E6 | `P` empty, `0700` | exit 0; absent | exit 0; same inode, `ctime` unchanged |

## 7. Findings

### B-SRP-01 — MINOR — brief `storage-reset-parent-repair.md:35`; ADR-012 `:708` (§15 "Limit")

**Problem.** "So the product reset never makes topology R2" is true only when `P` is a directory of the host user. For an atypical `P`, the reset still removes `P`, and the next guarded command makes `P` again.

**Evidence.** `stack-reset.sh:45–46` removes a link, a non-directory or another owner's directory, as before. `lib.sh:361–363` then makes a new `P` at the next start. A link or a file at `P` can come only from a hand change, and that hand change already removed the real `P`, so the ADR "Limit" covers it. A directory whose owner changed (by `chown`, or a root-made folder on another host) keeps its inode until the reset removes it. If a container bound a child of that folder before, this is the R2 sequence, and the product reset makes it. This is not measured. It is rare on Docker Desktop for macOS, where bind-made folders belong to the host user. No current row creates this state.

**Fix (Architect, text only).** Brief §2: "For a `P` in the §4 state, the product reset never makes topology R2." ADR §15 "Limit": add "or a `P` that the reset removes as before (a link, not a directory, or another owner)". No code change.

### B-SRP-02 — MINOR — ADR-012 `:706` (§15 "Failure"); `stack-reset.sh:38–52`

**Problem.** The contract does not state the new failure order. A failed removal now stops `stack:reset` at once, and later paths are not tried. ADR §15 says only "An entry that cannot be removed → exit not 0, and no success line" and "The other removals of `stack:reset` do not change".

**Evidence.** Probe E1: after a failed `.secrets/app` removal, the old script removed `P` and `infra/.logs`; the candidate keeps both. Both exit 1 with no success line. The brief §4 rule ("A failed removal stops the script (`set -e`)") explains the code. But a maintainer who reads ADR §15 can expect the old continue-then-fail order. The operator sees only raw `rm` or `find` text, as before.

**Fix (Architect, one sentence in ADR §15 "Failure").** "Any failed removal stops `stack:reset` at once; later paths are not tried. The exit is not 0, there is no success line, and some data can stay. Fix the cause, then run `stack:reset` again." Optional (Author): the same short note in the `infra/README.md` `stack:reset` row. No code change.

### B-SRP-03 — MINOR — brief `storage-reset-parent-repair.md:147` (§8 "`build-queue` binds")

**Problem.** The row says "Not measured; not changed. Q1 and T7 exercise it." The second sentence claims more than these gates check. The build-queue binds use the short syntax, so Docker can make a missing path instead of refusing. The risk is then a silent stale view, not a start failure.

**Evidence.** `stack:reset` deletes `infra/.data/build-queue` (`stack-reset.sh:38`). `compose.yaml:198–200` binds `requests`, `status` and `out` under it, which is the R2 shape. Q1 inspects only the two content binds (brief §7). I found no build request in the T7 specs (`tests/e2e/*.spec.ts`) or in M2. `run-t8.mjs:8–9`, `:58` runs `stack:up` on its own clone, with no reset before its builds. So no listed gate sends a build request after reset and start. A stale view would show as a build with no progress (the app's 10-minute limit), not as an error at start.

**Fix.** (1) Architect, text only: "Not measured. No current gate sends a build request after a reset and a start." (2) Optional and additive (Lead decision, no waiver): add one host-written marker in `build-queue/requests` to an existing probe after reset and start, and read it inside `cogniate-app`. This repair does not change build-queue behavior, so this finding does not block it.

### B-SRP-04 — NIT — `infra/README.md:49`; `infra/scripts/stack-reset.sh:10–11`

**Problem.** Two operator texts are imprecise.
- README: "every entry of `infra/.data/cogniate-app/` (the folder stays, empty; with the package store)". A second-language reader can read "the folder stays, empty, with the package store".
- Header lines 10–11: "It also removes … the legacy bind folders and the content folders". `cogniate-app` is a legacy bind folder, and it now stays.

**Fix.** README: "every entry of `infra/.data/cogniate-app/`, with the package store (the folder stays, empty)". Header: use the ADR §15 words: "the folder `infra/.data/lti-service` and every entry of `infra/.data/cogniate-app` (legacy files and content folders)". No action now: the `confirm_stack_delete` warning (`lib.sh:255`, "It keeps .env, infra/.certs/ and infra/.data/fixtures/") does not name the empty folder. `lib.sh` is frozen for this repair, so this can go to the M4 list.

### B-SRP-05 — NIT — `infra/scripts/stack-reset.test.mjs:194`

**Problem.** U6 plants `P/.hidden`, but no assertion reads it. A reader cannot tell why it is there.

**Fix.** Either assert that `.hidden` is gone, which records that the batched `rm` still removes the other entries before the failure exit, or delete the line.

## 8. Gates and limits

- This review approves the source and the design text for this bounded repair only. B-SRP-01 to -03 are text items. The Lead can apply them at the revision 3.4 acceptance edit, or defer them under charter §5.
- Still required, unchanged: RA20/RC5 (diagnostic, no credit), Q1/Q2, two full 488-row rounds with equal results per row, the legacy suites, fresh M2 browser rows, three T7 runs and the G-1 identity binding. No inventory or assertion waiver. B-BM-01 and A-SOR-01/B-SOR-01 stay on the M4 list.
- Not checked: the other-owner branch at runtime (it needs root), Linux hosts, and any Docker behavior. My probes used a fake `docker` only.
