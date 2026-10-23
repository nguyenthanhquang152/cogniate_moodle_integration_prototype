# M3 C6/C7 legacy attempt: AC-T6-09 failure analysis and test repair plan (R3)

Status: PROPOSED. The Lead accepted the test-only approach in `msg_70bf09d8b638`; this file records the exact bounded design. Nothing in it is applied.
Author: Architect, Claude Opus 5.5 xhigh, task `task_e34f6bb75e2d` / dispatch `ctx_d2821ebd6a6b`, run `run_ebe671ad72a9`.
Date: 2026-10-22. Analysis about 15:09–15:25 UTC.
Scope: read-only. I ran no Docker, browser, test or network request. I changed no product, test, criterion, contract or team file.
The held conformance report (`docs/reviews/M4/architect-conformance.md`, 38,641 B, `18da670b…8f7d`) stays unchanged. The prototype is NOT accepted.

## 0. Summary

| Item | Result |
| --- | --- |
| Failure | T6 AC-T6-09, `tests/acceptance/T6/5-xss-a11y.spec.ts:113`. The keyboard-created Moodle connection never showed its registration URL. |
| Cause class | Test synchronization defect against the portal's route-focus mechanism. A product timing property makes it possible. R1 (`tracker.ts`) cannot reach this flow. |
| Proof level | Facts from logs and source. The mechanism is strongly indicated, not proven: the trace is lost. |
| Repair | R3, tests only, two files: a route-focus settle wait before keyboard input, and value checks after typing. No product edit. |
| Owner | QA (charter §1, `tests/**`). The retained Codex session gets no test-ownership exception. |
| Product | Two nonblocking NITs (§5). No product edit is authorized. |

## 1. Observed facts

Raw file: `/Users/quangnguyen/cogniate-qa-runs/qa-common-c6-v3-20261022T1340Z/c7-src/source/tests/host/artifacts/qa-multi-r1-4008afb9-2026-10-22T14-43-55-730Z/container-T6/playwright-results.json` (47,066 B, SHA-256 `e905695070e84bc4797607f4ec3fe85dc53c0465b134f511c901d7982a7e5eef`). Logs: the `service-logs/` folder next to it.

- T6 result: 17 expected, 1 unexpected, 0 skipped, 0 flaky.
- AC-T6-09 started at 15:06:15.174Z and ran 20,439 ms (end 15:06:35.613Z).
- Failing assertion `:113:179`: `expect(getByText(/https:\/\/lti\.cogniate\.test:8443\/lti\/register\//).first().or(locator('input[value*="/lti/register/"]')).first()).toBeVisible({ timeout: 15_000 })`. Result: "element(s) not found".
- Earlier assertions of the same test passed: `:87` (axe), `:94`, `:96`, `:97` (dialog by keyboard, focus back to the opener), `:110` ("Automatic (recommended)" checked).
- `cogniate-app.jsonl`: QA_B `POST /app-api/session` 204 at 15:06:19.182; `GET /integrations/moodle/connect` at 19.196; `GET /app-api/me` 200 at 19.216. That is the last browser request. There is no `POST /app-api/connections`, and no app request until `service_stopping` at 15:06:45.970. `cogniate-content.jsonl` and `lti-service.jsonl` have no request in 15:06:15–15:06:45.
- Control: the C4/C5 attempt (`qa-multi-r1-bf09cdad-2026-10-22T12-10-26-133Z`) passed AC-T6-09 in 4,414 ms. Its `POST /app-api/connections` 201 came 128 ms after `/app-api/me`.
- Identity: `apps/portal/**` is unchanged C4..C7. The spec, `tests/acceptance/lib/**` and `tests/playwright.config.ts` are unchanged C5..C7. Portal pages request no `/_rt/assets/` file.
- Same run, evidence only: T5b passed 24/24, including AC-T5-36 (14.58 s). The attempt is FAILED, so these passes fill no row.
- Separate fact: the final W4 at 15:07:05 failed because another project (Savoy) started a container and a new anonymous volume. I do not claim it as a cause of the T6 failure.

## 2. Lost evidence

`container-T6/playwright/` holds only `.last-run.json`. The screenshot, `error-context.md` and `trace.zip` named in the result are not kept. The clone has no `tests/acceptance/artifacts/` folder. The QA root `verification-620c03d-jIA25tGg` has no failure trace. So the DOM state and the focused element at the failure are unknown.

## 3. Source facts (C7 `620c03d`)

- `apps/portal/src/App.tsx:243-273` (Frame): when the route path or state changes, an effect moves focus to `state.focus`, else to `main h1`. It tries in two ways: a `MutationObserver` on `#main` (a microtask after each content change) and one `requestAnimationFrame` (`:268`). The observer disconnects after the first success. The `requestAnimationFrame` callback is cancelled only when the effect cleans up, so it can run after an observer success and focus the target again. A `dialog[open]` stops it.
- `apps/portal/src/connect/Connect.tsx:44-46`: the `h1` ("Connect Moodle", "Manage Canvas", and so on, `tabIndex -1`) renders at once.
- `apps/portal/src/connect/CreateConnection.tsx`: the form loads no data. The name field has `autoFocus` (`:73`). The site URL is `type="url"` and `required`. The form uses native validation (`:64`). The submit handler sends no request when `siteError` fails (`:30-35`).
- So, on a direct load of `/integrations/moodle/connect`, the form is usable about one animation frame before the heading takes focus.
- `apps/portal/src/connect/ProviderSetup.tsx:19-23` (Canvas and Blackboard): the form renders after `/lms-providers` data. The window is smaller than for Moodle, but the same focus move exists. After step 1, the wizard goes to `/integrations/{lms}/{id}`, which is a new route and a new focus move.
- `apps/portal/src/courses/CourseDetail.tsx:28-57`: the `h1` and the Publish link mount after the course data. The observer focuses the `h1` at that time, and the pending `requestAnimationFrame` can focus it again later.
- `tests/acceptance/T6/5-xss-a11y.spec.ts:101-105`: the test types right after `page.goto`, with no wait for the focus move. `tabTo` (`:117-124`) returns when the target has focus. `urls.moodle` is `https://moodle.test`.

## 4. Inference (strongly indicated, not proven)

- The heading-focus move landed after `tabTo(site URL)` saw focus on the URL field and before the 9th character of `https://moodle.test`. The same applies before the first name character, or before Enter. The keystrokes after the move went to the `h1`.
- Then either native validation (`required`, `type=url`) blocked the submit, or Enter fell on the `h1`. Either way no request was sent, and `:113` failed. A URL of at least `https://m` passes both checks and would have sent a POST.
- The C4/C5 pass and this failure have the same bytes, so the result depends on timing. Host load can change the odds. It does not create the window.
- Correction to my message `msg_1b65d708cad6`: I wrote there that lines 90–97 are not exposed. That is wrong. The uncancelled `requestAnimationFrame` (§3) can move focus to the course `h1` after `tabTo(opener)` and before Enter. R3 covers that point too.

## 5. Product NITs (nonblocking; no product edit authorized)

| Id | Severity | File:line | Problem |
| --- | --- | --- | --- |
| AR-M3-T609-01 | NIT | `apps/portal/src/connect/CreateConnection.tsx:73` with `App.tsx:243-273` | The name field `autoFocus` loses focus to the page heading one frame later. The final focus is the heading. |
| AR-M3-T609-02 | NIT | `apps/portal/src/App.tsx:263-271` | After an observer success, the pending `requestAnimationFrame` focuses the same target again. The move is redundant and comes late. |

Possible future product option, only with a separate grant: in the same effect, call `focus()` directly instead of `requestAnimationFrame(focus)`, and remove `cancelAnimationFrame`. Do not change it to `useLayoutEffect`. Then Frame would focus the heading before `ui/dialog.tsx:19-27` records the dialog opener, and closing the Publish dialog would return focus to the `h1`, not to the opener (AC-T6-09 `:97`).

## 6. Repair R3 (tests only; owner QA)

Rule for every settle point: the portal makes at most two focus moves per route, both to the same target. When the target has focus, the `requestAnimationFrame` callback is already registered or has already run. So the test waits for the target to have focus, and then for one animation frame. After that, nothing moves focus until the next route change. This is synchronization with an event, not a sleep. It has no time value.

### 6.1 Helper (one copy in each changed file, next to that file's `tabTo`)

```ts
/** The portal moves focus to the page heading after a route change (App.tsx Frame: a content observer and one
 *  animation frame). Wait for the move, then for one frame, so no later move can take keystrokes. */
async function routeFocusSettled(page: Page, heading?: string) {
  await expect(page.getByRole('heading', heading ? { level: 1, name: heading, exact: true } : { level: 1 })).toBeFocused();
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
}
```

### 6.2 `tests/acceptance/T6/5-xss-a11y.spec.ts` (AC-T6-09 only)

| After line (C7) | Add |
| --- | --- |
| 90 `await page.goto(…course(courseId))` | `await routeFocusSettled(page);` (the course title varies; the page has one `h1`) |
| 101 `await page.goto(…connect)` | `await routeFocusSettled(page, 'Connect Moodle');` |
| 103 `await page.keyboard.type(urls.moodle);` | `await expect(page.locator(':focus'), 'the typed site URL stays in the focused field').toHaveValue(urls.moodle);` |
| 105 `await page.keyboard.type(…QA keyboard…)` | `await expect(page.locator(':focus'), 'the typed name stays in the focused field').toHaveValue(/^QA keyboard [0-9a-z]+$/);` |

### 6.3 `tests/e2e/M2/06-keyboard-axe.m2.ts` (the three AC-M2-11 keyboard cases)

| Case | After line (C7) | Add |
| --- | --- | --- |
| `M2-11.canvas-keyboard` | 49 `formReady(page, 'Connection name')` | `await routeFocusSettled(page, 'Connect Canvas');` |
| | 55 `pendingWizard(page, 'canvas')` | `await routeFocusSettled(page, 'Manage Canvas');` |
| `M2-11.blackboard-keyboard` | 71 `formReady(page, 'Connection name')` | `await routeFocusSettled(page, 'Connect Blackboard');` |
| | 75 `pendingWizard(page, 'blackboard')` | `await routeFocusSettled(page, 'Manage Blackboard');` |
| `M2-11.add-deployment-keyboard` | 90 `formReady(page, 'Deployment ID')` | `await routeFocusSettled(page, 'Manage Canvas');` |

In these three cases, after each `page.keyboard.type(X)` on lines 50, 51, 57, 58, 62, 72, 73, 77, 81, 91 and 92, add `await expect(page.locator(':focus')).toHaveValue(X);` with the same `X` expression. The typed fields keep the raw input value (`CanvasBinding.tsx:51-59`, `BlackboardBinding.tsx:43-47`; the create forms `CanvasCreate.tsx:42-46` and `BlackboardCreate.tsx:44-48` are uncontrolled).

### 6.4 Limits of the change

- Add lines only. Change or remove no existing line, assertion, title, test id, label literal or deadline. `:113` keeps its 15 s timeout.
- Keep keyboard-only input: no `fill`, no `click` on a field, no `focus()` call. Add no timeout argument, `waitForTimeout`, retry or `test.slow`. The new assertions use the default expect timeout: 15 s in `tests/playwright.config.ts:19` and `tests/e2e/M2/playwright.config.ts:13`. Both configs keep `retries: 0`.
- No other file. No T5b, T8, M1 or T7 change.

## 7. Validation

| Check | Who | Pass rule |
| --- | --- | --- |
| Exact diff | QA, both reviewers | C7 → C8 under `tests/**` = exactly the two files above. Only added lines, as in §6. C8 = C6 outside `docs/**` and `tests/**`. |
| Coverage of the rule | Both reviewers | In the two files, every `page.keyboard.type` or keyboard Enter/Space that follows a `page.goto` or a wizard route change comes after a `routeFocusSettled` for that route. |
| Typecheck and inventories | QA | The tests typecheck exits 0. T6 and M2 title inventories are identical to C7. |
| Two blind reviews | Two Claude reviewers, not this planner or the editor | Lens A: the settle rule matches `App.tsx:243-273`, including the second focus move. Lens B: no weakening and no hidden timing change. |
| Runtime | QA, Lead | AC-T6-09 passes in the fresh V4 legacy run, and the three M2-11 cases pass in V6. No skip, retry or flaky result. |

The runtime runs are the real proof. No host-only check can reproduce the browser race.

## 8. Regression scope (decision inputs; the Lead decides)

- **Identities.** Product stays C6 `4008afb`. C8 = C7 plus the two test files. Re-freeze the launchers as v4: C8 pins and tests-tree pin; C7 → C8 tests = the two files; C4 → C8 tests = `T6/3-courses.spec.ts`, `T6/5-xss-a11y.spec.ts`, `T8/2-shell.spec.ts`, `e2e/M2/06-keyboard-axe.m2.ts`; the product path guards stay. The v4 launchers need an identity-only review.
- **V4.** One fresh legacy run of all 12 groups on product C6 and tests C8, in an exclusive host window. W1–W4, all 32 full baseline volume records, the scans and owned cleanup stay unchanged. The failed C6/C7 attempt fills no row.
- **M1.** E-T5R is VOID by its rule. This failure is outside the `runtime.js` reach, the product is unchanged, and the two changed files are not M1 files. A renewed bounded route is only a proposal. It needs an explicit Lead renewal, after an independent review proves three things: (a) C8 = C6 outside `docs/**` and `tests/**`; (b) no M1 runner, manifest or spec reads either changed file; (c) the V1/V2 reach evidence and the full2 asset mapping are unchanged. Without renewal, use the strict route: two full 488 rounds, two independent 233 Canvas judgments and equality, on C6/C8.
- **V6 and V7.** Run all 64 M2 cases and three T7 runs on exact C8 (product equal to C6).
- **Conformance.** My Stage 2 binds only accepted evidence of the final identity.

