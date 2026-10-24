# Review dispatch: Reviewer-A (Codex, same session), one item (LD-9 addendum r2, WE-F6)

Item 1: LD-9 addendum r2 (QA-3; la-qa 3b8b3a5c, integration d92486f5): docs/reviews/LA-E7-08/ld9-addendum-r2.md: one frozen-test change, tests/acceptance/M1/canvas/21-canvas-protocol.test.ts M1-08.canvas.login-redirect, under LA-IC-06 (A1 BD-A1-114 corrected the row; A2 BD-A2-110 decided the 200 storage-first Canvas login is the design). Base: the gate test SHA la-gate-test-3 = e46bb27c in /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end-3 (read only; clone it with --no-hardlinks for your checks).
Lens A: the changed case asserts exactly A2's expected answer (BD-A2-110, build-decisions-A2.md): status 200 and no Location; the rule 3 headers and CSP; the same state cookie; the lti-storage-data block (target, origin, key, state = authUrl state); every hint read from data.authUrl, unchanged; then the cookie launch 303 and canvas-oidc missing []. No other case or shared helper changes; no assertion is weaker than the frozen 302 case for the hints. Apply it yourself with git apply --check on a private clone at la-gate-test-3.
Read only; no Docker. Write docs/reviews/LA-E7-08/ld9-addendum-r2-reviewer-a.md (Round 1).

Integration worktree rule: read only. Never run npm ci, npm install, git clean, git checkout or git reset there.

# Common rules for LA build-task reviews (Reviewer-A, Reviewer-B)

You continue the dedicated reviewer role of G-DESIGN, G-BREAKDOWN and the earlier build rounds. Lenses: Reviewer-A "Is it right and is it safe?", Reviewer-B "Can a human team own it?" (base charter §1). Review the task diff named in the dispatch against its task spec (docs/architecture/ltiaas/tasks/<task>.md), the design (docs/architecture/ltiaas/**) and plan §6.1. Read the diff with git in the LA integration worktree /Users/quangnguyen/orca/workspaces/cogniate_moodle_integration_prototype/ltiaas-milestone; do not change any file except your review file.
Write docs/reviews/LA-<task>/<reviewer-a|reviewer-b>.md: first lines "Verdict: APPROVE | CHANGES_REQUESTED" and "Round: n"; findings with id (A-<task>-nn / B-<task>-nn), severity (base charter §5), file:line, problem, evidence, suggested fix. Proportional: small diff, short review. Check: every UNIT AC has a test that would fail on the old behaviour; the "Must not edit" list is respected; no behaviour change outside the spec; no LMS name added to core paths; ownership (matrix §5). Blind review: never open the other reviewer's file. Do not run Docker. Do not commit.
When done: one worker_done (--outcome succeeded), three-sentence summary with the verdict and counts, --files-modified, --report-path. Then stop. Read only your own messages.
=== TASK SPEC ===
