# P4 dispatch: QA-E2E (Antigravity): DOCKER-YES slot 6: LA-E7-09 (AC-01..08) + LA-E7-07 K2 U1-U4

Same terminal session and rules. Your LA-E7-07 suite and the LA-E7-09 R2-sim glue are committed (la-qa fecef8f). Note: the LA Lead session was down from about 06:47Z to 11:57Z; the other run returned its planned window unused; LA Docker resumes now.
DOCKER-YES: window 12:07Z to 13:05Z. One stack at a time; only qa-e2e-la-sim-r1..r2; PUBLIC_PORT 9443; STACK_SUBNET 172.20.0.0/16; before/after Docker records (umask 077: docker ps -a, networks, the 32 volume records with inspect); owned-only cleanup; a host ps watcher from launch. A third Orca run (sto-*) may start its own containers on this host at any time: never touch, stop or remove them, and list them apart in your records (they are not LA's).
SHA: a NEW clone of integration 195930c1 (Lead full check green with caches deleted: 3260 unit, 255 infra, 145 K0, F1 0, F5 6 rules). Since 8c65424 it adds brightspace DR (LA-E2-06), the 'channel' tool rows for lti-generic and brightspace, Canvas DR (LA-E3-09/15/16), the connection check and health panel (LA-E6-01/02), the async LTI store (LA-E5-23) and the app key provider (LA-E5-22): if a K2 case needs an update for an intended change, record it in qa.md with the LD-9 record (LA-IC-xx) it belongs to.
Run: LA-E7-09 AC-01..08 (Moodle-shaped standard simulator channel end to end), then the LA-E7-07 K2 cases U1-U4 (12 cases). If time runs short, finish the running suite and stop.
When done, send "QA-E2E stack down" with the after-slot records at once, then worker_done with docs/reviews/LA-E7-09/qa.md and docs/reviews/LA-E7-07/qa.md.
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