All 32 real-LMS rows stay UNVERIFIED. Local Canvas stays DEFERRED.

## 9. Appended clarification after C8, both reviews and E-R3 (2026-10-22, about 16:37–16:45 UTC)

Author: Architect, Claude Opus 5.5 xhigh, task `task_f301484bd6be` / dispatch `ctx_422d7f0f0928`, run `run_ebe671ad72a9`. Read-only work: git, file size and SHA-256 checks only. No Docker, browser, test, install or network request.
This section is append-only. §0–§8 stay the original PROPOSED plan: 13,356 B, SHA-256 `ece4248bad58989f34e76bcde65a513e08069d8620b125373b981e393ba68ff0`. Their status, lost-trace and "9th character" text is historical. This section corrects it. It does not rewrite it.

Inputs: [Reviewer A](t6-09-reviewer-a.md) (30,327 B, `752472f72ef4de6708ec3e7152e88a3da2c844ed3a0abd03ab294b8a5eebfe48`, commit `aaf95ed`); [Reviewer B](t6-09-reviewer-b.md) (22,142 B, `55bb84600eb85bca484d98532b68e70351414662990b36a6b27a557f22bf121a`, commit `27c4ed7`); [E-R3](../../team/r3-evidence-decision-2026-10-22.md) (6,215 B, `eebfa2b4d83935513b1b2b22469b2195b79ea0d550abaa38e6a6705cb620ed55`).

### 9.1 Status now

- C8 `5561e8f72a83de36a68877c6b26ffc8288ade735` (tests tree `65eaefab31ec6800fca06aee50e5e25c95713f8a`) applies §6. C7 → C8 under `tests/**` is the two §6 files, +11/−0 and +22/−0. C8 equals product C6 `4008afb92fe983d52db33442e060210b929966c8` outside `docs/**` and `tests/**` (my `git diff --quiet`, exit 0).
- Both blind reviewers APPROVE this plan, C8, the v4 launchers and route eligibility, with 0 BLOCKER and 0 MAJOR. Their approval is not runtime acceptance.
- The Lead accepted E-R3 FOR EXECUTION at `aaf95ed`. That is not runtime acceptance. The §7 runtime row is still open.
- E-T5R stays VOID. The C6/C7 attempt stays FAILED. The 15:58:56 UTC guard-control run is UNAUTHORIZED/STOPPED; its gate message `msg_2f257a8675cf` is VOID; it gives no row.

### 9.2 Recovered trace (corrects §0 "trace is lost", §2 and §4)

QA recovered the trace of the current failure after §0–§8 were written:
`/Users/quangnguyen/cogniate-qa-runs/qa-multi-r1-4008afb9-2026-10-22T14-43-55-730Z/tests/acceptance/artifacts/playwright/T6-5-xss-a11y-AC-T6-09-axe-e53e7-focus-returns-to-the-opener/trace.zip`, 9,290,291 B, SHA-256 `5b655b0015331abf48342db9ecce599fd35ca08086cdbf84a014dd99815d9c3c` (I re-checked size and hash at 16:38 UTC).
The test started at 15:06:15.174 UTC. Reviewer A §3.1 matched the trace wall time to that start to the millisecond. Reviewer B §3 bound the same files and reads 15:06:15.177Z for the trace context. Both bind the current failure. I did not extract the trace again.
The trace and its screenshot hold dev credentials. Keep them private. In `run-t5`, each pass clears the shared Playwright output folder, so only the final pass keeps browser artifacts. Per-pass output folders are deferred (B-M3-T609-05, E-R3).

Facts that the reviewers read from the trace (Reviewer A §3.2, Reviewer B §3):
- The typed URL was `https://moodle.test:8443`, from the run environment. `https://moodle.test` (§3) is only the `tests/acceptance/lib/env.ts:16` default.
- All 24 URL characters were lost, not the characters after the 9th (§4). The URL field was empty at the failure. The name field kept its full value.
- After the URL keys, one forward Tab reached the name field. That places the lost focus at the `Connect Moodle` heading. The `required` URL field then blocked the native submit, so no `POST /app-api/connections` was sent.

Proof level: the trace directly shows the focus loss. It shows that focus left the URL field after `tabTo` saw it there and before the first URL key. Which Frame callback moved focus (the observer microtask or the animation frame) stays an inference. R3 covers both.
Course page (§3, §4): the pending animation frame can move focus again only when the course data commits before the first frame after the effect. In the other order, the observer makes the only move. R3 covers both orders (Reviewer A §2).

### 9.3 Final C8 value checks (accepted change from §6.3)

§6.3 asks for `toHaveValue(X)` after each typed value. C8 uses `toHaveValue` for the eight non-secret values. For the three approval codes, C8 uses a safe boolean poll: `expect.poll(() => page.locator(':focus').evaluate((el, code) => el.value === code, grant.code)).toBe(true)` (`tests/e2e/M2/06-keyboard-axe.m2.ts` at C8, the three `expect.poll` lines). It does not use `toHaveValue(grant.code)`.
The strength is the same: a wrong value or a lost focus fails at the default expect deadline. The failure text does not print the one-time code (AC-M3-07 hygiene). Do not change these checks to `toHaveValue(grant.code)` in a later edit (B-M3-T609-08). C8 also adds a failure message to each settle wait and value check. Both reviewers accepted these differences.

### 9.4 Scope of route condition (b) (corrects §8 "M1")

§8 (b) says "no M1 runner, manifest or spec reads either changed file". As written, this is false (A-T609-01, B-M3-T609-02). At C8, `tests/host/run-m1.mjs:206` runs `run-t5.mjs --tasks T5a,T5b,T6` in `--phase legacy`, and `:168-170` calls `--phase legacy` at the end of `--phase full`.
Correct scope: no producer of a carried M1 SIM, migration, snapshot or storage row loads either changed file. M1 Vitest collects `acceptance/M1/{owner}/**/*.test.ts`. M1 Playwright matches `M1/**/*.spec.ts`. The condition applies to these producers, not to the whole `run-m1` script.
So the legacy phase runs the changed T6 spec, and all 12 legacy groups stay fully fresh. E-R3 records this scope.

### 9.5 Product focus findings: MINOR, deferred (replaces the NIT severity in §5)

| Id | Same issue as | Severity now | Problem |
| --- | --- | --- | --- |
| AR-M3-T609-01 | B-M3-T609-06 | MINOR, deferred | `CreateConnection.tsx:73` `autoFocus` puts focus in the name field. One frame later, Frame moves it to the heading. Keys typed in that window go to the heading. They are lost with no message. |
| AR-M3-T609-02 | A-T609-02, B-M3-T609-06 | MINOR, deferred | `App.tsx:243-273`: the observer stays connected until the target exists, and the pending animation frame can repeat the move. On a data route (for example the course page), focus can move to the heading after the data arrives. That can be seconds after the user started to use the keyboard. Keys typed before focus settles can be lost. |

Reason: these are not style issues, so NIT is wrong (charter §5). They are worth a fix and safe to defer, so they are MINOR. The recovered trace shows real key loss at automation speed.
C8 tests wait for the intended route readiness: the heading focus, then one frame. They do not prove that this product race is gone. After R3, no test detects it (Reviewer B §4.3). A pass of AC-T6-09 or AC-M2-11 proves keyboard operation after the route focus settles. It does not prove that keys typed earlier are kept (Reviewer A §4.6).
No product repair is authorized now. The retained Codex executor owns any future repair under a separate grant. The §5 "possible future product option" is not a decision and is not validated. A future product focus change must update both `routeFocusSettled` helpers in the same round (A-T609-04).
Handoff to Docs, through the Lead: list both findings in `docs/human_review/deferred.md` with the user effect above. Do not claim that keys typed before a route's focus settles are kept.

### 9.6 Not changed by this section

- §0–§8, including the PROPOSED label, the lost-trace text, the old inference and the old NIT rows. They stay as history.
- The failed C6/C7 attempt and every earlier failed or void attempt.
- Any product, test, criterion, contract, ADR, team or guide file.
- The runtime proof: §7 last row, under E-R3. Final Architect conformance binds only accepted fresh evidence ([conformance report](../M4/architect-conformance.md)).

## 10. Appended remediation proposal: external Docker activity in the C6/C8 legacy run (2026-10-22, about 17:33–17:42 UTC)

Author: the same Architect dispatch as §9. Authority: Lead `msg_070e9354861e` and the [runtime isolation decision](../../team/runtime-isolation-2026-10-22.md) (3,295 B, `ba3bfd8e7bbda47d36897ec71289fea9ff312e5a30e24f8d2d001c6483d37990`, commit `db8e5c7`).
This is a proposal only. The Lead decides. It accepts no runtime. E-R3 stays VOID. I ran no Docker, test, browser or launcher. I read only public closure files and shared result files. I opened no private log or trace.
§0–§9 are unchanged: the first 21,113 B (SHA-256 `5beea565e17aa039858b8735026e0216033bc52a0a865e9ede9994c4240dbb47`, committed at `b2d2aae`) keep the 13,356 B `ece4248b…ff0` prefix.

### 10.1 Evidence that I read

Root `V4` = `/Users/quangnguyen/cogniate-qa-runs/qa-common-c6-v4-20261022T1554Z`. T8 folder `T8R` = `V4/c8-clean-src/source/tests/host/artifacts/qa-multi-r1-4008afb9-2026-10-22T17-14-43-803Z`.

| File | Bytes | SHA-256 |
| --- | --- | --- |
| `V4/legacy-c6/REPORT-LEGACY-C6-C8-PASS.md` | 7,900 | `ee2ba4db1c235e30de0f1edad5b7237b1d1a3be5c708fd3895b3164cd88991c6` |
| `V4/evidence-index-legacy-c6.tsv` (74 lines) | 10,452 | `7b7f63eb1696cafaeb2442e85960f58411262be0936e007b05a449524537af63` |
| `V4/legacy-c6/public/CLOSURE-LEDGER-LEGACY-C6-C8.json` | 28,955 | `12791f3567e1816c80ae7d8f45a65a74a7bb1e5e2f49948ca80a8fa5a8dc1480` |
| `V4/legacy-c6/public/sampler/lane-containers.json` | 132,088 | `3bb585d2a00fa01c378055b4a83f22b33c854e78fa2ea53e6f6440cb9e85d7df` |
| `V4/legacy-c6/public/w3-formal-start.json` | 19,941 | `e1dd3dbad98c4c085f06cbabe17ae6d775786a7a631e97424f142a2a040c4a23` |
| `V4/legacy-c6/public/w4-end.json` | 19,932 | `26751ef27a7fee096c3a38247941fd9a3c05c47cc54ab72c8ec4b525e660e1d3` |
| `V4/legacy-c6/public/w4-compare.json` | 1,569 | `8e43950f3b11cac57b51bd8a9b4c9638e720a788d96abbb0a46806ff05686fa7` |
| `V4/legacy-c6/public/full-run-exit.json` | 92 | `fe83c30827120a9e3a131aec096b9d69a38da1e112976113dd85075e780e19cd` |
| `V4/legacy-c6/public/secret-scan.summary.json` | 470 | `70aafc770e4ecdf0340fa5659a0147b576d0d9fd7e12b29574b56d601e8ed553` |
| `T8R/summary.json` | 18,493 | `0054dbed9a5ecf9fe3f722c12cc876ea69567a6acb52c6750d0ca4cd54bb4d6b` |
| `T8R/container-T8/playwright-results.json` | 24,024 | `51f0add060e04da51cea1855b8cfab1e67f3a2dc89a84196b2a66ca1c3b87fec` |
| `T8R/container-races/playwright-results.json` | 6,615 | `7f6d41d1fdaaee185f1373adb70a9f6ccc52166f96ce87d3f84c09dfa164684b` |
| `T8R/container-knob-BUILD_RUNNER_HOLD/playwright-results.json` | 5,269 | `2af8e22a7b5e3bec869273d35139c150c39708f444e71243dc864ec7df98cb83` |
| `T8R/container-knob-BUILD_RUNNER_FAIL_AT/playwright-results.json` | 5,291 | `72608efe7f82ce636b7e5834d5484604014088cd38af9af83f31f118f31a63ac` |
| `T8R/container-runner-race/playwright-results.json` | 5,221 | `3e4af7e83db4c2bc17c30dd41201b94ad9926372b87c7458117a533e92bd46b1` |

I also counted the six subrun `summary.json` files. The Savoy chronology comes from the Lead's decision (`msg_be9de4c8842a`). I did not read the Savoy messages myself.

### 10.2 What failed and what did not

| Check | Result | Evidence |
| --- | --- | --- |
| Product behavior (12 groups: T2a, T2b, T3a, T3b, T3c, T4a, T4b1, T4b2, T5a, T5b, T6, T8) | No failure | Exit 0. 304/304 raw results and 251 unique summary IDs PASS, 0 failed, 0 retries. AC-T5-36, AC-T6-07 and AC-T6-09 pass. |
| AC-M3-06 isolation, as written | PASS | All 32 protected volume records and the built-in network records are identical at W3 and W4 (`w4-compare.json`: exit 0, `protectedIdenticalAtEnd` true, `problems` []). No container at W4. T8 `TEARDOWN`: 0 containers, 0 volumes, 0 networks left. T8 `M3-ISOLATION`: "containers changed: 0; volumes changed: none". The sampler's maximum is 2 concurrent Compose projects. |
| AC-M3-07 secrets | PASS | Secret scan exit 0; raw and public hits 0. |
| Grant condition: exclusive host | FAIL | Savoy ran temporary containers, one volume and an image build from 17:20:16 to about 17:22:57 UTC (Lead decision table). |

