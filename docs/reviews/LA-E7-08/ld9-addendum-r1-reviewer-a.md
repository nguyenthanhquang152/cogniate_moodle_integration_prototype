Verdict: APPROVE
Round: 3

## Round 1

Reviewer-A: Codex GPT-6-Astra xhigh. Reviewed the proposed addendum at integration `c5031ab2`, against frozen gate test SHA `8ad1292687431b05bad6b5c070ab722e67714526`, BD-A2-108, BD-A1-113, LA-ADR-04 D8 / LD-9, contract delta §6 and AC-LA-E7-08-05. **0 BLOCKER, 1 MAJOR, 1 MINOR, 0 NIT.** The intended three changed lines are correct; Part 2 needs an applicable patch.

| Proposed hunk | Assessment |
| --- | --- |
| §1.2 Hunk 1, WE-F3 / LA-IC-14 | Correct and minimal. The suffix requires `?ref=` and exactly 43 base64url characters. The historical optional group is clearly superseded. Status, pending state and method assertions remain unchanged. Seven host regex probes accept the valid URL and reject absent, empty, short, long, invalid-character and extra-query variants. |
| §1.2 Hunk 2, WE-F5 | Correct and minimal. Only the directory string changes, to the candidate's `services/lti-service/src/db/migrations`. At the frozen gate SHA, the nonexistent `src/store/migrations` directory selects `oldLedger['lti-service/lti.db']` at line 336, incorrectly expecting the old four migrations. The real candidate folder has 21 SQL files. The sorted full ledger and `assert.deepEqual` at line 340 remain intact; no prefix or subset comparison is introduced. |
| §2.2, WE-F2 / LA-IC-22 | The added `tool_account_id` is correct and is the only intended assertion change. Exact key equality, event presence, level checks and secret scans remain unchanged. The displayed patch does not apply to its declared base; see A-LA-E7-08-01. |

### A-LA-E7-08-01 — MAJOR — Part 2 has nonexistent patch context

**Location:** `docs/reviews/LA-E7-08/ld9-addendum-r1.md:104`.

**Problem:** The proposed `99-logs.test.ts` hunk is not an applicable diff against the frozen gate SHA. Its trailing context shows a second `['cogniate-app', {` block and an `lti_app_launch_received` row. Neither line follows the LTI schema in that file. Applying the reviewed list would require the operator to repair it by hand.

**Evidence:** Read the target directly from `8ad12926` in the gate repository. After line 34 (`}],`), line 35 is `] as [string, Record<string, [string, string[]]>][]) {`, followed by the log-reading loop. Extracting the proposed §2.2 fenced diff and running `git apply --check` against private copies of the frozen files returns exit 1: `patch failed: tests/acceptance/M1/common/99-logs.test.ts:30`. The two §1.2 hunks pass the same check.

**Suggested fix:** Regenerate Part 2 against `8ad12926`, with only the `tool_account_id` addition at line 33 and real surrounding context. Confirm `git apply --check` succeeds and the resulting diff has no other change in this test.

### A-LA-E7-08-02 — MINOR — The contract prose names nonexistent launch events

**Location:** `docs/reviews/LA-E7-08/ld9-addendum-r1.md:89` (also the unqualified wording at `:82`).

**Problem:** `launch_ok`, `launch_rejected` and `launch_unknown_claims_dropped` are not the event names in contract delta §6 or the implementation. The sentence also drops the contract's “when it is known” qualification for the account ID.

**Evidence:** `docs/architecture/ltiaas/contracts/lti-service-api-delta.md:399` names `launch_check_failed`, `launch_accepted` and `launch_claims_minimized`, with `tool_account_id` when known. These are the names emitted by `services/lti-service/src/http/routes/protocol.ts:41`, `:52` and `:53` at the reviewed SHA. The proposed changed assertion uses the correct `launch_claims_minimized` name, so this prose error does not require another test change.

**Suggested fix:** Use the three actual event names and retain “when known.” Keep LA-IC-22's test-change scope limited to the single `launch_claims_minimized` field addition.

