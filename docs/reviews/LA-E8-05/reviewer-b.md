Verdict: APPROVE
Round: 2

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
