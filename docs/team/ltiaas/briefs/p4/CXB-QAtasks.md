# Review dispatch: Reviewer-B (Codex, same session), evidence review of 5 tasks with no review record

The Lead found at close-out (final-report check) 5 Must tasks with a QA report and no reviewer file. The base charter §1 says that the Lead never marks a task done without QA PASS and two reviews. Most of these tasks are owned by QA, and their output is the QA evidence. LA-E0-01 is the Lead's git-only intake merge. Review each one now. Integration HEAD 98c96410 or later.

Items (one review file each: docs/reviews/<task>/reviewer-b.md, Round: 1):
1. LA-E0-01 Base intake on G-BASE (docs/reviews/LA-E0-01/qa.md; intake merge 1b17261).
2. LA-E0-02 Baseline regression record (docs/reviews/LA-E0-02/qa.md).
3. LA-E0-03 Golden outputs G1–G4 (docs/reviews/LA-E0-03/qa.md).
4. LA-E5-13 Two-tenant isolation checks for the new routes (docs/reviews/LA-E5-13/qa.md; QA-owned tests).
5. LA-E7-07 K2 browser cases U1–U4 (docs/reviews/LA-E7-07/qa.md, Round 5 on a8bbac53).

For each item check:
- Each AC of the task spec (docs/architecture/ltiaas/tasks/<task>.md) has evidence in the qa.md.
- The verdict agrees with the cited raw files: summary.json, logs and run folders. Read them where they still exist; they are under /Users/quangnguyen/cogniate-qa-runs/ and in the paths that each qa.md cites. Name each path you read.
- No failed or pending row is shown as PASS.
- For QA-owned test code (LA-E5-13 tests, LA-E7-07 K2 specs, the LA-E0-03 golden tool), check that each test would fail on the wrong behaviour. Run host-only checks in a private `git clone --no-hardlinks`.
- For LA-E0-01, check that the intake merge has the G-BASE content and no product change of its own.
Proportional: these are done tasks with recorded evidence. A short review is fine. A finding needs evidence. If a raw file is gone, say so, but do not count that alone as a finding unless the qa.md has no other proof.

Integration worktree rule: read only. Never run npm ci, npm install, git clean, git checkout or git reset there.

# Common rules for LA build-task reviews (Reviewer-A, Reviewer-B)

You continue the dedicated reviewer role of G-DESIGN, G-BREAKDOWN and the earlier build rounds. Lenses: Reviewer-A "Is it right and is it safe?", Reviewer-B "Can a human team own it?" (base charter §1). Review the task diff named in the dispatch against its task spec (docs/architecture/ltiaas/tasks/<task>.md), the design (docs/architecture/ltiaas/**) and plan §6.1. Read the diff with git in the LA integration worktree /Users/quangnguyen/orca/workspaces/cogniate_moodle_integration_prototype/ltiaas-milestone; do not change any file except your review file.
Write docs/reviews/LA-<task>/<reviewer-a|reviewer-b>.md: first lines "Verdict: APPROVE | CHANGES_REQUESTED" and "Round: n"; findings with id (A-<task>-nn / B-<task>-nn), severity (base charter §5), file:line, problem, evidence, suggested fix. Proportional: small diff, short review. Check: every UNIT AC has a test that would fail on the old behaviour; the "Must not edit" list is respected; no behaviour change outside the spec; no LMS name added to core paths; ownership (matrix §5). Blind review: never open the other reviewer's file. Do not run Docker. Do not commit.
When done: one worker_done (--outcome succeeded), three-sentence summary with the verdict and counts, --files-modified, --report-path. Then stop. Read only your own messages.
