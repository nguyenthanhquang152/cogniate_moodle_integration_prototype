Verdict: APPROVE
Round: 1

# Storage lock release repair (Q-R1A-01): bounded source review (Reviewer-B)

Lens B: maintainability, error handling, operability, and whether the tests demonstrate the contract. This is a bounded review of the 75-insertion, 5-deletion product patch only. It is not a storage redesign.
Blind: I did not read the peer source review, the current independent QA output, later phase-plan summaries of peer findings, or in-progress harness diffs. I read the charter and the phase plan at `b484b3997944eb8d1f237f0b066d117c53f559cf`. I used the design approvals (`d8ca978`, `f8c0d41`) as design history only, not as implementation evidence.

## 1. Target and method

| Item | Identity |
| --- | --- |
| Target | `9f8ac625443931242edd8da301c3d4f0d3e34290` |
| Product parent | `01ce5bc2d2d26e4fb1226c5f4f19528fb9ed576b`. The 26 commits between it and the target change only `docs/**`. |
| Frozen design | `2362a20fc4cdd9c21c9283dc7099068c6565eb31`: `storage-command-conformance.md` `1128b9c198ba79d9cac6471874eecdd2c48b40bc555e525f107d31846b8265de`, ADR-012 rev. 3.7 `2b3b601b771559870b2f997159c45ce366c203171c701acb4064c6dba41a1d7d`. Both hashes match. Neither file changes up to the target. |
| Helper | `infra/scripts/storage-oplock.sh` `19d496b5e711cda8589ce7d1ad28070b59c23308f1154bf292b220dc098a4a6b` (parent `90d24679…`) |
| Unit file | `infra/scripts/storage-oplock.test.mjs` `ba14f34108f73f58c6f757797151520e588165f8888ae9bd9f9853613461fdcf` (parent `e2b2224b…`) |
| Hash list | `infra/compat/storage-compat.sha256` `7e3ae0ce88c76f18fd3871a6124c40b25a070f6e5ed194d802ce960a015e843f` |
| Method | Source through `git show` at the exact SHAs only (no worktree product file). One focused private probe: the committed W-1 unit tests on the exact target bytes, nine private mutants and one private R-3 addition (§6). |

The three hashes above equal the values in the task.

## 2. Findings

| Id | Severity | Where | Problem |
| --- | --- | --- | --- |
| B-RR-01 | MINOR | `storage-oplock.test.mjs:256–268`, `:279–285` | The committed matrix has no R-3 row (TERM or INT, lock not lost), on either option set or on `run`. |
| B-RR-02 | NIT | `storage-oplock.sh:396–400`; JS `:173–176` | A lost lock now changes a success into exit 1, but the only explanation is a JSON event line. There is no human text on stderr. |
| B-RR-03 | NIT | `storage-oplock.sh:364–378`, `:384–391` | `STORAGE_LOCK_RELEASE_FAILED` is a per-shell flag. Acquire does not reset it, and no comment says so. |

There is no BLOCKER and no MAJOR finding. Details are in §7.

## 3. Scope and byte checks

- **Product scope.** `git diff --numstat 01ce5bc 9f8ac62 -- infra`: hash list 1/1, helper 14/3, unit file 60/1. That makes 75 insertions and 5 deletions. Outside `docs/**`, no other path changes.
- **Embedded JavaScript.** The heredoc is at `:14`–`:350` in both versions. Lines 15–349 are byte-identical: both extracts have SHA-256 `ed1a1af05b41a70c0b59f3a2a9315e947075fa8a980bf8f7d91178a3e40852ad` (335 lines). So the lock algorithm, events, `release()` (`:170–181`), the quiet A6 releases (`:151`, `:163`) and the selftest stay the same.
- **Bash changes.** Only three hunks: the header comment `:8`, the trap `:375`, and `:384–400` (the release function and the new handler). Acquire `:364–374` and `run` `:418–424` do not change. The release call has the same arguments as parent `:388`.
- **Hash list.** All four lines equal the target blobs (knobs, probe, `storage-compat.sh`, helper). Only the helper line changes. The unchanged unit test `storage-compat.test.mjs:334–337` asserts that the list equals the current hashes.
- **Unit-file deletions.** The only removed line is the old lost assertion (status 0). It becomes status 1 at `:211`, as design §3.7 requires. No other assertion is weakened or removed.

## 4. The status rule (design §3.7 (a)–(d))

