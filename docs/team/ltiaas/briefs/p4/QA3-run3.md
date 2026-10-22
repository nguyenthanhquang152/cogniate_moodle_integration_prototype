# P4 dispatch: QA-3 (Antigravity), run 3: one re-check, one test update, two test-first suites

Same terminal session and rules. Integration SHA: 3479be4 (clone it into a NEW folder, --no-hardlinks, npm ci). Your LA-E1-03 and LA-E7-10 qa.md files are committed (bd3c616).
1. LA-E4-01 Round 2 (lane R fix round 1, merged as 06efe56; Architect A1 BD-A1-10 added AC-LA-E4-01-11 item cooling and AC-LA-E4-01-12 instance id + lease limit to the spec): record the UNIT rows for AC-11 and AC-12 and re-run the earlier rows (npm run check in the clean clone; it was green at 06efe56). Add '## Round 2' to docs/reviews/LA-E4-01/qa.md.
2. LA-E1-04 test update (A1 BD-A1-15, recorded in README §4 F1 and the LA-E1-04 spec AC-02): F1 now also checks regular-expression literals (pattern text; a backslash + next character is a separator). Add K0 probes for AC-LA-E1-04-02 with regex literals (for example /canvas/, /^(moodle|canvas)-/ and an escaped host form) to tests/ltiaas/tasks-core/LA-E1-04. They fail on 3479be4 (F1 does not see regex literals yet) and must pass after lane P's fix round; no qa.md yet (the LA-E1-04 Round 1 run follows P's fix round).
3. Test-first suites from the specs (no run against product code yet): LA-E1-07 (lane K next: ConnectionSetup, authority strategies, LMS check, CLI) and LA-E1-11 (lane P next: portal shell, SDK, channel portal modules). K1-SIM rows: write them, mark 'pending: Docker window'.
One worker_done at the end with files and counts.

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
