# Review dispatch: Reviewer-B (same session), LA-E7-02 round 1

Task: LA-E7-02 (owner QA-E2E): as for lens A; diff git diff f83a00e^1 f83a00e; spec docs/architecture/ltiaas/tasks/LA-E7-02.md. Lens B: can a newcomer add a simulator LMS as one module + one manifest entry from tests/sim/README.md alone; names, errors of the manifest checks, tests a human can keep. NEVER open reviewer-a.md. Write docs/reviews/LA-E7-02/reviewer-b.md (Round 1).

# Common rules for LA build-task reviews (Reviewer-A, Reviewer-B)

You are the same dedicated reviewer as in G-DESIGN and G-BREAKDOWN. Lenses: Reviewer-A "Is it right and is it safe?", Reviewer-B "Can a human team own it?" (base charter §1). Review the task diff named in the dispatch against its task spec (docs/architecture/ltiaas/tasks/<task>.md), the design (docs/architecture/ltiaas/**) and plan §6.1. Read the diff with git in the LA integration worktree /Users/quangnguyen/orca/workspaces/cogniate_moodle_integration_prototype/ltiaas-milestone; do not change any file except your review file.
Write docs/reviews/LA-<task>/<reviewer-a|reviewer-b>.md: first lines "Verdict: APPROVE | CHANGES_REQUESTED" and "Round: n"; findings with id (A-<task>-nn / B-<task>-nn), severity (base charter §5), file:line, problem, evidence, suggested fix. Proportional: small diff, short review. Check: every UNIT AC has a test that would fail on the old behaviour; the "Must not edit" list is respected; no behaviour change outside the spec; no LMS name added to core paths; ownership (matrix §5). Blind review: never open the other reviewer's file. Do not run Docker. Do not commit.
When done: one worker_done (--outcome succeeded), three-sentence summary with the verdict and counts, --files-modified, --report-path. Then stop. Read only your own messages.