| Requirement | Evidence at the target | Result |
| --- | --- | --- |
| (a) Any nonzero release result counts as a failed release of this holder. It never ends the caller. | `:390` `_storage_oplock_js release … \|\| STORAGE_LOCK_RELEASE_FAILED=1`. The call is in an AND-OR list, so `set -e` does not act on it. The function returns 0 in both branches (`:387`, `:390`). | OK |
| (b) The `EXIT` handler alone sets the final status, including after an earlier explicit release. | `:375` sets `trap '_storage_lock_exit' EXIT`. `:397` reads `$?` first. `:398` releases only if the lock is still held. `:399` reads the shell-global flag, so a failure from an earlier explicit `storage_lock_release` also counts. Only a status of 0 becomes 1. | OK |
| A nonzero status is kept. | If the status is nonzero, the handler returns without `exit`. Bash then exits with the status that it saved when the trap started. Rows R-2, R-6 and R-7 prove this on bash 3.2. | OK |
| No early errexit inside the handler | `local` returns 0. `storage_lock_release` returns 0. `[[ … ]]` is an `if` condition. No command in the handler can start errexit. | OK |
| (c) No dependence on options; safe `set -u` defaults | `${STORAGE_LOCK_HELD:-0}` (`:387`), `${STORAGE_LOCK_RELEASE_FAILED:-0}` (`:399`), `local status`. Mutants M5a and M5b are caught (§6). | OK |
| (d) `run` keeps `exit "$code"` and has no status branch of its own | `:419–424` do not change. Rows R-4 and R-5 prove the path: the explicit release fails, then `exit 0`, then the handler gives 1. | OK |
| The foreign record and lock ownership do not change | The JavaScript is identical. Each holding releases once, because `:388` sets `STORAGE_LOCK_HELD=0` before the call. R-4 asserts that F is byte-identical and that only the lock folder is in `.tmp/`. Mutant M8 is caught. | OK |
| Command and event non-regression | The JavaScript and the release arguments are the same, and there is one release call per holding. So events and command fields can change only through the exit status. This follows from the source; I did not run R-13. | OK (by source) |

**Callers (supported paths).** All guarded scripts acquire once per process and release only through the trap: `stack-up.sh:13`, `stack-restart.sh:14`, `stack-reset.sh:15`, `stack-data.sh:32`, `storage-compat.sh:125`, `:142`, `:166`. No script sets its own `EXIT` trap after acquire, and no script calls `storage_lock_release` directly. `stack-up.sh:16` sources `lib.sh` again, which sources the helper again (`lib.sh:329`). The top level of the helper only sets `_storage_oplock_dir` and defines functions. So `STORAGE_LOCK_HELD`, the flag and the trap stay as they are.

**Signal paths.** I found no path that gives a false 0 after a lost lock. If TERM or INT arrives during the explicit `run` release or during the handler release, the result is 130 or 143. Both are nonzero.

**§12 wrapper (R-11), by source only.** `storage-compat.sh:166` acquires from the copied helper. `:175–177` runs the command. `:178` `status_check` prints `storage-compat status: OK` (`:108`) or stops with "stop now". `:179` `exit "$code"` then runs the handler. Expected results: when the lock is lost, exit 1 with no "stop now" text; the control exits 0. A fresh `enable` (`:129–135`) copies the helper and the hash list from the checkout and checks the copies against the list. So an `enable` from `9f8ac62` gets the repaired helper. An earlier `enable` keeps the old copy until `disable` and a new `enable`. That is the known B-RD-04 note, not a defect of this patch.

## 5. R-1 to R-14 against the committed tests

The shared check `expectEnd` (`:241–255`) runs on every new row. It asserts the exact status and exactly two events. It asserts that the end event has the acquire event's command, `runId` and `pid`. For `lost`, it also asserts owner F, F byte-identical, and only the lock folder in `.tmp/`. For `gone`, the owner is null and `.tmp/` is empty. For `released`, `.tmp/` is empty.

| Case | Sourced, no options | Sourced, `set -euo pipefail` | `run` | Note |
| --- | --- | --- | --- | --- |
| R-1 | `:257` | `:257` | `:80–102` (pre-existing) | |
| R-2 | `:258` | `:258` | `:223` (pre-existing) | |
| R-3 | only `:225–226` (pre-existing, TERM) | none | none | B-RR-01. My private rows pass (§6). |
| R-4 | `:259` | `:259` | `:280` | |
| R-5 | `:260` | `:260` | `:281` | |
| R-6 | `:261`, `:262` | `:261`, `:262` | `:282` | The `false` row (status 1) cannot tell W-1 from "lost overrides all". The exit 7 rows can. |
| R-7 | `:263–264` | `:263–264` | `:283–284` | TERM and INT both |
| R-8 | `:265`, `:266`, `:268` | same | not applicable (design: R-1, R-4 and R-6 cover `run`) | In (iii), `storage_lock_release` is a plain command on its own line, with no condition or wrapper (`:268`, run under `:270–274`). |
| R-9 | `:104`, `:115`, `:133`, `:151`, `:195` (pre-existing) | — | — | The bash acquire path exits at `:371` before the trap is set, as before. There is no `operation_in_progress` unit case (it needs the 120 s wait). |
| R-10 | `:104–113` (pre-existing) | — | — | |
| R-11 | — | — | — | Not in the unit suite. §3.7 lets the Author change only `storage-oplock.test.mjs`. Source reading only (§4). Independent QA must run it. |
| R-12 | `storage-compat.test.mjs:334–337`, `:238–246` (pre-existing) | — | — | My list check matches (§3). |
| R-13 | — | — | — | By source only (§4). Not run. |
| R-14 | `:294–302` (pre-existing) | — | — | The selftest JavaScript is identical. |

