# P4 dispatch: lead QA (Antigravity): LD-1 overlay fix round 2 (host only): card identity in every card state

Same terminal session and rules. Your fix round 1 is committed (la-qa 445bd87f; integration 953de0d7). Round 2 reviews (docs/reviews/LA-E0-04/reviewer-a.md and reviewer-b.md "## Round 2", integration, read only): the round 1 findings are closed (exact-match oracle; the ledger check, Lead LD-24), but both find that the new card extractor misreads a registered card in some states:
1. MAJOR (Reviewer-A): while connections are loading, the extractor rejects the registered generic card (a real-browser DOM probe).
2. MAJOR (B-LA-E0-04-02): a supported registered card that is not ready (its control is disabled) and has a distinct display title is rejected; keep the channel identity for disabled controls.
Fix both at the root: read each card's channel identity from a stable source that does not depend on the loading or ready state or on the display title (for example the card's own data attribute or the registry entry it links to; use only what the frozen M2 page and the registry expose, no product source), and wait for the card list to settle before the membership check. Add regressions for both states in tests/ltiaas/k0/ld1/open-world.test.* (loading; not ready and disabled with a distinct title), and keep the unregistered-card negative and the exact-match rule. Fix the MINORs too (the decision reference: the ledger approval is LD-24, not LA-H21; the app migration count).
Same procedure as round 1: a scratch clone of src-wave-end-6 at la-gate-test-6, the same edits in la-qa, a new "## Round 2" in docs/reviews/LA-E7-08/ld9-addendum-r5.md with the regenerated diff and `git apply --check`. Run the K0 ld1 tests and the typecheck. This is fix round 2 of 3 (charter-LA §5). One worker_done with every changed file.

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
