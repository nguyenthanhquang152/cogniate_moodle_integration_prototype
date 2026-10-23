# P4 dispatch: lead QA (Antigravity): DOCKER-YES wave-end re-gate slot 3C on the new WAVE-END SHA 93ab0c50

Same terminal session and rules. Your src-wave-end-2 commit 1 (bf815340) is committed in the plan and the Lead verified it read-only: `bf815340:tests` = `8ad12926:tests` = tree f42d4150, and no non-test file differs from 93ab0c50. Both reviewers approved all three addendum hunks (round 2); their round 3 check of the source procedure runs now and does not block this slot.
Step 1 (host, before Docker): in src-wave-end-2 only, under `set -euo pipefail`: apply the approved Round 2 combined patch (docs/reviews/LA-E7-08/ld9-addendum-r1.md §Round 2) with `git apply --check` then `git apply`, commit it as commit 2 (a new commit, never an amend), and show `git diff --stat bf815340 HEAD` = exactly the three files (11-canvas-platforms.test.ts, 99-logs.test.ts, tests/host/m1-migration.mjs), one line each. Record WAVE_TEST_SHA_2 and tag it la-gate-test-2.
Step 2: DOCKER-YES: the window starts now (QA-E2E's drill stack is down) and ends 60 minutes after you start the first stack (about 35 min of runs). One stack at a time; only qalead-la-40..43; PUBLIC_PORT 9473; STACK_SUBNET 172.23.0.0/16; before/after Docker records (umask 077: docker ps -a, networks, the 32 volume records with inspect); owned-only cleanup; a host ps watcher and your own `docker events` watcher from launch. Never touch the sto-* containers; list them apart.
Runs (GATE-RUN-PLAN §3C; --sha 93ab0c50467772f7f1c4b5fa9feb137048305c43, --test-sha WAVE_TEST_SHA_2, --source src-wave-end-2): M1 sim (394 rows), M1 snapshot-upgrade (6 rows), M2 (64 cases), G1-G4 candidate capture and compare with all approved LD-9 records.
Report (docs/reviews/LA-E7-08/qa.md: append "## 6. Re-gate slot 3C (<UTC time>)"; run `date -u` first): the exact accounting per run from each summary.json (status counts, every non-PASS id with its note, missing manifest ids); each of the 18 WE rows by id with its status and duration (the 7 M1-37 rows next to the slot 7 baseline times); the M3 rows as environment notes with their cause; the golden compare result. AC-LA-E7-08-01, -03, -04 and -05 each get a verdict line. If a suite fails, finish the other suites, then report; do not change product code or the sources.
When done, send "lead QA stack down" with the records at once; then worker_done with docs/reviews/LA-E7-08/qa.md and tests/ltiaas/GATE-RUN-PLAN.md. Slot 8 (QA-E2E MOODLE-LIVE on the same source) follows. If I send PAUSE DOCKER, finish the running suite, bring your stack down and wait.

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
