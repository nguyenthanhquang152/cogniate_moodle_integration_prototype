# P4 dispatch: Author lane P (same Codex session), LA-E1-11 fix round 1

Worktree la-p (your lane; LA-E1-11 merged as 0d9aeda). Reviewer-B CHANGES_REQUESTED (1 MAJOR, 2 MINOR, 2 NIT; docs/reviews/LA-E1-11/reviewer-b.md; you may read your task's reviews); Reviewer-A's review is still running (I add its items by message if any: expect it and act on it). Architect A1 ruled the MAJOR (BD-A1-44; LA-ADR-01 D5/D9, LA-E1-11 AC-01/AC-03 and notes). Merge quang/ltiaas-milestone first (git merge --no-ff). In small commits with tests:
1. BD-A1-44 LA-E1-11 D5 vs D9 (B-LA-E1-11-01 MAJOR): option (a), no visible change in E1. The three baseline modules keep their whole-wizard override (D5); the shell's four manifest steps (D9) are the wizard of every channel WITHOUT a module Wizard (lti-generic, brightspace, the canary, test manifests). The verify rule (BD-A1-24) binds EVERY wizard: a module Wizard selects its verify step from connection.bindingAuthority (before create: the chosen method's authority), never from connection.method or step JSON. For the baseline modules this is behaviour-neutral today (Moodle is always self, Canvas and Blackboard always operatorGrant). Lane P: (i) ChannelProvider defaults modules to channelModules; a test that needs no module passes new Map() on purpose; (ii) MoodleWizard and the Canvas and Blackboard wizards read bindingAuthority for the verify step; (iii) route tests render App with the real modules for the three baseline channels and assert today's screens (Moodle self: the first-launch text; Canvas and Blackboard: the approval code). AC text (LA-E1-11, my spec): AC-01 = the four steps for every channel without a module Wizard (registered or test manifest), one card for every registered manifest; AC-03 = the verify rule in every wizard: shell cases (self, operatorGrant, a staged operatorGrant on a test manifest) plus the three real-module route cases.
Also Reviewer-B MINORs: B-02 the two sources of admin steps (manifest texts vs portal/*-steps.json): one source (say which, keep texts byte-equal); B-03 the SDK built from export * with no contract comments: an explicit export list with a doc comment per member. NITs if cheap: the 108-line ManifestWizard (split), old-vocabulary aliases, a second tool-name builder.
Self-check npm run check green and the portal build; one worker_done with SHAs.

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
