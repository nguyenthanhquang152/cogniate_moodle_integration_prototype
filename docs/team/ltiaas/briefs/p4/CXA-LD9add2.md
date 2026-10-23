# Review dispatch: Reviewer-A (Codex, same session), one item (LD-9 addendum round 2)

Item 1: LD-9 addendum round 2 for the wave-end gate (lead QA; integration 0f821dad): docs/reviews/LA-E7-08/ld9-addendum-r1.md "## Round 2": the hunks regenerated against the frozen base 8ad12926 (each passes `git apply --check` on 8ad12926, the lead QA says), the event names from contracts/lti-service-api-delta.md §6, and the re-gate row that proves each hunk. Also read tests/ltiaas/GATE-RUN-PLAN.md §3C (how src-wave-end-2 is built: new SHA, then the 8ad12926 overlay, then the addendum as a second commit, never an amend).
Check that your round 1 findings are closed: apply each hunk yourself with `git apply --check` on a private clone at 8ad12926 (`git clone --no-hardlinks` of /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end, read only; or the la-qa branch at 8ad12926), and confirm no assertion other than the named ones changes. Read only; no Docker. Add "## Round 2" to docs/reviews/LA-E7-08/ld9-addendum-r1-reviewer-a.md; keep the first lines "Verdict:" and "Round:" current.

Integration worktree rule: read only. Never run npm ci, npm install, git clean, git checkout or git reset there.

# Common rules for LA build-task reviews (Reviewer-A, Reviewer-B)

You continue the dedicated reviewer role of G-DESIGN, G-BREAKDOWN and the earlier build rounds. Lenses: Reviewer-A "Is it right and is it safe?", Reviewer-B "Can a human team own it?" (base charter §1). Review the task diff named in the dispatch against its task spec (docs/architecture/ltiaas/tasks/<task>.md), the design (docs/architecture/ltiaas/**) and plan §6.1. Read the diff with git in the LA integration worktree /Users/quangnguyen/orca/workspaces/cogniate_moodle_integration_prototype/ltiaas-milestone; do not change any file except your review file.
Write docs/reviews/LA-<task>/<reviewer-a|reviewer-b>.md: first lines "Verdict: APPROVE | CHANGES_REQUESTED" and "Round: n"; findings with id (A-<task>-nn / B-<task>-nn), severity (base charter §5), file:line, problem, evidence, suggested fix. Proportional: small diff, short review. Check: every UNIT AC has a test that would fail on the old behaviour; the "Must not edit" list is respected; no behaviour change outside the spec; no LMS name added to core paths; ownership (matrix §5). Blind review: never open the other reviewer's file. Do not run Docker. Do not commit.
When done: one worker_done (--outcome succeeded), three-sentence summary with the verdict and counts, --files-modified, --report-path. Then stop. Read only your own messages.
=== TASK SPEC ===
