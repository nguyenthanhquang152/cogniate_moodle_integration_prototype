Verdict: APPROVE
Round: 1

# LA-E7-08 — Reviewer-B

## Round 1

Reviewer: Codex GPT-6-Astra, Reviewer-B (can a human team own it?), 2026-10-25. Scope: final re-gate evidence in QA `26ddcebd`, integrated as `c5a700d8`: Final state, corrected R1 summary, §14 D3, `run-D4.md`, and `per-test-id-D3-D4.md`. Product is `4f10c5fd9ca4dd0a5f636b34d7454e0db7b6849c`; baseline product is `78971b03`, baseline tests `1ae6716b`, candidate tests `794f649c`. The LD-32 kit exception uses `99338e52` with zero product diff outside tests/docs. This is the first task-level review; my earlier LD-9 addendum reviews remain separate.

**Result: APPROVE — 0 BLOCKER, 0 MAJOR, 1 MINOR, 0 NIT.** The functional gate and its disclosed recovery rules are supported. The carried U1 citations need the correction below; they do not demonstrate a missing functional check.

### Finding

**B-LA-E7-08-01 — MINOR — The carried U1 paragraph repeats planned run names and counts instead of the executed records.**

- **Location:** `docs/reviews/LA-E7-08/qa.md:1470` and `:1493`; source of the repeated claim: `tests/ltiaas/GATE-RUN-PLAN.md:1035`.
- **Problem:** A new owner following `qalead-la-13/13b` (19 LTI / 18 app checks) or `qa-e2e-la-moodle-r3` (36 live checks) cannot reconcile those claims with the cited original reports and saved evidence.
- **Evidence:** The actual combined SIM run is `qalead-la-13-80133d6b-2026-10-23T17-11-52-676Z`, under `/Users/quangnguyen/cogniate-qa-runs/LA/LA-E7-08/slot3b-80133d6b/artifacts/`. Its summary has **37 PASS and 6 INFO entries, 17 PASS aggregate IDs**, including both services' old/new U1 checks and app before/after rewrap. The original E7-08 §5 record describes that combined execution. No separate 13b evidence is supplied by the cited task QA reports or retained artifact roots. E5-22 QA AC-06 and E7-09 Round 4 instead cite **`qa-e2e-la-s8b-r1-a7bd110e-2026-10-24T01-31-21-479Z`**, whose summary in `la-qa/tests/host/artifacts/` has **16/16 PASS**, including S8-U1-PREP, S8-U2-RESTART, S8-06 and S8-KEYS-STATUS. Neither cited original report identifies the claimed `moodle-r3` 36/36 run. I read both actual summaries and their continuity rows.
- **Suggested fix:** Replace the aliases and counts with these full executed run IDs, artifact paths, product SHAs and actual entry/ID accounting, and correct the shared carry-plan row through its owner. Keep the already-authorized carry distinction; no new stack run is requested. These actual passing records make this a reporting MINOR, not a new functional gate failure.

### AC and evidence checks

| AC | Independent result |
| --- | --- |
| AC-01 | All 394 M1 and 64 M2 functional case IDs match the baseline in both accepted runs (140/162 and 138/152). The two M3 host IDs remain FAIL versus baseline PASS and are listed separately as the Lead-approved foreign-resource findings. Excluded overlap run 151 is preserved. |
| AC-02 | Both LD-32 kits, 144 and 161, contain 195 distinct PASS ledger IDs and 196 PASS Vitest tests. Channel counts are 37/38/39/39/39, plus three global rows. The pass-rule summaries have no failures, skips, duplicates, stale/missing/extra cases, illegal N/A, positive-capability gaps or missing negative guards. Both ledgers have the same ID set. |
| AC-03 | Re-ran the pure golden comparator on private copies of both captures: **297 approved differences, 0 unexplained, 0 expected changes missing** in each. Every response path and LA-IC mapping matches the table; the full before/after maps match between runs after D3 port normalization. Original captures were not changed. |
| AC-04 | Verified both 12-row migration and 6-row snapshot-upgrade ledgers at baseline 18/19 and candidate 61/62, the actual combined U1 continuity record above, and the 10-PASS pilot drill. Re-executed the saved read-only migration/encryption/backup diff proofs: all empty for their stated carry ranges. The inaccurate U1 names/counts remain B-01. |
| AC-05 | Gate source worktrees are tracked-clean, candidate D3/D4 test trees are identical, and product diffs against their declared product SHAs are empty. The twelve modified existing frozen files and additive suites/simulator files remain those covered by the LD-9 addenda, including my r8 Round 3 approval. LD-32 retains the committed K1 dispatcher; kit trees and runner bytes match the declared source. No assertion change is introduced by this evidence commit. |
| AC-06 | Re-ran the recorded diff from exact G-BASE `bd368ff39fb4c533fc105e7c5ee81a59e618d99a` to `4f10c5fd` for stack-data, storage-compat and the recorded storage command sources: empty. |

Rebuilt the accounting from **all 29 invocation summaries** (15 D3, 14 D4), checked each copied summary against its original, and recalculated durations from run IDs and original summary timestamps. All reported entry/ID counts and times agree. Rebuilt **all 753 group-scoped comparison rows** from raw aggregates and T7 per-run results. The five original unequal IDs are exactly M1 M3-ISOLATION, M2 M3-06-M2, and T8 AC-T8-03/07/SUITE. Solo baseline retry 170 matches both candidate T8 runs on all 23 IDs; original 129 stays FAIL. The corrected R1 companion closes my E0-02 B-04, recorded in that report's Round 7.

For each kit, independently checked the three wave artifact hashes and run IDs: D3 binds T3b/T7/T8 to 131/130/137; D4 to 154/153/160. Both actual kit clones match the committed source. Across 29 retained actual run clones, test files match the selected source except the documented T7 e2e-only overlay: its active e2e files match, and both T7 clones are byte-identical across all 667 tracked test paths. Gate/kit source trees and the effective per-suite inputs agree with LD-25/29/32.

### Failures and limits remain visible

136's H1 abort, its later PRE refusal, excluded M1 overlap 151, zero-test kit assembly 141, D4 T5b 158 and baseline T8 129 remain failures/findings. Their authorized recoveries do not rewrite those outcomes. Read the original 158 trace and service log: the failed sync-status snapshot is pending while the subsequent same-ID event is sent. The report appropriately labels its approximately 14 ms clock alignment as correlation, not a causal guarantee. Recovery 163 passes without changing the test.

Rebuilt the conductor watcher count: **1,016 ps samples**, at most one LA owner after takeover, and **99,251 events**. Checked 35 saved protected-volume snapshots against the same 32 records, and the final container/network/volume inventories show no owned LA resource. Independently reconstructed the six changed anonymous-volume joins for 140/162 from raw events; each belongs to a named `sto-*` container. Raw M3 FAIL rows remain separate from functional PASS. The empty inherited D3 event file and approximately 42-second opening gap are explicit, with the Lead's recorded acceptance; before/after snapshots do not substitute for missing event coverage.

Verification artifacts: `/tmp/reviewer-b-regate-uqtfgkjb/` contains the read-only audit scripts plus `run-audit.json`, `per-id-audit.json`, `source-parity.json`, `golden-audit.json`, `kits-health-carry.json`, `boundary-trace-audit.json` and `u1-carry-records.json`. The reviewed change is evidence/plan documentation within the assigned QA scope; no product/core path, LMS dispatch or UNIT behavior changes. No Docker, stack, browser suite, install or commit was run. Only the three dispatched Reviewer-B reports were edited; blind review maintained.
