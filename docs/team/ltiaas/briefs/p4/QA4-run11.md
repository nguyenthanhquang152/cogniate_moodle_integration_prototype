# P4 dispatch: QA-4 (Antigravity), run 11: LA-E2-01 R1, LA-E2-02 R1, fixture updates (host-only; Docker is with the other run until about 04:22Z)

Same terminal session and rules. Integration SHA: 6689a18 (code = 0e6bace; Lead full check green with node_modules/.vitest-cache deleted: 2998 unit, 254 infra, 134 K0, F1 0, F5 6 rules). Clone into a NEW folder (--no-hardlinks, npm ci); delete node_modules/.vitest-cache before every vitest run. Then:
1. LA-E2-01 Round 1 (lane L, merges b33c178, 4b0f003 + fix d6a0b82 in 3b3dadf): E2 profile traits with registry defaults and load check 7 (A1 BD-A1-74/75), migration 020, token client from traits, I-SELF admin-value rules, the audience rule for every admin profile (BD-A1-82). Update your K0 test text: the DR token value is 'scope-jwt' now (A1 BD-A1-76), not 'moodle-scope-jwt' (tests/ltiaas/tasks-lti/LA-E2-01/profile-traits.k0.test.ts AC-01).
2. LA-E2-02 Round 1 (lane L, merge 865c3d0 + fix rounds ddf3771, 734de51..80e31d7): staged DR per profile, migration 021 (token_kind CHECK), TOOL_MAY_EXIST (BD-A1-87), profile identity and binding-ref ownership (BD-A1-88), credentials as one set (BD-A1-89). Write the test-first suite first if it does not exist.
3. LA-IC-03 fixture (lane L note, the lead QA records LA-IC-03): your tests/ltiaas/tasks-lti/LA-E3-06/nrps-scopes.k1sim.test.ts starts DR with a qa-platform configuration at /openid-<id>.json and expects 303; the standard profile now refuses a configuration that is not at issuer + /mod/lti/openid-configuration.php. Move the fixture configuration to that path (or use a profile that allows it) so the K1-SIM row tests what it means to test.
K1-SIM / MOODLE rows stay pending Docker. Write the qa.md files. One worker_done.

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
