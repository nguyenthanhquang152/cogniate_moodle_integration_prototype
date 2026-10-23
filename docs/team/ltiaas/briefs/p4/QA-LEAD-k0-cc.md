# P4 dispatch: lead QA (Antigravity): K0 kit change for setup.connectionCheck (URGENT, lane K waits), then the K0 shim cleanup (host-only)

Same terminal session and rules. Your slots 2 and 3A files are committed (la-qa bfdbbcf; integration b40c789). Thank you for the fast, clean slots. Note: while you were in the slots, QA-4 wrote LA-IC-14 and LA-IC-04 and changed K-LEGACY.canvas in tests/ltiaas/k0/contract.test.ts, and QA-2 fixed LA-IC-03 (one-time grants; la-qa 4ce9b8e). LD-9 round 6 reviews of LA-IC-01/03/04/12/14 run now.
Integration SHA: c62b373 or later (Lead check green: 3150 unit, 255 infra, 147 K0, F1 0, F5 6). Clone into a NEW folder (--no-hardlinks, npm ci); delete node_modules/.vitest-cache before every vitest run.
1. URGENT (lane K's LA-E6-04 waits): tests/ltiaas/k0/contract.test.ts:1156-1161 counts manifest.setup.connectionCheck === true in needsAdapter (K-ADAPTER), so a channel without app.ts may not set it. But the connection check is a core route (LA-ADR-08 D4: POST /app-api/connections/:id/check -> LTI POST /api/platforms/:id/check) and uses no ConnectionSetup member: the same kind of kit assumption as BD-A1-85 (toolConfiguration). Lead provisional call (A1 ratifies): drop connectionCheck from needsAdapter, and in the no-app.ts branch (about line 1181) expect caps['setup.connectionCheck'] to equal the manifest value. Prove it with a simulated lti-generic setup.connectionCheck: true (K0 green) and without it (K0 green). Send a status message "K0 connectionCheck kit ready" with the file list as soon as it is done.
2. The K0 transitional shim buildProfileRegistryCompat (contract.test.ts:685-702) is dead code since the clientAssertionAudArray flag removal (78ffce1): remove it (K0 stays 147/147).
3. LA-E5-13: your SIM rows wait for a Docker slot (I plan it after QA-4's slot 5); keep the run commands ready.
One worker_done at the end.

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
