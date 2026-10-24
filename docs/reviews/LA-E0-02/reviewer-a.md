Verdict: CHANGES_REQUESTED
Round: 4

# LA-E0-02 — Reviewer-A

## Round 1

Reviewed 2026-10-24 against the task spec and TEST-STRATEGY §4.1–4.2. `qa.md` Round 1 is supported for the executed Slot 7 suites, but its full-task PASS exceeds the evidence. Missing raw files are not the reason for this verdict.

### Finding

**A-LA-E0-02-01 — BLOCKER — The legacy request-rate baseline is missing from the claimed PASS.**

- **Location:** `docs/reviews/LA-E0-02/qa.md:27` (AC-04), `:29` (AC-06), `:30` (AC-07).
- **Problem:** AC-06 requires app launch/deep-link peaks for both T7 and the legacy groups; AC-07 also requires legacy LTI-class rates. The report marks them PASS using only M1, M2 and T7. Slot 7's scheduling exclusion is not a scope change.
- **Evidence:** The surviving `rate-peaks.json` has exactly `m1-sim`, `m2`, `t7-run1`, `t7-all3runs`. No legacy rate result is cited. Later baseline runs do exist: Slot 3D `qalead-la-45`, `46`, `48`, `49` supply T5/T6/T8 results, times and failures. These are useful additional evidence, but neither their summaries nor the wave-end tables in `LA-E7-08/qa.md` supply the missing legacy rate record. Candidate passes on `8fadb828` are not G-BASE measurements. The Lead confirmed no approved scope change exists.
- **Suggested fix:** Reconcile the later per-test baseline records into AC-04/09, retaining every failed and skipped row, and add the missing app/LTI legacy peak measurements required by AC-06/07. Use surviving logs where sufficient. Identify any remaining unmeasured group explicitly and keep the affected AC pending until measured or formally re-scoped.

### Acceptance and raw-result accounting

| AC | Assessment |
| --- | --- |
| 01–03 | PASS: raw ledgers contain 394 M1 sim, 64 M2, 12 migration and 6 snapshot-upgrade PASS rows. QA records suite times. |
| 04 | T7 portion PASS: three runs of 17 PASS / 0 FAIL / 1 demo SKIP, 205/194/189 seconds. Legacy coverage needs reconciliation with later baselines; do not treat the Slot 7 omission as PASS. |
| 05 | PASS: M1 peaks 26/18 (launch per minute/per 10 seconds), 11/9 (deep-link); M2 3/1 and 2/1. |
| 06–07 | INCOMPLETE for legacy groups. Recorded M1 admin peak 398/minute and 292/10 seconds exceeds the old default and is correctly called out; this does not supply the missing suites. |
| 08 | PASS: engine facts recorded; recomputing owned-project samples gives SIM maximum 1,689.52 MiB and Moodle 1,573.14 MiB, sum about 3.19 GiB. Foreign `sto-*` samples excluded. |
| 09 | Slot 7 accounting is candid: M2 `M3-06-M2` FAIL and migration/snapshot `M3-ISOLATION` FAIL remain failures, attributed separately from the passing product rows. All original 32 volume records survive unchanged despite two extra foreign volumes. Later baseline failures must remain visible when the record is consolidated. |

Later baseline summaries retain: `qalead-la-45` failures `SUITE`, `AC-T5-36`, `P5`; `46` all 59 entries PASS; `48` failures `SUITE`, `AC-T6-07`, `AC-T6-13`, `AC-T6-09`; `49` failures `SUITE`, `AC-T8-10`, `AC-T8-08`, `AC-T8-09`. A later pass does not rewrite these historical results.

### Paths read

Raw root `/Users/quangnguyen/cogniate-qa-runs/LA/`:

