# P4 dispatch: Author lane R (same Codex session), LA-E4-01 fix round 1

Worktree la-r (your lane; LA-E7-10 merged). Reviewer-A APPROVED LA-E4-01 round 1 with MINOR A-LA-E4-01-01 and NITs -02, -03 (docs/reviews/LA-E4-01/reviewer-a.md); Reviewer-B's review is running. Architect A1 ruled BD-A1-10 (recorded in LA-ADR-03 D7, LA-E4-01, LA-E4-02 and build-decisions-A1.md; merge quang/ltiaas-milestone into your lane first with git merge --no-ff to read them). Implement items (1) and (3) of the ruling now in LA-E4-01 (separate small commits, unit tests, new AC-LA-E4-01-11 and -12). Item (2) belongs to LA-E4-02 (your next task) and item (4) to LA-E4-02 and A2/S1: do NOT build them now. Self-check npm run check green; one worker_done with SHAs and counts.

A1 ruling BD-A1-10:
A1 decision BD-A1-10 (LA-E4-01, A-LA-E4-01-01 MINOR, NITs -02 and -03): BOTH fixes, and both NITs are in.
(1) Runner (lane R, LA-E4-01 fix round): QueueJob gets id(item): string. A run that throws cools that ITEM, not its partition: the runner skips the item for 2 s after the first throw, doubled after each next throw of the same item, at most 5 min (process memory only; a run of that item that does not throw, or a restart, ends it). The other rows of the partition run at the next poll. Each throw still logs one job_run line, result failed, error class only. New AC-LA-E4-01-11 (UNIT): the reviewer's probe shape (poison, good-1, good-2 in one partition): the good rows run, poison waits 2 s, 4 s, ... at most 5 min.
(2) Contract (lane R, LA-E4-02): the outbox run catches every error of its own row (reporter call, stored-data decode) and moves the row, as M1 send() does (worker/score-sync.ts:75-90): a try counted and a later next_try_at by the normal backoff, or failed at the end of the 24 h window. New case in describeQueueStoreContract and AC-LA-E4-02-13 (UNIT): an unexpected throw in the remote call for one row moves that row, and the next row of the same partition is sent. The runner cooling is only the backstop for a bug or a failed result write.
(3) NIT -02 in: JOB_INSTANCE_ID must match ^[A-Za-z0-9-]{1,64}$ (defaults app-1, lti-1 pass); else the runner refuses to start (config error). NIT -03 in: addQueue and addInterval refuse leaseMs above 2147483647 ms (MAX_TIMER_MS). New AC-LA-E4-01-12 (UNIT).
(4) Reviewer-A integration note, recorded for LA-E4-02: the outbox does not abort a POST in flight on stop (ctx.signal only stops its next step), and the app awaits runner.stop() before the database closes. The LTI service side (3 s exit fallback vs. the runner grace) is A2/S1 (LA-E5-19): I flag it, no A1 change.
Recorded in LA-ADR-03 D7, LA-E4-01, LA-E4-02 and build-decisions-A1.md.
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
