# Task board

Only the Lead edits this file. Task specs live in `docs/architecture/tasks/`. Order = critical path (see the task DAG in `docs/architecture/README.md`).

## Blackboard and Canvas phase — 2026-10-20

Branch: `nguyenthanhquang152/lti-multi-lms`. Current [phase plan](multi-lms-plan.md).
The Moodle release below is the completed baseline.

| Task | Owner | Status | Evidence |
| --- | --- | --- | --- |
| M0 | Architect; independent QA and reviewers | Revision 6 in independent round 3 | Frozen design `158a4d8`. Round-2 findings at `706a278` await independent closure. No design approval yet. |
| M1 | Author (Claude) | Planned; design gate required | Backend implementation task queued. |
| M2 | Author-2 (Codex) | Planned; design gate required | Portal task queued in its own worktree. |
| M3 | QA (Codex), QA-E2E (Claude) | Planned | Environment preflight complete. Real Canvas and Blackboard checks remain unverified. |
| M4 | Docs and Architect | Planned | Guides, review pack, final conformance. |

No implementation or product verification is complete for this phase. No push is authorized.

## Completed Moodle baseline

| # | Task | Title | Owner | Status | Round | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| — | T1-spike | Moodle dev environment spike | Author | done | — | Unreviewed. Facts in `infra/moodle/SPIKE-NOTES.md`. |
| 0 | T0 | Architecture, contracts, task specs, rea decision | Architect | **done** | 3 | A APPROVE (R2), B APPROVE (R3), QA PASS (R3). Deferred: A-T0-22/23 NITs, B-T0-26 NIT, Q-T0-43 (→ T2a H14), Q-T0-44 NIT. |
| 1 | T1 | Monorepo skeleton + local HTTPS stack (Moodle 5.2) | Author | **done** | 2 | R2: QA PASS 13/13 + hooks, A APPROVE, B APPROVE. Deferred MINOR: A-T1-02 rest, A-T1-03, A-T1-05; NIT: Q-T1-04. (A-T1-08, A-T1-09, B-T1-03, B-T1-10, B-T1-11 later fixed.) |
| 2 | T5-spike | Player de-risk: frames, CSP, SCORM API, HTML signals | Author | **done** | — | Unreviewed. 07e8a45. Own SCORM 1.2 subset; frame-ancestors {content} {app}; sandbox allow-scripts allow-same-origin. |
| 3 | T2a | LTI core: platforms, keys/JWKS, OIDC launch, ltik, `/api/idtoken` | Author | **done** | 1 | QA PASS 16/16 (a2a5aa3), A APPROVE, B APPROVE. MINORs carried into T2b: A-T2a-01/02, B-T2a-01..04. |
| 3b | T2b | Negative launch checks, qa-platform.test, acceptance profile | Author | **done** | 1 | QA PASS 29/29 T2a+T2b (1fa011d), A APPROVE, B APPROVE. A-T2b-01 (single-flight JWKS) + B-T2b-01/02 → T3a. |
| 4 | T3a | Services the app needs: service keys, token client, deep-linking response, AGS scores | Author | **done** | 1 | QA PASS 14/14 + T2 regression (6f03a80), A APPROVE, B APPROVE. A-T3a-01 fixed in T3b. |
| 5 | T3b | Dynamic registration incl. "update existing tool" | Author | **done** | 1 | QA PASS 10/10 incl. AC-T3-29/30 (6f03a80), A APPROVE, B APPROVE. |
| 6 | T4a | Upload + package inspector | Author | **done** | 3 | R3: QA PASS (93884d8), A APPROVE, B APPROVE. Deferred: A-T4a-04 (→ T6/T8), B-T4a-01 (→ T3a). |
| 7 | T4b1 | Connect + publish | Author | **done** | 2 | QA PASS (716a72c, incl. AC-T4-36), A APPROVE, B APPROVE. Residual risk R1 accepted. |
| 7b | T4b2 | Picker, launch handoff, security | Author | **done** | 1 | QA PASS 17/17 (716a72c; AC-T4-22/23 live), A APPROVE, B APPROVE. Follow-up dispositions are recorded in the final T9 reviews and human-review deferred list. |
| 8 | T5a | Content host, SCORM runtime, score sync | Author | **done** | 1 | QA PASS 21/21 black-box (e05aa29; real SCORM → 100 in Moodle), A APPROVE, B APPROVE. Review fixes landed in T5b. |
| 9 | T5b | HTML runtime, conflict, Resend | Author | **done** | 2 | QA PASS 14/14 live (edb99c9, incl. Moodle outage/conflict/Resend/override; real HTML → 100), A APPROVE, B APPROVE. T5a regression 21/21. |
| 10 | T6 | Portal UI (dev-portal style) | **Author-2 (Codex)** | **done** | 2 | QA PASS 14/14 (1639c7e), A APPROVE, B APPROVE (R2). B-T6-05 fixed in 8fdfa9e. |
| 11 | T7 | Full E2E in real Moodle | Author + **QA-E2E** | **done** | 2 | Replacement QA-E2E PASS on c5683f8 (product d54c607): all 15 ACs; three consecutive runs, 17 tests each, zero retries; refusal checks, demo:prepare 8.64 s and both demo launches PASS. Root check: 708 tests, zero skips. Own cleanup zero; all ten baseline containers unchanged (qa.md §10). Both phase 1 repair reviews APPROVE; historical reviews and runs remain. |
| 12 | T3c | Compat-only endpoints + LTIAAS SDK black-box test | **Author-2 (Codex)** | **done** | 4 | QA PASS 7/7 + T3a regression (8fdfa9e): real ltiaas 0.0.4 SDK passes idtoken, deep-link form+message, score 7/10 → 70/100, memberships; raw-id 404 (D15). A APPROVE (R4), B APPROVE (R4). |
| 13 | T8 | Native channel (.mbz) + course shell via WS — stretch | Author (backend) + Author-2 (portal, C-T8-01) | **done** | 3 | QA round 2 PASS at 8059c31: AC-T8-02..10 + race checks (C-T8-01 one build id, limit 202/409/202; C-T8-02 one runner, other runner_refused). R1 FAIL at 63de503 only on the two audit races. Fixes 655ab78 (Author-2), 8059c31 (Author: lock, lang, A1–A4). A + B APPROVE (R2 + fixes review, docs/reviews/T9/reviewer-*-fixes.md). |
| 14 | T9 | Docs + human review pack | Docs | **done** | 3 | Final artifacts 39c401a, source stamp 6932539. All four T9 ACs PASS (1a6f92c); Reviewer-A APPROVE (ad1db2d), Reviewer-B APPROVE with measured STE (20c12e2), Architect APPROVE (533141e). T4b/P1, repaired T5a/T5b/T6, fresh three-pass T7 and root checks PASS at the recorded SHAs. Both EN/VI videos meet duration and size limits. No open BLOCKER or MAJOR; human decisions and documented limits remain. |

