# P4 dispatch: QA-4 (Antigravity), run 12: LA-E2-01 R2, LA-E2-02 R2, LA-E3-05 R1, LA-E1-10 K0 text (host-only)

Same terminal session and rules. Your run-11 files are committed (la-qa 18fa1d3). Integration SHA: 4db030d (code = 176e823; Lead full check green with node_modules/.vitest-cache and node_modules/.vite deleted: 3056 unit, 254 infra, 149 K0, F1 0 hits, F5 6 rules). Clone into a NEW folder (--no-hardlinks, npm ci); delete node_modules/.vitest-cache before every vitest run. Then:
1. LA-E2-01 Round 2 (lane L, in merge 678eb72): BD-A2-83 (needScope and the create preflight use the claim AND the platform grant, before the idempotency claim), BD-A2-84 (the client assertion audience and a DR authorization_server obey audience rule 2 on every create, staged or active; a non-URL clientAssertionAud is refused), the AC-09 old-row answer, load check 7 refuses {platformValue} on fixed endpoints. Add '## Round 2' to docs/reviews/LA-E2-01/qa.md.
2. LA-E2-02 Round 2 (lane L fix round 2, merge 678eb72): A1 BD-A1-93 (a DR update keeps the stored active value on both paths; staged -> false; autoActivate only on create; LD-9 LA-IC-21, recorded by the lead QA in 19da95e). Add '## Round 2' to docs/reviews/LA-E2-02/qa.md.
3. LA-E3-05 Round 1 (lane L2, merge 176e823): picker Cancel (empty Deep Linking answer with the message "No course was added.", Origin check, no pick), multi-select (1 to 20 ordered items only with content.multiple and acceptMultiple true, else exactly one id), PLACEMENT_NOT_GRADED (403 /tool/* page, log picker_rejected reason placement_not_graded, no Deep Linking call), app migration 018 picker_pick with a backfill that keeps every activities stat equal (AC-10), retention keeps an open multi-pick. Spec docs/architecture/ltiaas/tasks/LA-E3-05.md; LA-ADR-05 D3 (with A2's build notes, BD-A2-87); data-model §5b. Write the test-first suite first (your folder). K1-SIM rows (K1-DL D3-D5) stay pending Docker; the MOODLE-LIVE row is QA-E2E's. Write docs/reviews/LA-E3-05/qa.md (Round 1).
4. Item 7 of the lead QA K0 batch (it is in your folder, so the lead QA left it): tests/ltiaas/tasks-lti/LA-E1-10/providers-and-texts.k0.test.ts: align the assertion with A1 BD-A1-87 (docs/architecture/ltiaas/build-decisions-A1.md). Note: lane L now removes flags.clientAssertionAudArray (BD-A1-75); keep your LA-E2-02 K0 test (dynamic-registration.k0.test.ts) correct for both states, as it is today.
One worker_done.

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
