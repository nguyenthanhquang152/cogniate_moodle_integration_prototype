# Review dispatch: Reviewer-B (Codex, same session), one item (Docs)

Item 1: LA-E8-01 round 3 (Docs fix rounds 2-3; la-docs 4b5fc743 and 270df640, integration a400c78e): docs/guides/ltiaas/add-a-channel.md. Changes since your round 2: A-LA-E8-01-05 (a hand-checked id hides only a CHECK line); B-LA-E8-01-03: the kit step now follows the committed open-world kit (QA-4 kit fix rounds 1-3; docs/reviews/LA-E7-06/qa.md Round 4; the kit's K0 canary passes with a real sixth fixture, 16/16 in Docs' probe at 86a50df8; both kit reviewers closed B-LA-E7-06-06 in their round 4), and the "pending QA" note on the canary is gone. The kit K1-SIM rows have not run (LA-E7-06 is escalated to the product owner, LA-H25), so the "pending QA SIM" labels stay.
Check that your round 2 findings are closed and look for new defects in the changed text. Read only; local fake data only. No Docker. Add "## Round 3" to docs/reviews/LA-E8-01/reviewer-b.md; keep the first lines "Verdict:" and "Round:" current.

Integration worktree rule: read only. Never run npm ci, npm install, git clean, git checkout or git reset there.

# Common rules for LA build-task reviews (Reviewer-A, Reviewer-B)

You continue the dedicated reviewer role of G-DESIGN, G-BREAKDOWN and the earlier build rounds. Lenses: Reviewer-A "Is it right and is it safe?", Reviewer-B "Can a human team own it?" (base charter §1). Review the task diff named in the dispatch against its task spec (docs/architecture/ltiaas/tasks/<task>.md), the design (docs/architecture/ltiaas/**) and plan §6.1. Read the diff with git in the LA integration worktree /Users/quangnguyen/orca/workspaces/cogniate_moodle_integration_prototype/ltiaas-milestone; do not change any file except your review file.
Write docs/reviews/LA-<task>/<reviewer-a|reviewer-b>.md: first lines "Verdict: APPROVE | CHANGES_REQUESTED" and "Round: n"; findings with id (A-<task>-nn / B-<task>-nn), severity (base charter §5), file:line, problem, evidence, suggested fix. Proportional: small diff, short review. Check: every UNIT AC has a test that would fail on the old behaviour; the "Must not edit" list is respected; no behaviour change outside the spec; no LMS name added to core paths; ownership (matrix §5). Blind review: never open the other reviewer's file. Do not run Docker. Do not commit.
When done: one worker_done (--outcome succeeded), three-sentence summary with the verdict and counts, --files-modified, --report-path. Then stop. Read only your own messages.
=== TASK SPEC ===
