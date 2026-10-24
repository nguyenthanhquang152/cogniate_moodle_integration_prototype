# M3 fresh legacy attempt: failure analysis and recovery plan

Status: PROPOSED to the Lead. Nothing in this plan is applied.
Author: Architect/planner, Claude Opus 5.5 xhigh, task_f0111da00fc4 / ctx_072d87e1a0d9, run_ebe671ad72a9.
Date: 2026-10-22. Analysis from 12:29 UTC; this file written at about 12:47–12:50 UTC.
Scope: both failures of the D-T6L fresh legacy attempt (product C4, tests C5). I read the evidence read-only.
I did not run Docker, a browser, a network request or a test. I changed no product, test, criterion, contract or team file.
The Architect source checkpoint `docs/reviews/M4/architect-conformance.md` stays unchanged. The prototype is NOT accepted.

## 0. Summary

| Failure | Cause class | Proof level | Owner of the repair |
| --- | --- | --- | --- |
| T5b AC-T5-36 (`1-html.spec.ts:62`) | **Product timing defect** in the HTML runtime tracker attach (`apps/player/src/html/tracker.ts`, `watchFrame`). When `load` never fires, the tracker sees a child document only on a 150 ms poll. A document that is parsed and replaced between two polls is never attached. | Mechanism proven from source. Its occurrence in this run is strongly indicated by the log timeline (§2.4). The exact lost fact is not logged. | Retained Codex session (product), §4.1 |
| T6 AC-T6-07 (`3-courses.spec.ts:133`) | **Test defect**: one non-retrying `innerText()` snapshot of a dialog that loads its connection list after it opens. | Proven: the snapshot text contains the product's `Loading…` status. The list request completed 84 ms later. | QA only, §4.2 |

Neither failure is flaky noise or a transient environment fault. The same race pattern as AC-T6-07 exists in the T8 helper, which has not run yet.
D-T6L rule 7 applies: a product change and other test changes return to the formal repair and verification cycle (§5).

## 1. Evidence used

M = `~/cogniate-qa-runs/qa-common-c5-maint-20261022T1010Z`; A = `M/legacy-c5-src/source/tests/host/artifacts/qa-multi-r1-bf09cdad-2026-10-22T12-10-26-133Z`.
I verified each SHA-256 below on disk.

| File | SHA-256 |
| --- | --- |
| A/container-T5b/playwright-results.json | cbe8b10d6beda73f9ff82c5d12ba507ced8efcc922038d4e6a6cc601856f41a8 |
| A/container-T5b/service-logs/cogniate-content.jsonl | 564f050936fdee080e04c0d2b4bac850c31d84610e16f7941eb1b29beea4a9c5 |
| A/container-T5b/service-logs/cogniate-app.jsonl | a713221a2cfa6ea7ac6861361a39310522da8899546c2c1edfd44aeb0606d8e6 |
| A/container-T5b/service-logs/lti-service.jsonl | 2aa4d892fc5a4177c330687d0a73aafa385ea946dc6b936a92c42fce1550a2b2 |
| A/container-T6/playwright-results.json | 351feb88cfaebd26100fe22e694e7d5cfb1735ae35fa1026491aad302cbf020d |
| A/container-T6/service-logs/cogniate-app.jsonl | 24f45443c1bf9d31a0d30451570f459ba468d3b82173512af2a5908bd3b0b9d8 |
| A/cmd/30-test-acceptance-T6.log | d97668f260f52d29b1a22f0745758b48dc8adaafae54a2f160d1057b6559cba7 |
| M/preflight-v2/18-closeout-facts.json | e1b1275adf0a27fcc89f67913c272e5e7d68df042d32ee83269aaf5767e22a3d |

Source: the frozen clone `M/legacy-c5-src/source` at C5 `e1a057be`. The C4→C5 diff has no path under `apps/`, `services/` or `packages/`. So the product source I read is C4.
The HTML fixture zip (SHA-256 `9f04d3ab…3f6d`, the value that `course-fixtures.ts` pins) was read in a private 0700 folder.

## 2. AC-T5-36: causal timeline

### 2.1 Observed facts (logs and results; UTC)

