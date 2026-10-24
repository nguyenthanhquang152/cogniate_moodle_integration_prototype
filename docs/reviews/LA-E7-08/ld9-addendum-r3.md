# LD-9 Frozen-Test Change Addendum R3 — Moodle Lane `WE-F7` (`LA-IC-23`) & `WE-F8` (`M2` Labels / `AC-M3-02(b)`)

- **Author:** QA-3 (`task_8001e608103a` / `ctx_2bc875e8a2bb`)
- **Date:** 2026-10-23
- **Rule References:**
  - `docs/team/ltiaas/plan.md` §6.1 (`LD-9`)
  - `docs/architecture/ltiaas/adr/LA-ADR-04-refactor-and-migration.md` D8 (`LA-IC-23` row and post-table `"Not LA changes"` note)
  - `docs/architecture/ltiaas/build-decisions-A1.md` (`BD-A1-115`)
  - `docs/architecture/tasks/M2.md` (*"Intentional label changes (Moodle tests change with them)"*, `AC-M2-10`)
  - `docs/architecture/tasks/M3.md` §4 (`AC-M3-02(b)`)
- **Wave-End Product SHA:** `8fadb828088ffe1b4db02179ab0fa3ab2388a12a` (tag `la-wave-end-product-3`)
- **Gate Test Base Tags / SHAs:**
  - `la-gate-test-3` = `e46bb27c9487d332f40fcefd4dd880304d1d31f1` (in `/Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end-3`)
  - `la-gate-test-4` = `6ce8ffafb9da767aa73dbcd5fb38e9844c543ff1` (in `/Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end-4`, which adds Addendum R2 on top of `la-gate-test-3`; zero file overlap with Addendum R3)
- **Failing Gate Evidence:** Slot 8 `MOODLE-LIVE` (`docs/reviews/LA-E7-08/qa.md` §7: `qalead-la-30` `T7 × 1`, `qalead-la-34` `T5a, T5b, T6`, `qalead-la-35` `T8`; durable artifacts under `/Users/quangnguyen/cogniate-qa-runs/LA/SLOT8/`).
- **QA Independence:** Prepared solely from `docs/architecture/ltiaas/adr/LA-ADR-01-channel-kernel.md`, `docs/architecture/ltiaas/adr/LA-ADR-04-refactor-and-migration.md` D8, `docs/architecture/ltiaas/build-decisions-A1.md` (`BD-A1-115`), `docs/architecture/tasks/M2.md`, `docs/architecture/tasks/M3.md`, `docs/architecture/tasks/T6.md`, `docs/reviews/LA-E7-08/qa.md` §7, the two public Moodle channel data files named by Architect-1 (`packages/channels/moodle/portal/moodle-steps.json` and `packages/channels/moodle/manifest.ts`), and frozen test files under `tests/acceptance/**` and `tests/e2e/**`. No `services/**` or `apps/**` product source files were read, and neither `/Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end-3`, `/Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end-4`, nor any frozen test file in `la-qa` was modified.

---

## 1. Item Classification & Architectural Rationale

### 1.1 Part 1 — `WE-F7`: Moodle Connect Wizard Step Data Source (`LA-IC-23`, `BD-A1-115`)

- **Classification:** **`LA-IC-23` test-change list item** (`LA-ADR-04` D8 `LA-IC-23` row; `BD-A1-115`; `LA-ADR-01` D9 & D12; precedent `LA-IC-09` data-source-only change with unchanged assertions).
- **Affected Frozen Files & Lines:**
  1. `tests/e2e/lib/steps.ts:8` (`STEPS_FILE`) and `:27-28` (`readSteps`)
  2. `tests/acceptance/lib/portal.ts:110` (`MOODLE_STEPS_FILE`) and `:125` (`moodleSteps` via `readMoodleSteps`)
  3. `tests/acceptance/T6/2-connect.spec.ts:19` and `:161-162` (`AC-T6-12`)