So this is not a product failure and not an acceptance-criterion failure. The failed item is the grant's exclusive-host condition, a coordination control that is stronger than AC-M3-06. That failure correctly voids E-R3 under its grant. It does not by itself make a functional row wrong.

### 10.3 Can the external activity make a row pass falsely?

Extra load and extra containers can cause false failures (timeouts, slow builds). A false pass needs a shared resource or an action on our resources. The closed evidence and Savoy's statement exclude each such route:

- Names and labels: Savoy used `/sto-local-db-quangnguyen` and `/sto-go-1792689766-96631`. They are not lane names, lane labels or `cogniate-build-*` names.
- Images: in the sampler, each lane service image keeps one image id for the whole run (`caddy`, `alpine-moodle`, `node`, `postgres`). The e2e image ids change for each test container, by design.
- Engine and networks: 178 samples, 0 failed samples, 0 clock or bridge read failures, one bridge id for the whole run. The W4 network records are equal to W3.
- Volumes: all 32 protected records are equal at W4. A `docker volume prune` would have removed unused anonymous protected volumes, so none ran.
- Actions on our resources: Savoy states that it did not use the LTI containers, networks or volumes. Our data cannot exclude a container removal between samples. This statement is the only evidence for that point.

### 10.4 Exposure of each row (UTC; Savoy times have a precision of a few seconds)

| Rows | Test time | Savoy activity during the test |
| --- | --- | --- |
| Subruns 1–5: T2a, T2b, T3a, T3b, T3c, T4a, T4b1, T4b2, T5a, T5b, T6 (225 unique IDs) | 16:38:27–17:14:43.8 | None reported or observed |
| T8 `container-T8`: SETUP-T5a, SETUP-T8, AC-T8-02, -04, -05, -06, -08, -09, AC-T8-10 (two results); `container-races`: C-T8-01 (two results) | 17:16:00.7–17:19:39.8 | None (ended before the 17:20:10 notice) |
| AC-T8-03 (`BUILD_RUNNER_HOLD`) | 17:20:07.161–17:21:18.020 | **Yes**: PostgreSQL and its volume, the image build and four image runs |
| AC-T8-07 (`BUILD_RUNNER_FAIL_AT`) | 17:21:51.226–17:22:33.068 | None reported in the test body. Runner steps before it overlap 17:21:20–17:21:30. |
| C-T8-02 (`runner-race`) | 17:22:59.635–17:23:38.953 | Boundary: the body starts 2.6 s after the last reported removal (about 17:22:57). Runner steps before it overlap 17:22:45–17:22:57. |
| T8 `M3-LEGACY-DEFAULT`, `M3-ISOLATION`, `TEARDOWN` | after 17:23:39 | None reported |

Only AC-T8-03 ran its assertions fully inside Savoy activity. Its network checks are structural Docker inspections: the build network is Internal, and the build containers have no other network. Load cannot make them pass. Its DNS-failure check alone could fail by timeout under load, but the structural checks prove the same isolation. Its "no `cogniate-build-*` container or volume remains" check depends on the Savoy no-use statement in §10.3. C-T8-02 needs a real refusal log from the second runner, so load can only make it fail.

### 10.5 Proposed remediation (smallest first)

**P1, recommended: no new runtime.** A new Lead decision supersedes E-R3. It keeps the E-R3 identities, reuse limits, required SIM, Canvas, M2 and T7 evidence and void rules unchanged. It binds this invocation (`legacy-c6`, gate `msg_46936ef706b8`) as the fresh C6/C8 legacy evidence, with the window stated as NOT exclusive. This is the same disposition as the transient Savoy probe in full2 round 1 (phase plan, 07:50 UTC checkpoint). The 230 C4 rows that E-R3 may carry come from that round. Host-only conditions:
1. Savoy confirms in writing that its chronology covers the whole run, 16:38:27–17:23:59 UTC: no Docker work before 17:20:16 and none after 17:22:57. It also confirms no prune, no removal or stop of other resources, no network connect or disconnect, and no engine restart or settings change. The LA hold for the same window is also confirmed.
2. Common QA appends, and does not rewrite: the row exposure ledger of §10.4; and a disclosed correction to its report status line, which says "258/258 unique per-subrun summary IDs". The ledger and the six `summary.json` files give 251 (67 + 31 + 18 + 43 + 66 + 26). This matters because 258 is also the Canvas SIM round size.
3. Every record says "functional PASS; exclusive-host condition FAIL; window not exclusive". No record calls this an exclusive run.

**P2, only if P1 condition 1 cannot be met, or if the Lead keeps the exclusive condition for every accepted row:** run the T8 subrun again, alone, in a confirmed exclusive window. Only T8 rows are exposed. The measured T8 subrun took about 9 minutes (17:14:43.8–17:23:51). No held launcher runs T8 alone. A T8-only variant of the v4 legacy launcher (runner command and labels only) needs its own identity review before any grant. Subruns 1–5 then carry from `legacy-c6` with the §10.4 ledger. Every repeated T8 row uses its fresh result.

**Not required:** a new run of all 12 legacy groups. No concrete criterion or exposure requires it for subruns 1–5 or for the T8 rows that ended by 17:19:39.8. It is an operational choice only if the Lead prefers an already-reviewed launcher to a T8-only review.

Any route still needs the remaining E-R3 evidence, and confirmed Savoy and LA holds before each later window. No product, test, criterion, contract, ADR or launcher change is proposed. The AC-M4-06 conformance verdict stays PENDING. All 32 real-LMS rows stay UNVERIFIED. Local Canvas stays DEFERRED.

## 11. Proposed shared-host execution and acceptance rule for SIM, M2 and T7 (2026-10-22, about 18:22–18:35 UTC)

Author: the same Architect dispatch. Authority: Lead `msg_87ebe5be7c6d`, after the accepted no-isolated-daemon result `msg_725f6ba36100`.
This is a proposal only. It gives no runtime grant and no host reservation, and it does not answer the user's open scheduling question. I ran no Docker or runtime command. I read the C8 test source (tests at HEAD = C8), the held v4 tools, the held independent-QA window plan and one C4 result file.
§0–§10 are unchanged: the first 30,770 B have SHA-256 `c7fd7da82be37b6107985b193584e93b62c1008a550e4b020dff3d3104fa0c03`.

### 11.1 Required checks that see foreign Docker activity (all stay as written)

