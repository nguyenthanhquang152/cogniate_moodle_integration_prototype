# Review dispatch: Reviewer-A (Codex, same session), LD-9 addendum r8, gate sources and re-gate plan (LD-29)

Item 1: the re-gate after the B/C final merge (product-owner decision LA-H27 (a), Lead rule LD-29, plan §6.1 and §6.2). The lead QA's part A (la-qa d736abb6 + c55e9d05; integration 2da33750):
- docs/reviews/LA-E7-08/ld9-addendum-r8.md (patch ~/cogniate-qa-runs/LA/ld9-addendum-r8/ld9-addendum-r8.patch, SHA-256 in the file). It puts the approved r1–r7 edits on top of the B/C final versions of 5 overlapping frozen files: T8/2-shell.spec.ts, host/m1-control.mjs, T6/5-xss-a11y.spec.ts, e2e/host/run-t7.mjs and T6/3-courses.spec.ts.
- Gate sources: baseline-3 d854183f (on main 78971b03) and la-final-test-3 57b6a78c (on 4f10c5fd, with kit tree d7e50b5d). They are under ~/cogniate-qa-runs/LA/GATE/ (paths in §10(a)).
- tests/ltiaas/GATE-RUN-PLAN.md §10 (the run list, slots, owners, ports and subnets, a 226-minute critical path).
- docs/reviews/LA-E0-02/qa.md Round 2 (the later G-BASE baseline evidence, with the legacy-rate parts pending baseline-3).
For the format and precedent, read the earlier addenda and their reviews (docs/reviews/LA-E7-08/ld9-addendum-r6.md, r7.md and the *-reviewer-*.md files).
Check:
1. For each combined file, the B/C change and the LA addendum change together change no assertion beyond what r1–r7 approved. B/C's own test fixes stay as B/C wrote them.
2. Each gate source tree is what §10(a) says: 0 non-test diff from its product SHA, the LD-1 overlay, and the right addenda. baseline-3 must carry only the addenda that apply to a baseline. LD-25 holds: each suite uses the same test content in both runs.
3. The plan reruns every suite of the D1/D2 double run, plus the golden compare against baseline-3 (each difference names its LA-IC or its B/C commit: AC-LA-E0-01-04), the 5-channel kit K1 in D3 and D4, the 6-channel walk-clone run and K2. It gives a reason for each suite that it does not rerun. The Docker rules hold: at most 2 LA stacks, one Moodle stack at a time, distinct ports and subnets, and no sto-* touch.
4. The baseline-3 runs close the LA-E0-02 gaps (A-LA-E0-02-01, B-LA-E0-02-01): one result and time per legacy group T2a–T8, and the app and LTI rate peaks for T7, M1 sim and the legacy groups.
Run host-only checks (the patch applies, the trees hash as stated, host self-tests) in a private `git clone --no-hardlinks`. Do not start Docker. Write docs/reviews/LA-E7-08/ld9-addendum-r8-reviewer-a.md (Round: 1). Also add a short "## Round 2" to docs/reviews/LA-E0-02/reviewer-a.md, on the qa.md Round 2 reconciliation only (the baseline-3 parts stay pending).

Integration worktree rule: read only. Never run npm ci, npm install, git clean, git checkout or git reset there.

# Common rules for LA build-task reviews (Reviewer-A, Reviewer-B)

You continue the dedicated reviewer role of G-DESIGN, G-BREAKDOWN and the earlier build rounds. Lenses: Reviewer-A "Is it right and is it safe?", Reviewer-B "Can a human team own it?" (base charter §1). Review the task diff named in the dispatch against its task spec (docs/architecture/ltiaas/tasks/<task>.md), the design (docs/architecture/ltiaas/**) and plan §6.1. Read the diff with git in the LA integration worktree /Users/quangnguyen/orca/workspaces/cogniate_moodle_integration_prototype/ltiaas-milestone; do not change any file except your review file.
Write docs/reviews/LA-<task>/<reviewer-a|reviewer-b>.md: first lines "Verdict: APPROVE | CHANGES_REQUESTED" and "Round: n"; findings with id (A-<task>-nn / B-<task>-nn), severity (base charter §5), file:line, problem, evidence, suggested fix. Proportional: small diff, short review. Check: every UNIT AC has a test that would fail on the old behaviour; the "Must not edit" list is respected; no behaviour change outside the spec; no LMS name added to core paths; ownership (matrix §5). Blind review: never open the other reviewer's file. Do not run Docker. Do not commit.
When done: one worker_done (--outcome succeeded), three-sentence summary with the verdict and counts, --files-modified, --report-path. Then stop. Read only your own messages.