## Continuation decisions

- 2026-10-19: both independent phase 1 code reviews APPROVE `d54c607`. Both final pack reviews also APPROVE `39c401a`; their complete reports are linked below.
- Focused P2/P5 QA PASS on `d54c607`: six tests, including app restart before confirmation and 90 seconds of stable Moodle scores. The missing-sync Resend refusal uses the approved fixture. Full T5a/T5b/T6 then passed all 49 ACs and 65 executed tests on the same SHA. Fresh T7 and final T9 also passed. Each QA stack was removed. Evidence: [T5b QA](../reviews/T5b/qa.md), [T7 QA](../reviews/T7/qa.md) and [T9 QA](../reviews/T9/qa.md).
- A-T9-C01 is an accepted MINOR deferral under charter §5. Repeated pre-POST line-item lookup failures can retry GET requests every 5 seconds instead of increasing the delay. The 24-hour retry window still applies, and no score POST occurs on this failure path. Keep the increasing-backoff policy as the target; document this implementation difference. Future work should count preparation failures separately from actual score POSTs. This acceptance does not waive any live QA or final review gate.

## Final continuation closure — 2026-10-19

The continuation is complete on `nguyenthanhquang152/moodle-lti-continuation`. All changes remain local; no push was made. The original Claude checkout and its unfinished QA files were preserved.

