Verdict: CHANGES_REQUESTED
Round: 1

## Round 1

Reviewer-B: Codex GPT-6-Astra xhigh. Reviewed `ld9-addendum-r2.md` at integration `d92486f5` (QA `3b8b3a5c`) against gate-test base `e46bb27c9487d332f40fcefd4dd880304d1d31f1`, plan LD-9, LA-ADR-04 D8, LA-ADR-05 D1, BD-A1-114 and BD-A2-110. **1 BLOCKER, 0 MAJOR, 1 MINOR, 0 NIT.**

The LA-IC-06 classification is correct: this Canvas login must return the storage page. The exact patch preserves the existing authorize-query checks, state cookie, completed launch and simulator check; the shared helpers remain unchanged. The re-gate row names the case, M1 SIM phase and new test SHA after both approvals. One new assertion contradicts the approved design, however, so this list is not ready to apply.

### B-LA-E7-08-LD9-03 — BLOCKER — the new storage-key assertion rejects the specified response

**File:line:** `docs/reviews/LA-E7-08/ld9-addendum-r2.md:89` (proposed `tests/acceptance/M1/canvas/21-canvas-protocol.test.ts:30`); repeated in the rationale and re-gate row at `:32`, `:34`, `:147`.

**Problem and evidence:** The proposed regex is `^cog_state_[0-9a-f]{16}$`. LA-ADR-05 D1 rule 3 and the LTI service API delta §2.1 require `cog_state_<d>`, where `<d>` is **one** hex digit, the first digit of the state hash. This limits storage to 16 keys; it does not make each key contain 16 digits. BD-A2-110 explicitly gives `^cog_state_[0-9a-f]$`. A host check of the regex extracted from the applied patch rejects `cog_state_a` and accepts `cog_state_0123456789abcdef`. Thus the updated case would still fail for a conforming response before it reaches the preserved launch assertions.

**Suggested fix:** Use the specified one-digit key assertion and correct each matching prose/table claim. Re-run apply-check and host typechecking, then keep the actual M1 row pending until its authorized re-gate. No product change is required.

### B-LA-E7-08-LD9-04 — MINOR — the supporting narrative does not match its cited inputs

**File:line:** `docs/reviews/LA-E7-08/ld9-addendum-r2.md:5`, `:9`, `:28`, `:30`, `:31`, `:45`, `:136`.

**Problem and evidence:** A maintainer following the addendum encounters several inaccurate sources:

- D1 rule 1 and API delta §2.1 specify a profile trait plus a target of at most 64 characters from the named grammar, not the stated 128 printable-ASCII rule. Origin comes from the trait (`authOrigin` or a fixed origin), not the stated `authorizationServer` fallback. Rule 1a defines trait values.
- At the pinned test tree, `CLOUD.auth` uses `sso.canvas.sim.test`; `canvasLaunch` delegates to `launch`, whose non-302 branch returns the login response. The cited helper locations/return shape and production hostname do not describe that tree. The frozen scan returns only line 18; the quoted line-27 `CANVAS_LOGIN` loop does not exist. The actual preserved loop checks `scope`, `response_type`, `response_mode` and `prompt`.
- The named decision-log file, separate slot-3C report and `qa3-we-slot-3c/m1-sim.log` are absent. The gate evidence is recorded in `docs/reviews/LA-E7-08/qa.md` §6 with artifacts under `SLOT3C`. The pinned `tests/package.json` and reproduced typecheck identify `cogniate-qa-tests@0.0.0`, not the package name printed in §4.2.

**Suggested fix:** Regenerate the source/command excerpts from the stated pin, link the existing gate evidence and plan §6.1 LD-9, and summarize the actual D1 rules. Keep the rationale separate from the exact observed command output.

### Verification and boundary

- Cloned the gate source with `git clone --no-hardlinks` into `/tmp/review-b-ld9-r2-wef6-fdic3rq0`, detached at `e46bb27c`. Extracted the single diff block, passed `git apply --check`, then applied it only in that clone. The resulting blob is `1e58a120049d4cb9d50dd6fc0a864661f2c4b9b8`, matching the addendum; only the named test file changes, and `git diff --check` passes.
- Installed test dependencies only in the private clone. `npm --prefix tests run typecheck`: **PASS**. Logs/checks: `/tmp/reviewer-b-ld9-wef6-typecheck.log`, `/tmp/reviewer-b-ld9-wef6-checks.json`, `/tmp/reviewer-b-ld9-wef6-regex.json`, `/tmp/reviewer-b-ld9-wef6-source-checks.json`.
- No product, shared helper, simulator or other frozen case changes are proposed. No Docker, stack runner or live test was run; the re-gate result remains pending. Blind review maintained; only this review file was written in the integration worktree, and no commit was made.
