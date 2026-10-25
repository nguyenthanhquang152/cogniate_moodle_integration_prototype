# P4 dispatch: lead QA (Antigravity): LD-9 follow-ups (NITs of LA-IC-12/16/17/18; LA-IC-15 G3; LA-IC-13 list)

Same terminal session and rules. LD-9 lists LA-IC-12, -16, -17, -18 are APPROVED by both reviewers (docs/reviews/LA-LD9/reviewer-a.md and reviewer-b.md; you may read them, they review your files). Work in la-qa (your files only):
1. NITs on your lists: A-LA-LD9-01 = B-LD9-01 (the compare explains an allowlist difference as LA-IC-16 even when no LA-IC-16 expected-delta file is passed: apply the rule only when the file is given, and add one test); A-LA-LD9-02 (two "approval" paths point to files that are not on the integration branch: point them to the committed review files); A-LA-LD9-03 (the LA-IC-17 scan entry tests/ltiaas/golden/capture.golden.ts:276-285 points to the capture writer, not a platform body: fix the range); B-LD9-02 (the LA-IC-16 list has no scan record: add one, as the other lists have).
2. A-LA-LD9-04 (part for you): add the LA-IC-18 rows to TEST-STRATEGY §4.7 and to the golden README §5 (QA-E2E fixes the JSON ranges and splits scanResult).
3. LA-IC-15 (LA-E4-03, lane R, merged a285bdb; QA-3 R1 PASS): the score 409 conflict text names the connection's channel ("({LMS} has a grade with a newer time)"). Update G3 for it as LD-9 requires: an expected-delta file tests/ltiaas/golden/expected/LA-IC-15.json and the compare rule, with the reviewed test-change list (or "0 golden / 0 frozen-test changes" with the scan record, if no capture pins it).
4. LA-IC-13 (LA-E3-12, lane L, merged a2dfc04: scoreGiven null accepted as absent, NRPS service_versions check, untrusted extra aud fails check 5): write the LD-9 test-change list tests/ltiaas/golden/expected/LA-IC-13.json (which frozen tests or golden captures change, or none, with the scan record).
Run tests/ltiaas/golden K0 (compare.mjs and golden.k0.test.mjs) host-only. One worker_done with the file list. Next (context only): LA-IC-19 (BD-A1-57, the 410 RUNTIME_EXPIRED text names the session channel) when lane K lands LA-E1-09.

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
