# Review dispatch: Reviewer-A (Codex, same session), one item (Docs)

Item 1: LA-E8-01 round 4 (Docs fix round 4, allowed by the product owner; la-docs 2960639e, integration e8aacf54): docs/guides/ltiaas/add-a-channel.md step 10.2: the K1 command is now "LA_RUN_DIR=/tmp/kit-run QA_KIT_CHANNELS=<id> QA_TASK=K1 npm --prefix tests run acceptance:api" from the repo root, with a note on the cd-tests form; Docs' host probe with a stubbed Vitest: the old form exit 3, both new forms exit 0. QA-K fixed the same example in tests/ltiaas/kit/README.md (integration 29fcb01d).
Check that A-LA-E8-01-06 / B-LA-E8-01-05 are closed (rerun your fake-runner probe) and look for new defects. Read only; no Docker. Add "## Round 4" to docs/reviews/LA-E8-01/reviewer-a.md; keep the first lines "Verdict:" and "Round:" current.

Integration worktree rule: read only. Never run npm ci, npm install, git clean, git checkout or git reset there.

# Common rules for LA build-task reviews (Reviewer-A, Reviewer-B)

You continue the dedicated reviewer role of G-DESIGN, G-BREAKDOWN and the earlier build rounds. Lenses: Reviewer-A "Is it right and is it safe?", Reviewer-B "Can a human team own it?" (base charter §1). Review the task diff named in the dispatch against its task spec (docs/architecture/ltiaas/tasks/<task>.md), the design (docs/architecture/ltiaas/**) and plan §6.1. Read the diff with git in the LA integration worktree /Users/quangnguyen/orca/workspaces/cogniate_moodle_integration_prototype/ltiaas-milestone; do not change any file except your review file.
Write docs/reviews/LA-<task>/<reviewer-a|reviewer-b>.md: first lines "Verdict: APPROVE | CHANGES_REQUESTED" and "Round: n"; findings with id (A-<task>-nn / B-<task>-nn), severity (base charter §5), file:line, problem, evidence, suggested fix. Proportional: small diff, short review. Check: every UNIT AC has a test that would fail on the old behaviour; the "Must not edit" list is respected; no behaviour change outside the spec; no LMS name added to core paths; ownership (matrix §5). Blind review: never open the other reviewer's file. Do not run Docker. Do not commit.
When done: one worker_done (--outcome succeeded), three-sentence summary with the verdict and counts, --files-modified, --report-path. Then stop. Read only your own messages.
=== TASK SPEC ===
