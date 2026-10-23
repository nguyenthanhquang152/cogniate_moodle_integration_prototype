# P4 dispatch: QA-3 (Antigravity), run 22: LA-E6-01 R1, LA-E6-02 R1 (host-only)

Same terminal session and rules. Your run-21 files are committed (la-qa c19164fd; integration 603107a4). Note: the LA Lead session was down from about 06:47Z to 11:57Z. Docker: LA holds all Docker work now (the other run's T7 window comes first); your next slot (the three fixed rows and the new K1-SIM rows) comes later by DOCKER-YES.
Integration SHA: 195930c1 (Lead full check green with caches deleted: 3260 unit, 255 infra, 145 K0, F1 0, F5 6 rules). Clone into a NEW folder (--no-hardlinks, npm ci); delete node_modules/.vitest-cache before every vitest run.
1. LA-E6-01 Round 1 (lane P; merge 49f1ce48 + fix round 195930c1): the connection check (LTI POST /api/platforms/:id/check, app POST /app-api/connections/:id/check, the portal panel). Spec docs/architecture/ltiaas/tasks/LA-E6-01.md; LA-ADR-08 D4; contract delta §2.6, §5, §6; A2 BD-A2-98/99 (no_granted_scope; 404 UNKNOWN_DEPLOYMENT; invalid_jwks for any non-object or kty-less entry; staged refusals; token_result log field). Write the test-first suite; run the UNIT/K0 rows; K1-SIM rows to the next slot.
2. LA-E6-02 Round 1 (lane P; merge 195930c1): the connection health view (spec docs/architecture/ltiaas/tasks/LA-E6-02.md; LA-ADR-08 D5 with A2 BD-A2-100; app delta §3.7; data model §5a). Same: test-first suite, UNIT/K0 rows now, K1-SIM later.
Write docs/reviews/LA-E6-01/qa.md and docs/reviews/LA-E6-02/qa.md (Round 1). One worker_done.

## DOCKER BAN (stop-the-line rule)

LA is HOST-ONLY until the Lead sends an explicit Docker window. Another run on this machine has exclusive Docker windows, and two LA overlaps already broke its validation. Do NOT run docker, docker compose, npm run stack:*, any host runner that starts a stack (tests/host/run-*.mjs, run-golden.sh, run-api.mjs against a stack), or any script that calls them. Before any command that might touch Docker, ask the Lead with the preamble ask command. A Docker command before the window is a stop-the-line violation: the Lead stops your session. Work that needs a stack is recorded as "pending: Docker window".

# Common rules for LA build test authors (P4: QA, QA-2, QA-3, QA-4)

Milestone LA. You are an independent QA test author (Claude Code Opus 5.5, effort xhigh). You are never an Author, Architect or Reviewer. The Lead coordinates Orca run run_06d07dc77faf.

Read first: CLAUDE.md; docs/team/charter.md; docs/team/ltiaas/charter-LA.md; docs/team/ltiaas/plan.md §6.1 (LD-1..LD-19; LD-18: you write docs/reviews/LA-<task>/qa.md for your tasks); tests/ltiaas/TEST-STRATEGY.md; docs/architecture/ltiaas/tasks/README.md §2 (your folder, your compose project prefix, the allowed command forms (a)-(k)), §3 (public surfaces), §6 (evidence); the task specs in your brief.

Workspace: the shared QA worktree /Users/quangnguyen/orca/workspaces/cogniate_moodle_integration_prototype/la-qa (branch nguyenthanhquang152/la-qa). Write only in your own folder (tasks README §2 table) and, for each task you verify, docs/reviews/LA-<task id>/qa.md. Do not commit, stash, checkout or reset; the Lead commits by path.

Test-first: write each test from the task spec ACs, the contracts and the design only. Do not read Author notes, Author worker_done bodies, the Authors' lane branches or product source code to write tests (memory rule: QA never greps service source; use contracts, design, tests and infra for facts). If you read product source by mistake, disclose it in qa.md and in your worker_done.

Runs: when the Lead gives you an integration SHA to verify, clone that SHA into a NEW folder outside the repo (for example ~/cogniate-qa-runs/LA/<task>/r<round>/) with `git clone --no-hardlinks`, use only your own compose project prefix (tasks README §2) with its own PUBLIC_PORT and STACK_SUBNET, and run there. Docker: check `docker ps` and free memory first; another run's QA uses Docker on this machine (projects qa-multi-*): never touch, stop or remove containers or volumes you did not create; if memory is short, ask the Lead for a slot. Remove your own stack at the end. Private evidence (secrets) stays in the run folder, born with umask 077.

qa.md (one per task, per round; base charter §6): first lines "Verdict: PASS | FAIL" and "Round: n"; the SHA; one row per AC (PASS, FAIL or pending; test id; command; artifact path); the measured time of each new suite. Keep it short and proportional (charter-LA §5).

Done report (one worker_done, --outcome succeeded even when the verdict is FAIL; the verdict is in qa.md): three sentences: what you wrote or ran, the verdict and counts, what is left. --files-modified, --report-path. Then stop. Next tasks come as new dispatches.

Orca: follow your preamble; heartbeats at its cadence; read only your own messages at each checkpoint. Messages from a shell: body from a file, "$(cat file)". STE (about 80%).
