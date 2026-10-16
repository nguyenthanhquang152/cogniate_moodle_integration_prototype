# Task board

Only the Lead edits this file. Task specs live in `docs/architecture/tasks/`. Order = critical path (see the task DAG in `docs/architecture/README.md`).

| # | Task | Title | Owner | Status | Round | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| — | T1-spike | Moodle dev environment spike | Author | done | — | Unreviewed. Facts in `infra/moodle/SPIKE-NOTES.md`. |
| 0 | T0 | Architecture, contracts, task specs, rea decision | Architect | verifying | 2 | R1: A 2 BLOCKER + 6 MAJOR, B 5 MAJOR, QA PASS + 12 MAJOR. R2 commit b06aa8a. |
| 1 | T1 | Monorepo skeleton + local HTTPS stack (Moodle 5.2) | Author | verifying | 1 | wip bc530a7; QA tests 39b3450; QA run at ef9faeb (port 8443). |
| 2 | T5-spike | Player de-risk: frames, CSP, SCORM API, HTML signals | Author | in_progress | — | Unreviewed. `apps/player-spike/`. |
| 3 | T2 | LTI core: platforms, keys/JWKS, OIDC launch, ltik, `/api/idtoken` | Author | planned | — | |
| 4 | T3a | Services the app needs: service keys, token client, deep-linking response, AGS scores | Author | planned | — | |
| 5 | T3b | Dynamic registration incl. "update existing tool" | Author | planned | — | |
| 6 | T4a | Upload + package inspector | Author | planned | — | |
| 7 | T4b | Connections, publications, picker, launch handoff | Author | planned | — | |
| 8 | T5a | Content host, SCORM runtime, score sync | Author | planned | — | |
| 9 | T5b | HTML runtime, conflict, Resend | Author | planned | — | |
| 10 | T6 | Portal UI (dev-portal style) | Author | planned | — | |
| 11 | T7 | Full E2E in real Moodle | QA + Author | planned | — | |
| 12 | T3c | Compat-only endpoints + LTIAAS SDK black-box test | Author | planned | — | Off the critical path. |
| 13 | T8 | Native channel (.mbz) + course shell via WS — stretch | Author | planned | — | Human decision Q12. |
| 14 | T9 | Docs + human review pack | Docs | planned | — | Includes the 10-minute AC. |
