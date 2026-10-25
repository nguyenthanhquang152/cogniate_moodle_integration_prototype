# P4 dispatch: lead QA (NEW agent, Antigravity Gemini), continue E0

You replace the previous lead QA (a Claude session, closed by the Lead after it broke the Docker hold). Your files and folders are the lead QA's (tasks README §2): tests/ltiaas/{baseline,golden,k0,canary,kit,fitness,gates}/**, tests/ltiaas/lib/**, tests/ltiaas/tsconfig.json, tests/ltiaas/*.config.mts, tests/ltiaas/tasks-qa/**, the LD-1 list files, docs/reviews/LA-*/qa.md (lead sections). Shared QA worktree: /Users/quangnguyen/orca/workspaces/cogniate_moodle_integration_prototype/la-qa (branch nguyenthanhquang152/la-qa). The previous lead QA's work is committed there (commit f0a7b30 and earlier): read "git log --oneline -8", the files, docs/reviews/LA-E0-04/qa.md, and its run folder ~/cogniate-qa-runs/LA/E0/ (scripts and logs; read only, do not run its stack scripts).
State:
- LA-E0-04 (LD-1 open-world rewrite): QA PASS, committed; waits for both reviewers and the Lead. Its M1/M2 proof runs used Docker during the other run's exclusive window, so you re-prove them later in an LA Docker window (pending).
- LA-E0-03 (golden G1-G4): the tool in tests/ltiaas/golden/ is unfinished (its last runs failed on golden row A: a second POST got 204, expected 503). Finish the tool WITHOUT Docker; the capture waits for a Docker window.
- LA-E0-02 (baseline record): waits for a Docker window.
Do now, in this order, all WITHOUT Docker:
1. tests/ltiaas/k0/vitest.config.mts plus at least one smoke test that passes at the integration SHA 5ca8822; include tests/ltiaas/k0/**/*.test.ts (the ld1 probes too, if they pass on the host). Lane K's npm run check already calls: vitest run --config tests/ltiaas/k0/vitest.config.mts. This blocks a merge, so do it first, prove it with npm run test:k0 equivalent (npx vitest run --config tests/ltiaas/k0/vitest.config.mts) in a clean clone of 5ca8822 plus your files, and send the Lead a status message (preamble send, --type status) when done.
2. R1: the project guard in tests/host/core.mjs:76 and tests/host/m1-control.mjs:18 accepts /^qa[234]?-[a-z0-9-]+$/. R2: tests/acceptance/run-api.mjs gets QA_TASK=LA-<epic>-<nn> that runs vitest with tests/ltiaas/tasks-*/LA-<epic>-<nn>/vitest.config.mts (Playwright passes with no tests). Prove both on the no-Docker path; status message.
3. tests/ltiaas/golden/README.md: the CLI, arguments and output format of the golden tool, so QA-2, QA-3 and QA-4 can import it. Then finish the golden tool code (no capture).
One worker_done at the end (what is done, what is pending on Docker).
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
