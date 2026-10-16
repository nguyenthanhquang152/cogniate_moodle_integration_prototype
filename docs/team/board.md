# Task board

Only the Lead edits this file. Task specs live in `docs/architecture/tasks/`. Order = critical path (see the task DAG in `docs/architecture/README.md`).

| # | Task | Title | Owner | Status | Round | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| — | T1-spike | Moodle dev environment spike | Author | done | — | Unreviewed. Facts in `infra/moodle/SPIKE-NOTES.md`. |
| 0 | T0 | Architecture, contracts, task specs, rea decision | Architect | **done** | 3 | A APPROVE (R2), B APPROVE (R3), QA PASS (R3). Deferred: A-T0-22/23 NITs, B-T0-26 NIT, Q-T0-43 (→ T2a H14), Q-T0-44 NIT. |
| 1 | T1 | Monorepo skeleton + local HTTPS stack (Moodle 5.2) | Author | **done** | 2 | R2: QA PASS 13/13 + hooks, A APPROVE, B APPROVE. Deferred MINOR: A-T1-02 rest, A-T1-03, A-T1-05, A-T1-08, A-T1-09, B-T1-03 rest, B-T1-06..12, Q-T1-04 (→ T4). |
| 2 | T5-spike | Player de-risk: frames, CSP, SCORM API, HTML signals | Author | **done** | — | Unreviewed. 07e8a45. Own SCORM 1.2 subset; frame-ancestors {content} {app}; sandbox allow-scripts allow-same-origin. |
| 3 | T2a | LTI core: platforms, keys/JWKS, OIDC launch, ltik, `/api/idtoken` | Author | verifying | 1 | wip 7bfbbb1; QA run at a2a5aa3 (qa-t2a-r1); A + B reviewing. |
| 3b | T2b | Negative launch checks, qa-platform.test, acceptance profile | Author | planned | — | QA tests ready (fab9376). |
| 4 | T3a | Services the app needs: service keys, token client, deep-linking response, AGS scores | Author | planned | — | |
| 5 | T3b | Dynamic registration incl. "update existing tool" | Author | planned | — | |
| 6 | T4a | Upload + package inspector | Author | in_progress | 1 | Pipelined: runs while T2a is verified (depends only on T1). QA tests ready. |
| 7 | T4b1 | Connect + publish | Author | planned | — | |
| 7b | T4b2 | Picker, launch handoff, security | Author | planned | — | |
| 8 | T5a | Content host, SCORM runtime, score sync | Author | planned | — | |
| 9 | T5b | HTML runtime, conflict, Resend | Author | planned | — | |
| 10 | T6 | Portal UI (dev-portal style) | Author | planned | — | |
| 11 | T7 | Full E2E in real Moodle | QA + Author | planned | — | |
| 12 | T3c | Compat-only endpoints + LTIAAS SDK black-box test | Author | planned | — | Off the critical path. |
| 13 | T8 | Native channel (.mbz) + course shell via WS — stretch | Author | planned | — | Human decision Q12. |
| 14 | T9 | Docs + human review pack | Docs | in_progress (drafts) | — | PLAN.md, run-the-stack guide, explainer.html shell, flows.md done as drafts; results after T7. |
