# Review dispatch: Reviewer-B (Codex, same session), one item (LD-9 addendum r7: the T8 AC-T8-10 option race)

Item 1: LD-9 addendum r7 (QA-3; integration be4557f4): docs/reviews/LA-E7-08/ld9-addendum-r7.md: tests/acceptance/T8/2-shell.spec.ts:34 gets `await expect(select.locator('option', { hasText: \`${conn.json.name} (\` })).toHaveCount(1)` before evaluateAll (WE-F13: in run D1, qalead-la-80, the synchronous read ran before the async /app-api/connections answer filled the combobox; the same case passed in slot 8b and in run D2). Same class as A1 BD-A1-117; no LA-IC; QA-3 also audited the other addendum r3 DOM reads (0 more). Base: la-final-test-1 (85ddf973, /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-final-1, read only); it must also apply on la-final-test-1 + addendum r6.
Lens B: the addendum is complete and traceable (type, reason, D1 evidence, re-gate rows).
Read only; no Docker. Write docs/reviews/LA-E7-08/ld9-addendum-r7-reviewer-b.md (Round 1).

Integration worktree rule: read only. Never run npm ci, npm install, git clean, git checkout or git reset there.

# Common rules for LA build-task reviews (Reviewer-A, Reviewer-B)

You continue the dedicated reviewer role of G-DESIGN, G-BREAKDOWN and the earlier build rounds. Lenses: Reviewer-A "Is it right and is it safe?", Reviewer-B "Can a human team own it?" (base charter §1). Review the task diff named in the dispatch against its task spec (docs/architecture/ltiaas/tasks/<task>.md), the design (docs/architecture/ltiaas/**) and plan §6.1. Read the diff with git in the LA integration worktree /Users/quangnguyen/orca/workspaces/cogniate_moodle_integration_prototype/ltiaas-milestone; do not change any file except your review file.
Write docs/reviews/LA-<task>/<reviewer-a|reviewer-b>.md: first lines "Verdict: APPROVE | CHANGES_REQUESTED" and "Round: n"; findings with id (A-<task>-nn / B-<task>-nn), severity (base charter §5), file:line, problem, evidence, suggested fix. Proportional: small diff, short review. Check: every UNIT AC has a test that would fail on the old behaviour; the "Must not edit" list is respected; no behaviour change outside the spec; no LMS name added to core paths; ownership (matrix §5). Blind review: never open the other reviewer's file. Do not run Docker. Do not commit.
When done: one worker_done (--outcome succeeded), three-sentence summary with the verdict and counts, --files-modified, --report-path. Then stop. Read only your own messages.
=== TASK SPEC ===
