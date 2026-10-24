Verdict: APPROVE
Round: 1

# LA-E8-02 — Reviewer-A

## Round 1

Reviewer: Codex GPT-6-Astra xhigh, 2026-10-24. Reviewed QA rounds 1–2, the task spec, plan §4 measure 5 and §6.1, TEST-STRATEGY §2.6/§3.3, the walker's log and commits, and Reviewer-A's LA-E8-01 Round 5. **0 BLOCKER, 0 MAJOR, 1 MINOR, 0 NIT.** The five ACs have evidence, with the source and result limits below.

### Acceptance checks

| AC | Result and evidence |
| --- | --- |
| AC-LA-E8-02-01 | PASS for the completed channel change at `337b807dfe4f6b4201a1c0d122e7769944cc295e`, against base `3880a1b70d115c03f5a5accc813875332dcee64e`: F2 reports `core = 0, paths = 8`. The raw QA F2 log agrees with Git's four channel, one kit and three simulator paths. The next commit, `d6196d5242863e33f76a0b7d06c45554463bec6b`, adds only `WALKTHROUGH-LOG.md`; F2 on that complete tip reports **FAIL, core = 1, paths = 9**. QA explicitly discloses this report-file effect. I reproduced both classifications in a private clone pinned to `d6196d52`, using the exact base-to-`337b807d` path list for the product measurement. This approval does not claim F2 passes at the log commit. |
| AC-LA-E8-02-02 | PASS. Independently ran K0 **163/163**, Acme channel tests **6/6**, and simulator tests **64/64**. Read QA's raw `npm-run-check.log`: lint/typecheck, 3,323 unit passes with five skips, 255 infrastructure passes, K0, F1 and F5 pass. The original kit self-test's two closed-world L4 failures remain visible in the first report; the later kit log gives **32/32**, including the new-family regression check that closes `F-LA-E7-06-WALK-01`. |
| AC-LA-E8-02-03 | PASS for **Acme's own pass rule**. The raw ledger has 234 unique case ids, one run id, 232 PASS and two FAIL. All **39 Acme cases pass**, including H2; its pass-rule entry has no missing, extra, skipped, duplicate/retried, stale or failed cases, illegal N/A, missing negative guards or uncovered positive capabilities. Acme's fixture has `coveredBy: {}`. Global L-FAULTS, NRPS N2 and secret-scan H1 pass. The complete run's SUITE, PASSRULE and global summary remain **FAIL** on Brightspace, as discussed below. |
| AC-LA-E8-02-04 | PASS. The named fresh Claude Code Opus 5.5 xhigh walker records `2026-10-24T13:44:56Z` through `13:53:45Z`: **529 seconds, 8 minutes 49 seconds**, below one working day. The log includes reading, implementation, host checks and writing the log. Git places the three code commits at `13:49:58Z` and the log commit at `13:53:56Z`; the latter is 11 seconds after the recorded writing endpoint and does not change the measure's result. The reported 529 seconds excludes the later QA verification and K1 run (`14:52:44Z–15:00:08Z`). |
| AC-LA-E8-02-05 | PASS. All four departures L1–L4 and ten unclear points U1–U10 in the walker log appear as `F-LA-E8-01-*` findings in QA §3.1, with guide step ids and proposed fixes. None is lost. See closure qualification below. |

### Source, pass-rule and guide checks

- The live run identifies walk commit `d6196d52`. Its original kit tree is `564f4049991aa9cf577c40d55cbc355940d79ea4`; QA used the authorized later kit from `d9a4f482` (`8ad870fa1b33c93268bb0cdfb11dd86289a650c4`) plus the unchanged Acme fixture. Independently compared all 26 files from that later kit against the run source: no content mismatch; the only extra file is `channels/acme-lms.json`, byte-equal to the walker's file. The runner reports resulting kit tree `db27da51d9d88d4e2ee12f19a05c67212cf1a503`. This is evidence for the walk product with the disclosed kit update, not for an unmodified old kit.
- Lead option 1 allowed the unchanged all-channel runner and wave sources. Brightspace's **37/39** results fail R3 and its H2 rollup. The raw service trace confirms `registration_rejected`, `PROVIDER_PROFILE_MISMATCH`, `family=acme`, then HTTP 400. The reviewed kit helper selects complete-refusal without checking the owner channel's Dynamic Registration capability; Acme is manual-only. This supports the known kit defect `F-LA-E7-06-WALK-02` / LD30. It does not invalidate Acme's 39 passing cases. The kit correction and full-run re-gate remain separate work; this review grants no all-channel or final milestone gate pass.
- Reviewer-A's LA-E8-01 Round 5 closes L1, L2, L4 and U1–U10 (13 items). L3 is addressed with the already recorded MINOR `A-LA-E8-01-07`: the guide overstates which other channels receive the selected foreign-family probe. I do not claim all 14 guide items are fully closed or raise that same finding again. AC05 requires recording the findings, which is complete.
- Git confirms the walk tip is not an ancestor of integration. The channel change introduces no core path edit or core LMS identifier. The scratch branch remains unmerged; product and guide edits are outside this review. There are no UNIT-tagged ACs in this measurement task. K1-SIM evidence is not K2 live-platform conformance.

### A-LA-E8-02-01 — MINOR — Two intermediate commit hashes do not resolve

- **File:** `docs/reviews/LA-E8-02/qa.md:77` (also line 78).
- **Problem:** The first two implementation commits have incorrect full object ids, so a reader cannot open those exact revisions from the report.
- **Evidence:** `git cat-file -t` fails for both full ids printed there. `git log 3880a1b7..d6196d52` resolves the channel commit to `fe87eb456dd59da8a654e2713eb91e23b92c69ed` and the simulator commit to `4d12a2914cd8e8c8f8ca432b4704e0190728cd8d`. The report's short prefixes, base, final product SHA and log SHA are correct, so the reviewed source and test results remain identifiable.
- **Suggested fix:** Replace those two full hashes with the actual object ids above. Safe to defer because both measured endpoints are correct; the Lead should record the item if it is deferred.

### Verification record

Private clone: `/tmp/la-reviewer-a-ctx-5eda273ac1ce`, created with `git clone --no-hardlinks`, pinned to `d6196d52`, with its own `npm ci`. Cleared its exact `node_modules/.vitest-cache` before each Vitest invocation. Host logs: `/tmp/la-reviewer-a-ctx-5eda273ac1ce-evidence/` (`f2-with-log.log`, `f2-product-only.log`, `channel-change-paths.txt`, `k0.log`, `channel-unit.log`, `sim.log`).

Raw QA host evidence: `/Users/quangnguyen/cogniate-qa-runs/LA/LA-E8-02/r1/logs/`. Later kit host evidence: `/Users/quangnguyen/cogniate-qa-runs/LA/LA-E7-06/walk/kit-k0-acme.log`. Live evidence: `/Users/quangnguyen/cogniate-qa-runs/LA/LA-E7-06/walk/clone/tests/host/artifacts/qa4-la-walk-r1-d6196d52-2026-10-24T14-52-44-685Z/` (`summary.json`, `container-k1/vitest-results.json`, kit summary/metadata/ledger and the selected service trace). No Docker, stack, host stack runner or commit was run. Only this review file changed in integration.
