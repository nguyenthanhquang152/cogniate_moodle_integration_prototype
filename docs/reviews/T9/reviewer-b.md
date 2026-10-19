Verdict: APPROVE
Round: 1

# T9 review — Reviewer-B (lens: the readers)

Scope: the hand-over pack at `2129b69`: `README.md`, `docs/guides/**`, `docs/human_review/**` (START-HERE, proven, decisions-needed, deferred, flows, PLAN, `explainer.html`, `video/script.json`). Spec: `docs/architecture/tasks/T9.md`. Readers: the Vietnamese product team (English as a second language) and a new engineer.

Known and not a finding (Lead): T8 is still QA-pending.

| Severity | Count | Ids |
| --- | --- | --- |
| BLOCKER | 0 | — |
| MAJOR | 0 | — |
| MINOR | 2 | B-T9-01, B-T9-02 |
| NIT | 2 | B-T9-03, B-T9-04 |

Summary: This is a good pack for its readers. It is short, honest about what QA did not prove, and easy to follow. The two MINORs are one stale status (the docs say less than QA proved) and the most important decision, which a reader cannot answer from the page alone.

## What I checked

- I read README, START-HERE, run-the-stack, moodle-admin, teacher, troubleshooting, proven, decisions-needed and flows in full. I read the start of learner-view, native-channel, deferred and PLAN, and the explainer structure and its `pack-data` JSON.
- STE (AC-T9-04): I measured with a script. Procedure lines (numbered steps) must be ≤ 20 words, and other sentences ≤ 25. I split table cells, and inline code counts as one word. Results:
  - Markdown: 186 procedure sentences and 862 descriptive sentences. Only two are over the 20-word procedure limit: `flows.md` lines 42 and 172, both 21 words. They describe diagram steps, not actions for the reader, so the descriptive limit applies, and they pass.
  - Explainer text (`pack-data`, 3,256 words): 330 sentences, none over 25 words.
  - Video narration (EN): 43 sentences, the longest 23 words (a list).
  - WARNING comes before each delete (run guide lines 47 and 96) and NOTE is used for information, as inputs §7 says.
  - **Reviewer-B confirms AC-T9-04.**
- Commands, links and paths: all 18 `npm run …` commands exist in `package.json`. All relative links, `#anchors` and repo paths exist. The `.env` names in the run guide (`MOODLE_STUDENT_PASSWORD`, `PORTAL_THANH_PASSWORD`) exist in `gen-env.sh`.
- Numbers against T7 qa.md: 36 s `e2e:reset` and 9.3 s `demo:prepare` (AC-T7-15), 188/189/186 s, grades in 3.4–3.9 s, and 28 captured secrets with 0 in the logs. All match.
- The default stack only pulls images (`node`, `caddy`, `postgres`, `erseco/alpine-moodle`), so "with the images already pulled" is true for a new Mac.
- A term sweep: a read-only helper stopped at the API session limit, so I did spot checks only. The guides, the flows and the explainer glossary use the same names for the people (Cogniate user, Moodle admin, teacher, learner) and the things (connection, publication, library, "Select content").

## The readers' questions

