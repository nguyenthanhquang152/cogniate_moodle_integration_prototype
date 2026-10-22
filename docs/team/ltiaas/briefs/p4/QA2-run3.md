# P4 dispatch: QA-2 (Antigravity), run 3: test-first suites and the Docker-window run plan

Same terminal session and rules. Your LA-E5-07/03/19 suites are committed (la-qa c3a11cf, integration e77aeb5). Integration SHA for reading specs: e77aeb5.
1. Test-first K0/K1-SIM suites from the specs (tests/ltiaas/tasks-ops/<task>/, same layout): LA-E5-05 (LTI CLIs as operator API clients; note A2 BD-A2-14 for --rotate-signing-key), LA-E5-11 (app audit writer, operator policy, app:audit list), LA-E5-09 (key provider status, re-wrap job, legacy refusal). Host-only checks as before.
2. Update your LA-E5-03 suite if needed for A2 BD-A2-16..20 (one generic Retry-After rule, details.retryAfter on RATE_LIMITED, onFail part argument, registrationSessionsPerAddress shape 1..1000 | null, registration_session.client_key) and your LA-E5-07 suite for A2 BD-A2-12 (409 ACCOUNT_CLOSED on issue; revoke and GET stay allowed; new UNIT AC-LA-E5-07-13).
3. Write a run plan file tests/ltiaas/tasks-ops/K1-SIM-RUN-PLAN.md for the provisional LA Docker window (14:00-16:00Z, not granted): the order of your K1-SIM suites (LA-E5-01, -08, -02, -04, -10, -07, -03 when merged, LA-E7-03), one stack per batch, COMPOSE_PROJECT_NAME qa2-la-sim-<n>, the commands, the expected minutes per suite, and the owned-only cleanup commands. Do NOT start any stack; the Lead sends the window.
One worker_done at the end with files and counts.

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
