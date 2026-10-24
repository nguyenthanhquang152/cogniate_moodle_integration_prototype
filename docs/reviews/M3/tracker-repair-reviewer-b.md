Verdict: APPROVE
Round: 1

# M3 tracker repair: Reviewer-B (lens B: can a human team own it?)

Reviewer: independent Claude Opus 5.5 xhigh Reviewer-B. Task `task_6d814380333c`, dispatch `ctx_2f80572001b9`, run `run_ebe671ad72a9`.
Date: 2026-10-22, about 13:10–14:05 UTC.
Scope: R1 (product C6), R2 (tests C7), the frozen v3 launchers and the corrected E-T5R mapping evidence.

The verdict APPROVE covers source and launcher review only. It is NOT runtime acceptance.
No runtime row passed on C6/C7. The legacy window, the Canvas SIM runs, M2 and T7 stay PENDING.
All 32 real-LMS rows stay UNVERIFIED. Local Canvas stays DEFERRED.
Findings: 0 BLOCKER, 0 MAJOR, 4 MINOR, 3 NIT.

## 0. Independence and method

- I did not read the other reviewer's file (`tracker-repair-reviewer-a.md`) or any other review of this repair. I did not read the current board, review summaries or the tracked `tracker-repair-qa.md` prose.
- I read the charter, the failure plan at c80a59f, the source and test diffs, the author evidence, the sealed QA evidence and the v3 prep root. I used read-only git commands and hash checks.
- I ran one small static script: it is a copy of the `LC-T1-05` table rule from `tests/host/run-t1.mjs:627-650`, run against `git show` output. Private folder `/tmp/rb-t5r-1CzdDQ` (0700, file 0600).
- I ran no Docker, browser, runner, test, install or network command. I changed no product, test, guide or team file. I did not touch `pnpm-workspace.yaml`.

## 1. Identities (verified with git on this checkout)

| Item | Value |
| --- | --- |
| C4 source | `bf09cdad91ca548e1ecbc14428b55180d35d5360`, tests tree `8283d90dc669feb72eeb7ec43f5dbf80a156f0d4` |
| C5 tests | `e1a057be9624a82949007b772e2bdf19bc55638b`, tests tree `9e57d42f9e4cfe82b8058681ba6a81396abd2acc` |
| C6 product (R1) | `4008afb92fe983d52db33442e060210b929966c8`, root tree `6c8f7925…`, tests tree `9e57d42f…` (same as C5) |
| C7 tests (R2) | `620c03d0697c72b80649d2e77a52594ad0d282f3`, root tree `bc1b9f0b…`, tests tree `3e9368bb61d02c2cc6c3838b4aaeaedd28fffd71` |
| Plan | `docs/reviews/M3/t5b-failure-plan.md` at c80a59f |
| Guide candidate | `958ee5c1225addff7dc3d5ea3417b7d17e157bbf` |

- `git diff --name-status C4 C6 -- . ':(exclude)docs/**' ':(exclude)tests/**'` gives EXACTLY four paths: `README.md`, `apps/player/src/html/tracker.test.ts`, `apps/player/src/html/tracker.ts`, `infra/README.md`.
- C6 and C7 are equal outside `docs/**` and `tests/**`. C6→C7 changes only `docs/team/board.md`, `docs/team/multi-lms-plan.md` and the two R2 test files.
- `tests/**` C5→C7: only `T6/3-courses.spec.ts` and `T8/2-shell.spec.ts`.

