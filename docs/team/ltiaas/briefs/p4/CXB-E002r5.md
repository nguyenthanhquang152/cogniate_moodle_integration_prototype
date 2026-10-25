# Review dispatch: Reviewer-B (Codex, same session), LA-E0-02 round 5 (the baseline-3 results)

Item 1: LA-E0-02 round 5. The lead QA ran Slot R1 on baseline-3 (1ae6716b on B/C final 78971b03; qalead-la-120..129; la-qa 9614cf03; integration 35b71b98). Diff: `git diff 56261ed6 35b71b98 -- docs/reviews/LA-E0-02/qa.md docs/reviews/LA-E7-08/qa.md`. QA reports 9/9 ACs PASS and asks to close A-LA-E0-02-01 and B-LA-E0-02-01:
- M1 sim 394/394; M2 64/64 (run alone); T7 3 × (17 PASS + 1 skip).
- Legacy T2a–T6 all PASS, with one result and time per group.
- T8 main ACs PASS. AC-T8-03 and AC-T8-07 (the BUILD_RUNNER_HOLD and BUILD_RUNNER_FAIL_AT knob cases) FAIL in qalead-la-129. QA records them under AC-09 as "pre-WE-F6 :ro VirtioFS build_hold cache-visibility timeouts": WE-F6 is the approved LD-9 addendum r2 test fix, which baseline-3 does not carry.
- 11 rate-peak files: app and LTI classes for T7, M1 sim and the legacy groups.
Check:
1. Each count against the raw summary.json files under ~/cogniate-qa-runs/LA/REGATE/slot-r1/artifacts/ (name each path).
2. The rate peaks meet AC-06 and AC-07.
3. The AC-T8-03/07 diagnosis. Is it supported by evidence? Is it right to leave WE-F6 out of baseline-3 under LD-25 and §10, or should baseline-3 have carried it, as an approved harness fix? What does that mean for the D3/D4 per-test-id comparison (D1/D2 passed AC-T8-03/07 with WE-F6)? If a difference stays, it must have a recorded reason; it must never be shown as equal.
Host only; do not start Docker (D3 and D4 are running). Add "## Round 5" to docs/reviews/LA-E0-02/reviewer-b.md; keep the first lines "Verdict:" and "Round:" current.

Integration worktree rule: read only. Never run npm ci, npm install, git clean, git checkout or git reset there.

# Common rules for LA build-task reviews (Reviewer-A, Reviewer-B)

You continue the dedicated reviewer role of G-DESIGN, G-BREAKDOWN and the earlier build rounds. Lenses: Reviewer-A "Is it right and is it safe?", Reviewer-B "Can a human team own it?" (base charter §1). Review the task diff named in the dispatch against its task spec (docs/architecture/ltiaas/tasks/<task>.md), the design (docs/architecture/ltiaas/**) and plan §6.1. Read the diff with git in the LA integration worktree /Users/quangnguyen/orca/workspaces/cogniate_moodle_integration_prototype/ltiaas-milestone; do not change any file except your review file.
Write docs/reviews/LA-<task>/<reviewer-a|reviewer-b>.md: first lines "Verdict: APPROVE | CHANGES_REQUESTED" and "Round: n"; findings with id (A-<task>-nn / B-<task>-nn), severity (base charter §5), file:line, problem, evidence, suggested fix. Proportional: small diff, short review. Check: every UNIT AC has a test that would fail on the old behaviour; the "Must not edit" list is respected; no behaviour change outside the spec; no LMS name added to core paths; ownership (matrix §5). Blind review: never open the other reviewer's file. Do not run Docker. Do not commit.
When done: one worker_done (--outcome succeeded), three-sentence summary with the verdict and counts, --files-modified, --report-path. Then stop. Read only your own messages.