| Check | Code | Compares | Foreign activity that fails it |
| --- | --- | --- | --- |
| W4 strict compare (SIM, M2, T7 windows) | `V4/tools/live-boundary-core.mjs:82-126` (M2/T7 use QA's copy in `R/tools/boundary`) | W3 with W4, plus the sampler | A foreign container, volume or network at W4 that was not at W3. A W3 container changed or gone. A resource vanishes during the W4 read. A built-in network id changes (engine restart). Docker info or Desktop settings change. More than one bridge id, or clock skew, in the sampler. |
| `M3-ISOLATION` (SIM) | `tests/host/core.mjs:200`, `:398-410` | Phase setup with teardown | A foreign container present at setup is gone or restarted at teardown, or a protected volume changes. |
| SIM setup subnet check | `tests/host/core.mjs:195-198` | Setup | A foreign network overlaps `172.29.0.0/16`. |
| `M3-06-M2` | `tests/e2e/host/run-m2.mjs:86-91`, `:161-163` | M2 run start with end | Any difference in the non-lane container list (id and status text; only "Up" is normalized) or the non-lane volume list. |
| lane-watch `isolationPass` (M2, T7) | QA `tools/lane-watch/lane-watch-core.mjs:240-251` | Lane start with lane end | Non-lane container ids, non-lane networks or Desktop settings differ. |

No required check makes the shared-host route impossible. Foreign work that starts and ends between two snapshots passes them all, as in the accepted legacy run. Foreign work that spans a snapshot fails them. Such a failure is an original-check failure: it blocks acceptance and needs a Lead decision. Nobody may suppress, patch, repeat or relabel it.

### 11.2 Can attributed foreign work make a row pass falsely?

Shared names, images, networks, volumes and the engine: the §11.3 conditions and the §11.1 checks exclude them, as in §10.3.
Deadlines can only fail under load. They do not pass falsely. This covers the AC-T7-15 demo `prepare` limit of 180 s (`tests/e2e/host/run-t7.mjs:274`), test timeouts, the M2 waits, the M1 polls and the lease margin. Under E-R4, such a failure voids the route with no retry. That is the main cost of this route, but not a validity risk.

The exception is a row that passes because an event does NOT happen within a fixed wait. Load can delay a wrong event until after the check. At C8 these rows are:

| Row | Fixed wait | Event that must not happen |
| --- | --- | --- |
| `M1-09.canvas.best-scorm12`, `M1-09.canvas.best-html` | 5 s (`tests/acceptance/M1/canvas/41-canvas-grades.test.ts:64`) | Score 60 replaces the best score 80 |
| `M1-09.canvas.<fixture>` rows with no expected score | 5 s (`:49`) | Any score sync row or score POST |
| `M1-16.canvas.graded-vs-preview` | 5 s (`:150`) | A preview score row or POST |
| `M1-33.canvas.status-422`, `M1-33.canvas.status-400` | 60 s (`:324-325`) | An automatic retry |
| Canvas browser rows: the framed embedded page, and the picker refused on site B | 3 s each (`70-canvas-browser.spec.ts:42`, `:92`) | The page leaves the frame; a picker or an error page shows in the refused frame |
| `M2-13.no-stale-values` | 7 s (`tests/e2e/M2/08-routes.m2.ts:63`) | Stale Canvas values after the held 3 s answer. The test checks only that a request was held (`late.length > 0`), not that its answer arrived. |
| T7 B-T7-01 confirm checks | "no" sent after 8 s (`run-t7.mjs:301`) | If the question comes late, the "no" can be flushed. The stop then comes from end of input, not from "no". |

Extra evidence is required only for these rows, and only in an invocation whose chronology shows foreign Docker work between W3 and W4. The independent judge records it. If any item is missing, that invocation is not accepted.
- Server rows (M1-09, M1-16, M1-33): the retained simulator score records and service logs for the whole invocation, up to teardown, show that the absent event never happened for that row's publication. Absence inside the wait is not enough.
- Browser rows (the two Canvas browser rows, M2-13): the row's retained trace or logs show that the observed work finished before its wait ended. For the refused picker, the site-A control frame rendered. For the framed page, its load finished. For M2-13, the app log time of the held Canvas answer is before the final check (Playwright start plus duration).
- T7: each `cmd/*-confirm-no-*.log` shows the question first, then the echoed "no".

### 11.3 Conditions (the Lead's list, made exact)

1. Launch only after the qualified preflight passes with no foreign container. Use unchanged C6/C8, launchers, tools, pinned images and all 32 protected records. Each phase has its own grant and an absent run root. Notify Savoy and LA before each launch.
2. Savoy keeps its resources disjoint. Its container, image, network and volume names do not start with `qa-` or `cogniate-`. Its networks do not overlap `172.27.0.0/16`, `172.29.0.0/16` or `172.31.0.0/16`. It binds only loopback ports, never 8443, 8543 or 8643. It does no prune, takes no action on other projects' resources, does no engine restart or settings change, and does not use LTI resources.
3. After each invocation, Savoy's chronology covers the whole window, from W1 to the end of W4, with second-level times for every container, image, network and volume operation. Any foreign activity in the sampler that the chronology does not explain is unknown activity and blocks acceptance.
4. Every original check passes as written: W1–W4, the sampler conditions, the runner isolation and secret rows, lane-watch, the held QA watchers, scans and owned cleanup. Every functional row, equality and judgment rule of E-R4 also passes.
5. When foreign work occurred during the invocation, the §11.2 row evidence is present.
6. Any failure stops the invocation. The Lead decides. The E-R4 rules of no automatic retry and void on a fresh functional failure stay unchanged.
7. Every accepted record says "window NOT exclusive" and lists the attributed foreign intervals.

### 11.4 Result and the one decision needed

- These conditions are sufficient for result validity, with the §11.2 evidence. No required check blocks the route. The residual risk is operational: a check fails when Savoy work spans a snapshot, or a deadline fails under load. Under E-R4 either outcome ends the route without a retry. The risk is highest for the longest invocation, T7: three runs plus the timed demo.
- E-R4 says: "Resolve host scheduling and confirm both project holds before each later runtime window." Savoy cannot give a hold. This route therefore needs an explicit Lead amendment of that E-R4 condition, with owner agreement on the schedule. That is a decision, not a check change.
- Recommended use: run SIM round 1, SIM round 2, M2, then T7 under separate grants. Launch each right after Savoy reports the end of a burst, so that overlap is less likely. Product, tests, criteria, deadlines, launchers and tools stay unchanged. AC-M4-06 stays PENDING.

### 11.5 Savoy's prospective confirmation against §11.3 (added about 18:30 UTC)

Source: Savoy `msg_962e480b30de` (18:26:36 UTC), relayed exactly in Lead `msg_8239b6908bfa`. Savoy claims no global hold.

| §11.3 item | Savoy statement | Status |
| --- | --- | --- |
| (2) Names and images | Only its own `sto-*` containers, their anonymous volumes, and the `savoy-transaction-orchestrator:local` image and its build | Met |
| (2) Ports | Loopback only: Docker-assigned ephemeral ports, or `127.0.0.1:5432`; never 8443, 8543 or 8643 | Met |
| (2) No prune or other actions | No prune. No stop, remove or attach of LTI or other-project resources. No engine restart or settings change. No change to the 32 volume records. | Met |
| (2) Networks | No network create, connect or disconnect outside its own containers. It does not say which subnets its own networks use, or that they are removed. | Partly met. Add: any Savoy network is removed inside its block and does not overlap `172.27.0.0/16`, `172.29.0.0/16` or `172.31.0.0/16`. Without this, the risk is a failed SIM setup subnet check or a failed W4 (new unrelated network), not a false pass. |
| (2) Volumes and helpers | Volumes are removed. testcontainers-go runs without the Ryuk reaper, so no helper container starts. | Met. A crashed Savoy test can leave a container, volume or network behind. W4 then fails as written: a check failure, not a false pass. |
| (3) Chronology | Announces each block with its start and end times | Partly met. Still needed after each invocation: a written statement that the announced blocks are complete for W1 to the end of W4, with second-level times. The sampler cross-check of §11.3(3) stays. |

With these two additions the route is concrete. The Lead can decide it in one step. It still needs the explicit E-R4 amendment of §11.4, because Savoy gives no hold, and owner agreement on the schedule.
All other conditions, checks, row evidence and stop rules of §11.1–§11.4 stay unchanged.

### 11.6 Final assessment after QA's evidence check and Savoy's answers (about 18:44–18:55 UTC)

Inputs: independent QA `msg_54dcc78e93bf` and Savoy `msg_b58be38c7de1`, both relayed by the Lead (`msg_a8b4fd8e7c3e`, `msg_541016b4c791`), and my rules in `msg_32c9129a2fda`. This section replaces the server-row and M2-13 evidence items of §11.2, closes the two open items of §11.5 and corrects one sentence of §11.4. The rest of §11 stays.

1. **Canvas server rows** (M1-09 best and no-score fixtures, M1-16, M1-33): the available evidence is sufficient. QA reconciles the whole-invocation logs, up to teardown: `lms-sim.jsonl`, `lti-service.jsonl` and `cogniate-app.jsonl`. Every score POST maps to an expected step of a positive row, and no unmapped POST or score sync exists. The POST counts per publication are: best rows exactly two (80 and 90); M1-33 rows exactly two (the failed first POST and the POST after Resend); the preview publication and the no-score fixtures none. Each absent event would be an extra POST, so the count proves the absence. No raw simulator body dump is needed.
2. **Canvas browser rows**: the available trace archives and simulator logs are sufficient.
3. **M2-13 (corrects §11.2)**: I withdraw the item "held answer before the final check". It cannot exist. At C6 = C8, `useApi` (`apps/portal/src/hooks.ts:10-40`) cleans up at once when the path changes. It sets `active = false`, so a later answer is never stored. It also calls `controller.abort()` and clears the poll timer. So the held Canvas request is aborted and never reaches the app. The required evidence becomes:
   - the whole-invocation `cogniate-app.jsonl` has exactly one `GET /app-api/connections/<M2-13 Canvas id>`: the page load. A held request that was not aborted would reach the app after its 3 s hold. That hold timer starts before the test's 7 s wait and ends first, so such a GET always shows in the log.
   - the Blackboard transition GET and one Blackboard poll are logged before the final check (Playwright start plus duration). This shows that the 7 s window was live.

   Together with the unchanged hook, this proves the cancellation path. It does not claim that a late answer arrived. If the log shows a second GET of that path, M2-13 is not resolved for an invocation with foreign work, and that M2 invocation is not accepted. M2 then needs a window without foreign work. This does not block SIM or T7.
4. **T7 B-T7-01**: the available confirm logs (question, then the echoed "no", then the stop) are sufficient.
5. **Savoy networks (closes §11.5)**: Savoy creates no Docker network and uses the default bridge. If it ever needs one, it removes it inside the same block and keeps it outside the three lane subnets. Met.
6. **Chronology (closes §11.5)**: block-level reports are sufficient. Per-action times are not needed, because §11.1 checks find snapshot conflicts by themselves and the §11.2 evidence is required for a whole invocation. Rules:
   - (a) Each reported block starts at or before its first Docker action. It ends after its last container removal, volume removal and build have finished. It lists every `sto-*` container name and every build.
   - (b) If any block overlaps the time from W1 start to W4 end, the §11.2 evidence (as corrected here) is required for that invocation. If no block overlaps, and the sampler shows no non-lane name other than our own lane or `cogniate-build-*` names, no extra row evidence is needed.
   - (c) A non-lane container name in the sampler that matches no reported `sto-*` name is unknown activity and blocks acceptance. Random names from classic (non-BuildKit) builds or from unnamed testcontainers are unknown in this sense.
   - (d) Savoy's written confirmation that its blocks cover W1–W4 completely arrives before acceptance.

   No `docker events` query, live collector or new tool is used.
7. **Correction to §11.4**: replace "with owner agreement on the schedule" with: "The Lead decides the execution policy under the existing user authorization. A concurrent run inside the agreed disjoint resources does not reserve the host and does not override Savoy's immediate-access instruction. Owner selection is needed only to give priority to an exclusive reservation." This route claims no reservation.

**Viable phases:**
- Canvas SIM round 1 and round 2: viable under §11 with items 1, 2 and 6.
- T7 (three runs, demo and confirmations): viable under §11 with items 4 and 6.
- M2: viable under §11 with item 3. If an overlapped invocation shows a second Canvas GET for M2-13, M2 needs a window without foreign work.

**Remaining conditions:**
- the Lead's explicit execution-policy decision, which amends the E-R4 hold clause;
- one grant per phase;
- Savoy's completeness confirmation after each invocation;
- every original check passes as written;
- the E-R4 rules of no automatic retry and void on a fresh failure.

Product, tests, criteria, deadlines, launchers and tools stay unchanged. AC-M4-06 stays PENDING.

## 12. Dead-handler test repair for the seven M1-37 cases (2026-10-23, about 01:25–01:50 UTC)

Author: Architect, Claude Code Opus 5.5 (`claude-opus-5-5`), xhigh. Task `task_f301484bd6be`, dispatch `ctx_49da070f64c0`, run `run_ebe671ad72a9`.
Authority: the [continuation brief](../../team/architect-resume-2026-10-23.md) and Lead `msg_da818591e8de`, `msg_9be817e0a9f8`, `msg_20b6970c2578` and `msg_7e411091ca22`. My interim was `msg_3540b7d8c9b5`. The Lead accepted its no-product-change diagnosis and chose to repair all seven cases in one QA batch. This section replaces interim item 3(d) (Blackboard deferral) and item 4 (Canvas-only runtime).
§0–§11 are unchanged: the first 45,418 B have SHA-256 `30482dc238068868f3948647270dc1e46b6422f9eadf06f8be1032a4338b4ae0`.
This is a plan. It grants no edit and no runtime. I ran no test, Docker, build or runtime command. Under `tests/**` and the product paths, HEAD is equal to C8 (`git diff` against `5561e8f` is empty), so the line numbers below are C8 lines.
Evidence reuse: I used the Lead-verified bindings of the continuation brief and of QA's v3 diagnosis (`…/judge/round2/r2-s-dead-failure-analysis-v3.json`, 181,589 B, `17dec36adb1c6ddd1798ccd258847970e112c201c0b2873836c8cf4e15d7cbf4`). I read the two app logs directly: round 2 `…T19-23-57-487Z/service-logs/cogniate-app.jsonl` (740,688 B, `6fb0a073150e13d05541ce0c5780075c278a9343f50c6b50980009345346e2d1`, r2 index line 18) and round 1 `…T18-54-44-439Z/service-logs/cogniate-app.jsonl` (742,107 B, `7cd1e4b360f9c9f6d79455fe11dc1d454c9d29259344d7550481428bc267635e`, r1 index line 17).

### 12.1 Facts

1. Round 2, `M1-37.canvas.s-dead`, app log: 2177 `grant_attempt_started` 19:34:23.188; 2178 S2 `POST` 201 at 23.240; 2179 `service_stopping` SIGTERM 27.024; 2180 `outbound_blocked` `PATCH` reason `timeout` 28.246 (same trace); 2181 `http_request` `POST` 502 28.248 (same trace); 2182 `service_started` 32.246. So the old process logged the timeout and the 502 after its SIGTERM. The retry then got 200, not 409 (`canvas/51-canvas-races.test.ts:303`).
2. Round 1, same case (control): 2180 attempt 19:04:47.531; 2181 S2 `POST` 201 47.542; 2182 SIGTERM 50.210; 2183 `service_started` 55.223. No timeout and no 502 from the old process.
3. QA v3 margins, attempt to SIGTERM, R1/R2: Canvas `d` 2.267/0.938 s, `v4` 1.156/1.056 s, `v6` 1.711/1.131 s. S3 start to SIGTERM for `s-dead`: 2.670/3.778 s. No other Canvas case logged a timeout before the next start. The Blackboard cases did not run in these rounds.
4. C8 source. `restartApp()` (`M1/common/snapshot.ts:87`) sends host action `m1-restart`. `tests/host/m1-control.mjs:34-38` runs the guarded `npm run stack:restart -- cogniate-app`. `infra/scripts/stack-restart.sh` takes the lock, runs `dc config`, `prepare_content_folders` and a one-shot storage-preflight container (`lib.sh:395-402`). Only then does `up --force-recreate` (`:74`) send SIGTERM. `closeOnSignal` (`packages/shared/src/http.ts:48-56`) logs `service_stopping`, closes the servers and exits after at most 2,000 ms. It does not stop in-flight work. Each LTI call has a 5,000 ms timeout (`packages/shared/src/outbound.ts:148`); `POST` and `PATCH` get one attempt. On an LTI failure, `fail()` (`services/cogniate-app/src/app/redemption.ts:172-177`) clears the lease, ends the attempt as failed and answers 502.
5. Blackboard `d` and `o` (`blackboard/50-races.test.ts:102-115`, `:213-227`) call `host('m1-restart')` directly. Blackboard `v5` (`blackboard/52-snapshot.test.ts:49-62`) calls `restartApp()`. The mechanism is the same. Only Canvas `v4` and `v6` have a guard (`canvas/52-canvas-snapshot.test.ts:71-73`).

### 12.2 Diagnosis (accepted by the Lead)

- **Test-harness defect, not a product defect.** `restartApp()` makes a dead handler only if the old process exits before its held LTI call times out. So SIGTERM must come less than about 3 s (5 s timeout − 2 s drain) after the held call starts. The guarded restart needs 1–4 s before it sends SIGTERM, and host load changes this time. In round 2 it needed 3.70 s from the host action start (19:34:23.322) to SIGTERM, and the margin was lost.
- When the margin is lost, the handler is alive. It then does what app contract §4.7.1 requires of a live handler: no more calls, lease cleared, attempt failed, 502, grant not redeemed. The retry then redeems once, as in `s-retry`. Do not change product shutdown or timeouts.
- Inferred, not logged: the exact exit time of the old process, and the `clearLease` write itself. The 502 from `fail()` and the later 200 show that write.
- **AR-M3-SD-01 (MAJOR, tests only):** the seven dead-handler cases depend on host timing. Further M1 acceptance is blocked until they are repaired. No product finding.
- **Earlier PASS results are sound.** In each case, a cleared lease makes the main assertion fail: 409 `GRANT_IN_USE`, grant `redeeming`, or `fenced` with the early release refused. So a PASS shows that the dead state occurred. The defect can cause a false FAIL, never a false PASS.

### 12.3 Repair (tests only; owner: QA role, charter §1 `tests/**`; the Lead names the instance)

Fault model: a dead handler is a process that stops without cleanup. Send SIGKILL, then run the unchanged guarded restart. The lease that phase 1 committed stays in SQLite. The kill now has the full 5 s budget, and the preflight time of the restart no longer counts.

Exactly six paths change. `restartApp()`, the type of `host()`, all `M1/common/*` files, `canvas/browser.ts`, product and infra paths stay byte-identical.

| Path | Change |
| --- | --- |
| `tests/host/m1-control.mjs` | Insert one block after the compat-marker refusal (`:29-33`) and before the existing `m1-restart` branch (`:34`). It runs only for `action: 'm1-restart'` with a `mode` field. A `mode` other than `'kill'`, or a service other than `cogniate-app`, returns `code: 2` and runs no command. Else: (1) `docker` with the existing `compose` arguments plus `kill -s SIGKILL cogniate-app`, `cwd: r.CLONE`, `env: r.STACK_ENV`, `timeoutMs: 30_000`; (2) only if (1) exits 0, the same `npm run stack:restart -- cogniate-app` call as `:35-37`, with the same env and timeout. Return the restart result, or the failed kill result. Its first stdout line is `kill: exit <code>, <start ISO>–<end ISO>`, and `durationMs` covers both steps. The QA-project, `h1Verified` and compat-marker guards apply first and do not change. Pure insertion: no existing line changes. |
| `tests/host/m1-control.selftest.mjs` | Add tests that use the injected `runCommand`: kill, then restart, with exact arguments and env; a failed kill gives no restart; `lti-service` with a mode, or an unknown mode, gives code 2 and no call; the compat marker refuses with no call; a non-`qa-` project gives code 2 and no call. Existing tests do not change. |
| `tests/acceptance/M1/canvas/51-canvas-races.test.ts` | Add `host` and `urls` to the `../common/client` import. Add helper K. `:136` (`d`) and `:299` (`s-dead`): `restartApp()` → `killApp()`. Add guard G after the kill. |
| `tests/acceptance/M1/canvas/52-canvas-snapshot.test.ts` | Add `host`, `httpsRequest`, `poll` and `urls` to the import. Add helper K. `:70` (`v4`, `v6`): `restartApp()` → `killApp()`. The existing guard `:71-73` is G. `:93`, `:147` and `:150` keep `restartApp()`. |
| `tests/acceptance/M1/blackboard/50-races.test.ts` | `:105` (`d`) and `:216` (`o`): add `mode: 'kill'` to the payload `{ service: 'cogniate-app' }`. Use G in place of `await first;` on `:106` and `:217`. |
| `tests/acceptance/M1/blackboard/52-snapshot.test.ts` | Add `host`, `httpsRequest`, `poll` and `urls` to the import. Add helper K. `:56` (`v5`): `restartApp()` → `killApp()`, and G in place of `await first;`. `:95`, `:192` and `:193` keep `restartApp()`. |

Helper K is one copy in each of the three files, with the same text. It is `restartApp()` with the kill mode:

```ts
/** AC-M1-37 dead handler: SIGKILL, so the old process cannot let its held LTI call time out and clear its lease. */
async function killApp() {
  assert.equal((await host('m1-restart', { service: 'cogniate-app', mode: 'kill' })).code, 0);
  await poll(async () => {
    try { return await httpsRequest(urls.app + '/healthz'); } catch { return { status: 0 }; }
  }, (r) => r.status === 200, 20_000, 100);
}
```

Guard G is the reviewed `v4`/`v6` text:

```ts
const firstAnswer = await first;
assert.notEqual(firstAnswer?.json?.details?.message, 'LTI_SERVICE_ERROR',
  'BLOCKED: the old handler timed out before the restart killed it');
```

`coverage.mjs:92` reports a failure with `BLOCKED:` as BLOCKED. So a lost precondition can never become a PASS or a product FAIL.

Rules:
- Keep every existing assertion, title, case id, deadline, `leaseWindow` call, `pause` and late-write control. Add no retry, timeout argument, `test.slow` or other wait. Keep existing import names, also an import that becomes unused (the tests config has no `noUnusedLocals`).
- Use the kill only at these seven points. At each point, the held redemption is the only in-flight app work.
- Residual: if the host stalls for more than about 5 s between the held call and the kill, G gives BLOCKED. That stops the round for a Lead decision. It is not a reason to retry.

### 12.4 Host-only validation and reviews (before any runtime)

| Check | Who | Pass rule |
| --- | --- | --- |
| Exact diff | QA, both reviewers | C8 → C9 = the six paths. The `m1-control.mjs` diff is one inserted block. C9 = C6 outside `docs/**` and `tests/**`. |
| Self-test and typecheck | QA | `m1-control.selftest.mjs` passes. The tests typecheck exits 0. |
| Inventories | QA | `run-m1.mjs --harness-only` (no Docker) shows the C8 values: 416 original ids, 488 rows per round, the same `PHASE_TOTALS`. The seven titles do not change. |
| Send sites | Both reviewers | A `mode` field is sent only at the seven sites. No M2, T7, storage or other M1 file sends it. |
| Lens A | Reviewer A | SIGKILL makes the AC-M1-37 dead handler. The phase-1 lease survives a kill. G semantics. The storage preflight after a kill: confirm from source that the ADR-012 §5/§6 refusal rows read volumes, journals and identities, not process state or `-wal`/`-shm` content (my inference). No product change is needed. |
| Lens B | Reviewer B | No assertion is removed or weakened. Existing controller branches and common files are byte-identical. The reach statements of §12.6 hold. |

Two blind reviewers: not this Architect and not the editor.

### 12.5 Runtime selection, counts and ledger (needs a new Lead route, E-R6, and a grant for each invocation)

**Recommended:** two rounds, each one invocation of `run-m1.mjs --phase sim --provider all`, at product C6 and tests C9. Each round has all 394 `sim` rows: 26 common (25 api + 1 host) + 136 Blackboard (api) + 232 Canvas (225 api + 7 browser) = 387 non-browser + 7 browser. All seven repaired cases are in it. This is the `sim` phase of the accepted full2 rounds, run alone.
**Alternative:** in each round, `--provider canvas` (258 = 26 + 232) and `--provider blackboard` (162 = 26 + 136). This needs four invocations, not two, and the 26 common rows run four times.

The Blackboard rows must run fresh, because two of their files change. With either choice, the v4 Canvas launcher changes in more than its identity lines (selection and expected count). Freeze it again as v5 with the C9 pins and new diff-path guards: C8 → C9 = the six paths; C6 → C9 and C4 → C9 = the four earlier test paths plus these six. The product guards do not change. A focused launcher review is necessary.

Pass rules for each round: every row PASS; zero SKIP or BLOCKED; W1–W4, sampler, cleanup and scans as written. The two rounds have exact per-case equality.
Judgments: the independent Canvas QA judges the 232 Canvas rows of each round (rule unchanged). The 162 common and Blackboard rows use the rule that accepted them in full2; the Lead names the judge. For each of the seven repaired cases, the judge records from primary logs: the held call start (gate event), the `kill:` line of the host action, and that the old process logged no `outbound_blocked` and no `http_request` for the first attempt's trace before the next `service_started`.
Shared host: E-R5 §11.6 rules carry into E-R6. If a foreign block overlaps an invocation, the whole-invocation score reconciliation of §11.6 item 1 also covers these Blackboard rows: `M1-11.blackboard.best-scorm12` and `best-html` exactly two POSTs (80, 90); `M1-11.blackboard.scorm-incomplete` and `html-incomplete` none; `M1-33.blackboard.status-400` and `status-422` exactly two (failure, then Resend); `M1-18.blackboard.disconnect` and `M1-38.blackboard.a` none for the pending publication. Blackboard has no browser row.

M1 ledger (488 unique rows):

| Set | Rows | Source |
| --- | --- | --- |
| `sim` | 394 | fresh, the two C9 rounds |
| `snapshot-isolated` | 6: 5 Blackboard + the 1 Canvas snapshot row (kept separate) | carried, C4 full2 |
| `snapshot-upgrade` | 6 | carried, C4 full2 |
| `migration` | 12 | carried, C4 full2 |
| `storage` | 70 | carried, C4 full2 |

The carried total is 94, not 230, because the 136 Blackboard `sim` rows no longer carry. Each carried row stays listed with its full2 run. Correct claim: "394 fresh `sim` rows plus 94 carried C4 rows". Incorrect claims: "fresh 488" and "fresh 233 Canvas" (232 are fresh, 1 is carried).
Preserved as history, not counted: C8 Canvas SIM round 1 (258 PASS, index `4626b76287976982384df48149660693da8720f7f73a19832f1a11b117e49620`), round 2 (257 PASS + 1 FAIL, index `4f6e27a14fe9c933d3b7970120e1c963868325baa612124716248c258a536522`) and the round-1 reconciliation at `09510c8`.

### 12.6 Evidence that stays accepted; M2 and T7

- **Legacy (E-R4, `26797fd`)** stays accepted at C8. `run-m1.mjs --phase legacy` (`:201-216`) only starts `run-t*.mjs`. No legacy runner or spec loads a changed path.
- **94 carried rows:** their test files do not change. They reach `m1-control.mjs` only through existing actions without `mode`, so the inserted block never runs for them. Helper K adds no top-level side effect, so collection of the changed files does not change.
- **M2 and T7** can run now at tests C8 and product C6, in parallel with the repair, under a separate E-R6 route and a grant for each invocation (Lead `msg_7e411091ca22`). They do not depend on the repaired commit. M2 loads `m1-control.mjs` (it sends only `m1-profile`), `canvas/browser.ts`, `canvas/browser-diagnostics.mjs` and `common/coverage.mjs`. T7 loads `browser-diagnostics.mjs`. The repair changes none of these, except for the inserted block. At the final binding, verify: (1) C8 → C9 is exactly the six paths; (2) the `m1-control.mjs` diff is a pure insertion that only a `mode` field reaches; (3) no M2 or T7 file sends `mode`; (4) C9 = C6 outside `docs/**` and `tests/**`. Then state: "M2/T7 actual run C8; equivalent at C9 for M2/T7; product C6". If the repair changes any other path, or product code, M2 and T7 must run again.
- Do not let runtime phases overlap each other. Our own load can make deadlines fail (§11.2).

### 12.7 Open for the Lead

- The E-R6 route, the selection choice of §12.5 and the judge for the 162 common and Blackboard rows.
- The QA instance that implements, and two blind reviewers.
- AC-M4-06 stays PENDING. Real-LMS rows stay UNVERIFIED and local Canvas stays DEFERRED.

## 13. M2 attempt 3 lane-monitor failure, repair and retest; corrections to §12 (2026-10-23, about 02:37–03:05 UTC)

Author: Architect, Claude Code Opus 5.5 (`claude-opus-5-5`), xhigh. Task `task_9e46ef359386`, dispatch `ctx_957b549f0798`, run `run_ebe671ad72a9`. This is an architecture assessment. It is not a blind review, and it does not accept or grant anything.
Authority: Lead `msg_d168894a65f3`, `msg_f0bdf5454a99`, `msg_d3795c20f318`, `msg_c370492d63c1` and `msg_c6e6b7476fc3`. My interim was `msg_5a9994c68d2d`, and the Lead accepted its direction in `msg_c6e6b7476fc3`.
§0–§12 are unchanged: the first 60,809 B have SHA-256 `0bae7b7b6e809ae82d7f3b8362e3379dc52cd66a6349936693e2a7331de41172`. I ran no test, Docker, build or install.

R = `/Users/quangnguyen/cogniate-canvas-qa-runs/verification-5561e8f-c8R3Prep`. ART = `R/source/tests/host/artifacts/qa-e2e-sim-r6-5561e8f7-2026-10-23T02-20-19-399Z`.
I used the raw runtime files only. I did not use the closure manifest, because its metadata is being corrected (`msg_c370492d63c1`). The one exception is item 6 below.

| File | Bytes | SHA-256 |
| --- | --- | --- |
| `R/m2/lane/summary.json` | 642 | `c5047ee8013849e90342a4b35a2db4944f25506eb9fdd8edd5c5afbb16c9a512` |
| `R/m2/lane/lane-ownership.json` | 8,000 | `67e9b662d595b55b880a2179ec9bf50188013c46ea51564238d2adc5f6122ad9` |
| `R/m2/lane/watch.jsonl` | 228 | `fb216c13eaf1ad81af0455d0dfe6b848471732b1660fc7ee9b6b07fa44b7f870` |
| `R/m2/lane/events.jsonl` | 10,479 | `c3a0c45fab730322a264d94750de0b4ce1c9697b9dc80d5cb65bbbf3b4de2426` |
| `R/m2/lane/ledger.jsonl` | 8,059 | `81d3a34d37f30c067c9a251a18fc6fc2206e59ced7215c009f3a260c735cf4e8` |
| `ART/summary.json` | 21,360 | `a8f31c5525be4d767f426a9a88255b6e4eb80943bcb7929a3fb43fcc9467a47a` |
| `ART/lane-ownership.json` | 20,927 | `1631ce96fd84e06b2bbe88620fb7756202aa167235570fa11cee2b877502f6b5` |
| `ART/cmd/10-stack-down.log` | 1,950 | `10a35053b7f17fa080d5e98cff04a506cd9659f17fb33322ce64ebc7c5e115a1` |
| `R/tools/lane-watch/lane-watch-core.mjs` | 21,712 | `7bca56c5e5416646a63f0b70c03e91d9e2b846bf974729e8cc341dfeabae952e` |
| `R/tools/lane-watch/lane-watch.mjs` | 6,170 | `9090ce248251e430a4552ca2d3a4b85afe91be62ed905d844b3f0ace18ed33fb` |
| `R/tools/lane-watch/lane-watch-selftest.mjs` | 24,341 | `171b92b1af9556cb89c0ad36ae601ea3505591954f5c33a1d2899dce2b19ac82` |

`tests/host/storage-docker.mjs` has the same blob, `3a4fbc4bf64bf078a70a2a6450f409707bf87a7f`, in C8, in C9 and in the run's source clone.

### 13.1 Facts

1. `summary.json`: `isolationPass` is false only because `ownershipErrors` is 1. Every other input of the formula holds: clone bound, live end, identity, protected records, networks, Docker settings and non-lane containers unchanged; `everNotMadeByRun` 0; lane end 0/0/0; Build Runner 0; `endErrors` empty.
2. `watch.jsonl` line 2: `ownership_error`, label `poll`, error `StorageBlocked`, at 02:23:41.097.
3. `events.jsonl` has 23 create events, `ledger.jsonl` and `lane-ownership.json` have 23 records (all `madeByRun` true), and there are 23 destroy events. The ids match one to one. The last create was at 02:22:07.357, and the event child did not end early.
4. Chronology. The runner's own `npm run stack:down` (`ART/cmd/10-stack-down.log`: exit 0, 4,071 ms) ends with "postgres-1 Removed", then "Network qa-e2e-sim-r6_default Removing", then "Removed". Its container destroy events run from 02:23:36.487 to 41.041. The network destroy event is at 41.127 (`timeNano`) and the volume destroy events are at 41.414–41.518. So the error came 30 ms before the network destroy event. The runner's own ownership record has `ledgerErrors: []`, kept 0 and failed 0, and TEARDOWN is PASS.
5. Source. In `lane-watch-core.mjs`, `:67` and `:170` keep only `e.name` of a listing error, and `private/` is empty. The failed Docker call and its stderr were not captured. `listLane` (`storage-docker.mjs:212-247`) lists first and then inspects. When a bulk inspect fails, it inspects one by one, and it treats an item as gone only when the stderr matches `/no such/i` (`:234`).
6. Post-run and outside the window (QA closure report; not runtime evidence; its metadata is under correction): on Docker 29.9.1, a missing container gives "No such container", a missing volume gives "no such volume", and a missing network gives "network <id> not found".

### 13.2 Inference (not proven)

The poll listing probably ran `network ls` while the lane network still existed. It then ran `network inspect` after Docker had started to remove that network. The one-by-one inspect got "network … not found", which `/no such/i` does not match, so `listLane` threw `StorageBlocked`. Facts 4–6 support this, but fact 5 means it is not proven. A failed `ls` or a failed volume inspect is less likely, but it is not excluded.

Exposure: any listing that runs while lane resources are being removed.
- In M2 observe mode, the poll and event listings run during the runner's own `stack:down`.
- In T7 teardown mode, the event child stays live during the tool's own `stack:down` (`lane-watch-core.mjs:214-216`), so event-triggered listings run during the removal.
- M1 is not exposed. `core.mjs:117-121` lists only after each command has ended, and its teardown listing comes after `stack:down` (`:380-384`). The V4/v5 boundary tools do not call `listLane`.

### 13.3 Disposition: one rerun after the repair; no narrow acceptance

- The lane check is a required control as written (E-R6, "Host window and resource conditions"). The tool's design never proves absence from events alone (`lane-watch-core.mjs:11`). Only fact 3, which comes from events, could close the gap in attempt 3. So accepting attempt 3 would waive a required control. That is not an architecture finding, and I do not recommend it: the cause was not captured, and a rerun is short (runner 02:20:19–02:23:41).
- Attempt 3 stays monitor FAIL and M2 NOT ACCEPTED. Its 64/64 cases and seven runner gates stay as supporting history only. Its original files, the wrapper exit 1, the 37 qualified tools and the 84-entry manifest stay untouched.
- **AR-M2-LW-01 (MAJOR, QA tool):** a concurrent lane listing cannot prove that an own resource vanished between list and inspect. The required check can then fail during an own teardown. This blocks M2 and T7 acceptance until the tool is repaired. No product or C8/C9 test finding.
- **AR-M2-LW-02 (MINOR, deferred):** the vanish text rule of `listLane` does not match the Docker 29.9.1 network text. No sequential caller can reach it. Fix it at the next permitted harness change, together with B-M1-DH-01. Do not reopen C9 for it.

### 13.4 Repair (QA tool only, in a fresh directory)

Owner: the independent QA session that runs M2 and T7 (the Lead names the instance). Then one focused independent tool review.
Copy `R/tools/lane-watch/` to a new directory `R/tools/lane-watch-r4/`, with mode 0700 for the directory and the scripts. The old directory and all its files stay byte-identical.
- `lane-watch.mjs`: a byte-identical copy (it imports `./lane-watch-core.mjs`).
- `lane-watch-core.mjs`: the only logic change, inside the `observeSoon` step.
- `lane-watch-selftest.mjs`: the copy, plus the cases below.
- A new 3-file hash manifest for this directory. The old tool manifests stay as they are.

Logic, in the same chained step as the failed listing:
1. Each `sd.listLane` call gets a fresh recording wrapper around `docker`. The wrapper remembers every call of that listing with a non-zero exit: argv, exit code and stderr.
2. On a listing error, append one private record (`private/listing-errors.jsonl`, mode 0600). It holds the label, `e.name`, `e.message`, the failed calls and the result of step 3. Public files get no stderr.
3. Classify the error as an **own vanish** only if all of these hold:
   - (a) `e.name` is `StorageBlocked`, and `e.message` equals `Cannot inspect <kind> <id>` (`storage-docker.mjs:234`), with `<kind>` `network` or `container`.
   - (b) The last failed call is exactly `[<kind>, 'inspect', <id>]`, and its stderr does not match `/no such/i`. Every other failed call of the listing is either the bulk `[<kind>, 'inspect', …ids]` that contains `<id>`, or a single `[<kind>, 'inspect', x]` whose stderr matches `/no such/i`.
   - (c) The ledger already has a record of `<kind>` with Id `<id>`, and no record of that Id was ever `madeByRun: false`.
   - (d) Exactly one immediate confirmatory `sd.listLane` succeeds (with its own wrapper), is observed into the ledger like any listing (label `<label>-confirm`), and does not contain `<id>`.

   Then append the public event `listing_vanish` with the label, kind and id to `watch.jsonl`. This does not count as an ownership error.
4. In every other case, record the ownership error exactly as today: `err(label, e.name)`.

Negatives, each fail-closed with one ownership error and no further listing:
- **failure:** the confirmatory listing throws, or it still contains `<id>`.
- **foreign:** `<id>` was never in the ledger, or some record of it was ever `madeByRun: false`.
- **multi:** any other failed call in the listing, for example an `ls`, a volume inspect, another kind or id, or a second non-"no such" single inspect.
- **other:** any error other than `StorageBlocked`, or a message that is not the `:234` text.

Unchanged: the summary fields, the `isolationPass` formula, R1–R3, W1–W4, the poll interval, the event child, the teardown order and every other tool. No general retry loop and no new collector.

New selftest cases:
- all four conditions → no error, one `listing_vanish`, and the confirm listing is observed;
- each negative above → exactly one ownership error;
- no stderr in any public file, and the private file is mode 0600;
- the existing cases pass unchanged.

### 13.5 Retest and dependency mapping

- **M2:** one new invocation at tests C8 and product C6, under a new grant, with the window script changed only to the `lane-watch-r4` path and to new unused output paths. All other E-R6 conditions and checks stay as written. Monitor pass rule: `isolationPass` true as written. Each `listing_vanish` needs its private record with (a)–(d), and the judge also finds the destroy event of that id in `events.jsonl` (corroboration only).
- **T7:** uses the same `lane-watch-r4` in teardown mode, with no other change.
- **M1:** no dependency. C9, the v5 launchers and their two approvals stay as they are.
- **Legacy (E-R4):** no change.
- **Not changed:** C8, C9, the product and `tests/host/storage-docker.mjs`.

### 13.6 Corrections to §12

- **§12.6 (Reviewer A, A-DH-02):** "it sends only `m1-profile`" is wrong. M2 also sends `m1-cli` through `canvas/browser.ts:65` (`hostAction('m1-cli', …)`). In C9, the `m1-cli` branch (`m1-control.mjs:18`) comes before the inserted block (`:34`), and the `m1-profile` branch (`:60`) comes after it. Both are unchanged. So equivalence check (2) reads: "a pure insertion that only `m1-restart` with `mode` reaches; the `m1-cli` and `m1-profile` branches are unchanged". The conclusion does not change. The carry sentence is only a static precondition until actual M2/T7 results exist (B-M1-DH-05).
- **§12.5 judge record (Reviewer A, A-DH-03):** the app log sink is asynchronous, so a SIGKILL can lose its last lines. The "no `outbound_blocked` and no `http_request` of the first trace" check is corroboration only, never a pass rule. A PASS rests on the lease assertion.
- **§12.3 and §12.4 (Reviewer A, A-DH-01):** the dead-handler setup is now stated in the three architecture files (§13.7). B-M1-DH-01 (no-mode `cogniate-app` self-test) waits for the next permitted harness change.

### 13.7 Clarifications appended to the architecture files

Each file gets one dated section at its end, and its earlier text is unchanged. None of them changes a product rule, an acceptance outcome or an assertion. Sizes and hashes are in the Lead handoff.
- `docs/architecture/tasks/M1.md`: for AC-M1-37 (d), (o), the (s) dead-handler variant and (v4)–(v6), "`stack:restart -- cogniate-app`" means the QA kill mode: SIGKILL, then the unchanged guarded restart.
- `docs/architecture/contracts/cogniate-app-api.md`: the §4.7.1 row "App stops during a call" covers a handler that ends without its failure path. If a graceful stop lets the held call reach its 5 s timeout first, the handler is alive, and the "LTI failure" rule and the "held past 5 s" row apply.
- `docs/architecture/adr/ADR-012-sqlite-volume-storage.md`: §7 lists the QA kill mode next to the QA `stop`/`start` row.

### 13.8 Status

M2 is NOT ACCEPTED. T7 has not run. The M1 v5 rounds wait for their own grants. AC-M4-06 stays PENDING. All 32 real-LMS rows stay UNVERIFIED, and local Canvas stays DEFERRED.

## 14. Accepted amendment LW-R-01 to §13.4 (2026-10-23, about 03:57–04:00 UTC)

Author: Architect, Claude Code Opus 5.5 (`claude-opus-5-5`). Task `task_3d6c622e0a24`, dispatch `ctx_cec474b5919e`, run `run_ebe671ad72a9`.
Authority: the Lead's acceptance in `msg_30bbc088a7ab` and `msg_8ba7ddcd0876`, recorded in E-R6 at `84e1462` and `5ecf069`. The focused tool review is `docs/reviews/M3/lane-monitor-review.md` (`b84b53e`; 19,923 B, SHA-256 `1f9e8c919378663a55b463b45b1702f74e380c5998a2c83f353182b559965d4d`): APPROVE, 0 BLOCKER, 0 MAJOR.
§0–§13 are unchanged: the first 73,541 B have SHA-256 `0869e4631bc068bb8e8ca77f0e64055340e0f1828227a23c19ff1203add3e52b`. This section records an accepted decision. It is not a new design.

- **Replaces §13.4 condition (b) for a network vanish only.** `listLane` inspects containers before networks (`storage-docker.mjs:218-235`). In a teardown, the container inspect can therefore fail before the network inspect. The failed calls of the listing may start with one failed container bulk inspect, followed by one or more single container inspects for unique ids from that bulk list, each with stderr matching `/no such/i`. These are the failures that `listLane` itself already accepts. After them come the network bulk inspect and the final single network inspect, as in §13.4(b). For a container vanish, no prefix of another kind is accepted.
- **Unchanged:** conditions (a), (c) and (d); exactly one confirmatory listing; every negative of §13.4 fail-closed; no retry loop; no new collector; no change to a summary field or to the `isolationPass` formula.
- **Evidence handling (accepted with the amendment):** the private error record keeps argv, exit code and stderr. It never keeps stdout. Public files never get stderr.
- **Pinned result** (C8 preparation root): `tools/lane-watch-r4/lane-watch-core.mjs` `d7b962b6e6ebefc5eb6f2ac9212f0368c556c233cff56cbf7174937414847561` (the amendment is at `:177-180`); `lane-watch-selftest.mjs` `e7064c25ad7e54557eb5c11377ca20982fa08b7cd699da3509c04f09a88dc40d` (39 checks and 54 scenarios PASS, including `s13-vanish-mixed-kind-positive`); `lane-watch.mjs` byte-identical to the original (`9090ce248251e430a4552ca2d3a4b85afe91be62ed905d844b3f0ace18ed33fb`). The 37 original tools, the 84-entry manifest and `tests/host/storage-docker.mjs` are unchanged.
- **Judge step (review N7):** for each `listing_vanish`, the judge records the bytes and SHA-256 of `private/listing-errors.jsonl` (not its content), conditions (a)–(d) and the destroy event of that id.
- **Retest identity:** M2 runs once more at tests C8 and product C6 on the new lane `qa-e2e-sim-r7` (port 8643, subnet `172.27.0.0/16`) with fresh paths, through `notes/scripts/run-m2-window-attempt4-v5.sh` (`b8bda7964aad3e9aa7f1a130036238b0a396f3ca12cb034a8049dd77fc509689`). T7 runs through `notes/scripts/run-t7-window-v2.sh` (`1c884fdfec60a849c6f57410f7b62b28bdd37fc0d29c89510c40e4910e73d48f`) on `qa-e2e-m3-r3` (port 8543, subnet `172.31.0.0/16`). Each still needs its own grant. The nonblocking review items N1–N7 keep the dispositions recorded in E-R6.

## 15. T7 beside a continuously active foreign project: route proposal E-R8 (2026-10-23, about 12:09–12:17 UTC)

Author: Architect, Claude Code `claude-opus-5-5` (the effort setting is not visible in the session). Task `task_5eeaa543c47b`, dispatch `ctx_8e0b8f913da4`, run `run_ebe671ad72a9`. Lead checkpoint `bd6b7260`.
Authority: the dispatch and Lead `msg_8af9966a844b`. My early recommendation was `msg_c3cd829f2f35`. This section replaces it where they differ.
§0–§14 are unchanged: the first 76,657 B have SHA-256 `455ab9b4fe7ec0b907726b0ebc04e338b21ca1e9c5e0408a38290838d1a0219c`.
This is a plan. It is not a grant, and it changes no test, assertion, deadline or criterion. I ran no Docker command, test, build or install in this task. I read only files.

R = `/Users/quangnguyen/cogniate-canvas-qa-runs/verification-5561e8f-c8R3Prep`. Frozen tools read (SHA-256 prefixes):

| File | SHA-256 prefix |
| --- | --- |
| `tools/boundary/live-boundary.mjs` | `dc5f636c1adf92dd` |
| `tools/boundary/live-boundary-core.mjs` | `df868d548811c288` |
| `tools/boundary/safe-docker.mjs` | `49516eac1779dcd6` |
| `tools/boundary/docker-sampler.mjs` | `fcf1ce38fc826595` |
| `tools/lane-watch-r4/lane-watch-core.mjs` | `d7b962b6e6ebefc5` |
| `notes/scripts/reconcile-32vol.mjs` | `55f2a09bd7934532` |
| `notes/scripts/run-t7-window-v2.sh` | `1c884fdf…` |

Also read: C8 `tests/e2e/host/run-t7.mjs` and `tests/host/lib.mjs`.

### 15.1 Facts and invalidated assumptions

- **One Docker engine.** I read only files and ran no Docker command:
  - `~/.docker/contexts/meta/*/meta.json` holds one context, `desktop-linux` (`unix:///Users/quangnguyen/.docker/run/docker.sock`).
  - `~/.docker/config.json` has `currentContext` `desktop-linux`.
  - `/opt/homebrew/bin` has no colima, podman, orb, lima, nerdctl or rancher. `~/.colima`, `~/.orbstack`, `~/.lima` and `~/.local/share/containers` are absent. `/Applications` has no OrbStack, Rancher or Podman.
  - So a separate engine needs new setup, which is out of scope.
- **Anonymous volumes.** On this engine they carry the label `com.docker.volume.anonymous` (`R/t7-external-preflight/w3-start.json`). 25 of the 32 baseline records are such volumes. So the label alone does not show who owns a volume.
- **Invalidated assumptions:**
  - The E-R6 rule "no foreign mutation during the window": Savoy will not pause (`msg_987ebb0a6be7`).
  - The E-R5 owner chronology: Savoy will not list resources per window (`msg_293cd9f61de2`).
  - "The frozen v2 path can pass as written beside an active Savoy": see 15.2.

### 15.2 Why the frozen v2 path cannot pass beside Savoy (each point fails closed; none is an LTI fault)

1. **T3 and T13:** `reconcile-32vol.mjs` requires exactly 32 volumes and no extra one. The script runs under `set -e`, so any extra Savoy volume at W3 stops the run before runtime.
2. **W3 boundary:** `live-boundary-core.mjs` `judgeStart` BLOCKs when any resource vanishes between list and inspect.
3. **Lane-watch start:** `lane-watch-core.mjs` `snapshot` inspects all containers and all networks in bulk. One vanished item makes the record null, so the start is "incomplete" and BLOCKs.
4. **W4 comparison:** `compareBoundaries` reports a problem for any non-lane container, network or volume difference, and for any vanish during the end read.
5. **Lane-watch end:** `nonLaneContainersUnchanged` and `networksUnchanged` are terms of `isolationPass`, and `t7-gate.mjs` requires `isolationPass`.
6. **C8 test code (frozen, residual):** `run-t7.mjs:279` `stackSnapshot` and `images()` use `allContainers()` (`tests/host/lib.mjs:221-231`): `ps`, then one bulk `docker inspect`. One vanished foreign container makes the result `[]`. The "stack unchanged" check of a B-T7-01 or A-T7-04 confirmation can then be false. This is a possible false FAIL. It is not a false pass, because the refusal text, the exit code, the volumes, the seed and the data/log files are also compared.

### 15.3 Which checks prove T7 validity (all stay strict and unchanged)

- **Identity and engine:** G-1 identity (`BOUND`); engine `dockerInfo` keys; the Docker Desktop settings hash.
- **Built-in networks:** `bridge`, `host` and `none` keep the same Id and FULL record from W3 to W4. The sampler sees one bridge Id, equal to the one at W3.
- **Volume records:**
  - All 32 baseline FULL records are byte-equal by name: predecessor W4 = M2 `R/m2/window-attempt4/w4-end.json` (`544142a1…38fd`) = T7 W3 = T7 W4.
  - The 7 original protected records and the 2 preserved anonymous records are identical.
- **Lane:** fresh lane, port 8543 free, no subnet clash with `172.31.0.0/16`; lane-watch R1 (no lane record that is not made by this run), R2 and ownership; the `--keep` proof; teardown, with the lane empty at the end.
- **T7 functional criteria:** three default runs of 17 PASS, only the DEMO skip, all 15 criteria, demo ≤ 180 s (measured history about 8–9 s), the four confirmation and refusal checks, and B-TW-03 before READY.
- **Fixed-wait negative row:** B-T7-01 keeps the §11.6 item 4 evidence: in each confirm-no PTY log, the question comes first, then the echoed "no", then the stop.

The only check that changes is the exclusivity proxy: "no non-lane change at all". It is replaced by "every non-lane change is positively attributed to the Savoy class (15.4); else UNKNOWN, and the run BLOCKs or FAILs".

Corrected claim (replaces "misattribution cannot create a false pass" in `msg_c3cd829f2f35`): by design, an attributed resource cannot touch a lane, protected or engine object without a strict check above failing. This is a design argument. It counts only after the negative self-tests in 15.6 pass.

### 15.4 Positive attribution without per-window Savoy reports

Sources of attribution: our own captures, read in the same listing or snapshot, and Savoy's standing declaration (`msg_293cd9f61de2`). Names alone never classify a volume. **Lane rules come first:** a resource that matches the lane prefix or lane labels is a lane resource, whatever its name.

- **Container.** It is Savoy class only if all of these hold:
  - its name (from the same `ps -a --format` listing) starts with `sto-`;
  - its compose project label is absent or starts with `sto-`;
  - it has no lane or QA label;
  - every volume it mounts is a Savoy-class volume. A mount of any baseline-32, protected, preserved, lane or named volume makes it UNKNOWN.
- **Network.** It is Savoy class only if its name starts with `sto-`, it has no lane label, and its IPAM does not overlap `172.31.0.0/16`.
- **Volume.** It is Savoy class only by **positive linkage**: in the same W3 or W4 capture, a Savoy-class container mounts it. All of these must also hold:
  - it has the `com.docker.volume.anonymous` label, a 64-hex name and no compose labels;
  - it is not one of the 32 baseline, 7 protected or 2 preserved records, and it is not a lane volume;
  - no container outside the Savoy class mounts it in that capture.
  The link is kept in the capture record, so a volume linked at W3 and gone at W4 stays attributed.
  - A volume with no link (for example a leaked LTI anonymous volume, or a Savoy volume left without its container) is **UNKNOWN**.
- **Vanished between list and inspect.** A container or network can be classified only by its own listing row (name and project from `--format`) under the rules above. A vanished volume is UNKNOWN unless the same capture links it. A vanished item with no listing row is UNKNOWN.
- **Raw data is kept.** Every original problem string and count stays in the output. Classification is added beside it as `attributedForeign` (kind, name, id, rule, capture), and it removes no raw record. Incomplete data never stands in for a lane or protected comparison: those comparisons read their own named records, and a missing one is a problem as before.
- **Timing limit:** a Savoy container removed exactly during our capture, while its volume is still listed, gives an unlinked volume. That is UNKNOWN, so a fail-closed stop, never a false attribution. Savoy removes containers with `-v`, so leaks should be rare. This route does not depend on Savoy's cooperation, but it can stop on such a race.

### 15.5 Minimal tool delta (QA verification tools only; fresh directories; originals byte-identical)

Ownership:
- The independent Gemini QA edits **copies of its own QA verification tools and scripts** under R. It changes no repository file, test or product code, so no Codex implementation is needed.
- If the Lead prefers that the judge does not edit its own tools, the same delta can go to Codex as tool work, and Gemini then verifies it.
- One focused, independent Claude review follows. The reviewer is not this Architect and not the editor.

| New file (fresh path) | Change |
| --- | --- |
| `tools/boundary-r2/live-boundary.mjs` | Capture lists with names: `ps -a --no-trunc --format` (id, name, compose project), `network ls --no-trunc --format` (id, name), and volumes as now. It records `vanishedDetail` (kind, id, name, project) beside the counts. For each non-lane container it records only the volume names of its mounts of type `volume`: no paths, env or command. This is a disclosed narrow exception to the safe-docker rule "Mounts are never returned". |
| `tools/boundary-r2/live-boundary-core.mjs` | Add `classifyForeign` with the 15.4 rules. `judgeStart`: a vanish BLOCKs unless the item is classified. `compareBoundaries`: non-lane container, network and volume differences, and end-read vanishes, go to `attributedForeign` only when classified; otherwise they stay problems. Every other rule is unchanged: built-in Ids and records, identity, settings, the original 7, lane leftovers and the sampler rules. |
| `tools/boundary-r2/safe-docker.mjs`, `docker-sampler.mjs` | Byte-identical copies. No sampler change; there is no new collector. |
| `tools/lane-watch-r5/lane-watch-core.mjs` | `snapshot`: non-lane containers from `ps -a --format` (id, name, project) and networks inspected one by one with vanish tolerance, so a vanish no longer nulls the record. `nonLaneContainersUnchanged` and `networksUnchanged` are computed over non-lane resources that are not classified; classified ones are listed in `attributedForeign`. The `isolationPass` formula, R1, R2, the teardown and the start BLOCK rules are otherwise unchanged. `lane-watch.mjs` is byte-identical. |
| `notes/scripts/reconcile-32vol-v2.mjs` | All 32 baseline names are present and byte-equal. Extras are allowed only when they are linked Savoy-class volumes (15.4) in the capture under test. Anything else fails. |
| `notes/scripts/run-t7-window-v3.sh` | Only these changes: the new tool paths; new absent output paths; the **prelaunch hold** of 15.7; the LA pause message ids in `t0`. T0–T14 order, the runner argv, the gate, the scans, B-TW-02 and B-TW-03 are unchanged. |

Also: a new manifest for the new files only. The 84-entry and 6-entry manifests and every original file stay untouched. The self-test outputs print the SHA-256 of the core and the self-test (review N1).

### 15.6 Required self-tests (positives and fail-closed negatives)

**Positives (no problem, each entry listed in `attributedForeign`):**
- A `sto-` container appears or disappears between W3 and W4.
- A `sto-` container or network vanishes during a capture, with its own listing row.
- A linked Savoy anonymous volume is present at W3 and removed by W4.
- A linked extra volume is present at W3 and still present at W4.

**Negatives (each must give a problem, or a BLOCK at start):**
- **Volumes:**
  - a new unlinked anonymous volume (an LTI-style leak);
  - an unlinked volume whose container vanished during the capture;
  - an anonymous volume with compose labels;
  - a new named non-lane volume;
  - a baseline-32, protected or preserved record that changed or is missing.
- **Containers:**
  - an unlabelled non-`sto-` container that appears, disappears, changes or vanishes;
  - a `sto-` container that mounts a baseline-32, protected or lane volume;
  - a `sto-`-named container or network with a lane label or the lane prefix (lane rules apply, and R1 fails).
- **Networks:**
  - a non-`sto-` network that is new, missing or changed;
  - a `sto-` network that overlaps `172.31.0.0/16`.
- **Engine:**
  - a changed `bridge`, `host` or `none` Id or record (VM or engine restart);
  - a change in `dockerInfo` or the settings hash;
  - more than one bridge Id in the sampler.
- **Vanish without data:** an item with no listing row, and a vanished volume without a link.

All existing self-tests of the copied tools must pass unchanged. No assertion becomes weaker.

### 15.7 Prelaunch hold and acceptance rules for the one T7 invocation (input for the Lead's E-R8)

**Prelaunch hold**, in script v3 right after W3 and before T4, the sampler, the checkout and the lane-watch:
- The built-in `bridge`, `host` and `none` Ids and FULL records must equal those in the predecessor W4.
- All 32 baseline records must be byte-equal.
- Every extra must be a linked Savoy-class volume, container or network.
- Otherwise exit 4 (HOLD) before any runtime. The Lead reconciles from the frozen records:
  - Only the E-R6 idle-VM bridge class before W3 may be reconciled.
  - An unlinked extra volume needs specific provenance, such as a recorded mount by a named `sto-` container, or it stays HOLD.
  - A new grant is needed to launch.

**Pass rules:**
- Runner ALL OK, `t7-gate.mjs` PASS (`isolationPass` and `keepVerified`).
- W4 comparison with 0 problems; `reconcile-32vol-v2` ok at W3 and W4; anonymous and original checks ok.
- Sampler: 1 bridge Id, 0 skew violations, at least one sample.
- Secret scan PASS; `map-triggers`; B-TW-02 binder; B-TW-03 before READY; the B-T7-01 PTY evidence.
- **Window rule:** LA pauses from before W1 to after W4, and confirms the whole window.

**Accepted record:** it says "window NOT exclusive", lists every `attributedForeign` entry, and states the C8 run and the C6 product equivalence. It makes no exclusive-host claim.

**Stop conditions** (objective; no automatic retry):
- any UNKNOWN or unclassified non-lane change or vanish;
- any W3, W4, lane-watch or reconcile problem;
- the prelaunch HOLD;
- lane-watch not READY;
- a subnet clash;
- any runner FAIL or BLOCKED.

**Residual C8 false FAIL (15.2 item 6):** if a confirmation step fails, QA diagnoses it from the step text, the runner logs and the sampler. Even when the cause is shown to be an empty `allContainers()` snapshot, the row stays FAIL. A new invocation needs a new explicit Lead decision; there is never an automatic retry or a relabel.

**Practical time:**
- tool delta and self-tests: about 1–2 h host-only;
- focused review: about 1 h;
- window: about 16–20 min (runner 630–695 s, plus W1–W3, checkout and READY about 3–4 min, plus W4, scans and binder about 2–3 min).

### 15.8 Remaining external inputs and blockers

1. The Lead's E-R8 decision. For T7 only, it replaces the E-R6 "no foreign mutation" condition with 15.3–15.7. Every other E-R6 control stays.
2. An LA pause with exact bounds, and LA's whole-window confirmation afterwards.
3. No Savoy input is needed.
4. If the user can obtain a Savoy pause of about 25 minutes, the frozen v2 path can run as written under E-R6, with no tool delta, adding only the prelaunch hold of 15.7.

AC-M4-06 stays PENDING until T7 is accepted. All 32 real-LMS rows stay UNVERIFIED, and local Canvas stays DEFERRED.

## 16. Clarification of §15 (2026-10-23, about 12:20–12:22 UTC)

Author: Architect, Claude Code `claude-opus-5-5` (configured xhigh; the effort is not visible in the session). Task `task_355dd7e713ef`, dispatch `ctx_a32bb83ff51c`. HEAD `bd6b7260`.
§0–§15 are unchanged: the first 92,078 B have SHA-256 `b05cb3423b1a3a5e536cc85ba8f168607a381a51c07bacc9bd7b12f490f42b62`. This section corrects §15.4, §15.7 and §15.8 item 4 where it differs from them. E-R6 still applies; E-R8 is a proposal only. I ran no Docker command.

### 16.1 Attribution: one joint predicate (replaces the §15.4 rules)

**Rule priority:** no false attribution comes before avoiding false failures. In doubt, the result is UNKNOWN, and UNKNOWN BLOCKs at a start capture and FAILs at an end capture.

**Sufficient record:** a full `inspect` record from a W3 or W4 capture of the same invocation. Under the §15.5 delta, a container record holds `Config.Labels`, every `Mounts` entry with its `Type` and `Name`, and the keys of `NetworkSettings.Networks`. A network record holds `Labels`, `Driver` and the IPAM subnets. A listing row (name and project from `--format`) is only an identifier. It never establishes labels, mounts or IPAM. Lane-watch snapshots hold names only, so they attribute nothing.

**Fixed sets:**
- E = the 32 baseline names, the 7 protected originals, the 2 preserved anonymous records, and every lane name or lane label.
- AV(v, S) holds when, in capture S, volume v has a full record with the `com.docker.volume.anonymous` label, a 64-hex name, no `com.docker.compose.*` label, and v is not in E.

These definitions read only raw records, never another classification, so they are not recursive.

**Container predicate SC(c, S):** c has a full record in S, and all of these hold:
1. Its name starts with `sto-`.
2. It has no compose project label, or the label starts with `sto-`, and it has no `org.cogniate.*` label.
3. It is not a lane resource by name or labels.
4. It has no network key of a lane network.
5. Every mount has `Type` `volume` (or `tmpfs`), and every volume mount v satisfies AV(v, S). A bind mount, a named volume or any volume in E makes the result false.

**Volume predicate SV(v, S):** AV(v, S) holds, and:
1. at least one container c with SC(c, S) mounts v; and
2. every container with a full record in S that mounts v satisfies SC.

**Network predicate SN(k, S):** k has a full record in S, and all of these hold:
1. Its name starts with `sto-`.
2. It has no lane label and is not a built-in network.
3. Its driver is `bridge`.
4. None of its IPAM subnets overlaps `172.31.0.0/16`.

**Attribution of a difference between W3 and W4.** A resource present in only one capture, or present in both with a changed record, is attributed only if its predicate holds in every capture that holds it. Otherwise it is UNKNOWN.

**Vanished between list and inspect** (a listing row, but no full record in that capture):
- A container or network is attributed only when an earlier full record of the same id in this invocation satisfies SC or SN. That earlier record must be W3 when the vanish is in W4.
- The identifying attributes it relies on are immutable after creation: labels, mounts, IPAM. Mutable ones (name, network attachment) are covered by the strict lane-empty and lane-network-removal checks, which fail closed.
- A vanish in W3 has no earlier record, so it is UNKNOWN and BLOCKs.
- A volume that vanishes, or a volume whose only mounting container vanished in that capture, is UNKNOWN unless the same capture or the W3 capture gives SV.

**Limit:** containers and volumes created and removed between W3 and W4 appear in no capture. They need no attribution, because no compared record changes. This route proves only what the two captures and their full records show. It does not prove that the window was exclusive.

### 16.2 Zero-tool-delta alternative (replaces §15.8 item 4)

Precondition from the user and Savoy: from the start of the preflight to the end of v2's W4, no `sto-` container, `sto-` network or non-baseline volume exists or changes. Savoy removes its own resources first, including any that remain from 11:58, such as anonymous volume `235243e9…`. We never touch them. If this cannot be met, the zero-delta route is impossible: v2's T3 requires exactly 32 volumes, and E-R6 requires a preflight with no foreign container.

Protocol (no tool or script edit, and no bypass of the grant):
1. **External held preflight.** It uses only the existing frozen tools, unchanged, in a new absent directory `R/t7-external-preflight-<UTC stamp>`:
   - `live-boundary.mjs wake`, `liveness`, and `capture --stage formal-start`;
   - `anon-check.mjs`;
   - `reconcile-32vol.mjs` against the predecessor W4 (`R/m2/window-attempt4/w4-end.json`);
   - a read-only comparison in the existing form of `R/t7-external-preflight/compare-vs-m2-w4-v2.json` (identity, settings, engine, 32 records, foreign containers 0, `bridge`, `host` and `none`).
   It never creates a v2 runtime path.
2. **Lead HOLD decision** on those files. The only difference that may be reconciled is the E-R6 bridge-only idle-VM class. Then the Lead gives the T7 grant (`GRANT_MSG`, `GRANT_DELIVERY`, `PREV_W4` = the M2 W4).
3. **Immutable v2** (`run-t7-window-v2.sh`, `1c884fdf…`), started at once through the existing detached launcher. Its own T3 reconcile, W3 `judgeStart`, W4 comparison, lane-watch and gate stay fail-closed.

Limit: v2 has no check of the built-in networks between the preflight and its own W3; its own W1 wake can still replace the bridge. Without a delta, that gap is reconciled after the run under the accepted M2 C1–C4 rule (bridge-only, before formal W3, from immutable records). If the Lead needs that gap to be a prelaunch hold, the minimum delta is one step in a fresh-path copy of v2: after T3, compare the W3 built-in Ids and records with the preflight record, and exit before T4. That copy needs a focused review.

### 16.3 Used paths and the HOLD (corrects §15.7)

The §15.7 HOLD inside the invocation (exit 4 after W3) would leave created paths behind (`R/t7`, the window files, the clone root). v2 and v3 refuse existing paths, so a new grant could not silently reuse them, and nothing may delete them. Correction:
- The HOLD moves to the **separate external preflight stage** (16.2 step 1, the same pattern under E-R8). Each preflight uses its own new absent directory and creates no runtime path. A HOLD therefore consumes only preflight files, which stay as evidence.
- A runtime invocation starts only after the Lead's decision. Its own W3 checks can still BLOCK. That consumes that attempt's paths.
- **Every new attempt** needs an explicit fresh attempt root and a new grant. For v2, which has fixed paths, that means a reviewed path-only copy. For E-R8 v3, it means a required `T7_ROOT` parameter that must be absent. There is no automatic retry. Earlier attempt files are never reused, moved or deleted.

## 17. Ruling on lane capture sufficiency and the preflight guard (2026-10-23, about 13:35–13:36 UTC)

Author: Architect, Claude Code `claude-opus-5-5`. The configured effort is xhigh per the Lead's receipt; it is not visible in the session. Task `task_ed0712df4567`, dispatch `ctx_0781fcac0fba`. HEAD `765cade5`.
§0–§16 are unchanged: the first 99,037 B have SHA-256 `4cf544579299fb657c9ed7c0fd12b739a3307ed9edcc396e492694d23bc99720`. This section changes §16.1 only where stated, and it records the Lead's ruling `msg_172fc3cfd28e` under §16.2–§16.3. It answers reviewer findings `msg_14d4c2c2b511` and `msg_5494fccf1fa8`. My early statement was `msg_256658ca030b`. I read no candidate or QA test. This is no candidate verdict and no runtime grant.

### 17.1 Lane-watch full-inspect snapshots: admissible, but only in their own pool

§16.1 said that lane-watch snapshots hold names only and attribute nothing. That was true for the §15.5 design. **Ruling:** when `lane-watch-r5` records sufficient full inspect records, its start and end snapshots are sufficient records **for the lane comparison only.**

- **Two evidence pools.** A difference is attributed only from records in its own pool.
  - The **outer pool** is {W3, W4} of `boundary-r2`, used for `compareBoundaries` and `reconcile-32vol-v2` at W3 and W4.
  - The **lane pool** is {lane start, lane end} of one `lane-watch-r5` process, used for `nonLaneContainersUnchanged` and `networksUnchanged`.
  - No record crosses pools. No record comes from the preflight, from another attempt or from another invocation, even for immutable fields.
- **Invocation identity of the lane pool:** both snapshots come from the same lane-watch process and output folder under the same `T7_ROOT`. The start time is earlier than the end time. Both files are bound by size and SHA-256 in B-TW-02.
- **Sufficiency** (per record; any missing, truncated or unparsable field makes the record insufficient, so the result is UNKNOWN):
  - A **container** record has the name, the complete `Config.Labels`, every mount with its `Type` and volume name (empty only if there are no mounts), and the keys of `NetworkSettings.Networks`.
  - For each mounted volume, the full volume record (labels) is in the same snapshot, so that AV can be evaluated.
  - A **network** record has the `Name`, `Labels`, `Driver` and the complete IPAM subnets.
  - Sanitizing may drop env, command, arguments and paths. It may never drop a predicate field.
- **Predicates:** the §16.1 AV, SC, SV and SN predicates apply without change, inside each pool, in **every** capture of that pool that holds the resource.
- **Vanish provenance:**
  - A vanish at W3 or at lane start is UNKNOWN and BLOCKs.
  - A vanish at W4 is attributed only from a sufficient W3 record of the same id.
  - A vanish at lane end is attributed only from a sufficient lane-start record of the same id.
- **Each pool must pass on its own.** An attribution in one pool never excuses a problem in the other. Positive cases are reachable in both pools. For example, a Savoy container that appears after lane start and is present at lane end is classified in the lane pool from its lane-end record. A Savoy resource that exists only between W3 and W4 changes no outer record.
- **Strict checks are unchanged in both pools:**
  - all 32 BASE32 full records, at lane start and lane end, and against `PREV_W4` at W3 and W4;
  - the 7 originals;
  - G-1 identity, `dockerInfo` and the settings hash;
  - the Id and record of `bridge`, `host` and `none`, plus the sampler's single bridge Id;
  - lane R1 and R2, ownership, the `--keep` proof, the teardown and the empty lane at the end;
  - every functional assertion and deadline.
  Raw problems stay visible beside every attribution.

### 17.2 The Lead's preflight and guard ruling (`msg_172fc3cfd28e`, under §16.2–§16.3)

**Chain.** `PREV_W4` (accepted M2 W4) is reconciled explicitly by the Lead into `PREFLIGHT_W3`, the fresh external held preflight. Only the E-R6 pre-W3 idle-VM bridge class may be reconciled. The v3 guard then checks the formal runtime W3 against `PREFLIGHT_W3`; any difference stops the run before T4. The strict comparison and the sampler then check runtime W3 against W4.

**The v3 guard** passes only if all of these hold:
- At the runtime W3, the Id and full record of `bridge`, `host` and `none`, the G-1 identity, `dockerInfo` and the settings hash equal those in `PREFLIGHT_W3`.
- All 32 baseline full records equal `PREV_W4`, at every capture.

**No gap.** Every interval of the chain is checked. A bridge replacement at any time falls into one interval:
- before `PREFLIGHT_W3`: reconciled, allowed class only;
- between `PREFLIGHT_W3` and runtime W3: a stop before T4;
- between runtime W3 and W4: a strict W4 or sampler failure.
There is no after-launch reconciliation in this route. It replaces the §16.2 post-run C1–C4 limit for v3.

**Counterexamples:**
- *Old reference (runtime W3 against PREV_W4):* the 04:35 wake already replaced the bridge relative to M2 W4 (`7dac5c96…` became `b9a014a3…`, `R/t7-external-preflight/compare-vs-m2-w4-v2.json`). Every later attempt would HOLD forever. The refreshed and reconciled `PREFLIGHT_W3` removes this permanent HOLD.
- *Post-run reconciliation:* a bridge change between the preflight and runtime W3 would be found only after T7 had run. The guard finds it before any lane or runner exists.
- *Runtime W1 wake after an idle VM:* the guard stops. That is a false stop, not a false pass. It consumes one attempt.

**Bounded acceptance controls:**
1. One preflight per attempt. Its fresh absent folder and the `PREFLIGHT_W3` SHA-256 are named in the grant. v3 records that SHA-256 in T0 and refuses a different file. A stopped or failed attempt needs a new preflight and a new grant.
2. The Lead's reconciliation record names the only allowed difference: the old and new bridge Id and `Created`, with equal options, IPAM and labels, and identical `host` and `none`. Everything else in the preflight must match `PREV_W4`, or meet E-R6, or be classified under §16.1 within the preflight capture.
3. At runtime W3, every non-lane, non-baseline resource is either identical (same id and full record) to one that was reconciled in `PREFLIGHT_W3`, or classified by §16.1 in runtime W3. Otherwise the run stops before T4.
4. A stop before T4 starts no sampler, checkout, lane-watch or runner. The T0–T3 files stay as evidence under the used `T7_ROOT`. The exit code is distinct, and there is no automatic retry.
5. Launch soon after the grant to avoid idle-VM stops. No keep-alive or other new Docker activity is added.

The approved observer relocation (`msg_32cbc886594d`) changes nothing above. Each attempt uses a fresh `T7_ROOT`, byte-identical observer bytes, a fresh C8 source checkout, a separate pristine runtime clone and B-TW-03. No functional assertion or deadline changes.

T7 has not run. AC-M4-06 stays PENDING. All 32 real-LMS rows stay UNVERIFIED, and local Canvas stays DEFERRED.