| Time | Source | Event |
| --- | --- | --- |
| 12:15:37.482 | results | AC-T5-36 starts (`newHangingContext`: every non-`*.test` request hangs). |
| 15:38.162–.170 | lti, app | Launch accepted; attempt `att_Cslm…`. |
| 15:38.184 / .208 | content | Runtime page, then `/rt/…/state`. The runtime starts `watchFrame` and then sets the package frame `src`. |
| 15:38.262, .314, .328 | content | Three `/pkg` GETs: the menu page `index.html` (635,006 B) and its two local assets. |
| 15:38.390, .397, .397 | content | Three `/pkg` GETs: the lesson page (654,496 B) and its two local assets. The test clicked the menu link just before 38.390. |
| 15:38.704 | content | Commit seq 1 accepted (`progress`), session `ses_Wfu2…`. This is the **first** commit. It arrives 314 ms **after** the lesson GET. |
| 15:48.572 | content | Commit seq 2 accepted (`progress`). |
| 15:43–16:48 | app | Player status poll, 200, every 5 s. |
| — | all | No seq 3, no `commit_rejected`, no `score_sync`, no LTI score POST, no Moodle or LTI error in the window. |
| 12:16:50.457 | results | The test ends: `waitForMoodle` waited the full 60 s; grade `null`. |

Control in the same run, AC-T5-09 (normal context, external hosts **aborted**): menu GETs 25.587–.596 → commit seq 1 at **25.728** (before the lesson GET) → lesson GETs 25.761–.767 → seq 2 at 26.066 → seq 3 at 35.878 → `score_sync sent` at 35.945.

### 2.2 Code facts (C4)

- `tracker.ts:121–142` `watchFrame`: it attaches when `readyState` is not `loading` and `body` exists. It checks on the frame `load` event and every 150 ms. A document that is still `loading` at a poll is skipped.
- `tracker.ts:68`: the menu page is "seen on visit" only inside `attach`. `tracker.ts:58–66`: answer listeners exist only after `attach`.
- `transport.ts:41–45` and `main.ts:65`: each change sends the **full** cumulative progress. A lost POST is repaired by the next commit.
- Each change sends exactly one commit. A pass needs three facts: menu seen, answer, lesson seen (10 s visible dwell + scroll). Each adds one commit.
- `tests/acceptance/lib/moodle-launch.ts:37–44`: the normal context **aborts** external requests, so `load` fires soon after parsing. `t5.ts:586–597`: the AC-T5-36 context makes them **hang**, so `load` never fires (both pages load S3 images and reference Google font files).
- `t5.ts:441–449` `driveCourse`: it waits for the frame URL (200 ms poll), waits for `domcontentloaded`, then clicks the menu link by DOM `click()` at once.

### 2.3 What the facts prove

1. The browser tracker sent only two commits. The server accepted both and rejected none. Because each commit carries the full state, the tracker's own state lacked one of the three facts. A network loss, a stale sequence or a server outcome error cannot explain the result.
2. The second commit (48.572) is the lesson "seen" event. The test's second scroll comes after its 11 s wait (about 49.6), so the dwell timer caused this commit. So the lesson document was attached by about 38.5–38.57.
3. No commit arrived while the menu document was the current document (38.262–38.39). In the control, the menu commit arrives 141 ms after the menu GET and before the lesson GET.

### 2.4 Inference (strongly indicated, not proven)

- The missing fact is the **menu visit**. The menu document reached `interactive` close to a poll tick. The test clicked the lesson link right after `domcontentloaded`. The lesson document replaced the menu document before the next 150 ms tick, and no `load` came. So `attach` never ran for the menu page.
- Seq 1 at 38.704 is the **answer**. The test can see the lesson URL only on its next 200 ms frame poll (about 38.58). Its click then lands at about 38.65–38.70, after the lesson attach.
- The alternative (answer lost, seq 1 = a late menu commit) needs two unlikely events: a 310 ms commit latency, and a click before the lesson attach. The 200 ms frame poll makes such an early click almost impossible.
- Earlier passes of AC-T5-36 are consistent with this model. The tracker's poll ticks and the test's frame-poll ticks start at related times, so the result depends on a few milliseconds around the menu `domcontentloaded`. Host load changes the odds. It does not create the window.
- Both variants have the same cause: a late or skipped attach when `load` never fires. The repair in §4.1 closes both.

### 2.5 Limits and evidence gaps

- Commit bodies are not logged, so the exact missing fact (menu or answer) stays inferred.
- The failure `trace.zip` and screenshot are lost. Playwright cleared its output folder for the T6 group, and the structured copy kept only `.last-run.json`. The stack and its database were removed at teardown.
- QA should confirm that no other copy of the T5b trace exists. A copy is useful, but the repair decision does not need it.
- Product impact: a learner whose network silently drops S3 or Google traffic loses a page visit if the learner moves on within one poll interval after the page is parsed. Then that attempt cannot pass, and no grade reaches the LMS. The frequency is unknown and not needed for this decision.

