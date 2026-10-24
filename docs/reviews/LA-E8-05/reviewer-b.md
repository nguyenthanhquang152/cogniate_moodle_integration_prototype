Verdict: APPROVE
Round: 3

# LA-E8-05 — Reviewer-B

Reviewed 2026-10-24 by Codex GPT-6-Astra xhigh. Lens: can the product team read the handover and find the proof behind each claim?

Scope: Docs commits `762ff28c` and `270df640`, integrated at `a400c78e8f4d7c7640cb3ec66871171f15148b73`. This review covers `spec-deviations.md` and the three human-review pages. The `add-a-channel.md` change in `270df640` belongs to LA-E8-01 and is outside this review. All four reviewed files matched the pinned commit during verification.

## Findings

### B-LA-E8-05-01 — BLOCKER — Complete the service-controls proof links

- **File:line:** `docs/human_review/ltiaas/index.html:156`; same issue at `docs/human_review/ltiaas/start-here.md:43`.
- **Problem:** The service-controls result lists several proved features, but links only three example QA reports, so AC-LA-E8-05-03's requirement to link every proof is not complete.
- **Evidence:** The linked LA-E5-03, LA-E5-09 and LA-E5-10 reports cover rate limits, key-provider status/re-wrap and signing-key lifecycle. The same result also claims audit, metrics and readiness. Their reports are LA-E5-02 and LA-E5-17; neither report is linked from the pack or its deviation list. The operator runbook gives AC labels for these features, but no links to these QA reports. A reader must derive a file path and search the repository. These proofs exist: LA-E5-02 records eight SIM checks and two UNIT ACs; LA-E5-17 records five SIM checks and two UNIT ACs. This is a missing evidence map, not a claim that the features failed QA.
- **Suggested fix:** Replace the example-only list with a complete, compact mapping from each service-control claim to its QA report and evidence label. It can be a short table on a linked detail page to keep the entry page short. Include accounts, operator API, audit, key lifecycle, revoke, retries, metrics and readiness as well as the three existing examples. Use the same mapping from the Markdown entry page.
- **Close check:** Starting from either entry page, each service-control claim has a link path to its named QA proof with the correct SIM or UNIT label, without guessing a task number or file path.

## Checks and evidence

| Check | Result |
| --- | --- |
| AC-01: deviations and D-rows | All six deliberate spec rows and all 15 D22–D36 rows are present, with behaviour, reason and evidence. Compared with the base contract §8/§8.1, A2's delta and conformance corrections. |
| AC-02: LA-IC status | All 23 ids are present: 21 built and two explicitly not built, awaiting LA-H22/LA-H4. The pack does not invent a Lead cut for those two open decisions. |
| AC-03: proof links and labels | One gap, B-01 above. The other sampled claims match the cited QA scope. SIM, K2, local MOODLE-LIVE and absent school-site LIVE evidence remain distinct. |
| AC-05: local entry page | PASS. Opened the actual `file://` entry page in a fresh headless Chrome context with networking blocked. Zero external requests and zero page errors; section navigation and the local decisions page open. |
| Local links | 177 link occurrences checked: no missing files, no missing anchor candidates, no external links. The existence check did not read the other reviewer's files. |
| Readability and layout | Short entry pages, two inline diagrams, clear headings and explicit decision options. Desktop and 390 px viewport have no page-level horizontal overflow. Desktop page and local decisions view were visually checked. |
| Gate reporting | The pack reports nine of eleven gate checks passing and names the two pending checks. It distinguishes the final product SHA from the wave-end build, discloses WE-F12, and does not promote per-task channel checks into a full kit PASS. |
| Ownership and regression | The assigned diff changes documentation only, within Docs ownership. No product behaviour or core paths change. This task has DOC ACs; no new UNIT test is required. |

The review used the task spec, charters, plan, LA-ADR-04 D8, both conformance summaries and the cited QA reports. No Docker, stack runner or product test was run. Browser tooling and temporary evidence stayed under `/tmp/reviewer-b-la-e8-05-r1`; `offline.mjs`, `offline.json`, `links.json` and screenshots record the checks. Only this review file was edited for this task. No commit was made.

The product owner selected LA-H25 option (a) in plan §6.2 after the reviewed snapshot. Refresh that decision in the handover when applying the fix; the kit and final double-run results must still remain pending until new evidence arrives.

Open findings: **1 BLOCKER, 0 MAJOR, 0 MINOR, 0 NIT**.

## Round 2

Reviewed 2026-10-24: Docs fix `8656e1c656735242c5a7899f3e681951b173dc7e`, integration `5610a68a`. **APPROVE**. B-LA-E8-05-01 is **closed**; one new MINOR wording finding is safe to defer.

