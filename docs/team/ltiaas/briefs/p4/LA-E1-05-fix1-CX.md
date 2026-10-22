# P4 dispatch: Author lane L (same Codex session), LA-E1-05 fix round 1

Worktree la-l (your lane; LA-E5-14 merged as 3c7221d; its reviews and QA follow). LA-E1-05 round 1: both reviews APPROVE with MINORs (docs/reviews/LA-E1-05/reviewer-a.md and reviewer-b.md), QA-4 R1 host-only PASS. Architects ruled two items: A1 BD-A1-21 (ProfileSource as a kernel type) and A1 BD-A1-22 = A2 BD-A2-21 (privacy floor frozen; LA-ADR-01 D4/D6, LA-ADR-07 T18, security-delta §12, the LA-E1-05 spec, build-decisions-A1.md v1.8 and -A2.md §11). Merge quang/ltiaas-milestone into your lane first (git merge --no-ff). Then, in separate small commits with unit tests:
1. BD-A2-21 privacy floor: (a) privacyFloor required, enum allowlist | none; (b) add PRIVACY_FLOOR_NONE_PROFILES = ['standard'] to packages/channel-kernel/src/legacy-wire.ts (Lead process call: RQ-2 to you, this one constant and its re-export only; K's file); load check 7: 'none' only for a profile id in that list, every other profile must be 'allowlist', else the start fails with a RegistryError that names the profile; (c) launch fails closed: keep every claim only when privacyFloor === 'none'; any other or unknown value minimizes (services/lti-service/src/lti/launch.ts:117). Tests: a new profile with 'none' stops the start; 'standard' with 'none' starts; an unknown floor value minimizes; Canvas and Blackboard still minimize.
2. BD-A1-21: the ProfileSource type (and the ProviderProfile trait types it uses) moves to @cogniate/channel-kernel as a type only (RQ-2 to you, one commit in packages/channel-kernel/src, types only); each lti-profiles.ts does import type { ProfileSource } from '@cogniate/channel-kernel' and exports its list with satisfies readonly ProfileSource[]; the LTI zod schema in services/lti-service/src/profiles/ keeps satisfies z.ZodType<ProfileSource>; the LTI types.ts re-exports the kernel type. Lane K is in its LA-E1-03 fix round (eslint and tsconfig, not these files); on a conflict keep both.
3. A-LA-E1-05-01 MINOR: a unit test that asserts the frozen provider-list lms value (the mutant wireLms ?? channel must fail it). A-LA-E1-05-03 NIT: check listOrder of new profiles.
4. B-LA-E1-05-02: load check 7 errors name the profile id and the expected value. B-LA-E1-05-03: one way to pass a test registry to the profile functions; login.ts:24 must not mix two registries. B NITs if cheap. The doc comments for endpoints, privacyFloor, listOrder and productFamily (B-01 second part).
Self-check npm run check green; one worker_done with SHAs and counts. Next (separate dispatch): LA-E1-10. For LA-E5-06 later (context only): S1 exports checkRegistrationSessionCap(db, limiter, address, accountId, now) from http/rate-limit.ts (A2 BD-A2-20).

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
