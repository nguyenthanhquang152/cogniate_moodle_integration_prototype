Verdict: APPROVE
Round: 4

## Round 1

Reviewed 2026-10-24 by Reviewer-A (Codex GPT-6-Astra xhigh). Scope: the four LA-E8-05 documents from `762ff28c` and `270df640`, at integration `a400c78e`. The separate LA-E8-01 guide correction in `270df640` is outside this review. All four files still match that snapshot at review completion.

Open findings: **0 BLOCKER, 0 MAJOR, 1 MINOR**. This approves the accuracy of this review pack; it does not close the pending milestone gates or grant a human scope decision.

### A-LA-E8-05-01 — MINOR — Retain the soft account-limit exception

- **File:** `docs/guides/ltiaas/spec-deviations.md:32` (D22).
- **Problem:** The summary says `429 RATE_LIMITED` applies on every route class and includes accounts in its reason, but omits that account aggregate limits only log and never refuse.
- **Evidence:** Base `docs/architecture/contracts/lti-service-api.md:429` explicitly preserves that exception. The delta at `docs/architecture/ltiaas/contracts/lti-service-api-delta.md:107–115` makes `protocol_account` and `registration_account` soft and exempts health, readiness and metrics routes from limits. The cited E5-03 AC07 tests the non-blocking account behaviour.
- **Suggested fix:** Say that exhausted hard buckets return `429` with `Retry-After`, while account aggregate buckets only log and alert. Avoid implying that health, readiness or metrics routes are limited. This is a safe-to-defer wording correction; it does not change the tested product behaviour.

### Checks and evidence

- Compared the six deliberate spec deviations, all 15 D22–D36 rows, and all 23 LA-IC rows with the base contract, delta, LA-ADR-04 D8 and the conformance notes. The pack reports 21 built changes and two changes awaiting human decisions (LA-IC-07 and -08). It correctly avoids inventing a Lead cut for those two rows.
- Checked the cited QA rows, including grouped AC ranges, against their evidence labels. Simulator results are not presented as live LMS proof. The Moodle-live claims name the local Moodle stack and use the updated per-task results in LA-E7-08 §10.5. Final K2 evidence comes from LA-E7-07 round 5. Host-only rows remain identified as such.
- Cross-checked the gate totals and build ids: 9 of 11 gate ACs pass; the kit K1 and final double full run remain pending. M1, M2, golden, migration, snapshot and Moodle results retain their actual build ids. The pack discloses the T5b flake and the approved test changes.
- Opened `index.html` directly from `file://` in Chromium with the network disabled, at 1280 × 900 and 390 × 844. Both rendered seven sections with no page errors or horizontal page overflow. There were **zero HTTP(S) requests**. All 35 HTML links resolve locally; all 177 local links across the four documents have existing targets. Checked Markdown anchors without opening Reviewer-B files.
- Read the pack for secret and private-path exposure; found none. No product, architecture, core-path or test changes are part of these four files. The task has DOC criteria, not UNIT criteria.

Verification used the private clone `/tmp/la-review-a-ec32cc506f63`, pinned to `a400c78e`. Browser and link results are in `reviewer-pack-browser.json`, `reviewer-pack-static.json` and `reviewer-anchor-check.json` there. No Docker, stack, install or commit was used. Only this review file was written in the integration worktree.

**Later source update:** During this review, plan §6.2 recorded the product owner's LA-H25 option (a) decision at approximately 09:25Z. That decision postdates the reviewed pack. Refresh the pack's LA-H25 question to the chosen extra fix round when incorporating that decision; the kit and double-run evidence remain pending until executed.

## Round 2

Reviewed 2026-10-24 by Reviewer-A (Codex GPT-6-Astra xhigh). Scope: `8656e1c6`, integrated at `5610a68a`, including the kit README citation in `add-a-channel.md`. **APPROVE: 0 BLOCKER, 0 MAJOR, 2 MINOR.** A-LA-E8-05-01 is closed; the two findings below are new and safe to defer.

### Closure and checks