- **START-HERE gives a clear 30-minute path:** Yes. Five rows (3 + 3 + 8 + 5 + 10 = 29 min), and each row links to a file that exists. The page has the story in five steps, a two-column "Works / Not proven yet" table, and the four most important decisions. "How this was built" tells the `rea` decision and the agent team in three short bullets.
- **Decisions are answerable:** Mostly. Each row has the question, our recommendation, what it blocks and who decides. "Until you decide, the prototype uses our recommendation" removes pressure. The explainer tab has "Copy my answers". The rows for the CTO or engineering use technical words (KMS, SLA, `pointer-events`), which is acceptable for those readers. Q1 is the exception (B-T9-02).
- **A new engineer can follow run-the-stack without help:** Yes, on paper. It has prerequisites with the QA versions, nine numbered steps, a result for each procedure, a WARNING before each delete, the "yes" question (step 7, "When the command asks"), and a link to "Debug a failed E2E step". It also lists honestly what QA did not verify (`demo:browser`, port 443, the "yes" question). The real proof is the human test AC-T9-01 / HR-2, and the pack says that it is open.
- **Diagrams over prose:** Yes. `flows.md` has five Mermaid sequence diagrams, each with numbered step text and a proof line. The explainer shows the same flows. It is one offline file (no CDN, no web font, no network requests), with a `<noscript>` line that points to the Markdown files.
- **Does not overwhelm:** Yes. The product path is about 3,000 words plus a 2.6-minute video (EN, and a VI version marked "machine-translated, please check", decision HR-1). `deferred.md` says "This list is for engineers. A product person can skip it."
- **Honest:** Yes. Every guide has a "Not verified by QA" list. `proven.md` has the sections "Pending final QA" and "Not proven", with the decision for each row. The Moodle labels in the teacher guide are the T9 path exactly, and so is the admin guide (AC-T7-14).

---

## Findings

### B-T9-01 — MINOR — Q-T7-01 and Q-T7-02 still show "Pending QA", but QA verified them

- **Location:**
  - `docs/human_review/proven.md` line 40 (§2 row "T6, T7 … The next QA run checks them").
  - `docs/guides/moodle-admin.md` line 76 (`[Pending QA]`) and line 109.
  - `docs/guides/teacher.md` line 63.
  - `docs/human_review/deferred.md` lines 7–12 (section "Fixed after the last QA run (QA pending)", with the count "6 MINOR" on line 5).
  - `docs/guides/troubleshooting.md` lines 27–28 (column "Verified by QA": "finding Q-…").
  - The explainer `pack-data` (the same "QA pending" / "next QA run" texts).
- **Problem:** `docs/reviews/T7/qa.md` §6 (in `42287a5`, before this pack) has the row "Q-T7-01, Q-T7-02 fixed on main". The suite now checks the teacher hint against the Moodle 5.2.4 path, and the manual form "now has no difference". The validation run at `f0e5525` passed in a fresh clone (17 passed, 0 failed). So the pack says less than QA proved. A reader sees "Pending QA" on two steps that are now proven. `deferred.md` counts two closed MINORs as open.
- **Suggested fix:**
  - Tag the two texts with the QA proof (for example "[AC-T7-14, T7 qa.md §6]").
  - Remove the row in `proven.md` §2 and the `[Pending QA]` tag. If no row uses the tag in `moodle-admin.md` line 10, remove that line too.
  - Move Q-T7-01 and Q-T7-02 out of `deferred.md` and change the count to 4 MINOR.
  - Make the same changes in the explainer data.

### B-T9-02 — MINOR — The Q1 decision (legal claim) cannot be answered from the page

- **Location:** `docs/human_review/decisions-needed.md` line 13. The same text is in the explainer `pack-data` decision "Q1". START-HERE lists Q1 first in "The four most important".
- **Problem:** The recommendation says "Use only the narrow claim of ADR-003". It gives no link and no words of that claim. Legal or the product owner must find `docs/architecture/adr/ADR-003-…md` alone. They then read a long technical sentence (ADR-003 line 44: endpoints, header schemes, contract §8, double-encoded line item ids). The "do not say" rules are also only in the ADR.
- **Suggested fix:** In the Q1 row (and in the explainer), add:
  - a link to the ADR-003 claim section;
  - the claim in two plain sentences, for example: "Our LTI service uses the same API paths and field names as the public LTIAAS API, with a list of small differences. The official `ltiaas` SDK, used only as a test tool, passed our compatibility test.";
  - the two rules: do not say "a copy of LTIAAS"; do not say "works with any LTIAAS tool".

### B-T9-03 — NIT — The README quick start says "Type yes", but a new clone gets no question

