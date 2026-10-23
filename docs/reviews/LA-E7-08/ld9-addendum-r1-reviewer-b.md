Verdict: APPROVE
Round: 1

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
