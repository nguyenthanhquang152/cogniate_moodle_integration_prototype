Verdict: APPROVE
Round: 7

# LA-E7-09 — Reviewer-B

## Round 1

Reviewer: Codex GPT-6-Astra, Reviewer-B (can a human team own it?), 2026-10-23 UTC. Scope: slot 8 live Moodle checks in `0ebbd1ee`, integrated by `b5f68c4b`; the new Playwright suite, config, host runner and slot 8 section of `qa.md`. Integration snapshot: `f1144ca5f86c6864ff0ce2fc9ef940594661fc33`. This review covers the dispatched QA-E2E part, not the still-pending full wave-end gates.

### Findings

**B-LA-E7-09-01 — MAJOR — The claimed post-run secret-scan fix still calls a nonexistent Redactor API.**

- **Location:** `tests/e2e/ltiaas/run-slot8-moodle.mjs:370` and `:377`; claim of resolution in `docs/reviews/LA-E7-09/qa.md:102`.
- **Problem:** Replacing `r.redact.findIn(...)` with `[...r.redact.values]` does not repair the runner. The shared `Redactor` keeps its set in private `#values` and exposes only `add`, `size` and `apply`. Every normal run reaches at least one scan file, throws before recording `M3-07-S8`, and ends with `ERROR: FAIL`. With no files, `.values.size` would still throw. Another QA owner cannot reproduce a complete passing run from this commit.
- **Evidence:** The primary saved summary (`qa-e2e-la-s8-r2-f34b27df-2026-10-23T23-14-54-556Z`) has 15 PASS IDs plus `ERROR: FAIL` for the old `findIn` call and no `M3-07-S8` row. A read-only Node probe importing the actual `tests/host/lib.mjs` confirms `typeof redact.values === 'undefined'` and reproduces `TypeError: redact.values is not iterable` with the replacement expression. The report's separate 35-secret scan may support that scan's result, but it does not verify this committed replacement.
- **Suggested fix:** Use a supported interface, or keep an explicit candidate set in the QA runner and pass those values to `redact.add`; coordinate any shared helper API change with its owner. Test the scan function against the real Redactor using temporary text files and stubbed command execution, including a planted hit and a clean result. Update `qa.md` to distinguish the historical failing live summary from the independently verified fix. This can be checked on the host without starting a stack.

**B-LA-E7-09-02 — MINOR — Runner help and intended defaults do not match the entry point.**

- **Location:** `tests/e2e/ltiaas/run-slot8-moodle.mjs:13–18`, using `tests/host/core.mjs:38–54` and `:74–75`.
- **Problem/evidence:** The inherited help names `tests/host/run-la-e7-09-slot8.mjs`, which does not exist; the actual file is `tests/e2e/ltiaas/run-slot8-moodle.mjs`. The supplied `defaultPort: '9543'` and `defaultSubnet: '172.21.0.0/16'` are ignored because `createRunner` accepts neither option; without environment overrides it uses `8443` and `172.29.0.0/16`. The explicit command in `qa.md` supplies the correct values, so the recorded run is unaffected, but help and source defaults mislead a new owner.
- **Suggested fix:** Provide accurate help for this entry point, list the fixture-directory requirement, and either require the slot's environment values or arrange supported default options through the shared helper owner. Add a host-only help/default check.

**B-LA-E7-09-03 — MINOR — The diagnostic-run history omits two saved runs and some non-passing rows.**