| Path | C4 blob | C6 = C7 blob | SHA-256 at C6/C7 |
| --- | --- | --- | --- |
| `apps/player/src/html/tracker.ts` | `4975290` (sha256 `0a315e85…d169`) | `c313e2a` | `4636a1fed329321030580d457c0da4246edda1402f7c883109a6667899155f5d` |
| `apps/player/src/html/tracker.test.ts` | `03c2b02` | `75df840` | `9830842c6977025c89e8542da8927b857dbde11b940dfc2d3b55766edf140221` |
| `apps/player/src/runtime/main.ts` | `bd31230` | `bd31230` (unchanged) | `2d2e2d63…8f92` |
| `README.md` | `01341a0` | `81310bb` = 958ee5c blob | — |
| `infra/README.md` | `cb4070d` | `06b9a8d` = 958ee5c blob | — |
| `tests/acceptance/T6/3-courses.spec.ts` (C7) | — | `38a6877` | `131615a09e75d5fc4d399136682ffa2f0b744281725eff93cc207af7a306dd37` |
| `tests/acceptance/T8/2-shell.spec.ts` (C7) | — | `3126081` | `9e55d8492308cb6b0ca01aa53d312ad8417d76973aa2c50853cff7f93124a399` |

## 2. README consumers (identity rule: not presumed inert)

- Only one program reads a changed README: `tests/host/run-t1.mjs:627-650` (`lcReadme`, row `LC-T1-05`) reads `infra/README.md`. No program reads the root `README.md`. Every other match is a comment.
- `run-t1.mjs` is standalone (`tests/package.json` `host:t1`). It is NOT in `run-m1.mjs`. The legacy phase (`run-m1.mjs:201-216`) runs `run-t2`, `run-t3c`, `run-t4a`, `run-t4b`, `run-t5`, `run-t8` only. `run-m1.mjs`, `m1-phases.mjs`, `m1-control.mjs` and `m1-migration.mjs` contain no README reference.
- Compose mounts `package.json`, `node_modules`, `packages`, `services`, `apps`. No README file is mounted. The Dockerfiles copy no README. `eslint` ignores `docs/**` and `tests/**` and lints no Markdown.
- Static replica of the `LC-T1-05` rule: C4 `infra/README.md` → 17 tables, missing none, pass. C6 → 17 tables, missing none, pass.
- Result: no M1 row proposed for reuse depends on either README. I see no coverage need for a standalone T1 run.

## 3. R1 review (C6, `apps/player/src/html/tracker.ts` and its unit test)

### 3.1 Scope and rules

- The diff starts at the `watchFrame` docblock (`tracker.ts:116`). `pageKey`, `isInternalHtmlLink` and `createHtmlTracker` (lines 1–114) are unchanged. So the HTML rules are unchanged: menu seen on visit, 10 s visible dwell plus scroll with 24 px slack, first answer stands, `target`/`rel` removal, saved progress, null-prototype answers.
- `main.ts` is byte-identical. The call at `main.ts:66` still works because `watchFrame` takes the runtime timers from `frame.ownerDocument.defaultView` (`tracker.ts:122`).
- No change to transport, `seq`, SCORM, the content host, CSP, services, dependencies or the build configuration (four-path identity). QA's build shows one `runtime.js` entry.

### 3.2 Lifecycle checks (all PASS against the grant §4.1)

| Required behavior | Where | Result |
| --- | --- | --- |
| A document seen while `loading` gets one `DOMContentLoaded` listener; the listener attaches at once | `tracker.ts:159-167` | PASS. `readyState` is `interactive` when the event fires, so `tryAttach` passes its guard. |
| One attach per document | `tracker.ts:123,160-163` | PASS. `done` is a WeakSet. `done.add` runs before `attach`. The listener is removed after the attach. |
| `pagehide` hook at first sight, also while loading | `tracker.ts:165-166` | PASS. It is registered before the `loading` test. |
| Fast check on the runtime window (10 ms), at start and after each child `pagehide`; it stops on a new document or after 5 s | `tracker.ts:129-141,153-156,181` | PASS. `runtimeWin.setInterval`/`setTimeout`. A restart clears the old pair first. |
| 150 ms poll and frame `load` kept | `tracker.ts:179-180` | PASS. |
| `about:blank` excluded; same-origin `try/catch` kept | `tracker.ts:146-152` | PASS. A cross-origin frame gives `contentDocument === null`, so the check returns. A throw is caught. |
| `stop()` clears timers and listeners | `tracker.ts:183-190` | PASS for every timer, the frame listener and every `DOMContentLoaded` listener. The `stopped` flag makes any other hook inert. See B-M3TR-02 for old-window `pagehide` hooks. |

