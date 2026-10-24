Verdict: APPROVE
Round: 7

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

## Round 5

Reviewed QA `9614cf03` / integration `35b71b98`, diff from `56261ed6`, against the task ACs, TEST-STRATEGY §4.2 and plan §6.1. **CHANGES_REQUESTED: 1 existing BLOCKER, 1 new MAJOR, 1 new MINOR; 0 NIT.** All ten R1 run counts match their raw summaries. All eleven published rate JSON files reproduce, but the T2/T3 file measures only the final pass. B-LA-E0-02-02 remains closed.

### B-LA-E0-02-01 — BLOCKER — Still open: AC-06/07 omit the pre-reset T2/T3 load

**File:line:** `docs/reviews/LA-E0-02/qa.md:35`, `:36`, `:165`, `:200`.

**Problem / evidence:** AC-04 now has the missing legacy results, but AC-06/07 cannot close on the reported T2/T3 rates. The `qalead-la-123-t2-t3ab.json` input covers only `passC` after `14-stack-reset.log` clears `.logs`. Its two app requests and eight LTI requests omit `passA` and the knob pass. The note acknowledges this limit while the AC table and §8.2 still claim complete coverage and no over-default flag for this group.

The earlier logs are retained in run 123's `container-passA/service-logs/` and `container-knob/service-logs/`; `container-passC/service-logs/` and final `service-logs/` cover the last pass. I combined their `cogniate-app.jsonl` and `lti-service.jsonl` files, deduplicating identical lines from cumulative snapshots, and ran the existing `rate-peaks.mjs` reader. The complete retained record gives:

| Metric | Total | Peak / minute | Peak / 10 s |
| --- | --- | --- | --- |
| App requests / LTI requests | 13 / 213 | — | — |
| App `/tool/launch` | 13 | 6 | 5 |
| App `/tool/deep-link` | 0 | 0 | 0 |
| LTI `protocol` | 85 | 34 | 23 |
| LTI `registration` | 6 | 6 | 6 |
| LTI `auth_failure` upper bound | 12 | 8 | 8 |

Both `registration` and `registration_account` now have `overDefault: true`: the former exceeds the reader's 5-request burst threshold; the latter includes five starts for `cogniate` in one minute against its soft default of 1/min. Registration-start upper bounds over ten minutes are five for `cogniate` and one with unknown account. These are conservative rate-reader flags, not proof of a token-bucket rejection: address/API-key identity is absent, and rolling counts do not by themselves model token refill. The previously reported T4b `registration_account` flag also remains.

**Required fix:** Publish the complete T2/T3 extraction and its input paths, correct AC-06/07 and §8.2, and record the Lead/A2 disposition of the newly visible over-default upper bounds for the acceptance profile. Do not infer a required configuration change solely from these flags. Existing artifacts suffice; this finding does not require another stack run. Reviewer output: `/tmp/reviewer-b-e002-r5-rsnvkgau/t2-complete-rate-peaks.json`; exact inputs: `t2-rate-sources.json` in that directory.

### B-LA-E0-02-03 — MAJOR — The claimed omitted T8 harness fix does not exist in the cited change

**File:line:** `docs/reviews/LA-E0-02/qa.md:186`; repeated in `docs/reviews/LA-E7-08/qa.md:1360`.

**Problem:** The explanation ties the T8 log-observation failure to a pre-WE-F6 / BD-A1-118 harness state. That attribution is unsupported and would give the differential record a false explanation for baseline FAIL versus candidate PASS.

**Observed evidence:** Run 129's `service-logs/build-runner.jsonl` records `build_hold` for `bld_9024b26e1ff6c7b89d527288` at `18:41:06.818Z`. Its HOLD Playwright result fails after **421,171 ms** at `3-knob-hold.spec.ts:31:50`, with the expected event undefined. The FAIL_AT trace then returns the **same build ID**, and its result fails after **423,075 ms** at `4-knob-fail.spec.ts:23:25`, expecting `failed` but receiving `running`. The runner finally records that held build's failure at step `copy` on stop at `18:55:42.154Z`. The missed event and cascading second failure are supported. A VirtioFS cache or permission cause is not established: `tests/acceptance/lib/lti.ts:207` catches every log-read exception and returns `[]`, so that observation does not distinguish those causes.

**Change/parity evidence:** [LD-9 r2](../LA-E7-08/ld9-addendum-r2.md) changes **`M1-08.canvas.login-redirect` for LA-IC-06**, not T8. `BD-A1-118` (`docs/architecture/ltiaas/build-decisions-A1.md:127`, commit `4c28887d`) records design-document corrections with no product change. The cited `chmod 700` and read-only log mount remain present at baseline and candidate. The two knob specs, `lib/{t8,logs,lti}.ts`, `tests/host/run-t8.mjs` and `host-control.mjs` are identical between baseline test `1ae6716b`, candidate test `794f649c` and run 129's actual clone. The retained D1 run 80/83 and D2 run 99 clones also have identical bytes for these seven files. There is no omitted WE-F6 T8 overlay to apply to baseline under LD-25/29.

The raw per-ID comparison is:

