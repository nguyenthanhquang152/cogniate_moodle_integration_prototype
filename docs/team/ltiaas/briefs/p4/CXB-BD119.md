# Review dispatch: Reviewer-B (Codex, same session), one item (lane P, small)

Item 1: LA-E1-11 follow-up (lane P; la-p 0eedb055, integration merge a8bbac53): data-channel-id={item.channel} on the <Card as="article"> of every channel card in apps/portal/src/Integrations.tsx, with a unit test in apps/portal/src/portal.test.ts (loading, not-ready and ready states). Rule: A1 BD-A1-119 (build-decisions-A1.md; LA-ADR-01 D9). Why: the LD-1 open-world M2 check needs a stable card identity in every state. Diff: `git diff a8bbac53^1 a8bbac53`.
Lens B: the rule is clear in LA-ADR-01 D9 and the test names BD-A1-119.
Small diff, short review. Write docs/reviews/LA-E1-11/reviewer-b.md: add "## Round <next>" (BD-A1-119); keep the first lines "Verdict:" and "Round:" current.

Integration worktree rule: read only. Never run npm ci, npm install, git clean, git checkout or git reset there.

# Common rules for LA build-task reviews (Reviewer-A, Reviewer-B)

You continue the dedicated reviewer role of G-DESIGN, G-BREAKDOWN and the earlier build rounds. Lenses: Reviewer-A "Is it right and is it safe?", Reviewer-B "Can a human team own it?" (base charter §1). Review the task diff named in the dispatch against its task spec (docs/architecture/ltiaas/tasks/<task>.md), the design (docs/architecture/ltiaas/**) and plan §6.1. Read the diff with git in the LA integration worktree /Users/quangnguyen/orca/workspaces/cogniate_moodle_integration_prototype/ltiaas-milestone; do not change any file except your review file.
Write docs/reviews/LA-<task>/<reviewer-a|reviewer-b>.md: first lines "Verdict: APPROVE | CHANGES_REQUESTED" and "Round: n"; findings with id (A-<task>-nn / B-<task>-nn), severity (base charter §5), file:line, problem, evidence, suggested fix. Proportional: small diff, short review. Check: every UNIT AC has a test that would fail on the old behaviour; the "Must not edit" list is respected; no behaviour change outside the spec; no LMS name added to core paths; ownership (matrix §5). Blind review: never open the other reviewer's file. Do not run Docker. Do not commit.
When done: one worker_done (--outcome succeeded), three-sentence summary with the verdict and counts, --files-modified, --report-path. Then stop. Read only your own messages.
=== TASK SPEC ===
