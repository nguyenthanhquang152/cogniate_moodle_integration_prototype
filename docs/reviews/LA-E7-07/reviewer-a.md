Verdict: APPROVE
Round: 1

# LA-E7-07 — Reviewer-A

## Round 1

Reviewed 2026-10-24 against the task spec, TEST-STRATEGY K2 U1–U4 and LA-ADR-05 D1. QA Round 5 on `af077681f360317760d9ca44d75688c6fa997b48` / product `a8bbac538cfe1e305f410279d7879421d64a5a1f` is supported by surviving raw results. One non-blocking oracle gap remains.

### Finding

**A-LA-E7-07-01 — MINOR — K2's card oracle ignores duplicate cards.**

- **Location:** `tests/e2e/ltiaas/01-u1-cards.k2.ts:48` and `:88`.
- **Problem/evidence:** Both cases use `.first()` for each manifest card and do not compare the complete rendered card set. An isolated host-browser probe executed the actual `U1.card-order` callback against synthetic DOM fixtures: correct five cards passed; missing and reversed cards failed; six cards with a duplicate Moodle card incorrectly passed. This weakens K2's standalone proof of AC-01's “one card per registered channel.”
- **Suggested fix:** Compare all rendered channel-card IDs with the registry's ordered IDs, or assert one matching card for every channel plus the complete set. Keep the existing text/action assertions. Add duplicate/unknown-card negative controls.
- **Why non-blocking:** The same final product has separate M2 `64/64` evidence using the approved `checkCards` oracle, which checks the complete attributed card set and rejects duplicates. This provides independent coverage of the gap; the K2 improvement can be recorded as deferred by the Lead.

### Acceptance and evidence

| AC | Assessment |
| --- | --- |
| 01 | PASS with the M2 supplement above: manifest card order, titles, descriptions and actions are checked for all five channels. |
| 02 | PASS: four U2 cases check create fields/Rule 1, dynamic/manual artifacts and tool rows, binding fields/defaults/approval authority, and substituted admin-step text. U3 additionally exercises successful enabling through the generic shell for both new channels. |
| 03 | PASS: generic dynamic and manual plus Brightspace manual flows reach browser Deep Linking, learner score 100 and the portal's Sent result. Generic foreign-host staging and a mismatched grant have explicit refusal controls. |
| 04 | PASS: launch-cookie removal is asserted; login and launch return 200, storage-check returns 303; simulator put/get records share a key at the expected storage origin; the runtime player frame opens. |
| 05 | PASS: wrong-origin/correct-message-id and correct-origin/wrong-message-id replies carry the captured state value. The page must still time out, show STATE_COOKIE_MISSING and the exact help text. Both spoof deliveries and removed cookies are asserted. |

Raw Round 5 accounting: **19/19 runner rows PASS**, **12/12 K2 cases PASS**, no skipped or missing K2 row. The same invocation includes the **5/5 M2 Canvas wizard slice**; the full **64/64 M2** run is a separate Slot 3F SIM run on the same final product, not 64 cases in the K2 invocation. Secret scan: 72 captured values, 30 checked files, 0 hits. All 32 protected volume records compare equal. These are raw facts, not a reclassification of older failed runs.

The seven committed file hashes in the Round 5 boundary record exactly match the reviewed runner, four U1–U4 specs, helper and manifest. Host verification: K2 coverage self-test **7/7 PASS**, including rejection of missing, skipped, failed and untagged results. Source inspection confirms substantive state/HTTP/DOM assertions in U2–U4. The extra card probe used a fresh headless Chrome context and synthetic HTML only; no stack or stack runner was started.

### Paths read

Repository: `docs/reviews/LA-E7-07/qa.md`; `tests/e2e/ltiaas/{01-u1-cards.k2.ts,02-u2-wizards.k2.ts,03-u3-new-channels-flow.k2.ts,04-u4-platform-storage.k2.ts,lib/k2.ts,coverage.mjs,coverage.selftest.mjs,manifest.json,run-k2.mjs}`; `tests/e2e/M2/01-cards.m2.ts`. Raw root `/Users/quangnguyen/cogniate-qa-runs/LA/`:

- `SLOT8E-R5-R10-QA-E2E/runner-repo/tests/host/artifacts/qa-e2e-la-sim-r10-af077681-2026-10-24T09-00-09-508Z/`: `summary.json`, `k2-case-results.json`, `k2-secret-scan.json`, `lane-boundary.json`.
- `SLOT8E-R5-R10-QA-E2E/boundary/`: `test-files-sha256.txt`, `before-32-baseline-volumes-inspect.json`, `after-32-baseline-volumes-inspect.json`.
- `SLOT3F/artifacts/qalead-la-60-a8bbac53-2026-10-24T05-29-27-881Z/`: `summary.json`, `m2-case-results.json`.
- `GATE/src-final-1/tests/e2e/M2/01-cards.m2.ts`; `GATE/src-final-1/tests/acceptance/lib/open-world.mjs` (approved M2 card oracle); `docs/reviews/LA-E7-08/qa.md` §12 in integration for the run binding.

Host evidence: `/tmp/la-reviewer-a-ctx-ec3c53d42903-evidence/{k2-coverage.log,k2-card-oracle.log,raw-audit.txt,raw-boundary-audit.txt,supplemental-audit.txt}`. Reproducer: `/tmp/la-reviewer-a-ctx-ec3c53d42903/reviewer-k2-card-oracle.mjs`. No integration product/test files changed and no other reviewer report was opened.