| Test | R1 baseline, run 129 | D1, runs 80/83 | D2, runs 99/105 |
| --- | --- | --- | --- |
| AC-T8-03 | FAIL: hold event not observed | PASS | PASS |
| AC-T8-07 | FAIL: same held build still running | PASS | PASS |

**Required fix:** Remove the nonexistent-fix attribution, retain the observed failure and cascade, and label the initial log-read cause unresolved unless direct evidence establishes it. Keep the FAIL-to-PASS differences explicit for both IDs, and compare D3/D4's actual results separately when available. TEST-STRATEGY §4.2 permits a recorded baseline failure; this finding does not require E0 to fix the product or rerun merely to obtain PASS. It requires an accurate record, without an unsupported equivalence or waiver.

### B-LA-E0-02-04 — MINOR — The companion gate summary has incorrect artifact IDs and rate figures

**File:line:** `docs/reviews/LA-E7-08/qa.md:1351` through its ten-run list at `:1360`.

**Problem / evidence:** None of the ten exact artifact directory names in that list exists under its cited R1 root. For example, run 120 ends in `675Z`, not `810Z`; run 122 is `2026-10-24T17-46-37-886Z`, not `2026-10-24T171226Z`. The rates also disagree with the saved JSON: M1 launch/protocol are **26/184 per minute**, not 30/27; M2 admin is **303/min**, not 24; T4a and T8 launch are **0**, not 14/min and 2/min. The listed `/s` values and `lti.runtime` class are not outputs of the cited reader. A maintainer following this summary cannot retrieve the stated evidence or reproduce its figures.

**Suggested fix:** Regenerate the list from the actual summaries and rate JSON, or link the corrected E0 §8 table as the single numeric source. Use the real artifact IDs below. This correction is independent of the missing T2/T3 input coverage.

### Verified counts and raw paths

Each path below ends in **`/summary.json`**, under `/Users/quangnguyen/cogniate-qa-runs/LA/REGATE/slot-r1/artifacts/`. `P/F` means PASS/FAIL; entry counts include host rows, while ID counts use the summary aggregate.

| Exact artifact directory | Entry counts | Unique-ID counts / case detail |
| --- | --- | --- |
| `qalead-la-120-78971b03-2026-10-24T17-12-27-675Z` | 400 P | 400 P; M1 ledger 394 P |
| `qalead-la-121-78971b03-2026-10-24T17-43-47-815Z` | 71 P | 71 P; M2 ledger 64 P |
| `qalead-la-122-78971b03-2026-10-24T17-46-37-886Z` | 8/8 steps OK | 3 × (17 P, 0 F, 1 demo SKIP); 175/176/176 s |
| `qalead-la-123-78971b03-2026-10-24T17-55-33-990Z` | 76 P | 64 P |
| `qalead-la-124-78971b03-2026-10-24T18-03-57-336Z` | 28 P | 28 P |
| `qalead-la-125-78971b03-2026-10-24T18-05-47-088Z` | 19 P | 15 P |
| `qalead-la-126-78971b03-2026-10-24T18-07-15-391Z` | 48 P | 40 P |
| `qalead-la-127-78971b03-2026-10-24T18-12-22-967Z` | 59 P | 48 P |
| `qalead-la-128-78971b03-2026-10-24T18-28-47-946Z` | 53 P | 46 P |
| `qalead-la-129-78971b03-2026-10-24T18-35-41-097Z` | 32 P, 4 F | 20 P, 3 F: SUITE, AC-T8-03, AC-T8-07 |

All ten summaries identify product `78971b0300ab171029e8ce94dbba30db37b23dea`; all M1/M2 case rows identify test `1ae6716b7353becc0f053b46fb65e0ba86ff7873`. The recorded group times, T7 demo skips and dedicated knob-pass dispositions agree with the artifacts. Migration/snapshot evidence remains the accepted earlier record, not a new R1 run.

Recalculated all eleven files in `REGATE/slot-r1/rate-peaks/` from their stated inputs. Every saved calculation agrees; only input completeness for T2/T3 is disputed above. Read the rate reader's address/key and registration-start upper-bound limitations. Per-run main-stack memory peaks reproduce to the report's precision; the SIM/Moodle maxima are **1,608.3 / 1,975.2 MiB**. `docker-records/before-volumes-inspect.json` and `after-volumes-inspect.json` contain the same **32** unchanged protected volume records.

Additional T8 raw summaries, under `/Users/quangnguyen/cogniate-qa-runs/LA/`: `RUN-D1/artifacts/qalead-la-80-a8bbac53-2026-10-24T11-37-11-860Z/summary.json`, `RUN-D1/artifacts/qalead-la-83-a8bbac53-2026-10-24T13-04-38-988Z/summary.json`, `RUN-D2/artifacts/qalead-la-99-a8bbac53-2026-10-24T11-32-48-203Z/summary.json`, and `RUN-D2/artifacts/qalead-la-105-a8bbac53-2026-10-24T13-32-48-725Z/summary.json`. Run 129's two `container-knob-BUILD_RUNNER_{HOLD,FAIL_AT}/playwright-results.json` files and their `playwright/*/trace.zip` files establish the errors and build identity above.

