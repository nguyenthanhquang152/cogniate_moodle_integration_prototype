# P4 dispatch: Author lane R (same Codex session), LA-E7-10 fix round 1

Worktree la-r (your lane; your LA-E4-01 fix round is merged as 06efe56; integration check green there). Reviewer-A round 1 of LA-E7-10: CHANGES_REQUESTED (docs/reviews/LA-E7-10/reviewer-a.md): BLOCKER A-LA-E7-10-01 (on the merged tree step 5 fails with 13 hits, most of them JS identifiers such as LEGACY assigned to a secret key in test env objects), MINOR -02 (${KEY:-value} bypasses rule 4), NIT -03 (working tree read; no change), NIT -04 (PGP private key block missed). Reviewer-B's review is still running; I add its items to this round by message if they come in time. Architect A1 ruled BD-A1-13 (README §4a 'Step 5 rules', LA-E7-10 design notes, build-decisions-A1.md). Merge quang/ltiaas-milestone into your lane first (git merge --no-ff), then implement, in separate small commits with unit tests:
(1) In code files (.ts .tsx .mts .cts .js .mjs .cjs) only a quoted string on the right (or a template with no ${...}) is a value; an identifier, member expression, call, number or object is not. Other files keep bare tokens as values.
(2) A-LA-E7-10-02: 'not a value' = exactly one whole placeholder (${NAME}, ${NAME:?...}, ${NAME?...}, $NAME, <...>) or an empty string; ${SECRET_KEY:-v} (also -, :=, =) checks v as a value of that key in every file, whatever the key on the left; ${A}text${B} is a value.
(3) A-LA-E7-10-04: rule 1 also matches '... PRIVATE KEY BLOCK-----'.
(4) A-LA-E7-10-01: after (1)-(3), run step 5 on your lane after the integration merge (= integration HEAD content) and add one allow-list entry per remaining test fake (file + exact token; never a directory or a wildcard). Give the list in worker_done. NIT -03: no change.
Self-check: npm run check green and npm run ci:local step 5 PASS on your lane (host-only; skip any step that needs Docker and say so). One worker_done with SHAs, the step-5 result and counts.

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