## 3. AC-T6-07: causal timeline

### 3.1 Observed facts

- 12:29:39.548: AC-T6-07 starts. 39.557–.592: the course page and its data load. The test clicks "Publish to an LMS"; `expect(dialog).toBeVisible()` passes.
- Line 132 reads `dialog.innerText()` once. The text contains the product's `Loading…` status and the empty select "Choose a connection".
- 12:29:39.632: `GET /app-api/connections` 200 (0 ms). The test failed at line 133 about 134 ms after its start, so the snapshot was taken before the list rendered.
- The corrected opener label (line 129) worked. Both corrected label cases in T6 passed.

### 3.2 Code facts and cause

- `apps/portal/src/courses/PublishDialog.tsx:22–24, 82, 110–114`: the dialog requests `/connections` on mount, shows `Loading…` (`role="status"`) until the response, then renders all ready options in one render.
- The same asynchronous model exists at `d54c607` (source check). Earlier passes of line 133 depended on timing. At C4 the full2 legacy T6 stopped at the stale opener label (line 129). So in the M3 evidence, line 133 had not run against the C4 dialog before this attempt.
- The suite already names this rule: `tests/e2e/lib/portal.ts:116–118` and `tests/e2e/M2/05-publish-results.m2.ts` use a "retrying readiness" wait because "the dialog loads the connection list after it opens".
- Cause: a test defect. The product meets AC-T6-07. The negative check at line 134 was vacuous on a loading snapshot.
- Same pattern, not yet run: `tests/acceptance/T8/2-shell.spec.ts:34–35` (`openPublishDialog`) reads the options once with `evaluateAll` after `dialog.waitFor()`. AC-T8-10 can fail the same way.
- `5-xss-a11y.spec.ts` (AC-T6-13, AC-T6-09) also opens the dialog. Its assertions do not depend on the list, and both passed. No change is proposed there.

## 4. Repair instructions

### 4.1 R1, product: for the retained Codex session `orca_session_id:a0238430-e227-401b-9ddb-ec18226110e2`

Role: Author-2 by task brief. It needs a new Lead grant; this plan is not that grant.

Files it may change: `apps/player/src/html/tracker.ts` and `apps/player/src/html/tracker.test.ts`.
Change `apps/player/src/runtime/main.ts` only if the `watchFrame` call must change, and report why.
It must not change `tests/**`, `docs/**`, any other `apps/**`, `services/**`, `packages/**`, `infra/**` or root build files. No push. Commit only as the Lead's grant says.

Required behavior (all MUST):

1. **Seen while loading.** When a check sees a new child document that is still `loading` (not `about:blank`), add one `DOMContentLoaded` listener to that document. The listener attaches at once. A document is attached at most once (keep the WeakSet).
2. **Fast check around navigations.** Start a fast check (about 10 ms, on the runtime window's timer, not the child's) when `watchFrame` starts and on `pagehide` of each child document seen. Add the `pagehide` hook at first sight, also while the document is loading. Stop the fast check when a new document is seen, or after 5 s. Then use the 150 ms poll again.
3. **Keep the fallbacks.** Keep the 150 ms poll, the frame `load` listener, the `about:blank` exclusion and the same-origin `try/catch`. `stop()` clears every timer and listener that `watchFrame` added.
4. **No rule change.** Keep every HTML rule unchanged: menu seen on visit, 10 s visible dwell plus scroll to the end (24 px), first answer stands, internal-link `target`/`rel` removal, saved progress, null-prototype answers.
5. **No other change.** Do not change package bytes, inject into the package, or wait for `load`. Do not change the transport, commit bodies or `seq`, the SCORM path, the content host, CSP or any service. Add no dependency. `runtime.js` stays one entry file.

Unit tests (jsdom, fake timers) in `tracker.test.ts`:

- U1 (this failure): document A is seen while loading. It becomes `interactive` and fires `DOMContentLoaded`. Then document B replaces it before any 150 ms tick, with no `load`. Expect `attach(A)` and `attach(B)`; with `createHtmlTracker`, the progress has the menu page seen.
- U2: document B is seen while loading, then fires `DOMContentLoaded`. At once, with no timer advance, a click on `input[data-cog-correct="true"]` follows. Expect answer `'1'`.
- U3: after `pagehide` of a seen document, the next document is seen while loading within 20 ms of fake time.
- U4: exactly one attach per document across `DOMContentLoaded`, poll and `load`.
- U5: the fast check stops after 5 s with no new document, and `stop()` leaves no active timer.
- Keep the existing tests, including "attach when interactive without any load event" and the `about:blank` case.

