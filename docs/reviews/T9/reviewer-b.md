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