- **Architectural Reason (`LA-IC-23` / `BD-A1-115`):**
  - `LA-E1-11` moved the Moodle Connect wizard step metadata into the Moodle channel folder (`packages/channels/moodle/portal/moodle-steps.json`, keeping `format`, `moodleRelease`, each step's `id`, `menuPath`, `labels`, `optional`, and the `manual` step `text` fields unchanged), while the `dynamic` step `text` strings now have a single source in the Moodle channel manifest `packages/channels/moodle/manifest.ts` (`texts.adminSteps`, filled with `{LMS}` = `"Moodle"` from `manifest.names.text` and `{tool}` = `"Cogniate ({libraryName})"`).
  - The composed view (`packages/channels/moodle/portal/moodle-steps.json` with `dynamic[i].text = adminSteps[i].replaceAll('{LMS}', 'Moodle').replaceAll('{tool}', 'Cogniate ({libraryName})')`) is deep-equal to both the baseline `1b17261:apps/portal/src/connect/moodle-steps.json` file and `specMoodleSteps()` (`docs/architecture/tasks/T6.md`), and the portal wizard renders the same bytes.
  - Why the test helpers read `packages/channels/moodle/manifest.ts` as a file rather than via a TypeScript `import`:
    1. `docs/architecture/ltiaas/tasks/README.md` §2 (`:56`) and §3 (`:74`) prohibit tests outside `K0` from importing product/channel modules directly.
    2. `tests/package.json` is a standalone npm project (`"QA-owned black-box acceptance and E2E tests. A separate npm project, not a root workspace"`). Because `packages/channels/moodle/manifest.ts:3` has `import type { ChannelManifest } from '@cogniate/channel-kernel'`, a static TS import from `tests/` pulls `packages/channels/moodle/manifest.ts` into `tests/tsconfig.json` and fails `tsc --noEmit -p tsconfig.json` with `TS2307: Cannot find module '@cogniate/channel-kernel'` whenever only `tests/node_modules` is installed. Reading `packages/channels/moodle/manifest.ts` with `fs.readFileSync` and `vm.runInNewContext` after stripping the type-only import and `satisfies ChannelManifest` clause uses only Node built-ins (`node:fs`, `node:vm`), copies zero product logic, and passes `npm --prefix tests run typecheck`.
  - **Preserved Assertions:** `AC-T6-12` (`tests/acceptance/T6/2-connect.spec.ts:161-190`) keeps `expect(fileJson, ...).toEqual(specMoodleSteps())` and every step ID, order, `{libraryName}` substitution, optional flag, and label check unchanged. `T7` `classify()` (`tests/e2e/lib/steps.ts:44-56`) and every `T6` and `T7` assertion stay unchanged.

### 1.2 Part 2 — `WE-F8`: Portal Multi-LMS Publish Labels in Legacy `T6` & `T8` (`M2.md`, `AC-M3-02(b)`, `BD-A1-115`)

- **Classification:** **Approved `M2` portal label change under `AC-M3-02(b)`** (`docs/architecture/tasks/M2.md` *"Intentional label changes (Moodle tests change with them)"* `:46-56`, `AC-M2-10`; `docs/architecture/tasks/M3.md` §4 `AC-M3-02(b)` `:94`; `LA-ADR-04` D8 post-table note; `BD-A1-115` — **not** an LA change).
- **Affected Frozen Files & Lines:**
  1. `tests/acceptance/T6/3-courses.spec.ts:129` (`AC-T6-07`): `/Publish to Moodle/` -> `/Publish to an LMS/`
  2. `tests/acceptance/T6/5-xss-a11y.spec.ts:44` (`AC-T6-13`), `:79` (`AC-T6-09`), `:91` (`AC-T6-09`): `/Publish to Moodle/` -> `/Publish to an LMS/` (`:97` is assertion message text only and is left untouched)
  3. `tests/acceptance/T8/2-shell.spec.ts:30`, `:33`, `:34` (`openPublishDialog`, used by `AC-T8-10` and the serial `T8` block `AC-T8-08`, `AC-T8-09`, `AC-T8-10`):
     - `:30`: `/Publish to Moodle/` -> `/Publish to an LMS/`
     - `:33`: `combobox` name `'Moodle connection'` -> `'LMS connection'`
     - `:34`: option prefix `` `${name} ·` `` -> `` `${name} (` `` (matching the `M2.md` `:51` option format `<name> (<LMS>, <site host>)`)
- **Unchanged Moodle-Specific Assertions (`BD-A1-115`):**
  - `tests/acceptance/T6/3-courses.spec.ts:143`: `await expect(page.getByText('Available in Moodle').first()).toBeVisible({ timeout: 15_000 })` and `:145` teacher path stay unchanged.
  - `tests/acceptance/T8/2-shell.spec.ts:17`: `const CHECKBOX = 'Also create an empty Moodle course'` stays unchanged.

---

## 2. Scan of Frozen Suites (`tests/acceptance` & `tests/e2e`)

Command run against `/Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end-3` at tag `la-gate-test-3` (`e46bb27c9487d332f40fcefd4dd880304d1d31f1`):

```text
$ git -C /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end-3 grep -n "apps.*moodle-steps\.json\|Publish to Moodle\|Moodle connection" -- tests/acceptance tests/e2e
tests/acceptance/M1/canvas/31-canvas-grants.test.ts:266:m1Test('M1-20.canvas.capability-moodle', 'Moodle connections cannot add deployments', async () => {
tests/acceptance/M1/canvas/manifest.json:766:  "title": "[SIM] AC-M1-20 Moodle connections cannot add deployments {case:M1-20.canvas.capability-moodle}",
tests/acceptance/T6/2-connect.spec.ts:162:    expect(fileJson, 'apps/portal/src/connect/moodle-steps.json = the content in tasks/T6.md').toEqual(specMoodleSteps());
tests/acceptance/T6/3-courses.spec.ts:129:    await page.getByRole('button', { name: /Publish to Moodle/ }).or(page.getByRole('link', { name: /Publish to Moodle/ })).first().click();
tests/acceptance/T6/5-xss-a11y.spec.ts:44:  await page.getByRole('button', { name: /Publish to Moodle/ }).or(page.getByRole('link', { name: /Publish to Moodle/ })).first().click();
tests/acceptance/T6/5-xss-a11y.spec.ts:79:  await page.getByRole('button', { name: /Publish to Moodle/ }).or(page.getByRole('link', { name: /Publish to Moodle/ })).first().click();
tests/acceptance/T6/5-xss-a11y.spec.ts:91:  const opener = page.getByRole('button', { name: /Publish to Moodle/ }).or(page.getByRole('link', { name: /Publish to Moodle/ })).first();
tests/acceptance/T6/5-xss-a11y.spec.ts:97:  await expect(opener, 'focus is back on "Publish to Moodle"').toBeFocused();
tests/acceptance/T8/2-shell.spec.ts:30:  await page.getByRole('button', { name: /Publish to Moodle/ }).or(page.getByRole('link', { name: /Publish to Moodle/ })).first().click();
tests/acceptance/T8/2-shell.spec.ts:33:  const select = dialog.getByRole('combobox', { name: 'Moodle connection' });
tests/acceptance/lib/portal.ts:108:// ---------------------------------------------------------------- the Moodle steps (apps/portal/src/connect/moodle-steps.json)
tests/e2e/M2/04-detail.m2.ts:14:  ok(r, 201, 'Moodle connection'); return r.json as Json;
tests/e2e/M2/04-detail.m2.ts:93:m2Case('M2-08.moodle-controls', 'a Moodle connection keeps its web services section; the .mbz section is labeled Moodle only', async ({ page }) => {
tests/e2e/M2/manifest.json:366:  "title": "[SIM] AC-M2-08 a Moodle connection keeps its web services section; the .mbz section is labeled Moodle only {case:M2-08.moodle-controls}",
tests/e2e/lib/steps.ts:1:// The Moodle steps that the Connect wizard shows (apps/portal/src/connect/moodle-steps.json, T6 "steps as data").
```

Note: `tests/e2e/lib/portal.ts:108-117` (`T7` helper) was already updated in `M2` to use `"Publish to an LMS"`, `"LMS connection"`, and the `<name> (<LMS>, <site host>)` option format.

---

## 3. Exact Diff Against `la-gate-test-3` (`e46bb27c9487d332f40fcefd4dd880304d1d31f1`)

Generated from `/Users/quangnguyen/cogniate-qa-runs/LA/qa3-ld9-addendum-r3/clone` detached at `la-gate-test-3` (`e46bb27c9487d332f40fcefd4dd880304d1d31f1`):

```diff
diff --git a/tests/acceptance/T6/2-connect.spec.ts b/tests/acceptance/T6/2-connect.spec.ts
index fd3aae89..7c9a07b0 100644
--- a/tests/acceptance/T6/2-connect.spec.ts
+++ b/tests/acceptance/T6/2-connect.spec.ts
@@ -16,7 +16,7 @@ import {
   clipboardText,
   hasInlineError,
   markNoReload,
-  MOODLE_STEPS_FILE,
+  readMoodleSteps,
   normText,
   PORTAL_ROUTES,
   portalSignIn,
@@ -158,8 +158,8 @@ test.describe.serial('T6 Connect wizard (QA Library B)', () => {
   test('AC-T6-12 moodle-steps.json equals the content of tasks/T6.md; the wizard shows the steps in order for both methods (data-step-id = id, text with {libraryName} replaced); choose-register-new is optional; edit-tool-settings follows activate-tool', async () => {
     test.setTimeout(120_000);
     const problems: string[] = [];
-    const fileJson = JSON.parse(fs.readFileSync(MOODLE_STEPS_FILE, 'utf8')) as Record<string, unknown>;
-    expect(fileJson, 'apps/portal/src/connect/moodle-steps.json = the content in tasks/T6.md').toEqual(specMoodleSteps());
+    const fileJson = readMoodleSteps();
+    expect(fileJson, 'packages/channels/moodle/portal/moodle-steps.json + manifest.ts texts.adminSteps = the content in tasks/T6.md').toEqual(specMoodleSteps());
 
     const b = await signIn(QA_B);
     const me = await appApi<{ library: { name: string } }>('GET', '/app-api/me', { cookie: b.cookie });
diff --git a/tests/acceptance/T6/3-courses.spec.ts b/tests/acceptance/T6/3-courses.spec.ts
index 74b8b0aa..92615ff6 100644
--- a/tests/acceptance/T6/3-courses.spec.ts
+++ b/tests/acceptance/T6/3-courses.spec.ts
@@ -126,7 +126,7 @@ test.describe.serial('T6 Courses (Thanh)', () => {
     test.setTimeout(120_000);
     const t6 = loadState('T6') as { uiScormCourseId?: string; pendingConnectionName?: string };
     await page.goto(`${APP}${PORTAL_ROUTES.course(String(t6.uiScormCourseId))}`);
-    await page.getByRole('button', { name: /Publish to Moodle/ }).or(page.getByRole('link', { name: /Publish to Moodle/ })).first().click();
+    await page.getByRole('button', { name: /Publish to an LMS/ }).or(page.getByRole('link', { name: /Publish to an LMS/ })).first().click();
     const dialog = page.getByRole('dialog');
     await expect(dialog).toBeVisible();
     const text = (await dialog.innerText()).replace(/\s+/g, ' ');
diff --git a/tests/acceptance/T6/5-xss-a11y.spec.ts b/tests/acceptance/T6/5-xss-a11y.spec.ts
index 620d02f1..d9b801c1 100644
--- a/tests/acceptance/T6/5-xss-a11y.spec.ts
+++ b/tests/acceptance/T6/5-xss-a11y.spec.ts
@@ -41,7 +41,7 @@ test('AC-T6-13 `<b>x</b>` and the manifest title show literally in Courses, Publ
   await page.goto(`${APP}${PORTAL_ROUTES.course(String(t6.xssCourseId))}`);
   await page.waitForLoadState('networkidle');
   await check('Course report', [XSS_COURSE_TITLE, XSS_MANIFEST_TITLE]);
-  await page.getByRole('button', { name: /Publish to Moodle/ }).or(page.getByRole('link', { name: /Publish to Moodle/ })).first().click();
+  await page.getByRole('button', { name: /Publish to an LMS/ }).or(page.getByRole('link', { name: /Publish to an LMS/ })).first().click();
   await page.getByRole('dialog').waitFor();
   await check('Publish dialog', [XSS_COURSE_TITLE]);
   await page.keyboard.press('Escape');
@@ -76,7 +76,7 @@ test('AC-T6-09 axe: no serious or critical violation on Integrations, wizard, Co
   await page.waitForLoadState('networkidle');
   await scan('Courses');
   await page.goto(`${APP}${PORTAL_ROUTES.course(courseId)}`);
-  await page.getByRole('button', { name: /Publish to Moodle/ }).or(page.getByRole('link', { name: /Publish to Moodle/ })).first().click();
+  await page.getByRole('button', { name: /Publish to an LMS/ }).or(page.getByRole('link', { name: /Publish to an LMS/ })).first().click();
   await page.getByRole('dialog').waitFor();
   // A native <dialog> has the dialog role without the attribute.
   await scan('Publish dialog', (await page.locator('[role="dialog"]').count()) ? '[role="dialog"]' : 'dialog[open]');
@@ -88,7 +88,7 @@ test('AC-T6-09 axe: no serious or critical violation on Integrations, wizard, Co
 
   // Keyboard only: the Publish dialog opens with Enter, closes with Esc, and focus returns to its opener.
   await page.goto(`${APP}${PORTAL_ROUTES.course(courseId)}`);
-  const opener = page.getByRole('button', { name: /Publish to Moodle/ }).or(page.getByRole('link', { name: /Publish to Moodle/ })).first();
+  const opener = page.getByRole('button', { name: /Publish to an LMS/ }).or(page.getByRole('link', { name: /Publish to an LMS/ })).first();
   await tabTo(page, opener);
   await page.keyboard.press('Enter');
   await expect(page.getByRole('dialog')).toBeVisible();
diff --git a/tests/acceptance/T8/2-shell.spec.ts b/tests/acceptance/T8/2-shell.spec.ts
index beabb81b..a591d6f8 100644
--- a/tests/acceptance/T8/2-shell.spec.ts
+++ b/tests/acceptance/T8/2-shell.spec.ts
@@ -27,11 +27,11 @@ async function openPublishDialog(page: Page, courseId: string) {
   const thanh = await signIn(THANH);
   const conn = await appApi<{ name: string; siteUrl: string }>('GET', `/app-api/connections/${encodeURIComponent(String(t5().connectionId))}`, { cookie: thanh.cookie });
   await page.goto(`${APP}${PORTAL_ROUTES.course(courseId)}`);
-  await page.getByRole('button', { name: /Publish to Moodle/ }).or(page.getByRole('link', { name: /Publish to Moodle/ })).first().click();
+  await page.getByRole('button', { name: /Publish to an LMS/ }).or(page.getByRole('link', { name: /Publish to an LMS/ })).first().click();
   const dialog = page.getByRole('dialog');
   await dialog.waitFor();
-  const select = dialog.getByRole('combobox', { name: 'Moodle connection' });
-  const label = await select.locator('option').evaluateAll((opts, name) => opts.map((o) => o.textContent ?? '').find((t) => t.startsWith(`${name} ·`)) ?? '', conn.json.name);
+  const select = dialog.getByRole('combobox', { name: 'LMS connection' });
+  const label = await select.locator('option').evaluateAll((opts, name) => opts.map((o) => o.textContent ?? '').find((t) => t.startsWith(`${name} (`)) ?? '', conn.json.name);
   expect(label, `option for the connection "${conn.json.name}"`).toBeTruthy();
   await select.selectOption({ label });
   return dialog;
diff --git a/tests/acceptance/lib/portal.ts b/tests/acceptance/lib/portal.ts
index 8fb71a94..4d2efbac 100644
--- a/tests/acceptance/lib/portal.ts
+++ b/tests/acceptance/lib/portal.ts
@@ -4,6 +4,7 @@
 // contract name first (for example input name = contract key) and then a label pattern (spec note to the Architect).
 import fs from 'node:fs';
 import path from 'node:path';
+import vm from 'node:vm';
 import type { BrowserContext, Locator, Page } from '@playwright/test';
 import { APP, portalUser } from './app';
 import { REPO_ROOT } from './paths';
@@ -107,7 +108,8 @@ export function recordRequests(page: Page): string[] {
 
 // ---------------------------------------------------------------- the Moodle steps (apps/portal/src/connect/moodle-steps.json)
 
-export const MOODLE_STEPS_FILE = path.join(REPO_ROOT, 'apps', 'portal', 'src', 'connect', 'moodle-steps.json');
+export const MOODLE_STEPS_FILE = path.join(REPO_ROOT, 'packages', 'channels', 'moodle', 'portal', 'moodle-steps.json');
+export const MOODLE_MANIFEST_FILE = path.join(REPO_ROOT, 'packages', 'channels', 'moodle', 'manifest.ts');
 
 export interface MoodleStep {
   id: string;
@@ -116,13 +118,36 @@ export interface MoodleStep {
   labels?: unknown;
 }
 
+export function readMoodleSteps(): Record<string, unknown> {
+  const raw = JSON.parse(fs.readFileSync(MOODLE_STEPS_FILE, 'utf8')) as Record<string, unknown>;
+  const manifestSrc = fs
+    .readFileSync(MOODLE_MANIFEST_FILE, 'utf8')
+    .replace(/^import\s+type\s+[^\n]+\n/gm, '')
+    .replace(/\bsatisfies\s+\w+/g, '')
+    .replace(/export\s+default\s+manifest\s*;?/, 'manifest;');
+  const manifest = vm.runInNewContext(manifestSrc) as { names?: { text?: string }; texts?: { adminSteps?: unknown[] } };
+  const lms = String(manifest?.names?.text ?? 'Moodle');
+  const adminSteps = Array.isArray(manifest?.texts?.adminSteps) ? manifest.texts.adminSteps : [];
+  const dynamic = (Array.isArray(raw.dynamic) ? raw.dynamic : []).map((s, i) => {
+    const o = s as Record<string, unknown>;
+    return {
+      id: o.id,
+      text: String(o.text ?? adminSteps[i] ?? '').replaceAll('{LMS}', lms).replaceAll('{tool}', 'Cogniate ({libraryName})'),
+      menuPath: o.menuPath,
+      labels: o.labels,
+      optional: o.optional,
+    };
+  });
+  return { ...raw, dynamic };
+}
+
 /**
  * The steps of one method from moodle-steps.json. T6.md fixes the content (step id, text, Moodle menu path, exact
  * labels) but not the shape, so QA accepts {dynamic|automatic: [...], manual: [...]}, {methods: {...}}, or a list of
  * steps with a `method` field, or a list of {method, steps}.
  */
 export function moodleSteps(method: 'dynamic' | 'manual'): MoodleStep[] {
-  const raw = JSON.parse(fs.readFileSync(MOODLE_STEPS_FILE, 'utf8')) as unknown;
+  const raw = readMoodleSteps() as unknown;
   const names = method === 'dynamic' ? ['dynamic', 'automatic'] : ['manual'];
   const asSteps = (v: unknown): MoodleStep[] | null =>
     Array.isArray(v) && v.every((s) => s && typeof s === 'object' && typeof (s as MoodleStep).text === 'string') ? (v as MoodleStep[]) : null;
diff --git a/tests/e2e/lib/steps.ts b/tests/e2e/lib/steps.ts
index 81bbcd55..edd890e0 100644
--- a/tests/e2e/lib/steps.ts
+++ b/tests/e2e/lib/steps.ts
@@ -3,9 +3,11 @@
 // Moodle action by its content: the labels and the words of its text.
 import fs from 'node:fs';
 import path from 'node:path';
+import vm from 'node:vm';
 import { REPO_ROOT } from '../../acceptance/lib/paths';
 
-export const STEPS_FILE = path.join(REPO_ROOT, 'apps', 'portal', 'src', 'connect', 'moodle-steps.json');
+export const STEPS_FILE = path.join(REPO_ROOT, 'packages', 'channels', 'moodle', 'portal', 'moodle-steps.json');
+export const MANIFEST_FILE = path.join(REPO_ROOT, 'packages', 'channels', 'moodle', 'manifest.ts');
 
 export interface MoodleStep {
   id: string;
@@ -26,18 +28,28 @@ export interface StepsFile {
 
 export function readSteps(): StepsFile {
   const raw = JSON.parse(fs.readFileSync(STEPS_FILE, 'utf8')) as Partial<StepsFile>;
-  const norm = (list: unknown): MoodleStep[] =>
-    (Array.isArray(list) ? list : []).map((s) => {
+  const manifestSrc = fs
+    .readFileSync(MANIFEST_FILE, 'utf8')
+    .replace(/^import\s+type\s+[^\n]+\n/gm, '')
+    .replace(/\bsatisfies\s+\w+/g, '')
+    .replace(/export\s+default\s+manifest\s*;?/, 'manifest;');
+  const manifest = vm.runInNewContext(manifestSrc) as { names?: { text?: string }; texts?: { adminSteps?: unknown[] } };
+  const lms = String(manifest?.names?.text ?? 'Moodle');
+  const adminSteps = (Array.isArray(manifest?.texts?.adminSteps) ? manifest.texts.adminSteps : []).map((t) =>
+    String(t ?? '').replaceAll('{LMS}', lms).replaceAll('{tool}', 'Cogniate ({libraryName})'),
+  );
+  const norm = (list: unknown, texts?: string[]): MoodleStep[] =>
+    (Array.isArray(list) ? list : []).map((s, i) => {
       const o = s as Partial<MoodleStep>;
       return {
         id: String(o.id ?? ''),
-        text: String(o.text ?? ''),
+        text: String(o.text ?? texts?.[i] ?? ''),
         menuPath: Array.isArray(o.menuPath) ? o.menuPath.map(String) : [],
         labels: Array.isArray(o.labels) ? o.labels.map(String) : [],
         optional: Boolean(o.optional),
       };
     });
-  return { format: String(raw.format ?? ''), moodleRelease: String(raw.moodleRelease ?? ''), dynamic: norm(raw.dynamic), manual: norm(raw.manual) };
+  return { format: String(raw.format ?? ''), moodleRelease: String(raw.moodleRelease ?? ''), dynamic: norm(raw.dynamic, adminSteps), manual: norm(raw.manual) };
 }
 
 /** Maps a step to the Moodle action that a person does for it. Order of the rules matters (see comments). */
```

---

## 4. `git apply --check` (on `la-gate-test-3` & `la-gate-test-4`) and Host Typecheck Proof

### 4.1 `git apply --check` Against `/Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end-3` (`la-gate-test-3`) and `/Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end-4` (`la-gate-test-4`)

```text
$ git -C /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end-3 rev-parse HEAD la-gate-test-3^{commit}
e46bb27c9487d332f40fcefd4dd880304d1d31f1
e46bb27c9487d332f40fcefd4dd880304d1d31f1

$ git -C /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end-4 rev-parse HEAD la-gate-test-4^{commit}
6ce8ffafb9da767aa73dbcd5fb38e9844c543ff1
6ce8ffafb9da767aa73dbcd5fb38e9844c543ff1

$ git -C /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end-3 apply --check -v /Users/quangnguyen/cogniate-qa-runs/LA/qa3-ld9-addendum-r3/ld9-addendum-r3.patch
Checking patch tests/acceptance/T6/2-connect.spec.ts...
Checking patch tests/acceptance/T6/3-courses.spec.ts...
Checking patch tests/acceptance/T6/5-xss-a11y.spec.ts...
Checking patch tests/acceptance/T8/2-shell.spec.ts...
Checking patch tests/acceptance/lib/portal.ts...
Checking patch tests/e2e/lib/steps.ts...

$ git -C /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end-4 apply --check -v /Users/quangnguyen/cogniate-qa-runs/LA/qa3-ld9-addendum-r3/ld9-addendum-r3.patch
Checking patch tests/acceptance/T6/2-connect.spec.ts...
Checking patch tests/acceptance/T6/3-courses.spec.ts...
Checking patch tests/acceptance/T6/5-xss-a11y.spec.ts...
Checking patch tests/acceptance/T8/2-shell.spec.ts...
Checking patch tests/acceptance/lib/portal.ts...
Checking patch tests/e2e/lib/steps.ts...

$ git -C /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end-3 status --short

$ git -C /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end-4 status --short
```

Both `git apply --check -v` commands exited with code `0`, and `git status --short` in both `src-wave-end-3` and `src-wave-end-4` produced empty output.

### 4.2 Host Typecheck Output in Scratch Clone (`tests/tsconfig.json`, `include: ["playwright.config.ts", "acceptance/**/*.ts", "acceptance/**/*.mts", "e2e/**/*.ts"]`)

```text
$ npm --prefix /Users/quangnguyen/cogniate-qa-runs/LA/qa3-ld9-addendum-r3/clone/tests run typecheck

> cogniate-qa-tests@0.0.0 typecheck
> tsc --noEmit -p tsconfig.json
```

Exited with code `0`. In addition, a host Node verification of the patched `readSteps()`, `classify()`, `readMoodleSteps()`, and `moodleSteps()` against `specMoodleSteps()` (`docs/architecture/tasks/T6.md`) and `1b17261:apps/portal/src/connect/moodle-steps.json` confirmed `assert.deepStrictEqual(readSteps(), specMoodleSteps())`, `expect(readMoodleSteps()).toEqual(specMoodleSteps())`, `steps.dynamic.map(classify)` = `['open-manage-tools', 'paste-url', 'choose-new', 'confirm-connect', 'activate', 'edit-tool']`, and `steps.manual.map(classify)` = `['open-manage-tools', 'configure-manually', 'fill-values', 'copy-details']`.

---

## 5. Summary & Re-Gate Evidence Table

| Hunk / Finding | File & Line Range | Item Type (`LD-9` / `AC-M3-02(b)`) | Old Code / Locator | New Code / Locator | Architectural Reason | Re-Gate Rows & Evidence Required (Post-Approval) |
|---|---|---|---|---|---|---|
| **Hunk 1 (`WE-F7`)** | `tests/e2e/lib/steps.ts:6-11, 29-53` | **`LA-IC-23` test-change list item** (`LA-ADR-04` D8 `LA-IC-23`; `BD-A1-115`; data source only, same assertions) | `STEPS_FILE = .../apps/portal/src/connect/moodle-steps.json`; `readSteps()` reads `STEPS_FILE` only | `STEPS_FILE = .../packages/channels/moodle/portal/moodle-steps.json`, `MANIFEST_FILE = .../packages/channels/moodle/manifest.ts`; `readSteps()` composes `STEPS_FILE` with `manifest.texts.adminSteps` (`{LMS}` = `"Moodle"`, `{tool}` = `"Cogniate ({libraryName})"`) | `LA-E1-11` moved `moodle-steps.json` into `packages/channels/moodle/portal/` and sourced dynamic step texts from `manifest.texts.adminSteps`; composed view equals `1b17261` and `tasks/T6.md` exactly | Pending authorized `MOODLE-LIVE` re-gate on the new gate test SHA: **`T7 × 1` all rows** (`T7-START`, `A1-A2`, `A3`..`A6`, `AC-T7-04`..`06`, `B1-B2`, `B3`..`B6`, `C1`, `C2`, `T7-END` in `run1/tests.json` and `summary.json`) |
| **Hunk 2 (`WE-F7`)** | `tests/acceptance/lib/portal.ts:7, 111-150` | **`LA-IC-23` test-change list item** (`LA-ADR-04` D8 `LA-IC-23`; `BD-A1-115`; data source only) | `MOODLE_STEPS_FILE = .../apps/portal/src/connect/moodle-steps.json`; `moodleSteps()` parses `MOODLE_STEPS_FILE` directly | `MOODLE_STEPS_FILE = .../packages/channels/moodle/portal/moodle-steps.json`, `MOODLE_MANIFEST_FILE = .../packages/channels/moodle/manifest.ts`; `readMoodleSteps()` composes both sources and `moodleSteps()` reads `readMoodleSteps()` | Same as Hunk 1 (`LA-IC-23` / `BD-A1-115`) | Pending authorized `MOODLE-LIVE` re-gate: **`AC-T6-12`** in `T6` (`summary.json` and `cmd/*-test-acceptance-T6.log`) |
| **Hunk 3 (`WE-F7`)** | `tests/acceptance/T6/2-connect.spec.ts:19, 161-162` | **`LA-IC-23` test-change list item** (`LA-ADR-04` D8 `LA-IC-23`; `BD-A1-115`; data source only, same `toEqual(specMoodleSteps())` assertion) | `const fileJson = JSON.parse(fs.readFileSync(MOODLE_STEPS_FILE, 'utf8')); expect(fileJson, 'apps/portal/src/connect/moodle-steps.json = ...').toEqual(specMoodleSteps())` | `const fileJson = readMoodleSteps(); expect(fileJson, 'packages/channels/moodle/portal/moodle-steps.json + manifest.ts texts.adminSteps = the content in tasks/T6.md').toEqual(specMoodleSteps())` | Preserves `toEqual(specMoodleSteps())` and all `AC-T6-12` step ID, order, `{libraryName}`, optional, and label checks against `tasks/T6.md` while reading the composed view | Pending authorized `MOODLE-LIVE` re-gate: **`AC-T6-12` = `PASS`** in `T6` |
| **Hunk 4 (`WE-F8`)** | `tests/acceptance/T6/3-courses.spec.ts:129` | **`M2` label approval under `AC-M3-02(b)`** (`M2.md` `:50`, `AC-M2-10`; `M3.md` `:94`; `BD-A1-115`) | `/Publish to Moodle/` | `/Publish to an LMS/` (`:143` `"Available in Moodle"` and `:145` teacher text stay unchanged) | `M2` changed the course publish button and dialog title from `"Publish to Moodle"` to `"Publish to an LMS"` before baseline `1b17261`; `AC-M3-02(b)` authorizes updating legacy `T6` selectors | Pending authorized `MOODLE-LIVE` re-gate: **`AC-T6-07` = `PASS`** in `T6` |
| **Hunk 5 (`WE-F8`)** | `tests/acceptance/T6/5-xss-a11y.spec.ts:44, 79, 91` | **`M2` label approval under `AC-M3-02(b)`** (`M2.md` `:50`, `AC-M2-10`; `M3.md` `:94`; `BD-A1-115`) | `/Publish to Moodle/` at `:44`, `:79`, `:91` | `/Publish to an LMS/` at `:44`, `:79`, `:91` (`:97` message string unchanged) | Same as Hunk 4 (`M2` `"Publish to an LMS"` button label under `AC-M3-02(b)`) | Pending authorized `MOODLE-LIVE` re-gate: **`AC-T6-09` = `PASS`** and **`AC-T6-13` = `PASS`** in `T6` |
| **Hunk 6 (`WE-F8`)** | `tests/acceptance/T8/2-shell.spec.ts:30, 33, 34` | **`M2` label approval under `AC-M3-02(b)`** (`M2.md` `:50-51`, `AC-M2-10`; `M3.md` `:94`; `BD-A1-115`) | `:30` `/Publish to Moodle/`; `:33` combobox `'Moodle connection'`; `:34` option prefix `` `${name} ·` `` | `:30` `/Publish to an LMS/`; `:33` combobox `'LMS connection'`; `:34` option prefix `` `${name} (` `` (`:17` `'Also create an empty Moodle course'` unchanged) | `M2` changed the publish button (`"Publish to an LMS"`), connection combobox (`"LMS connection"`), and option format (`"<name> (<LMS>, <site host>)"`) under `AC-M2-10` / `AC-M3-02(b)` | Pending authorized `MOODLE-LIVE` re-gate: **`AC-T8-10` = `PASS`**, **`AC-T8-08` = `PASS`**, and **`AC-T8-09` = `PASS`** in `T8` (`summary.json` and `cmd/*-test-acceptance-T8.log`) |