Behavior I traced for a navigation without `load` (the AC-T5-36 case): menu A is seen within 10 ms of creation (initial fast check) while it parses. Then `DOMContentLoaded` attaches A in the same event dispatch, so the menu visit is recorded before Playwright's `domcontentloaded` wait returns. The click unloads A, and A's `pagehide` starts the fast check. Lesson B is seen within 10 ms and is attached at its own `DOMContentLoaded`, before any click on its answer.

Known residuals (not defects against the grant): a document that appears and is replaced between two checks is never seen; an answer given before the page is parsed does not count (as in C4). The author report states both. See B-M3TR-03 for the code comment.

### 3.3 Unit tests: causal quality

- U1 (`tracker.test.ts:142-157`) and U2 (`:159-169`) are causal for the two candidate lost facts. In U1, A is attached only by `DOMContentLoaded`: no timer moves between `a.parsed()` and the navigation. B is attached only by the `pagehide` restart: 10 ms is less than one 150 ms poll. U2 clicks with no timer advance. Both use the real `createHtmlTracker`, not only an attach spy.
- Fail-before (author evidence, verified by me): `/Users/quangnguyen/cogniate-repair-runs/r1-watchframe-20261022-zng43k_7/fail-before/` holds a `tracker.ts` equal to C4 (sha256 `0a315e85…d169`) and a `tracker.test.ts` equal to C6 (sha256 `9830842c…0221`). `fail-before.log` (sha256 `0f465f7b…4611`) shows exactly U1 `expected [] to deeply equal [2 docs]` and U2 `expected undefined to be '1'`. These are assertion failures, not import or setup errors. The other 12 cases were filtered skips of that targeted run only. Manifest `artifact-manifest.json` sha256 `15aefd6d12bcf929a95ae32611234539cf0060d0adb04e00ac0c8babff999cc7`; all files 0600, folders 0700.
- U3, U4, U5 (two cases), the `about:blank` case and the same-origin case cover the `pagehide` hook, one attach, the 5 s bounds, the fallback restart and `stop()`. The existing AC-T5-36 unit case keeps its title and its claim.
- These units prove the mechanism in jsdom. They do not prove browser timing. Runtime proof stays with the legacy window (AC-T5-36, 60 s deadline) and the Canvas browser rows.

### 3.4 Build and check evidence (sealed QA, PRIMARY)

- `t5b-stage1/MANIFEST-t5b-stage1.sha256` sha256 `462c4ddc9c39940d06edfd2b0e5c6347340de9e2dce5db6e279b0dc2d2459932`, and `t5b-stage2/MANIFEST-t5b-stage2.sha256` sha256 `1ce3650151779f12e61a1b8e7a8a9b5598d1c024740f452c229ae22399997e82`. Every listed entry verifies (`shasum -c`: all OK).
- The QA clones are at C4 (`t5b-stage1/c4-baseline-clone`) and C7 (`t5b-stage2/c7-candidate-clone`, clean).
- V2: `04b-c4-vs-c6c7-dist.diff` shows only `dist/runtime.js` changed (`4a599a13…`, 15,846 B → `ee36a830…`, 16,662 B). `runtime.css` and `shell.js` are byte-identical. A repeat build at each revision gives the same hashes. The C6 `runtime.js` equals the author's build.
- `08-c6c7-root-check.log`: lint and all typechecks pass; Vitest 70 files, 1,136 tests passed; infra 111 tests, 0 fail, 0 skipped, 0 cancelled; `EXIT_CODE=0`. `07-c7-tests-typecheck.log`: exit 0. `09-c7-test-titles-check.txt`: T6 (4) and T8 (5) titles identical.

