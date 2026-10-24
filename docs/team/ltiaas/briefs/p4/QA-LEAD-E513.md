# P4 dispatch: lead QA (Antigravity): LA-E5-13 test-first suite (two-tenant isolation), host-only now; then your Docker slots 2 and 3A

Same terminal session and rules. Your K0 batch is merged (la-qa 19da95e; integration 4d08fc1); lane L removed the clientAssertionAudArray flag (78ffce1; K0 149/149 green on it). Integration SHA: 8c65424 or later green (code at 8c65424; the Lead check runs now; last green 78ffce1: 3055 unit, 254 infra, 149 K0, F1 0, F5 6 rules). Clone into a NEW folder (--no-hardlinks, npm ci); delete node_modules/.vitest-cache before every vitest run.
1. LA-E5-13 (Must; two-tenant isolation checks for the new routes; spec docs/architecture/ltiaas/tasks/LA-E5-13.md). Its dependencies are now merged: LA-E3-02, LA-E3-05 (picker Cancel and multi-select, 176e823 + fix 8c65424), LA-E5-07; LA-E5-15 is built (AC-05 applies). Write the test-first suite from the ACs, the contracts and the security delta; run the parts that need no stack. SIM rows stay pending Docker.
2. Prepare slot 2 (G-BASE on 1b17261, qalead-la-1/2) and slot 3A (candidate capture and compare, qalead-la-3) of tests/ltiaas/GATE-RUN-PLAN.md. The expected-delta set for 3A now also holds LA-IC-03, LA-IC-20 (updated) and LA-IC-21 (your 19da95e): list the full set in your plan note. Slot 3A runs on the newest green integration SHA I name in the grant.
Docker: slot 2 starts only by my explicit DOCKER-YES message (planned about 05:30Z, after QA-2's slot 1 reports its stack down). When it arrives, stop the LA-E5-13 work at a clean point and run slot 2, then 3A, with the before/after records of GATE-RUN-PLAN §3.
Write docs/reviews/LA-E5-13/qa.md (Round 1). One worker_done after slot 3A (or one now if I do not grant the slot).

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