- **A-LA-E8-05-01 closed:** D22 now distinguishes hard buckets from the two soft account classes and exempts health, readiness and metrics routes. It correctly distinguishes the design rule from the `/healthz` QA check.
- Checked all 20 service-control rows against the linked task QA reports. All reports have PASS verdicts, and the listed AC numbers match their SIM, UNIT/K0, U1 and MOODLE-LIVE results. The two proof-map details below need correction; no failed or pending test was promoted to PASS.
- LA-H25 now records option (a), consistent with plan §6.2. The kit and final double-run gates remain pending. The task QA files now contain the cited Moodle-live updates from integration `29fcb01d`.
- The step 10.2 citation resolves to the kit README's “Full K1-SIM Run” section. Both documented command forms match: run `npm --prefix tests run acceptance:api` from the repository root, or run `node acceptance/run-api.mjs` from `tests/`. This was a citation check; no kit or stack runner was started.
- Repeated the offline `file://` browser check at desktop and mobile widths: zero HTTP(S) requests, page errors or horizontal page overflow; all 34 HTML links resolve. Across the six changed documents, all 225 local links resolve and checked Markdown fragments exist. No secret or private-path exposure found. All six integration files match the reviewed snapshot.

### A-LA-E8-05-02 — MINOR — Do not give both U1 checks the intake baseline

- **File:** `docs/human_review/ltiaas/service-controls.md:11`.
- **Problem:** The shared U1 definition says the old stack is the intake build, but the app key-ring row uses a later old build.
- **Evidence:** `docs/reviews/LA-E5-08/qa.md:22` records the LTI upgrade from intake `1b17261` to `4209dcb`. In contrast, `docs/reviews/LA-E5-22/qa.md:12` and AC01 at line 22 record the app upgrade from `48bc1c9e` to `cd347224`. The app source changed substantially between the intake and `48bc1c9e`.
- **Suggested fix:** Define U1 as an upgrade from the old build named in the QA report. Name the two source builds beside their rows if useful. The existing SIM results and linked QA reports remain valid.

### A-LA-E8-05-03 — MINOR — Cite the outbox wait proof in its row

- **File:** `docs/human_review/ltiaas/service-controls.md:19`.
- **Problem:** The platform-throttling row includes “the record outbox waits,” but its only QA link proves the LTI error mapping, not the outbox delay.
- **Evidence:** LA-E5-14 AC01–06 cover the returned status, `Retry-After`, error body, logging and absence of automatic LTI-client retry. The actual outbox proof is `docs/reviews/LA-E4-03/qa.md:21`, AC-LA-E4-03-03: the row stays pending with unchanged tries and the next POST waits at least 30 seconds. The pack already links this proof in D23 of `spec-deviations.md`, so this is a local citation gap, not missing test evidence.
- **Suggested fix:** Add the LA-E4-03 QA link and `[SIM E4-03-03]` to this row, or limit the row's claim to the behaviour proved by LA-E5-14.

Verification artifacts: `/tmp/la-review-a-510122d81442/reviewer-qa-map.json`, `reviewer-pack-browser.json` and `reviewer-links.json`, from a private `--no-hardlinks` clone pinned to `5610a68a`. No Docker, stack, install or commit was used. Only this review file was changed in the integration worktree; Reviewer-B files were not opened.

## Round 3

Reviewed 2026-10-25 by Reviewer-A (Codex GPT-6-Astra xhigh). Scope: Docs parts 1–3 (`d62c46e5`, `d1ff9081`, `2d3ffd74`), integrated at `05d823b8`, using the dispatched six-file diff from `5610a68a`. **CHANGES_REQUESTED: 0 BLOCKER, 1 MAJOR, 1 MINOR, 0 NIT.** The pending review labels are expected for this snapshot; they are not findings.

### A-LA-E8-05-04 — MAJOR — Correct the copied U1 evidence counts in the pack

