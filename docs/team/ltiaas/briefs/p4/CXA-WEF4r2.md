# Review dispatch: Reviewer-A (Codex, same session), two small items (WE-F4 fix round 1; lanes R and S1)

Item 1: LA-E4-02 (lane R; la-r cd8f06c9, integration merge f8d7d7d6): services/cogniate-app/src/kernel/records/shutdown.ts and shutdown.test.ts: one close promise per listener, awaited with the runner in one Promise.allSettled; the 3 s cutoff stays armed until all settle; then the database closes; then the first failure is thrown. Diff: `git diff f8d7d7d6^1 f8d7d7d6`.
Item 2: LA-E5-19 (lane S1; la-s1 a2c99731, integration merge 8fadb828): services/lti-service/src/main.ts close() keeps every settled result and throws the first rejected one after the database closes (exit 1). Diff: `git diff 8fadb828^1 8fadb828`.
Source: Reviewer-A round 2 findings A-LA-E4-02-04 and A-LA-E5-19-04 (docs/reviews/LA-E4-02/reviewer-a.md, docs/reviews/LA-E5-19/reviewer-a.md); A2 BD-A2-109.
Check that A-LA-E4-02-04 and A-LA-E5-19-04 are closed (rerun your private error-path probes), and that the normal path is unchanged. Small diffs, short review. Add "## Round <next>" to docs/reviews/LA-E4-02/reviewer-a.md and docs/reviews/LA-E5-19/reviewer-a.md; keep the first lines "Verdict:" and "Round:" current.

Integration worktree rule: read only. Never run npm ci, npm install, git clean, git checkout or git reset there.

# Common rules for LA build-task reviews (Reviewer-A, Reviewer-B)

You continue the dedicated reviewer role of G-DESIGN, G-BREAKDOWN and the earlier build rounds. Lenses: Reviewer-A "Is it right and is it safe?", Reviewer-B "Can a human team own it?" (base charter §1). Review the task diff named in the dispatch against its task spec (docs/architecture/ltiaas/tasks/<task>.md), the design (docs/architecture/ltiaas/**) and plan §6.1. Read the diff with git in the LA integration worktree /Users/quangnguyen/orca/workspaces/cogniate_moodle_integration_prototype/ltiaas-milestone; do not change any file except your review file.
Write docs/reviews/LA-<task>/<reviewer-a|reviewer-b>.md: first lines "Verdict: APPROVE | CHANGES_REQUESTED" and "Round: n"; findings with id (A-<task>-nn / B-<task>-nn), severity (base charter §5), file:line, problem, evidence, suggested fix. Proportional: small diff, short review. Check: every UNIT AC has a test that would fail on the old behaviour; the "Must not edit" list is respected; no behaviour change outside the spec; no LMS name added to core paths; ownership (matrix §5). Blind review: never open the other reviewer's file. Do not run Docker. Do not commit.
When done: one worker_done (--outcome succeeded), three-sentence summary with the verdict and counts, --files-modified, --report-path. Then stop. Read only your own messages.
=== TASK SPEC ===
