Verdict: CHANGES_REQUESTED
Round: 1

# LA-E0-03 — Reviewer-B

## Round 1

Reviewed 2026-10-24 at `4e6a41f3`, against the task spec, LA-ADR-04 D6, TEST-STRATEGY §4.6–4.7 and plan LD-7/9. **1 BLOCKER; 0 MAJOR, MINOR or NIT.** Comparison and negative controls work; the capture does not cover all three baseline channels.

### B-LA-E0-03-01 — BLOCKER — The promised Moodle golden segment is still absent

**Location:** `tests/ltiaas/golden/capture.golden.ts:9` and `:223`; `tests/ltiaas/golden/golden.k0.test.mjs:110`.

**Problem:** AC-01/02/03 are reported PASS although Moodle has only pending connection DTOs and configuration rows, with no full G2–G4 flow capture.

**Evidence:** The task requires the fixed script per baseline channel, including Moodle-shaped standard. The implementation explicitly postpones Moodle G2/G3 to version 2 and runs `channelSegment` only for Blackboard and Canvas. Both fresh-stack captures and the committed baseline have G2/G3 keys `blackboard, canvas`, G4 keys `blackboard, canvas, common`, and only `moodle-dynamic-pending` / `moodle-manual-pending` in G1 connections. `common` contains channel-free error pages; it does not supply the missing Moodle transcript/player/learner coverage. The completeness test checks only the same two channels, so 12/12 K0 and an equal compare cannot detect the omission. The coordinator confirmed no approved reduction of this scope and no version 2 capture.

**Suggested fix:** Add the Moodle-shaped fixed script, required connection states and G2–G4 documents; require all three baseline channels in the completeness check; capture and compare it twice on G-BASE with the agreed QA overlay. Alternatively obtain an explicit scope decision and identify equivalent evidence. Keep the affected ACs open until resolved; do not describe a two-channel equality as the full golden contract.

### Acceptance and host verification

| AC | Review result |
| --- | --- |
| 01–03 | Existing API documents and Blackboard/Canvas transcripts are present; Moodle scope incomplete as above. |
| 04 | Re-compared the two saved fresh-stack captures: equal, zero differences, 3 ms. Their metadata names distinct projects and the same `1b17261` SHA. |
| 05 | Reviewed one explicit drop list, deterministic ids/times/tokens/key ordering and secret scan. Host tests reject planted secret/JWT/random values; saved metadata records 128 values checked and zero hits per fresh capture. |
| 06–07 | CLI self-compare takes 24 ms; changing one field fails with its path and old/new values. |
| 08 | Named differences pass, unnamed changes fail, unused expected changes fail. Repeated the wave-end compare: 280 explained differences, zero unexplained/missing, 20 ms. |
| 09 | G3 results in both fresh captures contain all five score-sync states for both implemented flows. |

Private clone `/private/tmp/la-closeout-review-b-_nb5xdcj/repo`, own `npm ci`, no Docker: `node --test tests/ltiaas/golden/golden.k0.test.mjs` **12/12 PASS**. This includes the field mutation, missing expected change and exact expected-value negative controls. Review evidence: `/private/tmp/la-closeout-review-b-_nb5xdcj/golden-tests.log`, `golden-evidence.json`, `golden-fresh-compare.log`, `golden-wave-compare.log`.

### Raw paths read

Under `/Users/quangnguyen/cogniate-qa-runs/LA/LA-E0-03/r2-docker/`: each of `golden-1/G1.json`, `golden-1/G2.json`, `golden-1/G3.json`, `golden-1/G4.json`, `golden-1/meta.json`, the corresponding five files in `golden-2/`, and `logs/compare-1-vs-2.txt`, `logs/compare-stored-vs-1-port9443.txt`.

Under `/Users/quangnguyen/cogniate-qa-runs/LA/LA-E7-08/slot3b-80133d6b/golden-capture-80133d6b662dd4fb8e18a9eed62e3160d2b2a1c5-port9443/`: `G1.json`, `G2.json`, `G3.json`, `G4.json` (read by the repeated compare; G1 also used for the isolation response-envelope probe).

Also read the committed baseline's five JSON files, capture/compare/normalizer/test sources, README and expected-delta inputs. The finding concerns missing capture scope, not missing raw files or an unproved product regression. No product/frozen-test edits, stack or commits; no Reviewer-A report read.
