Verdict: APPROVE
Round: 2

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

## Round 2

Verdict: **APPROVE**. Reviewed 2026-10-24, Codex GPT-6-Astra xhigh, at `33c7f75a` against the dispatched diff from `762177dc`, the task spec, LA-ADR-04 D6/D8 and plan LD-7/9/29. **B-LA-E0-03-01 BLOCKER closes. Open: 0 BLOCKER, 0 MAJOR, 0 MINOR, 1 NIT.** The new Moodle expected-delta entries in LA-IC-01 and LA-IC-12 are also **APPROVED** under LD-9.

### Coverage and provenance

| AC | Result and independent evidence |
| --- | --- |
| 01 | PASS on the recorded baseline split. All five files under original G-BASE `1b17261be97c4701b928fa9dc2fa74c6d23028f6` match both `762177dc` and my Round 1 review pin byte-for-byte. All five stored v2 files under re-gate baseline `78971b0300ab171029e8ce94dbba30db37b23dea` match raw `golden-base-1` byte-for-byte. Moodle now has dynamic/manual pending plus registered, connected and disabled DTOs. README §1 clearly separates the two baselines and uses v2 for LD-29 comparisons. |
| 02 | PASS. All three channel transcripts are present. Moodle has two OIDC redirects and 29 simulator records covering auth, JWKS, Deep Linking, token audience/scopes and score bodies. All G2 data is equal between the new baseline and candidate `4f10c5fd9ca4dd0a5f636b34d7454e0db7b6849c`. |
| 03 | PASS. Each channel has the six publication scenarios, results/score-sync rows, Resend answers, connection and publication-list documents, 13 tool pages, seven player entries and learner labels. The completeness test now requires Moodle explicitly. |
| 04 | PASS. Raw `golden-base-1` (`qalead-la-110`) and `golden-base-2` (`qalead-la-111`) identify the same real `78971b03` SHA and separate runs; independent CLI compare gives zero differences in 2 ms. Their successful runner summaries record teardown with no owned resources left. |
| 05 | PASS. Normalizer and compare libraries are unchanged. Independent scan of all 33 golden files gives zero hits. Re-scanning raw captures against their retained run-secret inventories gives 184/184/185 distinct values checked and zero hits for baseline 1/baseline 2/candidate. No secret values were copied into this report. |
| 06 | PASS. Host self-compare takes about 25 ms; the real candidate comparison takes 17 ms, both below five seconds. |
| 07 | PASS. CLI negatives in K0 name the old/new values of a changed Moodle G2 endpoint and G3 score-sync status and exit 1. Separate reviewer probes also reject each exact field mutation. |
| 08 | PASS. Candidate versus v2 baseline gives 297 explained differences, zero unexplained and zero expected changes missing. Without expected deltas it fails. Removing each of the 17 new entries separately leaves one unexplained difference; applying each entry to an unchanged capture reports that expected change missing. |
| 09 | PASS. G3 in both baselines and the candidate contains all five sync statuses for each channel. The private U1 seed has three connection/publication groups and 15 correctly labelled state rows; file mode is `0600`. |

After aligning only the public port (`9643` → `9443`), v1-to-v2 has exactly six additions: the three Moodle G1 DTO keys and `G2.moodle`, `G3.moodle`, `G4.moodle`. Every existing path and value, including placeholders, is unchanged. This also rules out a hidden B/C difference on the previously captured paths.

The capture adds Moodle through the existing `channelSegment` and frozen M1 public helpers, with no product import or direct store access. Its baseline-only simulator host/SAN/alias overlay is explicit, confined to the temporary run clone, and records the original acceptance health response before the overlay. No tracked product, frozen-test or simulator file changes are in this review diff. This task has no UNIT-labelled AC.

### LD-9 additions

- **LA-IC-01: approve all 16 exact entries.** Four additive fields (`bindingAuthority`, `channel`, `channelCapabilities`, `channelName`) on each of three new G1 DTOs and `G3.moodle.connection`. Baseline values are absent; candidate values are exactly `self`, `moodle`, the already-approved Moodle capability object, and `Moodle`. This matches LA-ADR-04 D8 / LA-ADR-01 D3/D6/D11. No existing expected entry changed and no wildcard or type-only rule was added.
- **LA-IC-12: approve the one exact picker-text entry.** The candidate equals the baseline text plus ` Cancel`, as LA-ADR-05 D3a requires; no other text or placeholder changed.
- **No other record needs a new Moodle path for this script.** The only differences in the added Moodle sections are those 17. In particular, G2 is unchanged, the Moodle conflict message already names Moodle, and the existing Moodle tool-row NRPS change remains in LA-IC-04. The `canvas` family-refusal probe also stays equal.

### B-LA-E0-03-02 — NIT — Align the QA transcript counts and scope description with the saved files

**Location:** `docs/reviews/LA-E0-03/qa.md:18`, `:47`, `:85`.

**Problem/evidence:** Round 6 reports 16 Moodle, 17 Blackboard and 18 Canvas simulator records; all three saved v2 captures actually contain **29, 29 and 44**, respectively. It also says the Moodle token request asks for `lineitem` and `score`; its one token record contains only the AGS `score` scope. The zero-G2-difference conclusion is correct.

**Suggested fix:** Derive these counts and the scope description from the saved G2 files. This changes evidence wording only; capture coverage and comparison results remain valid.

### Verification record

Private fresh `git clone --no-hardlinks`: `/private/tmp/la-e003-r2-review-b-u6fwvlvu/repo`, detached at the review pin, own successful `npm ci`. Golden K0 **12/12 PASS**; root K0 **149/149 PASS** with Vitest cache cleared. Artifacts in its parent: `golden-k0.log`, `root-k0.log`, `golden-review.mjs`, `golden-review.log`, `golden-evidence-accounting.json`, `fresh-equality.log`, and `candidate.log`.

Raw evidence read under `/Users/quangnguyen/cogniate-qa-runs/LA/LA-E0-03-r2/`: `golden-base-1/{G1,G2,G3,G4,meta}.json`, the corresponding files in `golden-base-2/` and `golden-cand-4f10c5fd/`, and `u1-seed-baseline3-v2.json`. Secret scans also read each `qalead-la-{110,111,112}-work/infra/.secrets/` inventory and its `tests/acceptance/artifacts/{m1-secrets.raw,captured-secrets}.jsonl` in memory, reporting counts only.

I read the seven run summaries under `tests-final-3/host/artifacts/`: the two `qalead-la-110` attempts, `qalead-la-111`, and four `qalead-la-112` attempts. The first 110 capture failed because the certificate lacked `moodle.sim.test` (confirmed in its `cmd/10-golden-capture.log`); the recorded overlay addresses that failure. Three 112 attempts failed before capture because an incorrect full SHA did not resolve. The successful 112 summary and capture metadata identify the correct full SHA above. These failed attempts are not counted as successful captures or unexplained product flakes.

Only this review file was edited in integration. No Docker, stack-starting runner, commit, or other reviewer's report was used.
