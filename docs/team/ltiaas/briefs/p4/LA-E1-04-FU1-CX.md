# P4 dispatch: Author lane P (same Codex session), LA-E1-04 follow-up FU-1: F5 sql-portability forms (A2 BD-A2-13 item 3)

Worktree la-p (your lane; LA-E1-04 fix round merged as 3fe6c13). Architect A2 ruled BD-A2-13 (LA-ADR-06 D13 rule 2, build-decisions-A2.md §8; on the integration branch at 265d6d0; merge quang/ltiaas-milestone first, git merge --no-ff). You own infra/scripts/fitness/rules/sql-portability.mjs (LA-E1-04). Implement, in small commits with tests in fitness.test.mjs:
1. MUST, new migration files (services/*/src/db/migrations/*.sql, and the app migrations folder): the rule also flags an X'...' blob literal; the SQLite date and time functions (unixepoch, julianday, strftime, datetime, date(, time(, timediff); randomblob; a rowid column reference.
2. An explicit adapter allow list IN the rule: entries {file, form, ref: 'LA-ADR-06 D13 rule 2'} for 009_signing_key_lifecycle.sql / date-function and 011 / randomblob (and hex if your form list has hex). No comment markers; each new exception = an ADR line by A2 + a reviewed rule edit. Note: 011 is lane S2's file (LA-E5-07, not merged yet): name it by its file name 011_*.sql pattern as S2 lands it, or tell me the exact name you need and I get it from S2.
3. SHOULD: scan only the text of string and template literals in non-test services/*/src/**/*.ts for the same forms, with a frozen baseline of the two pre-LA app hits (services/cogniate-app/src/domain/pickers.ts:55, domain/retention.ts:17). If this gives many false positives on the integration tree, stop at the MUST part and report the counts (Reviewer-A then checks inline SQL by hand).
Expected on the integration HEAD after your change: F5 PASS (the 009 date functions and 011 ids are on the allow list; the X'' in store/tool-keys.ts and the cleanup job is inline TS SQL: under the Should scan it is a hit until S2's LA-E5-10 fix round binds an empty Uint8Array; if you build the Should part, give it a baseline entry for those two lines with ref 'S2 LA-E5-10 fix round' and say so).
Self-check npm run check green; one worker_done with SHAs and counts. Next (separate dispatch): LA-E1-11.

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
