Verdict: CHANGES_REQUESTED
Round: 1

# Reviewer-A: D-T6L legacy label maintenance (C5) and the legacy launcher variant

Reviewer-A, Claude Opus 5.5 (`claude-opus-5-5`), xhigh effort. Task `task_ce7dbb5641ce`, dispatch `ctx_3e704f419d7e`, run `run_ebe671ad72a9`. Lens A: is it right and is it safe?
This is a bounded source review. I ran no Docker, npm, test, install or live LMS command. I changed no product, test or tool file. Before I wrote this verdict, I did not read another review of this patch or any reviewer message.
This review gives no runtime credit and no acceptance credit.

## Summary

- **C5 test patch: no finding.** If the test patch were reviewed alone, my verdict would be APPROVE.
- **Launcher variant: one MAJOR and one MINOR finding.** Both are in the gate message that the launcher sends to the Lead before the runner starts. The runner command, the product and test bindings and all the controls are correct.
- The verdict is CHANGES_REQUESTED only because of A-T6L-01. Its fix is not in the approved change list, so the Lead must decide it.

## Scope and identities (I checked each one)

M = `/Users/quangnguyen/cogniate-qa-runs/qa-common-c5-maint-20261022T1010Z`. R = `/Users/quangnguyen/cogniate-qa-runs/qa-common-c4-20261022T0408Z`.

| Item | Identity | How I checked it |
| --- | --- | --- |
| Product C4 | `bf09cdad91ca548e1ecbc14428b55180d35d5360`, tests tree `8283d90dc669feb72eeb7ec43f5dbf80a156f0d4` | `git rev-parse` |
| Test commit C5 | `e1a057be9624a82949007b772e2bdf19bc55638b`, tests tree `9e57d42f9e4cfe82b8058681ba6a81396abd2acc` | `git rev-parse` |
| C4..C5 `tests` diff | exactly the 3 D-T6L paths | `git diff --name-only` |
| `tests/acceptance/T6/3-courses.spec.ts` | C5 `bef3bce4c7b8f0f0a4b2683a8c0ad8053372fc0953857a1d14d12424a8ab97d2` (C4 `7be646fc…`) | SHA-256 of the git blobs |
| `tests/acceptance/T6/5-xss-a11y.spec.ts` | C5 `d28884e120eea572bfdeead17f0bd7783921cfca1ea53b655b73c1bfe84f3b0b` (C4 `da9b7107…`) | SHA-256 of the git blobs |
| `tests/acceptance/T8/2-shell.spec.ts` | C5 `7222871877967f9380fef79b044821ca2caa80bf5e0e886ac808da9ba696b743` (C4 `bac802fd…`) | SHA-256 of the git blobs |
| Launcher variant | `M/tools/launch-legacy-c5.sh` `51963fdfc2ad3dbe2c4f7012babb5714a20b4099102c4ca18ce6dd7ac58727a9`, 10,064 bytes | `shasum -a 256`, `wc -c` |
| Original launcher | `R/tools/launch-full-c4.sh` `c824abeb70835c61fdac056bdc1a141f8669aed32e96d7fdce2ff62a5ff0412b`, unchanged; the copy in `M/tools` is identical | `shasum -a 256` |
| Launcher diff | `M/prep/02-launch-legacy-c5-diff.patch` `d33a8cb3874a95c3b8a333174de721a67d4bf5a7ce07cbe51d85f95d9681c6d9`; my own `diff -u` of the two files is byte-identical to it | `cmp` |
| Readiness receipt | `M/prep/READY-C5-LEGACY.md` `95a2f118e8fb6b946ed39e4c3b65519da2977f945f8db2198272e1f9434ad06f` | `shasum -a 256` |
| Evidence index | `M/evidence-index-maint-v1.tsv` `c95ce099946b2ed76fc0e469ae6b79f672f8538f69dcc41e3b652987b7f3ea3b` | `shasum -a 256` |

## Evidence considered

