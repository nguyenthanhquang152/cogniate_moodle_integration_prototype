# Review dispatch: Reviewer-B (Codex, same session), one item (Docs)

Item 1: LA-E8-01 round 1 (Docs lane; la-docs bb9f6d7e, integration merge 0f96658d): new docs/guides/ltiaas/add-a-channel.md ("Add a new LTI channel" guide). Spec: docs/architecture/ltiaas/tasks/LA-E8-01.md (AC-01, AC-03, AC-04 are DOC; AC-02 is K1-SIM and pending QA's scratch-branch run). The kit steps say "pending QA SIM (AC-LA-E7-06-0n)" because the LA-E7-06 K1-SIM rows have not run yet.
Lens B: can a new developer or agent follow it alone: one numbered path, each step with its file, a short example and the check that proves it; the out-of-scope line (kind B, new capability); the "pending QA SIM" labels are clear; STE (about 80%).
Read only; do not run Docker or any stack. Write docs/reviews/LA-E8-01/reviewer-b.md (Round 1).

Integration worktree rule: read only. Never run npm ci, npm install, git clean, git checkout or git reset there.

# Common rules for LA build-task reviews (Reviewer-A, Reviewer-B)

You continue the dedicated reviewer role of G-DESIGN, G-BREAKDOWN and the earlier build rounds. Lenses: Reviewer-A "Is it right and is it safe?", Reviewer-B "Can a human team own it?" (base charter §1). Review the task diff named in the dispatch against its task spec (docs/architecture/ltiaas/tasks/<task>.md), the design (docs/architecture/ltiaas/**) and plan §6.1. Read the diff with git in the LA integration worktree /Users/quangnguyen/orca/workspaces/cogniate_moodle_integration_prototype/ltiaas-milestone; do not change any file except your review file.
Write docs/reviews/LA-<task>/<reviewer-a|reviewer-b>.md: first lines "Verdict: APPROVE | CHANGES_REQUESTED" and "Round: n"; findings with id (A-<task>-nn / B-<task>-nn), severity (base charter §5), file:line, problem, evidence, suggested fix. Proportional: small diff, short review. Check: every UNIT AC has a test that would fail on the old behaviour; the "Must not edit" list is respected; no behaviour change outside the spec; no LMS name added to core paths; ownership (matrix §5). Blind review: never open the other reviewer's file. Do not run Docker. Do not commit.
When done: one worker_done (--outcome succeeded), three-sentence summary with the verdict and counts, --files-modified, --report-path. Then stop. Read only your own messages.
=== TASK SPEC ===
