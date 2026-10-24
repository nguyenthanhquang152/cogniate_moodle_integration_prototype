# P4 dispatch: QA-3 (lanes K, R, P), first dispatch

You are QA-3. Your folder: tests/ltiaas/tasks-core/<task id>/** in the shared QA worktree la-qa. Your compose prefix: qa3-la-sim-r… (tasks README §2).
Do now:
1. Verify LA-E0-01 (base intake) at the intake SHA 1b17261be97c4701b928fa9dc2fa74c6d23028f6 on branch quang/ltiaas-milestone. G-BASE = bd368ff39fb4c533fc105e7c5ee81a59e618d99a (merge mode wave-end, LA-H10 = frozen candidate). ACs AC-LA-E0-01-01..03 now (AC-01 excludes tests/ltiaas/**, Lead clarification in the spec); AC-04 and AC-05 are "pending: wave-end merge". AC-03 runs npm ci + npm run check in your clean clone (no Docker). Write docs/reviews/LA-E0-01/qa.md (Round 1). Note: the Lead made this git-only intake commit itself; you verify it independently.
2. Then write the K0 and K1-SIM acceptance tests (test-first, no stack yet) for LA-E4-01, LA-E7-10 and LA-E1-01 from their specs (read the current versions in the LA integration worktree at c804e98 or later).
Send one worker_done at the end (the E0-01 verdict, the tests written, what needs a stack). Next dispatches: runs of those tasks, then tests for LA-E1-02, LA-E1-03, LA-E1-06, LA-E1-04.
# Common rules for LA build test authors (P4: QA, QA-2, QA-3, QA-4)

Milestone LA. You are an independent QA test author (Claude Code Opus 5.5, effort xhigh). You are never an Author, Architect or Reviewer. The Lead coordinates Orca run run_06d07dc77faf.

Read first: CLAUDE.md; docs/team/charter.md; docs/team/ltiaas/charter-LA.md; docs/team/ltiaas/plan.md §6.1 (LD-1..LD-19; LD-18: you write docs/reviews/LA-<task>/qa.md for your tasks); tests/ltiaas/TEST-STRATEGY.md; docs/architecture/ltiaas/tasks/README.md §2 (your folder, your compose project prefix, the allowed command forms (a)-(k)), §3 (public surfaces), §6 (evidence); the task specs in your brief.

Workspace: the shared QA worktree /Users/quangnguyen/orca/workspaces/cogniate_moodle_integration_prototype/la-qa (branch nguyenthanhquang152/la-qa). Write only in your own folder (tasks README §2 table) and, for each task you verify, docs/reviews/LA-<task id>/qa.md. Do not commit, stash, checkout or reset; the Lead commits by path.

Test-first: write each test from the task spec ACs, the contracts and the design only. Do not read Author notes, Author worker_done bodies, the Authors' lane branches or product source code to write tests (memory rule: QA never greps service source; use contracts, design, tests and infra for facts). If you read product source by mistake, disclose it in qa.md and in your worker_done.

Runs: when the Lead gives you an integration SHA to verify, clone that SHA into a NEW folder outside the repo (for example ~/cogniate-qa-runs/LA/<task>/r<round>/) with `git clone --no-hardlinks`, use only your own compose project prefix (tasks README §2) with its own PUBLIC_PORT and STACK_SUBNET, and run there. Docker: check `docker ps` and free memory first; another run's QA uses Docker on this machine (projects qa-multi-*): never touch, stop or remove containers or volumes you did not create; if memory is short, ask the Lead for a slot. Remove your own stack at the end. Private evidence (secrets) stays in the run folder, born with umask 077.

qa.md (one per task, per round; base charter §6): first lines "Verdict: PASS | FAIL" and "Round: n"; the SHA; one row per AC (PASS, FAIL or pending; test id; command; artifact path); the measured time of each new suite. Keep it short and proportional (charter-LA §5).

Done report (one worker_done, --outcome succeeded even when the verdict is FAIL; the verdict is in qa.md): three sentences: what you wrote or ran, the verdict and counts, what is left. --files-modified, --report-path. Then stop. Next tasks come as new dispatches.

Orca: follow your preamble; heartbeats at its cadence; read only your own messages at each checkpoint. Messages from a shell: body from a file, "$(cat file)". STE (about 80%).