## 6. Private probe (focused)

- Root `/tmp/rb-q-r1a-01` (0700). Files are 0600 and folders 0700. `TMPDIR` and `HOME` point inside the root. The unit tests put a fake `docker` first on `PATH`. No real Docker, network, install or settings were used. `MANIFEST.sha256` `2346afab884a0f3251d636b8982402e1dbffbe3e13d022e9a4acef8d6db3346b`. Mutation tool `tools/mutate.mjs` `ab31913f…`. Summary `out/SUMMARY.txt` `44d591a0…`.
- Host: `/bin/bash` 3.2.57, the only bash (`env bash` resolves to it). Node v24.21.0.
- I ran the committed tests that match `sourced (`, `run --: R-`, `release moves only` and `the EXIT trap releases`. On the exact target bytes, 29 of 29 pass.
- Mutants. Each mutant is one exact, single-match replacement in a private copy of the helper. The test file is unchanged. The ids M1 to M8 are probe folder labels, not milestones.

| Id | Family (design §3.8) | Mutant | Failing tests (of 29) |
| --- | --- | --- | --- |
| M1 | release result discarded | `\|\| true` at `:390` | 9: R-4 and R-5 on all paths, R-8 (ii), old `:211` |
| M2 | lost overrides every status | handler without `status == 0` | 11: R-6 (7), R-7, R-8 (iii) on all paths |
| M3 | only the `run` path repaired | trap back to `storage_lock_release`; `run` sets `code=1` | 7: sourced R-4, R-5, R-8 (ii), old `:211` |
| M4 | only the trap path repaired | explicit release discards; the handler releases and records itself | 5: `run` R-4 and R-5, sourced R-8 (ii), old `:211` |
| M5a | status depends on `set -u` | no default for the flag at `:399` | 2: `set -euo pipefail` R-1 and R-8 (i) |
| M5b | status depends on `pipefail` | release call piped through `cat` | 4: no-options R-4, R-5, R-8 (ii), old `:211` |
| M6 | explicit release ends the caller (`set -e`) | `\|\| { …=1; return 1; }` | 5: `set -euo pipefail` R-6, R-7 and R-8 (iii) (1, not 7); `run` R-6 |
| M7 | handler uses only its own release result | handler keeps a local result | 5: sourced R-8 (ii), `run` R-4 and R-5, old `:211` |
| M8 | release removes or moves F | JS `release()` removes the lock folder when lost | 19: every lost row (F bytes, `.tmp/` entries) |

- All eight families are caught. Each family fails at least one committed row that the design names for it.
- R-3 addition: a private copy of the test file (`r3/…/storage-oplock.test.mjs` `c0e282c2…`) with eight more tests. Four are sourced R-3 cases (TERM and INT, not lost, on both option sets). Two are `run` R-3 cases (TERM and INT, not lost). Two are `run` rows for R-1 and R-2. On the target, 37 of 37 pass. This is reviewer evidence only. It is not acceptance evidence.

## 7. Finding details

### B-RR-01 (MINOR, test coverage): no R-3 row in the committed matrix

- **Problem.** Design §3.8 asks for R-1 to R-8 on the sourced path with no options and with `set -euo pipefail`, and for each case on `run`. §3.7 asks the Author to add the cases that the unit suite can run. The `SOURCED` table (`:256–268`) and the `RUN` table (`:279–285`) have no R-3 row. The only R-3 test is the pre-existing sourced TERM case with no options (`:225–226`). INT, `set -euo pipefail` and `run` are not covered.
- **Evidence.** The private rows in §6 show that the unit harness can run R-3 with its existing helpers, and that the target passes them.
- **Effect.** It is small. The handler does not branch on signals. R-2 and R-7 protect the same nonzero-status path, and no mutant family depends only on R-3. But the unit suite does not fully prove the claim "R-1 to R-8 on both option sets", and a later edit of the INT or TERM traps would have no unit check.
- **Fix (safe to defer).** Add `['R-3 not lost, TERM', 'kill -TERM $$; sleep 5', 143, 'released']` and the INT row (130) to `SOURCED`. Add the same rows with `$PPID` to `RUN`. Independent QA R-3 stays REQUIRED. This finding does not change it.

