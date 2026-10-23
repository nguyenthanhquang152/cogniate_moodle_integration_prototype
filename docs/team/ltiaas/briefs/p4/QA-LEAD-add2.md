# P4 dispatch: lead QA (Antigravity): LD-9 addendum round 2 + re-gate slot 3C prep (host only; no Docker)

Same terminal session and rules. Your slot 7 files are committed (la-qa 2f6a2fd4; integration 56038618). Thank you: slot 7 is complete and clean, and your WE-F4 baseline per test id found a product defect (A2 BD-A2-109; lanes R and S1 fix the stop order now).
1. Addendum round 2: docs/reviews/LA-E7-08/ld9-addendum-r1.md had reviews A CHANGES_REQUESTED (A-LA-E7-08-01 MAJOR: the Part 2 hunk has context lines that are not in the frozen 99-logs.test.ts, so it cannot apply; A-LA-E7-08-02 MINOR: the prose names launch events that do not exist) and B APPROVE (B-LA-E7-08-LD9-01 MINOR: state the re-gate evidence per hunk). Files: docs/reviews/LA-E7-08/ld9-addendum-r1-reviewer-a.md and -reviewer-b.md (integration). Regenerate every hunk with `git diff` against the frozen base 8ad12926 in a scratch copy of src-wave-end (never edit src-wave-end itself), and prove each hunk applies with `git apply --check` on 8ad12926. Take event names only from contracts/lti-service-api-delta.md §6. For each hunk, name the re-gate row that proves it. Write the round 2 in the same file (a "## Round 2" section; keep round 1 for the record).
2. Re-gate slot 3C plan in tests/ltiaas/GATE-RUN-PLAN.md (no Docker now). The new WAVE-END SHA will be the integration commit after the WE-F4 fixes (R and S1) and a full check; the Lead names it. Write: (a) how you build the new gate source src-wave-end-2: a fresh `git clone --no-hardlinks` at the new SHA, then the 8ad12926 test overlay as one commit, then the approved addendum as a second commit (never an amend), with the SHAs recorded; (b) the run set with the reason for each: M1 sim (394 rows: the 18 WE rows must PASS), M1 snapshot-upgrade (6 rows), M2 (64), G1-G4 golden compare (the product changed after 80133d6b: the admin default, the Canvas help text, the stop order), and whether U1 and M1 migration must run again (no new migration after 80133d6b: say so and cite); (c) minutes per run and the project names (qalead-la-40.. ; 30..35 stay for slot 8), PUBLIC_PORT 9473, STACK_SUBNET 172.23.0.0/16.
One worker_done with the file list.

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