## 4. R2 review (C7)

- The diff is exactly two added lines and no other change: `T6/3-courses.spec.ts:132` and `T8/2-shell.spec.ts:34`. Both lines are identical to plan §4.2.
- No timeout argument, retry or `test.slow`. `expect` is the plain Playwright export (`tests/acceptance/lib/pw.ts:3`). The acceptance config sets `expect.timeout` to 15,000 ms and `retries: 0` (`tests/playwright.config.ts:19,22`). AC-T6-07 keeps `test.setTimeout(120_000)`.
- Every assertion, title, test ID and C5 label stays (the T6 opener label at line 129 is unchanged; `5-xss-a11y.spec.ts` is unchanged). T5b is unchanged, so AC-T5-36 keeps its 60 s deadline.
- The T6 wait is meaningful: the static dialog text (`PublishDialog.tsx:76-82`) has no "Dev Moodle". So the wait passes only after the list renders, and the negative check at line 135 reads a loaded list. The T8 wait uses `hasText` (substring, any case), but the strict `startsWith` check on the next line still decides the result. So the wait cannot cause a false pass.
- R2 has no finding.

## 5. Launcher v3 review (frozen, review only)

Files in `V3=/Users/quangnguyen/cogniate-qa-runs/qa-common-c6-v3-20261022T1340Z/tools`:

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `launch-legacy-c5-v2.sh` (approved baseline) | 10,091 | `c53203a2b16e2c47298fea0a6b1c466840689e2ba5352b27f5037937e596ed67` |
| `launch-legacy-c6-v3.sh` | 12,017 | `7e161c4283e732bdf7791fed7ebcb67c68797b2f070c90fe90d65f1547ec80e8` |
| `launch-canvas-sim-c6-v3.sh` | 12,159 | `2e545b8bf1089fa4a002eedb24637512d580d1e0e2d882e5a508c0b41988600b` |

- I made my own `diff` of v2 → legacy v3 → Canvas v3. It agrees with `prep/02a`, `02b` and `02c`.
- Legacy v3 changes only these items: comments; the routing tuple `task_6bc986323143`/`ctx_c5acede76614` (line 15); the SHA pins for C6/C7; the C7 tests-tree pin (line 28); the path whitelists (lines 31–38); and the gate and log text.
- The whitelists match the identity rule: four exact paths C4→C6 outside `docs`/`tests` (line 31); two R1 paths after excluding the two READMEs (line 32); both READMEs equal 958ee5c (line 33); C6 = C7 outside `docs`/`tests` (line 34); two R2 paths for C5→C7 and C6→C7 (lines 35–36); three paths for C4→C5 and C4→C7 (lines 37–38).
- Each check fails closed. A git error gives empty or non-zero output, so `blocked` runs. The order of the expected path lists matches git's byte order.
- Canvas v3 differs from legacy v3 only in comments, the gate and log text, and `CMD` (line 67: `--phase sim --provider canvas`).
- These items have no diff line: ancestor check; W1 wake; W2 liveness; W3 boundary; the sampler, secret-watch and clone-guard observers; the child-only `umask 022` (line 95); one runner invocation with no retry; W4 end capture and strict compare; secret scan.
- All 33 inherited tool files are byte-identical to the qualified v2 `M/tools` (I compared every `*.mjs` and `*.sh`). Retries: `tests/playwright.config.ts:22` sets `retries: 0`. `run-m1.mjs` has no retry path. `verifyResults` fails closed if a selected case is missing.
- `V3/c7-src/source`: HEAD C7, tests tree `3e9368bb…`, clean, not shallow, no `.env`. C4, C5, C6 and 958ee5c exist in the clone. `tests/host/artifacts/` is git-ignored (`tests/.gitignore:4`), so later launches on the same clone still pass the clean check.
- `evidence-index-v3-prep.tsv` (sha256 `1edc3208…9114`): I re-hashed all 51 entries; all match in size and hash.
- Note: `prep/14-focused-guard-checks-v3.txt` reports `ALL_14_SOURCE_AND_TOOL_GUARDS=PASS`, but the harness that ran it is not preserved. I could not check what the "14" counts. My own reading of lines 25–40 replaces it for review.

