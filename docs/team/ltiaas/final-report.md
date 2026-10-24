# Milestone LA final report: LTI as a Service v1

Owner: Lead. Status: **DRAFT, re-gate running** (2026-10-24). Orca run `run_06d07dc77faf`. Integration branch `quang/ltiaas-milestone`.
This milestone has no push or main-merge authorization. All commits are local.

## 1. Result

The milestone-done rule ([charter-LA §2](charter-LA.md)) has four parts:
1. All in-scope epics are done.
2. M1, M2 and T7 pass at the final SHA.
3. Architect conformance is APPROVE.
4. Both reviewers have reviewed the docs.

The first final runs (D1 and D2) passed on product `a8bbac53`. At close-out the Lead found that the Blackboard and Canvas (B/C) final result had not been merged into LA, although LA-H10 (a) asked for it. The product owner chose LA-H27 (a): merge it, and repeat the full gate. The new final product SHA is `4f10c5fd`.

State now:
- Part 3 is met on `4f10c5fd`: A1 conformance round 3 APPROVE (`75025c30`) and A2 conformance round 2 APPROVE (`3f2d8730`).
- Part 2: PENDING. The baseline-3 runs (R1) and the double full run D3/D4 on `4f10c5fd` are running (LD-29).
- Part 1: PENDING on the re-gate tasks: LA-E7-08, LA-E7-09 AC-05, LA-E0-01 AC-04/05 and LA-E0-02 (the baseline-3 parts).
- Part 4: PENDING on the LA-E8-05 part 3 round and its reviews.

## 2. Final SHAs

| Item | SHA | Source |
| --- | --- | --- |
| Final product | `4f10c5fd` = `a8bbac53` + main `78971b03` (B/C final) | merge commit `4f10c5fd`; [plan §6.2 LA-H27](plan.md) |
| First final runs (D1, D2) | product `a8bbac53`; gate sources `la-final-test-1` `85ddf973`, `la-final-test-2` `68b2e909` | [LA-E7-08 qa §13](../../reviews/LA-E7-08/qa.md), [run-D2.md](../../reviews/LA-E7-08/run-D2.md) |
| Re-gate sources (LD-29) | baseline-3 `1ae6716b` (on `78971b03`); `la-final-test-3` `794f649c` (on `4f10c5fd`) | [GATE-RUN-PLAN §10](../../../tests/ltiaas/GATE-RUN-PLAN.md); [LD-9 addendum r8](../../reviews/LA-E7-08/ld9-addendum-r8.md) |
| Kit tree | `d7e50b5d` (after the WALK-02 fix, LD-30) | [LA-E7-06 qa](../../reviews/LA-E7-06/qa.md) Round 9 |
| Golden | v2 with the Moodle segment; baseline on `78971b03`; G-BASE v1 record on `1b17261` kept | [LA-E0-03 qa](../../reviews/LA-E0-03/qa.md) Round 6 |
| Integration HEAD | PENDING (close) | `git log` |

## 3. Success measures (plan §4)

| # | Measure | State | Evidence |
| --- | --- | --- | --- |
| 1 | A new LTI LMS profile changes 0 core files | **PASS** | E2-N proof: brightspace `F2 PASS: core = 0, paths = 4` ([LA-E2-05 qa](../../reviews/LA-E2-05/qa.md)). The walkthrough channel acme-lms: `core = 0, paths = 8` ([LA-E8-02 qa](../../reviews/LA-E8-02/qa.md)) |
| 2 | No LMS name in core code; lint ratchet at zero | **PASS** | Lead fresh-clone check on `4f10c5fd`: `npm run check` exit 0, 3324 unit tests, `F1 PASS: 0 hits`, `F5 PASS: 6 rules, 0 hits` |
| 3 | M1, M2, T7 pass; assertions change only by LD-1 and the LD-9 lists | PASS on `a8bbac53` (D1, D2); **PENDING** on `4f10c5fd` (D3, D4) | LD-1 approved ([LA-E0-04](../../reviews/LA-E0-04/)); LD-9 addenda r1–r8 ([LA-E7-08](../../reviews/LA-E7-08/)); empty lists LD-23, LD-26 |
| 4 | lti-generic and the new named LMS pass the kit (K0 + K1) on the simulator | **PASS** on `a8bbac53`; the D3/D4 kit runs PENDING | Kit r8 195/195 on 5 channels (round 8 A and B APPROVE). Walk clone r2 234/234 on 6 channels with kit `d7e50b5d` (round 9 A and B APPROVE) |
| 5 | A person or agent new to the repo adds a simulator LMS in less than 1 day | **PASS** | 8 min 49 s; LA-E8-02 QA 5/5 PASS, A and B APPROVE ([LA-E8-02](../../reviews/LA-E8-02/)) |
| 6 | E5 Must items pass on the simulator | **PASS** | LA-E5-03, -14 (`429`); LA-E5-02, -11, -12 (audit); LA-E5-10 AC-06 (rotation); LA-E5-13 isolation, re-run on `4f10c5fd` |