- **Location:** `docs/reviews/LA-E7-09/qa.md:105–112`.
- **Problem:** The primary summary is transcribed accurately, but the earlier-run list does not give the complete accounting requested for r1, r2, r2-clean and r2-run. A reader cannot reconcile the named log files with the history.
- **Evidence:** Under `/Users/quangnguyen/cogniate-qa-runs/LA/SLOT8-QA-E2E/logs/`, `run-slot8-r1.log` identifies `qa-e2e-la-s8-r1-f34b27df-2026-10-23T22-48-18-037Z` (six PASS IDs, `SLOT8-PASS1: FAIL`, zero cases), and `run-slot8-r2.log` identifies `qa-e2e-la-s8-r2-f34b27df-2026-10-23T22-49-50-271Z` (six PASS IDs, `ERROR: FAIL`, `r.save is not a function`). Both corresponding summaries exist in `la-qa/tests/host/artifacts/`; neither run ID appears in the history. The listed `22-41-37-989Z` and `22-46-47-189Z` runs do not substitute for them. For r2-clean at `22-52-08-040Z`, the summary also marks S8-03/04/05 FAIL; the Playwright report explains these are serial skips after S8-02 failed, but the narrative reports only S8-02. At `22-58-50-994Z`, S8-05 is likewise a skipped case reported as FAIL by the runner and omitted from the narrative.
- **Suggested fix:** Add a compact table for every saved summary: exact run ID, log/clone, PASS/FAIL totals, failing IDs and reason. Explain the serial skips separately from executed assertion failures; retain any genuine earlier attempts with their own evidence links.

### Checks and limits

- Read all three new source files and the QA report; checked the shared runner/Redactor contracts, environment forwarding, task spec, plan §6.1, file-ownership matrix and the referenced live ACs of LA-E3-05, LA-E4-03 and LA-E5-22. The change stays within the dispatched QA files. No product, storage command or frozen test changes; no LMS name added to a core path. There is no UNIT AC in this review scope.
- Read all ten saved slot 8 summaries under `la-qa/tests/host/artifacts/qa-e2e-la-s8-*`, the five top-level run logs, the relevant Playwright reports and selected primary evidence JSON. The final run's six case durations match `qa.md`: 1.716, 3.936, 7.978, 16.839, 39.943 and 30.198 seconds. Pass 1 reports five passed tests; pass 2 reports one. Its Cancel evidence records three radios, zero checkboxes, empty content items, the stated message, automatic modal closure, zero activities and replay 410. Its start/end health evidence shows default profile and empty knobs for all three listeners.
- The final live summary discloses the helper ERROR and successful teardown; it does not establish a passing integrated secret-scan step. The test names link steps to their ACs, and the two-phase structure makes the restart boundary clear. These functional results remain useful while B-01 is repaired.
- Verification here was read-only: a small Node import/expression probe and artifact inspection. No Docker, stack, browser suite, host runner, package installation, commit or push was executed. No other reviewer's file was opened. Only this Reviewer-B report was written in integration.

**Result:** CHANGES_REQUESTED — 0 BLOCKER, 1 MAJOR, 2 MINOR, 0 NIT. Repair and host-verify B-LA-E7-09-01 before approval; B-02/B-03 can be corrected or deferred under charter §5.

## Round 2

Reviewer: Codex GPT-6-Astra, Reviewer-B, 2026-10-23 UTC. Scope: QA-E2E fix `e8a92d2c`, integrated as `c48b76dcd783346e16e52348bef40c12cb27ad0c`, including WE-F9 discovery isolation. Review started at integration `ff287b2897626832643f85e1902229f124f162be`. This approval covers the host-only repair; the repaired live `M3-07-S8` row remains scheduled for Slot 8b.

### Round 1 disposition

- **B-LA-E7-09-01 — CLOSED.** `scanSlot8Files` uses the real Redactor's public `apply` and `size` interfaces. The new `--selftest` passes in a fresh private clone: three candidates loaded, two planted hits detected across service and Docker logs, then zero hits after cleaning. Restoring the old `.values` access in that private clone makes the same selftest exit 1 with `TypeError: redact.values is not iterable`; the mutation was restored. Collection runs in `finally`, and captured M1 secrets load before the artifact redaction and scan. The QA report now distinguishes the historical failing live run from host verification and the pending live rerun.
- **B-LA-E7-09-02 — CLOSED.** `--help` names the actual entry point, fixtures and supported defaults. The direct entry applies port `9543` and subnet `172.21.0.0/16` before `createRunner`; the selftest verifies the default values and help text.
- **B-LA-E7-09-03 — PARTLY RESOLVED; MINOR remains.** All ten saved summary IDs, PASS/FAIL totals and failing IDs now match the saved JSON. The report explains serial skips. The remaining issue is the log mapping below.