### B-RR-02 (NIT, operability): exit 1 after a lost lock has no human text

- **Problem.** After this repair, `npm run stack:up` (or any guarded command) can finish all its steps and then exit 1, only because the lock was lost. The handler (`:399`) exits without a message. The JavaScript `release()` (`:173–176`) writes only the `storage_lock_lost` JSON line to stdout and `infra/.logs/storage-lock.jsonl` (`eventLine`, `:63–70`). Every other refusal in the helper also writes one plain sentence to stderr.
- **Effect.** An operator sees npm's generic failure and must find the JSON line. The exit status is correct, and the event names the other owner. So this is only an operability gap.
- **Why not now.** The frozen design keeps the JavaScript byte-identical and requires R-13 to show no difference except the exit status. A new stderr line would break that rule.
- **Fix (deferred).** Add one stderr sentence for `storage_lock_lost` in a future separately authorized helper edit. Example: "The storage lock was lost: another command holds it now. This command's result is not proven safe." M4 carries only the operator note and the deferred item. No helper-code edit is authorized as part of M4. Docs can add one line to the operator notes.

### B-RR-03 (NIT, maintainability): the failure flag is per shell and not documented as such

- **Problem.** `storage_lock_acquire` (`:364–378`) does not reset `STORAGE_LOCK_RELEASE_FAILED`, and the comment at `:384–385` does not say that the flag lasts for the whole shell. The variable could also come from the environment.
- **Supported paths.** No supported caller acquires twice in one shell, and none exports the flag (§4). In both unsupported cases the result is a false 1, never a false 0. That is fail-closed, and arguably correct after any lost holding.
- **Fix (optional, in a future separately authorized helper edit).** Add one comment sentence at `:384`: "The flag is per shell; acquire never resets it." If a re-acquire lifecycle is ever supported, decide the reset rule in the design first.

## 8. Observations (not findings)

- **New lifecycle assumption, unsupported.** The status rule exists only in the `EXIT` trap. If a caller replaces the trap after acquire, uses `exec`, or is ended by `SIGKILL`, it gets neither the release nor the status rule. The release part of this was already true before the patch. No supported caller does any of these (§4). The header (`:8`) now says "optional: the EXIT trap releases and sets the status", which documents this clearly.
- **R1-A QA O-1 (quiet A6 release).** It is untouched. The quiet releases at `:151` and `:163` are in the identical JavaScript. Acquire failures exit at `:371` before the trap is set. It stays a MINOR deferred to M4 and is not part of this repair. The repair does not waive any required failing assertion.
- **History.** The historical R1-A QA FAIL stays. This review gives no QA or runtime credit.
- **Test readability.** The comments and names of the new rows map each row to its design case and expected status, and the assertion messages include stderr and the event list. These help a new owner. `record({ root: '/elsewhere' }, …)` at `:237` passes a stand-in repo object only to set `checkout`. This is a little indirect, but it is clear enough.

## 9. Validation and limits

- **What I ran.** `git show`, `git diff` and `git grep` at the exact SHAs. Hash checks of the three targets, the design files and all four hash-list entries. Byte comparison of the JavaScript. The focused private probe of §6.
- **What I did not run.** Bash 4 or 5 (this host has only 3.2.57). Linux bash semantics come from reading only. R-11 on an old-SHA clone. The R-13 comparison. The R-9 `operation_in_progress` case. `npm run test:infra`, the root `npm run check` and the full storage-oplock file (the selftest and A3/A4 rows). I did not repeat the Author results (111/111; 1,123 pass with five absent-real-fixture skips). They are claims only.
- **Claims tested and claims not tested.** §4 rows marked "OK" come from source reading. The §5 and §6 results that I name as passing or failing come from my probe on bash 3.2. R-11, R-13 and fresh-`enable` behavior come from source reading only.
- **Probe hygiene.** At the start, one file with the public target helper bytes was created with mode 0644 inside the 0700 root (shell umask 022). I deleted it within a minute and set umask 077 for all later work. All files that remain are 0600 and all folders are 0700. A repo-wide `git grep` at the target SHA showed a few committed `tests/host` lines. I did not use them, and I read no in-progress harness diff or report.
- **No other changes.** I changed no product, test or other doc file. `pnpm-workspace.yaml` and the worktree's in-progress `tests/host` changes are untouched. No commit, push or merge.

## 10. Verdict

**APPROVE.** The patch implements the single `EXIT` status rule of design §3.7 exactly. It records every release error, including one from an earlier explicit release. It does not end the caller early, does not depend on shell options and keeps every nonzero status. The JavaScript, the foreign record, the events and `run`'s `exit "$code"` do not change. The hash list is current, and the committed tests catch all eight mutant families. B-RR-01 (MINOR) and the two NITs do not block. Independent host QA (including R-3, R-11 and R-13) is still required.
