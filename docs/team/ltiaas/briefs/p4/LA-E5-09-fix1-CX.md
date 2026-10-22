# P4 dispatch: Author lane S2 (same Codex session), LA-E5-09 fix round 1

Worktree la-s2 (your lane; LA-E5-15 merged as e67819c; check running). LA-E5-09 round 1: Reviewer-A2 APPROVE (2 NIT) and Reviewer-B2 APPROVE (3 MINOR, 2 NIT) (docs/reviews/LA-E5-09/; you may read your task's reviews). Architect A2 ruled BD-A2-50 (LA-ADR-06 D6, contract delta §1.3/§3, operability §6.3 runbook). Merge quang/ltiaas-milestone first (git merge --no-ff). In small commits with tests:
1. BD-A2-50 / B-01: POST .../key-provider/rewrap: runner not active (JobRunner.state() is not 'active') -> 503 NOT_READY with details { reasons: ['job_runner_not_active'], retryAfter: 30 } (Retry-After header by BD-A2-16), no event; a run already holds the lease (job_lease owner set and lease_until > now) -> 409 JOB_RUNNING with one refused event; otherwise 202 as today. Trace join: the run should use the request trace id through an additive runner option runNow(name, { traceId }) (shared runner, lane R + A1): build your side behind that option name and leave a clear TODO-free fallback (the runbook reads the end event by action + since) until R lands it; I tell you.
2. B-02: status and re-wrap use SEALED_COLUMNS, readiness uses the store version scans: tie them to one list. B-03: split the 96-line run() and remove the duplicated row-open code. NITs: B-04 optional keys/jobs wiring comment; B-05 comments on call-count boundaries; A-NITs: skipped_lease must not answer 202 (covered by 1), a malformed key_provider setting must not make every open throw (fail with one clear error at start or ignore with a log, say which).
Self-check npm run check green; one worker_done with SHAs.

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