- **Location:** `README.md` quick start, the `npm run e2e:reset` line: "WARNING: deletes the local Moodle site and the local Cogniate data. Type yes to confirm."
- **Problem:** With no stack data (a fresh clone), `confirm_stack_delete` (`infra/scripts/lib.sh`) does not ask. A new person may wait for a question that does not come. The run guide is right ("When the command asks, type `yes`").
- **Suggested fix:** "… If it asks, type yes."

### B-T9-04 — NIT — `PLAN.md` sits with the reader files, but it is not for the reader

- **Location:** `docs/human_review/PLAN.md` (792 words, "Hand-over pack: plan", "Status: accepted by the Lead").
- **Problem:** A product person who opens the folder sees seven files and two folders. START-HERE does not mention `PLAN.md`, so the reader does not know that they can skip it.
- **Suggested fix:** Move it to `docs/team/` or `docs/architecture/`, or add one line in START-HERE: "`PLAN.md`: how Docs made this pack. You can skip it."

## Notes (no finding)

- The working copy (not committed, Docs is working on it) changes Q16 and R4 in `decisions-needed.md`. The committed R4 row says "Chrome, Edge and Firefox work", but QA tested Chromium only. The new text ("QA tested Chromium only. Other browsers are not proven.") fixes this. Please commit it.
- `flows.md` says "Source: commit `63de503`". It is a generated file and names the commit before its own, which is expected.

---

## Round 2 — continuation review, 2026-10-19

Replacement Reviewer-B: Codex GPT-6-Astra, xhigh, under the continuation authority in `docs/team/charter.md`.
This is an independent replacement review, not a cross-model review.
Historical Round 1 remains unchanged.
I have not read Reviewer-A's files or findings.

### Phase 1 — committed P2 repair

Reviewed candidate: `d54c607d7fc6ce2d97e039bb108f52a37f2174ee`.
Continuation baseline: `c3f6d13`.
Product baseline: `dd6dd1188833653cb92c63cc09e3c438ac3cb7b4`.

**Phase 1 verdict: APPROVE — code, migration, adjacent tests, and QA harness at the SHA above.**
Finding counts: BLOCKER 0, MAJOR 0, MINOR 0, NIT 0.
This is not the final T9 verdict.
Fresh QA, T7, final architecture reconciliation, and the final docs/video pack remain required.

Scope and evidence:

- Read all new product changes since the product baseline: migration 010, `domain/score-syncs.ts`, `worker/score-sync.ts`, and adjacent `runtime-path.test.ts` changes.
- Read policy commit `b826eb1`, the corrected fractional guard in `d54c607`, and the continuation QA harness changes.
- Checked the existing migration runner, score policy, commit transaction, and LTI client as relevant context.
- Ran `npx vitest run services/cogniate-app/src/runtime-path.test.ts`: **52 passed**, 3.88 seconds, Node 24.21.0.
- Product, workspace packages, infra, lockfile, and test configuration matched the reviewed commit before and after that run.
- The coordinator reports root self-check: 703 passed and five fixture-dependent skips. I did not repeat that complete check.
- The failed `a5d9ddc` live run remains valid historical failure evidence. It does not verify this repair.

The implementation keeps the change in the repository and worker layers.
The three new database fields have distinct purposes: active send, unresolved uncertainty, and confirmation phase/due time.
The worker persists its marker before the external call.
Startup converts unresolved markers to uncertainty, including markers on superseded rows.
An ordinary successful retry does not clear earlier uncertainty.
The learner/activity query carries the requirement to a higher result, including another course version.
The first accepted higher send stays pending; a successful confirmation can complete it.
The worker checks current best before posting and before recording success.
It retains terminal conflicts and the existing retry-window start.

