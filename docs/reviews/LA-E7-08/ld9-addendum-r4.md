# LD-9 Frozen-Test Change Addendum R4 — `WE-F10` (`AC-T5-36`, `BD-A1-116`) & `WE-F11` (`AC-T6-07`, `BD-A1-117`)

- **Author:** QA-3 (`task_bec422b86b55` / `ctx_41c25afbba6a`)
- **Date:** 2026-10-24
- **Rule References:**
  - `docs/team/ltiaas/plan.md` §6.1 (`LD-9`)
  - `docs/architecture/ltiaas/build-decisions-A1.md` (`BD-A1-116` and `BD-A1-117`)
  - `docs/architecture/contracts/cogniate-app-api.md` §7 (`RuntimeState` and `POST /rt/{runtimeToken}/commit`) & §9 (HTML runtime poll and `load` attachment)
  - `docs/architecture/tasks/T5b.md` (`AC-T5-36`)
  - `docs/architecture/tasks/T6.md` (`AC-T6-07`)
- **Wave-End Product SHA:** `8fadb828088ffe1b4db02179ab0fa3ab2388a12a` (tag `la-wave-end-product-3`)
- **Gate Test Base Tag / SHA:** `la-gate-test-5` = `0700b3962ec063c4c2c3f36cf0ca27a25c97e82e` (in `/Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end-5`)
- **Failing Gate Evidence:**
  - `WE-F10` (`AC-T5-36`): Slot 8 `qalead-la-34` (`docs/reviews/LA-E7-08/qa.md` §7.1 item 5) and Slot 3D `qalead-la-45` (`1b17261` baseline FAIL), `qalead-la-46` (`1b17261` baseline PASS), `qalead-la-47` (`8fadb828` wave-end FAIL) (`docs/reviews/LA-E7-08/qa.md` §8.4.1–8.4.2; durable artifacts under `/Users/quangnguyen/cogniate-qa-runs/LA/SLOT8/` and `/Users/quangnguyen/cogniate-qa-runs/LA/SLOT3D/`).
  - `WE-F11` (`AC-T6-07`): Slot 8b `qalead-la-51` (`docs/reviews/LA-E7-08/qa.md` §9.2 item 2 & §9.3; durable artifacts under `/Users/quangnguyen/cogniate-qa-runs/LA/SLOT8B/artifacts/qalead-la-51-8fadb828-2026-10-24T01-07-50-441Z/`).
- **QA Independence:** Prepared solely from `docs/architecture/ltiaas/build-decisions-A1.md` (`BD-A1-116`, `BD-A1-117`), `docs/architecture/contracts/cogniate-app-api.md` §7 and §9, `docs/architecture/tasks/T5b.md`, `docs/architecture/tasks/T6.md`, `docs/reviews/LA-E7-08/qa.md` §7–§9, QA run traces under `/Users/quangnguyen/cogniate-qa-runs/LA/SLOT3D/` and `SLOT8B/`, and the frozen test files under `tests/acceptance/**`. Zero Docker commands were run, zero product source files (`services/**`, `apps/**`, `packages/**`) were read, and neither `/Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end-5` nor any frozen test file in `la-qa` was modified.

---

## 1. Item Classification & Architectural / Race Rationale

### 1.1 Item 1 — `WE-F11`: Publish Dialog Loading Race in `AC-T6-07` (`BD-A1-117`)

- **Classification:** **`frozen-test race fix; A1 BD-A1-117; no LA-IC`**
- **Affected Frozen File & Lines (at `la-gate-test-5`):**
  - `tests/acceptance/T6/3-courses.spec.ts:130-132` (`AC-T6-07`)
