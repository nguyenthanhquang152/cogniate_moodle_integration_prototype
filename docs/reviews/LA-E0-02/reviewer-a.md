Verdict: CHANGES_REQUESTED
Round: 6

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

## Round 5

Reviewer-A: Codex GPT-6-Astra xhigh, 2026-10-25 (local). Reviewed QA `9614cf03`, integrated at `35b71b98`, using the scoped diff from `56261ed6` and the saved Slot R1 artifacts. **CHANGES_REQUESTED: A-LA-E0-02-01 remains open (BLOCKER); 2 new MAJOR findings below; 0 new BLOCKER, MINOR or NIT.** The result counts and group times are supported. The full-task 9/9 PASS is premature because one legacy rate record omits earlier passes. The two T8 failures may be recorded as baseline failures; they do not themselves prevent acceptance of a truthful baseline record.

### Raw summary reconciliation

Every path below is relative to **`/Users/quangnguyen/cogniate-qa-runs/LA/REGATE/slot-r1/artifacts/`**. All ten summaries name product `78971b0300ab171029e8ce94dbba30db37b23dea`, with no abort. Counts distinguish result entries from unique IDs; any failed occurrence makes that ID fail.

| Exact `summary.json` path | Result entries | Unique IDs / manifest | Group wall time |
| --- | --- | --- | --- |
| `qalead-la-120-78971b03-2026-10-24T17-12-27-675Z/summary.json` | 400 PASS | 400 PASS; M1 ledger 394/394 PASS | 23.0 min |
| `qalead-la-121-78971b03-2026-10-24T17-43-47-815Z/summary.json` | 71 PASS | 71 PASS; M2 ledger 64/64 PASS | 2.8 min |
| `qalead-la-122-78971b03-2026-10-24T17-46-37-886Z/summary.json` | 8/8 host steps OK | Each of 3 runs: 17 PASS, 0 FAIL, 1 demo SKIP | 8.9 min |
| `qalead-la-123-78971b03-2026-10-24T17-55-33-990Z/summary.json` | 76 PASS | 64 PASS | 8.4 min |
| `qalead-la-124-78971b03-2026-10-24T18-03-57-336Z/summary.json` | 28 PASS | 28 PASS | 1.8 min |
| `qalead-la-125-78971b03-2026-10-24T18-05-47-088Z/summary.json` | 19 PASS | 15 PASS | 1.5 min |
| `qalead-la-126-78971b03-2026-10-24T18-07-15-391Z/summary.json` | 48 PASS | 40 PASS | 5.1 min |
| `qalead-la-127-78971b03-2026-10-24T18-12-22-967Z/summary.json` | 59 PASS | 48 PASS | 16.4 min |
| `qalead-la-128-78971b03-2026-10-24T18-28-47-946Z/summary.json` | 53 PASS | 46 PASS | 6.9 min |
| `qalead-la-129-78971b03-2026-10-24T18-35-41-097Z/summary.json` | 32 PASS, 4 FAIL | 20 PASS, 3 FAIL: AC-T8-03, AC-T8-07, SUITE | 20.9 min |

The controller's `logs/master.log` supports these rounded wall times and the 8.4-minute pause before M2. T7's own summary gives **175 / 176 / 176 seconds**, with resets **39 / 39 / 40 seconds**. T8's main 10 tests, two C-T8-01 race tests and C-T8-02 pass; the two knob reports fail at **421,171 / 423,075 ms**, with the assertion messages transcribed correctly in E0-02 §8.1. This completes the previously missing AC-04 result/time record; it does not close the rate portion of A-LA-E0-02-01.

### A-LA-E0-02-01 — BLOCKER — Still open: T2a–T3b rates cover only the final pass

**Current location:** `docs/reviews/LA-E0-02/qa.md:35`, `:36` and `:200` (the `t2-t3ab` row of §8.2).

All **11** saved rate files reproduce exactly when the extractor is rerun on their selected inputs. The other six legacy groups' available snapshots add no requests beyond their published final logs. For `qalead-la-123-t2-t3ab.json`, however, the selected top-level `service-logs/` contains only passC after `14-stack-reset.log`. The row acknowledges that reset but still credits complete AC-06/07 coverage.

The earlier snapshots survive in the same run's `container-passA/service-logs/` and `container-knob/service-logs/`. Combining these with `container-passC/service-logs/` and the final logs, removing duplicate saved lines before extraction, gives:

| Measurement | Published final-pass file | All saved passes |
| --- | --- | --- |
| App / LTI request totals | 2 / 8 | **13 / 213** |
| Launch peak, per minute / per 10 s | 2 / 2 | **6 / 5** |
| LTI protocol peak, per minute | 4 | **34** |
| Registration total / per minute / per 10 s | 0 / 0 / 0 | **6 / 6 / 6** |
| Auth-failure total / per minute / per 10 s | 0 / 0 / 0 | **12 / 8 / 8** |
| Registration starts per 10 min | None | **cogniate: 5; unknown: 1** |

