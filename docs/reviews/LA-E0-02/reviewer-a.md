Verdict: CHANGES_REQUESTED
Round: 1

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
