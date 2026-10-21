Verdict: CHANGES_REQUESTED
Round: 1

# Storage lock release: bounded design confirmation (Reviewer-B)

Lens B: operability, simplicity, and acceptance controls that discriminate. This is a bounded confirmation of W-1, the repair scope, the cases and O-1. It is not a storage audit. Blind: I did not read the peer report.

## 1. Target and method

| Item | Identity |
| --- | --- |
| Target | `docs/architecture/tasks/storage-command-conformance.md` at `3a5b61e`, SHA-256 `cc1b0753bf84cf94948a5f45fb523139731ffa81c9bdac96cdcef7883c6122f0` (worktree file identical) |
| Product / tests | `01ce5bc`: `storage-oplock.sh` `90d24679…`, `storage-compat.sh` `65be43f2…`, `storage-oplock.test.mjs` `e2b2224b…` (all equal to the spec pins). `tests` tree `4c7e067` at `01ce5bc` and at HEAD `a2d79fe`. |
| ADR-012 | at `4410e85`, `165a78ee…`: lines 237, 254, 285–290, 584–585 |
| Probe | `/tmp/rb-w1-probe.qh30Ch` (0700; files 0600 from creation). `probe.sh` `87359c64…`, `probe2.sh` `f5876435…`. `/bin/bash` 3.2.57, the only bash on this host (`env bash` resolves to it). The probe uses stand-in functions. It runs no repository code, no Docker and no network. |

## 2. Findings

| Id | Severity | Where | Problem |
| --- | --- | --- | --- |
| B-RD-01 | **MAJOR** | §3.7 (a), (c) and §3.8 R-8 | The mechanism in (a) conflicts with R-8 and W-1 under `set -e`. |
| B-RD-02 | MINOR | §3.8 lines 100, 104–106 | The sourced cases do not use the real option set (`set -euo pipefail`). |
| B-RD-03 | MINOR | §3.6 W-1 text, §3.7 (a) | The W-1 status list reads as complete. The trigger in bash is "release status ≠ 0", not only "lost". |
| B-RD-04 | NIT | §3.8 R-11 | An `enable` made before the repair keeps the old helper copy on the old-build route. |

### B-RD-01 (MAJOR): one status rule, not two

- **Problem.** (a) says `storage_lock_release` keeps the subcommand status, so the function returns 1 after a lost release. Every guarded script, the §12 wrapper and `run` use `set -euo pipefail` (`stack-up.sh:10`, `stack-restart.sh:11`, `stack-reset.sh:12`, `stack-data.sh:13`, `storage-compat.sh:13`, `:163`, `storage-oplock.sh:395`). So an explicit call ends the caller with 1 at once, and a kept status (7, 130 or 143) becomes 1. (c) protects only `run`. R-8 runs on the sourced path with `set -e` and expects "status as … R-6", which is 7. The spec's own mutant "a status that changes with `set -e`" describes the literal (a) design.
- **Evidence (probe2, `a-explicit`).** Child 7, lost, explicit release, then `EXIT`: `set -euo pipefail` → **1**; no options → 7. The single-rule variant (`i-explicit`, `i-runpath`) gives the W-1 result in all 16 cells with no `run` branch: lost+0 → 1, lost+7 → 7, not lost → the status unchanged.
- **Effect.** The brief permits a mechanism that the frozen QA criteria reject. Result: one more Author, review and QA round. The other risk: QA reads "R-1, R-4 or R-6" loosely, and the explicit-call case ships without a check. Two status rules (the `run` branch and the handler) are also harder to own than one.
- **Fix (requirement text, not code).** Replace (a) and (c) with: "`storage_lock_release` records a failed release and never ends the caller through `set -e`. The `EXIT` handler alone sets the final status: it reads the status at entry, releases if the lock is still held, and calls `exit 1` only when a release (in the handler or earlier) failed and that status is 0. `run` keeps `exit "$code"`." Change the mutant "`|| true` kept" to "release result discarded". Add the mutant "an explicit release that ends the caller under `set -e`" (sourced R-8 with child 7).

### B-RD-02 (MINOR): run the sourced cases with the real options

- Line 100 says "with and without `set -e`", and only for the lost cases. Production always has `-u` too. A handler that reads a lost flag before anything sets it fails under `-u`. Probe2 `u-trap`: under `set -euo pipefail`, normal 0 → **1** and normal 7 → **1**. With no options, both are correct. The `run` path does not catch this when the explicit release sets the flag first.
- Fix: "Run R-1 to R-8 on the sourced path twice: with `set -euo pipefail` (as the guarded scripts) and with no options."

### B-RD-03 (MINOR): W-1 text precision

