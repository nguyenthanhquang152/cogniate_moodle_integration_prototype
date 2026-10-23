# P4 dispatch: lead QA (Antigravity): wave-end gate preparation (host-only now; Docker later by DOCKER-YES)

Same terminal session and rules. Your LA-E5-13 files are committed (la-qa e664adb3; integration 43d5073c). The other run has the host 15:09-15:30Z; then QA-E2E's K2 Round 2; then the wave-end gates.
Wave-end SHA candidate: code 5260eac5 (integration 43d5073c holds it plus QA and docs files; Lead check green: 3302 unit, 255 infra, 145 K0, F1 0, F5 6 rules). It is final unless QA-E2E's K2 Round 2 finds a product defect (then I name a new SHA). All LA tasks not waiting for a human decision are built and approved; the human-gated ones (LA-E3-08, -10, -14, LA-E4-08, LA-E6-03, -07, LA-E7-11) are out of this wave.
Prepare host-only now (update tests/ltiaas/GATE-RUN-PLAN.md and your scratch clones):
1. Slot 3B on the wave-end SHA: LA-E7-08 SIM-lane gate (M1 migration + snapshot upgrade, U1 SIM continuity from the 1b17261 seed, M2 browser suite), plus the candidate golden compare G1-G4 with ALL approved LD-9 records (LA-IC-01, -03, -04, -12..-21; LA-IC-14 and -04 now apply).
2. Slot 7 on the intake SHA 1b17261: LA-E0-02 baseline regression record and LA-E0-04 LD-1 parity with --replace-tests (the LD-1 frozen-test rewrite, la-qa f0a7b306, lands here: B-LD9-13).
3. Slot 8 on the wave-end SHA with QA-E2E: MOODLE-LIVE R2-lite + T7 x1 + K2 U1/U2 (QA-E2E's part), the six frozen isolation ACs (AC-T2-18, AC-T4-16, AC-T4-29, AC-T4-34, AC-T7-08, AC-T7-09).
For each slot: the exact commands, the compose projects (qalead-la-10.. new numbers), the estimated minutes, and the expected-delta set. Send a status message "wave-end plan ready" with the file list and the minutes per slot; then worker_done. No Docker now.

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