### B-LA-E8-05-01 — CLOSED

Both entry pages now link to `service-controls.md`. Its 20 rows give the named QA report and the AC numbers by evidence level. I checked every row against its report: LA-E5-01 through -17, -21, -22 and -24. The previously missing audit and metrics/readiness reports are linked. SIM and UNIT ranges match the reports, including the split AC-12 API-key evidence, the U1 checks, and the local MOODLE-LIVE rows for isolation and app keys. The outbox-wait proof is also reachable through the page's `spec-deviations` link, D23 → LA-E4-03.

### B-LA-E8-05-02 — MINOR — Make the U1 definition cover both recorded starting builds

- **File:line:** `docs/human_review/ltiaas/service-controls.md:11`.
- **Problem:** The label definition says every U1 check starts from the intake build, but the app-key U1 check uses a later build from before that feature.
- **Evidence:** The linked LA-E5-08 report records `1b17261` → `4209dcb`. The linked LA-E5-22 report, lines 12 and 22, records `48bc1c9e` → `cd347224`; it calls `48bc1c9e` the parent of the app-key implementation. The row's SIM label and AC-01 result are correct. Only the shared explanation of the starting build is too narrow.
- **Suggested fix:** Say “a SIM check that upgrades an older stack to the candidate build; each QA report names both builds.” Keep the actual intake-build claim for LA-E5-08. This wording fix is safe to defer; the linked reports retain the exact evidence scope.

### Other checks

- D22 now distinguishes hard limits from the two soft account classes and lists the three exempt health/metrics paths. It also states that QA checked `/healthz`, keeping the design rule separate from that tested result. This matches contract delta §1.4 and the LA-E5-03 QA rows.
- LA-H25 is marked decided (a), consistent with plan §6.2. The kit and final double-run checks remain pending; a decision is not presented as a test PASS.
- The added step 10.2 citation in `add-a-channel.md` resolves to the kit README's “Full K1-SIM Run” heading. Both documented command forms match that section and its working-directory explanation from `29fcb01d`. No kit runner was executed.
- All six changed documents and all 20 cited service-control QA reports match `5610a68a`. Across the six documents, all 225 local link occurrences resolve, with no missing anchor candidates or external links. Other-reviewer file contents were not read.
- Reopened the HTML entry page in headless Chrome with networking blocked and followed its new proof-map link: zero external requests and zero page errors. The evidence table is readable, and the 390 px viewport has no page-level horizontal overflow. Evidence is in `/tmp/reviewer-b-la-e8-05-r2/` (`links.json`, `qa-pins.json`, `offline.json`, `offline.mjs`, `proved.png`).
- The diff stays within the assigned Docs files. No product code, tests or architecture were changed by this fix. No Docker or stack runner was used; this reviewer edited only this report and made no commit.

Open findings: **0 BLOCKER, 0 MAJOR, 1 MINOR, 0 NIT**. The Lead can record B-02 in the deferred list if it is not fixed now.

## Round 3

Reviewed 2026-10-25 by Codex GPT-6-Astra xhigh. **APPROVE**, with two MINOR reporting findings. Scope: Docs commits `d62c46e5`, `d1ff9081` and `2d3ffd74`, integrated at `05d823b8`; the six-file diff from `5610a68a`, including the assigned channel-guide changes. All six documents still matched the review pin at integration `695ecba8`.

### Earlier findings

- **B-LA-E8-05-01 remains closed.** Both entry pages retain the service-controls proof map. Its added direct LA-E4-03 AC-03 link makes the paused-outbox evidence easier to find.
- **B-LA-E8-05-02 is closed.** `service-controls.md:11` now defines U1 as an older-build upgrade and names both recorded starting builds correctly.
- **B-LA-E8-01-06 is closed by the assigned guide change.** `add-a-channel.md:370` now explains that L4 selects one foreign registration-level family per target. It also distinguishes the Moodle manual-self refusal from the other targets' warning/pass result. This matches the kit selector and assertions. The R3 explanation includes the manual-only owner start refusal and the known completion-error limit.

### B-LA-E8-05-03 — MINOR — Update the copied U1 counts with the corrected source table