### Verification boundary

Read the declared integration commit with git and the frozen test files from `/Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end`, whose HEAD is `8ad12926` and status is clean. Host-only checks used copied files under `/tmp/la-review-a-fc653aca4e95`: Part 1 patch check PASS; Part 2 patch check FAIL as above; seven regex probes PASS; exact ledger probes reject old-only, missing and extra entries; exact log-key probes still reject missing and extra keys. No stack, Docker, host stack runner, install, commit or frozen-test edit was performed. This is approval review of proposed changes, not a wave-end regression result. Only this review file changed in integration, and Reviewer-B's file was not opened.

## Round 2

Reviewer-A: Codex GPT-6-Astra xhigh. Reviewed `docs/reviews/LA-E7-08/ld9-addendum-r1.md` Round 2 and `tests/ltiaas/GATE-RUN-PLAN.md` §3C at `0f821dad945be60c3ed8d27065f8f2e94cc63cf4`, against LD-9, AC-LA-E7-08-05 and contract delta §6. **CHANGES_REQUESTED: 0 BLOCKER, 1 MAJOR, 0 MINOR, 0 NIT open.** Both original findings close and all three proposed hunks are approved. The new issue is in the procedure that builds the test source, not in those hunks.

### Round 1 findings closed

| Finding | Status and evidence |
| --- | --- |
| A-LA-E7-08-01 (MAJOR) | **CLOSED.** Round 2 Hunk 3 has the real trailing context from `8ad12926`. Each of the three individual hunks and the combined patch passes `git apply --check` on a private clone at the exact frozen SHA. Applying the combined patch and comparing complete file contents confirms only the three named single-line replacements; no other assertion changes. |
| A-LA-E7-08-02 (MINOR) | **CLOSED.** Round 2's Hunk 3 rule (`ld9-addendum-r1.md:174`) and summary name `launch_check_failed`, `launch_accepted` and `launch_claims_minimized`, with **when it is known**, matching `contracts/lti-service-api-delta.md:399`. The superseding test change still adds only `tool_account_id` to `launch_claims_minimized`. |

The required `?ref=[A-Za-z0-9_-]{43}$` suffix, exact migration-ledger comparison and exact log-key comparison remain intact. Round 2 §R2.3 names the complete re-gate runs and decisive rows: `qalead-la-40` / 394 M1 sim rows including `M1-15.canvas.dynamic-refused` and `M1-24.common.event-shapes`, and `qalead-la-41` / six snapshot-upgrade rows including `M1-41.common.j-snapshot`. It requires candidate/test SHAs and artifact paths. These are future evidence requirements, not a claim that the re-gate has passed.

### A-LA-E7-08-03 — MAJOR — The prescribed checkout does not create the exact frozen test overlay

**Location:** `tests/ltiaas/GATE-RUN-PLAN.md:242–244` at `0f821dad` (script starts at `:226`).

**Problem:** `git checkout 8ad12926 -- tests` restores files present in the frozen tree but keeps newer tracked test paths that are absent there. Thus the first planned commit does not contain the promised exact `8ad12926` test tree. The next `git diff --exit-code` reports the mismatch, but the block has no failure guard or `set -e`; an ordinary execution can continue into the commit and tag commands with the wrong base overlay.

**Evidence:** In a second private clone detached at the reviewed integration SHA `0f821dad`, fetched the frozen SHA read-only from `src-wave-end` and ran the documented checkout. The exact-overlay diff returned **exit 1**, with **24 added test paths** remaining, including `tests/ltiaas/kit/**`, four `LA-E5-24` drill files and two `LA-E4-02` files. The combined addendum still passed its subsequent apply check, so that check does not detect this base-tree error. No commits were made. As a control, `git restore --source=8ad1292687431b05bad6b5c070ab722e67714526 --staged --worktree -- tests` in the private clone made the full test-tree comparison return **exit 0**, and the addendum apply check still returned **exit 0**.

