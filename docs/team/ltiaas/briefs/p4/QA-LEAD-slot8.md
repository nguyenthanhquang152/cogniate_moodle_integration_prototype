# P4 dispatch: lead QA (Antigravity): DOCKER-YES wave-end slot 8 (MOODLE-LIVE, your part) on WAVE-END SHA 8fadb828

Same terminal session and rules. Your slot 3C files are committed (see the Lead's commit after your worker_done).
DOCKER-YES: from now to 75 minutes after you start the first stack (your part is about 57 min). One stack at a time; only qalead-la-30..36; PUBLIC_PORT 9543; STACK_SUBNET 172.21.0.0/16; before/after Docker records (umask 077: docker ps -a, networks, the 32 volume records with inspect); owned-only cleanup; a host ps watcher and your own `docker events` watcher from launch. Never touch the sto-* containers; list them apart.
Source: src-wave-end-3 at WAVE_TEST_SHA_3 (tag la-gate-test-3; product 8fadb828). Do not change it.
Run GATE-RUN-PLAN §5 (slot 8, Lead QA part) with the new source and SHAs: 8.1 T7 x1 (qalead-la-30); 8.2 R2-lite: T2a, T2b, T3a, T3b (31), T3c (32), T4b1, T4b2 (33), T5a, T5b, T6 (34), T8 (35), T4a (36); 8.3 AC-LA-E5-13-06 (the 6 frozen isolation ACs from 8.1-8.2). Map each result to the 12 task MOODLE-LIVE rows of §5 (LA-E1-05, -07, -08, -09, -10, LA-E2-01, -02, LA-E3-05, -07, LA-E4-02, -03, LA-E5-22, LA-E5-13).
Report: docs/reviews/LA-E7-09 is QA-E2E's file; write your part in docs/reviews/LA-E7-08/qa.md "## 7. Slot 8 MOODLE-LIVE (Lead QA part)" (run `date -u` first): exact accounting per run from its own result file (status counts, every non-PASS id with its note), the M3 rows as environment notes with their cause, and one line per task row above (task, AC, PASS/FAIL, run, artifact path). Also update the "pending" MOODLE-LIVE row in each task's qa.md only if it is your file; otherwise list it for the Lead.
If a suite fails, finish the other suites, then report; do not change product code or the source. When done, send "lead QA stack down" with the records at once (QA-E2E's 20-minute part starts after it); then worker_done with the files. If I send PAUSE DOCKER, finish the running suite, bring your stack down and wait.

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
