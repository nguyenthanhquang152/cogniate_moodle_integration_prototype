Verdict: APPROVE
Round: 3

## Round 1

Reviewer-B: Codex GPT-6-Astra xhigh. Reviewed `docs/reviews/LA-E7-08/ld9-addendum-r1.md` at `c5031ab2`, with QA report §5, BD-A2-108, BD-A1-113, LA-ADR-04 D8, plan LD-9 and AC-LA-E7-08-05. **0 BLOCKER, 0 MAJOR, 1 MINOR, 0 NIT.**

Approval covers the three proposed hunks in §§1.2 and 2.2. It does not approve the historical optional-ref regex in §1.1 or change the failed wave-end gate result.

| Hunk | Assessment |
| --- | --- |
| Part 1, Hunk 1 — `LA-IC-14`, WE-F3 | APPROVE. The required 43-character base64url ref matches BD-A2-108. The existing HTTP 201, pending status and dynamic method assertions remain intact. `M1-15.canvas.dynamic-refused` retains its manifest identity. |
| Part 1, Hunk 2 — runner reason under AC-LA-E7-08-05, WE-F5 | APPROVE. The lookup now reads the candidate's actual `src/db/migrations` directory. Exact sorted ledger equality is unchanged; the fix does not replace it with a prefix/subset check or bypass snapshot qualification. |
| Part 2 — `LA-IC-22`, WE-F2 | APPROVE. The one-field addition matches D8's explicit frozen-test change for `launch_claims_minimized`. The required event occurrence, level, five base keys and exact field-set comparison remain intact. No other event schema changes. |

The earlier amend is clearly separated from the proposed change. Read-only checks confirmed that `src-wave-end` is clean at `8ad1292687431b05bad6b5c070ab722e67714526`, while `la-proposed-addendum-r1` preserves `9e78fe3f87bd4672a9e37ace9efdacfd96f28474`. Its actual diff contains only the two disclosed historical hunks. QA §5 explicitly retracts the earlier “fixed” claim and retains the failed/missing results.

### B-LA-E7-08-LD9-01 — MINOR — state the re-gate evidence for each hunk

**File:line:** `docs/reviews/LA-E7-08/ld9-addendum-r1.md:112`.

**Problem:** The summary describes prior failures and approval gates, but only WE-F1 explicitly says to rerun; the evidence required to close the three proposed changes is left implicit.

**Evidence:** WE-F2 and WE-F3 name their failed case IDs. WE-F5 says H1–H5 passed and J did not run, while QA §5.1 records that the aborted phase returned an empty manifest artifact. A new operator should not infer that the five earlier host results can be carried forward and only J needs to run.

**Suggested fix:** Add a short “re-gate evidence” column: WE-F2/WE-F3 require the complete M1 `sim` phase on the newly approved test SHA, including `M1-24.common.event-shapes` and `M1-15.canvas.dynamic-refused`; WE-F5 requires the complete `snapshot-upgrade` phase, all six manifest rows (`M1-38.common.h1` through `h5`, plus `M1-41.common.j-snapshot`), and exact candidate ledger evidence. Record the candidate SHA, test SHA and resulting artifact paths. Keep the nine WE-F1 rows and the separate WE-F4 baseline decision visible in the overall re-gate plan.

### Verification boundary

Read-only Git checks confirmed that every removed line in the displayed hunks matches the frozen base uniquely. Host-only checks of the proposed regex passed seven positive/negative examples; exact event-key checks accepted the new shape and rejected a missing account key or an extra key. The candidate has the documented `src/db/migrations` directory. No proposed hunk was applied, and no Docker, stack, host runner or live suite was executed. Live rerun evidence remains pending. Only this review file was written; no commit was made and the other reviewer's file was not opened.

## Round 2

Reviewer-B: Codex GPT-6-Astra xhigh. Reviewed the addendum's Round 2 and `tests/ltiaas/GATE-RUN-PLAN.md` §3C at `0f821dad945be60c3ed8d27065f8f2e94cc63cf4`. **0 BLOCKER, 1 MAJOR, 0 MINOR, 0 NIT open.** The three proposed hunks are **APPROVED**; the overall verdict is **CHANGES_REQUESTED** for the source-build recipe below.

**B-LA-E7-08-LD9-01 is closed.** §R2.3 now requires the complete M1 SIM phase, the named WE-F2/WE-F3 rows, all six snapshot-upgrade rows including J, and exact candidate ledger equality. It names the candidate/test SHA and artifact evidence, and keeps the nine WE-F1 rows and seven WE-F4 rows visible.

