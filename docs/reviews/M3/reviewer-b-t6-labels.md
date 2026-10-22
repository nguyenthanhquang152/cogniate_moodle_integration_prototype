Verdict: CHANGES_REQUESTED
Round: 1

# Reviewer-B: D-T6L legacy label patch and legacy launcher variant

Date: 2026-10-22. Reviewer-B (Claude Code Opus 5.5, xhigh). Lens B: test quality and maintainability.
Run `run_ebe671ad72a9`, task `task_501455618801`, dispatch `ctx_3bb7b60adf5c`.
This is a bounded, host-only source review. It is not a prototype approval and gives no runtime credit.
I did not run Docker, npm, tests or the launcher. I did not read Reviewer-A's file or reviewer messages.

## Summary

The test patch is correct and complete. I found no defect in it.
The launcher variant keeps the qualified behavior and has correct argument guards.
Its gate message to the Lead has the wrong identity and wrong source attribution (B-T6L-01, B-T6L-02).
These are text and identity changes only. They do not change the qualified behavior.
After a fix and a re-check of the new diff, I expect to approve.

## Scope and identities (all verified)

| Item | Identity |
| --- | --- |
| Product candidate C4 | `bf09cdad91ca548e1ecbc14428b55180d35d5360`, tests tree `8283d90dc669feb72eeb7ec43f5dbf80a156f0d4` |
| Test commit C5 | `e1a057be9624a82949007b772e2bdf19bc55638b`, tests tree `9e57d42f9e4cfe82b8058681ba6a81396abd2acc` |
| `tests/acceptance/T6/3-courses.spec.ts` | C4 `7be646fc…` → C5 `bef3bce4c7b8f0f0a4b2683a8c0ad8053372fc0953857a1d14d12424a8ab97d2` |
| `tests/acceptance/T6/5-xss-a11y.spec.ts` | C4 `da9b7107…` → C5 `d28884e120eea572bfdeead17f0bd7783921cfca1ea53b655b73c1bfe84f3b0b` |
| `tests/acceptance/T8/2-shell.spec.ts` | C4 `bac802fd…` → C5 `7222871877967f9380fef79b044821ca2caa80bf5e0e886ac808da9ba696b743` |
| Launcher variant | `<M>/tools/launch-legacy-c5.sh` `51963fdfc2ad3dbe2c4f7012babb5714a20b4099102c4ca18ce6dd7ac58727a9` |
| Original launcher | `<R>/tools/launch-full-c4.sh` `c824abeb70835c61fdac056bdc1a141f8669aed32e96d7fdce2ff62a5ff0412b` (also byte-equal in `<M>/tools`) |
| Launcher diff | `<M>/prep/02-launch-legacy-c5-diff.patch` `d33a8cb3874a95c3b8a333174de721a67d4bf5a7ce07cbe51d85f95d9681c6d9` |

`<M>` = `~/cogniate-qa-runs/qa-common-c5-maint-20261022T1010Z`. `<R>` = `~/cogniate-qa-runs/qa-common-c4-20261022T0408Z`.

## Evidence considered

- `docs/team/charter.md`, `docs/team/t6-label-repair-2026-10-22.md` (D-T6L), `M2.md` lines 46-56 and AC-M2-10, `M3.md` AC-M3-01/02, `storage-full-round-triage.md` §9, `docs/reviews/M3/qa.md` full2 section, `docs/team/model-transition-2026-10-22.md`.
- `git diff C4 C5`: in `tests/` only the three paths. `services`, `apps`, `packages`, `tests/e2e`, `tests/fixtures`, `tests/host` and all root build files are the same. The only other non-docs changes are `README.md` and `infra/README.md` (Docs commit `fd87bf7`, text only). They are not product or build inputs: each legacy clone checks out C4 (`tests/host/core.mjs:234`).
- Product source at C4: `CourseDetail.tsx:58` (opener is a link "Publish to an LMS"), `PublishDialog.tsx:76,96,109-112` (title, "LMS connection", option `<name> (<LMS>, <host>)`), `lms.ts` (`moodle: "Moodle"`).
- QA receipts, read only: `<M>/patch/01-10`, `<M>/prep/01, 02, 03, 04, 05, 10, 11, 14`, `READY-C5-LEGACY.md`. `patch/05-git-diff.patch` is byte-equal to `git diff C4 C5 -- tests`. The before hashes equal the C4 blobs; the after hashes equal the C5 blobs.
- I compared `<M>/tools` with `<R>/tools`: 31 of 31 common files are byte-equal. The only new file is `launch-legacy-c5.sh`. My `diff -u` of the two launchers has the same hunks as `prep/02`.
- Frozen runner at C5: `tests/host/run-m1.mjs` (`8e1ef65c…`) lines 127-139, 141-151, 168-170, 201-216; `tests/host/core.mjs` lines 84, 203, 228-266, 343, 425, 450.

