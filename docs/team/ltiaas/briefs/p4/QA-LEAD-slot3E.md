# P4 dispatch: lead QA (Antigravity): build the round 2 gate sources, then DOCKER-YES slot 3E (M2 and the migration phases with the fixed LD-1 oracle)

Same terminal session and rules. Your LD-1 overlay fix round 1 is committed (la-qa 445bd87f; integration 953de0d7), and both reviewers approve round 2 (docs/reviews/LA-E0-04/reviewer-a.md, -b.md).
Why: every earlier M2 run used the weaker card oracle, and the snapshot-upgrade runs used the ledger check without the old-ledger prefix check. So: M2 and the two migration phases run again on the wave-end SHA, and M2 runs again on the intake 1b17261 to re-prove LD-1 parity (LA-E0-04).
Step 1 (host): under `set -euo pipefail` (assign, then export): (a) src-wave-end-7: a fresh `git clone --no-hardlinks` of src-wave-end-6 at la-gate-test-6, apply addendum r5 (`git apply --check`, then `git apply`), one new commit, tag la-gate-test-7; `git diff --stat la-gate-test-6 HEAD` = only the addendum r5 files; (b) src-slot7-r2: a fresh `git clone --no-hardlinks` of src-slot7-1b17261 at 357d1799, apply only the LD-1 oracle files of addendum r5 that exist there (open-world lib and 01-cards; say which), one new commit, tag la-slot7-test-2. Update GATE-RUN-PLAN (§3E).
Step 2 (Docker, at once after step 1): 60 minutes. One stack at a time; only qalead-la-60..63; PUBLIC_PORT 9473; STACK_SUBNET 172.23.0.0/16; before/after Docker records (umask 077; the 32 volume records with inspect); owned-only cleanup; your own ps and `docker events` watchers. Never touch sto-*.
Runs: qalead-la-60 M2 on 8fadb828 (la-gate-test-7); qalead-la-61 M1 migration and qalead-la-62 M1 snapshot-upgrade on 8fadb828 (la-gate-test-7); qalead-la-63 M2 on 1b17261 (la-slot7-test-2).
Report: append "## 12. Slot 3E (<UTC time>)" to docs/reviews/LA-E7-08/qa.md and a round row in docs/reviews/LA-E0-04/qa.md: exact accounting per run, the 01-cards case ids by id, the ledger rows (M1-41.common.j-snapshot and the migration rows) by id, and the LD-1 parity verdict (1b17261) and the wave-end verdicts for AC-LA-E7-08-01 (M2 part) and -04. Do not commit in la-qa.
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
