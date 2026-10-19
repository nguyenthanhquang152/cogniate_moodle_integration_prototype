# Task board

Only the Lead edits this file. Task specs live in `docs/architecture/tasks/`. Order = critical path (see the task DAG in `docs/architecture/README.md`).

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
| 7b | T4b2 | Picker, launch handoff, security | Author | **done** | 1 | QA PASS 17/17 (716a72c; AC-T4-22/23 live), A APPROVE, B APPROVE. MINOR follow-ups (B-T4b2-01/03, A-T4b2-02/04) in progress with T5b batch. |
| 8 | T5a | Content host, SCORM runtime, score sync | Author | **done** | 1 | QA PASS 21/21 black-box (e05aa29; real SCORM → 100 in Moodle), A APPROVE, B APPROVE. Review fixes landed in T5b. |
| 9 | T5b | HTML runtime, conflict, Resend | Author | **done** | 2 | QA PASS 14/14 live (edb99c9, incl. Moodle outage/conflict/Resend/override; real HTML → 100), A APPROVE, B APPROVE. T5a regression 21/21. |
| 10 | T6 | Portal UI (dev-portal style) | **Author-2 (Codex)** | **done** | 2 | QA PASS 14/14 (1639c7e), A APPROVE, B APPROVE (R2). B-T6-05 fixed in 8fdfa9e. |
| 11 | T7 | Full E2E in real Moodle | Author + **QA-E2E** | **done** | 1 | QA-E2E PASS all 15 ACs (1639c7e; 3 consecutive runs ~188 s; demo:prepare 9.3 s), A APPROVE, B APPROVE. Final regression run on the final SHA before hand-over. |
| 12 | T3c | Compat-only endpoints + LTIAAS SDK black-box test | **Author-2 (Codex)** | verifying | 3 | R3 merged (1639c7e): real ltiaas 0.0.4 SDK passes idtoken, deep-link, scores 87/100, memberships. R2 A+B APPROVE; R3 short review; QA AC-T3-27 at 1639c7e. |
| 13 | T8 | Native channel (.mbz) + course shell via WS — stretch | Author (backend) + Author-2 (portal) | verifying | 2 | R2 + fixes (a101701, scoped sweep) A + B APPROVE; portal AC-T8-10 merged 8fdfa9e. QA T8 at 8fdfa9e. |
| 14 | T9 | Docs + human review pack | Docs | in_progress | 1 | Filling with real results now; finalize after T7 runs 2–3. |
