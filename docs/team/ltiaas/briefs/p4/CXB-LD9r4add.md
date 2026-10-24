# Review dispatch: Reviewer-B (Codex, same session), one item (LD-9 addendum r4: two frozen-test race fixes)

Item 1: LD-9 addendum r4 (QA-3; la-qa 313c75f8, integration 589d4f85): docs/reviews/LA-E7-08/ld9-addendum-r4.md: tests/acceptance/T5b/1-html.spec.ts AC-T5-36 (wait until the runtime state seenPages contains "index" before driveCourse; WE-F10, A1 BD-A1-116) and tests/acceptance/T6/3-courses.spec.ts AC-T6-07 (wait until "Loading…" is gone after the dialog is visible; WE-F11, A1 BD-A1-117). Base: la-gate-test-5 (0700b396) in /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end-5 (read only).
Lens B: the addendum is complete and clear (type, reason, evidence, re-gate rows).
Read only; no Docker. Write docs/reviews/LA-E7-08/ld9-addendum-r4-reviewer-b.md (Round 1).

Integration worktree rule: read only. Never run npm ci, npm install, git clean, git checkout or git reset there.

# Common rules for LA build-task reviews (Reviewer-A, Reviewer-B)

You continue the dedicated reviewer role of G-DESIGN, G-BREAKDOWN and the earlier build rounds. Lenses: Reviewer-A "Is it right and is it safe?", Reviewer-B "Can a human team own it?" (base charter §1). Review the task diff named in the dispatch against its task spec (docs/architecture/ltiaas/tasks/<task>.md), the design (docs/architecture/ltiaas/**) and plan §6.1. Read the diff with git in the LA integration worktree /Users/quangnguyen/orca/workspaces/cogniate_moodle_integration_prototype/ltiaas-milestone; do not change any file except your review file.
Write docs/reviews/LA-<task>/<reviewer-a|reviewer-b>.md: first lines "Verdict: APPROVE | CHANGES_REQUESTED" and "Round: n"; findings with id (A-<task>-nn / B-<task>-nn), severity (base charter §5), file:line, problem, evidence, suggested fix. Proportional: small diff, short review. Check: every UNIT AC has a test that would fail on the old behaviour; the "Must not edit" list is respected; no behaviour change outside the spec; no LMS name added to core paths; ownership (matrix §5). Blind review: never open the other reviewer's file. Do not run Docker. Do not commit.
When done: one worker_done (--outcome succeeded), three-sentence summary with the verdict and counts, --files-modified, --report-path. Then stop. Read only your own messages.
=== TASK SPEC ===
