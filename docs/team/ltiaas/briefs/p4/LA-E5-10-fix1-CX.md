# P4 dispatch: Author lane S2 (same Codex session), LA-E5-10 fix round 1

Worktree la-s2 (your lane; request 2 merged as 4a2234d). LA-E5-10 round 1: Reviewer-A APPROVE (1 MINOR, 2 NIT; docs/reviews/LA-E5-10/reviewer-a.md) and Reviewer-B APPROVE (2 MINOR, 4 NIT; reviewer-b.md). Architect A2 ruled BD-A2-13 and BD-A2-14 (LA-ADR-06 D7 CLI row and D13 rule 2, operability 6.1, the LA-E5-10 notes, build-decisions-A2.md §8). Merge quang/ltiaas-milestone first (git merge --no-ff), then in separate small commits with unit tests:
1. BD-A2-13 item 1 (A-LA-E5-10-01): replace the X'' blob literal in removeToolKey (store/tool-keys.ts) and in the signing-key cleanup job with a bound empty byte array (private_jwk_encrypted = ? with new Uint8Array(0)). Migration 009 does not change (its date functions are a listed adapter item).
2. BD-A2-14 (A-LA-E5-10-03): lti:bootstrap --rotate-signing-key always makes a NEW key: when a next key exists, it first removes that key (retire immediate; it never signed), then creates and force-activates the new key, all in one transaction, stdout unchanged (ensureToolKey).
3. A-LA-E5-10-02 NIT: use the async generateKeyPair (async work before the change, D4 T2).
4. Reviewer-B NITs: the retire message, case names in the AC-13 table test, a named constant for the 30-day value where it is code (009 stays), runbook step 7 note until LA-E5-19 (if in your files).
5. WAIT for my message with A2's ruling on B-LA-E5-10-01 (details fields on the signing-key 409s) and B-LA-E5-10-02 (WRONG_STATE also meaning 'no active key'); then build it in one more commit.
Self-check npm run check green; one worker_done with SHAs and counts.

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
