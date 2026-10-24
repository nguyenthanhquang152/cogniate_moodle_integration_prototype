# P4 dispatch: QA-3 (Antigravity): LD-9 addendum r4: two frozen-test race fixes (WE-F10, WE-F11) (host only)

Same terminal session and rules. Your addendum r3 is approved by both reviewers and ran in slot 8b (la-gate-test-5 = 0700b396 in /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end-5). Two frozen cases fail by a test race that A1 found on both SHAs (not LA differences). Fix only the race; keep every assertion.
1. WE-F11 (A1 BD-A1-117; build-decisions-A1.md): tests/acceptance/T6/3-courses.spec.ts AC-T6-07 reads dialog.innerText() 2.6 ms after the dialog is visible, while it still shows "Loading…". A1's fix: after `await expect(dialog).toBeVisible();` (:131) add `await expect(dialog.getByText('Loading…')).toHaveCount(0);` and keep the innerText reads and every assertion.
2. WE-F10 (A1 BD-A1-116): tests/acceptance/T5b/1-html.spec.ts AC-T5-36 (hanging hosts): under the hanging context the learner's first progress commit can miss the "index" page, so the HTML result never becomes passed. A1's fix: before driveCourse, wait for the runtime commit whose progress.seenPages contains "index" (or another signal that the menu page was recorded), then drive the course. Use the frozen helpers and the page/route tools the file already uses; do not read product source.
Do: in a scratch `git clone --no-hardlinks` of src-wave-end-5 at la-gate-test-5 (never edit the gate source), make the two edits. Write docs/reviews/LA-E7-08/ld9-addendum-r4.md: the exact `git diff` (base la-gate-test-5), `git apply --check` on la-gate-test-5, the item type (frozen-test race fix; A1 BD-A1-116 and BD-A1-117; no LA-IC), the reason and the re-gate rows (AC-T6-07; AC-T5-36). Typecheck in the scratch clone; no stack. One worker_done; then both reviewers review it.

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
