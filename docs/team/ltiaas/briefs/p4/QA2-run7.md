# P4 dispatch: QA-2 (Antigravity), run 7: LA-E5-16 R2, LA-E5-11 R2, LA-E5-05 R3 (host-only)

Same terminal session and rules. Your run-6 files are committed (14c3607). Integration SHA: 836d579 (Lead full check green: 2743 unit, 252 infra, 121 K0, F1 29 hits in 9 files, F5 6 rules). Clone into a NEW folder (--no-hardlinks, npm ci). Then:
1. LA-E5-16 Round 2 (lane S1 fix round 1, commit a36d4c5: the fingerprint carries the resolved target per scheme, A2 BD-A2-56; the lookup runs after auth, rate limits and the read-only target checks; final answers only = 2xx or 4xx other than 429 without Retry-After, BD-A2-57; 409 IDEMPOTENCY_IN_PROGRESS has details.retryAfter and Retry-After, new 409 and 422 texts, BD-A2-58; onReady route check). Add rows: same key and body from another platform, deployment or course gives 422; a platform 429 is not stored (the retry runs); a refused target is never stored.
2. LA-E5-11 Round 2 (commits 75f50c3, 060c24d, f6738ee, b93993f: refusal line {event, reason, message} with fixed messages, operators_not_configured, BD-A2-59; app:audit messages and --help exit 0, BD-A2-62; note and code key families hidden; evidenceRequired policy input, BD-A2-63). Add rows for the fixed messages (never echo input), --help, and evidenceRequired false in production.
3. LA-E5-05 Round 3 (commit dc88b7d: the 401 recovery text gives --replace-operator-key last and says that it revokes every operator key). One row.
LA-E5-17 Round 2 follows when lane S1 lands its item 2b (audit counts at commit, route-template log path). Stack rows stay pending Docker. Write the three qa.md files (new round sections). One worker_done.

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