- Authority: `docs/team/charter.md`; `docs/team/t6-label-repair-2026-10-22.md` (D-T6L); `docs/architecture/tasks/M2.md:46-56` and AC-M2-10 (`M2.md:120`); AC-M3-01 and AC-M3-02 (`M3.md:84-96`); `storage-full-round-triage.md` §9.
- The C4..C5 tests diff, and the full text of the three changed tests at C5.
- C4 portal source: `apps/portal/src/courses/CourseDetail.tsx:53-60`, `PublishDialog.tsx:76-158`, `ui/dialog.tsx:29-66`, `lms.ts:3-7`, `Publications.tsx:61-94`, `MoodleCourse.tsx:21`.
- The frozen runner at C5. It is byte-identical to C4, because the tests diff has only the 3 paths. I read `tests/host/run-m1.mjs:126-139` and `:201-216`, and `tests/host/core.mjs:225-275`.
- The launcher variant, its diff, `M/prep/05-arg-provenance-checks.txt`, `M/prep/14-real-c5-provenance-check.txt`, `READY-C5-LEGACY.md` and `M/patch/01`–`10`.
- The full2 T6 failure record: `docs/reviews/M1/qa.md:2856-2867`.

## Test patch (C5): no finding

The patch has 13 literal changes on 8 lines. This is the same set that D-T6L lists.

| Check | Result |
| --- | --- |
| Opener, `T6/3-courses.spec.ts:129`, `T6/5-xss-a11y.spec.ts:44,79,91`, `T8/2-shell.spec.ts:30` | Correct. C4 renders `<Link id="publish-opener">Publish to an LMS` with an `aria-hidden` icon (`CourseDetail.tsx:53-60`). Its role is `link` and its name is `Publish to an LMS`. The tests keep the `button`-or-`link` fallback and `.first()`. No other button or link on the course page matches `/Publish to an LMS/`. The empty-state text (`Publications.tsx:63`) is a paragraph, and the dialog close button is `Close dialog` (`ui/dialog.tsx:61`). The regex has no special characters, so it needs no escape. |
| Diagnostic text, `T6/5-xss-a11y.spec.ts:97` | Message text only. The assertion `toBeFocused()` on the same opener locator is unchanged. |
| Connection select, `T8/2-shell.spec.ts:33` | Correct. The C4 select has `aria-labelledby="publish-connection-label"`, which gives the name `LMS connection` (`PublishDialog.tsx:96-105`). The name match works the same way as before. |
| Option prefix, `T8/2-shell.spec.ts:34` | Correct, and slightly stronger than before. The C4 option text is `{name} ({lmsNames[lms]}, {host})` (`PublishDialog.tsx:112`), and `lmsNames.moodle` is `Moodle` (`lms.ts:4`). The prefix `` `${name} (Moodle, ` `` also proves that the option is a Moodle connection. The old prefix `` `${name} ·` `` did not check the site host either, so the patch loses nothing. `startsWith` takes a plain string, so the parentheses need no escape. |
| Kept unchanged | Test ids and titles (37 T6/T8 titles, `M/patch/03` = `07`). Timeouts (`120_000`, `240_000`, `15_000`, `30_000`). Fallbacks (radio or select, button or link, `[role="dialog"]` or `dialog[open]`). The XSS checks (`noMarkupRan`, literal titles). The axe filter for serious and critical issues. The keyboard Enter, Escape and focus steps. The Moodle-specific assertions (`Dev Moodle`, `Available in Moodle`, the teacher text, `Also create an empty Moodle course`, the Moodle course link and `href`, the web-service course counts). |
| Completeness | At C5, `tests/acceptance` contains no old M2 label: `Publish to Moodle`, `Moodle connection` as a UI name, `Moodle publications`, `No Moodle connection…`, `Connect a site first` and the old `·` option separator have 0 hits (`git grep`). M2 keeps `The Moodle connection failed.` on Moodle pages, and the legacy suites do not use it. AC-T6-01 checks `≥ 9` cards, so the two new cards do not break it, and it passed in full2. In full2, all three T6 failures stopped at the old opener (`qa.md:2864-2866`), and the other 15 T6 cases passed. No other file refers to the three spec files. |
| Unreached assertions, from the source only | These match C4 when I read the source: `Available in Moodle` (`Publications.tsx:82`), the teacher text (`Publications.tsx:90-91`), the dialog `Publish` button (`PublishDialog.tsx:158`), the first `select` is the connection select, and `Open Moodle course` matches `/Moodle course/i` (`MoodleCourse.tsx:21`). This is not a runtime claim. These assertions stay unverified until the fresh run passes them. |

## Launcher variant

