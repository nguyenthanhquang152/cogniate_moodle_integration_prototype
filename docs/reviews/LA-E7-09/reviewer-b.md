Verdict: CHANGES_REQUESTED
Round: 1

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