Independent accounting is in `/tmp/reviewer-b-e002-r5-rsnvkgau/`: `summary-audit.json`, `rate-audit.json`, `t2-complete-rate-peaks.json`, `t2-rate-sources.json`, `t8-evidence.json`, `d1d2-t8-audit.json`, and `memory-volume-audit.json`. No Docker, stack, install, product/test edit or commit. I changed only this review file. Blind review maintained.

## Round 6

Reviewed QA `f27bf214` / integration `4ac1672d`, diff from `1b447224`, with A2's `BD-A2-114` ruling at `5991a114`. **APPROVE for the E0 evidence correction: 0 open BLOCKER or MAJOR in this record; 0 new findings.** The existing companion-report MINOR remains outside this diff, as assigned by the Lead.

**B-LA-E0-02-01 closes.** QA §9.2 names all eight retained log inputs and gives a reproducible deduplication and reader command. I rebuilt the inputs independently: **53 app / 340 LTI unique log lines**, containing **13 / 213 requests**. Every output field matches both corrected QA JSON files and my Round 5 recovery (apart from the earlier review's suite label). Launch peaks are **6/min, 5/10s**; registration peaks are **6/min, 6/10s**. The old passC-only file is preserved separately. AC-06/07 and §8.2 now include the complete measurement, both over-default reader flags, and the approved disposition.

`BD-A2-114` and LA-ADR-06 D1 explicitly retain the built-in defaults for acceptance stacks. Independent arithmetic using the bucket refill rule and six raw request timestamps agrees: the sequence spans **8.922 s**, the hard bucket ends with **0.487 tokens**, and the five `cogniate` requests leave **15.1294 tokens** in the soft account bucket. Neither empties. The report now distinguishes the reader's conservative window flags from an actual bucket refusal and records why no override is required.

**B-LA-E0-02-03 closes for the E0 record.** AC-04/09, §8.1 and §9.3 retain the exact HOLD failure (**421,171 ms**, event undefined) and FAIL_AT cascade (**423,075 ms**, the same build still running). They retract the WE-F6 attribution, state the first cause as **not proven**, and explicitly show both IDs as **baseline-3 FAIL versus D1/D2 PASS**, with D3/D4 pending. This agrees with the traces and file-parity evidence audited in Round 5; no new causal assertion replaces the withdrawn claim.

**Audit table:** All **19** exact §9.1 paths exist. Their run IDs, product SHAs, entry counts, aggregate counts, case-ledger counts and T7 pass/skip counts match the raw files. Earlier M3, T5, T6 and T8 failures remain visible. The task change touches only QA's evidence document; no product, frozen assertion or UNIT behavior changes.

**B-LA-E0-02-04 remains OPEN, MINOR, for the companion E7-08 summary.** Its artifact/rate correction and removal of the repeated obsolete T8 attribution are assigned to the Lead QA's D3 record and are not included here. This round accepts the E0 corrections; E7 companion reconciliation and the D3/D4 comparison remain separate work.

Verification: `/tmp/reviewer-b-e002-r6-p8e5rhst/{summary-audit.json,rate-sources.json,t2-complete-rate-peaks.json,bucket-replay.json}`, plus the Round 5 T8 evidence named above. No Docker, stack, install, product/test edit or commit. Only my review file was edited; blind review maintained.

## Round 7

Reviewed the assigned companion correction in E7-08 QA `26ddcebd` / integration `c5a700d8`, corrected R1 section at `docs/reviews/LA-E7-08/qa.md:1366`, on 2026-10-25. **APPROVE — B-LA-E0-02-04 CLOSED; 0 BLOCKER, 0 MAJOR, 0 MINOR, 0 NIT open; 0 new findings.**

All ten full run IDs now point to the saved R1 summaries and match the entry/unique-ID accounting independently checked in Round 6. The companion removes its conflicting rate table and links the canonical E0 results. Its T2/T3 numbers agree with the complete eight-input extraction: 13 app / 213 LTI requests, launch 6/min and 5/10s, protocol 34/min and 23/10s, registration 6/min and 6/10s, both conservative over-default flags, and BD-A2-114's decision to retain the defaults.

The repeated pre-WE-F6 / read-only-mount / VirtioFS explanation is withdrawn. The companion now states that the first HOLD cause is not proven, gives the observed FAIL_AT cascade, and retains baseline 129 FAIL versus D1/D2/D3/D4 PASS for AC-T8-03/07. Independently checked the new authorized baseline retry 170: 36 PASS entries and 23 PASS IDs, matching candidate 137/160 without changing the T8 source. The original 129 failure is still visible in the per-ID table; retry success does not erase it.

This closes the companion item left outside Round 6. My new E7-08 B-01 concerns different, older U1 carry citations and is recorded in that task, not carried against E0. Verification uses the Round 5/6 raw-accounting artifacts above and `/tmp/reviewer-b-regate-uqtfgkjb/{run-audit.json,per-id-audit.json,rerun-audit.json,source-parity.json}`. No product/test or UNIT change, Docker, stack, install or commit. Only the three dispatched Reviewer-B reports were edited; blind review maintained.