| Approved change | Line | Result |
| --- | --- | --- |
| Separate product, test, source and root arguments | `:9`, `:12` | Correct. The script requires all four positional arguments (`M/prep/05` check 2). |
| Product binding | `:25` | Correct. It is stricter than the original: the value must be exactly the C4 string, and any other 40-hex value is rejected. |
| Test SHA | `:26` | Correct. The value must be 40 hex and different from the product SHA. |
| Source bound to the test SHA | `:27-29`, `:31-32` | Correct. HEAD must equal `TEST_SHA`. The source must be clean, `tests` must equal `TEST_SHA`, there are no untracked test files and there is no `.env`. |
| Exact 3-path guard | `:30` | Correct. The list matches the sorted `--name-only` output exactly. If the C4 object is missing, the output is empty and the launcher stops, so the guard fails closed. A rename cannot hide another path, because all 3 paths exist in C4, so git reports them as changes, not renames. |
| Runner command | `:59` | Correct. The arguments are the same as those of the full2 legacy child (`run-m1.mjs:168-170`), which uses the same entry point and the same 12 groups (`run-m1.mjs:201-214`). There is no full-round or diagnostic phase. |
| Clone guard | `:77` | Correct. `--sha8 ${SHA:0:8}` gives `bf09cdad`, which is the prefix of the clone names that the runner makes from the product SHA. |
| Everything else | `:33-57`, `:70-111` | Unchanged against the original, byte for byte: course hashes, ancestor check, W1-W3, sampler, secret watch, clone guard, runner umask `022` only in the child, W4 capture and strict compare, owned-clone list, secret scan and exit code. The environment (`qa-multi-r1`, `8443`, `172.29.0.0/16`, `default`) is unchanged. |

The product and test attribution fails closed. The launcher accepts only C4 as the product SHA. The runner checks that both revisions resolve (`run-m1.mjs:131-134`). Each legacy child clones the source and checks out C4 detached (`core.mjs:233-238`). It then replaces only `tests/` from the C5 source and saves `tests-diff-vs-sha.txt` (`core.mjs:247-265`). So every product file in the run comes from C4, whatever the non-test files of C5 are. The runner also checks that `tests` equals `TEST_SHA` and that there are no untracked test files (`run-m1.mjs:135-139`). I found no change to privileges, `Origin` handling, permissions, isolation, the strict volume records or the secret scan.

## Findings

### A-T6L-01 — MAJOR — `M/tools/launch-legacy-c5.sh:15` (used at `:64-67`)

**Problem.** The required gate message to the Lead uses the lifecycle IDs of the settled C4 dispatch.

**Evidence.** Line 15 is `FROM=orca_session_id:731b0935-…; TASK=task_ef1d19129419; DISPATCH=ctx_e23ced3dd1fa`, the same as `launch-full-c4.sh:16`. These are the IDs of the C4 diagnostic and full-run dispatch. Full2 started under `ctx_e23ced3dd1fa`, and then `ctx_77546b08ce17` took it over while it ran (`docs/reviews/M3/qa.md:639`). Each earlier variant set these IDs for its own dispatch: `launch-full.sh:16` (`ctx_b4253986bb55`), `launch-full-c2.sh:16` (`ctx_0700abfb3430`), `launch-full-c3.sh:16` (`ctx_2e9642c8e4be`) and `launch-full-c4.sh:16` (`ctx_e23ced3dd1fa`). The gate message is a required step before the runner starts: if the send fails, the launcher stops (`:67`).

**Impact.** The legacy window will run under a new runtime dispatch. The gate message then either goes to a settled dispatch, possibly in the name of another session, or the send fails and the launcher stops after W1-W3 inside a granted window. Neither case changes the identities in the run evidence. Both cases break the documented gate step.

**Suggested fix.** The Lead approves one exact change to line 15: the session, task and dispatch IDs of the runtime dispatch, set when that dispatch exists. Common QA records the new hash, and a reviewer checks only this one-line change. If the Lead keeps line 15 as it is, the Lead records that decision. Before the grant, the Lead also confirms without Docker that this send works from the runtime context.

### A-T6L-02 — MINOR — `M/tools/launch-legacy-c5.sh:65-66`

**Problem.** The text of the gate message describes the run incorrectly.

**Evidence.** The subject says `starting full M1 run at ${SHA:0:7}`. The body says `Clone: $SOURCE (detached $SHA, …)` and `Projects: … (sim, snapshot, migration, legacy) and $PROJECT-st (storage)`. But line 27 binds the source HEAD to `TEST_SHA` (C5), not to `$SHA` (C4), and the command runs `--phase legacy` only. The same body includes `command.txt` with the correct arguments, so the message contradicts itself, but no information is lost.

