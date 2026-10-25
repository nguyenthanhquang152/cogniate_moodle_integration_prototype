# P4 dispatch: QA-E2E (Antigravity): DOCKER-YES slot 8b, your rerun: the repaired secret-hygiene row (LA-E7-09) on WAVE-END SHA 8fadb828

Same terminal session and rules. Your WE-F9 and slot 8 review fixes are committed (integration c48b76dc) and approved by both reviewers (LA-E7-09 round 2 APPROVE). The lead QA's slot 8b stack is down.
DOCKER-YES: from now for 40 minutes. One stack at a time; only qa-e2e-la-s8b-r1 (and -r2 only if the first run fails for an environment reason; say why); PUBLIC_PORT 9543; STACK_SUBNET 172.21.0.0/16; before/after Docker records (umask 077; the 32 volume records with inspect); owned-only cleanup; your own ps and `docker events` watchers. Never touch sto-*.
SHA: a NEW `git clone --no-hardlinks` of integration a7bd110e (product = 8fadb828; only docs and QA files after it). Use the committed test files only: no --replace-tests from the la-qa working tree, and no edit of your test files during the window. If a file must change, stop, report, and wait for a review.
Run run-slot8-moodle.mjs once, full (all S8 rows and the secret-hygiene row M3-07-S8 with the repaired scan).
Report: docs/reviews/LA-E7-09/qa.md (a new round; `date -u` first): exact accounting from the runner's summary.json (every id with its status), the scan result (secrets loaded, files scanned, hits), and the hashes of the test files that ran. When done, send "QA-E2E stack down" with the records, then worker_done. If I send PAUSE DOCKER, finish the running step, bring your stack down and wait.

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
