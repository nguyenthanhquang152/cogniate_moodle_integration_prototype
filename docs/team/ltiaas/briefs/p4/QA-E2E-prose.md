# P4 dispatch: QA-E2E (Antigravity): deferred prose round (host only; qa.md files and small test-file fixes)

Same terminal session and rules. Your slot 8b rerun is committed (integration c93f9b4f). docs/team/ltiaas/deferred.md has three rows for you (MINOR and NIT findings that reviewers approved but asked to fix later). Fix them now:
1. LA-E7-02 r5 (A note, B MINOR x2): the AC-LA-E7-02-01 row says PASS while it cites the old M1 sim 376/394 (cite the final M1 sim 394/394 on 8fadb828, slot 3D, docs/reviews/LA-E7-08/qa.md §8); the dot-directory scan parity in verifyOpenWorldSimManifest; the wrong generic SIM artifact pointer and endpoint path in the R5 row map.
2. LA-E5-24 r2 (B-LA-E5-24-04 MINOR; A-05, A-06 NITs; note): the host line-coverage statement; a self-test that pins each of the three redaction layers; remove the raw dead r2 playId from qa.md:29 and the self-test fixture (use its hash prefix); disclose by append the 4 held r2 evidence files that you rewrote at 21:00:48Z to redact the playId (file, time, old and new sha256).
3. LA-E7-09 r2 (A-05..A-07 NITs, B-03/B-04 MINORs): the qa.md T6 and T5a/T8 commands (--grep @T6 selects 0; use the QA_TASK form) and the stale line; the run-k2 harness typecheck skip message and the file count; the runner's rescan of r.ART; the saved-log links and the acceptance reproduction commands.
Host checks only (run the self-tests you touch). No Docker. Add a dated "Round <next>: prose" note to each qa.md you change. One worker_done with every changed file.

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