## 4. Gates and runs

| Run | Product | Result | Evidence |
| --- | --- | --- | --- |
| Wave-end gate (slots 3B–8e) | `8fadb828` | PASS (LA-E7-08 AC-01, -03..-06; LA-E7-09 AC-01..-04) | [LA-E7-08 qa §8–§11](../../reviews/LA-E7-08/qa.md) |
| Slot 3F | `a8bbac53` | PASS | [LA-E7-08 qa §12](../../reviews/LA-E7-08/qa.md) |
| D1 and D2 | `a8bbac53` | PASS per LD-25 (WE-F13 and two D2 load flakes recorded; each rerun PASS) | §13, run-D2.md |
| Kit K1-SIM r8 | `a8bbac53` | 195/195, 5 channels | LA-E7-06 qa Round 8 |
| Walk clone r2 (kit `d7e50b5d`) | `a8bbac53` + acme-lms | 234/234, 6 channels | LA-E8-02 qa Round 3 |
| K2 round 6 | `4f10c5fd` | 12/12 K2, 19/19 runner ids | LA-E7-07 qa Round 6 |
| LA-E5-13 SIM | `4f10c5fd` | 5/5 ACs, 100 cross-tenant calls, 0 victim diffs | LA-E5-13 qa Round 2 |
| Golden v2 | `78971b03` x2, `4f10c5fd` dry run | EQUAL; 297 differences, all explained | LA-E0-03 qa Round 6 |
| R1 baseline-3 | `78971b03` | PENDING | LA-E0-02 qa; GATE-RUN-PLAN §10 |
| D3 and D4 | `4f10c5fd` | PENDING | GATE-RUN-PLAN §10 |

Findings and flakes (TEST-STRATEGY §2.6: a FAIL or a flake never counts as PASS): WE-F1..F13 as recorded ([LA-E7-08 qa](../../reviews/LA-E7-08/qa.md)); WE-F12 deferred to LG; the D2 load flakes (T7 run 2, M2-11); kit findings WALK-01 and WALK-02 (closed).

## 5. Epics

| Epic | State | Notes |
| --- | --- | --- |
| E0 Baseline intake | PENDING (re-gate) | LA-E0-03 and -04 done. LA-E0-01: the B/C merge is done (`4f10c5fd`); AC-04/05 are recorded after D3. LA-E0-02: baseline-3 runs (R1) running |
| E1 Channel kernel | done | |
| E2 Generic LTI and the new named LMS | done, except LA-E2-07 | LA-E2-07 (Could) cut by LD-11/LD-16 |
| E3 LTI Advantage | done, except 3 Shoulds | LA-E3-08, -14 wait for LA-H22; LA-E3-10 waits for LA-H4 |
| E4 Learning-record core | done, except 2 Shoulds | LA-E4-04 QA PASS at close-out (it had none). LA-E4-06 cut (LD-28). LA-E4-08 waits for LA-H22 |
| E5 Operability and security | done | LA-E5-13 fix round 1 at close-out (2 MAJOR oracle gaps); A and B APPROVE round 2 |
| E6 Self-serve onboarding (Could) | partly done | LA-E6-04 QA PASS at close-out (it had none). LA-E6-03, -07 wait for LA-H24. LA-E6-06 cut |
| E7 Conformance kit and CI | PENDING (re-gate) | LA-E7-06 kit done (rounds 8 and 9). LA-E7-07 done. LA-E7-08 and LA-E7-09 AC-05 re-run on `4f10c5fd`. LA-E7-11 waits for LA-H9. LA-E7-12 cut (LD-28) |
| E8 Docs and hand-over | PENDING (LA-E8-05 part 3) | LA-E8-01, -02, -03, -04 done |

