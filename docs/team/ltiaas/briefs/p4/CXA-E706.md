# Review dispatch: Reviewer-A (Codex, same session), one item (QA kit)

Item 1: LA-E7-06 round 1 (QA-4, QA's own task; integration commit 1fd9aacc): the LTI 1.3 Channel Certification Kit. Diff: `git show 1fd9aacc --stat` (tests/ltiaas/kit/**: 5 channel fixtures from the design, lib/fixtures.ts and lib/runtime.ts, 7 channel-neutral K1 suites under suites/**, kit.k0.test.ts, vitest.config.mts, tsconfig.json, README.md; tests/acceptance/run-api.mjs: the QA_TASK=K1 / LA-E7-06 selector; docs/reviews/LA-E7-06/qa.md). Spec: docs/architecture/ltiaas/tasks/LA-E7-06.md; TEST-STRATEGY §2.6 (pass rule). QA reports the K0 and DOC rows PASS (host only); the K1-SIM rows (AC-LA-E7-06-01, -03, -04, -05, -06, -08) are pending a Docker window, so judge them by reading.
Lens A: are the K1 suites right and safe: each suite tests the AC it names and would fail on a wrong channel; the pass rule matches TEST-STRATEGY §2.6; fixtures come from the design and not from product source; no secret or key reaches a log, an artifact or git; runtime.ts starts nothing in Docker unless the K1-SIM selector is used, and then only with its own project prefix.
You may run the kit's host-only K0 checks (`npx vitest run --config tests/ltiaas/kit/vitest.config.mts` with its K0 filter, as qa.md says) in a fresh clone outside the repo (`git clone --no-hardlinks`, then `npm ci` there). Never start Docker or a K1-SIM run.
Write docs/reviews/LA-E7-06/reviewer-a.md (Round 1).

Integration worktree rule: read only. Never run npm ci, npm install, git clean, git checkout or git reset there.

# Common rules for LA build-task reviews (Reviewer-A, Reviewer-B)

You continue the dedicated reviewer role of G-DESIGN, G-BREAKDOWN and the earlier build rounds. Lenses: Reviewer-A "Is it right and is it safe?", Reviewer-B "Can a human team own it?" (base charter §1). Review the task diff named in the dispatch against its task spec (docs/architecture/ltiaas/tasks/<task>.md), the design (docs/architecture/ltiaas/**) and plan §6.1. Read the diff with git in the LA integration worktree /Users/quangnguyen/orca/workspaces/cogniate_moodle_integration_prototype/ltiaas-milestone; do not change any file except your review file.
Write docs/reviews/LA-<task>/<reviewer-a|reviewer-b>.md: first lines "Verdict: APPROVE | CHANGES_REQUESTED" and "Round: n"; findings with id (A-<task>-nn / B-<task>-nn), severity (base charter §5), file:line, problem, evidence, suggested fix. Proportional: small diff, short review. Check: every UNIT AC has a test that would fail on the old behaviour; the "Must not edit" list is respected; no behaviour change outside the spec; no LMS name added to core paths; ownership (matrix §5). Blind review: never open the other reviewer's file. Do not run Docker. Do not commit.
When done: one worker_done (--outcome succeeded), three-sentence summary with the verdict and counts, --files-modified, --report-path. Then stop. Read only your own messages.
=== TASK SPEC ===
