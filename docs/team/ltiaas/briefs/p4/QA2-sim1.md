# P4 dispatch: QA-2 (Antigravity), K1-SIM slot 1 — DOCKER-YES

DOCKER-YES for QA-2: this is the explicit Lead grant that your K1-SIM-RUN-PLAN.md asks for. The other run on this machine released its host-only hold on LA at 20:13Z (charter-LA §0, board incident record). Window: 01:36Z to 03:36Z (120 minutes). You are the ONLY LA Docker user in this window.

Rules of the grant (stop-the-line if broken):
- Integration SHA: 19d6dc4 (Lead full check green: 2857 unit, 254 infra, 121 K0, F1 0 hits, F5 6 rules). Clone it into a NEW folder (--no-hardlinks, npm ci).
- One stack at a time, only your compose projects qa2-la-sim-r1 .. qa2-la-sim-r4, PUBLIC_PORT 9443, STACK_SUBNET 172.20.0.0/16. Use the stack scripts and the allowed command forms of tasks README §2; nothing else.
- Before the first stack: record docker ps -a, docker network ls and docker volume ls (sorted) into your private run folder (umask 077), and the free memory. Start a host ps watcher at launch (memory rule: shared Docker window traps). After each stack and at the end: docker volume ls must equal the "before" list plus only your own project volumes while a stack is up, and exactly the "before" list after your cleanup. The 32 volume records that existed at the release must never change.
- Never touch, stop, prune or remove a container, network or volume that you did not create in this window. Remove only your own stack (down -v on your own project) at the end of each batch.
- Run order: your plan §1 (batches 1a, 1b, 2, 3a, 3b, 3c, 4). Add the new suites where they fit: LA-E5-20 (tests/ltiaas/tasks-ops/LA-E5-20, written in run 8) in batch 2. Skip a suite whose task has an open fix round only if its K1-SIM rows test the open finding (LA-E5-21 key-ring start: run it and record the result; it is input for the fix round).
- Stop at the window end even if suites remain; leave no stack up; report what is left.
- If the Lead sends "PAUSE DOCKER", finish the running suite, bring your stack down, and stop.
Output: the K1-SIM rows of each docs/reviews/LA-<task>/qa.md (a new round section "Round n: K1-SIM"), with test id, command, artifact path and the measured time; a summary table in your worker_done (task, rows PASS/FAIL, time), plus the before/after Docker records (names only, no secrets). One worker_done.

# Common rules for LA build test authors (P4: QA, QA-2, QA-3, QA-4)

Milestone LA. You are an independent QA test author (Claude Code Opus 5.5, effort xhigh). You are never an Author, Architect or Reviewer. The Lead coordinates Orca run run_06d07dc77faf.

Read first: CLAUDE.md; docs/team/charter.md; docs/team/ltiaas/charter-LA.md; docs/team/ltiaas/plan.md §6.1 (LD-1..LD-19; LD-18: you write docs/reviews/LA-<task>/qa.md for your tasks); tests/ltiaas/TEST-STRATEGY.md; docs/architecture/ltiaas/tasks/README.md §2 (your folder, your compose project prefix, the allowed command forms (a)-(k)), §3 (public surfaces), §6 (evidence); the task specs in your brief.

Workspace: the shared QA worktree /Users/quangnguyen/orca/workspaces/cogniate_moodle_integration_prototype/la-qa (branch nguyenthanhquang152/la-qa). Write only in your own folder (tasks README §2 table) and, for each task you verify, docs/reviews/LA-<task id>/qa.md. Do not commit, stash, checkout or reset; the Lead commits by path.

Test-first: write each test from the task spec ACs, the contracts and the design only. Do not read Author notes, Author worker_done bodies, the Authors' lane branches or product source code to write tests (memory rule: QA never greps service source; use contracts, design, tests and infra for facts). If you read product source by mistake, disclose it in qa.md and in your worker_done.

Runs: when the Lead gives you an integration SHA to verify, clone that SHA into a NEW folder outside the repo (for example ~/cogniate-qa-runs/LA/<task>/r<round>/) with `git clone --no-hardlinks`, use only your own compose project prefix (tasks README §2) with its own PUBLIC_PORT and STACK_SUBNET, and run there. Docker: check `docker ps` and free memory first; another run's QA uses Docker on this machine (projects qa-multi-*): never touch, stop or remove containers or volumes you did not create; if memory is short, ask the Lead for a slot. Remove your own stack at the end. Private evidence (secrets) stays in the run folder, born with umask 077.

qa.md (one per task, per round; base charter §6): first lines "Verdict: PASS | FAIL" and "Round: n"; the SHA; one row per AC (PASS, FAIL or pending; test id; command; artifact path); the measured time of each new suite. Keep it short and proportional (charter-LA §5).

Done report (one worker_done, --outcome succeeded even when the verdict is FAIL; the verdict is in qa.md): three sentences: what you wrote or ran, the verdict and counts, what is left. --files-modified, --report-path. Then stop. Next tasks come as new dispatches.

Orca: follow your preamble; heartbeats at its cadence; read only your own messages at each checkpoint. Messages from a shell: body from a file, "$(cat file)". STE (about 80%).