The tests exercise behavior rather than only the added fields.
They model late lower writes between higher acceptance and confirmation, then check the remote grade model.
They also cover a teacher override, restart from a file database, higher-result transfer, and supersession during confirmation.
Other cases cover confirmation errors, timeout retries, deadline exhaustion, stale batch/lookup snapshots, and learner/activity/tenant separation.
The fractional best-attempt guard is exercised with an absent higher sync row.
These unit models do not prove Moodle's remote ordering.

The QA additions have useful public oracles and explicit scope.
P2 checks pending status, `sentAt`, phase logs, app restart timing, confirmation, and a finite 90-second grade observation.
P5 deletes one exact higher failed sync in an isolated clone after stopping that clone's app.
It restarts in `finally` and compares both attempts, the best result, and the lower row through public results.
The P5 test is explicitly fixture-assisted.
P11 checks separate attempt and sync scores across versions, including pending and failed states.
The focus assertion now uses Playwright's retrying focus check; it does not remove the requirement.

### Boundaries to retain in the final pack

1. A lower remote request can still write after the accepted confirmation. The five-second gap is a bounded mitigation.
2. `sent` records accepted delivery with any required confirmation. It does not prove permanent Moodle grade equality.
3. Migration 010 preserves old rows and defaults the new fields. It cannot reconstruct pre-upgrade uncertainty.
4. Recovery therefore covers recorded post-upgrade sends. A prior-schema database upgrade is not live remote-recovery proof.
5. The author's ignored migration smoke reports seven preserved rows, migration integrity, reopen, and synthetic recovery checks.
   I inspected its result, but it is author evidence, not independent QA.
6. Fresh T5a/T5b/T6 and T7 were pending at this phase-one checkpoint.

The coordinator received these boundaries before the final Docs pass.
No product, QA, or other documentation file was changed by this reviewer.
Final scope, measurable STE results, artifact checks, findings, and verdict will follow in this round.

### Independent focused QA checkpoint — 2026-10-19

The coordinator supplied `tests/host/artifacts/qa-cont-p2-d54c607d-2026-10-19T10-45-38-252Z/`.
I inspected `summary.json` and the two extracted P2/P5 evidence files.
The SHA matches the phase-one candidate.
All six tests passed, including two setup tests; no tests were skipped.
The runner recorded no abort and zero remaining own containers, volumes, or networks.

- Higher score 90 first accepted: `10:49:29.543Z`, still `pending`, try 1.
- App stopped: `10:49:30.151Z`, before confirmation became due.
- Accepted confirmation: `10:49:35.204Z`, `sent`, try 2, phase `confirmation`.
- Response gap: 5.661 seconds. The lower row's two events end in `superseded`.
- The test's observation was 90 seconds, with no obsolete retry or further successful confirmation loop.
- P5 removed exactly one failed 80 row. Public results retained both versions' attempts and best score 80.
- Lower failed score 60 stayed unchanged. Resend returned `409 SYNC_NOT_RESENDABLE`.

P5 remains fixture-assisted. These results do not replace the full T5/T6 regression or fresh T7.
The finite P2 observation does not remove the late remote-write limit.

### Phase 2 static draft — 2026-10-19

Reviewed committed draft: `4af20fa5462131a0682636157f39e262670a886b`.
The coordinator identifies old stamps, old MP4s, and pending full regression/T7 text as unfinished work.
They are not new findings against a claimed final pack.

The read-only scan checked 13 Markdown files, explainer data, and English video text.
All 107 Markdown relative links resolve, including checked anchors.
All 18 named `npm run` scripts exist.
The deferred counts reconcile: 14 unique MINOR findings and 30 NITs.
Duplicate references F2 and P6 are counted only once.

Automated sentence classification needs human review.
It initially classified the conditional instruction below as descriptive.
I inspected every segment over 20 words and reclassified that instruction.
The final audit will report this method and the resolved measurements.

#### B-T9-05 — BLOCKER — One procedure exceeds the explicit AC-T9-04 limit

