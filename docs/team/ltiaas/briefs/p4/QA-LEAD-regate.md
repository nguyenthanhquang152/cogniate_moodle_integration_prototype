Lead QA (same session; new dispatch): the re-gate after the B/C final merge. Part A is host only, with no Docker. Work in la-qa (merge quang/ltiaas-milestone first; it now has the merge 4f10c5fd).

Context: product-owner decision LA-H27 (a) and Lead decision LD-29 (plan §6.1, §6.2). The B/C run committed after G-BASE bd368ff (main 78971b03: 11 commits, 18 non-doc files: apps/player/src/html/tracker.ts and frozen-test fixes). The Lead merged it into LA at 4f10c5fd (clean). The new final product SHA is 4f10c5fd. Every suite of the milestone-end double run must pass again on it, against a re-captured baseline on 78971b03. Four B/C test files are also changed by LA's LD-9 addenda in the gate sources: tests/acceptance/T8/2-shell.spec.ts, tests/host/m1-control.mjs, tests/acceptance/T6/5-xss-a11y.spec.ts and tests/e2e/host/run-t7.mjs. Check every other addendum file against its B/C final version too.

Part A (host only; deliver before any run):
1. LD-9 addendum r8: put the r1–r7 edits on top of the B/C final versions of the overlapping files. For each file, show the B/C change, the LA addendum change, and the combined result. The combined result must change no assertion beyond the meaning that r1–r7 approved. Use the same record format as r6/r7 (docs/reviews/LA-E7-08/ld9-addendum-r*.md).
2. Two gate sources, built as before (fresh clones, explicit commits, never an amend):
   - baseline-3 = 78971b03 with its frozen tests, plus the LD-1 overlay and the addenda that apply to a baseline run;
   - la-final-test-3 = 4f10c5fd tests plus the LD-1 overlay and addenda r1–r8.
   Prove each tree with diffs, as for src-final-1/2. LD-25 applies: each suite uses the same test content in both runs.
3. A new GATE-RUN-PLAN section "Re-gate after the B/C final merge (LD-29)". It gives the run list, owners, slots, ports and subnets (at most 2 LA stacks at once, one Moodle stack at a time), time estimates, and the reason for each rerun or not-rerun. It must include:
   - Baseline-3 runs on 78971b03: M1 sim, M2, T7 x3, and each legacy group T2a–T8 with one result and time per group. Record the rate peaks (app launch and deep-link, and LTI per class) for T7, the M1 sim phase and the legacy groups. These close A-LA-E0-02-01 and B-LA-E0-02-01: see docs/reviews/LA-E0-02/reviewer-a.md and reviewer-b.md.
   - The golden baseline capture x2 on 78971b03 with the Moodle segment (golden v2; the second lead-QA session builds it now: LA-E0-03 fix).
   - The double full run D3 (you) and D4 (the second lead-QA session) on la-final-test-3 / 4f10c5fd. Use the D1/D2 suite set, plus the golden compare against baseline-3: every difference must name its LA-IC or its B/C commit (AC-LA-E0-01-04). Add the kit K1 (tree 8ad870fa; QA-K runs run-k1sim.mjs in a slot that you book), and K2 U1–U4 (QA-E2E) in a free slot.
   - The LA-E5-13 SIM rerun on 4f10c5fd after QA-3's fix round (a slot you book).
4. LA-E0-02 fix round 1, qa.md part: put the later G-BASE baseline evidence (Slot 3D runs 45, 46, 48 and 49, with each FAIL and not-run row and its cause) into AC-04 and AC-09. Mark the legacy-rate parts "pending: baseline-3 (LD-29)" until those runs are done.

Commit in la-qa: "QA: re-gate plan, gate sources and LD-9 addendum r8 (LD-29)". Then send one worker_done with the SHAs, the source tree proofs and the plan's total time, and stop. The Lead sends addendum r8 and the plan to both reviewers. Docker starts only after both approve.
