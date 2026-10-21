# Milestone LA board: LTI as a Service v1

Only the Lead edits this file. Orca Run: `run_06d07dc77faf`. Rules: [charter-LA](charter-LA.md). Plan: [plan](plan.md).

## Phase status

| Phase | Status | Gate | Notes |
| --- | --- | --- | --- |
| P1 Plan | done (R2 pending) | — | Plan v1 at `1afdf56`. R1, R3, R4, R5 done and released. |
| P2 Tech design | in_progress | G-DESIGN | A1 + A2 + QA test strategy in parallel |
| P3 Breakdown | planned | G-BREAKDOWN | Epics, features, task specs, file-ownership lanes |
| G-BASE | waiting | — | Blackboard and Canvas run `run_ebe671ad72a9` must be accepted first |
| G-DEV | waiting | product owner | Approves plan, design and breakdown |
| P4 Build | planned | — | Author lanes in parallel; QA test-first |
| P5 Verify | planned | task done | QA + Reviewer-A + Reviewer-B in parallel |
| P6 Integrate | planned | milestone done | Regression, conformance, docs |

## Tasks

| Id | Title | Role | Status | Dispatch | Output |
| --- | --- | --- | --- | --- | --- |
| LA-R1 | LTI 1.3 / Advantage spec coverage | Researcher | done, released | `ctx_a02dfb63c6a7` | `docs/research/ltiaas/R1-spec-coverage.md` |
| LA-R2 | LMS landscape | Researcher | dispatched | `ctx_9723939997e7` | `docs/research/ltiaas/R2-lms-landscape.md` |
| LA-R3 | Channel extensibility audit | Researcher | done, released | `ctx_47e046be67f1` | `docs/research/ltiaas/R3-extensibility-audit.md` |
| LA-R4 | Operability, security, LTIAAS compatibility | Researcher | done, released | `ctx_763a24e1f32c` | `docs/research/ltiaas/R4-ops-readiness.md` |
| LA-R5 | Test and QA baseline | Researcher | done, released | `ctx_9a71aba4569a` | `docs/research/ltiaas/R5-test-baseline.md` |
| LA-P1 | Plan v1 | Lead | done | — | `docs/team/ltiaas/plan.md` (`1afdf56`) |
| LA-D1 | Design: channel kernel, generic LTI, records, consistency | Architect A1 | in_progress | `ctx_5cfbcb7699eb` | `docs/architecture/ltiaas/**` (A1 files) |
| LA-D2 | Design: Advantage completeness, operability, security, onboarding | Architect A2 | in_progress | `ctx_dd943d28414a` | `docs/architecture/ltiaas/**` (A2 files) |
| LA-QS | Test strategy and conformance kit | QA | in_progress | `ctx_67134bc13967` | `tests/ltiaas/TEST-STRATEGY.md` |
| LA-RA | Design review, lens A | Reviewer-A | warm-up (waits for design) | `ctx_8064081b6df9` | `docs/reviews/LA-DESIGN/reviewer-a.md` |
| LA-RB | Design review, lens B | Reviewer-B | warm-up (waits for design) | `ctx_6bc20f00c0da` | `docs/reviews/LA-DESIGN/reviewer-b.md` |
