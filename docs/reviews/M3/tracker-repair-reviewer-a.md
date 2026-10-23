# M3 tracker repair: Reviewer-A (lens A, "is it right and is it safe?")

Verdict: APPROVE for the R1 source (C6) and the R2 test delta (C7). PROVISIONAL: launcher v3 is not reviewed (no handoff).
Round: 1
Open condition: A-TR-03 (MAJOR, evidence route only). It needs no source or test change. It must close before the Lead uses any E-T5R selection.

Reviewer: Claude Opus 5.5 xhigh, Reviewer-A. Task task_63102d6ad7f5, dispatch ctx_38fbe94ea973, run run_ebe671ad72a9.
Date: 2026-10-22. Review work 13:20–13:45 UTC.
Independence: I did not read the other reviewer's report or any other repair review. I did not read Common QA's `REPORT-R2-FEASIBILITY.md` (the Lead flagged its prose). I did not read the moving working-tree test files. I read tests only as git objects at C5 and C7.
Scope limits: no Docker, no browser, no install, no product/test/guide edit, no commit, no push. I did not run the runtime. I ran unit-level Vitest probes in a private scratch root (§4.3). All 32 real-LMS rows stay UNVERIFIED. Local Canvas stays DEFERRED.

## 1. Identities reviewed

| Item | Identity | Check |
| --- | --- | --- |
| Failure plan | c80a59fa7153949f1994cf9d0633c8ab7f094f7d, `docs/reviews/M3/t5b-failure-plan.md` SHA-256 b47dcbb7832d9718eba6e9c4f00179c4bb8b38fede3dcd799cf58170ae709eaf | Read in full. Lead decisions D1–D6 at 90274c0 (`docs/team/multi-lms-plan.md:24-30`). |
| Source C4 | bf09cdad91ca548e1ecbc14428b55180d35d5360 | `tracker.ts` SHA-256 0a315e85…d169 |
| Tests C5 | e1a057be9624a82949007b772e2bdf19bc55638b, tests tree 9e57d42f9e4cfe82b8058681ba6a81396abd2acc | C6 tests tree is the same tree. |
| Product C6 (R1) | 4008afb92fe983d52db33442e060210b929966c8 | Ancestors C4 and C5 confirmed. |
| `apps/player/src/html/tracker.ts` at C6 | SHA-256 4636a1fed329321030580d457c0da4246edda1402f7c883109a6667899155f5d, blob c313e2a4 | Matches the held hash. Working tree identical. |
| `apps/player/src/html/tracker.test.ts` at C6 | SHA-256 9830842c6977025c89e8542da8927b857dbde11b940dfc2d3b55766edf140221, blob 75df840e | Matches the held hash. Working tree identical. |
| `apps/player/src/runtime/main.ts` | SHA-256 2d2e2d63…8f92 at C4, C6 and in the working tree | Unchanged, as required. |
| Tests C7 (R2) | 620c03d0697c72b80649d2e77a52594ad0d282f3, tests tree 3e9368bb61d02c2cc6c3838b4aaeaedd28fffd71 | C6 is an ancestor. C6→C7 outside `docs/**`: only the two R2 files. |
| `tests/acceptance/T6/3-courses.spec.ts` at C7 | SHA-256 131615a09e75d5fc4d399136682ffa2f0b744281725eff93cc207af7a306dd37 | Matches the Lead's handoff (msg_f6b12ba2f6f5). |
| `tests/acceptance/T8/2-shell.spec.ts` at C7 | SHA-256 9e55d8492308cb6b0ca01aa53d312ad8417d76973aa2c50853cff7f93124a399 | Matches the Lead's handoff. |
| Author fail-before log | `/Users/quangnguyen/cogniate-repair-runs/r1-watchframe-20261022-zng43k_7/fail-before.log` SHA-256 0f465f7be3508c889851e857d119243530c6db75c3b59270860600e85a124611 | Matches. Read only. |
| Author fail-before identity | `fail-before-identity.json` SHA-256 2635c41da0273fc51f92c37c7a7c970af62105127367042680727abfa63c0602 | Matches. It binds C4 `tracker.ts` and the C6 test file. |
| Author patch | `r1.patch` SHA-256 67c361c7…f1b8 | Byte-identical to my `git diff C4 C6 -- apps/player/src/html`. |

C4→C6 outside `docs/**` and `tests/**` has **four** paths, not two: the two R1 paths, `README.md` and `infra/README.md`. See A-TR-03.

## 2. Verdict by item

