# P4 dispatch: QA-E2E (Antigravity): simulator harness open world (LA-E7-02 follow-up) + LA-E7-02 K1-SIM row map (host only)

Same terminal session and rules. Your LA-E5-24 R1 host files are committed (la-qa fa3ecc6a); the live drill waits for a SIM slot.
1. Open world (the Docs lane found it while it wrote the LA-E8-01 "add a channel" guide). tests/sim/core/loading.test.mjs ("HARNESS ONLY: committed tests/sim/hosts.json matches all 6 providers") asserts exactly 6 providers, 16 aliases and 15 allowlist hosts. So a new LMS that adds one simulator module and one tests/sim/hosts.json entry (the guide path; TEST-STRATEGY §2.5; LA-ADR-02 D7) fails this self-test. Change the self-test so that it derives the expected set from tests/sim/hosts.json and the provider folders (each entry loads, each alias and host is unique, the 6 known providers are still present with their values), and add a canary test: a seventh provider in a scratch copy joins with no change to shared lists. Do not weaken the checks of the existing providers.
2. LA-E7-02 K1-SIM rows: docs/reviews/LA-E7-02/qa.md still lists its five ACs "pending: Docker window". For each AC, cite an existing SIM row that already proves it (for example LA-E2-05 SIM E2-05-04 and -10, the K2 rounds, slot 3B), with the qa.md row and artifact path; if no row proves it, map it to your next SIM slot (with the LA-E5-24 drill) with its command and minutes.
Write the result in docs/reviews/LA-E7-02/qa.md (Round 5: host). One worker_done with the file list.

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