- **Race Analysis (`BD-A1-117` & `qalead-la-51` Trace):**
  - After Addendum R3 (`WE-F8`) updated the opener button locator at `tests/acceptance/T6/3-courses.spec.ts:129` from `/Publish to Moodle/` to `/Publish to an LMS/`, `AC-T6-07` opened the Publish dialog in Slot 8b (`qalead-la-51`), waited for `await expect(dialog).toBeVisible();` (`:131`), and immediately read `const text = (await dialog.innerText()).replace(/\s+/g, ' ');` (`:132`).
  - In `qalead-la-51` (`cmd/14-test-acceptance-T6.log` and `container-T6/playwright/T6-3-courses-T6-Courses-Th-60236-Moodle-and-the-teacher-text/trace.zip`), the click occurred at `0 ms`, `expect(dialog).toBeVisible()` resolved at `+48.8 ms`, and `dialog.innerText()` ran `2.6 ms` later at `+51.5 ms` while the `GET /app-api/connections` request (`3.7 ms`) had not yet settled into the rendered `<select>` options. Consequently, `dialog.innerText()` returned `"Publish to an LMS Make this course available in the LMS content picker. QA UI SCORM mvlph0it Loading… LMS connection Choose a connection Version Version 1 · SCORM 1.2 Package: Build Your First Website with AI: The Zero-to-Hero Micro-Sprint Publish Cancel"` and failed `expect(text).toContain('Dev Moodle')` at `:133`.
  - As ratified in `BD-A1-117`, this is a pre-existing M2 dialog test race (masked on `1b17261` only because `AC-T6-07` stopped one line earlier at the `WE-F8` `/Publish to Moodle/` label), not an LA difference.
- **Exact Fix (`BD-A1-117`):**
  - Immediately after `await expect(dialog).toBeVisible();` (`tests/acceptance/T6/3-courses.spec.ts:131`), add:
    ```ts
    await expect(dialog.getByText('Loading…')).toHaveCount(0);
    ```
  - Keep `const text = (await dialog.innerText()).replace(/\s+/g, ' ');` and every assertion in `AC-T6-07` (`toContain('Dev Moodle')`, `not.toContain(String(t6.pendingConnectionName))`, `"Available in Moodle"`, and the teacher path text) unchanged.

### 1.2 Item 2 — `WE-F10`: Menu Page (`index`) Progress Commit Race Under Hanging Hosts in `AC-T5-36` (`BD-A1-116`)

- **Classification:** **`frozen-test race fix; A1 BD-A1-116; no LA-IC`**
- **Affected Frozen File & Lines (at `la-gate-test-5`):**
  - `tests/acceptance/T5b/1-html.spec.ts:20-26` (import `runtimeState` from `'../lib/t5'`) and `:57-59` (`AC-T5-36`)
- **Race Analysis (`BD-A1-116` & `qalead-la-45..47` / `qalead-la-34` Traces):**
  - In `AC-T5-36`, `newHangingContext` (`tests/acceptance/lib/t5.ts:586-597`) holds every request outside the stack and `*.test` (`17` S3 image and `fonts.gstatic.com` requests across `16` unique URLs) open indefinitely, so the child package iframe `index.html` never fires its `load` event.
  - Per `docs/architecture/contracts/cogniate-app-api.md` §9 (`:809`), when `load` is blocked by hanging external hosts, the HTML runtime attaches to the child document via its periodic poll once `readyState` is `interactive` or `complete` and sends `POST /rt/{runtimeToken}/commit` (`event: "progress"`) with `progress.seenPages: ["index"]`.
  - However, `driveCourse` (`tests/acceptance/lib/t5.ts:441-449`) calls `packageFrame(player, 'index.html')` (which returns as soon as `domcontentloaded` fires at `:221`) and immediately executes `link.click()` on `a[href="lesson-ai-web-sprint.html"]` in the next microtask:
    - In the passing baseline run `qalead-la-46` (`1b17261`, `SLOT3D/artifacts/qalead-la-46-1b17261b-2026-10-24T00-05-12-265Z/container-T5b/playwright/*AC-T5-36*/trace.zip`), `GET /pkg/.../index.html` started at `00:10:36.282Z`, the runtime's poll sent `POST /rt/.../commit` (`seq: 1`, `seenPages: ["index"]`) at `00:10:36.426Z` (`+144 ms`), and `driveCourse` clicked `lesson-ai-web-sprint.html` `3 ms` later at `00:10:36.429Z` (`+147 ms`). After the 10 s lesson dwell, `seq: 3` (`00:10:46.579Z`) committed `seenPages: ["index", "lesson-ai-web-sprint"]`, and `score_sync` `sent` (`100`) followed `50 ms` later.
    - In the failing baseline run `qalead-la-45` (`1b17261`) and wave-end runs `qalead-la-34` and `qalead-la-47` (`8fadb828`, `SLOT3D/artifacts/qalead-la-47-8fadb828-2026-10-24T00-39-03-994Z/container-T5b/playwright/*AC-T5-36*/trace.zip`), `GET /pkg/.../index.html` started at `00:44:33.712Z` and `driveCourse` clicked `lesson-ai-web-sprint.html` at `00:44:33.844Z` (`+132 ms`) — `12 ms` before the runtime's poll tick on `index.html`. As a result, the session sent only two commits (`seq: 1` at `00:44:34.153Z` with `seenPages: []` and the quiz answer, and `seq: 2` at `00:44:44.007Z` with `seenPages: ["lesson-ai-web-sprint"]`), `"index"` was never recorded in `seenPages`, and the attempt stayed `in_progress`.