- `SLOT7/baseline/1b17261be97c4701b928fa9dc2fa74c6d23028f6/`: `m1-sim.json`, `m2.json`, `m1-migration.json`, `m1-snapshot-upgrade.json`, `t7.json`, `rate-peaks.json`.
- `SLOT7/artifacts/`: `qalead-la-16-1b17261b-2026-10-23T18-27-46-137Z/summary.json`, `qalead-la-17-1b17261b-2026-10-23T18-52-05-778Z/summary.json`, `qalead-la-18-1b17261b-2026-10-23T18-55-39-609Z/summary.json`, `qalead-la-19-1b17261b-2026-10-23T19-01-20-155Z/summary.json`, `qalead-la-20-1b17261b-2026-10-23T19-04-24-184Z/summary.json`.
- `SLOT7/logs/slot7-docker-stats.jsonl`; `SLOT7/docker-records/before-volumes-inspect.json`, `after-volumes-inspect.json`.
- `SLOT3D/artifacts/`: `qalead-la-45-1b17261b-2026-10-23T23-46-57-571Z/summary.json`, `qalead-la-46-1b17261b-2026-10-24T00-05-12-265Z/summary.json`, `qalead-la-48-1b17261b-2026-10-24T00-22-21-135Z/summary.json`, `qalead-la-49-1b17261b-2026-10-24T00-30-06-293Z/summary.json`.

Also read this task's `qa.md`, `LA-E7-08/qa.md` baseline/wave-end sections, `LA-E7-09/qa.md` and `tests/ltiaas/GATE-RUN-PLAN.md` §4. Review extracts: `/tmp/la-reviewer-a-ctx-ec3c53d42903-evidence/{raw-audit,later-baseline-audit,supplemental-audit}.txt`. No stack or product changes.

## Round 2

Reviewer-A: Codex GPT-6-Astra xhigh, 2026-10-24. Reviewed the reconciliation at `2da33750` against the saved Slot 3D summaries and Playwright results. **CHANGES_REQUESTED: one new BLOCKER below; A-LA-E0-02-01 remains pending baseline-3, with its false full-task PASS claim corrected.** The four summary entry counts and unique-ID counts are correct when any failed occurrence makes that ID fail. The report now preserves the failed runs, the later passing run, and the pending legacy/rate scope. §10 R1 schedules the missing groups and measurements; a plan is not measurement evidence.

### A-LA-E0-02-02 — BLOCKER — Round 2 misstates the saved failure evidence

**Location:** `docs/reviews/LA-E0-02/qa.md:154` (also `:155`, `:156`, `:157`).

**Problem:** The new “exact root cause” table attributes P5 to a different probe and gives test durations that do not match the cited runs, so AC-09's failure record is not yet accurate.

**Evidence:** In `SLOT3D/artifacts/qalead-la-45-1b17261b-2026-10-23T23-46-57-571Z/container-T5b/playwright-results.json`, P5 fails **“both attempts unchanged”** because the second attempt's `updatedAt` changes from `00:04:29.156Z` to `00:04:33.069Z`; duration is **29,205 ms**, not the claimed 11,227 ms container-restart probe. AC-T5-36 fails **“Moodle grade,” expected 100, received null**, in **74,264 ms**, not 292,053 ms. Run 46 passes those tests in **12,519 / 29,025 ms**, not 229,115 / 11,249. Run 48's AC-T6-07/-13/-09 durations are **15,136 / 15,882 / 17,994 ms**; run 49's AC-T8-10 (no token) is **15,121 ms**, all with a **15,000 ms locator-click timeout**. Run 49 also skips the **AC-T8-10 (with token)** variant after the serial failure, in addition to AC-T8-08/-09; that third skipped test is absent from the new table.

**Suggested fix:** Regenerate the test-level failure, skip and duration entries from each named `playwright-results.json`, preserve the actual assertion message and failing variant, and separate that observation from any later root-cause explanation. Cite separate evidence for a restart-probe diagnosis instead of substituting it for the P5 failure. Keep baseline-3 and the missing rate measurements pending.

