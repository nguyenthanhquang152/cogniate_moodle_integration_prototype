# Review dispatch: Reviewer-B (Codex, same session), LA-E0-02 round 6

Item 1: QA-3's evidence fix of your round 5 findings (la-qa f27bf214; integration 4ac1672d). Diff: `git diff 1b447224 4ac1672d -- docs/reviews/LA-E0-02/qa.md`. A2's design ruling is BD-A2-114 (integration 5991a114; docs/architecture/ltiaas/build-decisions-A2.md; LA-ADR-06 D1 "Test stacks"): the registration defaults stand, and the acceptance stack uses them.
Check: the T2/T3 rates (qalead-la-123) now come from all retained snapshots, with the inputs and command named, and they match your own recovery. The AC-06/07 text uses BD-A2-114. The T8 AC-T8-03/07 record states only observations, gives the cause "not proven", and keeps the baseline-3 FAIL vs D1/D2 PASS difference explicit (D3/D4 pending). The 19-file summary.json audit table matches the raw files. The companion LA-E7-08 summary correction comes with the lead QA's D3 record, so it is not in this diff.
Host only. Add "## Round 6" to docs/reviews/LA-E0-02/reviewer-b.md; keep the first lines "Verdict:" and "Round:" current.

Integration worktree rule: read only. Never run npm ci, npm install, git clean, git checkout or git reset there.

# Common rules for LA build-task reviews (Reviewer-A, Reviewer-B)

You continue the dedicated reviewer role of G-DESIGN, G-BREAKDOWN and the earlier build rounds. Lenses: Reviewer-A "Is it right and is it safe?", Reviewer-B "Can a human team own it?" (base charter §1). Review the task diff named in the dispatch against its task spec (docs/architecture/ltiaas/tasks/<task>.md), the design (docs/architecture/ltiaas/**) and plan §6.1. Read the diff with git in the LA integration worktree /Users/quangnguyen/orca/workspaces/cogniate_moodle_integration_prototype/ltiaas-milestone; do not change any file except your review file.
Write docs/reviews/LA-<task>/<reviewer-a|reviewer-b>.md: first lines "Verdict: APPROVE | CHANGES_REQUESTED" and "Round: n"; findings with id (A-<task>-nn / B-<task>-nn), severity (base charter §5), file:line, problem, evidence, suggested fix. Proportional: small diff, short review. Check: every UNIT AC has a test that would fail on the old behaviour; the "Must not edit" list is respected; no behaviour change outside the spec; no LMS name added to core paths; ownership (matrix §5). Blind review: never open the other reviewer's file. Do not run Docker. Do not commit.
When done: one worker_done (--outcome succeeded), three-sentence summary with the verdict and counts, --files-modified, --report-path. Then stop. Read only your own messages.