- Location: `docs/guides/run-the-stack.md:45` at `4af20fa`.
- Problem: the conditional instruction has 22 words, excluding the `NOTE` label; the procedure limit is 20.
- Evidence: “If another stack runs on this Mac (for example a second clone), give this clone its own project name, port and subnet.”
- Fix: shorten it or split the condition and action into two short sentences.
- Scope: an editorial acceptance failure, not a product defect.

#### B-T9-06 — MAJOR — Two reset entry points lack a data-loss WARNING

- Locations: `docs/guides/run-the-stack.md:116` (Procedure 6) and `docs/guides/troubleshooting.md:16`.
- Problem: these instructions run destructive reset commands without the required WARNING before the action.
- Evidence: Procedure 6 runs `test:e2e` and later offers `--yes`; troubleshooting recommends `stack:reset` with only a parenthetical deletion note.
- Fix: put a clear local-data deletion WARNING before each command. Keep the existing warnings for Procedures 1 and 4.
- Basis: inputs §7 uses WARNING for risk to data; AC-T9-04 requires the correct warning convention.

#### B-T9-07 — MINOR — Same-result wording overstates agreement with Moodle

- Locations: `docs/human_review/START-HERE.md:17`, `docs/guides/teacher.md:51`, explainer story “Grades”, and video script slide 8 in EN and VI.
- Problem: these sentences say the portal shows the same result or score, without limiting that claim to the demonstrated scenario.
- Evidence: teacher overrides and the documented P2 remote-write limit can leave different Moodle and local grades.
- Fix: describe the learner result and sync status. Describe “Refresh from Moodle” as the separate gradebook read.

#### B-T9-08 — MINOR — The deferred-list introduction exceeds the paragraph limit

- Location: `docs/human_review/deferred.md:5` at `4af20fa`.
- Problem: one paragraph has ten sentences, above inputs §7's six-sentence limit.
- Evidence: it mixes current status, T8 history, and the intended audience.
- Fix: split these topics into short paragraphs.

All four findings were sent to the coordinator promptly.
No fixes were made outside this review file.
After submitting my phase-one verdict, I encountered the Lead-published A-T9-C01 disposition in the required human pack.
I did not open the counterpart review file or use that disposition as my own finding.
Final artifacts, fresh full QA/T7, closure checks, and the final verdict remain pending.

### Static findings recheck — 2026-10-19

Reviewed fix commit: `90f4e9efd737cba8f6cb4507e25a1b5bc73cd5c6`.
**B-T9-05, B-T9-06, B-T9-07, and B-T9-08 are closed in the source text.**

- B-T9-05: the condition and instruction are separate short sentences; the instruction has 10 words.
- B-T9-06: Procedure 6 and the troubleshooting reset advice now put WARNING before the destructive command.
- B-T9-07: all listed Markdown/explainer occurrences and both EN/VI slide 8 narrations describe results and send status.
  The video script identifies the separate Moodle gradebook read.
- B-T9-08: the ten-sentence introduction is split into paragraphs of five, three, and two sentences.

The repeated scan finds no new over-limit prose segment.
The MP4 regeneration and final stamp/evidence review remain pending.

### Offline pack checkpoint — 2026-10-19

Snapshot: committed `90f4e9efd737cba8f6cb4507e25a1b5bc73cd5c6`, extracted outside the worktree.
I opened its explainer from a file URL in an isolated headless Chrome context with networking disabled.
All five tabs displayed one visible panel, with no page errors or HTTP requests.
At a 1440 × 1000 viewport, none of the five panels had horizontal overflow.
The Q4 answer survived reload; the text export included its selected answer.
Arrow-right advanced the flow step.
I inspected screenshots of Start, Flows, and Proven.
`node docs/human_review/tools/build-md.mjs --check` passed in that snapshot.
These checks cover the offline artifact, not unfamiliar-person usability.

