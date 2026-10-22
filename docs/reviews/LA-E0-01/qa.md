Verdict: PASS
Round: 1

# LA-E0-01 Base intake: QA verification

Tester: QA-3 (Orca task `task_5394ed2915f5`, dispatch `ctx_a8bd71d6aab9`), 2026-10-22. Spec: `docs/architecture/ltiaas/tasks/LA-E0-01.md` at `c804e98` (AC-01 excludes `tests/ltiaas/**`, Lead clarification).

Independence: the Lead made this git-only intake commit. QA-3 checked it with its own commands. QA-3 did not read product source, Author notes or reviewer files.

| Item | Value |
| --- | --- |
| Intake SHA | `1b17261be97c4701b928fa9dc2fa74c6d23028f6` on `quang/ltiaas-milestone` (merge of `f1f5a55` and G-BASE) |
| G-BASE | `bd368ff39fb4c533fc105e7c5ee81a59e618d99a` (`nguyenthanhquang152/lti-multi-lms` HEAD, also at the time of this check) |
| LA-H10, merge mode | frozen candidate, `wave-end` |
| Lane and slot | none (no Docker) |
| Clone | `~/cogniate-qa-runs/LA/LA-E0-01/r1/src`: `git clone --no-hardlinks --no-checkout`, `checkout --detach <intake SHA>`, push URL disabled |
| Environment | macOS arm64, Node 24.21.0, npm 11.19.0 |
| Artifacts | private run folder `~/cogniate-qa-runs/LA/LA-E0-01/r1/` (umask 077): `ac01-git.txt`, `ac02-message.txt`, `npm-ci.log`, `check.log`, `skipped-attribution.log`, `timing.txt`, `status-after.txt` |

## Acceptance criteria

| AC | Result | Test id | Command | Evidence |
| --- | --- | --- | --- | --- |
| AC-LA-E0-01-01 | PASS | E0-01-DOC-1 | `git merge-base --is-ancestor bd368ff 1b17261`; `git diff bd368ff 1b17261 -- services packages apps infra tests ':(exclude)tests/ltiaas/**' package.json package-lock.json` | Exit 0. The diff is 0 bytes. Without the exclude, the only path is `A tests/ltiaas/TEST-STRATEGY.md`. `ac01-git.txt` |
| AC-LA-E0-01-02 | PASS | E0-01-DOC-2 | `git log -1 --format=%B 1b17261` | Line 3 names `bd368ff39fb4c533fc105e7c5ee81a59e618d99a`. Line 4: "LA-H10 answer: frozen candidate". Line 5: "Merge mode: wave-end". `ac02-message.txt` |
| AC-LA-E0-01-03 | PASS | E0-01-K0-1 | `npm ci`, then `npm run check`, in the clean clone | Both commands exit 0. Counts below. `npm-ci.log`, `check.log` |
| AC-LA-E0-01-04 | pending: wave-end merge (end of B1) | — | — | — |
| AC-LA-E0-01-05 | pending: wave-end merge (after LA-E1-05 and LA-E1-07) | — | — | — |

### AC-03 counts

| Count | R5 (spec) | Intake `1b17261` |
| --- | --- | --- |
| Vitest | 70 files; 1,123 passed, 5 skipped (1,128) | 70 files; 1,123 passed, 5 skipped (1,128) |
| Skipped tests | 5 course-fixture tests | The same 5: `packages/package-inspector/src/inspect.test.ts` (3) and `services/cogniate-app/src/app/app.test.ts` (2). The course zips are git-ignored and not in the clone (`skipped-attribution.log`, a verbose run of these two files). |
| Infra (`node --test`) | 111 | 111 tests, 14 suites: 111 pass, 0 fail, 0 skipped |
| Time | 69 s | `npm ci` 2 s (warm cache); `npm run check` 78 s |

The counts are equal to R5. Other facts: 115 `FSTDEP022` warning lines (R5 also has 115); `git status --short` in the clone is empty after the run. Note: R5 §3 records these counts at `9fcfd72`, but the spec text says `aaa823b`. The counts are the same, so this has no effect.

## Other checks (not ACs)

- The intake tree `d48fcb4` is equal to `git merge-tree --write-tree f1f5a55 bd368ff`. So the intake commit is a clean merge result with no conflict and no hand edit (spec "May edit": merge result only).
- G-BASE product code equals `9f8ac62`. `9f8ac62` is an ancestor of `bd368ff`, and `git diff 9f8ac62 bd368ff -- services packages apps package.json package-lock.json` is empty.
- The full `bd368ff..1b17261` diff has LA documents only: `docs/architecture/ltiaas` (119 files), `docs/team/ltiaas` (22), `docs/research/ltiaas` (6), `docs/reviews/LA-DESIGN` (3), `docs/reviews/LA-BREAKDOWN` (3), and `tests/ltiaas/TEST-STRATEGY.md`.

## Regression

R0: the AC-03 run. No new suite in this task. The measured time of the existing check is 78 s.
