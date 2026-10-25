# Milestone LA final report: LTI as a Service v1

Owner: Lead. Status: **final** (2026-10-25). Orca run `run_06d07dc77faf`. Integration branch `quang/ltiaas-milestone` (closing HEAD: see §2).
This milestone has no push or main-merge authorization. All commits are local.

## 1. Result

The milestone-done rule ([charter-LA §2](charter-LA.md)) has four parts. All four are met on the final product SHA `4f10c5fd`:
1. **All in-scope epics are done.** Every Must task has QA PASS and both reviews APPROVE. Each Should and Could task is done, cut by a recorded decision, or waits for a named product-owner decision (§5, §7).
2. **M1, M2 and T7 pass at the final SHA.** The double full run D3 and D4 on `4f10c5fd` passes under LD-25, LD-29, LD-31 and LD-32 ([LA-E7-08 qa](../../reviews/LA-E7-08/qa.md) Final state and §14; [run-D4.md](../../reviews/LA-E7-08/run-D4.md); [LA-E7-09 qa](../../reviews/LA-E7-09/qa.md) Round 7). LA-E7-08 and LA-E7-09 have A and B APPROVE.
3. **Architect conformance is APPROVE** on `4f10c5fd`: A1 round 3 (`75025c30`) and A2 round 2 (`3f2d8730`).
4. **Both reviewers reviewed the docs:** LA-E8-01 to LA-E8-04 are APPROVE, and LA-E8-05 (the whole review pack, [docs/human_review/ltiaas/](../../human_review/ltiaas/start-here.md)) is A and B APPROVE in round 4, with 0 open findings.

At close-out the Lead found that the Blackboard and Canvas (B/C) final result had never been merged into LA, although LA-H10 (a) asked for it. The product owner chose LA-H27 (a). So the final SHA moved from `a8bbac53` (the first final runs, D1 and D2) to `4f10c5fd`, and the whole gate ran again.

## 2. Final SHAs

| Item | SHA | Source |
| --- | --- | --- |
| Final product | `4f10c5fd` = `a8bbac53` + main `78971b03` (the B/C final result; only the player HTML tracker repair is product code) | merge `4f10c5fd`; [plan §6.2 LA-H27](plan.md) |
| Re-gate sources | baseline-3 `1ae6716b` on `78971b03`; `la-final-test-3` `794f649c` on `4f10c5fd` | [GATE-RUN-PLAN §10](../../../tests/ltiaas/GATE-RUN-PLAN.md); [LD-9 addendum r8](../../reviews/LA-E7-08/ld9-addendum-r8.md) (A and B APPROVE round 3) |
| Kit runs | integration `99338e52` clone (product diff to `4f10c5fd` = 0 lines), kit tree `d7e50b5d` (LD-32) | LA-E7-08 qa §14 |
| Golden | v2 with the Moodle segment; baseline on `78971b03`; the G-BASE v1 record on `1b17261` is kept | [LA-E0-03 qa](../../reviews/LA-E0-03/qa.md) Round 6 |
| First final runs | product `a8bbac53`; `la-final-test-1` `85ddf973`, `la-final-test-2` `68b2e909` | LA-E7-08 qa §13, run-D2.md |
| Integration closing HEAD | the commit that adds this report and closes the board (parent `93f15fe6`) | `git log -1` |

The Lead's final fresh-clone check on `93f15fe6`: the product diff against `4f10c5fd` is 0 lines; `npm run check` exit 0 (204 files, 3324 unit tests passed, 5 skipped; K0 149/149; `F1 PASS: 0 hits`; `F5 PASS: 6 rules, 0 hits`); kit K0 33/33; golden K0 12/12.

## 3. Success measures (plan §4)

