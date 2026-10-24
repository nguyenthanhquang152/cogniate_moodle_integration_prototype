# P4 dispatch: QA-2 (Antigravity): DOCKER-YES slot 1c: LA-E5-22 K1-SIM U1 + LA-E5-23 R2 LTI-service stack regression

Same terminal session and rules. Your LA-E5-23 R1 files are committed (la-qa f9e828b9; integration 957110f3).
DOCKER-YES: window 13:46Z to 14:45Z. One stack at a time; only qa2-la-sim-r1..r4; PUBLIC_PORT 9443; STACK_SUBNET 172.20.0.0/16; before/after Docker records (umask 077: docker ps -a, networks, the 32 volume records with inspect); owned-only cleanup; a host ps watcher from launch. A third Orca run (sto-*) runs its own containers on this host: never touch, stop or remove them; list them apart in your records.
SHA: a NEW clone of integration cd347224 (code = 5260eac5; Lead full check green with caches deleted: 3302 unit, 255 infra, 145 K0, F1 0, F5 6 rules). QA-3's stacks went down at 13:36Z.
Run: 1. LA-E5-22 AC-01 (the upgrade route U1: an app with legacy blobs starts with a key ring and still opens them; app:keys rewrap moves them; your suite tests/ltiaas/tasks-ops/LA-E5-22/). 2. LA-E5-23 AC-04 and the R2 LTI-service area regression on a stack (T2a, T2b, T3a, T3b, T3c, M1 sim phase, the goldens G1-G4 as your LA-E5-23 qa.md lists): no wire byte may change after the async store port. If time runs short, finish the running suite and stop.
When done, send "QA-2 stack down" with the after-slot records at once, then worker_done with the qa.md files.
If I send PAUSE DOCKER, finish the running suite, bring your stack down and wait.

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