Fail-before proof: run U1 and U2 against the C4 `tracker.ts` and report that both fail. Use a scratch copy; do not use the shared git stash.
Self-check: `npm run check` at the repo root PASS with zero skips; report the test counts and the player build output.
Report: changed files, commands and results, the fail-before output, and any residual case. Known residual: an answer given before the page is parsed still does not count (unchanged from C4).
The Author does not declare the work verified. QA and both reviewers verify it.

### 4.2 R2, tests: QA only (common QA)

These changes need a new Lead approval under AC-M3-02 (b) ("any other change needs a new Lead approval").

- `tests/acceptance/T6/3-courses.spec.ts`: between lines 131 and 132, add one retrying readiness wait (first line below). Keep lines 132–134 unchanged. The static dialog text has no "Dev Moodle". So the wait passes only after the loaded list renders, and the negative check on line 134 becomes meaningful.
- `tests/acceptance/T8/2-shell.spec.ts`: between lines 33 and 34, add a retrying wait for the option that starts with the connection name and ` (Moodle, ` (second line below). Keep lines 34–36 unchanged.

```ts
await expect(dialog, 'the registered/connected connection').toContainText('Dev Moodle');        // T6, after line 131
await expect(select.locator('option', { hasText: `${conn.json.name} (Moodle, ` }).first()).toBeAttached(); // T8, after line 33
```

- Rules: use the configured default expect timeout (15 s); add no timeout argument, no retry and no `test.slow`. Change no other line, assertion, title or test id. Keep the C5 label literals.
- No T5b test change. AC-T5-36 keeps its 60 s deadline and all three assertions.
- QA runs the tests typecheck and shows unchanged T6/T8 title inventories. Two blind Claude reviewers check the two-file diff. Neither reviewer is this planner or the test editor.

### 4.3 Proposed text clarification (Architect files; not applied)

ADR-004 "HTML: option C" and app contract §9, after "poll and also listen for `load`", add:
"When the runtime sees a child document that is still loading, it listens for that document's `DOMContentLoaded`. After it sets the frame `src`, and after each child `pagehide`, it checks for the next document every few milliseconds for a short time. The runtime never skips a parsed document."
The rule and the criteria do not change. The Lead decides whether to apply this text.

## 5. Verification scope for a new acceptance decision

Identities: C6 = the first commit with R1. Outside `docs/**` and `tests/**`, its diff from C4 must be exactly the R1 paths. C7 = the commit with R2. Its `tests/**` diff from C5 must be exactly the two R2 files. C6 and C7 can be one commit.

### 5.1 Changed behavior and its reach

- Only `dist/runtime.js` changes. The runtime page loads it under a fixed name (`server.ts:92`). Server code, `shell.js` and `runtime.css` stay byte-identical.
- So only rows that **execute** `runtime.js` in a browser can change. API, host, storage and migration rows send no browser request to `/_rt/assets/`.
- HTML browser sessions see the change (earlier attach). SCORM browser sessions load the same new file but do not run `watchFrame`.

### 5.2 Required evidence on C6/C7

| # | Check | Why |
| --- | --- | --- |
| V1 | QA binding: exact path diffs (above); root `npm run check` PASS with zero skips on a fresh C6 clone; tests typecheck on C7; title inventories unchanged. | Definition of done; D-T6L method. |
| V2 | QA host build of `apps/player` at C4 and C6: only `dist/runtime.js` differs. | Proves the reach in §5.1. If anything else differs, use the strict route (§5.4). |
| V3 | Two blind Claude reviews of R1 (lens A: attach correctness, same-origin access, no package change; lens B: U1/U2 prove the claim, fail-before output), of R2, and of the launcher v3 diff. | Charter §4. |
| V4 | One fresh legacy window, one qualified `--phase legacy` invocation of all 12 groups on product C6 and tests C7. It includes the T5a knob pass, all T5b HTML cases (AC-T5-36 with its 60 s deadline) and P2/P5, T6, and T8 for the first time. W1–W4, sampler, guard, strict 32-volume comparison and the secret scan stay unchanged. Zero skips, retries or flaky results. | AC-M3-02 (b) on the final SHA. The launcher runs the groups as one unit. A subset would need a new launcher capability and a new exception for about 16 minutes of saving. |
| V5 | The 7 Canvas browser rows (`M1-09` ×2, `M1-14`, `M1-22`, `M1-24`, `M1-40` b and c) run twice on C6. Canvas QA judges them independently; both runs give the same result per row. | They execute `runtime.js`. `M1-22` posts a direct commit while the browser tracker also commits, and R1 moves the tracker's first commit. |
| V6 | M2: all 64 SIM browser cases on C6/C7. | Pending anyway; HTML learner flows execute `runtime.js`. |
| V7 | T7: three consecutive runs on C6, default profile. | AC-M3-02 (a); pending anyway; real HTML course in Moodle. |
| V8 | Architect conformance delta for ADR-004/§9 at C6, after accepted runtime evidence. | Final conformance. |

Launcher v3: copy the reviewed v2. Change only the product/test identities and the strict diff lists.
I also recommend one evidence-retention line, reviewed with the v3 diff: before the next group starts, copy each group's Playwright output folder into the private run root (0700 folders, 0600 files). This closes the gap in §2.5.

### 5.3 Prior evidence

- Full2 rounds (2 × 488), Canvas judgments (2 × 233) and their equality stay valid at C4 and tests tree `8283d90`. Under the exception E-T5R below, they fill only the C6 rows that do not execute `runtime.js`: 481 rows per round.
- This fresh legacy attempt (C4/C5) stays FAILED and immutable. Its passing groups (T2a–T5a, the knob, 23 T5b cases, 17 T6 cases) do not fill C6 rows. Its W4 and scan results concern only its own window.
- The C5 label correction and its two reviews stay valid. C7 carries it unchanged.
- Earlier T5b, T6, M2 and T7 passes are history only. They did not detect the race.

### 5.4 Exception E-T5R (proposed for the Lead; not applied)

AC-M3-01 says that evidence of earlier candidates never fills a row of a new candidate. Without an exception, the strict route applies: both 488 rounds, both 233 judgments and the equality check run again on C6, plus V1–V8.
Recommended bounded exception, in the D-T6L style:

1. It is valid only if V1 and V2 pass: the product diff is exactly the R1 paths, and the built output differs only in `runtime.js`.
2. QA proves the selection from the full2 round content logs. Every M1 row whose window has a browser request to `/_rt/assets/` must be in V5. Any extra row joins V5. If the logs cannot assign requests to rows, the strict route applies.
3. Any other product change, or any fresh failure, voids E-T5R.

This is not a model-change rerun. It reruns only rows whose code path changed, and it waives no row that the change reaches.

## 6. Why not "transient environment, restart unchanged"

The evidence does not support an environmental cause. There was no outage, error or rejected commit, and the tracker never produced the third fact. The defect window is in the product design.
A restart on C4 only re-rolls the race. A pass would not prove the race is closed, because C4 passed AC-T5-36 before.
To claim an environmental cause, you would need commit bodies that show menu, lesson and answer, and a server or LMS fault after the final commit. That evidence does not exist.
If the Lead still chooses an unchanged restart, it needs an explicit Lead decision that records the open race, plus the retention line of §5.2. It still needs the AC-T6-07/T8 test repair, because that failure is deterministic in kind.

## 7. Lead decisions needed

- D1: Accept the classification. AC-T5-36 is a product BLOCKER (a required criterion fails). AC-T6-07 is a test-fault BLOCKER for this run.
- D2: Grant R1 (§4.1) to the retained Codex session with the stated file set.
- D3: Approve R2 (§4.2) under AC-M3-02 (b) for QA.
- D4: Choose E-T5R (recommended) or the strict route for M1/Canvas.
- D5: Approve launcher v3 (identities, diff lists, optional retention line). Then grant one legacy window, then the M1-browser, M2 and T7 windows.
- D6: Optional. Ask the Architect to apply the §4.3 text.

## 8. Exact unknowns

- U1: Which fact was lost (menu visit, inferred, or answer). R1 closes both. Only commit bodies or the lost trace can settle it.
- U2: Does a copy of the T5b trace or screenshot exist anywhere? QA can answer from its run root without Docker.
- U3: Can the M1 runner run the 7-row browser subset without a code or launcher change? QA can answer. If not, the Lead chooses between a reviewed subset variant and the strict route.
- U4: Can the full2 logs assign `/_rt/assets/` requests to row windows (E-T5R item 2)? QA can answer.
- U5: How often C4 fails AC-T5-36. This is not needed for any decision.
