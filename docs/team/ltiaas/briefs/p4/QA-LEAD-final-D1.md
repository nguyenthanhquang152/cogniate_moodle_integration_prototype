# P4 dispatch: lead QA (Antigravity): DOCKER-YES milestone-end full run D1 of 2 on the FINAL SHA a8bbac53 (AC-LA-E7-09-05; TEST-STRATEGY §4.4 R3)

Same terminal session and rules. Your slot 3F report is committed (integration 86a50df8). QA-E2E's K2 Round 5 passed 12/12 on a8bbac53. The product is final: a8bbac53 (a8bbac538cfe1e305f410279d7879421d64a5a1f).
AC-LA-E7-09-05: "Final SHA only: the two identical full runs of the milestone end (SIM and Moodle lanes) both pass; qa.md lists both run ids and times." This dispatch is run D1; run D2 follows with the same commands. Scope (R3, without K1: the kit's K1 run waits for the product-owner decision LA-H25): SIM lane M1 sim (394 rows), M2 (64 cases), G1-G4 capture and compare; Moodle lane T7 x3 (as in the slot 7 baseline: 3 x 17 + the demo skip) and every legacy group: T2a, T2b, T3a, T3b; T3c; T4a; T4b1, T4b2; T5a, T5b, T6; T8. QA-E2E runs K2 between D1 and D2.
Source: src-final-1 at tag la-final-test-1 (85ddf973; your slot 3F build; exact la-gate-test-7 tests on a8bbac53). Do not change it. --sha a8bbac538cfe1e305f410279d7879421d64a5a1f, --test-sha la-final-test-1.
DOCKER-YES: from now for 4 hours (the run is about 2.5-3 h). One stack at a time; SIM lane qalead-la-70..72 (PUBLIC_PORT 9473, STACK_SUBNET 172.23.0.0/16), Moodle lane qalead-la-73..80 (PUBLIC_PORT 9543, STACK_SUBNET 172.21.0.0/16); before/after Docker records (umask 077; the 32 volume records with inspect); owned-only cleanup; your own ps and `docker events` watchers. Never touch sto-*.
Report: append "## 13. Milestone-end full run D1 (<UTC time>)" to docs/reviews/LA-E7-08/qa.md: start and end time, every run id, exact accounting per run (status counts, every non-PASS id with its note; a flake is a finding and never a PASS for its run), the M3 rows as environment notes. Do not commit in la-qa.
When done, send "lead QA stack down" with the records at once; then worker_done. If I send PAUSE DOCKER, finish the running suite, bring your stack down and wait.

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