| Round 2 check | Result |
| --- | --- |
| Individual Hunk 1, Hunk 2 and Hunk 3 against frozen `8ad1292687431b05bad6b5c070ab722e67714526` | Each `git apply --check` exits **0** in a private `git clone --no-hardlinks`. |
| Combined §R2.2 patch | `git apply --check` exits **0**. Its changed lines equal the union of the three individual patches. |
| Assertion scope | Exactly one removed/added line per file: required 43-character ref, migration-directory lookup, and `tool_account_id` on `launch_claims_minimized`. No other assertion changes; exact event keys and exact sorted ledger equality remain. |
| Event names and qualification | Round 2 matches `contracts/lti-service-api-delta.md` §6: `launch_check_failed`, `launch_accepted`, `launch_claims_minimized`, and account ID “when it is known.” |
| Source history | §3C correctly requires a new candidate clone, a base-overlay commit, then a separate addendum commit, with all three SHAs recorded and no amend. The overlay command needs the correction below. |

### B-LA-E7-08-LD9-02 — MAJOR — the source-build recipe does not produce its exact frozen overlay

**File:line:** `tests/ltiaas/GATE-RUN-PLAN.md:242`, `:243`, `:244`.

**Problem:** `git checkout 8ad12926 -- tests` replaces matching paths but leaves candidate-only tracked files, so the following exact-tree check fails and the documented base-overlay commit cannot be reproduced as claimed.

**Evidence:** In the private clone, I checked out the reviewed integration pin `0f821dad`, ran the exact checkout command, then ran the documented `git diff --exit-code 8ad12926 -- tests`. It exited **1**, with **24 extra files** remaining, including the kit, the LA-E5-24 drill and LA-E4-02 tests. This is already true before the Lead selects the final candidate. The command block also has no fail-fast setting or explicit stop on that failed check, so pasting the block can continue to commit the non-exact overlay.

**Suggested fix:** In the new disposable clone only, use `git restore --source=8ad1292687431b05bad6b5c070ab722e67714526 --staged --worktree -- tests` to restore the exact tree, including deletions. Make the equality check a hard precondition for commit 1. In the same private probe this replacement produced exit **0**, and all three individual patches plus the combined patch still passed `git apply --check`. Preserve the two separate commits and record their SHAs as planned.

### Verification boundary

Evidence: `/tmp/reviewer-b-ld9r2-checks.json`, `/tmp/reviewer-b-ld9r2-overlay-probe.json`, `/tmp/reviewer-b-ld9r2-restore-control.json`; extracted patches: `/tmp/reviewer-b-ld9r2-patch-{1,2,3,4}.diff`. The private clone is `/tmp/review-b-ld9-r2-9tiku93i`. The frozen source remains clean at `8ad1292687431b05bad6b5c070ab722e67714526`. No addendum was installed in a gate source, no commit was made, and no Docker, stack, host stack runner or live suite was run. Gate PASS remains pending. Only this review file was edited in integration; the other reviewer's file was not opened.

## Round 3

Verdict: **APPROVE**. Reviewer-B: Codex GPT-6-Astra xhigh. Source-procedure-only review of `tests/ltiaas/GATE-RUN-PLAN.md` §3C at `1b5469f769e7b5fe362a100825d04ed1f499ab42`. **0 BLOCKER, 0 MAJOR, 0 MINOR, 0 NIT open.**

**B-LA-E7-08-LD9-02 is closed.** Independent read-only checks in `src-wave-end-2`, all with `GIT_OPTIONAL_LOCKS=0`, confirmed:

- HEAD and `la-gate-test-base-c1` are `bf8153404449dbfef47698ceb82fa0262e9d9c48`; its sole parent and `la-wave-end-product-2` are `93ab0c50467772f7f1c4b5fa9feb137048305c43`.
- `bf815340:tests` and `8ad12926:tests` both equal tree `f42d4150b7b11ba2b2e63898ee317e6dea3f9430`; the test-tree diff is empty and exits 0.
- `git diff --exit-code 93ab0c50 bf815340 -- . ':!tests'` is empty and exits 0. Working status is clean.

The procedure now uses `git restore --staged --worktree` and checks both working-tree and staged equality before commit 1. `set -euo pipefail` makes the standalone restore, equality, patch and commit commands stop on failure. The addendum remains a separate commit 2, preceded by `git apply --check`; no amend is allowed. The previous three-hunk approval and closure of B-LA-E7-08-LD9-01 remain valid.

Evidence: `/tmp/reviewer-b-ld9r3-readonly-checks.json` (nine successful read-only checks). Commit 2 was still pending at inspection; this review does not claim it was created or that the live gate passed. No file was written in either gate source, and no Docker, stack, host runner or live suite was executed. Only this review file was edited in integration; no commit was made and the other reviewer's file was not opened.
