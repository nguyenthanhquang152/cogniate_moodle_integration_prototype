# P4 dispatch: lead QA (Antigravity): Docker gate run plan and slot schedule (host-only; no Docker yet)

Same terminal session and rules. Your LA-IC-20 record is committed (b3807f4). The other run on this machine released its host-only hold on LA at 20:13Z. LA now uses Docker only by explicit Lead grants, one QA stack at a time (charter-LA §0). QA-2 holds slot 1 now (until about 03:36Z); QA-3 and QA-4 write their K1-SIM run plans now; QA-E2E is in a fix round.
Task (host-only, no Docker command), as the owner of all gate runs and the Docker slot schedule (plan LD-13, LD-17):
1. Write tests/ltiaas/GATE-RUN-PLAN.md for the runs that need Docker and belong to you: LA-E0-02 (baseline regression record), LA-E0-03 (golden G1-G4: the BASELINE captures on the intake SHA 1b17261 first, then the capture and compare at the current integration SHA with every approved LD-9 list LA-IC-12, -13, -15..-20), the LA-E0-03/LA-E0-04 rows that wait for Docker, and LA-E7-08 (wave-end SIM-lane gate for B1-B2, with the M1/M2/T7 regressions it names). For each: order, compose project names qalead-la-<n>, PUBLIC_PORT 9473, STACK_SUBNET 172.23.0.0/16, estimated minutes, exact commands (tasks README §2 forms), before/after Docker records, owned-only cleanup.
2. A slot schedule in the same file: after QA-2 slot 1, the order of the next slots (your gate runs, QA-3, QA-4, QA-E2E incl. LA-E7-09 and K2, and any MOODLE-LIVE rows), with estimated length, so the golden baseline exists before any compare needs it. Name what must run on the intake SHA and what on the current SHA.
3. Run your host-only pre-window gate once on integration SHA f2e340e (code as 19d6dc4) and record the result.
One worker_done with the plan path and the total estimated minutes per slot.

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