## 6. E-T5R selection and evidence boundary

Inputs: `REPORT-R2-FEASIBILITY-CORRECTED.md` (sha256 `f1d35e6a…e73e`, the same bytes in `M/r2-feasibility-20261022T1300Z` and `V3/report`). `evidence-index-corrected.tsv` (sha256 `8ebb27ba…a211`): I re-hashed all 29 entries; all match. I checked the claims against raw logs, not the prose.

- Only `/_rt/assets/:file` on the content host serves `runtime.js` (`services/cogniate-app/src/content-host/server.ts:92,223-232`). The app host serves only `/_player/shell.js` (`tool-pages/play.ts:86-89`), and `shell.js` is byte-identical. So a `/_rt/assets/` request in a row's window is the complete reach test for R1.
- Full2 content logs (my own count): `/_rt/assets/` lines are 8 per round in sim (07-14-45 and 08-06-26), 4 per round in migration (07-41-19 and 08-32-52), and 0 in both snapshot phases. The storage counts come from QA's overview JSON (0). The sim lines are 271, 272, 276, 277, 281, 282, 289, 290, all `GET … 200`.
- Sim: 6 fetches per round fall inside `M1-14`, `M1-22` and `M1-40.c` windows. 2 fall between the end of `M1-09.canvas.browser-top-level` and the start of `M1-09.canvas.browser-framed`. Both are browser rows, so the attribution does not change the selection. The API window has 0 fetches.
- Migration: all 4 fetches are in the old-revision step `13-migration-moodle-baseline`. In both rounds, `cmd/11-stack-up-old.log:17` shows "Building the player (apps/player/dist)." after the checkout of `b0b83a8`. So the old build was served, not candidate code. The candidate window (cmd 18–27) has 0 fetches.
- `tests/acceptance/M1` has only two Playwright spec files, both Canvas. They hold the 7 browser rows (`70-canvas-browser.spec.ts:19,32,49,66,80,103`; `99-canvas-secrets.spec.ts:15`). QA's raw `12-u3-m1-runner-selection.json` (sha256 `bf3b787b…a0a5`) gives `canvasSimCount = 258`, `allSimCount = 394` and `allFullCount = 488`. I did not recompute 258 by running the manifest code.

Result: the proposed route (two `--phase sim --provider canvas` runs of 258 cases each, distinct roots) includes every M1 row whose full2 window fetched `runtime.js` from candidate code. I find no missed row.

Boundaries the Lead must keep (no new-candidate result is inferred):
1. E-T5R is the Lead's exception to AC-M1-01. This review confirms only that the mapping is complete. It does not accept E-T5R.
2. The 251 non-browser rows that both C6 runs repeat must use their C6 results. A C6 failure of any of the 258 rows, or a different result between the two C6 runs, voids E-T5R (plan §5.4 item 3). C4 results never stand in for them.
3. The failed C4/C5 legacy attempt and earlier T5b/T6/M2/T7 passes fill no C6 row.

## 7. Findings

### B-M3TR-01 — MINOR — `apps/player/src/html/tracker.ts:124,157-176,188-189`

