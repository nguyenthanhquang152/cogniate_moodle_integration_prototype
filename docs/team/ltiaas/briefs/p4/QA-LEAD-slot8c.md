# P4 dispatch: lead QA (Antigravity): build src-wave-end-6, then DOCKER-YES slot 8c (T6 and T5b on WAVE-END SHA 8fadb828)

Same terminal session and rules. Your slot 8b files are committed (integration aa29334c). QA-E2E's slot 8b rerun passed 16/16 (secret scan 0 hits). WE-F10 (T5b AC-T5-36) and WE-F11 (T6 AC-T6-07) are frozen-test races on both SHAs (A1 BD-A1-116, BD-A1-117); QA-3's LD-9 addendum r4 fixes only the races and is approved by both reviewers (docs/reviews/LA-E7-08/ld9-addendum-r4.md and its -reviewer-a/-b files).
Step 1 (host): build /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end-6 under `set -euo pipefail` (assign, then export): a fresh `git clone --no-hardlinks` of src-wave-end-5 at la-gate-test-5 (0700b396); apply the addendum r4 patch (`git apply --check`, then `git apply`); one new commit (never amend); `git diff --stat la-gate-test-5 HEAD` = only T5b/1-html.spec.ts and T6/3-courses.spec.ts; tag la-gate-test-6. Update GATE-RUN-PLAN (§8c).
Step 2 (Docker, at once after step 1): 45 minutes. One stack at a time; only qalead-la-53..55; PUBLIC_PORT 9543; STACK_SUBNET 172.21.0.0/16; before/after Docker records (umask 077; the 32 volume records with inspect); owned-only cleanup; your own ps and `docker events` watchers. Never touch sto-*.
Runs (--sha <full 8fadb828>, --test-sha la-gate-test-6, --source src-wave-end-6): T6 (qalead-la-53, with T5a as your runner does); T5b twice (qalead-la-54, qalead-la-55).
Report: append "## 10. Slot 8c (<UTC time>)" to docs/reviews/LA-E7-08/qa.md (`date -u` first): exact accounting per run; AC-T6-07 and AC-T5-36 by id per run; then the LA-E7-09 Moodle-lane verdict lines (one per frozen suite: T2a/T2b/T3a/T3b, T3c, T4a, T4b1/T4b2, T5a, T5b, T6, T7, T8, with the slot and run that prove each) and the 12 task MOODLE-LIVE rows (one line each, final). Do not commit in la-qa; the Lead commits by path.
When done, send "lead QA stack down" with the records at once; then worker_done. If I send PAUSE DOCKER, finish the running suite, bring your stack down and wait.

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
