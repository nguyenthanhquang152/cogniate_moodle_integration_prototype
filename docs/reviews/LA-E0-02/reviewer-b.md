Verdict: CHANGES_REQUESTED
Round: 4

# LA-E0-02 — Reviewer-B

## Round 1

Reviewed 2026-10-24 at `4e6a41f3`, against the task spec, TEST-STRATEGY §4 and plan §6.1. **1 BLOCKER; 0 MAJOR, MINOR or NIT.** Slot 7's recorded counts are supported, but they do not complete the baseline contract.

### B-LA-E0-02-01 — BLOCKER — The legacy baseline and rates are omitted from ACs marked PASS

**Location:** `docs/reviews/LA-E0-02/qa.md:27` (also AC-06/07/09 at lines 29–32).

**Problem:** The report marks the full baseline criteria PASS while omitting the required legacy T2a–T8 per-test record, its rates, and its non-PASS dispositions.

**Evidence:** AC-04 requires both T7 ×3 and legacy groups; the report explicitly excludes the latter under the Slot 7 plan. AC-06/07 require legacy app/LTI rates, but the saved `rate-peaks.json` has only `m1-sim`, `m2`, `t7-run1` and `t7-all3runs`. The Lead confirmed through this review's orchestration question that the omission has no approved scope change. Later G-BASE evidence exists and must not be lost: Slot 3D run 45 records `AC-T5-36` and `P5` FAIL, run 46 passes; run 48 records `AC-T6-07`, `AC-T6-13`, `AC-T6-09` FAIL; run 49 records `AC-T8-10` FAIL and `AC-T8-08/09` not run. These are not proof of LA product defects, but they belong in the baseline/differential record under AC-09. The Slot 7-only statement of zero product/test failures cannot stand as the complete baseline.

**Suggested fix:** Reconcile the later baseline evidence into this task, with one result and time per required group/test, retain failed and skipped attempts with their causes, and supply the missing legacy rate measurements or an explicit approved scope disposition. Link existing raw evidence where sufficient; rerun only evidence that is actually missing. Until then mark the incomplete portions pending, not PASS.

### Acceptance accounting

| AC | Result of review |
| --- | --- |
| 01–03 | Raw ledgers match: M1 sim 394/394, M2 64/64, migration 12/12, snapshot-upgrade 6/6 PASS, with timings. |
| 04 | T7 has 3 × (17 PASS, 1 demo SKIP); legacy part incomplete above. |
| 05 | M1/M2 peak values match the saved rate JSON. The reader clearly documents per-key upper bounds where logs lack key/address identity. |
| 06–07 | T7/M1/M2 values recorded; legacy part incomplete above. |
| 08 | Recorded identity and raw memory samples support the facts: maxima 1,689.52 MiB SIM and 1,573.14 MiB Moodle, sum 3.19 GiB. |
| 09 | Slot 7's three host M3 FAIL rows and demo skips are accurately retained. Full legacy disposition is incomplete above. |

### Raw paths read

All paths below are under `/Users/quangnguyen/cogniate-qa-runs/LA/`:

- `SLOT7/artifacts/qalead-la-16-1b17261b-2026-10-23T18-27-46-137Z/`: `summary.json`, `m1-case-results.json`, `g1-client-identity.json`.
- `SLOT7/artifacts/qalead-la-17-1b17261b-2026-10-23T18-52-05-778Z/`: `summary.json`, `m2-case-results.json`.
- `SLOT7/artifacts/qalead-la-18-1b17261b-2026-10-23T18-55-39-609Z/`: `summary.json`, `m1-case-results.json`.
- `SLOT7/artifacts/qalead-la-19-1b17261b-2026-10-23T19-01-20-155Z/`: `summary.json`, `m1-case-results.json`.
- `SLOT7/artifacts/qalead-la-20-1b17261b-2026-10-23T19-04-24-184Z/`: `summary.json`, `run1/tests.json`, `run2/tests.json`, `run3/tests.json`.
- `SLOT7/baseline/1b17261be97c4701b928fa9dc2fa74c6d23028f6/`: `m1-sim.json`, `m2.json`, `m1-migration.json`, `m1-snapshot-upgrade.json`, `t7.json`, `rate-peaks.json`.
- `SLOT7/logs/`: `qalead-la-16-rate-peaks.json`, `qalead-la-17-rate-peaks.json`, `qalead-la-20-run1-rate-peaks.json`, `qalead-la-20-all3runs-rate-peaks.json`, `slot7-docker-stats.jsonl`.
- `SLOT7/docker-records/`: `before-volumes-inspect.json`, `after-volumes-inspect.json` (all 32 protected entries unchanged; 34 total entries after, including other volumes).
- `SLOT3D/artifacts/`: `qalead-la-45-1b17261b-2026-10-23T23-46-57-571Z/summary.json`, `qalead-la-46-1b17261b-2026-10-24T00-05-12-265Z/summary.json`, `qalead-la-48-1b17261b-2026-10-24T00-22-21-135Z/summary.json`, `qalead-la-49-1b17261b-2026-10-24T00-30-06-293Z/summary.json`.

