# P4 dispatch: lead QA (Antigravity): LD-9 round 6 fixes, LA-IC-01 (host-only)

Same terminal session and rules. Your K0 kit change (BD-A1-110) and LA-E7-01 Round 4 are committed (integration 879228b6, d4f58a44).
LD-9 round 6 (docs/reviews/LA-LD9/reviewer-a.md and reviewer-b.md, section "Round 6"): LA-IC-03, LA-IC-04, LA-IC-12 and LA-IC-14 are APPROVE by both (fix the NITs/MINOR they list in the same pass: the cited evidence metadata). LA-IC-01 (your new record) is CHANGES_REQUESTED by both: Reviewer-A 2 MAJOR (the wildcard rules accept wrong or missing channel fields; the exact Brightspace rows reject the current app response), Reviewer-B 1 MAJOR (five wrong channel values still pass the comparison). Tighten LA-IC-01 so a wrong or missing channel value fails and the current answer passes (check against integration HEAD: lti-generic and brightspace now show tool rows via 'channel', and LA-E6-04 turned setup.connectionCheck on for canvas and lti-generic); add negative controls to golden.k0.test.mjs (a planted wrong value fails).
Integration SHA: d12b7b94 or later (Lead check green: 3156 unit, 255 infra, 145 K0, F1 0, F5 6). Clone into a NEW folder (--no-hardlinks, npm ci). Verify golden.k0.test.mjs and the compare in a host-only run. One worker_done with the file list.
Your LA-E5-13 SIM rows: I plan a short slot after QA-E2E's slot 6 part 1; keep the run commands ready.

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