- **Exact Fix (`BD-A1-116`):**
  - Import `runtimeState` from `'../lib/t5'` (`tests/acceptance/lib/t5.ts:305`, which queries `GET /rt/{runtimeToken}/state` per `cogniate-app-api.md` §7 `:699, 720` and is already used with `expect.poll` in `tests/acceptance/T5b/zz-refresh-logs.spec.ts:32`).
  - In `AC-T5-36` (`tests/acceptance/T5b/1-html.spec.ts:57-58`), after `const player = await openPlayer(context, user, cmidOf(ACT.htmlHang));` and before `await driveCourse(player, { answer: 'correct' });`, wait for the runtime commit whose `progress.seenPages` contains `'index'`:
    ```ts
    await expect.poll(async () => (await runtimeState(player.token)).json?.html?.progress.seenPages ?? [], { timeout: 20_000 }).toContain('index');
    ```
  - Keep `await driveCourse(player, { answer: 'correct' });`, the 60 s `done` deadline timer, and every assertion (`moodle.grade === 100`, `row?.best?.outcome === 'passed'`, `hung.length > 0`) unchanged.

---

## 2. Exact Diff Against `la-gate-test-5` (`0700b3962ec063c4c2c3f36cf0ca27a25c97e82e`)

Generated from `/Users/quangnguyen/cogniate-qa-runs/LA/qa3-ld9-addendum-r4/clone` detached at `la-gate-test-5` (`0700b3962ec063c4c2c3f36cf0ca27a25c97e82e`):

```diff
diff --git a/tests/acceptance/T5b/1-html.spec.ts b/tests/acceptance/T5b/1-html.spec.ts
index ed3d195c..2cee5783 100644
--- a/tests/acceptance/T5b/1-html.spec.ts
+++ b/tests/acceptance/T5b/1-html.spec.ts
@@ -20,6 +20,7 @@ import {
   newHangingContext,
   openPlayer,
   packageFrame,
+  runtimeState,
   t5,
   waitForMoodle,
   waitForRow,
@@ -55,6 +56,7 @@ test('AC-T5-36 hanging hosts: every non-*.test request hangs; cg_student complet
   try {
     const user = seed().users.cg_student;
     const player = await openPlayer(context, user, cmidOf(ACT.htmlHang));
+    await expect.poll(async () => (await runtimeState(player.token)).json?.html?.progress.seenPages ?? [], { timeout: 20_000 }).toContain('index');
     await driveCourse(player, { answer: 'correct' });
     const done = Date.now();
     const left = () => Math.max(1_000, done + 60_000 - Date.now());
diff --git a/tests/acceptance/T6/3-courses.spec.ts b/tests/acceptance/T6/3-courses.spec.ts
index 92615ff6..00f8e672 100644
--- a/tests/acceptance/T6/3-courses.spec.ts
+++ b/tests/acceptance/T6/3-courses.spec.ts
@@ -129,6 +129,7 @@ test.describe.serial('T6 Courses (Thanh)', () => {
     await page.getByRole('button', { name: /Publish to an LMS/ }).or(page.getByRole('link', { name: /Publish to an LMS/ })).first().click();
     const dialog = page.getByRole('dialog');
     await expect(dialog).toBeVisible();
+    await expect(dialog.getByText('Loading…')).toHaveCount(0);
     const text = (await dialog.innerText()).replace(/\s+/g, ' ');
     expect(text, 'the registered/connected connection').toContain('Dev Moodle');
     expect(text, 'the pending connection is not listed').not.toContain(String(t6.pendingConnectionName));
```