Historical B-T9-01 through B-T9-04 are also addressed in the committed pack.
The old pending labels are replaced, Q1 includes the bounded claim and its limits,
README makes the confirmation conditional, and START-HERE identifies PLAN as optional.
The 30-minute path now allocates 3 + 4 + 8 + 5 + 10 minutes.
Final QA claims and the regenerated videos remain to be checked.

### Full regression checkpoint — 2026-10-19

Report commit: `c5683f896330debaea5e9a09f49357dc3e99e92b`.
Tested product and harness: `d54c607d7fc6ce2d97e039bb108f52a37f2174ee`.
Their paths have no changes between these commits.
I read the appended T5a, T5b, and T6 reports and checked their supplied raw results.
Evidence root: `tests/host/artifacts/qa-cont-t5-d54c607d-2026-10-19T10-52-13-189Z/`.

- `summary.json`: all 63 aggregate IDs pass, including 49 required AC IDs; no abort.
- Playwright reports: 22 T5a main, one separate expiry, 24 T5b, and 18 T6 tests pass; total 65 executed.
- The intentional T5a main expiry skip is covered by the separate pass. No failure or flaky result is recorded.
- Cleanup records zero own containers, volumes, and networks, with no other project's container stopped or restarted.
- The P2 attachment shows higher acceptance at `11:04:52.856Z`, still pending, try 2, without `sentAt`.
- The app stopped at `11:04:53.397Z`; confirmation succeeded at `11:04:58.479Z`, try 3, a 5.623-second gap.
- The finite observation remains 90 seconds. The lower row remains superseded at try 2, with no obsolete retry.
- P5 again deletes exactly one failed 80 sync. Both versioned attempts and best 80 remain unchanged; lower Resend returns 409.
- P11 sent, pending, and failed lower-retake states pass. T6 teacher-copy and awaited keyboard/focus checks also pass.

The reports correctly retain the older failures and identify the current successful rerun.
They disclose the fixture, browser/site limits, unobserved 24-hour window, and P2 remote-ordering limit.
This closes the fresh T5a/T5b/T6 evidence gate for this review.
Fresh T7, final architecture reconciliation, and final pack artifacts remain pending.

### Fresh T7 and root checkpoint — 2026-10-19

Report commit: `a5633697206831d5a148f872d08e45d803dce4cd`, T7 report section 10.
Tested commit: `c5683f896330debaea5e9a09f49357dc3e99e92b`.
Product, infra, packages, and QA harness paths match the reviewed repair `d54c607`.
Evidence root: `tests/e2e/artifacts/runs/qa-e2e-cont-p2-c5683f89-2026-10-19T11-17-07-393Z/`.

I checked the report against `summary.json`, four Playwright result files, `root-check.log`, and `cleanup-independent.json`.
All 13 command steps succeeded, including reset refusal and non-terminal refusal checks.
Three consecutive T7 commands took 186, 181, and 175 seconds.
Each has 17 passes, no failure or flaky result, and one intentional demo-only skip.
The separate demo check passes; `demo:prepare` took 8.64 seconds.
The report maps all 15 T7 ACs to this fresh run.
The root check passes lint, types, and 708 unit tests in 48 files, with no skips.
Cleanup has no own resources; all ten baseline containers are unchanged.

T7 explicitly does not prove P2 delayed-write placement or the lower-retake P11 variants.
Those claims retain the separate T5b evidence and finite observation boundary.
The fresh T7/root evidence gate is closed for this review.
Final conformance, pack stamps, STE measurements, and video artifacts remain pending.

### Final source checkpoint — 2026-10-19

Reviewed source: `533141e6903ba13e1b3efd09a0851a52a1d7f867`.
The final Architect disposition matches the fresh QA scope and keeps its limits explicit.
The source now uses the fresh T7 times and removes obsolete regression-pending text.
All 115 checked relative links and anchors resolve; all 18 named npm scripts exist.
The sentence scan passes, including manual review of every segment above 20 words.
The coordinator is preparing narrower T6/live-window wording and final stamped media.

