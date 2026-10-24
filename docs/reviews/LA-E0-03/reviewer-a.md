Verdict: APPROVE
Round: 2

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

## Round 2

Reviewer: Codex GPT-6-Astra xhigh, 2026-10-24. Reviewed `9ca8bb20`, `5e2579a0` and `d1603f4d`, integrated at `33c7f75a`, against the task spec, LA-ADR-04 D6/D8, LA-ADR-01's capability and binding rules, LA-ADR-05 D3, and LA-H27 / LD-29. **APPROVE: 0 BLOCKER, 0 MAJOR, 1 new MINOR, 0 NIT.** `A-LA-E0-03-01` is closed on the authorized new baseline. Reviewer-A also approves the 17 new LD-9 expected-delta entries in LA-IC-01/12.

### Baseline and acceptance checks

The original v1 folder `1b17261be97c4701b928fa9dc2fa74c6d23028f6` is byte-exactly restored relative to `762177dc`, including its metadata. It remains the historical, incomplete Moodle capture described in Round 1. The complete v2 baseline is correctly stored under **`78971b0300ab171029e8ce94dbba30db37b23dea`**, as authorized by LA-H27 / LD-29; all five stored files equal raw `golden-base-1`. This closes the gap through the approved baseline change, not by claiming the old SHA had a complete Moodle transcript. README §1 and §3 distinguish the historical record from the re-gate comparison baseline.

| AC | Assessment |
| --- | --- |
| 01 | PASS on the authorized v2 baseline. G1 retains the provider/health documents, tool rows and both Canvas key forms. Moodle now has dynamic/manual pending DTOs and registered, connected and disabled DTOs with the corresponding observed status values. |
| 02 | PASS. G2 now contains Moodle, Blackboard and Canvas OIDC parameters and simulator transcripts. Moodle has auth, JWKS, Deep Linking, token/audience/scope and score records; its G2 is equal between baseline and candidate. Correct record counts are given in the MINOR finding below. |
| 03 | PASS. Each channel has six publication scenarios, results and score-sync rows, three Resend outcomes, the connection and publication list. Moodle adds 13 tool-page captures, seven player entries and learner labels. |
| 04 | PASS. Fresh projects `qalead-la-110` and `qalead-la-111` both identify product `78971b03`; their completed captures compare equal with zero differences in **3 ms**. The successful capture/secret-scan/output/teardown rows are present in both runner summaries. |
| 05 | PASS. Normalization and its reasoned drop list are unchanged. Repeated secret scanning using the actual private capture inputs: **184, 184 and 185 distinct secret values**, respectively, with zero hits in the two baselines and candidate. Scanning all **33 repository golden files** against the combined values and token/key patterns also gives zero hits. Secret values were not printed or copied into the report. |
| 06–08 | PASS. Golden host tests **12/12**, including CLI failures naming the changed Moodle G2 endpoint and G3 score status with old/new values. The candidate compare takes **18 ms**, reporting **297 differences, 0 unexplained, 0 expected changes missing**. Independent controls for every new expected entry are described below. |
| 09 | PASS. All three channels' public results contain sent, pending, failed, conflict and superseded rows. The private U1 seed has all three connection/publication groups and **15 rows**, three for each status, with mode **0600**. |

After aligning only the public port (`9643` to `9443`), an independent v1-to-v2 baseline diff contains exactly six additions: three Moodle connection DTOs and the Moodle G2, G3 and G4 sections. No existing v1 field or id placeholder changes. The runtime clones identify the two real product SHAs (`78971b03` and candidate **`4f10c5fd9ca4dd0a5f636b34d7454e0db7b6849c`**) and have no app/service/package/database source modifications.

### LD-9 review: LA-IC-01 and LA-IC-12

