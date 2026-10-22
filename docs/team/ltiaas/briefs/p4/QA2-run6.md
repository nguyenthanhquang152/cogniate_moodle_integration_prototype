# P4 dispatch: QA-2 (Antigravity), run 6: LA-E5-17 R1, LA-E5-15 R2, LA-E5-09 R2 (host-only)

Same terminal session and rules. Your run-5 files are committed (673fbe5). Integration SHA: 5b5b3a2 (the Lead's full check result is in the dispatch message). Clone into a NEW folder (--no-hardlinks, npm ci). Then:
1. LA-E5-17 Round 1 (lane S1, merge 880f5d6: operator OpenMetrics, public and operator readiness, production-only health redaction, tenant HTTP logs, unsampled rate-limit totals, committed audit counts; A2 BD-A2-52, BD-A2-54). Run your test-first LA-E5-17 suite and the UNIT rows. JWKS and token series: lane L's observers are merged (f4530b9), but the scrape-time join by lane S1 is not built yet, so those series rows are "pending: S1 BD-A2-54 join", not FAIL.
2. LA-E5-15 Round 2 (lane S2 fix round 1, merge 676b7d9: write-scope route tests, GET /operator/v1/accounts/:id/platforms (A2 BD-A2-53), clearer SERVICE_KEY_SCOPE text). Add rows for the new operator route (200 shape with no secret field, 404 unknown account, closed account readable, no audit row).
3. LA-E5-09 Round 2 (lane S2, merge 676b7d9: the re-wrap run uses the request trace id through runNow; A2 BD-A2-50). Add the row: the 202 trace id is the trace of the job-end event.
Stack rows stay pending Docker. Write the three qa.md files (new round sections). One worker_done.

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
