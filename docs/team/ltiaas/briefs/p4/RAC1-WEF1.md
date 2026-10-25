# Review dispatch: Reviewer-A (Claude, same session), one item (S1 fix)

Item 1: LA-E5-03 fix round for wave-end finding WE-F1 (lane S1; la-s1 bbb984d6, integration merge ecc19bbc): `DEFAULT_RATE_LIMITS.admin` 600/min burst 200 -> 1,200/min burst 600 (A2 BD-A2-108; new AC-LA-E5-03-14, UNIT). Diff: `git diff ecc19bbc^1 ecc19bbc` (services/lti-service/src/http/rate-limit.ts, rate-limit.test.ts). Why: in wave-end slot 3B the frozen M1 sim suite emptied the admin bucket of the first-party `cogniate` key (9 rows got 429), and LA-IC-10 / AP-06-18 say M1, M2 and T7 stay green with no test change. QA reruns the 9 rows on a stack later.
Lens A: the change is exactly BD-A2-108 (only DEFAULT_RATE_LIMITS.admin; key, mode hard, routes, order, answer and settings precedence unchanged); the new unit test would fail on the old 600/200 default; the 429 body and Retry-After stay as LA-ADR-06 D1 says; no other class moves (A2: api needs <= 28 burst).
Small diff, short review. Write docs/reviews/LA-E5-03/reviewer-a.md: add "## Round <next>" (WE-F1 fix) to the file; keep the first lines "Verdict:" and "Round:" current.

Integration worktree rule: read only. Never run npm ci, npm install, git clean, git checkout or git reset there.

# Common rules for LA build-task reviews (Reviewer-A, Reviewer-B)

You continue the dedicated reviewer role of G-DESIGN, G-BREAKDOWN and the earlier build rounds. Lenses: Reviewer-A "Is it right and is it safe?", Reviewer-B "Can a human team own it?" (base charter §1). Review the task diff named in the dispatch against its task spec (docs/architecture/ltiaas/tasks/<task>.md), the design (docs/architecture/ltiaas/**) and plan §6.1. Read the diff with git in the LA integration worktree /Users/quangnguyen/orca/workspaces/cogniate_moodle_integration_prototype/ltiaas-milestone; do not change any file except your review file.
Write docs/reviews/LA-<task>/<reviewer-a|reviewer-b>.md: first lines "Verdict: APPROVE | CHANGES_REQUESTED" and "Round: n"; findings with id (A-<task>-nn / B-<task>-nn), severity (base charter §5), file:line, problem, evidence, suggested fix. Proportional: small diff, short review. Check: every UNIT AC has a test that would fail on the old behaviour; the "Must not edit" list is respected; no behaviour change outside the spec; no LMS name added to core paths; ownership (matrix §5). Blind review: never open the other reviewer's file. Do not run Docker. Do not commit.
When done: one worker_done (--outcome succeeded), three-sentence summary with the verdict and counts, --files-modified, --report-path. Then stop. Read only your own messages.
=== TASK SPEC ===
