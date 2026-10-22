Verdict: APPROVE
Round: 1

# LA-E7-04 review, lens A ("Is it right and is it safe?")

Reviewer: Reviewer-A2 (Claude Code Opus 5.5 xhigh, plan LD-22). Date: 2026-10-22.
Spec: `docs/architecture/ltiaas/tasks/LA-E7-04.md`. Design: README §4; TEST-STRATEGY §3.1–§3.6; the BD-A1 and BD-A2 rulings that the suite cites.

Diff: `git diff 098cec2^ 098cec2` (`tests/ltiaas/fitness/**`, `docs/reviews/LA-E7-04/qa.md`). I read the suite, its helper `tests/ltiaas/tasks-core/LA-E1-04/fitness.ts` and qa.md. I did not run the suite: it needs a dedicated clone and a full `npm run check`. qa.md records that run in `~/cogniate-qa-runs/LA/LA-E7-04/r1/clone` (7 passed, 3 skipped, and a clean tree after).

## Summary

| Id | Severity | Topic |
| --- | --- | --- |
| A-LA-E7-04-01 | MINOR | The scratch guard trusts `LA_SCRATCH_CLONE=$PWD`. Run in a clean shared worktree, the F2 rename probe would create a branch, commit, and leave that worktree on a detached HEAD. |

There is no BLOCKER and no MAJOR finding.

## Findings

### A-LA-E7-04-01 — MINOR — the scratch-clone guard is only an environment variable

- **Files:** `tests/ltiaas/tasks-core/LA-E1-04/fitness.ts:24-27` (`requireScratchClone`: `LA_SCRATCH_CLONE` must equal `ROOT`, and the tree must be clean); `tests/ltiaas/fitness/fitness-probes.test.ts:394-405` (the F2 rename probe: `git switch -c zz-qa-e7-04-f2-rename`, `git mv`, `git commit`, then `git switch --detach <headSha>` and `git branch -D`).
- **Problem:** the documented command in qa.md is `LA_SCRATCH_CLONE=$PWD … vitest run …`. Copied into a shared worktree (the LA integration worktree or a lane worktree) when its tree is clean, for example just after the Lead commits, the guard passes. The suite then:
  - writes `packages/channels/zz-lms/` and `zz-probe/`, which other workers' concurrent `npm run check` runs would see;
  - creates and deletes a branch in the shared repository;
  - leaves the shared worktree detached from `quang/ltiaas-milestone`, so the Lead's next commit would land on a detached HEAD.

  The run in qa.md used a proper clone, so this did not happen. Charter-LA §4 forbids checkout in the shared worktree.
- **Suggested fix:** (1) In `requireScratchClone`, also refuse a linked worktree (`git rev-parse --git-dir` differs from `--git-common-dir`, or `.git` is a file) and a repository with more than one entry in `git worktree list`; a `git clone --no-hardlinks` passes both. (2) In the F2 probe, record the start ref (`git symbolic-ref -q HEAD` or the SHA) and switch back to it, instead of always detaching.

## Checks that pass

| Item | Result |
| --- | --- |
| No false pass in F1 (lens focus) | Each failing probe needs a non-zero exit **and** a hit with the expected path, banned word and token (`hitFor`), so a check that fails for another reason does not pass. Each control needs exit 0 and 0 hits. The probes cover identifiers, strings, the BD-A1-09 part rule (`canvasConfiguration`, `MOODLE_TOOL_MAY_EXIST`, `lti-generic`, `d2l`), template parts, JSX text and attributes, import sources, SQL columns and strings in a new migration, and regex literals (BD-A1-15). The controls cover comments, `<canvas>`, the Canvas Web API names and non-matching parts. Other probes cover the BD-A1-19 token exception (only the frozen values pass in `013`, and another vendor word or an identifier fails), N6 (frozen wire names pass only in `legacy-wire.ts`), the ratchet (+1 fails with the delta text, −n passes with the lower-the-baseline hint), and the dynamic channel folder (`zz-lms` and its `names.text` are banned with no list edit, while the single parts `zz` and `lms` pass). |
| F3 negative probes are real (lens focus) | `--no-ignore` keeps ignored paths in scope. Each of the 27 probes needs at least one severity-2 error from an import-fence rule (`IMPORT_RULE` keeps only `no-restricted-*`, `@typescript-eslint/no-require-imports` and `channels/*`), so an unrelated lint error cannot make a probe pass. The probes cover all D1 rows, BD-A1-16 (dynamic `import()`, `require`, `import =`, `createRequire`, file kinds, test imports, a core template-literal path) and BD-A2-11 (root `@cogniate/shared` values, `export *`, `fetch`, `WebSocket`, `process`). The 4 controls each need 0 fence errors (D1 rows; BD-A1-16/18: `app.ts` → `./manifest.ts`, `./app/x.ts`, port types, `/channel` values). The root channel-test typecheck probe needs `npm run typecheck` to fail and to name the file (LA-E1-03 AC-06). |
| F2 and F5 | F2: exit code **and** the class of every listed path (`core`, `channel:canvas`, `sim`, `tests`, `docs`), plus a real `--no-renames` probe on a scratch branch. F5: exit 1 **and** the rule message for every `sql-portability` form (including BD-A2-13 and BD-A2-22), `connection-lms` and `audit-event-delete`, with matching controls (applied migrations, the adapter allow list, the repository file, the retention job). The three rules that have not landed yet run through `it.runIf`, with probes ready. |
| Scope equality (AC-06) | The suite compares `fitness-scope.json` class by class with the expected globs, checks that README §4 and TEST-STRATEGY §3.1 name the core and non-core globs, and checks that `common.mjs` and `eslint.config.js` read the scope file and its classes. |
| Shared worktrees (lens focus) | Every scratch write and git command goes through the guard, `LA_RUN_DIR` must be outside the clone, and qa.md shows a dedicated clone with a clean status after the run. The remaining gap is A-LA-E7-04-01. |
| Scope | Only `tests/ltiaas/fitness/**` and qa.md change. No product file or `infra/scripts/fitness/**` file is touched. |