Problem: the `watched` Map holds a strong reference to every child document seen, with its listener closures, for the life of the runtime page.
Evidence: C4 kept only a WeakSet (`done`). The plan said "keep the WeakSet". `main.ts:66` discards the `stop` function, so in production entries are never removed. Each navigation adds one detached document (the fixture pages are 635–654 KB of HTML). A replaced document can also keep its old window and script objects alive through its own listeners. Memory grows with the number of navigations in one learner session, not with the number of pages. I did not measure it (no browser run).
Fix (bounded, R1 files only): keep one record for the current document only. When `check` sees a new document, remove the old document's `DOMContentLoaded` listener and drop the record (keep the `done` WeakSet). `stop()` then cleans only the current record. Add one unit assertion: after A→B, A's `DOMContentLoaded` listener is removed. This is cheapest before any runtime window opens, because any product change makes a new candidate and resets V1/V2 and these reviews. If the Lead defers it, add it to `docs/human_review/deferred.md`.

### B-M3TR-02 — MINOR — `apps/player/src/html/tracker.test.ts:206,241-242`; `tracker.ts:166,172`

Problem: the test double gives each document its own window object, but a browser gives one WindowProxy for the frame. So the tests prove a `pagehide` cleanup that `stop()` cannot do in a browser.
Evidence: `frame.contentWindow` returns the same WindowProxy across navigations. `win.removeEventListener('pagehide', …)` acts on the current Window only. After A→B, `stop()` cannot reach A's old Window. The test still asserts `a.win.listenerCount('pagehide') === 0` (line 241), and the author report says `stop` clears "window listeners". Behavior is safe: a replaced Window fires `pagehide` only once, before the replacement, and `stopped` (`tracker.ts:136,143`) makes any leftover hook a no-op. So I do not rate this a failed required control.
Fix: add one comment in `watchFrame` that `win` is a WindowProxy and why leftover hooks are inert. Change the line 241 claim to what the browser does: the current window's hook is removed, and an old hook does nothing after `stop()` (lines 245–251 already assert this). The B-M3TR-01 fix (one current record) makes the test model true without other changes.

### B-M3TR-03 — NIT — `apps/player/src/html/tracker.ts:116-120`

Problem: the docblock does not state the residuals that a maintainer needs.
Evidence: the plan and the author report record them. (1) No guarantee for a document that appears and is replaced between two checks. (2) After 5 s with no new document, discovery uses the 150 ms poll only. This includes a first package document that arrives more than 5 s after `watchFrame` starts (slow first response). (3) An answer before parse does not count.
Fix: two comment lines. Do this only together with another R1 change.

### B-M3TR-04 — MINOR (evidence; owner QA) — `/Users/quangnguyen/cogniate-canvas-qa-runs/verification-bf09cda-Kb7OPU3d/t5b-stage2/02-git-provenance-and-diffs.txt:15-17`

Problem: the sealed V1 provenance file lists two paths under "Non-doc/non-test diff C4..C6", but the true set has four paths.
Evidence: it omits `README.md` and `infra/README.md`, and it records no command or pathspec. This is against the Lead's exact-four-path rule ("no other root/infra path is exempt"). QA's own `V3/prep/11-source-checks-c7.txt` and the corrected report §5 list the correct four paths. Launcher line 31 enforces them at launch. So the identity holds; only this record is wrong.
Fix: QA appends a disclosed correction (a new file and a manifest append; the sealed file stays unchanged) with the exact command and its four-path output. Until then, do not cite lines 15–17 as the V1 four-path binding. Cite `prep/11` or the correction.

### B-M3TR-05 — MINOR — `V3/tools/launch-canvas-sim-c6-v3.sh:19-23,105` (the same lines are in legacy v3 and v2)

