# P4 dispatch: lead QA (Antigravity): build the final gate sources, then DOCKER-YES slot 3F on the FINAL product SHA a8bbac53

Same terminal session and rules. Your LD-1 fix round 3 is committed and both reviewers approve it (docs/reviews/LA-E0-04/). The final product SHA is a8bbac53 (a8bbac538cfe1e305f410279d7879421d64a5a1f): 8fadb828 plus lane P's data-channel-id on every channel card (BD-A1-119; A and B APPROVE; Lead full check green: 3316 unit, 255 infra, 149 K0, F1 0, F5 6).
Step 1 (host), under `set -euo pipefail` (assign, then export):
(a) the final test tree la-gate-test-7: a fresh `git clone --no-hardlinks` of src-wave-end-6 at la-gate-test-6, apply the approved addendum r5 (its latest round), one new commit, tag la-gate-test-7.
(b) src-final-1: a fresh `git clone --no-hardlinks` of the integration worktree at a8bbac53; `git restore --source=<la-gate-test-7 commit fetched from src-wave-end-7> --staged --worktree -- tests`; prove `git rev-parse HEAD:tests` after the commit equals `la-gate-test-7:tests` and that no non-test file differs from a8bbac53; one commit; tag la-final-test-1.
(c) src-slot7-r2: a fresh clone of src-slot7-1b17261 at 357d1799 with only the LD-1 oracle files of addendum r5 (the baseline branch of the oracle); tag la-slot7-test-2.
Update GATE-RUN-PLAN (§3F).
Step 2 (Docker, at once after step 1): 90 minutes. One stack at a time; SIM lane qalead-la-60..64 (PUBLIC_PORT 9473, STACK_SUBNET 172.23.0.0/16), then Moodle lane qalead-la-65..66 (PUBLIC_PORT 9543, STACK_SUBNET 172.21.0.0/16); before/after Docker records (umask 077; the 32 volume records with inspect); owned-only cleanup; your own ps and `docker events` watchers. Never touch sto-*.
Runs (--sha a8bbac538cfe1e305f410279d7879421d64a5a1f, --test-sha la-final-test-1, --source src-final-1 unless named): qalead-la-60 M2; -61 M1 migration; -62 M1 snapshot-upgrade; -63 G1-G4 capture and compare; -64 M2 on 1b17261 (src-slot7-r2, la-slot7-test-2: LD-1 parity); -65 T6 (with T5a); -66 T7 x1.
Report: append "## 12. Slot 3F on the final SHA (<UTC time>)" to docs/reviews/LA-E7-08/qa.md and a round row in docs/reviews/LA-E0-04/qa.md: exact accounting per run; the 01-cards case ids; the ledger rows (M1-41.common.j-snapshot and the migration rows); the golden compare result; LD-1 parity on 1b17261; T6 and T7 by id. Then the final verdict lines of LA-E7-08 AC-01..06 and LA-E7-09 AC-01..05 (AC-01/-03 of LA-E7-09 from slot 8d on 8fadb828 + this T7 x1; say which product change each run covers). Do not commit in la-qa.
When done, send "lead QA stack down" with the records at once (QA-E2E's K2 on a8bbac53 follows); then worker_done. If I send PAUSE DOCKER, finish the running suite, bring your stack down and wait.

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
