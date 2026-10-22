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