- (a) "It keeps a nonzero status that it already has: the command's own failure, 130 …, or 143 …" reads as a complete list. R-6 also uses a `set -e` error (1), and the wrapper has "stop now" (1). Change it to "It keeps any nonzero status that it already has, for example …".
- (b) The bash part sees only the subcommand status. Status 1 also comes from a release error that is not a lost lock, for example when `renameSync` throws (`storage-oplock.sh:177`, generic branch `:345–347`, no `storage_lock_lost` event). Add one sentence to the brief: "Any nonzero release status counts as a failed release for the status rule." This fails closed. The Author does not parse codes, and QA does not report it as a deviation. W-1 can stay limited to `storage_lock_lost`, because the ADR does not cover release errors.

### B-RD-04 (NIT): stale copies on the old-build route

`run` checks the copies against the copied hash list (`storage-compat.sh:161`). A checkout that ran `enable` before the repair keeps the old helper and the matching old list. That checkout keeps exit 0 after a lost lock until `disable` and `enable`. R-11 must enable from the repair SHA. Docs can add one line to the hand-over notes. QA uses fresh clones, so no gate effect.

## 3. Disposition by item

| Item | Disposition |
| --- | --- |
| **W-1** (proposed wording, not a current requirement) | **Approve as contract precision**, with the B-RD-03 (a) change. The main case equals the literal text. A nonzero status is already a failure for every zero/nonzero caller. 1 would remove the signal meaning of 130 and 143 and the child's diagnosis. `storage_lock_lost` names the cause. No new exit code is needed. The §12 sentence is correct. **Current requirement until the Lead decides and the Architect edits ADR-012:** the literal "exit 1" in every lost case (spec §3.6). |
| **Scope** | **Bash-only and minimal: confirmed.** The only product pin of the helper hash is `infra/compat/storage-compat.sha256:4`. `storage-compat.sh` and the guarded scripts get the new handler through `storage_lock_acquire` and do not change. The JavaScript part, the events and O-1 stay out. The mechanism text needs B-RD-01. |
| **`run` path** | R-1 to R-7 are sufficient. The only-trap and only-`run` mutants are caught. A naive repair (only `\|\| true` removed) gives lost+7 → 1 and lost+INT/TERM → 1 under `set -e` (probe `naive`). R-6 and R-7 catch it. |
| **Sourced `EXIT`, with/without `set -e`** | Sufficient after B-RD-02. Naive repair, no options: lost+0 → 0 (probe). Sourced R-4 catches it. With `set -e`: lost+7 → 1. R-6 catches it. |
| **Explicit release, then `EXIT`** | Not consistent until B-RD-01 is fixed. After the fix, sourced R-8 with child 7 under `set -euo pipefail` is the case that discriminates. Keep "exactly one released or lost event". |
| **Signal / child precedence** | Sufficient: R-3, R-6, R-7. W-1 handler probe: lost+INT → 130, lost+TERM → 143, lost+`set -e` error → 1. |
| **Copied old wrapper** | R-11 (lost after exit 0 → 1, F kept) and R-12 (hash line, byte copies, mutants) are sufficient. They prove that the copy has the repair, plus B-RD-04. The wrapper's nonzero cells use the same handler as the sourced R-6. |
| **Foreign lock** | Sufficient: R-4 (F byte-identical, no `rel-`/`stale-`), R-5 (no lock created), R-9, R-10. |
| **O-1** | **Confirm MINOR log-only deferral to M4.** At tests tree `4c7e067` only two required oracles pair an acquire with a release: `storage-rows.mjs:437` (`a-lock-scope`) and `storage-compat-route.mjs:237` (`lockHeld`). In both rows an O-1 path also exits 1, and the same row checks that exit (`storage-rows.mjs:427`, `:434`; `storage-compat-route.mjs:236` `statusPass` needs exit 0). `g-orphan-refusal` (`storage-rows.mjs:724–738`) refuses in A5, before any acquire. So O-1 is not the only cause of any required-row failure. **Condition:** the deferral cannot waive a required row that fails only because a released event is missing. If that occurs, the Lead rates O-1 again. D1 (Docker not running) is the common trigger, so put O-1 first in the M4 deferred list. |

## 4. Preserved

- The R1-A QA Round 1 FAIL, the source approvals `7fbf7c8` and `0a97fe9`, and the frozen triage at `2d763fe` do not change.
- This review writes only this file. No product, test, ADR or team file changed. `pnpm-workspace.yaml` is untouched.

## 5. To close

B-RD-01 needs a text change in §3.7 and §3.8 (about four sentences) before the Author brief. B-RD-02 and B-RD-03 can go in the same edit. After that edit, I expect APPROVE with no new review scope.
