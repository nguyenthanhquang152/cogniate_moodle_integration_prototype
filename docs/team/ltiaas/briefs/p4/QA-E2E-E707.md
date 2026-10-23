# P4 dispatch: QA-E2E (Antigravity): LA-E7-07 test-first suite (K2 browser U1-U4), host-only now; run in your Docker slot

Same terminal session and rules. Your LA-E7-02 round 4 and LA-E7-05 notes are committed. Integration SHA: 8c65424 or later green (code at 8c65424; the Lead check runs now; last green 78ffce1: 3055 unit, 254 infra, 149 K0, F1 0, F5 6 rules). Clone into a NEW folder (--no-hardlinks, npm ci); delete node_modules/.vitest-cache before every vitest run.
LA-E7-07 (Must; K2 browser cases U1-U4; spec docs/architecture/ltiaas/tasks/LA-E7-07.md). Its dependencies are now merged: LA-E1-11 (U1, U2), LA-E2-05 brightspace (U3; note: its tool rows show only after lane K switches toolConfiguration to 'channel', BD-A1-85, pending), LA-E2-04 lti-generic staged grant (U3), A2 LA-E3-02 and LA-E7-05 (U4). Now (host-only): write the test-first suite from the ACs, the contracts (app API delta, LA-ADR-05 D2 storage), the simulator docs (tests/sim/README.md) and the design; typecheck and lint it; run every part that needs no stack. Do not start any stack, browser runner or Docker command.
Docker: your slot (gate plan slot 6: LA-E7-09 AC-01..08 then the K2 U1-U4 run) comes in the LA block 04:45-07:45Z only by my explicit DOCKER-YES message, after the slots before it report their stacks down. Have the LA-E7-09 and LA-E7-07 run commands ready (your compose prefix qa-e2e-la-sim-r1..r2, PUBLIC_PORT 9443, STACK_SUBNET 172.20.0.0/16).
Write docs/reviews/LA-E7-07/qa.md (Round 1: rows pending: Docker window, with the suite paths and the measured host time). One worker_done.

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
