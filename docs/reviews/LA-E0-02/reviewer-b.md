Verdict: CHANGES_REQUESTED
Round: 1

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
