# Review dispatch: Reviewer-A (Codex, same session), one item (lane P, small)

Item 1: LA-E3-16 follow-up, lane P commit aa351bad (not merged yet; read it with `git show aa351bad` in the integration worktree): the hosted Canvas help sentence of A2 BD-A2-106 (build-decisions-A2.md) in packages/channels/canvas/portal/canvas-steps.json, with its test in canvas.test.tsx. The Lead merges it before the wave-end re-gate, so M2 and K2 cover it.
Lens A: the sentence is exactly what BD-A2-106 says, it is true for hosted Canvas, and the test would fail on the old text; no other portal text or behaviour changes; check whether any frozen M2 or K2 test asserts the old sentence (if yes, name it: it needs an LA-IC row).
Small diff, short review. Write docs/reviews/LA-E3-16/reviewer-a.md: add "## Round <next>" (BD-A2-106 follow-up); keep the first lines "Verdict:" and "Round:" current.

Integration worktree rule: read only. Never run npm ci, npm install, git clean, git checkout or git reset there.

# Common rules for LA build-task reviews (Reviewer-A, Reviewer-B)

You continue the dedicated reviewer role of G-DESIGN, G-BREAKDOWN and the earlier build rounds. Lenses: Reviewer-A "Is it right and is it safe?", Reviewer-B "Can a human team own it?" (base charter §1). Review the task diff named in the dispatch against its task spec (docs/architecture/ltiaas/tasks/<task>.md), the design (docs/architecture/ltiaas/**) and plan §6.1. Read the diff with git in the LA integration worktree /Users/quangnguyen/orca/workspaces/cogniate_moodle_integration_prototype/ltiaas-milestone; do not change any file except your review file.
Write docs/reviews/LA-<task>/<reviewer-a|reviewer-b>.md: first lines "Verdict: APPROVE | CHANGES_REQUESTED" and "Round: n"; findings with id (A-<task>-nn / B-<task>-nn), severity (base charter §5), file:line, problem, evidence, suggested fix. Proportional: small diff, short review. Check: every UNIT AC has a test that would fail on the old behaviour; the "Must not edit" list is respected; no behaviour change outside the spec; no LMS name added to core paths; ownership (matrix §5). Blind review: never open the other reviewer's file. Do not run Docker. Do not commit.
When done: one worker_done (--outcome succeeded), three-sentence summary with the verdict and counts, --files-modified, --report-path. Then stop. Read only your own messages.
=== TASK SPEC ===
