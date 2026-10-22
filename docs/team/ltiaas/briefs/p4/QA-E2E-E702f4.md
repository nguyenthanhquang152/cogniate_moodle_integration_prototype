# P4 dispatch: QA-E2E (Antigravity), LA-E7-02 fix round 4 (BD-A1-53 drift) + NITs of LA-E7-05 r2 and LD-9 LA-IC-18

Same terminal session and rules. Your LA-IC-18 LD-9 record is committed (f973e21). Round results: LA-E7-05 round 2 APPROVE by both reviewers (1 NIT); LA-E7-02 round 3 Reviewer-A CHANGES_REQUESTED with 1 BLOCKER; LD-9 LA-IC-18 APPROVE by both (1 NIT each). Read docs/reviews/LA-E7-02/reviewer-a.md (Round 3) and docs/reviews/LA-E7-05/reviewer-*.md (Round 2) and docs/reviews/LA-LD9/reviewer-*.md (section LA-IC-18) — you may read the review files of your own tasks. Work in la-qa on top of the integration branch content (your files only):
1. A-LA-E7-02-05 (BLOCKER): after A1 BD-A1-53 and S1's lib.sh change (6ae0ebe), lib.sh refuses a host that is repeated inside one entry, but tests/sim/server.mjs loadHostManifest still accepts and merges it (19059aa removed the aliasSet.has(host) and allowSet.has(host) refusals), so the shared hosts.json table test fails at the integration head (56/58). Fix: refuse a host repeated inside one entry in loadHostManifest with a clear error that names the host, and flip the table case "accepts and merges repeated alias and allowlist host inside one entry" (tests/sim/core/loading.test.mjs:126-133) to expect a refusal from both readers. Check README §4b and BD-A1-53 for the exact rule. Rerun the shared table test and tests/sim/** (host-only; the table test uses a fake docker, never the real one).
2. B-LA-E7-05-07 (NIT): tests/sim/README.md does not define "active scenario" (auth also sets it): add one definition; the LA-E7-05 qa.md round-1 AC rows name removed option aliases: correct the names.
3. LD-9 LA-IC-18 NITs in tests/ltiaas/golden/expected/LA-IC-18.json: split the 1,046-character scanResult into one entry per change (Reviewer-B B-LD9-03); fix the two scanChecked line ranges that point past the file ends (Reviewer-A). The LA-IC-18 rows in TEST-STRATEGY §4.7 and golden README §5 belong to the lead QA: do not edit them.
Write a short '## Round 4' note in docs/reviews/LA-E7-02/qa.md and a round note in docs/reviews/LA-E7-05/qa.md. One worker_done with the file list.

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
