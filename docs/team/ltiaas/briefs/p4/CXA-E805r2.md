# Review dispatch: Reviewer-A (Codex, same session), one item (Docs)

Item 1: LA-E8-05 round 2 (Docs fix round 1; la-docs 8656e1c6, integration 5610a68a): new docs/human_review/ltiaas/service-controls.md (each service-control claim, LA-E5-01 to -24, mapped to its QA report with the SIM, UNIT, U1 and MOODLE-LIVE AC numbers; linked from index.html and start-here.md) for B-LA-E8-05-01; spec-deviations.md D22 (account classes soft; /healthz, /readyz and /metrics not limited) for A-LA-E8-05-01; LA-H25 shown as decided (a). Also one line in the approved docs/guides/ltiaas/add-a-channel.md step 10.2 now cites tests/ltiaas/kit/README.md (QA-K's command fix, 29fcb01d): confirm the citation is right.
Check that your round 1 findings are closed (check each service-control row against its qa.md) and look for new defects. Read only; no Docker. Add "## Round 2" to docs/reviews/LA-E8-05/reviewer-a.md; keep the first lines "Verdict:" and "Round:" current.

Integration worktree rule: read only. Never run npm ci, npm install, git clean, git checkout or git reset there.

# Common rules for LA build-task reviews (Reviewer-A, Reviewer-B)

You continue the dedicated reviewer role of G-DESIGN, G-BREAKDOWN and the earlier build rounds. Lenses: Reviewer-A "Is it right and is it safe?", Reviewer-B "Can a human team own it?" (base charter §1). Review the task diff named in the dispatch against its task spec (docs/architecture/ltiaas/tasks/<task>.md), the design (docs/architecture/ltiaas/**) and plan §6.1. Read the diff with git in the LA integration worktree /Users/quangnguyen/orca/workspaces/cogniate_moodle_integration_prototype/ltiaas-milestone; do not change any file except your review file.
Write docs/reviews/LA-<task>/<reviewer-a|reviewer-b>.md: first lines "Verdict: APPROVE | CHANGES_REQUESTED" and "Round: n"; findings with id (A-<task>-nn / B-<task>-nn), severity (base charter §5), file:line, problem, evidence, suggested fix. Proportional: small diff, short review. Check: every UNIT AC has a test that would fail on the old behaviour; the "Must not edit" list is respected; no behaviour change outside the spec; no LMS name added to core paths; ownership (matrix §5). Blind review: never open the other reviewer's file. Do not run Docker. Do not commit.
When done: one worker_done (--outcome succeeded), three-sentence summary with the verdict and counts, --files-modified, --report-path. Then stop. Read only your own messages.
=== TASK SPEC ===