Under the extractor's documented upper-bound method, the omitted registration peak exceeds the **5-per-10-second burst**, and `cogniate`'s **5/minute** exceeds the account's **1/minute** steady rate. Thus the claim that only T4b has an over-default class is also wrong. AC-06/07 are not complete for this group, and the Lead has not been given its required threshold exception.

**Required correction:** Rebuild this rate record from the surviving per-pass snapshots without double-counting overlapping copies; update the AC summary, §8.2 and the over-default discussion, and obtain the Lead's required acceptance-limit decision. No stack rerun is needed to recover these measurements. Keep A-LA-E0-02-01 open until that record is reviewed.

### A-LA-E0-02-03 — MAJOR — The T8 explanation cites an unrelated fix and treats a hypothesis as a cause

**Location:** `docs/reviews/LA-E0-02/qa.md:186` and `docs/reviews/LA-E7-08/qa.md:1360`.

**Problem:** The report attributes the failures to pre-WE-F6 read-only VirtioFS caching and implies that a T8 harness fix is absent from baseline-3. There is no such T8 change in the cited addendum. This explanation cannot justify a different baseline/candidate answer.

**Evidence:** The saved traces show both knob tests receiving **the same build ID**, `bld_9024b26e1ff6c7b89d527288`. The host log contains `build_hold` at **18:41:06.818Z**; the hold test later reports no matching event, and the fail-at test receives the still-running build. The host finally records that build stopped at **18:55:42.154Z**. These facts support the hold/cascade account. They do **not** identify why the first test failed to observe the event: `eventsSince()` returns an empty list on any read exception as well as on no matching event, and the trace does not record the underlying read result or error. The copied host logs do not prove what the container could read during polling.

WE-F6 / LD-9 addendum r2 is the **M1-08 Canvas platform-storage login** assertion change under LA-IC-06, as its own approved Reviewer-A Round 2 confirms. BD-A1-118 records unrelated conformance details. The two T8 knob specs, `tests/host/run-t8.mjs`, and `tests/acceptance/lib/{lti,logs}.ts` are byte-identical in baseline-3 and candidate; the actual R1 workdir matches the baseline source. Both product trees still use the read-only log bind and `chmod 700` on the log directory. D1/D2's hold-spec bytes also match. Therefore there is no missing approved T8 WE-F6 patch to import.

**Suggested fix and comparison consequence:** Retain the exact observed failures and cascade, label the first failure's root cause **unconfirmed**, and remove the incorrect WE-F6/BD-A1-118 attribution unless separate diagnostic evidence proves a cause. Excluding the LA-specific Canvas answer from baseline-3 is correct under LD-29; importing it would give the old product the new product's expected answer. LD-25 requires D3/D4 suite parity, which remains satisfied; it does not turn unequal results into equality. D1 `qalead-la-83` and D2 `qalead-la-105` record AC-T8-03/07 PASS. If D3/D4 also pass, record **baseline FAIL → candidate PASS** for these IDs, with the error/step and a supported explanation or explicit unresolved classification. Do not call them equal or an expected WE-F6 change. Any new harness repair must be separately justified and reviewed, with comparable rerun evidence or an explicit Lead disposition under TEST-STRATEGY §4.2.

### A-LA-E0-02-04 — MAJOR — The new E7-08 baseline summary does not match the saved run identifiers or rates

**Location:** `docs/reviews/LA-E7-08/qa.md:1351`–`:1360`.

**Problem and evidence:** §14 duplicates the correct result totals but supplies different run IDs and unsupported rate values. For example, its M1 ID ends in **`17-12-27-810Z`**, while the actual summary is **`17-12-27-675Z`**; its T7 ID ends in **`T171226Z`**, while the actual run is **`17-46-37-886Z`**. Its M1 protocol peak is **27/min**, versus **184/min** in the saved file; its T4a row claims launch **14/min** and protocol **13/min**, although the saved logs have **zero launches and zero LTI requests**. The cited rate extractor reports per-minute and per-10-second windows, and has no `runtime` class, yet §14 adds `/s` and `lti.runtime` values without another source. The ten exact identifiers are listed above; E0-02 §8.1 uses them correctly.

**Suggested fix:** Regenerate §14 from the same summaries and corrected rate outputs used by E0-02, or link to that authoritative table. Preserve the two T8 failures and the newly identified T2/T3 rate exception. Do not use the current §14 rates or identifiers as gate evidence.

### Verification boundary

Evidence in **`/tmp/la-review-a-445b797fe69e/`**: `summary-audit.json` (all exact paths and counts), `rate-audit.py`, `rate-audit.json` (all 11 recomputations and complete per-pass comparison), `merged-123/` (deduplicated input copies), `t8-raw-evidence.json`, `t8-source-parity.json`, `run-source-parity.json`, and `t8-prior-runs.json` (exact D1/D2 summary paths). All work was host-only: read saved JSON/logs/traces, read Git objects, and execute the pure rate extractor against saved files. No Docker, live stack, install, product mutation or commit; no Reviewer-B report or probe was opened. Only this Reviewer-A report was edited in integration.