## 6. Decisions made in LA (today's)

Lead decisions ([plan §6.1](plan.md)):
- LD-23 and LD-26: empty LD-9 lists (LA-IC-02, -05, -10, -11; LA-IC-24).
- LD-24: the M1-41 ledger assertion.
- LD-25: the identical-run rule after the Docker update.
- LD-27: the kit round 7 fix inside the LA-H25 window.
- LD-28: LA-E4-06 and LA-E7-12 are cut to LG.
- LD-29: the re-gate after the B/C final merge.
- LD-30: the kit WALK-02 fix.
- LD-31: the Moodle-stack rule for the re-gate.

Product-owner decisions:
- LA-H25: (a), then a narrow fix, then the live window.
- LA-H27: (a), merge the B/C final result and repeat the full re-gate.
- Docker: up to 2 LA stacks.
- An extra LA-E8-01 round.
- If the Antigravity weekly quota ends, the QA sessions move to Codex GPT-6-Astra xhigh.

## 7. Open human decisions

| Id | Decision | Blocks |
| --- | --- | --- |
| LA-H4 | Privacy: claims per channel, retention, learner erase scope | LA-E3-10 |
| LA-H9 | 1EdTech membership and the certified product shape | LA-E7-11 |
| LA-H22 | Offer ungraded items | LA-E3-08, LA-E3-14, LA-E4-08 |
| LA-H24 | The verified-admin-launch authority, after a security review | LA-E6-03, LA-E6-07 |
| LA-H26 | A real open-source LMS (Open edX, then Sakai) for a live new-channel proof | LG live proof |

## 8. Deferred work

PENDING (close): the counts by severity and destination from [deferred.md](deferred.md).

## 9. Incidents that affect trust in the evidence

- The missed B/C final merge (Lead error). LA-H10 (a) said "merge its final commits later". B/C merged to main at about 2026-10-23 21:02Z, and LA did not take it. The LA-E0-01 evidence review found it at close-out. Fixed by LA-H27 (a) and the re-gate.
- QA rounds and reviews missing at close-out: LA-E4-04 and LA-E6-04 had no QA round; LA-E0-01..03, LA-E5-13, LA-E7-07 and LA-E8-02 had no reviews. The reviews found real gaps: the B/C merge, the legacy baseline and rates (LA-E0-02), the Moodle golden segment (LA-E0-03), and two false-green isolation oracles (LA-E5-13). Each is fixed or pending in the re-gate.
- A golden provenance error, caught by the Lead before integration: a `78971b03` capture was stored under the `1b17261` name. Fixed, and the G-BASE v1 record was restored byte-exactly.
- 2026-10-24 ~06:05–08:48Z host reboot; Docker Desktop auto-update at 09:19Z (G-1 diagnostic result 2; addendum r6).
- Sessions restored after the reboot came back without their permission flag. The Lead resumed them with the original flag, and no grant was broadened.
- The Lead's wait helper was killed twice and one worker report was not shown. It was recovered from the inbox, and the helper now logs each message before it acknowledges it.
- 2026-10-23: the slot 3B amend, and a stale vitest cache.

## 10. PENDING

- PENDING: R1 baseline-3 runs; LA-E0-02 baseline-3 parts and reviews.
- PENDING: LD-9 addendum r8 round 3 reviews; then D3 and D4 on `4f10c5fd` (LD-29, LD-31), with the golden compare and the kit K1.
- PENDING: LA-E7-08 and LA-E7-09 final rows on `4f10c5fd`; LA-E7-08 evidence review; LA-E0-01 AC-04/05 and round 2 reviews.
- PENDING: LA-E8-05 part 3 and its A and B reviews.
- PENDING: board close, and the closing SHAs in this report.
