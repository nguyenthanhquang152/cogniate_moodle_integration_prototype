Verdict: APPROVE
Round: 2

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
