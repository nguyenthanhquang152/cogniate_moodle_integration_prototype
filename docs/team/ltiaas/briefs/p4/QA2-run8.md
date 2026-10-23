# P4 dispatch: QA-2 (Antigravity), run 8: LA-E5-17 R2, LA-E5-16 R3, LA-E5-20 R1, LA-E5-21 R1, LA-E5-11 R3 (host-only)

Same terminal session and rules. Your run-7 files are committed (394b867). Integration SHA: 2a15f5b (the Lead's full check on it runs now; if your R0 check fails, report it and stop). Clone into a NEW folder (--no-hardlinks, npm ci). Then:
1. LA-E5-17 Round 2 (lane S1 item 2b, merge d866441: audit counts after the outermost commit through the afterCommit hook, A2 BD-A2-60; http_request.path = route template or "<unmatched>", BD-A2-61; plus the BD-A2-54 JWKS join 2477abb). Add rows: a nested commit counts once, an outer rollback counts nothing, a personal value in an unknown path never reaches the log, token and JWKS series present for stored platforms. (A further fix, BD-A2-74 for raw outer transactions, is in S1's next round.)
2. LA-E5-16 Round 3 (commit 97e9f91: the AGS create preflight runs before the claim, A2 BD-A2-71; exact route guard; contextId "" for both schemes, BD-A2-75). Rows: a credential that lost the lineitem scope gets the current 403, not an old 201; a refused-then-authorized retry reaches the platform; an ltik and a service key of a no-context launch share one fingerprint.
3. LA-E5-20 Round 1 (commits 95036a9, 14287ee, ce47f03, 805b897, ca75c68; A2 BD-A2-65..70; LTI migration 019). If your test-first suite for LA-E5-20 does not exist, write it from the spec ACs first (tests/ltiaas/tasks-ops/LA-E5-20/).
4. LA-E5-21 Round 1 (commits c8faf49, c19e722, caf437f: secret files, the six production refusals in LA-ADR-07 D12 order, the config_refused line and exit 1). Run your test-first LA-E5-21 suite.
5. LA-E5-11 Round 3 (commit 19844f2: the app:audit texts exactly as LA-ADR-07 D4). One row.
Stack rows stay pending Docker. Write the qa.md files (new round sections). One worker_done.

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