**Suggested fix:** In the newly created `src-wave-end-2` clone only, replace the overlay checkout with an exact-tree restore (the command above was verified). Make failed clone, checkout/restore, comparison, patch-check and commit commands stop the procedure before later commits or tags. Preserve the intended two new commits: frozen overlay first, approved addendum second, never amend. Keep the frozen source repository read-only.

### Round 2 verification boundary

- `/tmp/la-review-a-7d961f442a6b`: `git clone --no-hardlinks` from the frozen source, detached at `8ad1292687431b05bad6b5c070ab722e67714526`. **4/4 patch checks PASS** (three individual hunks plus combined patch), full-file exact-change verification PASS, `git diff --check` PASS. Extracted patches, `reviewer-r2-apply-checks.json` and `reviewer-r2-applied.diff` retain the evidence.
- `/tmp/la-review-a-7d961f442a6b-overlay`: a separate private clone at `0f821dad` for the overlay reproduction and exact-restore control. `reviewer-overlay-diff.log` retains the 24-path failure. No install or test runner was needed.
- No Docker, stack, host stack runner, commit, or modification to either the frozen source or integration tests. Only this review file changed in integration; concurrent work was left untouched. Reviewer-B's file was not opened. Live re-gate results and the final named candidate/test SHAs remain outside this host-only review.

## Round 3

Reviewer-A: Codex GPT-6-Astra xhigh. Source-procedure review at integration `1b5469f769e7b5fe362a100825d04ed1f499ab42`. **APPROVE — 0 BLOCKER, 0 MAJOR, 1 MINOR, 0 NIT open.** The three addendum hunks retain their Round 2 approval; this round does not change their scope.

**A-LA-E7-08-03 (MAJOR): CLOSED.** Independent read-only checks in `/Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end-2`, with `GIT_OPTIONAL_LOCKS=0`, confirmed:

- HEAD is overlay commit `bf8153404449dbfef47698ceb82fa0262e9d9c48`; its sole parent is product SHA `93ab0c50467772f7f1c4b5fa9feb137048305c43`.
- Both `bf815340:tests` and `8ad12926:tests` resolve to **`f42d4150b7b11ba2b2e63898ee317e6dea3f9430`**; the full test-tree diff is empty, exit 0.
- `git diff --name-only 93ab0c50 bf815340 -- . ':!tests'` is empty, and the worktree is clean. The overlay changes no product file.
- §3C(a) now uses exact-tree `git restore`, checks the working tree and index against the frozen SHA, and places clone, restore, comparison, patch and commit commands under `set -euo pipefail`. It keeps the overlay and approved addendum as two normal commits, with no amend. Commit 2 and its tag were still absent when checked. One nonblocking SHA-read exception remains below.

### A-LA-E7-08-04 — MINOR — Export assignments hide failed SHA reads

**Locations:** `tests/ltiaas/GATE-RUN-PLAN.md:251`, `:267`, `:325` at `1b5469f7`.

**Problem and evidence:** `export NAME=$(git rev-parse …)` returns the status of `export`, hiding a failed command substitution from `set -e`. A read-only probe of the exact §3C(c) pattern against the currently absent `la-gate-test-addendum-r2` tag printed Git's fatal error, then continued with the unresolved tag name as the variable value and exited 0. Thus the script does not stop on every SHA-read failure. This does not invalidate the verified overlay or the approved hunks, and the documented precondition still requires Commit 2 before the run.

**Suggested fix:** Separate assignment from export and verify a commit, for example `WAVE_TEST_SHA_2=$(git -C "$SRC_WAVE_2" rev-parse --verify 'la-gate-test-addendum-r2^{commit}')`, then `export WAVE_TEST_SHA_2`. Apply the same pattern to the HEAD reads. The separated-assignment control stopped at the missing tag with exit 128 and did not execute the following command.

**Boundary:** No files were written in either gate source; no Docker, stack runner, install, commit, tag or patch application was run. Only this review file changed in integration, and Reviewer-B's file was not opened. Commit 2, its final test SHA and live re-gate evidence remain pending QA work; this approval is for the reviewed source procedure and addendum scope.
