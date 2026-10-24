# LA-E7-08 LD-9 Addendum (r7): Frozen T8 `AC-T8-10` Combobox Option Race (`WE-F13`)

- **Task**: `LA-E7-08` (LD-9 frozen-test addendum r7 — `WE-F13`: wait for the async combobox option in `tests/acceptance/T8/2-shell.spec.ts` `openPublishDialog`)
- **Date**: `2026-10-24`
- **Author**: QA-3 (`task_0d522933e2a1` / `ctx_9d359ed7d573`)
- **Base commit**: `la-final-test-1` (`85ddf97332063f75bdc5636cb410fc0d6ee25099` in `/Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-final-1`)
- **Scratch clone**: `/Users/quangnguyen/cogniate-qa-runs/LA/ld9-addendum-r7/src-scratch` (`git clone --no-hardlinks` of `/Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-final-1` at `la-final-test-1`; `/Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-final-1` was not modified)
- **Patch artifact**: `/Users/quangnguyen/cogniate-qa-runs/LA/ld9-addendum-r7/ld9-addendum-r7.patch` (`SHA-256`: `fc75ec7dff5ca7bbe95bb77e61aa0a039d5aa79e4c5d4ae2f53a50fe9e9cd2f8`)
- **Item type**: `frozen-test race fix; same class as BD-A1-117; no LA-IC` (`docs/architecture/ltiaas/build-decisions-A1.md` `BD-A1-117`; `docs/architecture/ltiaas/adr/LA-ADR-04-refactor-and-migration.md` D8 `"Not LA changes"` note; `docs/team/ltiaas/plan.md` §6.1 `LD-9` and `LD-25`)
- **Prior LD-9 records**: `docs/reviews/LA-E7-08/ld9-addendum-r3.md` (`WE-F8` M2 label update at `tests/acceptance/T8/2-shell.spec.ts:30,33,34`), `docs/reviews/LA-E7-08/ld9-addendum-r4.md` (`WE-F11` / `BD-A1-117` Publish dialog loading race in `tests/acceptance/T6/3-courses.spec.ts:132`), and `docs/reviews/LA-E7-08/ld9-addendum-r6.md`

---

## 1. Item Type, Governance Classification, and Reason (`WE-F13`)

### 1.1 Item Type and Classification

| Field | Value |
|---|---|
| **Item type** | `frozen-test race fix; same class as BD-A1-117; no LA-IC` |
| **Architect / Lead references** | `BD-A1-117` (`docs/architecture/ltiaas/build-decisions-A1.md`: pre-existing M2 Publish dialog async `/app-api/connections` loading race is a frozen-test race, not an LA behaviour change); `LA-ADR-04` D8 `"Not LA changes"` note; `LD-25` (`docs/team/ltiaas/plan.md` §6.1) |
| **File and lines changed (relative to `la-final-test-1`)** | `tests/acceptance/T8/2-shell.spec.ts:34` (`openPublishDialog`, `1` insertion, `0` deletions) |
| **Overlap with Addendum r6 (`ld9-addendum-r6.md`)** | None (`0` shared files: r6 touches `tests/host/storage-docker.mjs` and `tests/host/storage-docker.selftest.mjs`; r7 touches `tests/acceptance/T8/2-shell.spec.ts`) |

### 1.2 Reason and Run `D1` Evidence (`qalead-la-80`)

