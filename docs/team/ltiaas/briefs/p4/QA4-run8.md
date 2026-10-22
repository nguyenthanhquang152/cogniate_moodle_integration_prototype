# P4 dispatch: QA-4 (Antigravity), run 8: lane L Round runs, host-only (replaces run 7)

Same terminal session and rules. NOTE: the Lead's run-7 dispatch (ctx_00501fdc9026) never reached this terminal; ignore it. This run replaces it. Your run-6 files are committed. Integration SHA: a2dfc04 (Lead full check green: 2641 unit, 252 infra, 121 K0, F1 74 hits in 20 files, F5 6 rules; one known sqlite-lock-probe flake passed on rerun). Clone into a NEW folder (--no-hardlinks, npm ci). Run your K0 suites (tests/ltiaas/tasks-lti/<task>/) and the UNIT rows for:
1. LA-E3-01 Round 1 (merged 5ec8a69) and its fix round (in 3344520: static login text BD-A2-41, storageBindingOf, collision regression BD-A2-44): write docs/reviews/LA-E3-01/qa.md with Rounds 1 and 2.
2. LA-E3-02 Round 1 (Canvas platform storage; storage_check, LTI migration 015).
3. LA-E3-04 Round 1 (merged 3344520; LA-IC-12 empty Deep Linking responses; LD-9 list approved by both reviewers).
4. LA-E3-06 Rounds 1 and 2 (NRPS complete.scopes; fix round in 028c30a: explicit scopes only, unsupported scopes named, duplicates refused).
5. LA-E5-06 Round 1 (merged 028c30a: account resolver protocolUrls, status gates, session cap, F5 protocol-urls).
K1-SIM / MOODLE rows stay pending Docker. Boolean assertions that never print product source. Write the five qa.md files. One worker_done. Your next run (context only): test-first suites and Round 1 for LA-E3-11 (merged 151f6a9) and LA-E3-12 (merged a2dfc04), with the LA-IC-13 test-change list, then lane L2's LA-E3-13 and LA-E5-18.

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
