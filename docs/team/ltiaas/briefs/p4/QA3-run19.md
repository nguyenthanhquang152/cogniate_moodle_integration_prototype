# P4 dispatch: QA-3 (Antigravity), run 19: LA-E4-07 R2, LA-E2-04 R4 (host-only)

Same terminal session and rules. Your run-18 files are committed (la-qa 095947c; integration 81bfcb7). Integration SHA: e654574 or later (the Lead check runs now; last green 8f1ecea). Clone into a NEW folder (--no-hardlinks, npm ci); delete node_modules/.vitest-cache before every vitest run.
1. LA-E4-07 Round 2 (lane R fix round 1, merge 8f1ecea, commit 5b89f42): both reviewers found that the launch refusal reason label accepted hyphens (AC-07: a reason outside [a-z][a-z0-9_]{0,63} becomes 'other'). Add boundary rows to your AC-07 test (hyphen, 64 chars kept, 65 chars, leading digit, upper case, empty -> 'other'; unknown channel -> ''), from the spec, and re-run. Add '## Round 2' to docs/reviews/LA-E4-07/qa.md.
2. LA-E2-04 Round 4 (A1 BD-A1-101 and BD-A1-102; merges 2434c26, 048cc5e, e654574): (a) the ordinary PLATFORM_IN_USE collision description comes from texts.registration.PLATFORM_IN_USE: for lti-generic (and brightspace) the core default "This LMS tool registration is already connected to Cogniate. Make a new tool registration for this library, or ask your Cogniate operator."; Canvas keeps today's bytes; (b) the staged-gone answer carries details.reason "staged_gone"; the ordinary collision has no details.reason; (c) the portal shows the server description when details.reason is present (build-decisions-A1.md BD-A1-101/102; app delta §3.4; LA-ADR-04 D8). Add the rows you can reach host-only to your LA-E2-04 suite. Add '## Round 4' to docs/reviews/LA-E2-04/qa.md.
K1-SIM rows stay pending (your Docker slot 4 later in the LA block; I send DOCKER-YES). One worker_done.

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