1. **What failed in Run `D1` (`qalead-la-80`)**:
   - In milestone-end run `D1` (`qalead-la-80`, `/Users/quangnguyen/cogniate-qa-runs/LA/RUN-D1/artifacts/qalead-la-80-a8bbac53-2026-10-24T11-37-11-860Z/cmd/13-test-acceptance-T8.log:98-120`), the first three tests in `tests/acceptance/T8/2-shell.spec.ts` passed (`AC-T8-10 (no token)` in `216 ms`, `AC-T8-08` in `116 ms`, `AC-T8-09` in `185 ms`), and the fourth test `AC-T8-10 (with token)` (`tests/acceptance/T8/2-shell.spec.ts:102`) failed inside `openPublishDialog` at lines `34–35` after `194 ms`:
     ```text
     Error: option for the connection "Dev Moodle"
     expect(received).toBeTruthy()
     Received: ""

       33 |   const select = dialog.getByRole('combobox', { name: 'LMS connection' });
       34 |   const label = await select.locator('option').evaluateAll((opts, name) => opts.map((o) => o.textContent ?? '').find((t) => t.startsWith(`${name} (`)) ?? '', conn.json.name);
     > 35 |   expect(label, `option for the connection "${conn.json.name}"`).toBeTruthy();
          |                                                                  ^
     ```
2. **Root cause (same class as `WE-F11` / `BD-A1-117`)**:
   - When the Publish dialog opens (`await dialog.waitFor()`), it fetches `GET /app-api/connections` asynchronously (`useApi("/connections")`) before populating the connection `<option>` elements in the `"LMS connection"` `<select>` combobox.
   - At `tests/acceptance/T8/2-shell.spec.ts:34` (the line updated in Addendum r3 under the `M2` label approval `AC-M3-02(b)` to match the `<name> (<LMS>, <site host>)` option prefix `` `${name} (` ``), `select.locator('option').evaluateAll(...)` executes a **single synchronous DOM snapshot** without waiting for the async `/app-api/connections` response to populate the combobox options.
   - In `qalead-la-80` (`AC-T8-10 (with token)`), `evaluateAll` ran before `/app-api/connections` finished rendering the `<option>` elements, so `evaluateAll` returned `""`.
   - In the Playwright page snapshot captured at failure (`194 ms` into the test, `/Users/quangnguyen/cogniate-qa-runs/LA/RUN-D1/artifacts/qalead-la-80-a8bbac53-2026-10-24T11-37-11-860Z/container-T8/playwright/T8-2-shell-T8-course-shell-29731-ks-to-the-new-Moodle-course/error-context.md:153-157`), the expected option was already present in the DOM:
     ```yaml
     - generic [ref=e152]: LMS connection
     - combobox "LMS connection" [ref=e153]:
       - option "Choose a connection" [selected]
       - option "Dev Moodle (Moodle, moodle.test:9543)"
     ```
   - The identical test passed in `AC-T8-10 (no token)` (`qalead-la-80`, `216 ms`), in Slot 8b (`qalead-la-52`, `/Users/quangnguyen/cogniate-qa-runs/LA/SLOT8B/artifacts/qalead-la-52-8fadb828-2026-10-24T01-14-52-791Z/summary.json`, `23/23` unique IDs `PASS`), and in Run `D2` (`qalead-la-99`, `/Users/quangnguyen/cogniate-qa-runs/LA/RUN-D2/artifacts/qalead-la-99-a8bbac53-2026-10-24T11-32-48-203Z/summary.json`, `23/23` unique IDs `PASS`).
3. **Exact fix**:
   - Immediately before `const label = await select.locator('option').evaluateAll(...)` (`tests/acceptance/T8/2-shell.spec.ts:34`), wait for the combobox to contain the expected option using Playwright's retrying assertion:
     ```ts
     await expect(select.locator('option', { hasText: `${conn.json.name} (` })).toHaveCount(1);
     ```
   - Keep `evaluateAll`, `expect(label, ...).toBeTruthy()`, `await select.selectOption({ label })`, and every assertion in `tests/acceptance/T8/2-shell.spec.ts` unchanged.

---

## 2. Check of All Other Addendum r3 Sites and Synchronous DOM Reads in `T6` and `T8`

Every file modified in Addendum r3 (`tests/acceptance/T6/2-connect.spec.ts`, `tests/acceptance/T6/3-courses.spec.ts`, `tests/acceptance/T6/5-xss-a11y.spec.ts`, `tests/acceptance/T8/2-shell.spec.ts`, `tests/acceptance/lib/portal.ts`, `tests/e2e/lib/steps.ts`) and every synchronous DOM read (`evaluate`, `evaluateAll`, `innerText`, `textContent`) across `tests/acceptance/T6/**` and `tests/acceptance/T8/**` was audited for the same async-list race:

| File & Line | Test / Helper | How the DOM Is Read | Async-List Race Status |
|---|---|---|---|
| `tests/acceptance/T8/2-shell.spec.ts:34` | `openPublishDialog` (`AC-T8-10 (no token)` & `AC-T8-10 (with token)`) | `select.locator('option').evaluateAll(...)` right after `await dialog.waitFor()` | **Fixed in this addendum (r7)**: added `await expect(select.locator('option', { hasText: `${conn.json.name} (` })).toHaveCount(1);` before `evaluateAll`. |
| `tests/acceptance/T6/3-courses.spec.ts:132-141` | `AC-T6-07` (Publish dialog connection list & `<select>` selection) | `await dialog.innerText()` (`:133`) and `select.evaluate(...)` (`:140`) | **Already guarded (Addendum r4 / `BD-A1-117`)**: line `132` waits with `await expect(dialog.getByText('Loading…')).toHaveCount(0);` before reading `dialog.innerText()` and `select.evaluate(...)`. |
| `tests/acceptance/T6/5-xss-a11y.spec.ts:44-46` | `AC-T6-13` (Publish dialog literal course title check) | `check('Publish dialog', [XSS_COURSE_TITLE])` reads `page.locator('body').innerText()` after `await page.getByRole('dialog').waitFor()` | **No async-list read**: checks only `XSS_COURSE_TITLE` (`<b>x</b>`), which is already loaded on the Course page (`await page.waitForLoadState('networkidle')` at `:42`) and rendered synchronously in the dialog header paragraph even while `/app-api/connections` is loading. |
| `tests/acceptance/T6/5-xss-a11y.spec.ts:79-83, 91-97` | `AC-T6-09` (Publish dialog `axe` scan and keyboard open/close) | `await page.getByRole('dialog').waitFor()` then `axe` `scan`, and `await expect(page.getByRole('dialog')).toBeVisible()` | **No async-list read**: runs `axe` accessibility scan and checks `Escape` focus return. |
| `tests/acceptance/T6/2-connect.spec.ts:173-174` | `AC-T6-12` (Connect wizard step elements) | `page.locator('[data-step-id]').evaluateAll(...)` | **Already guarded**: line `173` waits with `await expect.poll(() => page.locator('[data-step-id]').count(), { timeout: 15_000, message: `${method}: step elements` }).toBeGreaterThanOrEqual(file.length);` before `evaluateAll`. |
| `tests/acceptance/T6/2-connect.spec.ts:108-109` | `AC-T6-05` (Manual wizard 16 `data-key` rows) | `page.locator('[data-key]').evaluateAll(...)` | **Already guarded**: line `108` waits with `await page.locator('[data-key]').first().waitFor({ timeout: 15_000 });` (all 16 tool-configuration rows render together in one block). |
| `tests/acceptance/T6/1-integrations.spec.ts:32-58` | `AC-T6-01` (Integrations Moodle card state) | `await card.innerText()` (`:58`) | **Already guarded**: lines `33-34` filter the card by `{ has: control }` (`Connect|Manage`) and wait with `await expect(card).toBeVisible()`, and lines `42-43` wait with `await expect(...).toBeVisible()` on `"Manage"` and `"Connect another site"` before reading `card.innerText()`. |
| `tests/acceptance/T6/4-results.spec.ts:113-116` | `AC-T6-14` (Results view sync history) | `historyText(page, override)` (`:26-40`) | **Already guarded**: line `114` waits with `await expect(override).toContainText('Moodle keeps another grade, for example a teacher override', { timeout: 30_000 });` before calling `historyText`. |
| `tests/e2e/lib/portal.ts:118-119` | `T7` `publishCourse` helper | `select.evaluate(...)` | **Already guarded (from `M2`)**: line `118` waits with `await select.locator('option').filter({ hasText: exact }).waitFor({ state: 'attached', timeout: 15_000 });` before `select.evaluate(...)`. |

No other site in `T6` or `T8` reads an async list synchronously without a preceding retrying wait.

---

## 3. Exact `git diff` Against `la-final-test-1` (`85ddf97332063f75bdc5636cb410fc0d6ee25099`)

Generated in `/Users/quangnguyen/cogniate-qa-runs/LA/ld9-addendum-r7/src-scratch` via `git diff la-final-test-1` and saved to `/Users/quangnguyen/cogniate-qa-runs/LA/ld9-addendum-r7/ld9-addendum-r7.patch` (`SHA-256`: `fc75ec7dff5ca7bbe95bb77e61aa0a039d5aa79e4c5d4ae2f53a50fe9e9cd2f8`):

```diff
diff --git a/tests/acceptance/T8/2-shell.spec.ts b/tests/acceptance/T8/2-shell.spec.ts
index a591d6f8..d60de33c 100644
--- a/tests/acceptance/T8/2-shell.spec.ts
+++ b/tests/acceptance/T8/2-shell.spec.ts
@@ -31,6 +31,7 @@ async function openPublishDialog(page: Page, courseId: string) {
   const dialog = page.getByRole('dialog');
   await dialog.waitFor();
   const select = dialog.getByRole('combobox', { name: 'LMS connection' });
+  await expect(select.locator('option', { hasText: `${conn.json.name} (` })).toHaveCount(1);
   const label = await select.locator('option').evaluateAll((opts, name) => opts.map((o) => o.textContent ?? '').find((t) => t.startsWith(`${name} (`)) ?? '', conn.json.name);
   expect(label, `option for the connection "${conn.json.name}"`).toBeTruthy();
   await select.selectOption({ label });
```

---

## 4. `git apply --check -v` and Host Typecheck Verification

### 4.1 `git apply --check -v` on `la-final-test-1` AND on `la-final-test-1` with Addendum r6 Applied

1. **Against `/Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-final-1` at `la-final-test-1` (`85ddf97332063f75bdc5636cb410fc0d6ee25099`)**:
   ```text
   $ git -C /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-final-1 apply --check -v /Users/quangnguyen/cogniate-qa-runs/LA/ld9-addendum-r7/ld9-addendum-r7.patch
   Checking patch tests/acceptance/T8/2-shell.spec.ts...
   # exit code: 0
   ```
2. **Against `la-final-test-1` with Addendum r6 already applied (`/Users/quangnguyen/cogniate-qa-runs/LA/ld9-addendum-r6/src-scratch`)**:
   ```text
   $ git -C /Users/quangnguyen/cogniate-qa-runs/LA/ld9-addendum-r6/src-scratch apply --check -v /Users/quangnguyen/cogniate-qa-runs/LA/ld9-addendum-r7/ld9-addendum-r7.patch
   Checking patch tests/acceptance/T8/2-shell.spec.ts...
   # exit code: 0
   ```
3. **Both `ld9-addendum-r6.patch` and `ld9-addendum-r7.patch` checked together on `la-final-test-1`**:
   ```text
   $ git -C /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-final-1 apply --check -v /Users/quangnguyen/cogniate-qa-runs/LA/ld9-addendum-r6/ld9-addendum-r6.patch /Users/quangnguyen/cogniate-qa-runs/LA/ld9-addendum-r7/ld9-addendum-r7.patch
   Checking patch tests/host/storage-docker.mjs...
   Checking patch tests/host/storage-docker.selftest.mjs...
   Checking patch tests/acceptance/T8/2-shell.spec.ts...
   # exit code: 0
   ```

`/Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-final-1` remains untouched (`git status --short` empty, `HEAD` = `85ddf97332063f75bdc5636cb410fc0d6ee25099`).

### 4.2 Host Typecheck in Scratch Clone (`tests/tsconfig.json`)

```text
$ npm --prefix /Users/quangnguyen/cogniate-qa-runs/LA/ld9-addendum-r7/src-scratch/tests run typecheck

> cogniate-qa-tests@0.0.0 typecheck
> tsc --noEmit -p tsconfig.json
# exit code: 0
```

---

## 5. Summary and Re-Gate Rows (`LD-25`)

| Hunk / Finding | File & Line (on `la-final-test-1`) | Item Type (`LD-9` / `BD-A1-117`) | Old Code | New Code | Race Reason & Run `D1` Evidence | Required Re-Gate Rows (`LD-25`, Pending Docker Window) |
|---|---|---|---|---|---|---|
| **Hunk 1 (`WE-F13`)** | `tests/acceptance/T8/2-shell.spec.ts:33–35` (`openPublishDialog`) | `frozen-test race fix; same class as BD-A1-117; no LA-IC` | `const select = dialog.getByRole('combobox', { name: 'LMS connection' });` followed immediately by `const label = await select.locator('option').evaluateAll(...)` | Insert `await expect(select.locator('option', { hasText: `${conn.json.name} (` })).toHaveCount(1);` before `evaluateAll`; keep `evaluateAll` and all assertions unchanged | In run `D1` (`qalead-la-80`), `AC-T8-10 (with token)` executed `evaluateAll` before the async `GET /app-api/connections` response populated the `<option>` elements, returning `""` (`cmd/13-test-acceptance-T8.log:104-120`), whereas `error-context.md:153-157` (`194 ms` later) shows `option "Dev Moodle (Moodle, moodle.test:9543)"` present, and `qalead-la-52` (Slot 8b) and `qalead-la-99` (Run `D2`) both passed `23/23` `T8` IDs. Waiting for the `<option>` count to reach `1` before `evaluateAll` eliminates the race. | **Pending live Docker re-gate on `la-final-test-2` (`= la-final-test-1 + r6 + r7`)**: `tests/host/run-t8.mjs` (`T8` suite, specifically `AC-T8-10 (no token)` and `AC-T8-10 (with token)` along with all `23` unique `T8` IDs) = `PASS` in **both** milestone-end runs `D1` and `D2`. |