## Round 6

Reviewer-A: Codex GPT-6-Astra xhigh, 2026-10-25 (local). Reviewed QA `f27bf214`, integrated at `4ac1672d`, through `git diff 1b447224 4ac1672d -- docs/reviews/LA-E0-02/qa.md`, with A2's BD-A2-114 / ADR-06 D1 ruling at `5991a114`. **The E0-02 evidence corrections are accepted: A-LA-E0-02-01 is CLOSED, and the E0-02 part of A-LA-E0-02-03 is resolved.** The overall verdict remains **CHANGES_REQUESTED** because the companion E7-08 portions of A-LA-E0-02-03 and A-LA-E0-02-04 remain open. That companion correction is explicitly outside this diff and is expected with Lead QA's D3 record. **New findings: 0 BLOCKER, 0 MAJOR, 1 MINOR. Remaining totals: 0 BLOCKER, 2 MAJOR limited to the companion record, 1 MINOR.**

### Verified corrections

- **Complete rates:** Repeated §9.2's exact `awk` deduplication against all four saved snapshot locations, writing only to `/tmp`, then ran the pure rate extractor. Both published all-pass JSON files equal the result and my independent Round 5 recovery. The merged logs contain **53 app / 340 LTI lines**, including **13 / 213 requests**. Launch peaks are **6/min / 5 per 10 s**; protocol **34/min / 23 per 10 s**; registration **6/min / 6 per 10 s**; auth failures **8/min / 8 per 10 s**. The retained passC-only output preserves its old measurements, with only its suite name changed. Snapshot unions for the other eight cited R1 runs also reproduce their published outputs exactly.
- **Rate disposition:** AC-06/07 and §8.2 now retain the over-default flags and apply BD-A2-114. An independent replay of the six logged registration timestamps through the bucket rule gives offsets **0, 4.846, 7.754, 7.757, 7.762, 8.922 seconds** and **0.487 tokens** after the last request. The five known-account starts leave **15.129 tokens** in the soft account bucket; the unknown account has no account bucket. The recorded decision keeps built-in defaults and requires no acceptance override. This closes the missing measurement and disposition in A-LA-E0-02-01.
- **Nineteen-summary audit:** Every §9.1 path exists and matches its raw `runId` and product SHA. Entry counts, unique-ID counts, failed IDs and manifest counts match, including historical failures. Both T7 summaries have eight successful host steps and three runs of **17 PASS / 0 FAIL / 1 demo SKIP**, with the stated run/reset times. The group wall-time values retain the previously reviewed record.
- **T8 observations and comparison:** §8.1/§9.3 now distinguish the host's saved hold event, the test's missing observation and the later same-build cascade. The initial cause is correctly **not proven**; WE-F6 supplies no T8 fix. Both knob IDs are PASS in each cited D1 run **80/83** and D2 run **99/105**, while R1 preserves FAIL. D3/D4 remain pending and are not declared equal. Source comparison at the correct pins confirms parity for all seven named T8 specs, runner and helper files; retained R1, D1/D2 workdirs and gate sources agree where available. The run-105 workdir has been removed, so its result was verified from its retained summary, not a fresh workdir read.

### A-LA-E0-02-05 — MINOR — The candidate source pin is transcribed incorrectly

**Location:** `docs/reviews/LA-E0-02/qa.md:311`.

**Problem and evidence:** The new parity statement names `794f649cb647703097253e7b11521a97fb29a192`. The approved candidate pin is **`794f649c3ebacf1a1b3ac599cffffe338dd7373d`**, as recorded in `LA-E7-08/ld9-addendum-r8.md:9` and independently resolved from the retained private Git clone. The printed full hash does not resolve there. The parity claim holds at the correct pin, so this is a reference correction rather than a source mismatch.

**Suggested fix:** Replace the incorrect full hash with the approved candidate pin.

### Remaining companion work and evidence boundary

Fresh reading of `docs/reviews/LA-E7-08/qa.md:1351`–`:1360` confirms that its incorrect run IDs/rates and pre-WE-F6 T8 attribution remain. **A-LA-E0-02-04 stays open; A-LA-E0-02-03 stays open only for that companion attribution.** Review the planned companion correction before closing either finding. D3/D4 results need their own per-ID differential record when available; they are not a prerequisite for accepting the corrected historical E0-02 observations.

Evidence: **`/tmp/la-review-a-6233f491561a/`**, including `audit.py`, `summary-audit.json`, `rates-recomputed.json`, `merged-123/`, `bucket-replay.json`, `other-snapshot-audit.json`, `t8-candidate-runs.json` and `t8-source-parity.json`; Round 5 trace evidence remains applicable. Only this Reviewer-A report was edited. No Docker, stack, host stack runner, install, product change or commit; no Reviewer-B report or probe was opened.
