# P4 dispatch: QA-3 (Antigravity), run 20: LA-E2-05 R2, LA-E2-06 R1, LA-E3-07 R1 (host-only)

Same terminal session and rules. Your run-19 files are committed (la-qa 5810707; integration 64be09d). Integration SHA: 326ceae (Lead full check green with node_modules/.vitest-cache and node_modules/.vite deleted: 3086 unit, 254 infra, 148 K0 (149 -> 148 is expected: K-CAP makes one case per OFF capability, and brightspace registration.dynamic is now on), F1 0, F5 6 rules). Clone into a NEW folder (--no-hardlinks, npm ci); delete node_modules/.vitest-cache before every vitest run.
1. LA-E2-05 Round 2 (lane K, 6bfb150): lti-generic and brightspace lti.toolConfiguration is now 'channel' (BD-A1-85; your K-ADAPTER kit, merged 4d08fc1): the nine D2L tool rows show through GET /app-api/connections/:id/tool-configuration and in the portal wizard. Re-run your LA-E2-05 rows. Add '## Round 2' to docs/reviews/LA-E2-05/qa.md.
2. LA-E2-06 Round 1 (lane K, 1b298d9): brightspace Dynamic Registration, always staged with a grant (spec docs/architecture/ltiaas/tasks/LA-E2-06.md; LA-ADR-02 D2a). AC-01: F2 on the LA-E2-06 commit only: git diff --name-status 1b298d9^ 1b298d9 | node infra/scripts/fitness/channel-diff.mjs --paths-from /dev/stdin --channel brightspace (K reports PASS core = 0, paths = 4). Write the test-first suite first (tests/ltiaas/tasks-core/LA-E2-06/); K1-SIM rows (AC-02, AC-03) stay pending. Write docs/reviews/LA-E2-06/qa.md.
3. LA-E3-07 Round 1 (lane K, a390edb): no NRPS scope in any channel (moodle, canvas, blackboard registration.scopes = the four AGS scopes; Canvas JSON scopes from the manifest capabilities, jwk=url and jwk=inline; Moodle manual row 13 'Do not use this service'); spec docs/architecture/ltiaas/tasks/LA-E3-07.md; LA-ADR-05 D4; LD-9 LA-IC-04 (the lead QA writes the expected-delta record; the golden compare is not your task). Write the test-first suite (host rows); K1-SIM/MOODLE-LIVE rows stay pending. Write docs/reviews/LA-E3-07/qa.md.
LA-E3-15 (Canvas dynamic method) has a fix round running (BD-A1-106); it comes in a later run. One worker_done.

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
