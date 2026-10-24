# Review dispatch: Reviewer-B (Codex, same session), one item (Docs)

Item 1: LA-E8-05 round 1 (Docs; la-docs 762ff28c and 270df640, integration a400c78e): new docs/guides/ltiaas/spec-deviations.md and docs/human_review/ltiaas/** (index.html, start-here.md, decisions.md). Spec: docs/architecture/ltiaas/tasks/LA-E8-05.md (AC-01 each deviation row with spec section, behaviour, reason, QA evidence, and every D-row of A2's delta; AC-02 every LA-IC-01..23 row with its status; AC-03 an entry page that links every proof with its evidence label and no real-LMS claim without a LIVE row; AC-05 the entry page opens with no network request). Sources: contracts/lti-service-api-delta.md, the base contract §8 (D22-D36, §8.1), LA-ADR-04 D8, conformance-A1.md, conformance-A2.md §3, docs/reviews/LA-E7-08/qa.md, LA-E7-09/qa.md, LA-E7-07/qa.md, board.md, plan.md §6.2.
Lens B: the product team (Vietnamese, STE) can read it: short pages, clear diagrams, the open decisions with options; STE about 80%.
Read only; no Docker. Write docs/reviews/LA-E8-05/reviewer-b.md (Round 1).

Integration worktree rule: read only. Never run npm ci, npm install, git clean, git checkout or git reset there.

# Common rules for LA build-task reviews (Reviewer-A, Reviewer-B)

You continue the dedicated reviewer role of G-DESIGN, G-BREAKDOWN and the earlier build rounds. Lenses: Reviewer-A "Is it right and is it safe?", Reviewer-B "Can a human team own it?" (base charter §1). Review the task diff named in the dispatch against its task spec (docs/architecture/ltiaas/tasks/<task>.md), the design (docs/architecture/ltiaas/**) and plan §6.1. Read the diff with git in the LA integration worktree /Users/quangnguyen/orca/workspaces/cogniate_moodle_integration_prototype/ltiaas-milestone; do not change any file except your review file.
Write docs/reviews/LA-<task>/<reviewer-a|reviewer-b>.md: first lines "Verdict: APPROVE | CHANGES_REQUESTED" and "Round: n"; findings with id (A-<task>-nn / B-<task>-nn), severity (base charter §5), file:line, problem, evidence, suggested fix. Proportional: small diff, short review. Check: every UNIT AC has a test that would fail on the old behaviour; the "Must not edit" list is respected; no behaviour change outside the spec; no LMS name added to core paths; ownership (matrix §5). Blind review: never open the other reviewer's file. Do not run Docker. Do not commit.
When done: one worker_done (--outcome succeeded), three-sentence summary with the verdict and counts, --files-modified, --report-path. Then stop. Read only your own messages.
=== TASK SPEC ===
