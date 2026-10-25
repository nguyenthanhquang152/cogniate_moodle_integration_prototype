# P4 dispatch: QA-4 (Antigravity), run 9: test-first suites and Round 1 for LA-E3-11, LA-E3-12, LA-E3-13, LA-E5-18 (host-only)

Same terminal session and rules. Your run-8 files are committed (aa3b214). Integration SHA: aa3b214 (code as 836d579; Lead full check green: 2743 unit, 252 infra, 121 K0, F1 29 hits in 9 files, F5 6 rules). These four tasks landed before their test-first suites existed. For each one, write the K0/K1-SIM suite from the spec ACs, the contracts and the design only (tests/ltiaas/tasks-lti/<task>/; boolean assertions that never print product source), then clone the SHA into a NEW folder (--no-hardlinks, npm ci) and run the K0 suite and the UNIT rows:
1. LA-E3-11 (lane L, merge 151f6a9: AGS extras: submission times, scoringUserId, HTTPS URL-keyed members, 8 extra members and 4096 UTF-8 JSON bytes per value, line-item preservation).
2. LA-E3-12 (lane L, merge a2dfc04: scoreGiven null as absent; NRPS service_versions check, 403 SERVICE_NOT_AVAILABLE; trusted extra audiences, LTI migration 018, check 5). LD-9 record LA-IC-13 (0 golden / 0 frozen-test changes) is committed by the lead QA.
3. LA-E3-13 (lane L2, merge 84d5679: Deep Linking per-type item fields: https url for link/file/image, string html; 400 INVALID_CONTENT_ITEM).
4. LA-E5-18 (lane L2, merge 1e65040: tool_account_id and platform_id, stored rows only, in login_rejected, launch_check_failed, launch_claims_minimized, launch_accepted).
K1-SIM / MOODLE rows stay pending Docker. Write four qa.md files (Round 1). One worker_done. Next (context only): LA-E5-06 R2 when the lane L fix round lands.

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
