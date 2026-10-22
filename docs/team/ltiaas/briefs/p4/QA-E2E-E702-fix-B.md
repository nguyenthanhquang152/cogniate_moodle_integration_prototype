# P4 dispatch: QA-E2E (Antigravity), LA-E7-02 round-2 fixes from Reviewer-B

Same terminal session and rules. Reviewer-B APPROVED LA-E7-02 round 1 (docs/reviews/LA-E7-02/reviewer-b.md; you may read your task's reviews) with 2 MINOR and 3 NIT; your LA-E7-05 is committed (0e65ab1). Fix in tests/sim/** (your folder):
1. B-01 MINOR: the simulator loader and the infra loader (infra/scripts/lib.sh, lane S1's) disagree on one hosts.json (a label starting with '-' passes the simulator but not infra; a repeated alias in one entry and empty providers pass infra but not the simulator). Align the SIMULATOR side exactly to README §4b (docs/architecture/ltiaas/README.md, A1 BD-A1-01 v1.1), add one shared table test of hosts.json cases in tests/sim, and list in worker_done every case where infra/scripts/lib.sh still differs from §4b (I route those lines to their owner).
2. B-02 MINOR: tests/sim/README.md: the createProvider config fields, the config.id = manifest id rule, the every-folder-is-a-module rule, the 'STACK_PROFILE=acceptance npm run stack:up' step that makes a new host live, and a glob for the self-test command.
3. NITs: startup messages that say what to fix (hosts mismatch with the diff; no guessed module name), split the large manifest test, a note on the one browser-only alias.
Host-only. Add '## Round 3' to docs/reviews/LA-E7-02/qa.md. One worker_done.

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