---

## 3. `git apply --check` on `la-gate-test-5` and Host Typecheck Proof

### 3.1 `git apply --check` Against `/Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end-5` (`la-gate-test-5`)

```text
$ git -C /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end-5 rev-parse HEAD la-gate-test-5^{commit}
0700b3962ec063c4c2c3f36cf0ca27a25c97e82e
0700b3962ec063c4c2c3f36cf0ca27a25c97e82e

$ git -C /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end-5 apply --check -v /Users/quangnguyen/cogniate-qa-runs/LA/qa3-ld9-addendum-r4/ld9-addendum-r4.patch
Checking patch tests/acceptance/T5b/1-html.spec.ts...
Checking patch tests/acceptance/T6/3-courses.spec.ts...

$ git -C /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end-5 status --short
```

`git apply --check -v` exited with code `0`, and `git status --short` in `/Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end-5` produced empty output.

### 3.2 Host Typecheck Output in Scratch Clone (`tests/tsconfig.json`)

```text
$ npm --prefix /Users/quangnguyen/cogniate-qa-runs/LA/qa3-ld9-addendum-r4/clone/tests run typecheck

> cogniate-qa-tests@0.0.0 typecheck
> tsc --noEmit -p tsconfig.json
```

Exited with code `0`.

---

## 4. Summary & Re-Gate Evidence Table

| Hunk / Finding | File & Line Range (on `la-gate-test-5`) | Item Type (`LD-9` / `BD-A1-116` & `BD-A1-117`) | Old Code | New Code | Architectural / Race Reason | Re-Gate Rows & Evidence Required (Post-Approval) |
|---|---|---|---|---|---|---|
| **Hunk 1 (`WE-F10`)** | `tests/acceptance/T5b/1-html.spec.ts:20-26, 55-60` | **`frozen-test race fix; A1 BD-A1-116; no LA-IC`** | `const player = await openPlayer(context, user, cmidOf(ACT.htmlHang));` followed immediately by `await driveCourse(player, { answer: 'correct' });` | Import `runtimeState` from `'../lib/t5'`; before `driveCourse`, add `await expect.poll(async () => (await runtimeState(player.token)).json?.html?.progress.seenPages ?? [], { timeout: 20_000 }).toContain('index');` | Under `newHangingContext`, external requests hang so `index.html` never fires `load`; `driveCourse` clicked `lesson-ai-web-sprint.html` on `domcontentloaded` (`+132 ms` in `qalead-la-47`) before the runtime's poll committed `seenPages: ["index"]` (`+144 ms` in `qalead-la-46`). Waiting for `seenPages` to contain `'index'` ensures the menu page commit is recorded before navigating to the lesson page; all assertions stay unchanged | Pending authorized `MOODLE-LIVE` re-gate on the new gate test SHA: **`AC-T5-36` = `PASS`** in `T5b` (`summary.json` and `cmd/*-test-acceptance-T5b.log`) |
| **Hunk 2 (`WE-F11`)** | `tests/acceptance/T6/3-courses.spec.ts:129-135` | **`frozen-test race fix; A1 BD-A1-117; no LA-IC`** | `await expect(dialog).toBeVisible();` followed immediately by `const text = (await dialog.innerText()).replace(/\s+/g, ' ');` | After `await expect(dialog).toBeVisible();`, add `await expect(dialog.getByText('Loading…')).toHaveCount(0);` | In `qalead-la-51`, `dialog.innerText()` ran `2.6 ms` after `expect(dialog).toBeVisible()` while `useApi("/connections")` (`3.7 ms`) still rendered `"Loading…"`; waiting for `'Loading…'` to disappear before reading `dialog.innerText()` eliminates the race while keeping all assertions unchanged | Pending authorized `MOODLE-LIVE` re-gate on the new gate test SHA: **`AC-T6-07` = `PASS`** in `T6` (`summary.json` and `cmd/*-test-acceptance-T6.log`) |
