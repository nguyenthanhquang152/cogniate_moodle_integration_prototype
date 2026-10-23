# P4 dispatch: QA-2 (Antigravity): LD-9 record LA-IC-03 fix round (host-only; one-time grant)

Same terminal session and rules. Your slot-1 files are committed (la-qa f63eda7; integration e1e4fab). Thank you for the early, clean return.
Lead process call (one-time grant): the lead QA is inside its Docker slots, so YOU fix its LD-9 record tests/ltiaas/golden/expected/LA-IC-03.json (and, only if needed, its rows in tests/ltiaas/TEST-STRATEGY.md §4.7 and tests/ltiaas/golden/README.md §5). Do not touch other records (QA-4 writes LA-IC-14 and LA-IC-04 now).
LD-9 round 5 (docs/reviews/LA-LD9/reviewer-a.md and reviewer-b.md, section "Round 5", LA-IC-03): both reviewers CHANGES_REQUESTED with 1 MAJOR: the record's scan treats the query-bearing LA-E5-06 simulator configuration URL as unchanged, but the standard profile now refuses a configuration that is not at issuer + /mod/lti/openid-configuration.php (a route probe gives 400 configuration_path_mismatch). Record that fixture impact (which fixture, which test, what changes, and whether a frozen test moves), and correct the scan descriptions the reviewers cite (plus the shared NIT). LA-E5-06 tests are in QA-4's folder (tests/ltiaas/tasks-lti/LA-E5-06/): if a fixture there must move, name it in the record and tell me (QA-4 changes its own file).
Verify in a NEW clone of integration e1e4fab (--no-hardlinks, npm ci; delete node_modules/.vitest-cache before every vitest run): the golden K0 tests (tests/ltiaas/golden/golden.k0.test.mjs) pass. One worker_done with the file list.

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