#### B-T9-09 — MINOR — Q1 remains one overlong paragraph in the explainer

- Location: `explainer.html`, Q1 question at line 1121; renderer line 1709, at `533141e`.
- Problem: eight sentences render in one `p.q`, above the six-sentence paragraph limit in inputs §7.
- Evidence: three opening questions, four quoted claim sentences, and one raw-slash limitation.
- Fix: shorten to six sentences, or render separate short paragraphs without losing the claim and its limits.
- Suggested small change: combine the three opening questions into one question within the 25-word descriptive limit.

This was sent promptly to the coordinator.
It does not change the passing individual sentence-length measurement or the P2 code verdict.

Correction recheck: `6932539d4b44e017dd54acc8dc37c6bb2ba9fed1`.
**B-T9-09 is closed.** Q1 now has six sentences, with the claim and limits intact.
The stronger scan handles closing quotation marks and counts each table cell separately.
It finds no sentence or paragraph above the applicable limit in the reviewed scope.
The additional live-window, viewport, card-state, and accessibility qualifications match the QA reports.
The Lead supplied this source delta and its finding identifiers; I did not open the counterpart review or adopt its findings.
All requested source corrections from this review are closed.
Final artifact checks and the final scoped verdict remain pending.

### Final continuation verdict — 2026-10-19

**APPROVE — Reviewer-B's complete assigned continuation scope.**

Exact final candidate: `39c401ae7247547a6a503414ffa699aaea6fb884`.
Build source: `6932539d4b44e017dd54acc8dc37c6bb2ba9fed1`.
Reviewer provenance remains Codex GPT-6-Astra, xhigh, independent replacement Reviewer-B.
The continuation delta starts at `c3f6d13`; the product review starts at `dd6dd11`.
Product, package, infra, and QA harness paths still match the reviewed repair `d54c607`.

This verdict covers the P2 repair, migration, adjacent tests, QA harness, architecture reconciliation, guides, human pack, offline explainer, and EN/VI artifacts.
It includes `CLOSING-PASS.md` and the final PLAN measurements.
Fresh T5a/T5b/T6, fresh T7/root, and final Architect evidence are checked above.
It does not declare overall T9 complete; final T9 QA and the Lead's closure remain separate gates.

| Severity | Unresolved new findings |
| --- | --- |
| BLOCKER | 0 |
| MAJOR | 0 |
| MINOR | 0 |
| NIT | 0 |

B-T9-05 through B-T9-09 are closed in this candidate.
This round raised one BLOCKER, one MAJOR, and three MINOR findings; none was silently waived.
The historical findings and dated checkpoints above remain unchanged.
I did not open Reviewer-A's review files.
Lead-published dispositions encountered during source reconciliation are disclosed above and are not my independent findings.

#### AC-T9-04 — confirmed PASS

I measured 14 Markdown files: README, all six guides, and all seven human-pack Markdown files.
The scan also covers explainer `pack-data` and English video narration, titles, captions, boxes, chips, and list text.

| Scope | Procedure segments | Maximum words | Descriptive segments | Maximum words |
| --- | --- | --- | --- | --- |
| Markdown | 268 | 18 | 1,661 | 25 |
| Explainer data | 49 | 18 | 630 | 23 |
| English video text | 12 | 7 | 87 | 23 |

**Procedures are within 20 words; descriptions are within 25 words; paragraphs are within six sentences.**
The maximum measured paragraph has six sentences, including the corrected Q1 question block.
No over-limit result remains.

Method: read each file from the named commit, strip Markdown/HTML markup and link targets, and split prose at sentence punctuation.
Decimal numbers and version numbers remain intact; closing quotation marks do not hide a sentence boundary.
Count whitespace-separated words, separating arrows and em dashes; count an inline code span as one technical token.
Treat each Markdown table cell, list item, paragraph, and JSON text field as a separate block.
Numbered guide steps and imperative starts are procedure candidates.
I manually inspected every segment above 20 words to catch conditional instructions and classification errors.
The counts include labels and fragments, so they are scan segments rather than a linguistic sentence census.

