# P4 dispatch: lead QA (Antigravity): A1 BD-A1-111 P2 QA-file updates (host-only; one-time grant across QA folders)

Same terminal session and rules. Your LD-9 round 7 fixes are committed (integration b796b1ec); round 8: A APPROVE (1 NIT), B pending.
A1 BD-A1-111 (from QA-E2E's live K2 run): lti-generic names.text becomes 'LMS' (was 'your LMS'; lane K changes packages/channels/lti-generic/manifest.ts in parallel). No baseline byte changes, so no LA-IC and no LD-9 baseline entry. Lead one-time grant: YOU update every QA file that pins the old lti-generic value, in all QA folders: tests/ltiaas/tasks-core/LA-E2-03/lti-generic.k0.test.ts:145 and lti-generic.k1sim.test.ts:86 (QA-3's), tests/ltiaas/k0/ld1/open-world.test.ts:44, tests/ltiaas/tasks-lti/LA-E3-05/picker-completeness.k1sim.test.ts:146 if it is the lti-generic page (QA-4's), the LA-IC-01 golden expected channelName of the lti-generic entry (three places), and tests/e2e/ltiaas/03-u3-new-channels-flow.k2.ts:120 and :369 (QA-E2E's; QA-E2E also fixes its P1 test in 01-u1-cards.k2.ts now: change only lines 120 and 369 of the 03 file). Tests that use 'your LMS' as a made-up test channel name, and the kernel/player fallback GENERIC_TEXT_NAME, stay as they are.
Verify in a NEW clone of integration HEAD with lane K's commit merged on top in your clone only (I send the K SHA as a reply to your ask: run orca orchestration ask --question 'lead QA ready for the BD-A1-111 K SHA' after your edits): npm run test:k0, golden.k0.test.mjs and the touched suites green. Send a status "BD-A1-111 QA files ready" with the file list, then worker_done.

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
