Docs lane (same Claude session; new dispatch): LA-E8-05 final-state round, part 1 of 2. Merge quang/ltiaas-milestone first (96f8e1fc or later). Scope: docs/guides/ltiaas/spec-deviations.md and docs/human_review/ltiaas/** only (LA-E8-05 Files).

The wave-end gate and the milestone-end runs are now done. Bring the pack to the final LA state for every fact that is final now. Three items are not final yet. Give each one an exact label, as in point 7. Part 2 later only changes those labels to results, so that the reviewers review the pack once.

Take every fact from the committed file named here. Check each number in that file. Do not copy it from this brief.
1. AC-LA-E7-09-05, the milestone-end double full run: PASS per LD-25 (plan §6.1) on product a8bbac53. Evidence: docs/reviews/LA-E7-08/qa.md §13, docs/reviews/LA-E7-08/run-D2.md, and docs/reviews/LA-E7-09/qa.md. Gate sources: la-final-test-1 85ddf973 and la-final-test-2 68b2e909 (LD-9 addenda r6 identity, r7 T8 wait). Name the recorded findings with their state: WE-F13 (D1 T8 AC-T8-10, a test race; fixed by addendum r7, T8 rerun PASS), and the D2 flakes under two stacks (T7 run 2, M2-11.blackboard-keyboard; each rerun PASS).
2. The Docker Desktop update during the gate (CLI 29.9.2, compose 5.6.1). The new G-1 diagnostic passed (ADR-012 §17 G-1 result 2; A1 BD-A1-120; A2 BD-A2-113). One line in the evidence notes, linked.
3. LA-IC-01..24 in spec-deviations.md (AC-LA-E8-05-02): every row gets its final status and evidence. The empty LD-9 lists come from LD-23 (LA-IC-02, -05, -10, -11) and LD-26 (LA-IC-24). LD-24 covers the M1-41 ledger assertion. Use docs/architecture/ltiaas/adr/LA-ADR-04 D8, the LD-9 review files, and plan §6.1.
4. BD-A1-121 (docs/architecture/ltiaas/build-decisions-A1.md): this is a recorded product deviation. A desire2learn registration-level guarded family at complete shows 502 REGISTRATION_FAILED, not PROVIDER_PROFILE_MISMATCH. The fix is in LG. Add it as a deviation row or a known-limit row, with its LA-IC-24 link.
5. Architect conformance: A1 APPROVE (round 2) and A2 APPROVE (docs/architecture/ltiaas/conformance-A1.md, conformance-A2.md), with the follow-ups that the deferred list names.
6. The round 2 MINORs: A-LA-E8-05-02 and B-LA-E8-05-02 (the U1 starting builds), and A-LA-E8-05-03 (cite the outbox wait proof in its row). See docs/reviews/LA-E8-05/reviewer-a.md and reviewer-b.md, Round 2.
7. The labels for the 3 items that are not final:
   - AC-LA-E7-08-02, the kit K1 run for every channel: "pending: kit round 8 (LD-27)". You may state that the r7 live run gave 195/195 (docs/reviews/LA-E7-06/qa.md). Say that the round 7 reviews asked for oracle fixes before acceptance. Do not call it PASS.
   - LA-E8-02 (plan §4 measure 5): the walkthrough took 8 min 49 s. AC-01, -02, -04 and -05 PASS (docs/reviews/LA-E8-02/qa.md Round 1). AC-03, the acme-lms K1-SIM run: "pending: kit round 8 (LD-27)".
   - LA-E8-01: the guide has the walkthrough fix (77f58f62). Label: "round 5 review pending".
8. Decisions page: LA-H25 is decided ((a), then the narrow fix, then the live window; LD-27). LA-H26 is open (a live open-source LMS for the new-channel path, in LG). Keep the other open decisions (LA-H4, LA-H9, LA-H22, LA-H24) as plan §6.2 states them.
9. Remove each "pending: wave-end gate" label. Keep the rule: no page claims a real-LMS result without a LIVE row. After the change, index.html must still open with no network request (AC-LA-E8-05-05).

Commit "LA-E8-05 final-state round part 1 (D1/D2, LA-IC, BD-A1-121, MINORs)". Send status and worker_done with the SHA and a list of every label still pending. No reviews start before part 2.