**Suggested fix.** If the launcher changes for A-T6L-01, change these two texts to match the legacy run, for example `detached $TEST_SHA (tests), product $SHA`. If the launcher does not change, the Lead's run record takes the identities from `command.txt` and the launcher checks, not from this text.

## D-T6L mechanical conditions

D-T6L is an explicit, written Lead exception to triage §9 steps 6-8. It keeps the host checks of step 3 (typecheck and inventories) and the two blind reviews of step 5. It does not relabel any evidence. I assess only its conditions, and I do not treat it as a general weakening of §9.

| D-T6L item | Assessment |
| --- | --- |
| 1. The tests diff is exactly 3 paths | Holds (git), and the launcher enforces it at `:30`. |
| 2. Every product run uses `--sha` C4 | Holds for this launcher (`:25`). The runner checks out C4 (`core.mjs:234`). |
| 3. Full2's 2×488 rows and the 2×233 Canvas judgments keep C4 and `8283d90` | The C4 tests tree is `8283d90` (git). The inputs of the 488 rows are byte-identical between `8283d90` and `9e57d42`, apart from the 3 legacy spec files, and nothing refers to those files. Nothing in this patch moves those rows to C5. |
| 4. No migration, storage, M1, product or build input changes | Holds for this run. The non-test changes from C4 to C5 are text only: `README.md`, `infra/README.md` (one row of the error table) and `docs/**`. No product service mount or Dockerfile reads them. The test container mounts the whole clone read-only (`infra/compose.yaml:461`), but in this run that clone is C4, so the run sees only the C4 text. Note: `tests/host/run-t1.mjs:628` reads `infra/README.md`, but T1 is not part of this run. |
| 5. All 12 groups run fresh in one `--phase legacy` run, product C4, `--test-sha` C5 | Holds for the code (`run-m1.mjs:201-214`, launcher `:59`). C5 is bound only by the launch command; see RT-1. |
| 6. M2 and T7 run at C4 with unchanged inputs | Outside this launcher. `tests/e2e` and the M2 tests did not change from C4 to C5. |
| 7. Void conditions | A runtime and Lead matter; see RT-3. |

Full2 stays FAILED. T8 stays NOT RUN, and the unreached T6 assertions stay unverified. The final evidence will name two tests trees: the M1 rows at `8283d90` and the fresh legacy run at `9e57d42`. Every report must name the correct tree for each row.

## Runtime requirements (not source defects)

- **RT-1.** The launcher pins the product SHA, but it accepts any test SHA that passes `:26-31`. The launch command in `READY-C5-LEGACY.md` passes `e1a057be…`, and `M/prep/14` checked the real C5 clone. Before anyone uses the results, the Lead and Canvas QA must confirm `--test-sha e1a057be9624a82949007b772e2bdf19bc55638b` in `public/command.txt`.
- **RT-2.** Each legacy child must record clone HEAD `bf09cdad…`, and its `tests-diff-vs-sha.txt` must show only the 3 paths (`core.mjs:245`, `:262-265`).
- **RT-3.** A product change, another test change or any fresh failure voids D-T6L (item 7). Canvas QA judges the T6/T8 results independently.
- **RT-4.** The run root `M/legacy-c5` must not exist before the launch. It does not exist now.

## Evidence notes (no change needed for this verdict)

- `M/patch/01` and `04` match the C4 and C5 blobs. The changed lines in `M/patch/05-git-diff.patch` match the C4..C5 tests diff. The inventory pairs `02`/`06` and `03`/`07` are byte-identical, and `08` and `09` are empty.
- `M/patch/10-typecheck.txt` (`5c2ed944…`) contains only the npm banner. `tsc` prints nothing when it succeeds, so the file itself does not record exit 0. Only Common QA's report states the exit code.
- `M/report/msg-patch-host-check.txt` contains three `$(shasum …)` placeholders that the shell did not expand. The evidence index that the Lead verified gives those hashes.
- `docs/reviews/M1/qa.md:2864-2866` quotes test titles and line numbers that are not in the C4 source. For example, `AC-T6-07: Publish to Moodle dialog produces dynamic registration URL…` and `:135` do not exist, and `dialog must open before scanning` has 0 hits. The quoted failing locator is correct. This record is not part of this review, and QA owns any correction.
