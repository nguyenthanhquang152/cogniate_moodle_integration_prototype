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