## Test patch: no findings

- **Count.** 13 literal changes on 8 lines, as D-T6L lists: `3-courses.spec.ts:129` (2), `5-xss-a11y.spec.ts:44,79,91` (2 each) and `:97` (1), `2-shell.spec.ts:30` (2), `:33` (1), `:34` (1).
- **Approved texts.** All new texts are in the M2 table (`M2.md` lines 46-56): "Publish to an LMS", "LMS connection" and the option prefix `<name> (Moodle, `. The C4 product renders these exact texts.
- **Kept.** The patch keeps all test ids, titles, `test.setTimeout`, the button-or-link fallback with `.first()`, the radio-or-select fallback, the axe scans and selectors, the XSS checks, the keyboard path and `toBeFocused`, and the Moodle-only checkbox and course-link oracles. The 184-case label inventory and the 37 T6/T8 titles are byte-equal before and after (`62c3afb4…`, `18d6a6c8…`). Lines did not move, so the static labels stay valid.
- **Strength.** The old option match was `${name} ·` and the new one is `${name} (Moodle, `. Neither checks the host, so the oracle is not weaker. The M2 browser rows own the full AC-M2-10 option check.
- **Completeness.** At C5, `tests/acceptance` has no old M2 label: "Publish to Moodle", "Moodle connection" (as a selector), "Moodle publications", "No Moodle connection is ready" or the old ` · ` option form. The remaining hits are in `tests/e2e`. They are prose or already-new labels, and that tree is unchanged.
- **Cause match.** The three full2 T6 failures (`AC-T6-07`, `AC-T6-13`, `AC-T6-09`) all timed out on `/Publish to Moodle/`. Both AC-T8-10 cases use the same opener and the old select name, so they also needed the patch.
- **Unreached assertions (static only).** The C4 product still renders "Available in Moodle" (`Publications.tsx:82`), the Moodle teacher path (`:90-91`), "Choose a connection", "Also create an empty Moodle course" (`PublishDialog.tsx:109,143`) and the "Published to Moodle" result. So I see no second label failure behind the opener. Only the run can verify this.

## Launcher variant: guards and unchanged behavior

- The variant changes only the approved items: four separate arguments, the product SHA pinned to C4 (line 25), source HEAD equal to the test SHA (line 27), tests clean against the test SHA (line 29), the exact three-path guard from C4 to the test SHA (line 30) and `--phase legacy --sha C4 --test-sha C5` (line 59).
- The clone guard keeps `--sha8 "${SHA:0:8}"` (line 77), and that is correct. Each legacy runner names its clone `<project>-<product sha8>-<ISO>` (`core.mjs:84`), so `bf09cdad` matches.
- Ancestor, W1-W3, sampler, secret watch, clone guard, runner `umask 022` child (line 87), W4 capture and strict compare, accounting copy, owned-clone list, secret scan and `exit "$CODE"` are byte-equal to the qualified launcher.
- `--phase legacy` is the same code path that full mode used as its legacy child (`run-m1.mjs:168-170` against `:201-216`). The environment is the same. The runners stop at the first failure (`run-m1.mjs:146`), so a failure leaves the later groups NOT RUN.
- `prep/05` shows each new guard fails closed: missing argument, wrong product SHA, test SHA equal to C4, wrong HEAD, and a two-path diff. `prep/14` shows the real C5 clone passes. I did not rerun them.

## Findings

### B-T6L-01: MAJOR. The gate message carries the identity of the old C4 full2 dispatch

- **Where:** `<M>/tools/launch-legacy-c5.sh:15`, used at `:64-67`.
- **Problem:** Line 15 still sets `FROM=orca_session_id:731b0935-…`, `TASK=task_ef1d19129419` and `DISPATCH=ctx_e23ced3dd1fa`. These are the Claude Common QA session and the dispatch of the C4 full2 run, which was handed off at 08:31Z (`model-transition-2026-10-22.md`). `READY-C5-LEGACY.md` says that this launcher runs only under a separate future runtime dispatch.
- **Effect:** One of two things happens. The send is accepted, and the pre-launch record of this C4/C5 legacy run is filed under the failed full2 task, which is the C4/`8283d90` evidence that D-T6L items 3 and 7 keep apart. Or the send fails, and the launcher blocks at line 67 after W1-W3 have already used the granted window.
- **Evidence:** The earlier C3→C4 variant changed exactly this line for its new dispatch (`tools/ledger/ctx_e23ced3dd1fa/launch-full-c4-vs-launch-full-c3.diff`).
- **Fix:** Get Lead approval for one more bounded change: set line 15 to the actual runtime session, task and dispatch, or take them as validated arguments. Record the new diff against `51963fdf…` and re-check it before any window grant.

