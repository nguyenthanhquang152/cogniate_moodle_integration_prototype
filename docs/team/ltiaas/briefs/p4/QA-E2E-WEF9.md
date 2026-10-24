# P4 dispatch: QA-E2E (Antigravity): WE-F9 fix (host only): your R2-SIM spec must not run inside the frozen T7 runner

Same terminal session and rules. Your slot 8 files are committed (integration b5f68c4b); both reviewers review the new live spec, config and runner now.
WE-F9 (slot 8, lead QA part, qalead-la-30, docs/reviews/LA-E7-08/qa.md §7): the frozen T7 runner (tests/e2e/host/run-t7.mjs on the default Moodle stack) also picks up tests/e2e/ltiaas/r2-moodle-sim.spec.ts (your LA-E7-09 R2-SIM case), which fails there with "Exact QA_PRODUCT_SHA required for product evidence at ../acceptance/M1/canvas/browser.ts:21". A new LA test must not change the result of a frozen suite (AC-LA-E7-08-05: additive simulator options only).
Fix it in your own files only (never in a frozen T7 file): make the R2-SIM case run only in its own SIM runner and project (for example a project or file-name pattern that the T7 Playwright config does not match, or an explicit skip with a clear reason when its own runner env is not set), so that the T7 runner's case list is the same as on the baseline. Prove it host only: list the case ids that the T7 Playwright config selects at the baseline 1b17261 test tree and with your fix (`--list`), and show they are equal; show that your own R2-SIM runner still selects the case. Check the same for any other new spec under tests/e2e that a frozen runner selects (T7, M2, T6/T8 configs).
Update docs/reviews/LA-E7-09/qa.md (a new round row). One worker_done with every changed file.

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