- **Files:** `docs/guides/ltiaas/spec-deviations.md:90`, `docs/human_review/ltiaas/start-here.md:37`, `docs/human_review/ltiaas/index.html:150`.
- **Problem:** All three pages report U1 as LTI 19/19 plus app 18/18, and live U1/U2 as 36/36. These are the unsupported claims already identified in A-LA-E7-08-01. A “reviews in progress” label does not make those counts evidence.
- **Evidence:** A fresh read of `qalead-la-13-80133d6b-2026-10-23T17-11-52-676Z/summary.json` gives one combined U1 run: **43 entries, 37 PASS and 6 INFO**, covering the LTI and app criteria. It does not establish the advertised 19/18 split. The actual live continuity record, `qa-e2e-la-s8b-r1-a7bd110e-2026-10-24T01-31-21-479Z/summary.json`, has **16 PASS entries** on the earlier `8fadb828` product, not 36. The complete paths and source SHAs are recorded in [LA-E7-08 Reviewer-A Round 1](../LA-E7-08/reviewer-a.md#round-1) and the private `reviewer-u1-evidence.json` from this review. The valid migration 12/12, snapshot 6/6 and drill 10/10 records are separate.
- **Suggested fix:** Propagate the corrected gate evidence into all three pack pages: give the combined U1 result, the actual live continuity result, and links to their corrected QA records. Retain the carried-evidence qualification and earlier source builds. The next Docs diff must include these corrections as well as verdict labels; a label-only edit cannot close this finding. No new stack run is needed.

### A-LA-E8-05-05 — MINOR — Keep all conditions of the R3 complete-refusal branch

- **File:** `docs/guides/ltiaas/add-a-channel.md:375`.
- **Problem:** The second R3 bullet says an owner with Dynamic Registration and a target with admin endpoints are sufficient for refusal at `complete`. It omits the required `registration` guard level and the owner's `any-https` endpoint rule.
- **Evidence:** `tests/ltiaas/kit/lib/fixtures.ts:1856` rejects other guard levels; lines 1863–1865 require Dynamic Registration, an `any-https` owner, and an admin-endpoint target. The shipped Canvas fixture has Dynamic Registration but a `launch` guard. The committed Round 9 branch table (`kit.k0.test.ts:2605`, and LA-E7-06 QA R9.3) therefore gives `canvas:start` on both Moodle and `lti-generic`, where the guide's bullet predicts `complete`. The pack's own `spec-deviations.md` §7 correctly preserves this exception.
- **Suggested fix:** State all four conditions, with start refusal for the other cases, or explicitly limit the bullet to the `registration`-guarded, `any-https` owner described by the template. Safe to defer: the kit remains strict and the manual-only walkthrough case is documented correctly.

### Closures and acceptance checks

- **A-LA-E8-05-02 and -03 closed.** The service-control map now names the distinct U1 source builds (`1b17261` and `48bc1c9e`) and cites LA-E4-03 AC-03 for the outbox wait. These match the task QA reports. The corrected L4 sentence also resolves the wording of A-LA-E8-01-07: one selected foreign registration-level family per target, with Moodle's manual-self refusal distinguished from warn/pass-through.
- **AC-01/02:** all six spec-deviation rows retain the spec section, behaviour, reason and QA link; D22–D36 match the contract delta. All 24 LA-IC rows have a status: 22 built, two awaiting the recorded human decisions. LA-IC-24 and BD-A1-121 are disclosed as a built change with a known limit. No new human decision is invented.
- **AC-03:** checked the final claims against E7-08 §14 and Final state, D4, the per-ID/path table, E7-09 Round 7, E0-01/02/03 QA and Reviewer-A records, kit Rounds 8–9, walkthrough Round 3, A1/A2 conformance, plan §6.1/6.2 and WE-F14 in the deferred list. The U1 finding above remains. Otherwise the final product `4f10c5fd`, historical `a8bbac53`, test source `794f649c`, LD-32 kit source `99338e52` and kit tree `d7e50b5d` agree. Git confirms the small product delta and zero product diff for the kit source.
- The pack preserves the 297 approved golden changes (LA-IC counts 275/3/3/13/2/1), rather than calling them equality. M1 394/394, M2 64/64, T7 three runs of 17 plus the demo skip, and kit 195 ledger rows/196 Vitest tests per run match the committed evidence. The six-channel walk result is 234 ledger rows. H1/PRE aborts, the rejected M1 overlap, raw M3 host failures, the zero-test kit attempt, WE-F14, the original baseline T8 differences, and the 42-second event-capture gap remain visible. No failed attempt is promoted to PASS.
- Simulator, local MOODLE-LIVE and real-site LIVE scope remain distinguished. The pack claims no real Canvas, Blackboard, Brightspace or other new-LMS site result. Historical task evidence and carried K2 evidence are identified as such. The source review labels may be updated after the outstanding reviews finish.
- **AC-05:** opened `index.html` through `file://` in headless Chrome with the browser offline and HTTP(S) routes blocked, at 1280 × 900 and 390 × 844. Both render seven sections, with **zero HTTP(S) requests, page errors or horizontal page overflow**. All 47 HTML links resolve. Across the six documents, all **297 local links** and checked fragments resolve. No secret or personal local-path exposure found; `/tmp/kit-run` is the documented example output path.

Verification artifacts: `/tmp/la-reviewer-a-ctx-a23bc39c36c0/reviewer-pack-browser.json`, `reviewer-pack-static.json`, `reviewer-u1-evidence.json`, the browser/static scripts, and screenshots. This private `git clone --no-hardlinks` is pinned to `05d823b8`; all six integration documents still matched it at completion. The task has DOC criteria, not UNIT criteria (AC-04 was removed). The dispatched guide changes are within the explicit scope; no product or architecture edit is part of the Docs commits. No Docker, stack runner, install or commit was used, and Reviewer-B files were not opened. Only this review file was changed in integration.

## Round 4

Reviewed 2026-10-25 by Reviewer-A (Codex GPT-6-Astra xhigh). Scope: Docs fix `6ed4204a`, integrated at `c3dc85ab`; dispatched diff from `c21bb1db` (five documentation files). **APPROVE: 0 BLOCKER, 0 MAJOR, 0 MINOR, 0 NIT.** No open Reviewer-A findings remain.

- **A-LA-E8-05-04 closed.** All three pack copies now give the combined SIM U1 result: 43 entries, 37 PASS and 6 INFO, with 17/17 aggregate IDs PASS. A fresh read of the raw `qalead-la-13` summary confirms those counts. The live `qa-e2e-la-s8b-r1` summary confirms 16/16 PASS entries and IDs. The pages link corrected LA-E7-08 §14.6, retain the earlier source builds and carried-evidence qualification, and keep migration 12/12 per side, snapshot 6/6 per side and drill 10/10 separate. They claim no new continuity run on `4f10c5fd`.
- **A-LA-E8-05-05 closed.** Step 9 now requires all four conditions for refusal at `complete`: registration-level guard, owner Dynamic Registration, owner `any-https` endpoints and target admin endpoints. The other cases refuse at `start`. This matches `drFamilyGuardRefusedAtComplete` and its K0 branch table, including Canvas and the manual-only walkthrough channel.
- The replacement approval labels match Reviewer-A's E7-08 R2, E7-09 R7, E0-01 R2, E0-02 R7 and E8-01 R5 reports. Reviewer-B approval status was checked against the coordinator's supplied status, without opening Reviewer-B files. The guide identifies its post-R5 edits as subject to E8-05 review. The new E7-02 SIM citation has a corresponding PASS row; the five-channel 195/195 and six-channel 234/234 kit claims match the cited QA evidence. The guide still discloses that E8-01 AC02 has no separate QA record and requires a new kit run for each new channel. No failed or unverified result is promoted to PASS.
- Repeated the offline browser check at 1280 × 900 and 390 × 844: seven sections, zero HTTP(S) requests, page errors or horizontal page overflow. All 48 HTML links and all 309 local links across the six pack/guide documents resolve, including checked fragments. The six deviation rows, 15 D-rows and 24 LA-IC statuses remain intact. Prior failure disclosures, evidence limits and pending human decisions are preserved.

Verification used private `git clone --no-hardlinks` `/tmp/la-reviewer-a-ctx-6be1d571d271`, pinned to `c3dc85ab`; artifacts are `reviewer-pack-browser.json`, `reviewer-pack-static.json`, `reviewer-u1-evidence.json`, scripts and screenshots there. The integration documents still match that snapshot. The task has DOC criteria; no product, architecture or test file changed in the Docs commit. No Docker, stack runner, install or commit was used. Only this review file was changed in integration.
