# Review dispatch: Reviewer-B (Codex, same session), one item (LD-9 addendum r3: Moodle lane)

Item 1: LD-9 addendum r3 (QA-3; la-qa be7e9176, integration 12563635): docs/reviews/LA-E7-08/ld9-addendum-r3.md: six frozen-test files. WE-F7 under the new LA-IC-23 (A1 BD-A1-115, LA-ADR-04 D8): tests/e2e/lib/steps.ts, tests/acceptance/lib/portal.ts and tests/acceptance/T6/2-connect.spec.ts read a composed Moodle steps view (packages/channels/moodle/portal/moodle-steps.json + the Moodle manifest texts.adminSteps) instead of the removed apps/portal/src/connect/moodle-steps.json. WE-F8 under the M2 approval (docs/architecture/tasks/M2.md "Intentional label changes", AC-M2-10; AC-M3-02(b); not an LA change): T6 3-courses.spec.ts, 5-xss-a11y.spec.ts and T8 2-shell.spec.ts use "Publish to an LMS", "LMS connection" and the M2 option format. Bases: la-gate-test-3 (e46bb27c, src-wave-end-3) and la-gate-test-4 (6ce8ffaf, src-wave-end-4), both read only under /Users/quangnguyen/cogniate-qa-runs/LA/GATE/.
Lens B: the addendum is complete and clear: each hunk with its type (LA-IC-23, or the M2 approval AC-M3-02(b)), the reason, the evidence and the re-gate rows.
Read only; no Docker. Write docs/reviews/LA-E7-08/ld9-addendum-r3-reviewer-b.md (Round 1).

Integration worktree rule: read only. Never run npm ci, npm install, git clean, git checkout or git reset there.

# Common rules for LA build-task reviews (Reviewer-A, Reviewer-B)

You continue the dedicated reviewer role of G-DESIGN, G-BREAKDOWN and the earlier build rounds. Lenses: Reviewer-A "Is it right and is it safe?", Reviewer-B "Can a human team own it?" (base charter §1). Review the task diff named in the dispatch against its task spec (docs/architecture/ltiaas/tasks/<task>.md), the design (docs/architecture/ltiaas/**) and plan §6.1. Read the diff with git in the LA integration worktree /Users/quangnguyen/orca/workspaces/cogniate_moodle_integration_prototype/ltiaas-milestone; do not change any file except your review file.
Write docs/reviews/LA-<task>/<reviewer-a|reviewer-b>.md: first lines "Verdict: APPROVE | CHANGES_REQUESTED" and "Round: n"; findings with id (A-<task>-nn / B-<task>-nn), severity (base charter §5), file:line, problem, evidence, suggested fix. Proportional: small diff, short review. Check: every UNIT AC has a test that would fail on the old behaviour; the "Must not edit" list is respected; no behaviour change outside the spec; no LMS name added to core paths; ownership (matrix §5). Blind review: never open the other reviewer's file. Do not run Docker. Do not commit.
When done: one worker_done (--outcome succeeded), three-sentence summary with the verdict and counts, --files-modified, --report-path. Then stop. Read only your own messages.
=== TASK SPEC ===