| Item | Verdict | Open findings |
| --- | --- | --- |
| R1 source and units (C6) | APPROVE | A-TR-01 MINOR, A-TR-02 MINOR, A-TR-04 NIT |
| R2 test delta (C7) | APPROVE | none |
| E-T5R selection and identity boundary | CHANGES_REQUESTED (Lead/QA, no code change) | A-TR-03 MAJOR |
| Launcher v3 | NOT REVIEWED (pending the Lead's immutable handoff) | — |
| Runtime acceptance (V2, V4–V8) | NOT JUDGED here | — |

Source approval is not runtime acceptance. It fills no acceptance row. The C4/C5 legacy attempt stays FAILED. No C4 pass fills a C6/C7 row.

## 3. R1 source review (C6 `tracker.ts`)

The diff changes only `watchFrame` and its comment (`tracker.ts:116-191`). `createHtmlTracker` (`tracker.ts:27-114`) is byte-identical to C4. So every HTML rule is unchanged: menu seen on visit (`:68`), 10 s visible dwell plus scroll with 24 px slack (`:70-110`), first answer stands (`:61`), internal-link `target`/`rel` removal (`:51-56`), saved progress and null-prototype answers (`:31-41`).

| R1 MUST (plan §4.1) | Result | Evidence |
| --- | --- | --- |
| 1. A loading document gets one `DOMContentLoaded` listener; attach at once; at most once per document | Met | `:167` adds the listener only when `readyState === 'loading'`. `watched` (`:157-176`) makes one hook set per document. `done` WeakSet (`:123`, `:160-161`) is set before `attach`. The listener removes itself (`:162`). |
| 2. Fast check (10 ms, runtime window timer) at start and on `pagehide` of each seen child; hook at first sight, also while loading; stop on a new document or after 5 s | Met as written | `:135-141` uses `runtimeWin.setInterval(check, 10)` and a 5 s `runtimeWin.setTimeout`. `:181` starts it. `:166` hooks `pagehide` at first sight, before the loading check. `:153-156` stops it when a different non-blank document appears. See A-TR-01 for the `pagehide` precondition. |
| 3. Keep the 150 ms poll, frame `load`, `about:blank` exclusion and same-origin `try/catch`; `stop()` clears every timer and listener | Met for every reachable timer and listener | `:180`, `:179`, `:149`, `:146-152`. `stop()` (`:183-190`) sets `stopped`, clears the fast interval, the deadline and the poll, removes the frame `load` listener, removes each document's `DOMContentLoaded` listener, and removes `pagehide` from the current window. See A-TR-04 for windows that already navigated away. |
| 4. No HTML rule change | Met | Byte-identical `createHtmlTracker`. |
| 5. No other change | Met for source | No change to `main.ts`, transport, commit body, `seq`, SCORM, content host, CSP, services or dependencies. The C4→C6 product-tree diff under `apps/`, `services/`, `packages/` is the two R1 paths. The build output claim (only `runtime.js`) is QA's V2, not verified here. |

Other lens-A checks:

- **Same-origin boundary.** `contentDocument`, `contentWindow` and `doc.URL` are read inside the `try` (`:146-152`). A cross-origin frame gives `contentDocument === null`, so `check()` returns. Later reads (`readyState`, `body`, `addEventListener`) touch only a document that was same-origin at first sight. This matches C4. No new cross-origin access, no package byte change, no injection.
- **Hostile or odd package events.** A package can dispatch a synthetic `pagehide`. That only restarts one bounded 5 s, 10 ms check. A synthetic `DOMContentLoaded` while loading is ignored by the `readyState` test (`:160`). Package code already shares the origin by design (ADR-004), so this is no new exposure.
- **Timers.** All new timers use the runtime window (`frame.ownerDocument.defaultView`), so child navigation does not cancel them. `startFastCheck` clears the old pair first, so at most one fast interval exists. In production, `runtime.js` runs in that same window, so this equals the global timers.
- **Background tabs.** The `DOMContentLoaded` path is event-driven. Timer throttling in a hidden tab does not delay it. This is a real improvement over C4 for the parse-time attach.
- **Data integrity.** One attach per document keeps one set of answer listeners, so no double answer or double `seen` event. Transport and commit content are unchanged.
- **Exceptions.** `done.add` precedes `attach`, as in C4. An exception in `attach` cannot cause a second attach.

## 4. Unit coverage and fail-before

### 4.1 Author evidence (used as author evidence only)

The author ran the C6 test file against exact C4 `tracker.ts` in a private scratch folder with `-t 'U[12]:'`. Result: 2 failed, 12 filtered. U1 failed at `tracker.test.ts:153` (zero attaches instead of `[A, B]`). U2 failed at `:166` (`undefined` instead of `'1'`). The log and identity hashes match §1. The 12 skips are the deliberate filter, not a skipped self-check.

### 4.2 Causal coverage of U1 and U2

- **U2** (`tracker.test.ts:159-169`) proves the answer variant: a click right after `DOMContentLoaded`, with no timer advance, counts. It depends only on the `DOMContentLoaded` hook.
- **U1** (`:142-157`) proves the inferred lost fact: the menu is attached and recorded at `DOMContentLoaded` (`a.parsed()`, `:149`), before any poll. This part does not depend on `pagehide`. The second half (B attached at 10 ms) depends on the synthetic `a.win.fire('pagehide')` at `:150`. A was never loaded in this case. See A-TR-01.
- **U3–U5**, the `about:blank` case and the same-origin case cover the fast check, one attach per document, the 5 s bound and cleanup. The original "attach when interactive without load" case is kept (`:128-140`) and now runs on the real `watchedPage` helper.

### 4.3 My independent unit probes (private scratch, not acceptance)

Root `/Users/quangnguyen/cogniate-review-runs/r1-reviewer-a-20261022-n4UUIT` (0700; files 0600). Each variant has `tracker.ts` from a git object, the C6 test file, the C6 `vitest.config.ts`, and symlinks to the repository's existing `vitest` and `jsdom`. Nothing was installed. Command per variant: `node <repo>/node_modules/vitest/vitest.mjs run --config vitest.config.ts --reporter=json`.

| Variant | Result | Tests that detect it |
| --- | --- | --- |
| C6 base + my 3 probes | 17/17 pass, 0 skip | — |
| C4 `tracker.ts` (full file, no filter) | 6 pass, 8 fail | All 8 new cases fail; the 6 old cases pass |
| m01 no `DOMContentLoaded` hook | detected | U1, U2, U3, U4, about:blank |
| m02 no `pagehide` hook | detected | U1, U3, U4 |
| m03 no stop on a new document | detected | U3 |
| m04 no 5 s deadline | detected | both U5 |
| m05 `stop()` keeps hooks | detected | U4, U5 |
| m06 no `done` check | detected | interactive-without-load, U4 |
| m08 no fast check at start | detected | U5, about:blank, same-origin |
| m10 fast interval 150 ms | detected | U1, U3, about:blank, same-origin |
| m11 no `about:blank` exclusion | detected | about:blank |
| m12 no `catch` | detected | same-origin |
| m07 fast interval on the global timer | NOT DETECTED | Same behavior in production (global = runtime window). A child-window timer would throw on the mock and be detected. No finding. |
| m09 no `stopped` test in `tryAttach` | NOT DETECTED | Redundant guard: `stop()` removes every `DOMContentLoaded` hook and `check()` returns when stopped. I found no reachable path. No finding. |

Probes P1–P3 (in `variants/base/apps/player/src/html/probe.test.ts`) use the browser event model of A-TR-01 and A-TR-04. All three pass on C6, so they confirm the described behavior.

## 5. Findings

### A-TR-01 — MINOR — the navigation fast check needs a `pagehide` that a never-loaded document does not get

- **Where:** `apps/player/src/html/tracker.ts:135-141`, `:153-156`, `:166`; `apps/player/src/html/tracker.test.ts:150` (U1) and `:179` (U3).
- **Problem:** After the first document is seen, the fast check restarts only on a child `pagehide`. In the WHATWG HTML standard, "unload a document" fires `pagehide` only if the document's *page showing* flag is true (step 10). "The end" sets *page showing* to true only in the task that fires `load`, after the parser waits until nothing delays the load event (steps 8–9.10). AC-T5-36 hangs S3 images and Google fonts, so `load` never fires and *page showing* stays false. So, per the standard, the menu document gets no `pagehide`. In this condition the post-navigation fast check never starts. The next document is found only by the 150 ms poll. The `DOMContentLoaded` hook helps only if that poll sees the document while it is still loading.
- **Evidence:** Spec text: html.spec.whatwg.org, document-lifecycle "unload a document" step 10, and parsing "The end" steps 8–9.11 (read 2026-10-22). U1 and U3 fire a synthetic `pagehide` on a document that never loaded. Probe P1: with no `pagehide`, B is attached at 150 ms, not 10 ms. Probe P2: with no `pagehide`, a click on parsed document B 20 ms after it replaces A is lost. I could not check Chromium's own unload path offline (the source fetch was rate-limited). A Chromium `beforeunload` step may change this, so the real behavior is UNVERIFIED either way. jsdom cannot show it.
- **Impact:** R1 still closes the inferred AC-T5-36 cause. The first document (the menu) is covered by the 5 s start-up fast check and by the `DOMContentLoaded` hook. Neither needs `pagehide`. The residual is limited to second and later documents in a hanging-host session: a fact (an answer, or a menu reached later) given within one 150 ms poll after a page is parsed. Human learners rarely act that fast. In the test, the lesson answer comes about 300 ms after the lesson request (plan §2.1). So this is not a likely failure, and no frozen MUST fails: rule 2 and U3 are implemented as written.
- **Bounded fix (Lead chooses one):**
  (a) No code change. Record the residual: "the post-`pagehide` fast check covers documents that reached `load`; for a never-loaded document, the next document relies on the 150 ms poll and on `DOMContentLoaded` when that poll sees it loading." Keep this text in the Architect delta (plan §4.3, D6) and in the Author residuals. Do not write "after each child pagehide, it checks …" without that limit.
  (b) Small code change, with a new Lead grant because it changes rule 2: in `check()`, when a new document is seen, restart the 5 s fast check instead of stopping it if that document's `readyState` is not `complete` (or restart it after `attach` while not `complete`). Add a unit case with no synthetic `pagehide` (like P1) that expects B within 20 ms. In U1, either drop the synthetic `pagehide` or note that it models a loaded document.

### A-TR-02 — MINOR — `watched` keeps every observed document alive for the whole session

- **Where:** `apps/player/src/html/tracker.ts:124`, `:157-176`; `apps/player/src/runtime/main.ts:66`.
- **Problem:** `watched` is a strong `Map<Document, …>`. Its values close over `doc` and `win`. Entries are removed only in `stop()`. Production never calls `stop()`: `main.ts:66` drops the return value. So every package document that the runtime sees stays in memory until the runtime page closes. C4 used only a `WeakSet` and kept no document.
- **Evidence:** Static reading of the lines above. Each navigation adds one entry. The test package pages are about 635–654 KB of HTML each (plan §2.1). A learner who moves between pages many times keeps all those documents (DOM, and through the document its old window state).
- **Impact:** Memory grows with each navigation in one attempt. It is not a wrong result and not a likely failure for normal course sizes. It is a new lifecycle regression against C4.
- **Bounded fix:** When `check()` sees a different document, remove the previous document's `DOMContentLoaded` hook and delete its `watched` entry. Do not call its `pagehide` removal through the window proxy at that point (it would target the new window). Or keep hooks in a `WeakMap` and keep only the current document's hooks for `stop()`. Keep `done` as a `WeakSet`. Add one unit assertion that only the current document has hooks after a navigation.

### A-TR-03 — MAJOR (evidence route only) — the C6 identity rule is not literally met; two changed prose files need an explicit rule

- **Where:** plan `docs/reviews/M3/t5b-failure-plan.md:162` ("Outside `docs/**` and `tests/**`, its diff from C4 must be exactly the R1 paths") and `:198` (E-T5R item 1); Lead D4 at `docs/team/multi-lms-plan.md:28` ("independent QA proves exact R1 paths … Any other product change … voids this exception").
- **Problem:** `git diff --name-status C4 C6 -- . ':!docs' ':!tests'` lists four paths: `README.md`, `apps/player/src/html/tracker.test.ts`, `apps/player/src/html/tracker.ts`, `infra/README.md`. The two README files changed in M4 guide commits fd87bf7, f185260 and 958ee5c (the `infra/README.md` row grant is msg_ddbd419caeff). `infra/` is in the product-owned tree. `infra/README.md` is also a declared test input: `tests/host/run-t1.mjs:628-647` (LC-T1-05) parses its command table. The author's identity check covered only `apps/`, `services/` and `packages/`.
- **Evidence:** `notes/c4-c6-nondocs-nontests.txt` in my root. `git grep` at C6: `run-t1.mjs` is a standalone T1 runner (`tests/package.json` script `host:t1`). `tests/host/core.mjs:2-3` says the shared core keeps its own copy, so I found no M1 or legacy path that reads `infra/README.md`. I did not prove this for every runner.
- **Impact:** If QA applies the literal rule, E-T5R item 1 fails and D4 requires the strict route. If QA narrows the rule silently to `apps/services/packages`, a changed test input escapes the row selection. Either way the outcome depends on an unstated interpretation. This does not affect the R1 source verdict or the strict route.
- **Bounded fix:** Before any E-T5R use, the Lead states the C6 identity rule as: "C4→C6 outside `docs/**` and `tests/**` = the two R1 paths plus `README.md` and `infra/README.md` (prose only, from fd87bf7/f185260/958ee5c under the Docs grants)". QA's V1 binding lists all four paths with blob hashes. QA proves that no row carried from C4 reads either README file (LC-T1-05 is the known reader). Any such row joins the rerun selection. If the Lead does not accept this, use the strict route.

### A-TR-04 — NIT — `stop()` cannot reach `pagehide` hooks on windows that already navigated away

- **Where:** `apps/player/src/html/tracker.ts:166`, `:170-173`, `:188`; `apps/player/src/html/tracker.test.ts:241-242`.
- **Problem:** In a browser, `frame.contentWindow` is one WindowProxy for all documents of the frame. `win.addEventListener('pagehide', …)` registers on the window of the current document. In `stop()`, every `win.removeEventListener` goes to the window that is current at `stop()` time. A `pagehide` hook on an earlier window stays there. The unit mocks give each document its own window object, so U5 shows `a.win` with zero hooks, which a browser would not show.
- **Evidence:** Probe P3 models one shared proxy: after A→B and `stop()`, A's window keeps one inert hook, B's has none, firing A's `pagehide` creates no timer, and attach count stays 2.
- **Impact:** None observable. The earlier window is not active. The hook returns at once (`if (stopped) return;`, `:136`). Production never calls `stop()`. No implementation can reach a navigated-away window to remove the hook. So this is not a failing MUST 3 in intent. It is a limit of the claim "stop() clears every listener".
- **Bounded fix:** State the limit in the Author residual or the Architect delta: "`stop()` removes hooks from the current window and every observed document; hooks on navigated-away windows are unreachable and inert." Optionally register with `{ once: true }`, so a hook that fires also removes itself. Optionally add a shared-proxy case like P3.

## 6. R2 review (C7)

`git diff C5 C7 -- tests` has exactly two added lines and no other change:

- `tests/acceptance/T6/3-courses.spec.ts:132` (after the original line 131): `await expect(dialog, 'the registered/connected connection').toContainText('Dev Moodle');`
- `tests/acceptance/T8/2-shell.spec.ts:34` (after the original line 33): `await expect(select.locator('option', { hasText: \`${conn.json.name} (Moodle, \` }).first()).toBeAttached();`

Both lines are byte-for-byte the plan §4.2 text. Checks:

- **Timeout and retry.** No timeout argument, no retry, no `test.slow`. `tests/playwright.config.ts` sets `expect: { timeout: 15_000 }` and `retries: 0`. Both specs import `expect` from `../lib/pw`, which re-exports Playwright's `expect`.
- **Unchanged assertions.** The old lines 132–134 (T6) and 34–36 (T8) are unchanged and now follow the wait. Titles, test IDs and the C5 opener label (`T6/3-courses.spec.ts:129`) are unchanged. No T5b file changed, so AC-T5-36 keeps its 60 s deadline and all three assertions.
- **The wait is meaningful (T6).** At C7, `apps/portal/src/courses/PublishDialog.tsx:76-115` renders static text ("Publish to an LMS", course title, "LMS connection", "Choose a connection", version labels) and `Loading…` until `/connections` returns. Then it renders all ready options in one render (`:110-114`). The T6 course title is `QA UI SCORM <runId>` (`3-courses.spec.ts:57`), and the pending connection is `QA pending <runId>` (`T6/0-setup.spec.ts:44`). So "Dev Moodle" appears only after the list renders, and the negative check at the old line 134 now reads a loaded list.
- **The wait is meaningful (T8).** Options come from the same single render. `hasText` is a case-insensitive substring match. That cannot pass early, because no option exists before the list renders. The following `evaluateAll` keeps its stricter `startsWith` check.
- **No hidden weakening.** If the list never loads, the wait fails after 15 s. The old code would fail at once. Both are FAIL, with the same assertion message in T6.

I did not run the tests typecheck or title inventory. Those belong to QA (V1).

## 7. E-T5R and evidence boundaries

- Candidate build output and QA evidence are separate inputs. Neither is approval by itself. V2 (only `dist/runtime.js` differs) is not verified here.
- A-TR-03 must close before E-T5R item 1 can pass.
- The selection must include every row whose window loads `/_rt/assets/runtime.js`, SCORM rows too: SCORM sessions load the new file even though they do not run `watchFrame` (plan §5.1).
- The Lead told me not to use the Common QA feasibility prose or its U4 mapping. I did not read it. I make no judgment on the row mapping.
- No C4 pass, no full2 round, and no failed legacy run fills a C6/C7 row before D4's conditions pass. The C4/C5 legacy attempt (7a74d2f) stays FAILED.

## 8. Launcher v3

NOT REVIEWED. The Lead has not handed off an immutable launcher. This review gives no launcher approval. When it arrives, I will check only: identity and path-list deltas against the reviewed v2; any explicit extra grant; no hidden retry, skip or runtime grant; W1–W4, sampler, guard, the strict 32-volume comparison and the scans unchanged.

## 9. Residuals this review does not remove

- An answer given before a page is parsed still does not count (same as C4).
- No observer can promise to see every document. A document that appears, parses and is replaced between two checks is still missed. That window is 10 ms during a fast check, and 150 ms otherwise (A-TR-01).
- If the first package document arrives more than 5 s after `watchFrame` starts, the start-up fast check has ended. The first document then also relies on the 150 ms poll and on `DOMContentLoaded` when that poll sees it loading.
- Chromium's real `pagehide` behavior for a never-loaded subframe document is UNVERIFIED (A-TR-01).
- The runtime result of AC-T5-36 on C6/C7 is unknown until the fresh legacy window (V4) runs.

## 10. Private evidence

Root: `/Users/quangnguyen/cogniate-review-runs/r1-reviewer-a-20261022-n4UUIT` (0700). All 122 listed files are 0600. Every write command used `umask 077`.
Manifest: `MANIFEST-1.tsv` (SHA-256 e120c74738b8385a840104fac0e8da8c6f76bb61dc12c8df1e3547ca51a3d0ce). It lists SHA-256, size, mode and path. It excludes itself and the `node_modules` folders (two symlinks to the repository plus Vitest caches).
Key files: `notes/probe-summary.txt` (6eccb4f1…), `notes/r1-c4-c6.diff` (67c361c7…, equal to the author's `r1.patch`), `notes/r2-c5-c7.diff` (ef9b5206…), `notes/c4-c6-nondocs-nontests.txt` (7b6c0b63…), `bin/setup.mjs` (4f28bc30…), `bin/probe-tail.ts` (1b1b5e4c…), `results/*.json` per variant.

## 11. Disclosures

- D-1: My first read of the empty Orca inbox went to `/tmp/rva_inbox.json` without `umask 077` (born 0644). It held only `{"messages":[],"count":0}`. I deleted it. Later Orca reads used `umask 077`.
- D-2: I read the T6 and T8 specs, `t5.ts`, `pw.ts`, `playwright.config.ts` and `run-t1.mjs` as git objects at C5, C6 or C7 only, never from the working tree.
- D-3: I did not touch the untracked `pnpm-workspace.yaml`.

## Update 1 — 2026-10-22 13:38 UTC: A-TR-03 after the Lead's V1 guard

This section supersedes the A-TR-03 status in the header and in §2. Earlier text stays unchanged.

The Lead's message msg_adb63345c0a7 (13:35:09 UTC) states the V1 rule: the only executable/product changes C4→C6 are `tracker.ts` and `tracker.test.ts`. `README.md` and `infra/README.md` are classified as documentation, bound to guide candidate 958ee5c. No other root, infra or build path is exempt. V2 must still prove that only `dist/runtime.js` changes.

My checks:

- Blob identity: `README.md` = 81310bbe4ecae272a4c44b108ab1b66f62b3fccf and `infra/README.md` = 06b9a8de7dd48945637cff2b42f4779141ceab11 at 958ee5c, C6 and C7. Both match the guide candidate.
- Readers: `git grep README` at C7 outside `docs/**` and `*.md` gives 28 files. Every match is a comment, except `tests/host/run-t1.mjs:114`, `:628-647`. That file reads `infra/README.md` for LC-T1-05. `run-t1.mjs` is the standalone T1 runner (`tests/package.json` script `host:t1`). The M1 core does not use it (`tests/host/core.mjs:2-3`). No code reads the root `README.md`.

Result: the identity part of A-TR-03 is CLOSED by the Lead's explicit rule. One check is left, with no severity: when the launcher v3 is handed off, I confirm that its 12 groups do not run `host:t1` or LC-T1-05. If a carried or selected row reads `infra/README.md`, that row must use C6/C7 evidence. No open MAJOR remains.

Updated item status: R1 source APPROVE; R2 APPROVE; E-T5R identity rule closed (launcher check pending); launcher v3 NOT REVIEWED.

## Stage 2 — 2026-10-22 13:51–13:58 UTC: launcher v3, E-T5R mapping and final verdict

This section supersedes the "PROVISIONAL" and "launcher NOT REVIEWED" statements above. Earlier text stays unchanged.

Authority: the Lead's review-only handoff msg_8c757e68d0f1 (13:50:44 UTC), with msg_adb63345c0a7, msg_399d10bbbd8b and msg_130bf1a0307f for the README rule. I ran no Docker, no runtime and no launcher. I treated `READY-C6-C7-V3.md` and the corrected QA report as explanations and checked their facts against raw files.

### S2.1 Identities checked

| Item | SHA-256 | Result |
| --- | --- | --- |
| `V3/tools/launch-legacy-c6-v3.sh` (12,017 B) | 7e161c4283e732bdf7791fed7ebcb67c68797b2f070c90fe90d65f1547ec80e8 | Matches the handoff. |
| `V3/tools/launch-canvas-sim-c6-v3.sh` (12,159 B) | 2e545b8bf1089fa4a002eedb24637512d580d1e0e2d882e5a508c0b41988600b | Matches the handoff. |
| `V3/tools/launch-legacy-c5-v2.sh` | c53203a2b16e2c47298fea0a6b1c466840689e2ba5352b27f5037937e596ed67 | The approved v2 (Reviewer-A 7f05e1c, Reviewer-B 90016bd). |
| `V3/evidence-index-v3-prep.tsv` | 1edc3208b38cafcb2bbe065d3638f5e0275c09ddf34e42f15aba631d018d9114 | Matches. |
| `V3/report/REPORT-R2-FEASIBILITY-CORRECTED.md` (35,980 B) | f1d35e6a7f665776af089c5a1b1cc8ea7dd60fb7d51d4ac771b28b20524ae73e | Matches. |
| Diffs `prep/02a`, `prep/02c` | — | I recomputed both from the launcher files. The bodies are byte-identical. |
| Helper tools | — | All 33 files in `V3/tools` are byte-identical to the qualified `M/tools`. The only extra files are the two v3 launchers. |
| Independent QA build evidence `t5b-stage2/MANIFEST-t5b-stage2.sha256` | 1ce3650151779f12e61a1b8e7a8a9b5598d1c024740f452c229ae22399997e82 | All 13 entries verify. Only `dist/runtime.js` changes C4→C6/C7 (4a599a13… → ee36a830…). A repeat build gives the same output. Tests typecheck exit 0. T6/T8 titles identical. |

### S2.2 Legacy v3 (`launch-legacy-c6-v3.sh`) against v2

The diff changes only these items:

- **Pins:** product C6 4008afb9…, tests C7 620c03d0…, and a new tests-tree pin 3e9368bb… (guard 4).
- **Path guards** (all exact string or exit-code checks, fail-closed before W1):
  - C4→C6 outside `docs`/`tests` = the four paths.
  - C4→C6 without the two READMEs = the two tracker paths.
  - Both READMEs equal 958ee5c1225addff7dc3d5ea3417b7d17e157bbf.
  - C6 = C7 outside `docs`/`tests`.
  - C5→C7 and C6→C7 tests = the two R2 files.
  - C4→C5 and C4→C7 tests = the three D-T6L/R2 files, so the C5 labels in `T6/5-xss-a11y.spec.ts` are kept.
- **Routing tuple:** `TASK=task_6bc986323143`, `DISPATCH=ctx_c5acede76614`. `FROM=term_7b4cc382…` is unchanged.
- **Text:** comment, gate-message and log text.

Unchanged: the ancestor check, W1 wake, W2 liveness, W3 formal start with the same `ORIG` baseline, observers (sampler, secret watch, clone guard, each in its own process group), the runner child as the only `umask 022` process, W4 end capture before the observers stop, the strict W3/W4 compare, accounting copy, owned-clone list and secret scan. The launcher runs `run-m1.mjs --phase legacy` once. There is no loop and no retry. Playwright `retries: 0` is unchanged (`tests/playwright.config.ts:22`). The legacy phase runs exactly six host runners (`run-m1.mjs:201-215` at C7): `run-t2` (T2a, T2b, T3a, T3b), `run-t3c`, `run-t4a`, `run-t4b` (T4b1, T4b2), `run-t5` (T5a, T5b, T6) and `run-t8`. It does not run `run-t1.mjs`. This closes my remaining A-TR-03 check: the only reader of `infra/README.md` (LC-T1-05) is not in the legacy phase, and no M1 file reads either README.

Independent guard check: I re-evaluated the nine new or changed git-object guards (4 and 7–14) with the launcher's exact strings, read-only against my repository objects. All nine PASS for C6/C7. The other guards (pins, HEAD, clean tree, untracked files, `.env`, course hashes) are unchanged v2 lines.

### S2.3 Canvas SIM v3 (`launch-canvas-sim-c6-v3.sh`)

It equals legacy v3 except for comments, message text and one command: `node tests/host/run-m1.mjs --phase sim --provider canvas …`. This is an existing, documented runner mode (`run-m1.mjs:32-48`, `:59`). It is not a custom filter. With `--phase sim` the runner runs one round only (the two-round loop is in `--phase full`, `:152-170`). It runs `defaultGate` and one `suite('sim', …)`, then `verifyResults` fails closed if any selected row is missing (`:355-359`).

I counted the selection from the C7 manifests, using the runner's own `phaseRows` rule (`tests/host/m1-phases.mjs:7-10`). The result is 258 rows: 26 common + 232 Canvas, or 250 API + 7 browser + 1 host. The whole sim phase has 394 rows (386 API, 7 browser, 1 host). All 7 browser rows are Canvas rows, and all 7 are in the selection. Two runs need two separate Lead grants. The launcher does not loop.

### S2.4 E-T5R reach mapping (checked against raw full2 evidence)

How the content host serves the runtime (C7 `services/cogniate-app/src/content-host/server.ts:223-231`, `infra/compose.yaml:180`): every `GET /_rt/assets/:file` reads the file from the checkout's `apps/player/dist` (mounted read-only) at request time. It answers with `cache-control: no-cache` and no validator. The runtime page HTML (`:85-99`) has no hash or version of `runtime.js`. So a browser cannot run `runtime.js` without a logged asset request. And the bytes served are the build that is in the checkout at that moment.

I read the ten full2 phase folders under `R/full2-src/source/tests/host/artifacts` (main `service-logs/cogniate-content.jsonl` only; QA's table also covers the storage archive logs):

- **sim (both rounds): 8 asset GETs.** All 8 fall in the Playwright window. Only the seven Canvas browser specs ran there (checked in `evidence/sim/playwright-results.json`). The API window has none.
  - **Post-body pair (lines 271–272):** these come 8–18 ms after `M1-09.canvas.browser-top-level` ends. That row's runtime-page `GET /rt/:token` is at line 270, 1 ms before its end. A state fetch follows at line 273. The next row, `M1-09.canvas.browser-framed`, starts 68–73 ms later. Both possible owners are in the selection, so the selection does not depend on QA's attribution inference.
- **snapshot-isolated: 0 asset GETs and 0 `/rt` requests.**
- **snapshot-upgrade: 0 asset GETs.** It has only 26 API calls to `GET /rt/:token/state`, and no runtime-page load.
- **migration (both rounds): 4 asset GETs.** All 4 are inside `cmd/13-migration-moodle-baseline.log` (round 1 07:42:01.388–07:43:08.331Z; round 2 08:33:33.351–08:34:38.584Z). That step comes after `cmd/06` (old checkout b0b83a8) and `cmd/11-stack-up-old.log`, which prints "Building the player (apps/player/dist)". So the served `runtime.js` was built from the old revision b0b83a8. It is the same in a C4 run and a C6 run. The candidate-build window (`cmd/18`, `cmd/22`, `cmd/25`, and later) and the rollback window (`cmd/46` rebuilds b0b83a8) have no asset GET. The candidate stage makes only `/rt/:token/state` and `/rt/:token/commit` API calls.
- **storage (both rounds): 0 asset GETs and 0 `/rt` requests** in the main logs.

Result (lens A): every M1 row that can run C6's `runtime.js` is in the 258-row Canvas SIM selection. Each carried row (136 Blackboard sim API rows plus the snapshot, migration and storage rows) has no request that reaches candidate runtime code. M1 test code for carried rows is identical: C4→C7 `tests/**` changes only three T6/T8 files, and launcher guard 14 enforces this.

Three observations, with no severity:

- **O-1:** Carried rows whose procedure builds the candidate (migration `cmd/22`, snapshot-upgrade and storage lanes) rely on V2 for the build step, not on the fetch mapping. V2 evidence exists (S2.1).
- **O-2:** The carried set also has one Canvas `snapshot-isolated` API row. Its phase has no `/rt` traffic. Canvas accounting must list it as carried, not rerun.
- **O-3:** The routing tuple is pinned. A runtime grant under another task or dispatch needs a re-frozen launcher. A wrong tuple fails closed at the gate message, before the runner starts.

E-T5R acceptance remains the Lead's decision. It still needs QA's README-consumer confirmation (msg_399d10bbbd8b) and, per D4, two runs with independent Canvas judgment and per-row equality. No C4 pass, full2 round or failed legacy run fills a C6/C7 row before that.

### S2.5 Stage 2 finding

#### A-TR-05 — NIT — the QA guard-check label does not match the launcher's guard list, and the harness is not preserved

- **Where:** `V3/prep/14-focused-guard-checks-v3.txt` (78cb803a…), positive case 6: `ALL_14_SOURCE_AND_TOOL_GUARDS=PASS`. Both v3 launchers have 23 `|| blocked` lines. Seventeen of them are pre-W1 source and fixture guards (legacy v3 lines 25–46). The evidence index lists no harness script.
- **Impact:** The positive-path proof cannot be tied to the exact frozen guard list. There is no safety impact: the real launcher runs every guard itself and blocks before W1. My re-evaluation of the nine changed guards passes (S2.2).
- **Fix:** In an append, QA preserves the harness, or names the 14 guards it ran and states which frozen lines they map to.

### S2.6 Final verdict

| Item | Verdict | Open findings |
| --- | --- | --- |
| R1 source and units (C6 4008afb9…) | **APPROVE** | A-TR-01 MINOR, A-TR-02 MINOR, A-TR-04 NIT (accepted as residuals by the Lead in msg_399d10bbbd8b; no product change granted) |
| R2 test delta (C7 620c03d0…) | **APPROVE** | none |
| A-TR-03 (identity and README reach) | **CLOSED** | four-path launcher guards, README binding to 958ee5c, and no README reader in M1 or in the legacy phase |
| Legacy v3 launcher 7e161c42… | **APPROVE** | A-TR-05 NIT (QA evidence label only) |
| Canvas SIM v3 launcher 2e545b8b… | **APPROVE** | A-TR-05 NIT |
| E-T5R selection boundary (258 Canvas SIM rows, run twice) | **No lens-A objection** | O-1 to O-3 notes; acceptance remains the Lead's |

There is no open BLOCKER or MAJOR. This is source and launcher approval only. Fresh legacy, two Canvas SIM runs, M2, T7, Architect conformance and final Docs remain pending, each with its own Lead grant. The failed full2 and C4/C5 legacy attempts stay FAILED. All 32 real-LMS rows stay UNVERIFIED. Local Canvas stays DEFERRED.

### S2.7 Stage 2 evidence and disclosures

New private files (0600, `umask 077`) under `/Users/quangnguyen/cogniate-review-runs/r1-reviewer-a-20261022-n4UUIT/stage2/`: `01-identities.txt` (hashes, tool-set diff, recomputed launcher diffs), `02-selection-count.txt` (258/394 count) and `03-fetch-mapping.txt` (asset and `/rt` counts for every full2 phase folder, plus migration step windows). Orca message bodies and wait outputs are in `msg/`. Stage 1 `MANIFEST-1.tsv` is unchanged. `MANIFEST-2.tsv` covers all files.

- D-4: one recomputation command wrote `/tmp/rva-ignore-2a.diff` without `umask 077`. It held the public v2→v3 launcher diff and no secret. The same command deleted it.
- D-5: a `git grep` for the v2 hash across HEAD `docs/` printed one table row (hash and size) from `docs/reviews/M3/reviewer-b-t6-labels.md`, an earlier task's Reviewer-B report. I did not open that file. I read no review from this task's other reviewer, and not the untracked `docs/reviews/M3/tracker-repair-qa.md`.
- D-6: I read QA's raw full2 evidence, the v3 root and `t5b-stage2` read-only, without git commands in QA clones.
