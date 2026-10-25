Docs lane (same Claude session; new dispatch): LA-E8-01 walkthrough fix. Merge quang/ltiaas-milestone first.

The timed walkthrough (LA-E8-02) passed its time measure: a new walker added the simulator LMS acme-lms in 8 min 49 s. QA-3 recorded 14 findings for the guide: docs/reviews/LA-E8-02/qa.md §3.1 (F-LA-E8-01-L1..L4, the places where the walker left the guide, and F-LA-E8-01-U1..U10, unclear or stale points), each with the step id and line in docs/guides/ltiaas/add-a-channel.md (unchanged since 3880a1b7). The walker's own log is in the la-walk worktree, WALKTHROUGH-LOG.md §4–§5. The LA-E8-02 spec says Docs fixes the guide after a finding.

Do this:
1. Fix each of the 14 findings in docs/guides/ltiaas/add-a-channel.md. Use QA-3's suggested fix, or a better one, and say which in your report. The walker read kernel source for L1. Put the needed facts in the guide, or link to the kernel doc that states them. Do not tell a reader to read source.
2. Do not write test counts ("16 of 16", "25 of 25") in the guide. The kit K0 count changes in the current LA-E7-06 round 7 fix (QA-K). Write the command and "all tests pass, 0 failed". Where a reader must see that the channel loaded (L4, U9), give a check that prints it.
3. L3 and WALK-01: a registration-level guarded family adds a cross-channel `registration_guarded` (`warn_passthrough`) probe for every other channel in L4. State this as expected kit behaviour. Do not write that the kit fails: QA-K closes F-LA-E7-06-WALK-01 in its round and the current kit passes that case (Reviewer-B round 7 canary, 26/26).
4. Keep every "pending QA SIM" label that is still true. Do not cite tests/ltiaas/kit/README.md text that QA-K is changing now (R3 audience, play retry). Cite it after the Lead tells you the kit round is merged.
5. Scope: docs/guides/ltiaas/add-a-channel.md only. If a fix needs another file (for example tests/sim/README.md for U6, or a kernel doc for L1), name the file and the change in your report and do not edit it.

Commit "LA-E8-01 walkthrough fix (F-LA-E8-01-L1..L4, U1..U10)". Status + worker_done with the SHA and a table: finding id → what you changed (or why no change).
