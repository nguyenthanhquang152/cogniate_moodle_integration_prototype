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
