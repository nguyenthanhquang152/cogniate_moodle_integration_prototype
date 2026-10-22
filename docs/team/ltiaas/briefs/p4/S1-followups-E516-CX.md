# P4 dispatch: Author lane S1 (same Codex session), three small follow-ups, then task LA-E5-16

Worktree la-s1 (your lane; LA-E5-11 merged as 586bd01; check running). Merge quang/ltiaas-milestone first (git merge --no-ff). Part 1, small commits with tests:
1. LA-E5-05 fix round 1 (both reviews APPROVE: docs/reviews/LA-E5-05/; you may read them): B-01 MINOR: a 401 (revoked or expired operator key while another key is active) prints the same 'Run npm run seed again' line as a missing file, but seed's init --if-none then recopies the rejected key: name the host file and the real fix (put the current key there, or init --replace); A NITs: a lost answer to --rotate-api-key must say the rotation may have committed and suggest a rerun; seed must not write account.update for an unchanged name. B NITs (client-side 'active API key' rule in bootstrap.ts:30; two-step operator-key recovery in lti-bootstrap.sh:49) if cheap.
2. A2 BD-A2-50: GET /operator/v1/audit gets an additive traceId filter (contract delta §3).
3. LA-E7-03 spec follow-up from QA-E2E's shared hosts.json table test (infra/scripts/lib.sh is yours): check each against README §4b and A1 BD-A1-01 v1.1 and fix the ones that differ: (a) lib.sh:89-98 falls back to the 8 fixed M1 hosts when tests/sim/hosts.json is missing; (b) lib.sh:134-138 dedupes a host claimed by two providers[] entries, while the simulator refuses it; (c) lib.sh:123 checks only a non-empty providers[].id, while the simulator enforces ^[a-z0-9][a-z0-9-]*$. If README §4b and BD-A1-01 disagree with QA-E2E's reading for (a), tell me (I ask A1); do not guess.
Part 2, task LA-E5-16 (Idempotency-Key, wave B3). Spec: docs/architecture/ltiaas/tasks/LA-E5-16.md. QA-2 writes the test-first suite. Next in your lane (context only): LA-E5-17, LA-E5-20, LA-E5-21.
One worker_done at the end of part 2 (report part 1 SHAs in it).

## DOCKER BAN (stop-the-line rule)

LA is HOST-ONLY until the Lead sends an explicit Docker window. Another run on this machine has exclusive Docker windows, and two LA overlaps already broke its validation. Do NOT run docker, docker compose, npm run stack:*, any host runner that starts a stack (tests/host/run-*.mjs, run-golden.sh, run-api.mjs against a stack), or any script that calls them. Before any command that might touch Docker, ask the Lead with the preamble ask command. A Docker command before the window is a stop-the-line violation: the Lead stops your session. Work that needs a stack is recorded as "pending: Docker window".

# Common rules for LA build Authors (P4)

Milestone LA "LTI as a Service v1". You are an Author (Claude Code Opus 5.5, effort xhigh) in one build lane. The Lead coordinates Orca run run_06d07dc77faf. The product owner approved the build (G-DEV) on 2026-10-22.

Read first: CLAUDE.md; docs/team/charter.md (base rules); docs/team/ltiaas/charter-LA.md (LA rules; they win); docs/team/ltiaas/plan.md §6.1 (Lead decisions LD-1..LD-19); docs/architecture/ltiaas/README.md; docs/architecture/ltiaas/epics.md §5 (ownership matrix: your lane, your wave) and §6; docs/architecture/ltiaas/tasks/README.md (§1 spec rules, §4 request rules RQ-1..RQ-6); your task spec; the ADR and contract sections it links. Read design docs in the LA integration worktree /Users/quangnguyen/orca/workspaces/cogniate_moodle_integration_prototype/ltiaas-milestone if your own checkout is behind; your own worktree is the source of truth for code.

Do:
1. Run `npm ci` once in your worktree (node_modules are git-ignored).
2. Implement exactly your task spec: its Scope In, its ACs, its design notes. Write unit tests next to the code (Vitest `*.test.ts`). The ACs labelled UNIT are yours to prove; K0, K1-SIM, MOODLE-LIVE and K2 ACs are proved by QA (do not write those tests).
3. Self-check: `npm run check` must be green (lint, typecheck, unit tests). Record the pass/skip counts.
4. Commit on YOUR lane branch only, one or more commits named "LA-<task id>: <summary>", each ending with the line "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>". Never push. Never commit on another branch. Never rebase a branch the Lead has merged.

File ownership: edit only the "May edit" files of your task spec, and only if the matrix gives them to your lane in this wave. If you need another file, use the preamble ask command with an RQ request (file, line, reason). Never edit tests/** (QA), docs/** (Architects, Lead, Docs) or another lane's files. You may read anything except other reviewers' files.

Docker: none by default (plan LD-2). If an AC that you must prove needs a stack, ask the Lead for a slot; never touch another compose project, and never stop or remove containers you did not start (another run's QA uses Docker on this machine).

Questions about the spec go to the Lead with the ask command (the Lead routes them to the Architects). Do not guess a design decision; if the spec is silent and the choice is local and reversible, choose the simplest option and name it in your report.

Done report (one worker_done, --outcome succeeded or failed): three sentences: what you built, the self-check result (counts), what is left or unsure. Include --files-modified (comma list) and --report-path (your task spec). Keep Author notes in the worker_done body only; do not write note files in the repo (QA must not read Author notes before it writes tests). Then stop. The Lead merges your branch into the integration branch, and QA and both reviewers verify it. Fix rounds come as new dispatches to you.

Orca: follow your injected preamble; send heartbeats at its cadence; at each checkpoint read your messages (preamble check command, and `orca orchestration inbox --json` filtered to your own handle only). When you send a message from a shell, write the body to a file and pass "$(cat file)". Write in Simplified Technical English (about 80%) in comments and commit messages.