- **LA-IC-01: approve all 16 additions.** They add exactly `channel: "moodle"`, `channelName: "Moodle"`, `bindingAuthority: "self"` and the complete Moodle capability object to each of the three new G1 connection states and `G3.moodle.connection`. Every field is absent in the baseline, and every value equals the candidate. The capability objects equal the already approved pending-Moodle object, including the four AGS scopes, single-select behavior and legacy self binding. These are the additive DTO fields authorized by D8; no baseline field is rewritten.
- **LA-IC-12: approve the one addition.** `G4.moodle.pages.picker.text` is exactly the baseline text plus ` Cancel`, as required by D8 and LA-ADR-05 D3. All other words and normalized ids are equal.
- Existing entries in both files remain unchanged; the matching `ld9.goldenFields` lists add the same 17 paths. Every new entry uses an exact value, with no wildcard or type-only rule. With the old records, the real candidate has **exactly these 17 unexplained paths** and no missing expected change. With the new records, all 297 differences are explained. Independently changed each new value, then removed or reverted each expected change: **34/34 controls reject the candidate**, including missing-change detection.
- No other LA-IC file needs a new Moodle path for this script. G2 is unchanged; its Moodle token request uses the same two AGS scopes on both SHAs, so LA-IC-04 gains no transcript entry. The Moodle conflict text already names Moodle, so LA-IC-15 gains none. The family-mismatch page probes Canvas and is unchanged, so LA-IC-24 gains none. The complete diff contains no additional Moodle difference to explain. The unchanged v1 paths also exclude hidden B/C changes from these additions.

### A-LA-E0-03-02 — MINOR — QA lists incorrect G2 record counts

- **File:** `docs/reviews/LA-E0-03/qa.md:18` and `:47` at `33c7f75a`.
- **Problem:** The new summary says Moodle has 16 simulator records, and the AC02 row gives Moodle/Blackboard/Canvas counts of 16/17/18.
- **Evidence:** The committed v2 baseline and both raw baseline captures contain **29 Moodle, 29 Blackboard and 44 Canvas** records. The candidate has the same counts. Moodle's 29 are 15 auth, one JWKS, one Deep Linking, one token and 11 score records. Coverage and comparison pass; the prose does not describe the stored evidence accurately.
- **Suggested fix:** Derive the displayed counts from each `G2.<channel>.records.length`, or omit fixed counts. Safe to defer because no transcript data or assertion is missing; the Lead should record the finding if deferred.

### Capture boundary and verification record

The capture uses public APIs, tool pages, simulator records and the existing M1 helpers; no product module or database is imported. The baseline-only runtime overlay adds `moodle.sim.test` to the simulator alias and allowlist setup. It changes only the two disclosed infra files in the disposable baseline clones; the runner captures the original acceptance health response before that overlay. The candidate needs no overlay. No frozen helper, simulator or product file changes in these commits; all committed changes stay in the task's golden tooling and QA report.

The raw root retains an earlier failed baseline capture and three candidate clone failures. They are not counted as successful captures or converted to PASS here. The two completed baseline captures and completed candidate capture have their own summaries and output metadata. This review verifies those captures and the host comparison; it is not a final double-run gate verdict.

Private host clone: `/tmp/la-reviewer-a-ctx-9f50c44c3c78`, made with `git clone --no-hardlinks`, pinned to `33c7f75a`, with its own `npm ci`. Besides golden **12/12**, root K0 passes **149/149**; its private Vitest cache was cleared first. Independent reproducer: `reviewer-golden-audit.mjs` in that clone. Logs: `/tmp/la-reviewer-a-ctx-9f50c44c3c78-evidence/` (`golden-k0.log`, `fresh-compare.log`, `candidate-compare.log`, `root-k0.log`, `raw-capture-audit.json`, `independent-audit.log`).

Raw evidence: `/Users/quangnguyen/cogniate-qa-runs/LA/LA-E0-03-r2/` (`golden-base-1/`, `golden-base-2/`, `golden-cand-4f10c5fd/`, the U1 seed, and `tests-final-3/host/artifacts/` summaries for the completed `15:45:15.561Z`, `15:47:55.004Z` and `15:54:40.762Z` runs). No Docker, stack, capture runner or commit was run. Only this Reviewer-A file changed in integration; no Reviewer-B file was opened.
