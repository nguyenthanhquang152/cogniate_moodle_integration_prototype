Verdict: CHANGES_REQUESTED
Round: 1

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