### B-T6L-02: MAJOR. The gate message names the wrong source revision and the wrong run type

- **Where:** `<M>/tools/launch-legacy-c5.sh:65-66` (also saved as `public/gate-message.txt`).
- **Problem:** The subject says "starting full M1 run at bf09cda". The body says "Clone: $SOURCE (detached $SHA, …)", which prints C4. Line 27 makes sure that the source is detached at the test SHA, C5. The body also lists the sim, snapshot, migration and storage projects, which a legacy-only run does not start.
- **Effect:** The one human-readable launch record gives a false source SHA and makes the run look like a C4 full run. D-T6L depends on exact C4/C5 attribution. Only the `command.txt` text in the same body shows the true test SHA.
- **Fix (text only):** Subject: "starting D-T6L legacy run: product ${SHA:0:7}, tests ${TEST_SHA:0:7}". Body: "Clone: $SOURCE (detached $TEST_SHA, tests only; each runner checks out product $SHA)". Projects: "$PROJECT (legacy only)". Make this change in the same edit as B-T6L-01.

### B-T6L-03: MINOR. The test SHA is not pinned to C5

- **Where:** `launch-legacy-c5.sh:26`.
- **Problem:** Line 25 pins the product SHA, but line 26 accepts any 40-hex test SHA other than C4. A later commit whose tests differ from C4 in the same three paths, with different content, passes every guard.
- **Fix:** Pin `TEST_SHA` to `e1a057be9624a82949007b772e2bdf19bc55638b`, or check the three C5 blob SHA-256 values. Do this in the same edit. It is safe to defer, because `command.txt` and each runner's `tests-diff-vs-sha.txt` record the truth.

### B-T6L-04: MINOR. Inherited "full run" names in a legacy-only run

- **Where:** `launch-legacy-c5.sh:83, 86, 91-92` (`starting full run`, `private/full-run.stdout.log`, `public/full-run-exit.json`).
- **Problem:** A reader can take `full-run-exit.json` with exit 0 as full-round evidence.
- **Fix:** Do not rename: `progress.sh:16` reads `full-run.stdout.log`. QA states in the report that "full-run" here means the runner child of this legacy-only invocation.

### B-T6L-05: NIT. The typecheck receipt does not show its result

- **Where:** `<M>/patch/10-typecheck.txt`.
- **Problem:** The file has only the npm banner. The exit code, working tree and time are only in QA's message (`report/msg-tool-prep-done.txt`).
- **Fix:** QA records the exit code and the tree in `qa.md`. No rerun is needed.

## Future runtime requirements (not source defects)

1. **Attribution of legacy folders.** Each runner's `summary.json` records only `sha` = C4 (`core.mjs:425`). Its folder name `qa-multi-r1-bf09cdad-<ISO>` has the same form as the full2 legacy folders. QA must label all 12 groups "product C4 `bf09cda` / tests C5 `e1a057b` (tree `9e57d42`)". QA must also show that each runner's `tests-diff-vs-sha.txt` (`core.mjs:262-265`) equals the C4→C5 three-path diff (`patch/05`, `da9d096b…`) and lists no new files. Never mix these folders with the `full2-src` folders.
2. **Fail-fast.** A failure in any group stops the later groups. A T6 failure therefore leaves T8 NOT RUN, and any fresh failure voids D-T6L (item 7). The unreached T6 assertions stay unverified until the run reaches them.
3. **W3 baseline.** `live-boundary.mjs:117-119` compares only the seven-volume original baseline and has no exact-count gate. Before the gate, QA confirms the W3 volume set against the ten accepted full2 records and records the state of the other project's Docker cleanup.
4. **D-T6L items 3 and 6** are outside this launcher. Full2 stays FAILED at C4/`8283d90`. M2 and T7 run later at C4 with the unchanged `tests/e2e` tree (equal at C4 and C5). No row of the new run takes earlier evidence (AC-M3-01).

## D-T6L mechanical conditions

| Item | Status in source |
| --- | --- |
| 1. Tests diff is exactly the three paths | Met (git; launcher line 30) |
| 2. Product runs use C4 | Met (line 25; `core.mjs:234`) |
| 3. Full2 rows keep C4/`8283d90` | Not touched by this change; see B-T6L-01/02 for the attribution risk |
| 4. No product, build, storage, M1 or migration input change | Met (trees equal; README text only) |
| 5. All 12 legacy groups in one `--phase legacy` invocation with C4 and `--test-sha` C5 | Met (line 59; `run-m1.mjs:201-216`) |
| 6. M2/T7 at C4 with unchanged `tests/e2e` | Tree equal; runtime pending |
| 7. Any other change or fresh failure voids the exception | Guarded for product and other test paths; B-T6L-03 for the test SHA |