- **File:line:** `docs/guides/ltiaas/spec-deviations.md:90`; repeated at `docs/human_review/ltiaas/start-here.md:37` and `docs/human_review/ltiaas/index.html:150`.
- **Problem:** The final-pack data-continuity row still presents separate LTI 19/19, app 18/18 and live U1/U2 36/36 counts. Those counts do not describe the cited executed records. A reader cannot reconcile the headline with the raw summaries.
- **Evidence:** The combined SIM run `qalead-la-13-80133d6b-2026-10-23T17-11-52-676Z` has 37 PASS and six INFO entries, covering 17 passing aggregate IDs for both services. The local Moodle run `qa-e2e-la-s8b-r1-a7bd110e-2026-10-24T01-31-21-479Z` has 16 PASS entries and 16 passing aggregate IDs, including preparation, host and continuity checks. I re-counted both raw summaries. LA-E7-08 QA §14.6 has now corrected these citations and explicitly withdraws the separate 19/18 split and the 36-check description; the three pack copies still have the earlier wording. This continues the reporting issue in B-LA-E7-08-01, not a missing functional test.
- **Suggested fix:** Update all three copies from the corrected §14.6. Either state the counts with their units and mixed scope, or use a short qualitative continuity claim linked to that table. Keep the explicit earlier-run/carry distinction. The final Docs follow-up needs this content correction as well as review-status labels.

### B-LA-E8-05-04 — MINOR — Remove obsolete general kit-pending claims

- **File:line:** `docs/guides/ltiaas/add-a-channel.md:403`; also lines 3, 405 and 439.
- **Problem:** The guide still says the LA-E7-06 simulator rows and the K1 run itself await QA, while its new step 9 reports the completed six-channel kit run. A maintainer cannot tell whether the documented command and kit are already verified or still untested.
- **Evidence:** LA-E7-06 QA Round 8 records the exact `npm --prefix tests run acceptance:api` command and a 195/195 execution ledger. Round 9 and LA-E8-02 QA Round 3 record the manual-only walkthrough channel and 234/234 passing ledger rows, which the guide itself cites at line 377. Its evidence-label definition at line 17 says “pending QA SIM” means QA has not run the row yet.
- **Suggested fix:** Link the completed kit evidence in the command table and remove the blanket historical pending statements. Keep the requirement to run the kit for each newly added channel. Keep any separately pending AC-LA-E8-01-02 guide validation clearly scoped; the completed kit evidence does not by itself settle that separate AC.

### Acceptance and evidence checks

| Check | Result |
| --- | --- |
| AC-01: deviations and D-rows | Six deliberate spec deviations and all 15 D22–D36 rows retain their spec/contract reference, behaviour, reason and QA link. D22 preserves the hard/soft limit distinction; D23 links the outbox-wait proof. |
| AC-02: LA-IC status | All 24 rows are present: 22 built with evidence and two explicitly not built, awaiting LA-H22/LA-H4. No Lead cut is invented. LA-IC-24 and the BD-A1-121 known limit are disclosed together. |
| AC-03: claims and evidence | Proof links and evidence levels remain complete. The two reporting corrections above are non-blocking. SIM, local MOODLE-LIVE, K2 and absent school-site LIVE proof remain distinct. |
| Final gates | Compared the claims with LA-E7-08 §14, LA-E7-09 Round 7, run-D4, the D3/D4 per-test-ID comparison, the three E0 gate reports, and both conformance summaries. The pack distinguishes final product `4f10c5fd` from first final runs on `a8bbac53`, and accepted results from earlier failed or excluded attempts. The 297-path golden comparison is described with approved changes, not as byte equality. |
| Kit and walkthrough | The five-channel 195-row ledger and six-channel 234-row ledger match LA-E7-06 R8/R9 and LA-E8-02 R3. The pack does not count the global rows twice or claim 39 executed cases for every channel. |
| Decisions and limits | LA-H25/H27 and LD-29–32 match plan §6.1/§6.2. WE-F12 and WE-F14 remain visible; the T8 earlier failures and later pass retain their evidence limits. Authorized pending review labels are not treated as missing QA. |
| AC-05: offline entry page | PASS in a fresh headless Chrome context with networking blocked: zero external requests, zero page errors, all seven section links work, and the proof-map and decisions links open local files. |
| Links and layout | All 297 local link occurrences across six documents resolve, with no missing anchor candidates. Other-reviewer targets were checked for existence only. Desktop and 390 px viewport have no page-level horizontal overflow; desktop and proof-table screenshots were inspected. |
| Scope and ownership | The assigned changes stay in Docs files. No product, core, test or architecture change is introduced. All remaining task ACs are DOC; no new UNIT test is required. |

Verification used a private clone pinned at `05d823b8`. Local artifacts are under `/private/tmp/la-e805-r3-review-b-vmfgkcoe/`: `offline.json`, `offline.mjs`, `links.json`, `links.py`, `u1-carry-records.json` and screenshots. No Docker, stack runner or integration dependency install was used. No other-reviewer file was opened. Only this review file was edited, and no commit was made.

Open findings: **0 BLOCKER, 0 MAJOR, 2 MINOR, 0 NIT**. B-03 and B-04 are safe to defer, but should be included in the planned final Docs refresh.