Problem: the launcher accepts a run root that already exists. The Canvas launcher is meant to run twice, so a reused root now matters.
Evidence: in a reused root, the STOP files of the earlier run already exist: `public/sampler/STOP`, `private/watch/STOP` and `public/clone-guard.json.STOP` (line 105). All three observers then end at once (`docker-sampler.mjs:62`, `secret-watch.mjs:59`, `clone-guard.mjs:150`). W4 compare still passes, because one final sample meets `samples > 0` (`live-boundary-core.mjs:119-123`). New phase clone roots then get no 0700 sweep. Also, `blocked()` and the W1–W4 outputs overwrite the earlier run's records. The held commands in `prep/READY-C6-C7-V3.md` §4 use distinct roots (`legacy-c6`, `canvas-sim-c6-r1`, `canvas-sim-c6-r2`). That avoids the problem if the operator follows them exactly.
Fix (choose one): (a) No launcher change. Each runtime grant names its exact new root. QA records `test ! -e <root>` just before each launch. After each run, QA checks that the sampler sample count fits the run length (about one sample per 15 s) and that clone-guard and secret-watch ran to the end. (b) With a separate explicit grant, add one fail-closed line before line 19 in both v3 launchers: `[[ ! -e "$ROOT" ]] || { echo "BLOCKED: run root exists: $ROOT" >&2; exit 2; }`. A reviewer then checks that one-line diff.

### B-M3TR-06 — NIT — `V3/tools/launch-canvas-sim-c6-v3.sh:2`

Problem: the header calls the Canvas SIM launcher a "Common/Blackboard QA launcher".
Fix: none now (a change alters the frozen hash). Name it correctly if the launcher changes for another reason.

### B-M3TR-07 — NIT (evidence prose; owner QA) — `REPORT-R2-FEASIBILITY-CORRECTED.md` §1.3 item 3

Problem: two line citations are wrong.
Evidence: the report says AC-T6-07 is "declared at line 122". QA's own inventories (`03-before-t6-t8-titles.txt:16`, `07-after-t6-t8-titles.txt:16`) and the C7 file give line 125. The report says `openPublishDialog` spans "lines 28–39"; in C7 it spans lines 26–39 (docblock at line 25). No decision depends on these numbers.
Fix: a disclosed one-line correction append. Do not cite these two numbers.

## 8. Observations (no finding)

- Trace retention: the Lead decided "no trace-retention hook". `tests/host/core.mjs:343-354` keeps only `json/jsonl/log/txt`, and a later group clears the Playwright output. If AC-T5-36 fails again on C6, its trace and screenshot will again be lost (plan §2.5). This is an accepted diagnostic risk.
- Commit bodies are not logged. So a field failure still cannot show which fact was lost (plan §8 U1). This is out of R1 scope (no transport or service change). It is a candidate for the backlog.
- `t5b-stage1/10-a-si-05-b-si-09-evidence-map.json` is about storage evidence (A-SI-05/B-SI-09), not R1/R2. Many of its samples have `sha256: null`. I did not review it, and this review does not credit it.

## 9. Missing evidence and pending items

- No browser or runtime evidence on C6/C7 yet: the legacy window (V4, including AC-T5-36 with its 60 s deadline, T6, T8), the Canvas SIM runs ×2 with Canvas QA judgment (V5), M2 (V6), T7 (V7) and the Architect conformance (V8).
- The exact lost fact of the C4 failure stays inferred. The trace is lost; `11-u2-trace-search.json` reports 0 surviving traces.
- I took the 258 count from QA's raw JSON plus my spec-file check. I did not run the coverage code.
- The `ALL_14` guard harness of `prep/14` is not preserved (§5).

## 10. Verdict by item

| Item | Verdict |
| --- | --- |
| R1 source (C6) | APPROVE. MINOR B-M3TR-01 and B-M3TR-02 are recommended now, else deferred. NIT B-M3TR-03. |
| R2 tests (C7) | APPROVE, no finding |
| Launcher legacy v3 `7e161c42…` | APPROVE |
| Launcher Canvas SIM v3 `2e545b8b…` | APPROVE with B-M3TR-05 option (a) or (b) as a grant condition; NIT B-M3TR-06 |
| E-T5R mapping evidence | Complete for the R1 reach test; acceptance stays with the Lead; B-M3TR-07 prose only |
| QA evidence records | B-M3TR-04 correction needed before V1 citation |
| Runtime acceptance | PENDING (not reviewed, not run) |
