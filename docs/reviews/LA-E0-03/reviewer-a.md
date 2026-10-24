Verdict: CHANGES_REQUESTED
Round: 1

# LA-E0-03 — Reviewer-A

## Round 1

Reviewed 2026-10-24 against the task spec, LA-ADR-04 D6/D8 and TEST-STRATEGY §4.5–4.7. QA Round 5's comparisons are reproducible, but they cover two complete channel transcripts, not the required three.

### Finding

**A-LA-E0-03-01 — BLOCKER — The golden baseline omits Moodle's required channel transcript.**

- **Location:** `tests/ltiaas/golden/capture.golden.ts:9`, `:193`, `:223`; `docs/reviews/LA-E0-03/qa.md:75` (AC-02).
- **Problem:** AC-02 requires G2 for each baseline channel; AC-03 requires the corresponding app transcript and per-channel pages. The design explicitly includes the Moodle-shaped standard provider. The capture instead creates only pending Moodle connections in G1 and runs the full script for Blackboard and Canvas. Thus a Moodle-specific wire or app-transcript regression can leave the compare green.
- **Evidence:** Both fresh G-BASE captures have G2/G3 keys exactly `blackboard, canvas`; G4 has `blackboard, canvas, common`. G1's Moodle keys are only `moodle-dynamic-pending` and `moodle-manual-pending`; no registered/connected/disabled Moodle DTOs are captured. `common` error pages do not supply the missing Moodle flow. The source promises a future version 2, but none exists; the Lead confirmed no approved scope exception. This also limits the three-channel U1 seed promised in the design, although AC-09's five statuses are present for both captured channels.
- **Suggested fix:** Add the Moodle-shaped standard flow and required status/page coverage, capture it on G-BASE and the candidate, and verify two fresh baseline captures plus negative controls. Update the QA AC rows and dependent golden/U1 claims to name the actual coverage. A future-version comment cannot close a Must AC.

### Acceptance and host checks

| AC | Assessment |
| --- | --- |
| 01 | PARTIAL: provider/health documents, tool rows, Canvas key forms and both other channels' status DTOs exist; Moodle has pending DTOs only. |
| 02–03 | INCOMPLETE: Moodle channel flow absent (finding above). |
| 04 | PASS for the stored coverage: fresh baseline captures compare equal; reviewer rerun 3 ms. |
| 05 | PASS for the captured documents: explicit drop reasons and deterministic normalization; both baseline metadata files record 128 checked secret values / 0 hits. Host normalization/secret tests pass. |
| 06–08 | PASS: 12/12 host tests, including changed-field CLI failure, absent/incorrect expected deltas and missing expected changes. Independent wave-end compare reproduces 280 explained differences / 0 unexplained / 0 missing in 20 ms. |
| 09 | PASS as written: each captured G3 channel includes sent, pending, failed, conflict and superseded score-sync rows. This does not make the missing Moodle transcript pass AC-02/03. |

Tests ran in `/tmp/la-reviewer-a-ctx-ec3c53d42903` with its own `npm ci`; no capture runner or stack was started. Reviewed capture/normalization/compare sources, `golden.k0.test.mjs`, the golden README and the 13 expected records loaded by the checks. Scope is QA-owned golden tooling; no product or frozen-test edit is proposed.

### Raw paths read

Root `/Users/quangnguyen/cogniate-qa-runs/LA/`:

- `LA-E0-03/r2-docker/golden-1/` and `golden-2/`: `G1.json`, `G2.json`, `G3.json`, `G4.json`, `meta.json` in each directory.
- `LA-E0-03/r2-docker/logs/compare-1-vs-2.txt` and `compare-stored-vs-1-port9443.txt`.
- `LA-E7-08/slot3b-80133d6b/logs/slot3b-1-golden-compare-port-aligned.txt`.
- `LA-E7-08/slot3b-80133d6b/golden-capture-80133d6b662dd4fb8e18a9eed62e3160d2b2a1c5/G1.json`.
- `LA-E7-08/slot3b-80133d6b/golden-capture-80133d6b662dd4fb8e18a9eed62e3160d2b2a1c5-port9443/`: `G1.json`, `G2.json`, `G3.json`, `G4.json` (loaded by the reviewer compare).

Repository baseline read: `tests/ltiaas/golden/1b17261be97c4701b928fa9dc2fa74c6d23028f6/{G1,G2,G3,G4,meta}.json`. QA report: `docs/reviews/LA-E0-03/qa.md`. Host logs: `/tmp/la-reviewer-a-ctx-ec3c53d42903-evidence/{golden-k0.log,golden-fresh-compare.log,golden-wave-compare.log,golden-raw-audit.txt}`.
