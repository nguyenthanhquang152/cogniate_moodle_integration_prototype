# Milestone LA board: LTI as a Service v1

Only the Lead edits this file. Orca Run: `run_06d07dc77faf`. Rules: [charter-LA](charter-LA.md). Plan: [plan](plan.md) (v1.2).

## Phase status

| Phase | Status | Gate | Notes |
| --- | --- | --- | --- |
| P1 Plan | **done** | — | R1–R5 committed; plan v1 `1afdf56`, v1.1 (R2), v1.2 (LA-H21..H24) |
| P2 Tech design | **round 2 re-check** at `877d951` (RA2 `ctx_0afe84599126`, RB2 `ctx_9be52e431d9f`, QT2 `ctx_c9eff3e6fa01`) | G-DESIGN round 1: A CHANGES_REQUESTED (3 B, 5 M), B CHANGES_REQUESTED (8 M), QA FAIL (1 M) | 15 design files under `docs/architecture/ltiaas/`; test strategy `tests/ltiaas/TEST-STRATEGY.md` |
| P3 Breakdown | planned | G-BREAKDOWN | Briefs ready: `briefs/LA-B1.md` (A1), `briefs/LA-B2.md` (A2) |
| G-BASE | waiting | — | Blackboard and Canvas run `run_ebe671ad72a9`; see plan LA-H10 |
| G-DEV | waiting | product owner | Approves plan, design and breakdown (LA-H1) |
| P4 Build | planned | — | Lanes K, P, S, L, R, QA, QA-E2E, Docs; 2 Docker slots (LD-2) |
| P5 Verify | planned | task done | QA + Reviewer-A + Reviewer-B in parallel |
| P6 Integrate | planned | milestone done | Regression, conformance, docs |

## Tasks

| Id | Title | Role | Status | Dispatch | Output |
| --- | --- | --- | --- | --- | --- |
| LA-R1 | LTI 1.3 / Advantage spec coverage | Researcher | done | `ctx_a02dfb63c6a7` | `docs/research/ltiaas/R1-spec-coverage.md` |
| LA-R2 | LMS landscape | Researcher | done | `ctx_9723939997e7` | `docs/research/ltiaas/R2-lms-landscape.md` |
| LA-R3 | Channel extensibility audit | Researcher | done | `ctx_47e046be67f1` | `docs/research/ltiaas/R3-extensibility-audit.md` |
| LA-R4 | Operability, security, LTIAAS compatibility | Researcher | done | `ctx_763a24e1f32c` | `docs/research/ltiaas/R4-ops-readiness.md` |
| LA-R5 | Test and QA baseline | Researcher | done | `ctx_9a71aba4569a` | `docs/research/ltiaas/R5-test-baseline.md` |
| LA-P1 | Plan v1 | Lead | done | — | `docs/team/ltiaas/plan.md` |
| LA-D1 | Design: kernel, generic LTI, records, consistency | Architect A1 | done (+ consistency pass `ctx_9bfa3c592fa6`) | `ctx_5cfbcb7699eb` | A1 files in `docs/architecture/ltiaas/` |
| LA-D2 | Design: Advantage, operability, security, onboarding | Architect A2 | done (retry after session limit) | `ctx_368b9bc5879b` | A2 files in `docs/architecture/ltiaas/` |
| LA-QS | Test strategy and conformance kit | QA | done | `ctx_67134bc13967` | `tests/ltiaas/TEST-STRATEGY.md` |
| LA-QT | Design testability review | QA | R1 FAIL: Q-LAD-14 MAJOR; 12/13 pre-review findings closed | `ctx_8ea334f6cd89` | `docs/reviews/LA-DESIGN/qa.md` |
| LA-RA | Design review, lens A | Reviewer-A | R1 CHANGES_REQUESTED: A-LAD-01..03 BLOCKER, -04..-08 MAJOR | `ctx_8064081b6df9` | `docs/reviews/LA-DESIGN/reviewer-a.md` |
| LA-RB | Design review, lens B | Reviewer-B | R1 CHANGES_REQUESTED: B-LAD-01..08 MAJOR | `ctx_0389f26b369b` | `docs/reviews/LA-DESIGN/reviewer-b.md` |

## Incidents

- 2026-10-22 08:41: a Lead script error (zsh 1-based arrays) sent the Reviewer-B round-2 task to Reviewer-A's session and the QA task to Reviewer-B's session. The Lead fenced both dispatches within about 1 minute and sent cancels. Both reviewers saw the mismatch, asked before they opened any file, and read no other review; the worktree had no changes. New tasks replaced the misrouted ones.

- 2026-10-22 02:55–04:15: Claude session limits stopped A2, Reviewer-B and QA. Stalled sessions do not resume after the reset. Recovery: `worker-stop`, then `worker-start --retry-of` with a retry-context message. No work was lost; files stayed in the shared worktree.
- QA's first session reviewed the uncommitted draft before the Lead gave a SHA. The file is kept as a pre-review; Round 1 re-verifies it at `19476fc`.

## G-DESIGN round 1 routing

| Owner | Findings |
| --- | --- |
| A1 | A-LAD-01 (rule owner), A-LAD-03, -04, -05; B-LAD-01..07 |
| A2 | A-LAD-02, -06, -07; Q-LAD-14; A-LAD-01 alignment in A2 files |
| Lead | A-LAD-08 = B-LAD-08: closed by LD-9 (`2740f56`) |