Read the rate reader and later gate report/plan as supporting context. Independent host accounting is in `/private/tmp/la-closeout-review-b-_nb5xdcj/{raw-accounting,case-accounting,later-baseline-accounting,additional-accounting}.json`. No Docker or stack was run; no product/frozen-test edits or commits; no Reviewer-A report read.

## Round 2

Reviewed 2026-10-24 at integration `2da33750`, limited to QA Round 2's reconciliation. **CHANGES_REQUESTED: B-LA-E0-02-01 remains OPEN, BLOCKER; no new finding ID.** The report now correctly marks AC-04/06/07 pending baseline-3 and retains all four Slot 3D attempts. Their summary entry and unique-ID counts match the raw reports. The new per-test account still needs correction before AC-09's reconciliation can be accepted.

**File:line:** `docs/reviews/LA-E0-02/qa.md:153` (also `:154`, `:155`, `:156`).

**Problem and evidence:** The P5 description names a different test, and the reported test durations do not match the cited Playwright artifacts:

| Run / test | QA Round 2 | Actual `results[].duration` |
| --- | --- | --- |
| 45 / AC-T5-36 | 292,053 ms | **74,264 ms** |
| 45 / P5 | 11,227 ms | **29,205 ms** |
| 46 / AC-T5-36; P5 | 229,115; 11,249 ms | **12,519; 29,025 ms** |
| 48 / AC-T6-07; -13; -09 | 120,031; 30,052; 30,038 ms | **15,136; 15,882; 17,994 ms** |
| 49 / AC-T8-10, no token | 180,049 ms | **15,121 ms** |

Run 45's P5 is `9a-best-score.spec.ts:15`, checking that deleting only failed sync 80 leaves both attempts and best score unchanged, then refuses Resend of 60. Its error is **“both attempts unchanged”**: the 80-point attempt's `updatedAt` changed from `00:04:29.156Z` to `00:04:33.069Z`. It is not the reported container-restart/resync-to-0.8 case. The T5b/T6/T8 command durations for runs 45/48/49 are **813,903 / 192,199 / 124,214 ms**, not the reported SUITE values. Run 49 also skips **AC-T8-10 (with token)**, which the aggregate ID hides; list that variant alongside skipped AC-T8-08/09.

**Required correction:** Derive §7.1 from each `container-<suite>/playwright-results.json` and `cmd/*test-acceptance-<suite>.log`; preserve the real error, test variant and duration, and keep inferred causes separate from observed failures. Existing artifacts suffice for this correction. Keep baseline-3 legacy results and rates pending until their scheduled runs supply the missing evidence; this review grants no live acceptance credit.

Read-only evidence: the same four `SLOT3D/artifacts/qalead-la-{45,46,48,49}-*` folders named above. Extracted accounting: `/tmp/reviewer-b-ld9-r8-qa4kpgty/baseline-reconciliation.json` and `baseline-test-details.json`. No Docker, stack, product/test edit or commit; blind review maintained.

## Round 3

