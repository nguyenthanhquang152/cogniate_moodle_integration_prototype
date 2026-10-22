# P4 dispatch: Author lane S1 (same Codex session), task LA-E5-03

Worktree la-s1 (your lane; LA-E5-04 merged into the integration branch as a00c090; its reviews and QA follow). LA-E5-01 and LA-E5-02 are approved (plan LD-20 lets you build on your lane).
Task: LA-E5-03 Rate limits. Spec: docs/architecture/ltiaas/tasks/LA-E5-03.md (current version in the LA integration worktree; design LA-ADR-06 D1, contract delta §1.3, §1.4, §3). LTI migration number for service_setting: 012 (Lead allocation, RQ-5). Merge quang/ltiaas-milestone into your lane first (git merge --no-ff).
Lines other lanes add in your files by RQ-2 now (do not change them; merge the integration branch before you touch these files, and keep their lines as they are):
- Lane S2 (LA-E5-07): services/lti-service/src/http/operator/index.ts registerApiKeyRoutes mount; api-errors.ts KEY_ERRORS spread; store/accounts.ts bridge (ensureAccount, rotateApiKey, findAccountByApiKey per A2 BD-A2-10) and revoke on close; the platforms-audit.test.ts actor assertions; S2 also owns http/auth.ts in B2.
- Lane L (LA-E5-14): api-errors.ts PLATFORM_RATE_LIMITED entry; the Retry-After header for PLATFORM_RATE_LIMITED in the http/app.ts error handler; the logger argument to createAgsClient/createNrpsClient in main.ts.
Retry-After: your RATE_LIMITED 429 answers also need Retry-After. I asked Architect A2 whether one generic rule in the app.ts error handler (any API error with details.retryAfter sets the header) should serve both codes. Until A2 answers, build your header in one small helper in http/rate-limit.ts or app.ts that a generic rule can reuse, and tell me the function name; do not rewrite lane L's line.
Spec or design questions go to the Lead (routed to the Architects). Requests 1 and 2 of the spec (codes.ts L, auth.ts S2) go through the Lead as RQ-1.
Next in your lane (context only): LA-E5-19 retention jobs, LA-E5-05 CLIs as API clients.

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
