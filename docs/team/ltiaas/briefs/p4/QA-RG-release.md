QA re-gate conductor (Codex GPT-6-Astra xhigh, same session; new dispatch): the release test tree. Host only, no Docker. Work in la-qa (branch nguyenthanhquang152/la-qa). Merge quang/ltiaas-milestone (58b81bb2 or later) into la-qa first. You never read product source.

Why: the product owner asked to publish the accepted LA candidate to main. Integration's tests/ differs from the tree that the final gate ran (la-final-test-3, 794f649c, ~/cogniate-qa-runs/LA/GATE/src-final-3) in 49 files. List them with `git diff --stat 794f649c <integration HEAD> -- tests`. The approved LD-1 open-world overlay and the approved LD-9 addenda r1–r8 (including the r6 Docker identity in tests/host/storage-docker.mjs) exist only in the gate sources and in la-qa. deferred.md row "LD-1 K0 location" says: "merge the overlay into integration after the milestone gate". That is this task. main must carry the tests that were actually run.

Rule for each of the 49 files. Choose exactly one source, and make the file byte-identical to it:
- A, integration's version: the post-gate QA additions that were tested in their own runs. These are tests/ltiaas/tasks-qa/** (LA-E4-04, LA-E5-13, LA-E6-04), tests/ltiaas/GATE-RUN-PLAN.md, and tests/acceptance/run-api.mjs (the K1 dispatcher; LD-32; the kit runs 144/161 used integration 99338e52). For run-api.mjs, also prove that its only difference from the gate version is the K1 dispatcher lines, so that every frozen suite runs the same code as in D3/D4.
- B, the gate version (794f649c): the LD-1 overlay files and the LD-9 r1–r8 files that D3/D4 ran. This includes tests/host/core.mjs (the qalead-la-* names), the M1 and M2 overlay files, tests/ltiaas/k0/ld1/*, and tests/ltiaas/lib/open-world.* (the round 3 versions that read the overlay files).
- If neither source is clearly the tested version, do not guess: list the file and ask the Lead.
Record a table in docs/reviews/LA-E7-08/release-test-tree.md with these columns: file, source (A or B), blob hash, the evidence that it was tested (run ids), and the reason.

Checks in a fresh `git clone --no-hardlinks` of the reconciled la-qa commit (npm ci first):
- npm run check (lint, typecheck, unit, infra, K0 including the ld1 open-world tests, F1 0, F5 0).
- Kit K0, golden K0, all tests/host/*.selftest.mjs, and the LD-1 open-world tests.
- The M2 and K2 discovery harness checks that you used in r8.
- Show that `git diff <reconciled> 794f649c -- tests` contains only the category-A files, and that every category-B file is byte-identical to 794f649c.
If any check fails, stop and tell the Lead. Do not change a file to make a check pass.

Commit in la-qa ("QA: release test tree (LD-1 overlay and LD-9 r1–r8 from la-final-test-3; post-gate QA additions)"). Send worker_done with the SHA, the tests/ tree hash, the check counts and the table path, and stop. The Lead sends this for independent review, then integrates it.