Exceptions and limits: code blocks, metadata headings, paths, and identifiers are not English prose sentences.
Commands and their warning comments were checked separately.
Vietnamese text is outside English word limits; HR-1 remains open for human wording and voice approval.
Exact Moodle labels, API names, technical noun phrases, and short navigation sequences remain as needed for reproduction.
This is the requested approximately 80% STE review, not certification against the complete ASD-STE100 dictionary.
Manual checks cover plain terms, active instructions, short paragraphs, and consistent names.

NOTE supplies context and limitations. WARNING precedes local-data resets and identifies secret-bearing traces.
The two missing reset warnings are fixed. There is no misuse of CAUTION for data loss.
No hardware-damage instruction in this scope needs a CAUTION label.

#### Final artifact checks

I extracted the committed pack into an isolated temporary snapshot outside the worktree.
All 131 checked relative Markdown links and anchors resolve; all 18 named npm scripts exist.
The seven Markdown stamps, explainer metadata, script metadata, and decoded video frames name source `6932539`, dated 2026-10-19.
The generator's `--check` passes in the snapshot.
The build source predates generated outputs, as the documented stamping process requires.

All 25 human decision IDs remain: Q1–Q18, R1–R5, HR-1, and HR-2.
The teacher path includes Add content, Activity or resource, Cogniate, Add, and Select content.
Completion and manual Accept grades labels match the task authority and fresh QA evidence.
The 30-minute path remains 3 + 4 + 8 + 5 + 10 minutes.
The 61-second QA substitute is distinguished from unfamiliar-person proof; HR-2 remains open.

The final offline explainer passed all five tabs at 1440 × 1000 with no script errors, HTTP requests, or horizontal overflow.
Answer persistence, text export, and keyboard flow navigation passed again.
These are automated artifact checks, not an unfamiliar-person usability test.

| Decoded final file | Duration | Bytes | Streams |
| --- | --- | --- | --- |
| `explainer-en.mp4` | 182.4 s | 2,211,513 | H.264 1280×720 at 5 fps; mono AAC 44,100 Hz |
| `explainer-vi.mp4` | 212.4 s | 2,567,661 | H.264 1280×720 at 5 fps; mono AAC 44,100 Hz |

Both satisfy the 240-second and 8,000,000-byte limits.
I used the pinned ffprobe/ffmpeg image from the build script; both complete files decoded without errors.
Both audio streams are non-silent; their measured mean levels are −16.4 dB and −17.7 dB.
Audio ends before the final held frame, as the closing record states.
I inspected contact sheets extracted from all 13 slides per language and full-size limits/decision frames.
The final source stamp, readable captions, updated grade wording, P2 limit, and Vietnamese translation notice are present.
This does not approve Vietnamese voice quality on behalf of a human.

Artifact SHA-256 values:

- EN: `4901730820675e93a8dd6bf644259dc2d7ed39775b8e34724469653324215934`.
- VI: `26f4cadd96fe5dae039be25059d539d1daba7c74895ad29047d5d778755db4d7`.

#### Scope retained at approval

The pack does not claim that confirmation prevents an arbitrarily late older remote write.
It also does not claim recovery of unrecorded sends from before migration 010.
P2's finite observation, fixture-assisted P5, and Author-only synthetic upgrade evidence remain distinct.
Fresh QA passes replace obsolete pending claims while historical failures retain their dates and SHAs.
T8's dated PASS, unsupported Moodle subfolders, browser limits, T6 coverage limits, and accepted deferrals remain visible.
Q4 and the other human decisions remain open; no human acceptance of the P2 limit is invented.

Only this Reviewer-B report was changed by this reviewer.
No product, QA, other Docs file, commit, push, or subagent was created.
