# P4 dispatch: Author lane S1 (same Codex session), LA-E5-02 follow-ups (fix round 1)

Worktree la-s1 (your lane, HEAD a67d44f; merged into the integration branch as 00589fe). Reviewer-A APPROVED LA-E5-02 round 1 (docs/reviews/LA-E5-02/reviewer-a.md); Architect A2 ratified the SAVEPOINT design with a required follow-up (docs/architecture/ltiaas/build-decisions-A2.md, LA-ADR-06 D4 "Transaction rule" T0-T5). Do, in separate small commits:
1. A2 C1 (required): packages/shared/src/migrations.ts transaction() must roll back and throw a TypeError when fn returns a thenable (an async callback would commit the ok audit event before the change). Unit tests for both nested and outer calls.
2. A2 C5 / rule T5 (MINOR): on rollback, keep and rethrow the FIRST error (do not mask it with a rollback error). Unit test.
3. A-LA-E5-02-01 (MINOR): REPLACE INTO audit_event edits a row without the UPDATE trigger, and F5 misses DELETE FROM 'audit_event' (quoted). Add a BEFORE INSERT trigger that refuses a REPLACE over an existing id in a NEW LTI migration 008_audit_event_replace_guard.sql (Lead allocation, RQ-5), and widen the F5 rule pattern (quoted names, REPLACE INTO). Tests.
4. A-LA-E5-02-02 (MINOR): withAudit must write exactly one event per call: a success path with no change() call must fail (or write a refused event) instead of writing none. Unit test.
Self-check npm run check green; one worker_done with SHAs and counts. Next (after Reviewer-B approves LA-E5-02): LA-E5-04.
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
