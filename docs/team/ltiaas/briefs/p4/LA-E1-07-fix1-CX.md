# P4 dispatch: Author lane K (same Codex session), LA-E1-07 fix round 1

Worktree la-k (your lane; LA-E1-08 merged as e29f574; check green at d709666: 2403 unit, 121 K0, F1 74 hits, F5 5 rules). LA-E1-07 round 1: Reviewer-A2 APPROVE (1 MINOR, 1 NIT), Reviewer-B2 CHANGES_REQUESTED (1 MAJOR, 3 MINOR, 3 NIT) (docs/reviews/LA-E1-07/; you may read your task's reviews). Architects ruled: A1 BD-A1-38/39/40/41, A2 BD-A2-37 (build-decisions-A1.md, -A2.md; LA-ADR-01 D1/D5). Merge quang/ltiaas-milestone first (git merge --no-ff). In small commits with tests:
1. B MAJOR (BD-A1-40 + BD-A2-37): no copies of shared setup helpers in channel app.ts: (a) toolAccountId and toolUrls { login, launch, keys, register, ltiOrigin } come through the P2 contexts (ToolConfigurationContext, CreateRequestContext) and the P5 PortContext, built by the kernel; no 'cogniate' account id and no '/lti/launch/' path in a channel file; (b) toolName, PRINTABLE_ID, GRANT_CODE and parseStrictBody get ONE definition in the new pure kernel value sub-path @cogniate/channel-kernel/setup (packages/channel-kernel/src/setup.ts + package export './setup'), with a unit test that pins the export names (a change to that list is a Reviewer-A security item); the D1 fence lets app.ts and app/** import values from it (other kernel imports stay type-only).
2. B MINORs (BD-A1-38/39): (a) SetupRouteDeps already left ports.ts in LA-E1-08 (check); ports.ts gets a doc comment per D5 member and the BD-A1-20/28 required rules; (b) ONE discovery-based AC-10 invariant test in the app kernel tests replaces the per-channel copies; (c) ONE pure kernel familyGuardVerdict used by the app (lane L switches the LTI service in LA-E2-02).
3. A-LA-E1-07-01 (LA-IC-17, BD-A1-41): the strict Moodle PUT body is recorded; check the 422 INVALID_PLATFORM_VALUES with the key in details.fields has a test. NIT A-02: authorityFor throws a plain Error for verifiedAdminLaunch: use the kernel error type. B NITs: duplicated suspend, import aliases and re-exports that keep old names, the dead parseBindingBody check. Also the deferred NIT A-LA-E1-03-06 (no-eval, no-implied-eval, no-new-func in the channel fence) if LA-E1-08 did not add it.
Self-check npm run check green; one worker_done with SHAs. Next in your lane (context only): LA-E1-09, LA-E1-12, LA-E5-12.

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