Exact extracts are in `/tmp/la-review-a-e1e451fa43ee/baseline-exact-errors.json`; summary recounts are in `baseline-reconciliation.json` (use any-failure aggregation for repeated host IDs). No new product run was performed, and no other reviewer's file was opened.

## Round 3

Reviewer-A: Codex GPT-6-Astra xhigh, 2026-10-24. Reviewed the corrected QA reconciliation at `ab8e8938` (QA `44907ced`) against fresh reads of the four saved Slot 3D runs. **0 new findings. A-LA-E0-02-02 is CLOSED; A-LA-E0-02-01 remains pending baseline-3.** The historical reconciliation is accepted. The task verdict stays **CHANGES_REQUESTED** because the required new baseline and request-rate measurements have not yet been supplied.

The corrected `qa.md:154` now preserves P5's actual **“both attempts unchanged”** assertion, its `updatedAt` values and **29,205 ms** duration, separately from the passing host restart probe. AC-T5-36's **“Moodle grade,” expected 100, received null** and **74,264 ms** duration match the saved report. Run 46's corresponding passes are **12,519 / 29,025 ms**. Run 48's AC-T6-07/-13/-09 durations are **15,136 / 15,882 / 17,994 ms**, and run 49's failed AC-T8-10 (no token) is **15,121 ms**, with the recorded **15,000 ms** locator timeout. The table now retains all three subsequent T8 skips, including AC-T8-10 (with token), and the intentional T5a TTL skip alongside its separate passing knob run. Suite totals and the other cited sub-run durations also match the saved results.

The four entry/unique-ID counts remain correct using any-failure aggregation. Failed attempts stay visible alongside the later passing run. Observed failures are now separated from root-cause explanations; the P5 rerun demonstrates a later pass, not by itself proof of the proposed background-update cause. The current review accepts the corrected observations without upgrading that inference into a measured cause.

`qa.md:159` explicitly keeps AC-04 legacy results and AC-06/07 rate measurements pending on `78971b03`, with baseline test pin `1ae6716b7353becc0f053b46fb65e0ba86ff7873`. R1's schedule is not execution evidence and does not close A-LA-E0-02-01. No additional rerun is required for the historical transcription fix; close the remaining finding when the planned baseline results and measurements are reviewed.

Evidence: `/tmp/la-review-a-6fc243f34f57-final/baseline-r3-audit.json`, extracted from the same four `SLOT3D/artifacts/qalead-la-45/46/48/49` run directories identified in Rounds 1–2, including each relevant `container-*/playwright-results.json`. No new product run, Docker or stack; no Reviewer-B report or probe was opened.

## Round 4

Reviewer-A: Codex GPT-6-Astra xhigh, 2026-10-25 (local). Reviewed QA `a456ca03`, integrated at `61e3ca97`, against the three saved `container-knob-PLAY_TTL_SECONDS/playwright-results.json` reports. **0 new findings.** The duration correction is accepted: `qa.md:29` and `:154`–`:156` now distinguish whole-suite duration from the individual AC-T5-15 result.

| Run | Suite duration | AC-T5-15 duration | Result |
| --- | --- | --- | --- |
| `qalead-la-45` | 25,880.3 ms | 25,144 ms | PASS |
| `qalead-la-46` | 26,162.5 ms | 25,304 ms | PASS |
| `qalead-la-48` | 26,340.7 ms | 25,464 ms | PASS |

These values match fresh reads of the raw reports. The earlier failed/skipped variants remain visible, and A-LA-E0-02-02 stays closed. **A-LA-E0-02-01 remains pending**, so the task verdict stays **CHANGES_REQUESTED**: R1 has started under the Lead's decision, but its baseline-3 results and AC-06/07 measurements have not been reviewed in this round. Approval of the §10 extraction commands does not replace those measurements.

Evidence: `/tmp/la-review-a-8400cc94ece5/reviewer-r4-knob-audit.json`, which records the exact raw paths, suite times and test results. No new product run, Docker or stack; no other reviewer's report or probe was opened.