| # | Measure | State | Evidence |
| --- | --- | --- | --- |
| 1 | A new LTI LMS profile changes 0 core files | **PASS** | E2-N: brightspace `F2 PASS: core = 0, paths = 4` ([LA-E2-05 qa](../../reviews/LA-E2-05/qa.md)); walkthrough acme-lms `core = 0, paths = 8` ([LA-E8-02 qa](../../reviews/LA-E8-02/qa.md)) |
| 2 | No LMS name in core code; lint ratchet at zero | **PASS** | `npm run check` on `4f10c5fd`: 3324 unit tests, K0 149/149, `F1 PASS: 0 hits`, `F5 PASS: 6 rules, 0 hits` (Lead fresh clone; QA's own run in [LA-E0-01 qa](../../reviews/LA-E0-01/qa.md) Round 2) |
| 3 | M1, M2, T7 pass; assertions change only by LD-1 and the LD-9 lists | **PASS** | D3 and D4: M1 394/394, M2 64/64, T7 3 × (17 + skip); LD-1 ([LA-E0-04](../../reviews/LA-E0-04/)); LD-9 addenda r1–r8; empty lists LD-23, LD-26 |
| 4 | lti-generic and the new named LMS pass the kit (K0 + K1) on the simulator | **PASS** | D3 and D4 kit 195/195 on 5 channels (LD-32); walk clone 234/234 on 6 channels; kit K0 33/33 ([LA-E7-06](../../reviews/LA-E7-06/)) |
| 5 | A person or agent new to the repo adds a simulator LMS in less than 1 day | **PASS** | 8 min 49 s; LA-E8-02 QA 5/5, A and B APPROVE |
| 6 | E5 Must items pass on the simulator | **PASS** | LA-E5-03, -14 (`429`); LA-E5-02, -11, -12 (audit); LA-E5-10 AC-06 (rotation); LA-E5-13 isolation (rerun on `4f10c5fd`) |

## 4. Gates and runs on the final SHA

| Run | Result | Evidence |
| --- | --- | --- |
| R1 baseline-3 (`78971b03`) | M1 394/394, M2 64/64, T7 3 × 17 + skip, T2a–T8; rate peaks for all classes (BD-A2-114: the defaults stand) | [LA-E0-02 qa](../../reviews/LA-E0-02/qa.md) |
| D3 and D4 (`4f10c5fd`) | M1 394/394, M2 64/64, T7 3 × 17 + skip, T2a–T8 equal per test id against baseline-3, golden 297 approved differences each (0 unexplained, 0 missing), kit 195/195 each | LA-E7-08 qa §14, run-D4.md, [per-test-id-D3-D4.md](../../reviews/LA-E7-08/per-test-id-D3-D4.md) |
| K2 round 6 (`4f10c5fd`) | 12/12 K2, 19/19 runner ids | [LA-E7-07 qa](../../reviews/LA-E7-07/qa.md) |
| Walk clone r2 | 234/234, 6 channels | LA-E8-02 qa Round 3 |

Recorded events. None of them counts as PASS, and each has its evidence in LA-E7-08 qa §14:
- The H1 inspect race (136), and its recovery (142).
- A retry by the old session, which failed PRE and started no stack.
- The kit gate-overlay assembly defect (141, 0 tests). The kit runs moved to the integration clone (LD-32): 144 and 161.
- The D4 M1 overlap isolation finding (151), and its solo rerun (162; LD-31 amendment).
- WE-F14, the T5b AC-T5-30 status race (158), and its solo rerun (163).
- The baseline-3 T8 AC-T8-03/07 FAIL (129), and its solo retry (170) PASS, so 129 is a baseline flake.
- The M3 foreign-state (`sto-*`) environment notes.
- A 42-second gap in the D3 Docker-event capture.

## 5. Epics

| Epic | State | Notes |
| --- | --- | --- |
| E0 Baseline intake | done | LA-E0-01 (with the B/C merge), -02 (baseline-3), -03 (golden v2), -04: QA PASS, A and B APPROVE |
| E1 Channel kernel | done | |
| E2 Generic LTI and the new named LMS | done, except LA-E2-07 | LA-E2-07 (Could) cut (LD-11/LD-16) |
| E3 LTI Advantage | done, except 3 Shoulds | LA-E3-08, -14 wait for LA-H22; LA-E3-10 waits for LA-H4 |
| E4 Learning-record core | done, except 2 Shoulds | LA-E4-04 QA PASS at close-out. LA-E4-06 cut (LD-28). LA-E4-08 waits for LA-H22 |
| E5 Operability and security | done | LA-E5-13 fix round 1 at close-out (A and B APPROVE round 2) |
| E6 Self-serve onboarding (Could) | partly done | LA-E6-01, -02, -04, -05 done (LA-E6-04 QA PASS at close-out). LA-E6-03, -07 wait for LA-H24. LA-E6-06 cut |
| E7 Conformance kit and CI | done, except 2 | LA-E7-06 kit done (rounds 8, 9). LA-E7-07, -08, -09 done. LA-E7-11 waits for LA-H9. LA-E7-12 cut (LD-28) |
| E8 Docs and hand-over | done | LA-E8-01..05: A and B APPROVE (LA-E8-05 round 4) |

## 6. Decisions made in LA (the last two days)

Lead decisions ([plan §6.1](plan.md)):
- LD-23 and LD-26: empty LD-9 lists.
- LD-24: the M1-41 ledger assertion.
- LD-25: the identical-run rule.
- LD-27: the kit round 7 fix inside the live window.
- LD-28: two cuts to LG.
- LD-29: the re-gate after the B/C merge.
- LD-30: the kit WALK-02 fix.
- LD-31 and its amendment: one Moodle-lane workload at a time; M1, M2 and K2 run alone among the LA stacks; isolation changes caused only by `sto-*` are environment notes.
- LD-32: the kit runs from the integration clone.

Architect rulings:
- BD-A1-121: the recorded registration-guard deviation.
- BD-A2-114: the registration rate defaults stand.

Product-owner decisions:
- LA-H25 (a), then a narrow fix, then the live window.
- LA-H27 (a): the B/C merge and the full re-gate.
- Docker: up to 2 LA stacks.
- An extra LA-E8-01 round.
- When the Antigravity quota ends, the QA sessions move to Codex GPT-6-Astra xhigh. This happened at about 20:20Z; one Codex conductor finished the re-gate.

## 7. Open human decisions

| Id | Decision | Blocks |
| --- | --- | --- |
| LA-H4 | Privacy: claims per channel, retention, learner erase scope | LA-E3-10 |
| LA-H9 | 1EdTech membership and the certified product shape | LA-E7-11 |
| LA-H22 | Offer ungraded items | LA-E3-08, LA-E3-14, LA-E4-08 |
| LA-H24 | The verified-admin-launch authority, after a security review | LA-E6-03, LA-E6-07 |
| LA-H26 | A real open-source LMS (Open edX, then Sakai) for a live new-channel proof | LG live proof |

LA-H3 (real test sites) stays open, so the live Canvas, Blackboard and D2L rows are not an LA gate (plan §4).

## 8. Deferred work

[deferred.md](deferred.md) has 88 rows: 42 MINOR, 33 NIT, 3 flake findings (WE-F10 closed; WE-F12 and WE-F14 open, both frozen-test races with an LD-9 fix in LG), 5 scope rows (the cuts and the BD-A2-111 gap), and 5 others. 13 rows are closed. 17 rows name LG. No MAJOR or BLOCKER is open; the one MAJOR candidate, the kit closed list, is closed.

## 9. Incidents that affect trust in the evidence

- **The missed B/C final merge (Lead error).** Found by the LA-E0-01 evidence review. Fixed by LA-H27 (a) and the full re-gate.
- **QA rounds and reviews missing at close-out:** LA-E4-04 and LA-E6-04 had no QA round, and LA-E0-01..03, LA-E5-13, LA-E7-07, LA-E7-08 and LA-E8-02 had no reviews. The reviews found real gaps (the B/C merge, the legacy baseline and rates, the Moodle golden segment, two false-green isolation oracles, and wrong carried U1 citations). All of them are fixed.
- **A golden provenance error,** caught by the Lead before integration. The G-BASE v1 record was restored byte-exactly.
- **The Antigravity quota ended mid-re-gate.** The Lead fenced the agy dispatches and started a Codex conductor. One old session still started a retry (PRE FAIL, no stack) before it read the fence, so the Lead exited the old sessions. Rule: exit a replaced agent process as well as fencing it.
- **Gate-plan command and assembly defects:** golden normalization, the K1 wave input, and the kit dispatcher lost by the overlay. Each was caught by review, by a dry run or by a 0-test FAIL, never accepted as PASS.
- 2026-10-24: a host reboot; the Docker Desktop auto-update (G-1 result 2); restored sessions without their permission flag; one worker report lost by the wait helper and then recovered.

## 10. Closure

The milestone is done (2026-10-25). Nothing is left in LA. The product owner has the open decisions in §7 and the LG items in deferred.md.

## 11. Release to main (LA-H28)

The product owner authorized the release directly in the Lead chat (plan §6.2 LA-H28): push, a PR into main, the merge, an origin/main check, archive tags, and removal of the linked LA worktrees.

Before the release, one unclosed item was closed. The approved LD-1 overlay and the LD-9 addenda r1–r8 existed only in the gate sources, so integration's frozen tests were not the tests that the final gate ran. QA built the release test tree: each of the 49 differing files is byte-identical to the tested gate tree la-final-test-3 (34 files) or to integration's tested post-gate QA addition (15 files). See [release-test-tree.md](../../reviews/LA-E7-08/release-test-tree.md). The tests tree is `023ecdab`. Two independent Claude Opus 5.5 xhigh reviewers approve it (docs/reviews/LA-RELEASE/). The deferred row "LD-1 K0 location" is closed.

The release candidate checks: the product diff against `4f10c5fd` outside docs/ and tests/ is 0 lines. The Lead's fresh-clone check on `52a9d8b4` passes `npm run check` (3324 unit tests, K0 151), kit K0, golden K0, the host self-tests and `npm ci --prefix tests`. Later commits change docs only, and the tests tree stays `023ecdab`.

Branch disposition:
- The 8 author lanes and la-docs are fully contained in integration.
- la-qa's 180 commits are QA history that was copied into integration by path; integration holds every file. It is kept as the tag `archive/la-qa`.
- la-walk is the LA-E8-02 walkthrough scratch branch. Its spec says "never merged", so it is kept as the tag `archive/la-walk`.

Post-merge facts (2026-10-25):
- PR #2 (https://github.com/nguyenthanhquang152/cogniate_moodle_integration_prototype/pull/2) merged at 06:00:57Z as the merge commit `74dc2811` (parents `78971b03`, the old main, and `a5d25ced`, the candidate). `git fetch` shows origin/main = `74dc2811`. Its tree equals the candidate tree, and its tests tree is `023ecdab`.
- The archive tags are pushed: `archive/la-qa` points to `091c35c7`, and `archive/la-walk` points to `d6196d52`.
- Sessions: every run dispatch is settled. The six idle LA Antigravity sessions in la-qa were exited; their conversations stay resumable outside the repo.
- Worktrees: the 11 linked LA worktrees (la-docs, la-k, la-l, la-l2, la-p, la-qa, la-r, la-s1, la-s2, la-walk, ltiaas-milestone) were removed via Orca (`orca worktree rm`). First, their ignored, non-rebuildable content was copied and verified identical: la-qa tests/host/artifacts (1273 files), la-r/.tmp and ltiaas-milestone/.tmp. The copies are in ~/cogniate-qa-runs/LA/ARCHIVE/worktree-ignored. Orca deleted 7 of the merged local branches; each was recreated at its recorded SHA, so all 11 local branches remain. The main-2 checkout (main) and the primary checkout feat/moodle-lti-prototype, with its .git, are kept.
- The local run evidence stays under ~/cogniate-qa-runs/LA, including the gate-source clones.
