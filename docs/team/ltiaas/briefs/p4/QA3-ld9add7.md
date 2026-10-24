# P4 dispatch: QA-3 (Antigravity, same session): LD-9 addendum r7: the frozen T8 AC-T8-10 option race (WE-F13) (host only)

Same terminal session and rules. Your addendum r6 is committed (integration a2dc6270); its reviews run now.
WE-F13 (run D1, qalead-la-80, docs/reviews/LA-E7-08/qa.md and the D1 artifacts in /Users/quangnguyen/cogniate-qa-runs/LA/RUN-D1/): T8 AC-T8-10 (with token) failed at tests/acceptance/T8/2-shell.spec.ts:34-35: the synchronous evaluateAll read the combobox options before the async /app-api/connections answer filled them; the expected option "Dev Moodle (Moodle, moodle.test:9543)" is in error-context.md 194 ms later. The same case passed in slot 8b (qalead-la-52) and in run D2 (qalead-la-99), so it is a race in the line that your addendum r3 changed under the M2 approval, the same class as WE-F11 (A1 BD-A1-117).
Do: in a scratch `git clone --no-hardlinks` of /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-final-1 at la-final-test-1 (never edit the gate sources), before the option is read wait until the combobox has the expected option (for example `await expect(combobox.locator('option', { hasText: `${name} (` })).toHaveCount(1)` or the frozen helper the file already uses), and keep every assertion. Write docs/reviews/LA-E7-08/ld9-addendum-r7.md: the exact `git diff` (base la-final-test-1), `git apply --check` on la-final-test-1 AND on la-final-test-1 with addendum r6 applied (the two do not overlap), the type (frozen-test race fix; same class as BD-A1-117; no LA-IC), the reason with the D1 evidence, and the re-gate rows (AC-T8-10 in both runs). Check the other new waits of addendum r3 in T6/T8 for the same race and fix them in the same addendum if they read async lists synchronously. Typecheck in the scratch clone; no stack. One worker_done.

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
