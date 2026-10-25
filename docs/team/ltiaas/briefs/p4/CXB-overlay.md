# Review dispatch: Reviewer-B (Codex, same session), one item (the gate test overlay: LD-1, LD-6 and the LD-9 hunks)

Item 1: the frozen-test overlay that every wave-end gate run used: `git diff 80133d6b 8ad1292687431b05bad6b5c070ab722e67714526 -- tests` (21 files, 30 hunks) in /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end (read only; clone it with --no-hardlinks for your checks; GIT_OPTIONAL_LOCKS=0). Its parts: the LD-1 open-world rewrite (lead QA, LA-E0-04, la-qa f0a7b306 "QA PASS, reviews pending": these reviews never ran; docs/reviews/LA-E0-04/qa.md), the LD-6 / LA-IC-09 T5b P5 fixture change (tests/host/p5-fixture.mjs, tests/host/storage-fixture-script.mjs), the LA-IC-04 and LA-IC-14 hunks, and the qalead-la runner prefix guard. Rules: plan.md §6.1 LD-1, LD-6, LD-9; LA-ADR-04 D8; AC-LA-E7-08-05. A1's conformance check (docs/architecture/ltiaas/conformance-A1.md) asks for these reviews before its round 2.
Lens B: each hunk is traceable (rule, reason, the AC it keeps), and a later team can see why each frozen file changed.
Read only; no Docker. Write docs/reviews/LA-E0-04/reviewer-b.md (Round 1): one verdict for the overlay, with a table per part (part, files, verdict, findings).

Integration worktree rule: read only. Never run npm ci, npm install, git clean, git checkout or git reset there.

# Common rules for LA build-task reviews (Reviewer-A, Reviewer-B)

You continue the dedicated reviewer role of G-DESIGN, G-BREAKDOWN and the earlier build rounds. Lenses: Reviewer-A "Is it right and is it safe?", Reviewer-B "Can a human team own it?" (base charter §1). Review the task diff named in the dispatch against its task spec (docs/architecture/ltiaas/tasks/<task>.md), the design (docs/architecture/ltiaas/**) and plan §6.1. Read the diff with git in the LA integration worktree /Users/quangnguyen/orca/workspaces/cogniate_moodle_integration_prototype/ltiaas-milestone; do not change any file except your review file.
Write docs/reviews/LA-<task>/<reviewer-a|reviewer-b>.md: first lines "Verdict: APPROVE | CHANGES_REQUESTED" and "Round: n"; findings with id (A-<task>-nn / B-<task>-nn), severity (base charter §5), file:line, problem, evidence, suggested fix. Proportional: small diff, short review. Check: every UNIT AC has a test that would fail on the old behaviour; the "Must not edit" list is respected; no behaviour change outside the spec; no LMS name added to core paths; ownership (matrix §5). Blind review: never open the other reviewer's file. Do not run Docker. Do not commit.
When done: one worker_done (--outcome succeeded), three-sentence summary with the verdict and counts, --files-modified, --report-path. Then stop. Read only your own messages.
=== TASK SPEC ===
