Verdict: CHANGES_REQUESTED
Round: 1

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