### Remaining findings

**B-LA-E7-09-03 — MINOR — Some table rows still point to another run's saved log.**

- **Location:** `docs/reviews/LA-E7-09/qa.md:112` and `:118`.
- **Problem/evidence:** Rows 4–10 all name `run-slot8-r2-run.log`. Reading the saved log's run ID shows that it contains only `23-10-32-311Z` (row 9). The primary `23-14-54-556Z` run is in `run-slot8-r2-final.log`. Rows 4–8 have valid individual summaries, but the named top-level log does not contain those runs. A reader following the primary row reaches the earlier `collectLogs` failure instead of the `findIn` failure.
- **Suggested fix:** Point row 10 to `run-slot8-r2-final.log`; for rows 4–8, identify retained per-run artifacts or mark the top-level log as overwritten/unavailable. Keep the now-correct summary IDs and totals.

**B-LA-E7-09-04 — MINOR — The WE-F9 proof documents acceptance selectors and guard guarantees inaccurately.**

- **Location:** `docs/reviews/LA-E7-09/qa.md:162`, `:171` and `:172`; `tests/e2e/ltiaas/run-k2.mjs:122` and `:137`.
- **Problem/evidence:** The documented `--grep "@T6"` and `--grep "@T5a|@T8"` commands both exit 1 with zero tests on baseline and candidate. The frozen titles do not carry those tags. Setting `QA_TASK=T6` or `QA_TASK=T5a,T8` instead gives the reported 18/6 and 37/14 selections, identical between commits. The harness uses those correct task selectors, but only checks LA exclusion for these acceptance groups; exact count assertions exist only for T7 and M2, despite the report claiming all four. Its success message also says M2 has nine files, while Playwright reports one helper source file (from nine specs).
- **Suggested fix:** Document the actual `QA_TASK` commands, without the nonexistent tags. Describe the acceptance guard as an exclusion check, or add the claimed count assertions. Make the M2 message distinguish nine specs from the one file in Playwright's listing. The independently verified selections below establish that the discovery repair itself works.

### Independent host verification

Used separate `git clone --no-hardlinks` copies at baseline `1b17261be97c4701b928fa9dc2fa74c6d23028f6` and candidate `c48b76dc`, with each clone's own root and `tests/` dependencies. Cleared inherited `QA_*` selection variables and supplied exact product/test SHAs. Ran Playwright `--list` only, from `tests/`:

| Selection | Baseline and candidate | Complete stdout comparison |
| --- | --- | --- |
| T7: default config, `QA_SUITE=e2e` | 18 tests, 6 files | Identical |
| M2: `e2e/M2/playwright.config.ts` | 64 tests, 1 file | Identical |
| T6: default config, `QA_SUITE=acceptance QA_TASK=T6` | 18 tests, 6 files | Identical |
| T5a/T8: default config, `QA_SUITE=acceptance QA_TASK=T5a,T8` | 37 tests, 14 files | Identical |
| Full acceptance: default config, `QA_SUITE=acceptance` | 171 tests, 66 files | Identical |

Dedicated candidate configs still discover R2-SIM (2), K2 (12), and Slot 8 pass 1/pass 2 (5/1). Renaming the R2 file back to `.spec.ts` in the private clone makes T7 discover 20 tests in 7 files, including both R2 cases; the new exclusion/count guards would reject this old behavior. Restored both private mutations and confirmed no tracked diff in that clone. Outputs are under `/tmp/la-e7-09-b-r2-lists/`.

Read the full fix against the task spec, governing charters, plan §6.1 and ownership rules. Changes stay in QA-E2E-owned files and the assigned QA report; frozen configs/specs and product/core paths are unchanged. There is no UNIT AC in this scope. No Docker command, stack, browser execution, live runner mode, commit or push was used. No other reviewer's file was opened; only this review file was edited in integration.