Reviewed 2026-10-24 at QA `44907ced` / integration `ab8e8938`, limited to the corrected §7.1 and baseline-3 handoff. **CHANGES_REQUESTED: B-LA-E0-02-01 remains OPEN, BLOCKER pending baseline-3; 1 new MINOR below.** The substantive Round 2 reconciliation errors are corrected. No live acceptance is granted before the missing results and rates exist.

- Re-extracted the raw Playwright results for runs 45, 46, 48 and 49. All previously disputed failure and rerun durations now match: AC-T5-36 **74,264 / 12,519 ms**, P5 **29,205 / 29,025 ms**, T6 **15,136 / 15,882 / 17,994 ms**, and T8 no-token **15,121 ms**. The suite durations and summary counts also match the cited records.
- P5 is now correctly identified as `9a-best-score.spec.ts:15`, with the **“both attempts unchanged”** assertion and the observed `updatedAt` change. The separate passing host restart step is clearly distinguished. Cause explanations occupy a separate column; the passing rerun supports an intermittent failure, while the background-sync attribution remains an interpretation of the timestamp change, not independently proved by that rerun.
- All three T8 serial skips are retained, including **AC-T8-10 (with token)** at 0 ms. The T5a TTL knob skip and dedicated passing run are also retained. AC-04/06/07 remain explicitly pending, bound to product `78971b03` and test `1ae6716b`. The scheduled baseline groups cover the missing legacy cases and rate extraction, but their results are not yet present.

### B-LA-E0-02-02 — MINOR — Distinguish the remaining knob-test durations from suite durations

**File:line:** `docs/reviews/LA-E0-02/qa.md:154`, `:155`, `:156`.

**Problem / evidence:** The new observed-variant column says AC-T5-15's dedicated knob test passed in **25,880.3 / 26,162.5 / 26,340.7 ms** for runs 45/46/48. Those numbers are `stats.duration` for the whole single-test Playwright invocation. The actual test `results[].duration` values are **25,144 / 25,304 / 25,464 ms**. The suite column can retain its current numbers; only the claim that these are exact individual test times is wrong. Statuses and skip dispositions are correct.

**Suggested fix:** Use the individual values in the test-variant column, or label the existing values explicitly as suite durations. Keep the separate suite and command timings. Existing raw files suffice; no rerun is needed for this correction.

Independent extraction: `/tmp/reviewer-b-ld9-r8-r2-tofad1og/baseline-reconciliation-r3.json`, derived from the four previously cited Slot 3D artifact folders, including each `container-knob-PLAY_TTL_SECONDS/playwright-results.json`. The separate [LD-9 r8 Round 2 review](../LA-E7-08/ld9-addendum-r8-reviewer-b.md) verifies all three rebuilt source pins and records the remaining invocation defects. No Docker, stack, product/test edit, commit or other reviewer's file was used.

## Round 4

Reviewed 2026-10-24 UTC at QA `a456ca03` / integration `61e3ca97`, limited to the knob-duration correction. **CHANGES_REQUESTED: 1 existing BLOCKER pending baseline-3; 0 MAJOR, MINOR or NIT. No new finding.**

**B-LA-E0-02-02 closes.** AC-04's summary and §7.1 now distinguish the three individual test durations (**25,144 / 25,304 / 25,464 ms**, runs 45/46/48) from the dedicated suite durations (**25,880.3 / 26,162.5 / 26,340.7 ms**). All values match the independently extracted raw Playwright records. The earlier failures, rerun outcomes and skips remain intact.

**B-LA-E0-02-01 stays OPEN, BLOCKER pending R1's report.** AC-04/06/07 still correctly say pending baseline-3. The Lead has started R1, but neither that start nor the approved command handoff supplies its required legacy results and rate measurements. The [LD-9 r8 Round 3 review](../LA-E7-08/ld9-addendum-r8-reviewer-b.md) approves the corrected execution commands without granting live acceptance.

Verification: `/tmp/reviewer-b-ld9-r8-r3-g5mxlvp3/remaining-checks.json` cross-checks the new rows against `/tmp/reviewer-b-ld9-r8-r2-tofad1og/baseline-reconciliation-r3.json` and its cited raw artifacts. No Docker, stack, product/test edit, install, commit or other reviewer's file was used.