| Assigned work | Outcome | Evidence |
| --- | --- | --- |
| Author: bounded P2 repair and follow-up | Complete at `d54c607`; independently verified. Author-only migration evidence remains labelled. | [Architect conformance](../reviews/T9/architect-conformance.md), [Reviewer-A](../reviews/T9/reviewer-a.md) |
| QA: T4b/P1, T5a/T5b/T6, P2/P5/P11 | PASS: 27 T4b ACs at `a5d9ddc`; 49 T5/T6 ACs and 65 tests at `d54c607`. | [T4b1](../reviews/T4b1/qa.md), [T4b2](../reviews/T4b2/qa.md), [T5a](../reviews/T5a/qa.md), [T5b](../reviews/T5b/qa.md), [T6](../reviews/T6/qa.md) |
| QA-E2E: fresh T7 and final T9 | PASS: all 15 T7 ACs in three runs; all four T9 ACs. Root check: 708 tests, 48 files, zero skips. | [T7 §10](../reviews/T7/qa.md#10-replacement-qa-e2e-repair-regression--2026-10-19), [T9 §5](../reviews/T9/qa.md#5-replacement-qa-e2e-final-verification--2026-10-19) |
| Architect: final conformance | APPROVE for the accepted prototype scope. | [Conformance §10](../reviews/T9/architect-conformance.md#10-round-3-p2-late-remote-write) |
| Docs: guides, review pack and videos | Complete. EN: 182.4 seconds, 2,211,513 bytes. VI: 212.4 seconds, 2,567,661 bytes. | [Closing record](../human_review/CLOSING-PASS.md), [Start here](../human_review/START-HERE.md) |
| Independent Reviewer-A | APPROVE; no open BLOCKER or MAJOR. A-T9-C01 accepted; A-T9-C02 fixed. | [Round 3](../reviews/T9/reviewer-a.md#round-3--replacement-continuation-final-review-2026-10-19) |
| Independent Reviewer-B | APPROVE; all five new findings fixed. AC-T9-04 passes measured sentence, paragraph and warning checks. | [Final verdict](../reviews/T9/reviewer-b.md#final-continuation-verdict--2026-10-19) |

Exact final artifact candidate: `39c401ae7247547a6a503414ffa699aaea6fb884`. Its real build source is `6932539d4b44e017dd54acc8dc37c6bb2ba9fed1`. Later commits contain only review evidence and this board closure. Product and harness paths still match `d54c607d7fc6ce2d97e039bb108f52a37f2174ee`.

All seven owned Orca worker resources were released after successful settlement. No active or reclaimable worker remains in `run_249322a81631`. Superseded planning tasks launched no worker; reused-dispatch records hold no additional terminal resource. QA removed its own containers, volumes and networks. All ten baseline containers remained unchanged during QA.

The 25 [human decisions](../human_review/decisions-needed.md) remain open where stated. HR-1 needs Vietnamese approval; HR-2 needs unfamiliar-human follow-up. P2 confirmation cannot prevent an arbitrarily late older remote write. Migration 010 cannot recover unrecorded sends from before the upgrade. These limits and the [accepted deferrals](../human_review/deferred.md) are explicit; no human approval is implied.

## Lead validation — 2026-10-20

`feat/moodle-lti-prototype` is fast-forwarded to the continuation result `3f934ee` (no merge commit). The Claude QA in-progress test files from `c3f6d13` are kept in `git stash` (three are identical to the fork; the fork's `T5b/8-supersede.spec.ts` is newer and was the one run).

| Check | Result |
| --- | --- |
| Product code at `3f934ee` | Same as `d54c607`; no product or test change after it. |
| `npm run check` in this checkout (course fixtures present) | PASS: 48 files, 708 tests, 0 skipped. Without the course zips, 5 fixture tests skip (703 + 5). |
| Independent cross-team T7 (Claude QA-E2E, fresh clone of `3f934ee`, suite at that SHA) | PASS: 17 tests, 0 fail, 173 s; 0 of 45 captured secrets in the logs; `demo:prepare` 8.3 s, player reached. Evidence is git-ignored in `~/cogniate-qa-runs/`. |
| Board, QA, reviews, Architect conformance | All tasks done; T9 PASS (1a6f92c), Reviewer-A (ad1db2d) and Reviewer-B (20c12e2) APPROVE, Architect APPROVE (533141e). |
| `flows.md` check | Up to date. |

Open for humans (not agent work): the decisions in `docs/human_review/decisions-needed.md` (Q1 legal claim first), HR-1 (Vietnamese narration review) and HR-2 (an unfamiliar person runs the guides).