**Result:** APPROVE — 0 BLOCKER, 0 MAJOR, 2 MINOR, 0 NIT open (B-03 carried, B-04 new). Correct or defer the two documentation items through the Lead under charter §5. This is not completion evidence for the remaining live or full wave-end gates.

## Round 7

Reviewer: Codex GPT-6-Astra, Reviewer-B, 2026-10-25. Dispatched final re-gate review of QA `26ddcebd` / integration `c5a700d8`, E7-09 QA Round 7 and the shared D3/D4 evidence, on final product `4f10c5fd`. **APPROVE — 0 BLOCKER, 0 MAJOR, 0 MINOR, 0 NIT open in this task review.** This round number follows the dispatch; this file's earlier task reviews are Rounds 1 and 2.

**B-LA-E7-09-03 closes.** The ten-run history now identifies rows 4–8 by their retained per-run artifacts and explicitly marks the overwritten top-level log. Row 9 names `run-slot8-r2-run.log`; row 10 names `run-slot8-r2-final.log`. These match the raw log identities established in my Round 2 audit.

**B-LA-E7-09-04 closes.** The discovery proof now uses `QA_TASK=T6` / `QA_TASK=T5a,T8`, supplies the clean-clone SHA requirements, and distinguishes M2's nine specs from its one reported helper source. The current `run-k2.mjs:125` onward really asserts the 18/6 and 37/14 acceptance counts. B-01/B-02 remain closed; the later Slot 8b summary also records the repaired in-run M3-07-S8 as PASS.

| Final criterion | Independent check |
| --- | --- |
| AC-01 | D3 130 and D4 153 each have 8/8 host steps OK and three runs of 17 PASS, 0 FAIL, one expected DEMO skip. Durations are 186/195/187 s and 176/180/178 s; reset times match the report. |
| AC-02 | Rebuilt every legacy-group comparison from the original summaries. Accepted baseline T8 170 and candidate 137/160 match on all 23 IDs. Original 129's AC-T8-03/07/SUITE FAIL outcomes remain explicit; the initial cause is not asserted. D4 uses the authorized unchanged recovery 163 for T5a/T5b while retaining failed 158 and WE-F14. |
| AC-03 | Read all 12 raw health JSON files from the six T7 runs: 36 observations across app/LTI/content, all HTTP 200, profile default and empty knobs. Both START/END checks pass. |
| AC-04 | Read carried `qa-e2e-la-sim-r11-4f10c5fd-2026-10-24T16-14-27-776Z`: all 12 K2 U1–U4 cases and all 19 runner IDs pass. Independently resolved the K2 tree at product, QA test source and final gate source: each is `328d9ce24c0a8364224750d56d6a419fb5c04993`. The report correctly calls this carried evidence, not a new run. |
| AC-05 | Both accepted functional runs pass under the recorded LD-25/29/31/32 recovery and environment rulings. All 29 invocations, including failures/exclusions, have matching raw counts and times. Both kits have 195 ledger / 196 Vitest PASS results with correct same-wave inputs; both golden comparisons reproduce 297 approved changes. |

The shared audit rebuilt all 753 group-scoped result rows and all 297 golden response-path rows. The full actual T7 test trees match across 667 tracked paths; the selective e2e overlay explains their unused differences from the full gate tree. Other retained run clones match their declared test sources. D3/D4 therefore use identical effective suite content. Failed attempts are findings, not silent passes, and the approximately 42-second initial D3 event gap remains an accepted evidence limit. The new E7-08 carried-U1 citation MINOR is recorded only in that task's B-01; it does not alter this K2 or Moodle comparison.

Independent verification is in `/tmp/reviewer-b-regate-uqtfgkjb/`, especially `run-audit.json`, `per-id-audit.json`, `kits-health-carry.json`, `source-parity.json` and `boundary-trace-audit.json`; see my [E7-08 Round 1](../LA-E7-08/reviewer-b.md) for the shared audit details. The current change is QA evidence documentation, with no product/frozen assertion or UNIT behavior change. No Docker, stack, live runner, install or commit was used. Only the three assigned Reviewer-B reports were edited; blind review maintained.
