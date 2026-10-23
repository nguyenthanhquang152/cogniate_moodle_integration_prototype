# P4 dispatch: QA-3 (Antigravity), run 13: LA-E5-12 R1, LA-E4-03 R3, LA-E1-09 R2, LA-E1-12 AC-02 test fix (host-only)

Same terminal session and rules. Your run-12 files are committed (f755bc8). 894406f (the Lead full check on this SHA runs now; if your R0 check fails, report it and stop). Clone into a NEW folder (--no-hardlinks, npm ci). Then:
1. LA-E5-12 Round 1 (lane K, merge 13e984b: app CLI --operator and evidence flags; revoke with --operator only via evidenceRequired false (A2 BD-A2-63); the policy line printed as given (BD-A2-59); one audit event per run in the change transaction; refused events with the stable codes of the app API delta §7 (A1 BD-A1-67); a policy refusal never writes an event). Run your test-first LA-E5-12 suite and the UNIT rows.
2. LA-E4-03 Round 3 (lane R fix round 2, merge 9e4bc18: the 429 pause check reads every row of the partition whatever its status; app migration 017_record_dispatch_pause (partial index); a failed or superseded carrier keeps the pause; release exactly at retryAt). Add rows for a window-end failed carrier followed by a new learner and by a better result.
3. LA-E1-09 Round 2 (lane K follow-ups, merge 141ffe3: names inserted literally (B-LA-E1-09-01); app http_request path = route template or <unmatched> (A1 BD-A1-62); kernel texts.registration (BD-A1-59, no page change)). Re-run the LA-E1-09 rows these touch.
4. LA-E1-12 AC-02 (lane K note): your AC-02 test looks for scope.exceptions or scope.f1.exceptions, but packages/channel-kernel/fitness-scope.json has the LA-E1-04 format read by infra/scripts/fitness/common.mjs (classes.coreExceptions.globs). Align your test to the real format (read the spec and README §4, not the product source); the file lists only legacy-wire.ts and the two applied-migration globs. LA-E1-12 itself closes later (lane P's portal part is still open), so record AC-02 only.
Stack rows stay pending Docker. Write the qa.md files (new round sections). One worker_done.

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
