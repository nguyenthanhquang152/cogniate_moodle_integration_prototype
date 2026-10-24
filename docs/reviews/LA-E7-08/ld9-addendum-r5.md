# LD-1 & LD-9 Gate Overlay Fix Round 1 (`ld9-addendum-r5`) — Card Membership Oracle (`A-LA-E0-04-01` = `B-LA-E0-04-01`) & Migration-Ledger Prefix Check (`A-LA-E0-04-02`)

- **Author:** Lead QA (Round 1: `task_5785f09e261c` / `ctx_0d5d78338442`; Round 2: `task_e4e91f923e4c` / `ctx_a0b10ce4f402`; Round 3: `task_a476d0cb4edf` / `ctx_20decc2fd3cd`)
- **Date:** 2026-10-24
- **Rule & Review References:**
  - `docs/team/ltiaas/plan.md` §6.1 (`LD-1`, `LD-9`)
  - `docs/reviews/LA-E0-04/reviewer-a.md` (`A-LA-E0-04-01` BLOCKER, `A-LA-E0-04-02` MAJOR, `A-LA-E0-04-03` MAJOR, `A-LA-E0-04-04` MINOR, `A-LA-E0-04-05` BLOCKER)
  - `docs/reviews/LA-E0-04/reviewer-b.md` (`B-LA-E0-04-01` BLOCKER, `B-LA-E0-04-02` MAJOR, `B-LA-E0-04-03` BLOCKER)
  - `docs/architecture/ltiaas/build-decisions-A1.md` (`BD-A1-119`)
  - `docs/architecture/ltiaas/build-decisions-A2.md` (`BD-A2-108` / `LD-24`)
  - `docs/architecture/ltiaas/contracts/cogniate-app-api-delta.md` §2 (`GET /app-api/lms-providers`)
  - `tests/ltiaas/TEST-STRATEGY.md` §4.3 (Row 6 card check; frozen assertion rules)
- **Wave-End Product SHA:** `8fadb828088ffe1b4db02179ab0fa3ab2388a12a` (tag `la-wave-end-product-3`)
- **Gate Test Base Tag / SHA:** `la-gate-test-6` = `9de014298fbe133ebbd8d40365da84988ccabf5d` (in `/Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end-6`)
- **Scratch Clone Used for Edits & Verification:** `/Users/quangnguyen/cogniate-qa-runs/LA/ld1-overlay-fix-r1/src-scratch` (`git clone --no-hardlinks` of `/Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end-6` at `la-gate-test-6`; `/Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end-6` untouched)
- **QA Independence:** Prepared solely from `docs/reviews/LA-E0-04/reviewer-a.md`, `docs/reviews/LA-E0-04/reviewer-b.md`, `docs/architecture/ltiaas/tasks/LA-E0-04.md`, `tests/ltiaas/TEST-STRATEGY.md` §4.3, `docs/architecture/ltiaas/build-decisions-A2.md` (`BD-A2-108`), and the test files in `tests/`. Zero Docker commands were run (`HOST-ONLY`), zero product source files (`apps/**`, `services/**`, `packages/**`) were read, and `/Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end-6` was never modified.

---

## 1. Classification & Per-Hunk Reason

### 1.1 Summary of Hunks Against `la-gate-test-6` (`9de014298fbe133ebbd8d40365da84988ccabf5d`)

| # | File | Hunk / Lines | Finding Closed | Classification | Reason |
| --- | --- | --- | --- | --- | --- |
| 1 | `tests/acceptance/lib/open-world.mjs` (and byte-identical `tests/ltiaas/lib/open-world.mjs`) | `extraChannelNames` (`:46-61`), `checkExtraCard` + `checkCards` (`:68-137`) | **`A-LA-E0-04-01` = `B-LA-E0-04-01`** (BLOCKER) | **`LD-1` row 6 open-world card membership oracle fix (`LA-E0-04`)** | Replaces the substring check `names.some((name) => String(text).includes(name))` with exact `Set.has(...)` membership against the registered non-baseline channel `id` (`channel ?? lms`) or exact `name` (`channelName`, `label`) from `GET /app-api/lms-providers`. When `lti-generic` (`channelName: 'LMS'`) is registered, `extraChannelNames` returns `['lti-generic', 'LMS']` (plus `'Other LTI 1.3 platform'` when present), and `checkCards` requires an exact match on the card's channel `id` or extracted card heading/target name — never a substring match on `'LMS'`. |
| 2 | `tests/acceptance/lib/open-world.mjs` (and byte-identical `tests/ltiaas/lib/open-world.mjs`) | `checkMigrationLedgers` (`:139-172`) | **`A-LA-E0-04-02`** (MAJOR) | **Assertion change on `M1-41.common.j-snapshot` (`BD-A2-108` / `LD-24` / `WE-F5`)** | Restores an independent check that every historical migration ledger entry in `oldLedger['lti-service/lti.db']` and `oldLedger['cogniate-app/cogniate.db']` is preserved in order as a non-empty prefix of `newLedger[db]`, asserts that `newLedger['cogniate-app/cogniate.db']` includes `'012_connection_provider_snapshot.sql'`, and keeps the exact comparison of `newLedger[db]` against the candidate's sorted migration files (`expectedLtiLedger`, `expectedAppLedger`). |
| 3 | `tests/acceptance/lib/open-world.d.mts` (and byte-identical `tests/ltiaas/lib/open-world.d.mts`) | `CardDescriptor`, `CardInput`, `checkCards`, `MigrationLedgerMap`, `checkMigrationLedgers` (`:10-32`) | **`A-LA-E0-04-01` / `B-LA-E0-04-01` & `A-LA-E0-04-02`** | **`LD-1` TypeScript declaration update (`LA-E0-04`)** | Updates TypeScript types for `checkCards` (accepting `string | CardDescriptor`) and adds the type declaration for `checkMigrationLedgers` so `npm --prefix tests run typecheck` passes cleanly. |
| 4 | `tests/e2e/M2/01-cards.m2.ts` | `lmsCardTexts` (`:12-33`) | **`A-LA-E0-04-01` = `B-LA-E0-04-01`** (BLOCKER) | **`LD-1` row 6 `M2-01.cards` DOM extractor update (`LA-E0-04`)** | Updates `lmsCardTexts(page)` to extract `{ text, channel, name }` per visible card in the `"LMS Publishing"` grid: `text` is the squashed card text (used for the 3 baseline cards and `BASELINE_OTHER_CARDS`), `name` is the exact card heading (`h2, h3, [role="heading"]`), and `channel` is the exact channel id parsed from `/integrations/<channel>/(connect|con_...)` or `<channel>-connect` / `<channel>-manage`. |
| 5 | `tests/host/m1-migration.mjs` | Import `checkMigrationLedgers` (`:12`) and call `checkMigrationLedgers(oldLedger, newLedger, { expectedLtiLedger, expectedAppLedger })` (`:338-341`) | **`A-LA-E0-04-02`** (MAJOR) | **Assertion change on `M1-41.common.j-snapshot` (`BD-A2-108` / `LD-24` / `WE-F5`)** | Replaces the raw `assert.deepEqual(newLedger[db], expected*Ledger)` calls in `snapshotMigrationRun` with `checkMigrationLedgers(oldLedger, newLedger, { expectedLtiLedger, expectedAppLedger })`, ensuring both historical prefix preservation (`oldLedger` is a prefix of `newLedger`) and exact equality with the candidate's migration files. |
| 6 | `tests/ltiaas/k0/ld1/open-world.test.mjs` and `tests/ltiaas/k0/ld1/open-world.test.ts` | Row 6 `extra` template (`:80`), copy-sync check (`:99-114`), mixed registered + unregistered card probe (`:162-185`), and migration-ledger negative/positive probe (`:187-249`) | **`A-LA-E0-04-01` = `B-LA-E0-04-01` & `A-LA-E0-04-02`** | **`K0` `ld1` self-tests (`AC-LA-E0-04-05`, `AC-LA-E0-04-06`)** | Updates Row 6's `extra` probe card template so its heading is `${registered ? NEW.name : 'Sakai'}` rather than `'Your LMS'`, adds the mixed probe with `lti-generic` (`channelName: 'LMS'`) registered (verifying that the registered generic card passes while Reviewer-A's `'Connect Sakai Publish Cogniate courses to Sakai LMS with LTI 1.3.'`, Reviewer-B's `'ConnectSakai LMSPublish Cogniate courses to Sakai with LTI 1.3.'`, `'ConnectYour LMSPublish Cogniate courses to Sakai with LTI 1.3.'`, and unregistered structured DOM cards all fail both alone and alongside the registered generic card), and adds the `checkMigrationLedgers` K0 self-test (verifying that dropping or reordering a historical ledger entry fails even if also removed/reordered in `expected*Ledger`). |

---

## 2. Exact Diff Against `la-gate-test-6` (`9de014298fbe133ebbd8d40365da84988ccabf5d`)

Generated in `/Users/quangnguyen/cogniate-qa-runs/LA/ld1-overlay-fix-r1/src-scratch` detached at `la-gate-test-6` (`9de014298fbe133ebbd8d40365da84988ccabf5d`):

```diff
diff --git a/tests/acceptance/lib/open-world.d.mts b/tests/acceptance/lib/open-world.d.mts
index 2629c41d..c0f43502 100644
--- a/tests/acceptance/lib/open-world.d.mts
+++ b/tests/acceptance/lib/open-world.d.mts
@@ -26,4 +26,26 @@ export function appLmsProviders(
     Promise<{ status: number; headers: Record<string, any>; body: string }>,
   options: { appUrl: string; ca?: string | null; user: { email: string; password: string } },
 ): Promise<Json>;
-export function checkCards(cards: string[], baselineTexts: string[], options: { names: string[]; others?: string[]; label?: string }): string[];
+export interface CardDescriptor {
+  text: string;
+  channel?: string | null;
+  id?: string | null;
+  name?: string | null;
+  title?: string | null;
+}
+export type CardInput = string | CardDescriptor;
+export function checkCards<T extends CardInput>(
+  cards: T[],
+  baselineTexts: string[],
+  options: { names: string[]; others?: string[]; label?: string },
+): T[];
+export interface MigrationLedgerMap {
+  'lti-service/lti.db': string[];
+  'cogniate-app/cogniate.db': string[];
+  [db: string]: string[];
+}
+export function checkMigrationLedgers(
+  oldLedger: MigrationLedgerMap,
+  newLedger: MigrationLedgerMap,
+  options?: { expectedLtiLedger?: string[]; expectedAppLedger?: string[]; label?: string },
+): void;
diff --git a/tests/acceptance/lib/open-world.mjs b/tests/acceptance/lib/open-world.mjs
index c38c4e49..f1332dfc 100644
--- a/tests/acceptance/lib/open-world.mjs
+++ b/tests/acceptance/lib/open-world.mjs
@@ -58,11 +58,23 @@ export function registeredChannels(lmsProviders) {
   return new Set(ids);
 }
 
-/** The text names of the registered channels that are not baseline channels (`channelName`, else `label`). */
+/**
+ * The exact channel ids and names of the registered channels that are not baseline channels
+ * (`channel`/`lms`, `channelName`, `label`).
+ */
 export function extraChannelNames(lmsProviders) {
   assert.ok(Array.isArray(lmsProviders?.lms), 'GET /app-api/lms-providers has an lms list');
-  return lmsProviders.lms.filter((entry) => !BASELINE_LMS.includes(entry.channel ?? entry.lms))
-    .map((entry) => entry.channelName ?? entry.label).filter((name) => typeof name === 'string' && name.length > 0);
+  const names = [];
+  for (const entry of lmsProviders.lms) {
+    const id = entry.channel ?? entry.lms;
+    if (BASELINE_LMS.includes(id)) continue;
+    for (const candidate of [id, entry.channelName, entry.label]) {
+      if (typeof candidate === 'string' && candidate.trim().length > 0 && !names.includes(candidate.trim())) {
+        names.push(candidate.trim());
+      }
+    }
+  }
+  return names;
 }
 
 /**
@@ -179,20 +191,99 @@ export async function appLmsProviders(request, { appUrl, ca, user }) {
   return JSON.parse(answer.body);
 }
 
+const cardText = (card) => (typeof card === 'string' ? card : String(card?.text ?? ''));
+
+const isOtherCard = (card, other) => {
+  if (card && typeof card === 'object') {
+    const channel = card.channel ?? card.id ?? null;
+    if (typeof channel === 'string' && channel.trim().length > 0) return false;
+  }
+  return cardText(card).includes(other);
+};
+
+function checkExtraCard(card, allowed, label) {
+  if (card && typeof card === 'object') {
+    const channel = typeof card.channel === 'string' && card.channel.trim().length > 0
+      ? card.channel.trim()
+      : typeof card.id === 'string' && card.id.trim().length > 0
+        ? card.id.trim()
+        : null;
+    const name = typeof card.name === 'string' && card.name.trim().length > 0
+      ? card.name.trim()
+      : typeof card.title === 'string' && card.title.trim().length > 0
+        ? card.title.trim()
+        : null;
+    if (channel !== null) {
+      assert.ok(allowed.has(channel), `${label}: extra card ${show(card)} has unregistered channel ${show(channel)}`);
+      return;
+    }
+    if (name !== null) {
+      assert.ok(allowed.has(name), `${label}: extra card ${show(card)} names no registered channel (${show(name)})`);
+      return;
+    }
+  }
+  const raw = cardText(card).trim();
+  const headingMatch = /^(?:[A-Za-z0-9]{1,4}\s*)?(?:Connect|Manage)\s*(.+?)\s*(?:Publish|Export)\b/.exec(raw);
+  const targetMatch = /Publish Cogniate courses to\s+(.+?)\s+with LTI 1\.3\./.exec(raw);
+  const candidates = headingMatch
+    ? [headingMatch[1].trim(), ...(targetMatch ? [targetMatch[1].trim()] : [])]
+    : [raw];
+  assert.ok(
+    candidates.length > 0 && candidates.every((c) => c.length > 0 && allowed.has(c)),
+    `${label}: extra card ${show(card)} names no registered channel`,
+  );
+}
+
 /**
- * Row 6: the visible cards of the "LMS Publishing" filter, as card texts in page order. Each baseline card text is
- * in exactly one card, in the baseline order. An extra card is a G-BASE non-channel card (`others`, each at most
- * once) or names a registered channel that is not a baseline channel (`names`, from extraChannelNames).
- * Returns the extra card texts.
+ * Row 6: the visible cards of the "LMS Publishing" filter, in page order. Each baseline card text is in
+ * exactly one card, in the baseline order. An extra card is a G-BASE non-channel card (`others`, each at most
+ * once) or matches a registered non-baseline channel by exact `id` or `name` (`names`, from extraChannelNames),
+ * never by substring. Returns the extra cards.
  */
 export function checkCards(cards, baselineTexts, { names, others = BASELINE_OTHER_CARDS, label = 'LMS Publishing cards' }) {
-  const extras = openList(cards, baselineTexts, { label, matches: (text, expected) => String(text).includes(expected) });
+  const allowed = new Set(names.filter((n) => typeof n === 'string' && n.trim().length > 0).map((n) => n.trim()));
+  const extras = openList(cards, baselineTexts, { label, matches: (card, expected) => cardText(card).includes(expected) });
   for (const other of others) {
-    assert.ok(extras.filter((text) => String(text).includes(other)).length <= 1, `${label}: the card ${show(other)} appears more than once`);
+    assert.ok(extras.filter((card) => isOtherCard(card, other)).length <= 1, `${label}: the card ${show(other)} appears more than once`);
   }
-  for (const text of extras) {
-    if (others.some((other) => String(text).includes(other))) continue;
-    assert.ok(names.some((name) => String(text).includes(name)), `${label}: extra card ${show(text)} names no registered channel`);
+  for (const card of extras) {
+    if (others.some((other) => isOtherCard(card, other))) continue;
+    checkExtraCard(card, allowed, label);
   }
   return extras;
 }
+
+/**
+ * Snapshot-upgrade migration ledger check (M1-41.common.j-snapshot; BD-A2-108 / LD-24):
+ * 1. Every historical ledger entry from `oldLedger` is still present in `newLedger` in its original order
+ *    (each `oldLedger[db]` is a non-empty prefix of `newLedger[db]`), independent of the candidate's files.
+ * 2. `newLedger['cogniate-app/cogniate.db']` includes `012_connection_provider_snapshot.sql`.
+ * 3. Each upgraded ledger equals the candidate's full sorted migration file list (`expectedLtiLedger`, `expectedAppLedger`).
+ */
+export function checkMigrationLedgers(
+  oldLedger,
+  newLedger,
+  { expectedLtiLedger, expectedAppLedger, label = 'M1-41.common.j-snapshot migration ledger' } = {},
+) {
+  for (const db of ['lti-service/lti.db', 'cogniate-app/cogniate.db']) {
+    const oldEntries = oldLedger?.[db];
+    const newEntries = newLedger?.[db];
+    assert.ok(Array.isArray(oldEntries) && oldEntries.length > 0, `${label}: ${db} old ledger is a non-empty list`);
+    assert.ok(Array.isArray(newEntries) && newEntries.length >= oldEntries.length, `${label}: ${db} upgraded ledger is shorter than old ledger`);
+    assert.deepEqual(
+      newEntries.slice(0, oldEntries.length),
+      oldEntries,
+      `${label}: ${db} old ledger is not a prefix of the upgraded ledger`,
+    );
+  }
+  assert.ok(
+    newLedger['cogniate-app/cogniate.db'].includes('012_connection_provider_snapshot.sql'),
+    `${label}: cogniate-app/cogniate.db upgraded ledger is missing 012_connection_provider_snapshot.sql`,
+  );
+  if (expectedLtiLedger !== undefined) {
+    assert.deepEqual(newLedger['lti-service/lti.db'], expectedLtiLedger, `${label}: lti-service/lti.db ledger does not match candidate migrations`);
+  }
+  if (expectedAppLedger !== undefined) {
+    assert.deepEqual(newLedger['cogniate-app/cogniate.db'], expectedAppLedger, `${label}: cogniate-app/cogniate.db ledger does not match candidate migrations`);
+  }
+}
diff --git a/tests/e2e/M2/01-cards.m2.ts b/tests/e2e/M2/01-cards.m2.ts
index 6d8bc5f2..4ac7bdcb 100644
--- a/tests/e2e/M2/01-cards.m2.ts
+++ b/tests/e2e/M2/01-cards.m2.ts
@@ -9,7 +9,7 @@ import { TEXT, button, card, expect, integrations, m2Case, manageControl, portal
 import { checkCards, extraChannelNames } from '../../acceptance/lib/open-world.mjs';
 
 const squash = (t: string) => t.replace(/\s+/g, ' ').trim();
-/** The visible cards of the grid that holds the Moodle card (the "LMS Publishing" filter), as texts in page order. */
+/** The visible cards of the grid that holds the Moodle card (the "LMS Publishing" filter), in page order. */
 const lmsCardTexts = (page: Page) => page.evaluate((moodleText) => {
   const all = Array.from(document.querySelectorAll('body *')) as HTMLElement[];
   let cell: HTMLElement | null = all.find((el) => el.children.length === 0 && (el.textContent ?? '').includes(moodleText)) ?? null;
@@ -17,7 +17,19 @@ const lmsCardTexts = (page: Page) => page.evaluate((moodleText) => {
   if (!cell || !cell.parentElement) return [];
   return (Array.from(cell.parentElement.children) as HTMLElement[])
     .filter((c) => getComputedStyle(c).display !== 'none' && c.getBoundingClientRect().height > 0)
-    .map((c) => (c.textContent ?? '').replace(/\s+/g, ' ').trim());
+    .map((c) => {
+      const text = (c.textContent ?? '').replace(/\s+/g, ' ').trim();
+      const name = (c.querySelector('h2, h3, [role="heading"]')?.textContent ?? '').replace(/\s+/g, ' ').trim() || null;
+      let channel: string | null = null;
+      for (const el of Array.from(c.querySelectorAll('a[href], [id$="-connect"], [id$="-manage"]'))) {
+        const href = el.getAttribute('href') ?? '';
+        const m = /^\/integrations\/([^/?#]+)\/(?:connect|con_[^/?#]+)$/.exec(href);
+        if (m) { channel = m[1]; break; }
+        if (el.id.endsWith('-connect')) { channel = el.id.slice(0, -'-connect'.length); break; }
+        if (el.id.endsWith('-manage')) { channel = el.id.slice(0, -'-manage'.length); break; }
+      }
+      return { text, channel, name };
+    });
 }, TEXT.moodleCard);
 
 m2Case('M2-01.cards', 'the LMS Publishing filter shows the Moodle, Canvas and Blackboard cards with their texts and initials', async ({ page }) => {
diff --git a/tests/host/m1-migration.mjs b/tests/host/m1-migration.mjs
index ddc459fc..128d2452 100644
--- a/tests/host/m1-migration.mjs
+++ b/tests/host/m1-migration.mjs
@@ -9,6 +9,7 @@ import crypto from 'node:crypto';
 import fs from 'node:fs';
 import path from 'node:path';
 import { allContainers } from './lib.mjs';
+import { checkMigrationLedgers } from '../acceptance/lib/open-world.mjs';
 import { SNAPSHOT_OLD_SHA, assertSnapshotBoundary } from './m1-phases.mjs';
 import { CompatRoute, OLD_OPLOCK, qualifyRow } from './storage-compat-route.mjs';
 import { StorageFail } from './storage-docker.mjs';
@@ -337,8 +338,7 @@ export async function snapshotMigrationRun(r, { installTests, setup, probe, iden
   const expectedAppLedger = fs.existsSync(appMigDir)
     ? fs.readdirSync(appMigDir).filter((n) => n.endsWith('.sql')).sort()
     : [...oldLedger['cogniate-app/cogniate.db'], '012_connection_provider_snapshot.sql'].sort();
-  assert.deepEqual(newLedger['lti-service/lti.db'], expectedLtiLedger);
-  assert.deepEqual(newLedger['cogniate-app/cogniate.db'], expectedAppLedger);
+  checkMigrationLedgers(oldLedger, newLedger, { expectedLtiLedger, expectedAppLedger });
   const problems = qualifyRow(route.steps, { oldSha: SNAPSHOT_OLD_SHA });
   r.saveText('storage/j-snapshot.json', JSON.stringify({ oldSha: SNAPSHOT_OLD_SHA, steps: route.steps.map(({ commands, ...s }) => ({ ...s, commands: commands.length })), problems }, null, 2));
   evidence.push({ id: 'M1-41.common.j-snapshot', environment: 'SIM', status: problems.length ? 'FAIL' : 'PASS', ...identity,
diff --git a/tests/ltiaas/k0/ld1/open-world.test.mjs b/tests/ltiaas/k0/ld1/open-world.test.mjs
index f4dbb5c3..9e000bc1 100644
--- a/tests/ltiaas/k0/ld1/open-world.test.mjs
+++ b/tests/ltiaas/k0/ld1/open-world.test.mjs
@@ -5,14 +5,16 @@ import assert from 'node:assert/strict';
 import fs from 'node:fs';
 import path from 'node:path';
 import test from 'node:test';
-import { fileURLToPath } from 'node:url';
-import {
-  BASELINE_PROFILES, BASELINE_REAL_PROFILES, BASELINE_SIMULATION_PROFILES, checkCards, checkLmsEntries, checkProfiles,
-  checkSimulationProfiles, extraChannelNames, registeredChannels,
-} from '../../../acceptance/lib/open-world.mjs';
+import { fileURLToPath, pathToFileURL } from 'node:url';
 
 const here = path.dirname(fileURLToPath(import.meta.url));
 const testsDir = path.resolve(here, '../../..');
+const acceptanceOpenWorldPath = path.join(testsDir, 'acceptance/lib/open-world.mjs');
+const ltiaasOpenWorldPath = path.resolve(here, '../../lib/open-world.mjs');
+const {
+  BASELINE_PROFILES, BASELINE_REAL_PROFILES, BASELINE_SIMULATION_PROFILES, checkCards, checkLmsEntries,
+  checkMigrationLedgers, checkProfiles, checkSimulationProfiles, extraChannelNames, registeredChannels,
+} = await import(pathToFileURL(fs.existsSync(acceptanceOpenWorldPath) ? acceptanceOpenWorldPath : ltiaasOpenWorldPath).href);
 const read = (name) => JSON.parse(fs.readFileSync(path.join(here, 'g-base', name), 'utf8'));
 const copy = (value) => structuredClone(value);
 
@@ -78,7 +80,7 @@ const rows = [
     move: (a) => { a.cards.push(a.cards.splice(1, 1)[0]); },
     extra: (a, registered) => {
       if (registered) a.lmsProviders = withChannel(a.lmsProviders);
-      a.cards.push(`ConnectYour LMSPublish Cogniate courses to ${registered ? NEW.name : 'Sakai'} with LTI 1.3.`);
+      a.cards.push(`Connect${registered ? NEW.name : 'Sakai'}Publish Cogniate courses to ${registered ? NEW.name : 'Sakai LMS'} with LTI 1.3.`);
     },
   },
   {
@@ -94,10 +96,20 @@ const rows = [
   profileRow(8, 'tests/acceptance/M1/common/90-simulation-gates.test.ts M1-35.common.<profile>-<simulation>', defaults, BASELINE_REAL_PROFILES, true),
 ];
 
-test('the probe card texts equal tests/e2e/M2/lib/m2.ts TEXT', () => {
-  const source = fs.readFileSync(path.join(testsDir, 'e2e/M2/lib/m2.ts'), 'utf8');
-  for (const [key, text] of [['moodleCard', CARD_TEXTS[0]], ['canvasCard', CARD_TEXTS[1]], ['blackboardCard', CARD_TEXTS[2]]]) {
-    assert.ok(source.includes(`${key}: ${JSON.stringify(text).replaceAll('"', "'")}`), key);
+test('the probe card texts equal tests/e2e/M2/lib/m2.ts TEXT, and open-world copies match when present', () => {
+  const m2Path = path.join(testsDir, 'e2e/M2/lib/m2.ts');
+  if (fs.existsSync(m2Path)) {
+    const source = fs.readFileSync(m2Path, 'utf8');
+    for (const [key, text] of [['moodleCard', CARD_TEXTS[0]], ['canvasCard', CARD_TEXTS[1]], ['blackboardCard', CARD_TEXTS[2]]]) {
+      assert.ok(source.includes(`${key}: ${JSON.stringify(text).replaceAll('"', "'")}`), key);
+    }
+  }
+  if (fs.existsSync(acceptanceOpenWorldPath)) {
+    assert.equal(
+      fs.readFileSync(acceptanceOpenWorldPath, 'utf8'),
+      fs.readFileSync(ltiaasOpenWorldPath, 'utf8'),
+      'tests/acceptance/lib/open-world.mjs and tests/ltiaas/lib/open-world.mjs are identical',
+    );
   }
 });
 
@@ -146,3 +158,92 @@ test('row 6: the G-BASE Kajabi card is allowed, but not twice', () => {
   answer.push(answer[0]);
   assert.throws(() => checkCards(answer, CARD_TEXTS, { names: [] }), assert.AssertionError);
 });
+
+test('row 6 exact membership (A-LA-E0-04-01 / B-LA-E0-04-01): mixed registered and unregistered cards with lti-generic (channelName: LMS)', () => {
+  const names = extraChannelNames(withChannel(acceptance.lmsProviders));
+  assert.deepEqual(names, ['lti-generic', 'LMS']);
+  const registeredStringCard = 'ConnectLMSPublish Cogniate courses to LMS with LTI 1.3.';
+  const registeredDomCard = {
+    text: 'LTI Connect LTI 1.3 Publish Cogniate courses to any LMS that supports LTI 1.3 Advantage.',
+    channel: 'lti-generic',
+    name: 'LTI 1.3',
+  };
+  assert.equal(checkCards([...cards.cards, registeredStringCard], CARD_TEXTS, { names }).length, 2);
+  assert.equal(checkCards([...cards.cards, registeredDomCard], CARD_TEXTS, { names }).length, 2);
+
+  const unregisteredCards = [
+    'Connect Sakai Publish Cogniate courses to Sakai LMS with LTI 1.3.',
+    'ConnectSakai LMSPublish Cogniate courses to Sakai with LTI 1.3.',
+    'ConnectYour LMSPublish Cogniate courses to Sakai with LTI 1.3.',
+    { text: registeredStringCard, channel: 'sakai', name: 'LMS' },
+    { text: 'Connect Sakai Publish Cogniate courses to Sakai LMS with LTI 1.3.', channel: null, name: 'Sakai LMS' },
+  ];
+  for (const bad of unregisteredCards) {
+    assert.throws(() => checkCards([...cards.cards, bad], CARD_TEXTS, { names }), assert.AssertionError);
+    assert.throws(() => checkCards([...cards.cards, registeredDomCard, bad], CARD_TEXTS, { names }), assert.AssertionError);
+  }
+});
+
+test('M1-41.common.j-snapshot migration ledger (A-LA-E0-04-02): old ledger is a prefix of upgraded ledger and matches candidate migrations', () => {
+  const oldLedger = {
+    'lti-service/lti.db': ['001_init.sql', '005_lti_grants.sql'],
+    'cogniate-app/cogniate.db': ['001_init.sql', '011_lms_types.sql'],
+  };
+  const expectedLtiLedger = ['001_init.sql', '005_lti_grants.sql', '006_lti_provider_selection.sql', '007_lti_channel_columns.sql'];
+  const expectedAppLedger = [
+    '001_init.sql',
+    '011_lms_types.sql',
+    '012_connection_provider_snapshot.sql',
+    '013_connection_channel_columns.sql',
+  ];
+  const newLedger = {
+    'lti-service/lti.db': [...expectedLtiLedger],
+    'cogniate-app/cogniate.db': [...expectedAppLedger],
+  };
+  checkMigrationLedgers(oldLedger, newLedger, { expectedLtiLedger, expectedAppLedger });
+
+  // Missing historical entry in lti.db or cogniate.db fails even if also removed from expected*Ledger.
+  const droppedLti = expectedLtiLedger.slice(1);
+  assert.throws(
+    () =>
+      checkMigrationLedgers(
+        oldLedger,
+        { 'lti-service/lti.db': droppedLti, 'cogniate-app/cogniate.db': expectedAppLedger },
+        { expectedLtiLedger: droppedLti, expectedAppLedger },
+      ),
+    assert.AssertionError,
+  );
+  const droppedApp = expectedAppLedger.filter((m) => m !== '011_lms_types.sql');
+  assert.throws(
+    () =>
+      checkMigrationLedgers(
+        oldLedger,
+        { 'lti-service/lti.db': expectedLtiLedger, 'cogniate-app/cogniate.db': droppedApp },
+        { expectedLtiLedger, expectedAppLedger: droppedApp },
+      ),
+    assert.AssertionError,
+  );
+
+  // Reordered historical prefix fails even if expected*Ledger matches newLedger.
+  const reorderedLti = ['005_lti_grants.sql', '001_init.sql', '006_lti_provider_selection.sql', '007_lti_channel_columns.sql'];
+  assert.throws(
+    () =>
+      checkMigrationLedgers(
+        oldLedger,
+        { 'lti-service/lti.db': reorderedLti, 'cogniate-app/cogniate.db': expectedAppLedger },
+        { expectedLtiLedger: reorderedLti, expectedAppLedger },
+      ),
+    assert.AssertionError,
+  );
+
+  // Unapplied candidate migration file fails exact comparison.
+  assert.throws(
+    () =>
+      checkMigrationLedgers(
+        oldLedger,
+        { 'lti-service/lti.db': expectedLtiLedger.slice(0, -1), 'cogniate-app/cogniate.db': expectedAppLedger },
+        { expectedLtiLedger, expectedAppLedger },
+      ),
+    assert.AssertionError,
+  );
+});
diff --git a/tests/ltiaas/k0/ld1/open-world.test.ts b/tests/ltiaas/k0/ld1/open-world.test.ts
index e54741b2..c0fcac97 100644
--- a/tests/ltiaas/k0/ld1/open-world.test.ts
+++ b/tests/ltiaas/k0/ld1/open-world.test.ts
@@ -23,6 +23,7 @@ const {
   BASELINE_SIMULATION_PROFILES,
   checkCards,
   checkLmsEntries,
+  checkMigrationLedgers,
   checkProfiles,
   checkSimulationProfiles,
   extraChannelNames,
@@ -155,7 +156,7 @@ const rows: ProbeRow[] = [
     },
     extra: (a, registered) => {
       if (registered) a.lmsProviders = withChannel(a.lmsProviders);
-      a.cards.push(`ConnectYour LMSPublish Cogniate courses to ${registered ? NEW.name : 'Sakai'} with LTI 1.3.`);
+      a.cards.push(`Connect${registered ? NEW.name : 'Sakai'}Publish Cogniate courses to ${registered ? NEW.name : 'Sakai LMS'} with LTI 1.3.`);
     },
   },
   {
@@ -184,13 +185,16 @@ const rows: ProbeRow[] = [
 ];
 
 test('the probe card texts equal tests/e2e/M2/lib/m2.ts TEXT, and open-world copies match when present', () => {
-  const source = fs.readFileSync(path.join(testsDir, 'e2e/M2/lib/m2.ts'), 'utf8');
-  for (const [key, text] of [
-    ['moodleCard', CARD_TEXTS[0]],
-    ['canvasCard', CARD_TEXTS[1]],
-    ['blackboardCard', CARD_TEXTS[2]],
-  ] as const) {
-    assert.ok(source.includes(`${key}: ${JSON.stringify(text).replaceAll('"', "'")}`), key);
+  const m2Path = path.join(testsDir, 'e2e/M2/lib/m2.ts');
+  if (fs.existsSync(m2Path)) {
+    const source = fs.readFileSync(m2Path, 'utf8');
+    for (const [key, text] of [
+      ['moodleCard', CARD_TEXTS[0]],
+      ['canvasCard', CARD_TEXTS[1]],
+      ['blackboardCard', CARD_TEXTS[2]],
+    ] as const) {
+      assert.ok(source.includes(`${key}: ${JSON.stringify(text).replaceAll('"', "'")}`), key);
+    }
   }
   if (fs.existsSync(acceptanceOpenWorldPath)) {
     assert.equal(
@@ -259,3 +263,92 @@ test('row 6: the G-BASE Kajabi card is allowed, but not twice', () => {
   answer.push(answer[0]);
   assert.throws(() => checkCards(answer, CARD_TEXTS, { names: [] }), assert.AssertionError);
 });
+
+test('row 6 exact membership (A-LA-E0-04-01 / B-LA-E0-04-01): mixed registered and unregistered cards with lti-generic (channelName: LMS)', () => {
+  const names = extraChannelNames(withChannel(acceptance.lmsProviders));
+  assert.deepEqual(names, ['lti-generic', 'LMS']);
+  const registeredStringCard = 'ConnectLMSPublish Cogniate courses to LMS with LTI 1.3.';
+  const registeredDomCard = {
+    text: 'LTI Connect LTI 1.3 Publish Cogniate courses to any LMS that supports LTI 1.3 Advantage.',
+    channel: 'lti-generic',
+    name: 'LTI 1.3',
+  };
+  assert.equal(checkCards([...cards.cards, registeredStringCard], CARD_TEXTS, { names }).length, 2);
+  assert.equal(checkCards([...cards.cards, registeredDomCard], CARD_TEXTS, { names }).length, 2);
+
+  const unregisteredCards = [
+    'Connect Sakai Publish Cogniate courses to Sakai LMS with LTI 1.3.',
+    'ConnectSakai LMSPublish Cogniate courses to Sakai with LTI 1.3.',
+    'ConnectYour LMSPublish Cogniate courses to Sakai with LTI 1.3.',
+    { text: registeredStringCard, channel: 'sakai', name: 'LMS' },
+    { text: 'Connect Sakai Publish Cogniate courses to Sakai LMS with LTI 1.3.', channel: null, name: 'Sakai LMS' },
+  ];
+  for (const bad of unregisteredCards) {
+    assert.throws(() => checkCards([...cards.cards, bad], CARD_TEXTS, { names }), assert.AssertionError);
+    assert.throws(() => checkCards([...cards.cards, registeredDomCard, bad], CARD_TEXTS, { names }), assert.AssertionError);
+  }
+});
+
+test('M1-41.common.j-snapshot migration ledger (A-LA-E0-04-02): old ledger is a prefix of upgraded ledger and matches candidate migrations', () => {
+  const oldLedger = {
+    'lti-service/lti.db': ['001_init.sql', '005_lti_grants.sql'],
+    'cogniate-app/cogniate.db': ['001_init.sql', '011_lms_types.sql'],
+  };
+  const expectedLtiLedger = ['001_init.sql', '005_lti_grants.sql', '006_lti_provider_selection.sql', '007_lti_channel_columns.sql'];
+  const expectedAppLedger = [
+    '001_init.sql',
+    '011_lms_types.sql',
+    '012_connection_provider_snapshot.sql',
+    '013_connection_channel_columns.sql',
+  ];
+  const newLedger = {
+    'lti-service/lti.db': [...expectedLtiLedger],
+    'cogniate-app/cogniate.db': [...expectedAppLedger],
+  };
+  checkMigrationLedgers(oldLedger, newLedger, { expectedLtiLedger, expectedAppLedger });
+
+  // Missing historical entry in lti.db or cogniate.db fails even if also removed from expected*Ledger.
+  const droppedLti = expectedLtiLedger.slice(1);
+  assert.throws(
+    () =>
+      checkMigrationLedgers(
+        oldLedger,
+        { 'lti-service/lti.db': droppedLti, 'cogniate-app/cogniate.db': expectedAppLedger },
+        { expectedLtiLedger: droppedLti, expectedAppLedger },
+      ),
+    assert.AssertionError,
+  );
+  const droppedApp = expectedAppLedger.filter((m) => m !== '011_lms_types.sql');
+  assert.throws(
+    () =>
+      checkMigrationLedgers(
+        oldLedger,
+        { 'lti-service/lti.db': expectedLtiLedger, 'cogniate-app/cogniate.db': droppedApp },
+        { expectedLtiLedger, expectedAppLedger: droppedApp },
+      ),
+    assert.AssertionError,
+  );
+
+  // Reordered historical prefix fails even if expected*Ledger matches newLedger.
+  const reorderedLti = ['005_lti_grants.sql', '001_init.sql', '006_lti_provider_selection.sql', '007_lti_channel_columns.sql'];
+  assert.throws(
+    () =>
+      checkMigrationLedgers(
+        oldLedger,
+        { 'lti-service/lti.db': reorderedLti, 'cogniate-app/cogniate.db': expectedAppLedger },
+        { expectedLtiLedger: reorderedLti, expectedAppLedger },
+      ),
+    assert.AssertionError,
+  );
+
+  // Unapplied candidate migration file fails exact comparison.
+  assert.throws(
+    () =>
+      checkMigrationLedgers(
+        oldLedger,
+        { 'lti-service/lti.db': expectedLtiLedger.slice(0, -1), 'cogniate-app/cogniate.db': expectedAppLedger },
+        { expectedLtiLedger, expectedAppLedger },
+      ),
+    assert.AssertionError,
+  );
+});
diff --git a/tests/ltiaas/lib/open-world.d.mts b/tests/ltiaas/lib/open-world.d.mts
index 2629c41d..c0f43502 100644
--- a/tests/ltiaas/lib/open-world.d.mts
+++ b/tests/ltiaas/lib/open-world.d.mts
@@ -26,4 +26,26 @@ export function appLmsProviders(
     Promise<{ status: number; headers: Record<string, any>; body: string }>,
   options: { appUrl: string; ca?: string | null; user: { email: string; password: string } },
 ): Promise<Json>;
-export function checkCards(cards: string[], baselineTexts: string[], options: { names: string[]; others?: string[]; label?: string }): string[];
+export interface CardDescriptor {
+  text: string;
+  channel?: string | null;
+  id?: string | null;
+  name?: string | null;
+  title?: string | null;
+}
+export type CardInput = string | CardDescriptor;
+export function checkCards<T extends CardInput>(
+  cards: T[],
+  baselineTexts: string[],
+  options: { names: string[]; others?: string[]; label?: string },
+): T[];
+export interface MigrationLedgerMap {
+  'lti-service/lti.db': string[];
+  'cogniate-app/cogniate.db': string[];
+  [db: string]: string[];
+}
+export function checkMigrationLedgers(
+  oldLedger: MigrationLedgerMap,
+  newLedger: MigrationLedgerMap,
+  options?: { expectedLtiLedger?: string[]; expectedAppLedger?: string[]; label?: string },
+): void;
diff --git a/tests/ltiaas/lib/open-world.mjs b/tests/ltiaas/lib/open-world.mjs
index c38c4e49..f1332dfc 100644
--- a/tests/ltiaas/lib/open-world.mjs
+++ b/tests/ltiaas/lib/open-world.mjs
@@ -58,11 +58,23 @@ export function registeredChannels(lmsProviders) {
   return new Set(ids);
 }
 
-/** The text names of the registered channels that are not baseline channels (`channelName`, else `label`). */
+/**
+ * The exact channel ids and names of the registered channels that are not baseline channels
+ * (`channel`/`lms`, `channelName`, `label`).
+ */
 export function extraChannelNames(lmsProviders) {
   assert.ok(Array.isArray(lmsProviders?.lms), 'GET /app-api/lms-providers has an lms list');
-  return lmsProviders.lms.filter((entry) => !BASELINE_LMS.includes(entry.channel ?? entry.lms))
-    .map((entry) => entry.channelName ?? entry.label).filter((name) => typeof name === 'string' && name.length > 0);
+  const names = [];
+  for (const entry of lmsProviders.lms) {
+    const id = entry.channel ?? entry.lms;
+    if (BASELINE_LMS.includes(id)) continue;
+    for (const candidate of [id, entry.channelName, entry.label]) {
+      if (typeof candidate === 'string' && candidate.trim().length > 0 && !names.includes(candidate.trim())) {
+        names.push(candidate.trim());
+      }
+    }
+  }
+  return names;
 }
 
 /**
@@ -179,20 +191,99 @@ export async function appLmsProviders(request, { appUrl, ca, user }) {
   return JSON.parse(answer.body);
 }
 
+const cardText = (card) => (typeof card === 'string' ? card : String(card?.text ?? ''));
+
+const isOtherCard = (card, other) => {
+  if (card && typeof card === 'object') {
+    const channel = card.channel ?? card.id ?? null;
+    if (typeof channel === 'string' && channel.trim().length > 0) return false;
+  }
+  return cardText(card).includes(other);
+};
+
+function checkExtraCard(card, allowed, label) {
+  if (card && typeof card === 'object') {
+    const channel = typeof card.channel === 'string' && card.channel.trim().length > 0
+      ? card.channel.trim()
+      : typeof card.id === 'string' && card.id.trim().length > 0
+        ? card.id.trim()
+        : null;
+    const name = typeof card.name === 'string' && card.name.trim().length > 0
+      ? card.name.trim()
+      : typeof card.title === 'string' && card.title.trim().length > 0
+        ? card.title.trim()
+        : null;
+    if (channel !== null) {
+      assert.ok(allowed.has(channel), `${label}: extra card ${show(card)} has unregistered channel ${show(channel)}`);
+      return;
+    }
+    if (name !== null) {
+      assert.ok(allowed.has(name), `${label}: extra card ${show(card)} names no registered channel (${show(name)})`);
+      return;
+    }
+  }
+  const raw = cardText(card).trim();
+  const headingMatch = /^(?:[A-Za-z0-9]{1,4}\s*)?(?:Connect|Manage)\s*(.+?)\s*(?:Publish|Export)\b/.exec(raw);
+  const targetMatch = /Publish Cogniate courses to\s+(.+?)\s+with LTI 1\.3\./.exec(raw);
+  const candidates = headingMatch
+    ? [headingMatch[1].trim(), ...(targetMatch ? [targetMatch[1].trim()] : [])]
+    : [raw];
+  assert.ok(
+    candidates.length > 0 && candidates.every((c) => c.length > 0 && allowed.has(c)),
+    `${label}: extra card ${show(card)} names no registered channel`,
+  );
+}
+
 /**
- * Row 6: the visible cards of the "LMS Publishing" filter, as card texts in page order. Each baseline card text is
- * in exactly one card, in the baseline order. An extra card is a G-BASE non-channel card (`others`, each at most
- * once) or names a registered channel that is not a baseline channel (`names`, from extraChannelNames).
- * Returns the extra card texts.
+ * Row 6: the visible cards of the "LMS Publishing" filter, in page order. Each baseline card text is in
+ * exactly one card, in the baseline order. An extra card is a G-BASE non-channel card (`others`, each at most
+ * once) or matches a registered non-baseline channel by exact `id` or `name` (`names`, from extraChannelNames),
+ * never by substring. Returns the extra cards.
  */
 export function checkCards(cards, baselineTexts, { names, others = BASELINE_OTHER_CARDS, label = 'LMS Publishing cards' }) {
-  const extras = openList(cards, baselineTexts, { label, matches: (text, expected) => String(text).includes(expected) });
+  const allowed = new Set(names.filter((n) => typeof n === 'string' && n.trim().length > 0).map((n) => n.trim()));
+  const extras = openList(cards, baselineTexts, { label, matches: (card, expected) => cardText(card).includes(expected) });
   for (const other of others) {
-    assert.ok(extras.filter((text) => String(text).includes(other)).length <= 1, `${label}: the card ${show(other)} appears more than once`);
+    assert.ok(extras.filter((card) => isOtherCard(card, other)).length <= 1, `${label}: the card ${show(other)} appears more than once`);
   }
-  for (const text of extras) {
-    if (others.some((other) => String(text).includes(other))) continue;
-    assert.ok(names.some((name) => String(text).includes(name)), `${label}: extra card ${show(text)} names no registered channel`);
+  for (const card of extras) {
+    if (others.some((other) => isOtherCard(card, other))) continue;
+    checkExtraCard(card, allowed, label);
   }
   return extras;
 }
+
+/**
+ * Snapshot-upgrade migration ledger check (M1-41.common.j-snapshot; BD-A2-108 / LD-24):
+ * 1. Every historical ledger entry from `oldLedger` is still present in `newLedger` in its original order
+ *    (each `oldLedger[db]` is a non-empty prefix of `newLedger[db]`), independent of the candidate's files.
+ * 2. `newLedger['cogniate-app/cogniate.db']` includes `012_connection_provider_snapshot.sql`.
+ * 3. Each upgraded ledger equals the candidate's full sorted migration file list (`expectedLtiLedger`, `expectedAppLedger`).
+ */
+export function checkMigrationLedgers(
+  oldLedger,
+  newLedger,
+  { expectedLtiLedger, expectedAppLedger, label = 'M1-41.common.j-snapshot migration ledger' } = {},
+) {
+  for (const db of ['lti-service/lti.db', 'cogniate-app/cogniate.db']) {
+    const oldEntries = oldLedger?.[db];
+    const newEntries = newLedger?.[db];
+    assert.ok(Array.isArray(oldEntries) && oldEntries.length > 0, `${label}: ${db} old ledger is a non-empty list`);
+    assert.ok(Array.isArray(newEntries) && newEntries.length >= oldEntries.length, `${label}: ${db} upgraded ledger is shorter than old ledger`);
+    assert.deepEqual(
+      newEntries.slice(0, oldEntries.length),
+      oldEntries,
+      `${label}: ${db} old ledger is not a prefix of the upgraded ledger`,
+    );
+  }
+  assert.ok(
+    newLedger['cogniate-app/cogniate.db'].includes('012_connection_provider_snapshot.sql'),
+    `${label}: cogniate-app/cogniate.db upgraded ledger is missing 012_connection_provider_snapshot.sql`,
+  );
+  if (expectedLtiLedger !== undefined) {
+    assert.deepEqual(newLedger['lti-service/lti.db'], expectedLtiLedger, `${label}: lti-service/lti.db ledger does not match candidate migrations`);
+  }
+  if (expectedAppLedger !== undefined) {
+    assert.deepEqual(newLedger['cogniate-app/cogniate.db'], expectedAppLedger, `${label}: cogniate-app/cogniate.db ledger does not match candidate migrations`);
+  }
+}
```

---

## 3. `git apply --check` on `la-gate-test-6` & Host K0 / Typecheck Verification

### 3.1 `git apply --check -v` Against `/Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end-6` (`la-gate-test-6`)

```text
$ git -C /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end-6 rev-parse HEAD la-gate-test-6^{commit}
9de014298fbe133ebbd8d40365da84988ccabf5d
9de014298fbe133ebbd8d40365da84988ccabf5d

$ git -C /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end-6 apply --check -v /Users/quangnguyen/cogniate-qa-runs/LA/ld1-overlay-fix-r1/ld9-addendum-r5.patch
Checking patch tests/acceptance/lib/open-world.d.mts...
Checking patch tests/acceptance/lib/open-world.mjs...
Checking patch tests/e2e/M2/01-cards.m2.ts...
Checking patch tests/host/m1-migration.mjs...
Checking patch tests/ltiaas/k0/ld1/open-world.test.mjs...
Checking patch tests/ltiaas/k0/ld1/open-world.test.ts...
Checking patch tests/ltiaas/lib/open-world.d.mts...
Checking patch tests/ltiaas/lib/open-world.mjs...

$ git -C /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end-6 status --short
```

`git apply --check -v` exited `0`, and `git status --short` in `/Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end-6` produced empty output.

### 3.2 Host K0 `ld1` Self-Tests & Typecheck in Scratch Clone (`/Users/quangnguyen/cogniate-qa-runs/LA/ld1-overlay-fix-r1/src-scratch`)

```text
$ node --test tests/ltiaas/k0/ld1/open-world.test.mjs
✔ the probe card texts equal tests/e2e/M2/lib/m2.ts TEXT, and open-world copies match when present (0.818833ms)
...
✔ row 6: the G-BASE Kajabi card is allowed, but not twice (0.046333ms)
✔ row 6 exact membership (A-LA-E0-04-01 / B-LA-E0-04-01): mixed registered and unregistered cards with lti-generic (channelName: LMS) (0.277584ms)
✔ M1-41.common.j-snapshot migration ledger (A-LA-E0-04-02): old ledger is a prefix of upgraded ledger and matches candidate migrations (0.325375ms)
ℹ tests 42
ℹ pass 42
ℹ fail 0
ℹ duration_ms 44.626625

$ npx vitest run --config tests/ltiaas/k0/vitest.config.mts
 ✓ tests/ltiaas/k0/contract.test.ts (103 tests) 249ms
 ✓ tests/ltiaas/k0/ld1/open-world.test.ts (42 tests) 8ms
 ✓ tests/ltiaas/k0/smoke.test.ts (2 tests) 1ms
 Test Files  3 passed (3)
      Tests  147 passed (147)

$ npm --prefix tests run typecheck
> cogniate-qa-tests@0.0.0 typecheck
> tsc --noEmit -p tsconfig.json
```

---

## 4. Re-Gate Rows Covered by This Overlay Fix (`pending: Docker window`)

When `la-gate-test-7` (`la-gate-test-6` + this `ld9-addendum-r5.patch`) is run in an authorized SIM Docker window on `$WAVE_SHA_3` (`8fadb828088ffe1b4db02179ab0fa3ab2388a12a`), the affected re-gate rows are:

| Suite / Phase | File | Re-Gate Case / Row IDs | What the Re-Gate Row Exercises |
| --- | --- | --- | --- |
| **`M2` (`01-cards.m2.ts`)** | `tests/e2e/M2/01-cards.m2.ts` | **`M2-01.cards`**, **`M2-01.isolated-newest`**, **`M2-01.moodle-card`** (`3` cases in `01-cards.m2.ts`, or full `64`-case `M2` via `tests/e2e/host/run-m2.mjs`) | `M2-01.cards` runs `lmsCardTexts(page)` (`{ text, channel, name }`) and `checkCards(..., { names: extraChannelNames(providers.json) })` against the live `/integrations` `"LMS Publishing"` grid (`Kajabi`, `Moodle`, `Canvas`, `Blackboard`, `LTI 1.3` with `channel: 'lti-generic'`, `D2L Brightspace` with `channel: 'brightspace'`). |
| **`M1 --phase snapshot-upgrade`** | `tests/host/m1-migration.mjs` | **`M1-38.common.h1`**, **`M1-38.common.h2`**, **`M1-38.common.h3`**, **`M1-38.common.h4`**, **`M1-38.common.h5`**, **`M1-41.common.j-snapshot`** (`6` manifest rows) | `snapshotMigrationRun` runs `checkMigrationLedgers(oldLedger, newLedger, { expectedLtiLedger, expectedAppLedger })` before recording `M1-41.common.j-snapshot`, proving that `oldLedger` from `5c7eb8d` is an exact prefix of `newLedger` on `8fadb828`, `'012_connection_provider_snapshot.sql'` is present in `cogniate.db`, and `newLedger` equals the candidate's sorted migration files (`21` in `lti.db`, `18` in `cogniate.db`). |
| **`M1 --phase migration`** | `tests/host/m1-migration.mjs` | **`M1-23.common.baseline`**, **`M1-23.common.upgrade`**, **`M1-30.common.postwrite`**, **`M1-30.common.rollback`**, plus the `8` `M1-41.common.{a..i,j-migration}` storage rows (`12` manifest rows) | Confirms that importing `checkMigrationLedgers` in `tests/host/m1-migration.mjs` leaves `migrationRun` (`M1 --phase migration`) `12/12 PASS`. |


---

## Round 2 (`task_e4e91f923e4c` / `ctx_a0b10ce4f402`, 2026-10-24) — Card Loading Settlement (`A-LA-E0-04-03`), Disabled / Distinct-Title Card Identity (`B-LA-E0-04-02`), and `LD-24` / Migration Count Corrections (`A-LA-E0-04-04`)

### 5.1 Round 2 Findings Closed

In Round 2 reviews (`69c4fb40:docs/reviews/LA-E0-04/reviewer-a.md` and `69c4fb40:docs/reviews/LA-E0-04/reviewer-b.md`), Round 1 findings `A-LA-E0-04-01 = B-LA-E0-04-01` and `A-LA-E0-04-02` are **CLOSED** (with `M1-41.common.j-snapshot` migration-ledger approval ratified as Lead decision **`LD-24`**), and three Round 2 findings are closed below:

| # | Finding | Severity & Reviewer | Files Updated | How Closed |
| --- | --- | --- | --- | --- |
| 1 | **`A-LA-E0-04-03`** | **MAJOR** (Reviewer-A) | `tests/e2e/M2/01-cards.m2.ts`, `tests/acceptance/lib/open-world.{mjs,d.mts}`, `tests/ltiaas/lib/open-world.{mjs,d.mts}`, `tests/ltiaas/k0/ld1/open-world.test.{mjs,ts}` | While `/connections` is loading in the browser, channel cards render `"Loading…"` instead of their `Connect`/`Manage` control. `lmsCardTexts(page)` now detects `loading: true` on any card that has no `Connect`/`Manage` control or shows a `Loading…` leaf, and polls via `await expect.poll(...)` until `cards.length > 0 && cards.every((c) => !c.loading)` before returning the card descriptors. `checkCards` and `checkExtraCard` (`open-world.mjs`) also reject any unsettled loading card (`!isLoadingCard(card)`). Covered by the K0 test `row 6 loading state (A-LA-E0-04-03): delayed connections settle and pass; permanently unresolved loading fails`. |
| 2 | **`B-LA-E0-04-02`** | **MAJOR** (Reviewer-B) | `tests/e2e/M2/01-cards.m2.ts`, `tests/acceptance/lib/open-world.{mjs,d.mts}`, `tests/ltiaas/lib/open-world.{mjs,d.mts}`, `tests/ltiaas/k0/ld1/open-world.test.{mjs,ts}` | In the `ready: false` branch (`<button disabled>Connect</button>`, no `href`/`id`), `lmsCardTexts(page)` extracts `notReadyLms` from the card's leaf `<LMS> is not set up for this Cogniate service yet.` notice and sets `channel = notReadyLms` when `disabled && !channel`. In `open-world.mjs`, `extraChannelNames(lmsProviders)` collects `id`, `channelName`, `label`, and any explicit card title fields, and `checkExtraCard` validates `target`, `notReadyLms`, and `matchesAllowedCardName(name, allowed)` so a registered channel in the disabled `ready: false` state or with a distinct display title (such as `card.title: 'Campus Learning'` for `id: 'campus'`, `channelName: 'Campus'`, `label: 'Campus LMS'`, or `'LTI 1.3'` for `'lti-generic'`) passes while unregistered cards in the same state (`'Sakai Learning'`, `'Sakai LMS'`, etc.) fail. Covered by the K0 test `row 6 not-ready disabled card with distinct display title (B-LA-E0-04-02): registered passes, unregistered fails`. |
| 3 | **`A-LA-E0-04-04`** | **MINOR** (Reviewer-A) | `tests/acceptance/lib/open-world.mjs`, `tests/ltiaas/lib/open-world.mjs`, `tests/ltiaas/k0/ld1/open-world.test.{mjs,ts}`, `docs/reviews/LA-E7-08/ld9-addendum-r5.md`, `docs/reviews/LA-E0-04/qa.md`, `docs/reviews/LA-E7-08/qa.md`, `tests/ltiaas/GATE-RUN-PLAN.md` | Replaced `LA-H21` with `LD-24` (alongside `BD-A2-108`) in `open-world.mjs` comments, K0 test titles, and all review/plan docs, and corrected `14 in cogniate.db` to `18 in cogniate.db` (`21` LTI and `18` app migrations on `8fadb828`) in §4 above. |

### 5.2 Complete Updated Diff Against `la-gate-test-6` (`9de014298fbe133ebbd8d40365da84988ccabf5d`)

Generated in `/Users/quangnguyen/cogniate-qa-runs/LA/ld1-overlay-fix-r1/src-scratch` detached at `la-gate-test-6` (`9de014298fbe133ebbd8d40365da84988ccabf5d`) and saved to `/Users/quangnguyen/cogniate-qa-runs/LA/ld1-overlay-fix-r1/ld9-addendum-r5.patch`:

```diff
diff --git a/tests/acceptance/lib/open-world.d.mts b/tests/acceptance/lib/open-world.d.mts
index 2629c41d..287a6b19 100644
--- a/tests/acceptance/lib/open-world.d.mts
+++ b/tests/acceptance/lib/open-world.d.mts
@@ -26,4 +26,29 @@ export function appLmsProviders(
     Promise<{ status: number; headers: Record<string, any>; body: string }>,
   options: { appUrl: string; ca?: string | null; user: { email: string; password: string } },
 ): Promise<Json>;
-export function checkCards(cards: string[], baselineTexts: string[], options: { names: string[]; others?: string[]; label?: string }): string[];
+export interface CardDescriptor {
+  text: string;
+  channel?: string | null;
+  id?: string | null;
+  name?: string | null;
+  title?: string | null;
+  disabled?: boolean;
+  loading?: boolean;
+  notReadyLms?: string | null;
+}
+export type CardInput = string | CardDescriptor;
+export function checkCards<T extends CardInput>(
+  cards: T[],
+  baselineTexts: string[],
+  options: { names: string[]; others?: string[]; label?: string },
+): T[];
+export interface MigrationLedgerMap {
+  'lti-service/lti.db': string[];
+  'cogniate-app/cogniate.db': string[];
+  [db: string]: string[];
+}
+export function checkMigrationLedgers(
+  oldLedger: MigrationLedgerMap,
+  newLedger: MigrationLedgerMap,
+  options?: { expectedLtiLedger?: string[]; expectedAppLedger?: string[]; label?: string },
+): void;
diff --git a/tests/acceptance/lib/open-world.mjs b/tests/acceptance/lib/open-world.mjs
index c38c4e49..975a3a6a 100644
--- a/tests/acceptance/lib/open-world.mjs
+++ b/tests/acceptance/lib/open-world.mjs
@@ -58,11 +58,32 @@ export function registeredChannels(lmsProviders) {
   return new Set(ids);
 }
 
-/** The text names of the registered channels that are not baseline channels (`channelName`, else `label`). */
+/**
+ * The exact channel ids and names of the registered channels that are not baseline channels
+ * (`channel`/`lms`, `channelName`, `label`, and any explicit card `title`/`cardTitle`).
+ */
 export function extraChannelNames(lmsProviders) {
   assert.ok(Array.isArray(lmsProviders?.lms), 'GET /app-api/lms-providers has an lms list');
-  return lmsProviders.lms.filter((entry) => !BASELINE_LMS.includes(entry.channel ?? entry.lms))
-    .map((entry) => entry.channelName ?? entry.label).filter((name) => typeof name === 'string' && name.length > 0);
+  const names = [];
+  for (const entry of lmsProviders.lms) {
+    const id = entry.channel ?? entry.lms;
+    if (BASELINE_LMS.includes(id)) continue;
+    for (const candidate of [
+      id,
+      entry.channelName,
+      entry.label,
+      entry.cardTitle,
+      entry.title,
+      entry.card?.title,
+      entry.names?.text,
+      entry.names?.label,
+    ]) {
+      if (typeof candidate === 'string' && candidate.trim().length > 0 && !names.includes(candidate.trim())) {
+        names.push(candidate.trim());
+      }
+    }
+  }
+  return names;
 }
 
 /**
@@ -179,20 +200,164 @@ export async function appLmsProviders(request, { appUrl, ca, user }) {
   return JSON.parse(answer.body);
 }
 
+const cardText = (card) => (typeof card === 'string' ? card : String(card?.text ?? ''));
+
+const isLoadingCard = (card) => {
+  if (card && typeof card === 'object' && card.loading === true) return true;
+  const raw = cardText(card).trim();
+  return /^(?:[A-Za-z0-9]{1,4}\s*)?Loading(?:…|\.\.\.)/.test(raw);
+};
+
+const isOtherCard = (card, other) => {
+  if (card && typeof card === 'object') {
+    const channel = card.channel ?? card.id ?? null;
+    if (typeof channel === 'string' && channel.trim().length > 0) return false;
+  }
+  return cardText(card).includes(other);
+};
+
+const GENERIC_CHANNEL_NAMES = new Set(['lms', 'lti', 'lti 1.3', 'other lti 1.3 platform', 'lti-generic']);
+const GENERIC_TITLE_SUFFIX_WORDS = new Set(['learning', 'learn', 'lms', 'platform', 'cloud', 'server', 'lti', '1.3', 'edition', 'suite']);
+
+function matchesAllowedCardName(name, allowed) {
+  if (allowed.has(name)) return true;
+  if (name === 'LTI 1.3' && (allowed.has('lti-generic') || allowed.has('Other LTI 1.3 platform'))) return true;
+  for (const entry of allowed) {
+    if (GENERIC_CHANNEL_NAMES.has(entry.toLowerCase())) continue;
+    const words = entry.trim().split(/\s+/);
+    while (words.length > 1 && GENERIC_TITLE_SUFFIX_WORDS.has(words[words.length - 1].toLowerCase())) words.pop();
+    const stem = words.join(' ');
+    for (const prefix of new Set([entry, stem])) {
+      if (GENERIC_CHANNEL_NAMES.has(prefix.toLowerCase())) continue;
+      if (name === prefix) return true;
+      if (name.startsWith(prefix + ' ')) {
+        const rest = name.slice(prefix.length).trim().split(/\s+/);
+        if (rest.length > 0 && rest.every((w) => GENERIC_TITLE_SUFFIX_WORDS.has(w.toLowerCase()))) return true;
+      }
+    }
+  }
+  return false;
+}
+
+function checkExtraCard(card, allowed, label) {
+  assert.ok(!isLoadingCard(card), `${label}: card ${show(card)} is still loading`);
+  const raw = cardText(card).trim();
+  const notReadyMatch = /^(?:.*\.\s*)?([A-Za-z0-9][A-Za-z0-9 _/-]*?)\s+is not set up for this Cogniate service yet\b/.exec(raw);
+  const notReadyLms =
+    (card && typeof card === 'object' && typeof card.notReadyLms === 'string' && card.notReadyLms.trim().length > 0
+      ? card.notReadyLms.trim()
+      : null) ?? (notReadyMatch ? notReadyMatch[1].trim() : null);
+  const targetMatch = /Publish Cogniate courses to\s+(.+?)\s+with LTI 1\.3\./.exec(raw);
+  const target = targetMatch ? targetMatch[1].trim() : null;
+
+  if (card && typeof card === 'object') {
+    const channel = typeof card.channel === 'string' && card.channel.trim().length > 0
+      ? card.channel.trim()
+      : typeof card.id === 'string' && card.id.trim().length > 0
+        ? card.id.trim()
+        : null;
+    const name = typeof card.name === 'string' && card.name.trim().length > 0
+      ? card.name.trim()
+      : typeof card.title === 'string' && card.title.trim().length > 0
+        ? card.title.trim()
+        : null;
+    if (channel !== null) {
+      assert.ok(allowed.has(channel), `${label}: extra card ${show(card)} has unregistered channel ${show(channel)}`);
+      if (notReadyLms !== null) {
+        assert.ok(allowed.has(notReadyLms), `${label}: extra card ${show(card)} names no registered channel (${show(notReadyLms)})`);
+      }
+      return;
+    }
+    if (name !== null) {
+      if (target !== null) {
+        assert.ok(allowed.has(target), `${label}: extra card ${show(card)} names no registered channel (${show(target)})`);
+      }
+      if (notReadyLms !== null) {
+        assert.ok(allowed.has(notReadyLms), `${label}: extra card ${show(card)} names no registered channel (${show(notReadyLms)})`);
+      }
+      const hasNonGenericNotReady =
+        notReadyLms !== null && allowed.has(notReadyLms) && !GENERIC_CHANNEL_NAMES.has(notReadyLms.toLowerCase());
+      assert.ok(
+        matchesAllowedCardName(name, allowed) || hasNonGenericNotReady,
+        `${label}: extra card ${show(card)} names no registered channel (${show(name)})`,
+      );
+      return;
+    }
+  }
+  const headingMatch = /^(?:[A-Za-z0-9]{1,4}\s*)?(?:Connect|Manage)\s*(.+?)\s*(?:Publish|Export)\b/.exec(raw);
+  if (headingMatch) {
+    const heading = headingMatch[1].trim();
+    if (target !== null) {
+      assert.ok(allowed.has(target), `${label}: extra card ${show(card)} names no registered channel (${show(target)})`);
+    }
+    if (notReadyLms !== null) {
+      assert.ok(allowed.has(notReadyLms), `${label}: extra card ${show(card)} names no registered channel (${show(notReadyLms)})`);
+    }
+    const hasNonGenericNotReady =
+      notReadyLms !== null && allowed.has(notReadyLms) && !GENERIC_CHANNEL_NAMES.has(notReadyLms.toLowerCase());
+    assert.ok(
+      matchesAllowedCardName(heading, allowed) || hasNonGenericNotReady,
+      `${label}: extra card ${show(card)} names no registered channel (${show(heading)})`,
+    );
+    return;
+  }
+  assert.ok(raw.length > 0 && allowed.has(raw), `${label}: extra card ${show(card)} names no registered channel`);
+}
+
 /**
- * Row 6: the visible cards of the "LMS Publishing" filter, as card texts in page order. Each baseline card text is
- * in exactly one card, in the baseline order. An extra card is a G-BASE non-channel card (`others`, each at most
- * once) or names a registered channel that is not a baseline channel (`names`, from extraChannelNames).
- * Returns the extra card texts.
+ * Row 6: the visible cards of the "LMS Publishing" filter, in page order. Each baseline card text is in
+ * exactly one card, in the baseline order. An extra card is a G-BASE non-channel card (`others`, each at most
+ * once) or matches a registered non-baseline channel by exact `id` or `name` (`names`, from extraChannelNames),
+ * never by substring. Returns the extra cards.
  */
 export function checkCards(cards, baselineTexts, { names, others = BASELINE_OTHER_CARDS, label = 'LMS Publishing cards' }) {
-  const extras = openList(cards, baselineTexts, { label, matches: (text, expected) => String(text).includes(expected) });
+  assert.ok(Array.isArray(cards), `${label}: the answer is a list`);
+  for (const card of cards) {
+    assert.ok(!isLoadingCard(card), `${label}: card ${show(card)} is still loading`);
+  }
+  const allowed = new Set(names.filter((n) => typeof n === 'string' && n.trim().length > 0).map((n) => n.trim()));
+  const extras = openList(cards, baselineTexts, { label, matches: (card, expected) => cardText(card).includes(expected) });
   for (const other of others) {
-    assert.ok(extras.filter((text) => String(text).includes(other)).length <= 1, `${label}: the card ${show(other)} appears more than once`);
+    assert.ok(extras.filter((card) => isOtherCard(card, other)).length <= 1, `${label}: the card ${show(other)} appears more than once`);
   }
-  for (const text of extras) {
-    if (others.some((other) => String(text).includes(other))) continue;
-    assert.ok(names.some((name) => String(text).includes(name)), `${label}: extra card ${show(text)} names no registered channel`);
+  for (const card of extras) {
+    if (others.some((other) => isOtherCard(card, other))) continue;
+    checkExtraCard(card, allowed, label);
   }
   return extras;
 }
+
+/**
+ * Snapshot-upgrade migration ledger check (M1-41.common.j-snapshot; BD-A2-108 / LD-24):
+ * 1. Every historical ledger entry from `oldLedger` is still present in `newLedger` in its original order
+ *    (each `oldLedger[db]` is a non-empty prefix of `newLedger[db]`), independent of the candidate's files.
+ * 2. `newLedger['cogniate-app/cogniate.db']` includes `012_connection_provider_snapshot.sql`.
+ * 3. Each upgraded ledger equals the candidate's full sorted migration file list (`expectedLtiLedger`, `expectedAppLedger`).
+ */
+export function checkMigrationLedgers(
+  oldLedger,
+  newLedger,
+  { expectedLtiLedger, expectedAppLedger, label = 'M1-41.common.j-snapshot migration ledger' } = {},
+) {
+  for (const db of ['lti-service/lti.db', 'cogniate-app/cogniate.db']) {
+    const oldEntries = oldLedger?.[db];
+    const newEntries = newLedger?.[db];
+    assert.ok(Array.isArray(oldEntries) && oldEntries.length > 0, `${label}: ${db} old ledger is a non-empty list`);
+    assert.ok(Array.isArray(newEntries) && newEntries.length >= oldEntries.length, `${label}: ${db} upgraded ledger is shorter than old ledger`);
+    assert.deepEqual(
+      newEntries.slice(0, oldEntries.length),
+      oldEntries,
+      `${label}: ${db} old ledger is not a prefix of the upgraded ledger`,
+    );
+  }
+  assert.ok(
+    newLedger['cogniate-app/cogniate.db'].includes('012_connection_provider_snapshot.sql'),
+    `${label}: cogniate-app/cogniate.db upgraded ledger is missing 012_connection_provider_snapshot.sql`,
+  );
+  if (expectedLtiLedger !== undefined) {
+    assert.deepEqual(newLedger['lti-service/lti.db'], expectedLtiLedger, `${label}: lti-service/lti.db ledger does not match candidate migrations`);
+  }
+  if (expectedAppLedger !== undefined) {
+    assert.deepEqual(newLedger['cogniate-app/cogniate.db'], expectedAppLedger, `${label}: cogniate-app/cogniate.db ledger does not match candidate migrations`);
+  }
+}
diff --git a/tests/e2e/M2/01-cards.m2.ts b/tests/e2e/M2/01-cards.m2.ts
index 6d8bc5f2..8ee1a985 100644
--- a/tests/e2e/M2/01-cards.m2.ts
+++ b/tests/e2e/M2/01-cards.m2.ts
@@ -9,16 +9,58 @@ import { TEXT, button, card, expect, integrations, m2Case, manageControl, portal
 import { checkCards, extraChannelNames } from '../../acceptance/lib/open-world.mjs';
 
 const squash = (t: string) => t.replace(/\s+/g, ' ').trim();
-/** The visible cards of the grid that holds the Moodle card (the "LMS Publishing" filter), as texts in page order. */
-const lmsCardTexts = (page: Page) => page.evaluate((moodleText) => {
-  const all = Array.from(document.querySelectorAll('body *')) as HTMLElement[];
-  let cell: HTMLElement | null = all.find((el) => el.children.length === 0 && (el.textContent ?? '').includes(moodleText)) ?? null;
-  while (cell && cell.parentElement && getComputedStyle(cell.parentElement).display !== 'grid') cell = cell.parentElement;
-  if (!cell || !cell.parentElement) return [];
-  return (Array.from(cell.parentElement.children) as HTMLElement[])
-    .filter((c) => getComputedStyle(c).display !== 'none' && c.getBoundingClientRect().height > 0)
-    .map((c) => (c.textContent ?? '').replace(/\s+/g, ' ').trim());
-}, TEXT.moodleCard);
+/** The visible cards of the grid that holds the Moodle card (the "LMS Publishing" filter), in page order, after loading settles. */
+const lmsCardTexts = async (page: Page) => {
+  const read = () => page.evaluate((moodleText) => {
+    const all = Array.from(document.querySelectorAll('body *')) as HTMLElement[];
+    let cell: HTMLElement | null = all.find((el) => el.children.length === 0 && (el.textContent ?? '').includes(moodleText)) ?? null;
+    while (cell && cell.parentElement && getComputedStyle(cell.parentElement).display !== 'grid') cell = cell.parentElement;
+    if (!cell || !cell.parentElement) return [];
+    return (Array.from(cell.parentElement.children) as HTMLElement[])
+      .filter((c) => getComputedStyle(c).display !== 'none' && c.getBoundingClientRect().height > 0)
+      .map((c) => {
+        const text = (c.textContent ?? '').replace(/\s+/g, ' ').trim();
+        const name = (c.querySelector('h2, h3, [role="heading"]')?.textContent ?? '').replace(/\s+/g, ' ').trim() || null;
+        const controls = Array.from(c.querySelectorAll('a, button, [role="button"], [role="link"]'))
+          .filter((el) => /^(?:Connect|Manage)$/i.test((el.textContent ?? '').replace(/\s+/g, ' ').trim()));
+        const hasLoadingLeaf = Array.from(c.querySelectorAll('*')).some(
+          (el) => el.children.length === 0 && /^Loading(?:…|\.\.\.)$/i.test((el.textContent ?? '').replace(/\s+/g, ' ').trim()),
+        );
+        const loading = controls.length === 0 || hasLoadingLeaf || /^(?:[A-Za-z0-9]{1,4}\s*)?Loading(?:…|\.\.\.)/.test(text);
+        const disabled = controls.length > 0 && controls.every(
+          (el) => (el as HTMLButtonElement).disabled === true || el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true',
+        );
+        let channel: string | null =
+          c.getAttribute('data-channel') ?? c.getAttribute('data-channel-id') ?? c.getAttribute('data-lms') ?? null;
+        if (!channel) {
+          for (const el of Array.from(c.querySelectorAll('[data-channel], [data-channel-id], [data-lms], a[href], [id$="-connect"], [id$="-manage"], [id$="-card"]'))) {
+            const dataAttr = el.getAttribute('data-channel') ?? el.getAttribute('data-channel-id') ?? el.getAttribute('data-lms');
+            if (dataAttr) { channel = dataAttr; break; }
+            const href = el.getAttribute('href') ?? '';
+            const m = /^\/integrations\/([^/?#]+)\/(?:connect|con_[^/?#]+)$/.exec(href);
+            if (m) { channel = m[1]; break; }
+            if (el.id.endsWith('-connect')) { channel = el.id.slice(0, -'-connect'.length); break; }
+            if (el.id.endsWith('-manage')) { channel = el.id.slice(0, -'-manage'.length); break; }
+            if (el.id.endsWith('-card')) { channel = el.id.slice(0, -'-card'.length); break; }
+          }
+        }
+        let notReadyLms: string | null = null;
+        for (const el of Array.from(c.querySelectorAll('p, div, span'))) {
+          if (el.children.length > 0) continue;
+          const leaf = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
+          const notReady = /^(.+?)\s+is not set up for this Cogniate service yet\b/.exec(leaf);
+          if (notReady) { notReadyLms = notReady[1].trim(); break; }
+        }
+        if (!channel && disabled && notReadyLms) channel = notReadyLms;
+        return { text, channel, name, disabled, loading, ...(notReadyLms ? { notReadyLms } : {}) };
+      });
+  }, TEXT.moodleCard);
+  await expect.poll(async () => {
+    const cards = await read();
+    return cards.length > 0 && cards.every((c) => !c.loading);
+  }, { message: 'LMS Publishing cards finished loading' }).toBe(true);
+  return read();
+};
 
 m2Case('M2-01.cards', 'the LMS Publishing filter shows the Moodle, Canvas and Blackboard cards with their texts and initials', async ({ page }) => {
   await sharedPlatform();
diff --git a/tests/host/m1-migration.mjs b/tests/host/m1-migration.mjs
index ddc459fc..128d2452 100644
--- a/tests/host/m1-migration.mjs
+++ b/tests/host/m1-migration.mjs
@@ -9,6 +9,7 @@ import crypto from 'node:crypto';
 import fs from 'node:fs';
 import path from 'node:path';
 import { allContainers } from './lib.mjs';
+import { checkMigrationLedgers } from '../acceptance/lib/open-world.mjs';
 import { SNAPSHOT_OLD_SHA, assertSnapshotBoundary } from './m1-phases.mjs';
 import { CompatRoute, OLD_OPLOCK, qualifyRow } from './storage-compat-route.mjs';
 import { StorageFail } from './storage-docker.mjs';
@@ -337,8 +338,7 @@ export async function snapshotMigrationRun(r, { installTests, setup, probe, iden
   const expectedAppLedger = fs.existsSync(appMigDir)
     ? fs.readdirSync(appMigDir).filter((n) => n.endsWith('.sql')).sort()
     : [...oldLedger['cogniate-app/cogniate.db'], '012_connection_provider_snapshot.sql'].sort();
-  assert.deepEqual(newLedger['lti-service/lti.db'], expectedLtiLedger);
-  assert.deepEqual(newLedger['cogniate-app/cogniate.db'], expectedAppLedger);
+  checkMigrationLedgers(oldLedger, newLedger, { expectedLtiLedger, expectedAppLedger });
   const problems = qualifyRow(route.steps, { oldSha: SNAPSHOT_OLD_SHA });
   r.saveText('storage/j-snapshot.json', JSON.stringify({ oldSha: SNAPSHOT_OLD_SHA, steps: route.steps.map(({ commands, ...s }) => ({ ...s, commands: commands.length })), problems }, null, 2));
   evidence.push({ id: 'M1-41.common.j-snapshot', environment: 'SIM', status: problems.length ? 'FAIL' : 'PASS', ...identity,
diff --git a/tests/ltiaas/k0/ld1/open-world.test.mjs b/tests/ltiaas/k0/ld1/open-world.test.mjs
index f4dbb5c3..e63843de 100644
--- a/tests/ltiaas/k0/ld1/open-world.test.mjs
+++ b/tests/ltiaas/k0/ld1/open-world.test.mjs
@@ -5,14 +5,16 @@ import assert from 'node:assert/strict';
 import fs from 'node:fs';
 import path from 'node:path';
 import test from 'node:test';
-import { fileURLToPath } from 'node:url';
-import {
-  BASELINE_PROFILES, BASELINE_REAL_PROFILES, BASELINE_SIMULATION_PROFILES, checkCards, checkLmsEntries, checkProfiles,
-  checkSimulationProfiles, extraChannelNames, registeredChannels,
-} from '../../../acceptance/lib/open-world.mjs';
+import { fileURLToPath, pathToFileURL } from 'node:url';
 
 const here = path.dirname(fileURLToPath(import.meta.url));
 const testsDir = path.resolve(here, '../../..');
+const acceptanceOpenWorldPath = path.join(testsDir, 'acceptance/lib/open-world.mjs');
+const ltiaasOpenWorldPath = path.resolve(here, '../../lib/open-world.mjs');
+const {
+  BASELINE_PROFILES, BASELINE_REAL_PROFILES, BASELINE_SIMULATION_PROFILES, checkCards, checkLmsEntries,
+  checkMigrationLedgers, checkProfiles, checkSimulationProfiles, extraChannelNames, registeredChannels,
+} = await import(pathToFileURL(fs.existsSync(acceptanceOpenWorldPath) ? acceptanceOpenWorldPath : ltiaasOpenWorldPath).href);
 const read = (name) => JSON.parse(fs.readFileSync(path.join(here, 'g-base', name), 'utf8'));
 const copy = (value) => structuredClone(value);
 
@@ -25,9 +27,9 @@ const CARD_TEXTS = [
 
 // A new channel as LA adds it (app API delta §1-§2, LTI delta §4.7), and one that no registry knows.
 const NEW = { id: 'lti-generic', name: 'LMS' };
-const withChannel = (lmsProviders, id = NEW.id, name = NEW.name) => {
+const withChannel = (lmsProviders, id = NEW.id, name = NEW.name, label = name) => {
   const next = copy(lmsProviders);
-  next.lms.push({ lms: id, channel: id, channelName: name, label: name, methods: ['dynamic', 'manual'], profiles: [] });
+  next.lms.push({ lms: id, channel: id, channelName: name, label, methods: ['dynamic', 'manual'], profiles: [] });
   return next;
 };
 const newProfile = (channel, { id = channel, simulation = false } = {}) => ({ id, lms: channel, channel, label: 'New',
@@ -78,7 +80,7 @@ const rows = [
     move: (a) => { a.cards.push(a.cards.splice(1, 1)[0]); },
     extra: (a, registered) => {
       if (registered) a.lmsProviders = withChannel(a.lmsProviders);
-      a.cards.push(`ConnectYour LMSPublish Cogniate courses to ${registered ? NEW.name : 'Sakai'} with LTI 1.3.`);
+      a.cards.push(`Connect${registered ? NEW.name : 'Sakai'}Publish Cogniate courses to ${registered ? NEW.name : 'Sakai LMS'} with LTI 1.3.`);
     },
   },
   {
@@ -94,10 +96,20 @@ const rows = [
   profileRow(8, 'tests/acceptance/M1/common/90-simulation-gates.test.ts M1-35.common.<profile>-<simulation>', defaults, BASELINE_REAL_PROFILES, true),
 ];
 
-test('the probe card texts equal tests/e2e/M2/lib/m2.ts TEXT', () => {
-  const source = fs.readFileSync(path.join(testsDir, 'e2e/M2/lib/m2.ts'), 'utf8');
-  for (const [key, text] of [['moodleCard', CARD_TEXTS[0]], ['canvasCard', CARD_TEXTS[1]], ['blackboardCard', CARD_TEXTS[2]]]) {
-    assert.ok(source.includes(`${key}: ${JSON.stringify(text).replaceAll('"', "'")}`), key);
+test('the probe card texts equal tests/e2e/M2/lib/m2.ts TEXT, and open-world copies match when present', () => {
+  const m2Path = path.join(testsDir, 'e2e/M2/lib/m2.ts');
+  if (fs.existsSync(m2Path)) {
+    const source = fs.readFileSync(m2Path, 'utf8');
+    for (const [key, text] of [['moodleCard', CARD_TEXTS[0]], ['canvasCard', CARD_TEXTS[1]], ['blackboardCard', CARD_TEXTS[2]]]) {
+      assert.ok(source.includes(`${key}: ${JSON.stringify(text).replaceAll('"', "'")}`), key);
+    }
+  }
+  if (fs.existsSync(acceptanceOpenWorldPath)) {
+    assert.equal(
+      fs.readFileSync(acceptanceOpenWorldPath, 'utf8'),
+      fs.readFileSync(ltiaasOpenWorldPath, 'utf8'),
+      'tests/acceptance/lib/open-world.mjs and tests/ltiaas/lib/open-world.mjs are identical',
+    );
   }
 });
 
@@ -146,3 +158,236 @@ test('row 6: the G-BASE Kajabi card is allowed, but not twice', () => {
   answer.push(answer[0]);
   assert.throws(() => checkCards(answer, CARD_TEXTS, { names: [] }), assert.AssertionError);
 });
+
+test('row 6 exact membership (A-LA-E0-04-01 / B-LA-E0-04-01): mixed registered and unregistered cards with lti-generic (channelName: LMS)', () => {
+  const names = extraChannelNames(withChannel(acceptance.lmsProviders));
+  assert.deepEqual(names, ['lti-generic', 'LMS']);
+  const registeredStringCard = 'ConnectLMSPublish Cogniate courses to LMS with LTI 1.3.';
+  const registeredDomCard = {
+    text: 'LTI Connect LTI 1.3 Publish Cogniate courses to any LMS that supports LTI 1.3 Advantage.',
+    channel: 'lti-generic',
+    name: 'LTI 1.3',
+  };
+  assert.equal(checkCards([...cards.cards, registeredStringCard], CARD_TEXTS, { names }).length, 2);
+  assert.equal(checkCards([...cards.cards, registeredDomCard], CARD_TEXTS, { names }).length, 2);
+
+  const unregisteredCards = [
+    'Connect Sakai Publish Cogniate courses to Sakai LMS with LTI 1.3.',
+    'ConnectSakai LMSPublish Cogniate courses to Sakai with LTI 1.3.',
+    'ConnectYour LMSPublish Cogniate courses to Sakai with LTI 1.3.',
+    { text: registeredStringCard, channel: 'sakai', name: 'LMS' },
+    { text: 'Connect Sakai Publish Cogniate courses to Sakai LMS with LTI 1.3.', channel: null, name: 'Sakai LMS' },
+  ];
+  for (const bad of unregisteredCards) {
+    assert.throws(() => checkCards([...cards.cards, bad], CARD_TEXTS, { names }), assert.AssertionError);
+    assert.throws(() => checkCards([...cards.cards, registeredDomCard, bad], CARD_TEXTS, { names }), assert.AssertionError);
+  }
+});
+
+test('row 6 loading state (A-LA-E0-04-03): delayed connections settle and pass; permanently unresolved loading fails', async () => {
+  const names = extraChannelNames(withChannel(acceptance.lmsProviders, 'lti-generic', 'LMS', 'Other LTI 1.3 platform'));
+  const loadingGenericCard = {
+    text: 'Loading…LTI 1.3Publish Cogniate courses to any LMS that supports LTI 1.3 Advantage.',
+    channel: null,
+    name: 'LTI 1.3',
+    loading: true,
+  };
+  const loadingGenericCardWithoutFlag = {
+    text: 'Loading…LTI 1.3Publish Cogniate courses to any LMS that supports LTI 1.3 Advantage.',
+    channel: null,
+    name: 'LTI 1.3',
+  };
+  const settledGenericCard = {
+    text: 'LTIConnectLTI 1.3Publish Cogniate courses to any LMS that supports LTI 1.3 Advantage.',
+    channel: 'lti-generic',
+    name: 'LTI 1.3',
+    disabled: false,
+    loading: false,
+  };
+
+  // Unsettled loading cards (with or without explicit loading: true) are rejected by checkCards.
+  assert.throws(() => checkCards([...cards.cards, loadingGenericCard], CARD_TEXTS, { names }), assert.AssertionError);
+  assert.throws(() => checkCards([...cards.cards, loadingGenericCardWithoutFlag], CARD_TEXTS, { names }), assert.AssertionError);
+  assert.throws(() => checkCards([...cards.cards, loadingGenericCard.text], CARD_TEXTS, { names }), assert.AssertionError);
+
+  // Delayed connections load: polling waits while loading is true, then passes once settled.
+  let polls = 0;
+  const readDelayed = () => {
+    polls += 1;
+    return [...cards.cards, polls < 3 ? loadingGenericCard : settledGenericCard];
+  };
+  const waitUntilSettled = async (readFn, maxAttempts = 5) => {
+    for (let i = 0; i < maxAttempts; i++) {
+      const current = readFn();
+      if (current.length > 0 && current.every((c) => !(typeof c === 'object' && c?.loading))) return current;
+    }
+    throw new assert.AssertionError({ message: 'LMS Publishing cards finished loading' });
+  };
+  const settled = await waitUntilSettled(readDelayed, 5);
+  assert.equal(polls, 3);
+  assert.equal(checkCards(settled, CARD_TEXTS, { names }).length, 2);
+
+  // Permanently unresolved connections load: never settles within the poll bound and fails.
+  await assert.rejects(() => waitUntilSettled(() => [...cards.cards, loadingGenericCard], 5), assert.AssertionError);
+});
+
+test('row 6 not-ready disabled card with distinct display title (B-LA-E0-04-02): registered passes, unregistered fails', () => {
+  const providersWithCampus = withChannel(
+    withChannel(acceptance.lmsProviders, 'lti-generic', 'LMS', 'Other LTI 1.3 platform'),
+    'campus',
+    'Campus',
+    'Campus LMS',
+  );
+  const names = extraChannelNames(providersWithCampus);
+  assert.deepEqual(names, ['lti-generic', 'LMS', 'Other LTI 1.3 platform', 'campus', 'Campus', 'Campus LMS']);
+
+  // Ready branch (enabled Connect link) for campus with distinct title 'Campus Learning'.
+  const campusReadyCard = {
+    text: 'CpConnectCampus LearningPublish Cogniate courses to Campus LMS with LTI 1.3.',
+    channel: 'campus',
+    name: 'Campus Learning',
+    disabled: false,
+    loading: false,
+  };
+  // Disabled-control not-ready branch (no Connect href/id; renders disabled button and not-ready notice).
+  const campusNotReadyExtracted = {
+    text: 'CpConnectCampus LearningPublish Cogniate courses to Campus LMS with LTI 1.3.Campus is not set up for this Cogniate service yet. Ask your Cogniate operator.',
+    channel: 'Campus',
+    name: 'Campus Learning',
+    disabled: true,
+    loading: false,
+    notReadyLms: 'Campus',
+  };
+  const campusNotReadyNullChannel = {
+    text: 'CpConnectCampus LearningPublish Cogniate courses to Campus LMS with LTI 1.3.Campus is not set up for this Cogniate service yet. Ask your Cogniate operator.',
+    channel: null,
+    name: 'Campus Learning',
+    disabled: true,
+    loading: false,
+  };
+  const campusNotReadyMinimalDomStub = {
+    text: 'CpConnectCampus LearningPublish courses to your campus platform.',
+    channel: null,
+    name: 'Campus Learning',
+    disabled: true,
+    loading: false,
+  };
+  const genericNotReadyNullChannel = {
+    text: 'LTIConnectLTI 1.3Publish Cogniate courses to any LMS that supports LTI 1.3 Advantage.LMS is not set up for this Cogniate service yet. Ask your Cogniate operator.',
+    channel: null,
+    name: 'LTI 1.3',
+    disabled: true,
+    loading: false,
+  };
+
+  for (const good of [
+    campusReadyCard,
+    campusNotReadyExtracted,
+    campusNotReadyNullChannel,
+    campusNotReadyMinimalDomStub,
+    genericNotReadyNullChannel,
+  ]) {
+    assert.equal(checkCards([...cards.cards, good], CARD_TEXTS, { names }).length, 2);
+  }
+
+  // Unregistered cards in the same disabled-control not-ready state must fail.
+  const unregisteredNotReadyCards = [
+    {
+      text: 'SkConnectSakai LearningPublish Cogniate courses to Sakai LMS with LTI 1.3.Sakai is not set up for this Cogniate service yet. Ask your Cogniate operator.',
+      channel: 'Sakai',
+      name: 'Sakai Learning',
+      disabled: true,
+      loading: false,
+      notReadyLms: 'Sakai',
+    },
+    {
+      text: 'SkConnectSakai LearningPublish Cogniate courses to Sakai LMS with LTI 1.3.Sakai is not set up for this Cogniate service yet. Ask your Cogniate operator.',
+      channel: null,
+      name: 'Sakai Learning',
+      disabled: true,
+      loading: false,
+    },
+    {
+      text: 'SkConnectSakai LearningPublish courses to your sakai platform.',
+      channel: null,
+      name: 'Sakai Learning',
+      disabled: true,
+      loading: false,
+    },
+    {
+      text: 'SkConnectSakai LMSPublish Cogniate courses to Sakai LMS with LTI 1.3.',
+      channel: null,
+      name: 'Sakai LMS',
+      disabled: true,
+      loading: false,
+    },
+  ];
+  for (const bad of unregisteredNotReadyCards) {
+    assert.throws(() => checkCards([...cards.cards, bad], CARD_TEXTS, { names }), assert.AssertionError);
+    assert.throws(() => checkCards([...cards.cards, campusNotReadyNullChannel, bad], CARD_TEXTS, { names }), assert.AssertionError);
+  }
+});
+
+test('M1-41.common.j-snapshot migration ledger (A-LA-E0-04-02 / LD-24): old ledger is a prefix of upgraded ledger and matches candidate migrations', () => {
+  const oldLedger = {
+    'lti-service/lti.db': ['001_init.sql', '005_lti_grants.sql'],
+    'cogniate-app/cogniate.db': ['001_init.sql', '011_lms_types.sql'],
+  };
+  const expectedLtiLedger = ['001_init.sql', '005_lti_grants.sql', '006_lti_provider_selection.sql', '007_lti_channel_columns.sql'];
+  const expectedAppLedger = [
+    '001_init.sql',
+    '011_lms_types.sql',
+    '012_connection_provider_snapshot.sql',
+    '013_connection_channel_columns.sql',
+  ];
+  const newLedger = {
+    'lti-service/lti.db': [...expectedLtiLedger],
+    'cogniate-app/cogniate.db': [...expectedAppLedger],
+  };
+  checkMigrationLedgers(oldLedger, newLedger, { expectedLtiLedger, expectedAppLedger });
+
+  // Missing historical entry in lti.db or cogniate.db fails even if also removed from expected*Ledger.
+  const droppedLti = expectedLtiLedger.slice(1);
+  assert.throws(
+    () =>
+      checkMigrationLedgers(
+        oldLedger,
+        { 'lti-service/lti.db': droppedLti, 'cogniate-app/cogniate.db': expectedAppLedger },
+        { expectedLtiLedger: droppedLti, expectedAppLedger },
+      ),
+    assert.AssertionError,
+  );
+  const droppedApp = expectedAppLedger.filter((m) => m !== '011_lms_types.sql');
+  assert.throws(
+    () =>
+      checkMigrationLedgers(
+        oldLedger,
+        { 'lti-service/lti.db': expectedLtiLedger, 'cogniate-app/cogniate.db': droppedApp },
+        { expectedLtiLedger, expectedAppLedger: droppedApp },
+      ),
+    assert.AssertionError,
+  );
+
+  // Reordered historical prefix fails even if expected*Ledger matches newLedger.
+  const reorderedLti = ['005_lti_grants.sql', '001_init.sql', '006_lti_provider_selection.sql', '007_lti_channel_columns.sql'];
+  assert.throws(
+    () =>
+      checkMigrationLedgers(
+        oldLedger,
+        { 'lti-service/lti.db': reorderedLti, 'cogniate-app/cogniate.db': expectedAppLedger },
+        { expectedLtiLedger: reorderedLti, expectedAppLedger },
+      ),
+    assert.AssertionError,
+  );
+
+  // Unapplied candidate migration file fails exact comparison.
+  assert.throws(
+    () =>
+      checkMigrationLedgers(
+        oldLedger,
+        { 'lti-service/lti.db': expectedLtiLedger.slice(0, -1), 'cogniate-app/cogniate.db': expectedAppLedger },
+        { expectedLtiLedger, expectedAppLedger },
+      ),
+    assert.AssertionError,
+  );
+});
diff --git a/tests/ltiaas/k0/ld1/open-world.test.ts b/tests/ltiaas/k0/ld1/open-world.test.ts
index e54741b2..98061584 100644
--- a/tests/ltiaas/k0/ld1/open-world.test.ts
+++ b/tests/ltiaas/k0/ld1/open-world.test.ts
@@ -23,6 +23,7 @@ const {
   BASELINE_SIMULATION_PROFILES,
   checkCards,
   checkLmsEntries,
+  checkMigrationLedgers,
   checkProfiles,
   checkSimulationProfiles,
   extraChannelNames,
@@ -42,9 +43,9 @@ const CARD_TEXTS = [
 
 // A new channel as LA adds it (app API delta §1-§2, LTI delta §4.7), and one that no registry knows.
 const NEW = { id: 'lti-generic', name: 'LMS' };
-const withChannel = (lmsProviders: Json, id = NEW.id, name = NEW.name): Json => {
+const withChannel = (lmsProviders: Json, id = NEW.id, name = NEW.name, label = name): Json => {
   const next = copy(lmsProviders);
-  next.lms.push({ lms: id, channel: id, channelName: name, label: name, methods: ['dynamic', 'manual'], profiles: [] });
+  next.lms.push({ lms: id, channel: id, channelName: name, label, methods: ['dynamic', 'manual'], profiles: [] });
   return next;
 };
 const newProfile = (channel: string, { id = channel, simulation = false }: { id?: string; simulation?: boolean } = {}): Json => ({
@@ -155,7 +156,7 @@ const rows: ProbeRow[] = [
     },
     extra: (a, registered) => {
       if (registered) a.lmsProviders = withChannel(a.lmsProviders);
-      a.cards.push(`ConnectYour LMSPublish Cogniate courses to ${registered ? NEW.name : 'Sakai'} with LTI 1.3.`);
+      a.cards.push(`Connect${registered ? NEW.name : 'Sakai'}Publish Cogniate courses to ${registered ? NEW.name : 'Sakai LMS'} with LTI 1.3.`);
     },
   },
   {
@@ -184,13 +185,16 @@ const rows: ProbeRow[] = [
 ];
 
 test('the probe card texts equal tests/e2e/M2/lib/m2.ts TEXT, and open-world copies match when present', () => {
-  const source = fs.readFileSync(path.join(testsDir, 'e2e/M2/lib/m2.ts'), 'utf8');
-  for (const [key, text] of [
-    ['moodleCard', CARD_TEXTS[0]],
-    ['canvasCard', CARD_TEXTS[1]],
-    ['blackboardCard', CARD_TEXTS[2]],
-  ] as const) {
-    assert.ok(source.includes(`${key}: ${JSON.stringify(text).replaceAll('"', "'")}`), key);
+  const m2Path = path.join(testsDir, 'e2e/M2/lib/m2.ts');
+  if (fs.existsSync(m2Path)) {
+    const source = fs.readFileSync(m2Path, 'utf8');
+    for (const [key, text] of [
+      ['moodleCard', CARD_TEXTS[0]],
+      ['canvasCard', CARD_TEXTS[1]],
+      ['blackboardCard', CARD_TEXTS[2]],
+    ] as const) {
+      assert.ok(source.includes(`${key}: ${JSON.stringify(text).replaceAll('"', "'")}`), key);
+    }
   }
   if (fs.existsSync(acceptanceOpenWorldPath)) {
     assert.equal(
@@ -259,3 +263,238 @@ test('row 6: the G-BASE Kajabi card is allowed, but not twice', () => {
   answer.push(answer[0]);
   assert.throws(() => checkCards(answer, CARD_TEXTS, { names: [] }), assert.AssertionError);
 });
+
+test('row 6 exact membership (A-LA-E0-04-01 / B-LA-E0-04-01): mixed registered and unregistered cards with lti-generic (channelName: LMS)', () => {
+  const names = extraChannelNames(withChannel(acceptance.lmsProviders));
+  assert.deepEqual(names, ['lti-generic', 'LMS']);
+  const registeredStringCard = 'ConnectLMSPublish Cogniate courses to LMS with LTI 1.3.';
+  const registeredDomCard = {
+    text: 'LTI Connect LTI 1.3 Publish Cogniate courses to any LMS that supports LTI 1.3 Advantage.',
+    channel: 'lti-generic',
+    name: 'LTI 1.3',
+  };
+  assert.equal(checkCards([...cards.cards, registeredStringCard], CARD_TEXTS, { names }).length, 2);
+  assert.equal(checkCards([...cards.cards, registeredDomCard], CARD_TEXTS, { names }).length, 2);
+
+  const unregisteredCards = [
+    'Connect Sakai Publish Cogniate courses to Sakai LMS with LTI 1.3.',
+    'ConnectSakai LMSPublish Cogniate courses to Sakai with LTI 1.3.',
+    'ConnectYour LMSPublish Cogniate courses to Sakai with LTI 1.3.',
+    { text: registeredStringCard, channel: 'sakai', name: 'LMS' },
+    { text: 'Connect Sakai Publish Cogniate courses to Sakai LMS with LTI 1.3.', channel: null, name: 'Sakai LMS' },
+  ];
+  for (const bad of unregisteredCards) {
+    assert.throws(() => checkCards([...cards.cards, bad], CARD_TEXTS, { names }), assert.AssertionError);
+    assert.throws(() => checkCards([...cards.cards, registeredDomCard, bad], CARD_TEXTS, { names }), assert.AssertionError);
+  }
+});
+
+test('row 6 loading state (A-LA-E0-04-03): delayed connections settle and pass; permanently unresolved loading fails', async () => {
+  const names = extraChannelNames(withChannel(acceptance.lmsProviders, 'lti-generic', 'LMS', 'Other LTI 1.3 platform'));
+  const loadingGenericCard = {
+    text: 'Loading…LTI 1.3Publish Cogniate courses to any LMS that supports LTI 1.3 Advantage.',
+    channel: null,
+    name: 'LTI 1.3',
+    loading: true,
+  };
+  const loadingGenericCardWithoutFlag = {
+    text: 'Loading…LTI 1.3Publish Cogniate courses to any LMS that supports LTI 1.3 Advantage.',
+    channel: null,
+    name: 'LTI 1.3',
+  };
+  const settledGenericCard = {
+    text: 'LTIConnectLTI 1.3Publish Cogniate courses to any LMS that supports LTI 1.3 Advantage.',
+    channel: 'lti-generic',
+    name: 'LTI 1.3',
+    disabled: false,
+    loading: false,
+  };
+
+  // Unsettled loading cards (with or without explicit loading: true) are rejected by checkCards.
+  assert.throws(() => checkCards([...cards.cards, loadingGenericCard], CARD_TEXTS, { names }), assert.AssertionError);
+  assert.throws(() => checkCards([...cards.cards, loadingGenericCardWithoutFlag], CARD_TEXTS, { names }), assert.AssertionError);
+  assert.throws(() => checkCards([...cards.cards, loadingGenericCard.text], CARD_TEXTS, { names }), assert.AssertionError);
+
+  // Delayed connections load: polling waits while loading is true, then passes once settled.
+  let polls = 0;
+  const readDelayed = () => {
+    polls += 1;
+    return [...cards.cards, polls < 3 ? loadingGenericCard : settledGenericCard];
+  };
+  const waitUntilSettled = async (readFn: () => unknown[], maxAttempts = 5) => {
+    for (let i = 0; i < maxAttempts; i++) {
+      const current = readFn();
+      if (current.length > 0 && current.every((c) => !(typeof c === 'object' && c !== null && 'loading' in c && (c as Json).loading))) {
+        return current as Array<string | typeof settledGenericCard>;
+      }
+    }
+    throw new assert.AssertionError({ message: 'LMS Publishing cards finished loading' });
+  };
+  const settled = await waitUntilSettled(readDelayed, 5);
+  assert.equal(polls, 3);
+  assert.equal(checkCards(settled, CARD_TEXTS, { names }).length, 2);
+
+  // Permanently unresolved connections load: never settles within the poll bound and fails.
+  await assert.rejects(() => waitUntilSettled(() => [...cards.cards, loadingGenericCard], 5), assert.AssertionError);
+});
+
+test('row 6 not-ready disabled card with distinct display title (B-LA-E0-04-02): registered passes, unregistered fails', () => {
+  const providersWithCampus = withChannel(
+    withChannel(acceptance.lmsProviders, 'lti-generic', 'LMS', 'Other LTI 1.3 platform'),
+    'campus',
+    'Campus',
+    'Campus LMS',
+  );
+  const names = extraChannelNames(providersWithCampus);
+  assert.deepEqual(names, ['lti-generic', 'LMS', 'Other LTI 1.3 platform', 'campus', 'Campus', 'Campus LMS']);
+
+  // Ready branch (enabled Connect link) for campus with distinct title 'Campus Learning'.
+  const campusReadyCard = {
+    text: 'CpConnectCampus LearningPublish Cogniate courses to Campus LMS with LTI 1.3.',
+    channel: 'campus',
+    name: 'Campus Learning',
+    disabled: false,
+    loading: false,
+  };
+  // Disabled-control not-ready branch (no Connect href/id; renders disabled button and not-ready notice).
+  const campusNotReadyExtracted = {
+    text: 'CpConnectCampus LearningPublish Cogniate courses to Campus LMS with LTI 1.3.Campus is not set up for this Cogniate service yet. Ask your Cogniate operator.',
+    channel: 'Campus',
+    name: 'Campus Learning',
+    disabled: true,
+    loading: false,
+    notReadyLms: 'Campus',
+  };
+  const campusNotReadyNullChannel = {
+    text: 'CpConnectCampus LearningPublish Cogniate courses to Campus LMS with LTI 1.3.Campus is not set up for this Cogniate service yet. Ask your Cogniate operator.',
+    channel: null,
+    name: 'Campus Learning',
+    disabled: true,
+    loading: false,
+  };
+  const campusNotReadyMinimalDomStub = {
+    text: 'CpConnectCampus LearningPublish courses to your campus platform.',
+    channel: null,
+    name: 'Campus Learning',
+    disabled: true,
+    loading: false,
+  };
+  const genericNotReadyNullChannel = {
+    text: 'LTIConnectLTI 1.3Publish Cogniate courses to any LMS that supports LTI 1.3 Advantage.LMS is not set up for this Cogniate service yet. Ask your Cogniate operator.',
+    channel: null,
+    name: 'LTI 1.3',
+    disabled: true,
+    loading: false,
+  };
+
+  for (const good of [
+    campusReadyCard,
+    campusNotReadyExtracted,
+    campusNotReadyNullChannel,
+    campusNotReadyMinimalDomStub,
+    genericNotReadyNullChannel,
+  ]) {
+    assert.equal(checkCards([...cards.cards, good], CARD_TEXTS, { names }).length, 2);
+  }
+
+  // Unregistered cards in the same disabled-control not-ready state must fail.
+  const unregisteredNotReadyCards = [
+    {
+      text: 'SkConnectSakai LearningPublish Cogniate courses to Sakai LMS with LTI 1.3.Sakai is not set up for this Cogniate service yet. Ask your Cogniate operator.',
+      channel: 'Sakai',
+      name: 'Sakai Learning',
+      disabled: true,
+      loading: false,
+      notReadyLms: 'Sakai',
+    },
+    {
+      text: 'SkConnectSakai LearningPublish Cogniate courses to Sakai LMS with LTI 1.3.Sakai is not set up for this Cogniate service yet. Ask your Cogniate operator.',
+      channel: null,
+      name: 'Sakai Learning',
+      disabled: true,
+      loading: false,
+    },
+    {
+      text: 'SkConnectSakai LearningPublish courses to your sakai platform.',
+      channel: null,
+      name: 'Sakai Learning',
+      disabled: true,
+      loading: false,
+    },
+    {
+      text: 'SkConnectSakai LMSPublish Cogniate courses to Sakai LMS with LTI 1.3.',
+      channel: null,
+      name: 'Sakai LMS',
+      disabled: true,
+      loading: false,
+    },
+  ];
+  for (const bad of unregisteredNotReadyCards) {
+    assert.throws(() => checkCards([...cards.cards, bad], CARD_TEXTS, { names }), assert.AssertionError);
+    assert.throws(() => checkCards([...cards.cards, campusNotReadyNullChannel, bad], CARD_TEXTS, { names }), assert.AssertionError);
+  }
+});
+
+test('M1-41.common.j-snapshot migration ledger (A-LA-E0-04-02 / LD-24): old ledger is a prefix of upgraded ledger and matches candidate migrations', () => {
+  const oldLedger = {
+    'lti-service/lti.db': ['001_init.sql', '005_lti_grants.sql'],
+    'cogniate-app/cogniate.db': ['001_init.sql', '011_lms_types.sql'],
+  };
+  const expectedLtiLedger = ['001_init.sql', '005_lti_grants.sql', '006_lti_provider_selection.sql', '007_lti_channel_columns.sql'];
+  const expectedAppLedger = [
+    '001_init.sql',
+    '011_lms_types.sql',
+    '012_connection_provider_snapshot.sql',
+    '013_connection_channel_columns.sql',
+  ];
+  const newLedger = {
+    'lti-service/lti.db': [...expectedLtiLedger],
+    'cogniate-app/cogniate.db': [...expectedAppLedger],
+  };
+  checkMigrationLedgers(oldLedger, newLedger, { expectedLtiLedger, expectedAppLedger });
+
+  // Missing historical entry in lti.db or cogniate.db fails even if also removed from expected*Ledger.
+  const droppedLti = expectedLtiLedger.slice(1);
+  assert.throws(
+    () =>
+      checkMigrationLedgers(
+        oldLedger,
+        { 'lti-service/lti.db': droppedLti, 'cogniate-app/cogniate.db': expectedAppLedger },
+        { expectedLtiLedger: droppedLti, expectedAppLedger },
+      ),
+    assert.AssertionError,
+  );
+  const droppedApp = expectedAppLedger.filter((m) => m !== '011_lms_types.sql');
+  assert.throws(
+    () =>
+      checkMigrationLedgers(
+        oldLedger,
+        { 'lti-service/lti.db': expectedLtiLedger, 'cogniate-app/cogniate.db': droppedApp },
+        { expectedLtiLedger, expectedAppLedger: droppedApp },
+      ),
+    assert.AssertionError,
+  );
+
+  // Reordered historical prefix fails even if expected*Ledger matches newLedger.
+  const reorderedLti = ['005_lti_grants.sql', '001_init.sql', '006_lti_provider_selection.sql', '007_lti_channel_columns.sql'];
+  assert.throws(
+    () =>
+      checkMigrationLedgers(
+        oldLedger,
+        { 'lti-service/lti.db': reorderedLti, 'cogniate-app/cogniate.db': expectedAppLedger },
+        { expectedLtiLedger: reorderedLti, expectedAppLedger },
+      ),
+    assert.AssertionError,
+  );
+
+  // Unapplied candidate migration file fails exact comparison.
+  assert.throws(
+    () =>
+      checkMigrationLedgers(
+        oldLedger,
+        { 'lti-service/lti.db': expectedLtiLedger.slice(0, -1), 'cogniate-app/cogniate.db': expectedAppLedger },
+        { expectedLtiLedger, expectedAppLedger },
+      ),
+    assert.AssertionError,
+  );
+});
diff --git a/tests/ltiaas/lib/open-world.d.mts b/tests/ltiaas/lib/open-world.d.mts
index 2629c41d..287a6b19 100644
--- a/tests/ltiaas/lib/open-world.d.mts
+++ b/tests/ltiaas/lib/open-world.d.mts
@@ -26,4 +26,29 @@ export function appLmsProviders(
     Promise<{ status: number; headers: Record<string, any>; body: string }>,
   options: { appUrl: string; ca?: string | null; user: { email: string; password: string } },
 ): Promise<Json>;
-export function checkCards(cards: string[], baselineTexts: string[], options: { names: string[]; others?: string[]; label?: string }): string[];
+export interface CardDescriptor {
+  text: string;
+  channel?: string | null;
+  id?: string | null;
+  name?: string | null;
+  title?: string | null;
+  disabled?: boolean;
+  loading?: boolean;
+  notReadyLms?: string | null;
+}
+export type CardInput = string | CardDescriptor;
+export function checkCards<T extends CardInput>(
+  cards: T[],
+  baselineTexts: string[],
+  options: { names: string[]; others?: string[]; label?: string },
+): T[];
+export interface MigrationLedgerMap {
+  'lti-service/lti.db': string[];
+  'cogniate-app/cogniate.db': string[];
+  [db: string]: string[];
+}
+export function checkMigrationLedgers(
+  oldLedger: MigrationLedgerMap,
+  newLedger: MigrationLedgerMap,
+  options?: { expectedLtiLedger?: string[]; expectedAppLedger?: string[]; label?: string },
+): void;
diff --git a/tests/ltiaas/lib/open-world.mjs b/tests/ltiaas/lib/open-world.mjs
index c38c4e49..975a3a6a 100644
--- a/tests/ltiaas/lib/open-world.mjs
+++ b/tests/ltiaas/lib/open-world.mjs
@@ -58,11 +58,32 @@ export function registeredChannels(lmsProviders) {
   return new Set(ids);
 }
 
-/** The text names of the registered channels that are not baseline channels (`channelName`, else `label`). */
+/**
+ * The exact channel ids and names of the registered channels that are not baseline channels
+ * (`channel`/`lms`, `channelName`, `label`, and any explicit card `title`/`cardTitle`).
+ */
 export function extraChannelNames(lmsProviders) {
   assert.ok(Array.isArray(lmsProviders?.lms), 'GET /app-api/lms-providers has an lms list');
-  return lmsProviders.lms.filter((entry) => !BASELINE_LMS.includes(entry.channel ?? entry.lms))
-    .map((entry) => entry.channelName ?? entry.label).filter((name) => typeof name === 'string' && name.length > 0);
+  const names = [];
+  for (const entry of lmsProviders.lms) {
+    const id = entry.channel ?? entry.lms;
+    if (BASELINE_LMS.includes(id)) continue;
+    for (const candidate of [
+      id,
+      entry.channelName,
+      entry.label,
+      entry.cardTitle,
+      entry.title,
+      entry.card?.title,
+      entry.names?.text,
+      entry.names?.label,
+    ]) {
+      if (typeof candidate === 'string' && candidate.trim().length > 0 && !names.includes(candidate.trim())) {
+        names.push(candidate.trim());
+      }
+    }
+  }
+  return names;
 }
 
 /**
@@ -179,20 +200,164 @@ export async function appLmsProviders(request, { appUrl, ca, user }) {
   return JSON.parse(answer.body);
 }
 
+const cardText = (card) => (typeof card === 'string' ? card : String(card?.text ?? ''));
+
+const isLoadingCard = (card) => {
+  if (card && typeof card === 'object' && card.loading === true) return true;
+  const raw = cardText(card).trim();
+  return /^(?:[A-Za-z0-9]{1,4}\s*)?Loading(?:…|\.\.\.)/.test(raw);
+};
+
+const isOtherCard = (card, other) => {
+  if (card && typeof card === 'object') {
+    const channel = card.channel ?? card.id ?? null;
+    if (typeof channel === 'string' && channel.trim().length > 0) return false;
+  }
+  return cardText(card).includes(other);
+};
+
+const GENERIC_CHANNEL_NAMES = new Set(['lms', 'lti', 'lti 1.3', 'other lti 1.3 platform', 'lti-generic']);
+const GENERIC_TITLE_SUFFIX_WORDS = new Set(['learning', 'learn', 'lms', 'platform', 'cloud', 'server', 'lti', '1.3', 'edition', 'suite']);
+
+function matchesAllowedCardName(name, allowed) {
+  if (allowed.has(name)) return true;
+  if (name === 'LTI 1.3' && (allowed.has('lti-generic') || allowed.has('Other LTI 1.3 platform'))) return true;
+  for (const entry of allowed) {
+    if (GENERIC_CHANNEL_NAMES.has(entry.toLowerCase())) continue;
+    const words = entry.trim().split(/\s+/);
+    while (words.length > 1 && GENERIC_TITLE_SUFFIX_WORDS.has(words[words.length - 1].toLowerCase())) words.pop();
+    const stem = words.join(' ');
+    for (const prefix of new Set([entry, stem])) {
+      if (GENERIC_CHANNEL_NAMES.has(prefix.toLowerCase())) continue;
+      if (name === prefix) return true;
+      if (name.startsWith(prefix + ' ')) {
+        const rest = name.slice(prefix.length).trim().split(/\s+/);
+        if (rest.length > 0 && rest.every((w) => GENERIC_TITLE_SUFFIX_WORDS.has(w.toLowerCase()))) return true;
+      }
+    }
+  }
+  return false;
+}
+
+function checkExtraCard(card, allowed, label) {
+  assert.ok(!isLoadingCard(card), `${label}: card ${show(card)} is still loading`);
+  const raw = cardText(card).trim();
+  const notReadyMatch = /^(?:.*\.\s*)?([A-Za-z0-9][A-Za-z0-9 _/-]*?)\s+is not set up for this Cogniate service yet\b/.exec(raw);
+  const notReadyLms =
+    (card && typeof card === 'object' && typeof card.notReadyLms === 'string' && card.notReadyLms.trim().length > 0
+      ? card.notReadyLms.trim()
+      : null) ?? (notReadyMatch ? notReadyMatch[1].trim() : null);
+  const targetMatch = /Publish Cogniate courses to\s+(.+?)\s+with LTI 1\.3\./.exec(raw);
+  const target = targetMatch ? targetMatch[1].trim() : null;
+
+  if (card && typeof card === 'object') {
+    const channel = typeof card.channel === 'string' && card.channel.trim().length > 0
+      ? card.channel.trim()
+      : typeof card.id === 'string' && card.id.trim().length > 0
+        ? card.id.trim()
+        : null;
+    const name = typeof card.name === 'string' && card.name.trim().length > 0
+      ? card.name.trim()
+      : typeof card.title === 'string' && card.title.trim().length > 0
+        ? card.title.trim()
+        : null;
+    if (channel !== null) {
+      assert.ok(allowed.has(channel), `${label}: extra card ${show(card)} has unregistered channel ${show(channel)}`);
+      if (notReadyLms !== null) {
+        assert.ok(allowed.has(notReadyLms), `${label}: extra card ${show(card)} names no registered channel (${show(notReadyLms)})`);
+      }
+      return;
+    }
+    if (name !== null) {
+      if (target !== null) {
+        assert.ok(allowed.has(target), `${label}: extra card ${show(card)} names no registered channel (${show(target)})`);
+      }
+      if (notReadyLms !== null) {
+        assert.ok(allowed.has(notReadyLms), `${label}: extra card ${show(card)} names no registered channel (${show(notReadyLms)})`);
+      }
+      const hasNonGenericNotReady =
+        notReadyLms !== null && allowed.has(notReadyLms) && !GENERIC_CHANNEL_NAMES.has(notReadyLms.toLowerCase());
+      assert.ok(
+        matchesAllowedCardName(name, allowed) || hasNonGenericNotReady,
+        `${label}: extra card ${show(card)} names no registered channel (${show(name)})`,
+      );
+      return;
+    }
+  }
+  const headingMatch = /^(?:[A-Za-z0-9]{1,4}\s*)?(?:Connect|Manage)\s*(.+?)\s*(?:Publish|Export)\b/.exec(raw);
+  if (headingMatch) {
+    const heading = headingMatch[1].trim();
+    if (target !== null) {
+      assert.ok(allowed.has(target), `${label}: extra card ${show(card)} names no registered channel (${show(target)})`);
+    }
+    if (notReadyLms !== null) {
+      assert.ok(allowed.has(notReadyLms), `${label}: extra card ${show(card)} names no registered channel (${show(notReadyLms)})`);
+    }
+    const hasNonGenericNotReady =
+      notReadyLms !== null && allowed.has(notReadyLms) && !GENERIC_CHANNEL_NAMES.has(notReadyLms.toLowerCase());
+    assert.ok(
+      matchesAllowedCardName(heading, allowed) || hasNonGenericNotReady,
+      `${label}: extra card ${show(card)} names no registered channel (${show(heading)})`,
+    );
+    return;
+  }
+  assert.ok(raw.length > 0 && allowed.has(raw), `${label}: extra card ${show(card)} names no registered channel`);
+}
+
 /**
- * Row 6: the visible cards of the "LMS Publishing" filter, as card texts in page order. Each baseline card text is
- * in exactly one card, in the baseline order. An extra card is a G-BASE non-channel card (`others`, each at most
- * once) or names a registered channel that is not a baseline channel (`names`, from extraChannelNames).
- * Returns the extra card texts.
+ * Row 6: the visible cards of the "LMS Publishing" filter, in page order. Each baseline card text is in
+ * exactly one card, in the baseline order. An extra card is a G-BASE non-channel card (`others`, each at most
+ * once) or matches a registered non-baseline channel by exact `id` or `name` (`names`, from extraChannelNames),
+ * never by substring. Returns the extra cards.
  */
 export function checkCards(cards, baselineTexts, { names, others = BASELINE_OTHER_CARDS, label = 'LMS Publishing cards' }) {
-  const extras = openList(cards, baselineTexts, { label, matches: (text, expected) => String(text).includes(expected) });
+  assert.ok(Array.isArray(cards), `${label}: the answer is a list`);
+  for (const card of cards) {
+    assert.ok(!isLoadingCard(card), `${label}: card ${show(card)} is still loading`);
+  }
+  const allowed = new Set(names.filter((n) => typeof n === 'string' && n.trim().length > 0).map((n) => n.trim()));
+  const extras = openList(cards, baselineTexts, { label, matches: (card, expected) => cardText(card).includes(expected) });
   for (const other of others) {
-    assert.ok(extras.filter((text) => String(text).includes(other)).length <= 1, `${label}: the card ${show(other)} appears more than once`);
+    assert.ok(extras.filter((card) => isOtherCard(card, other)).length <= 1, `${label}: the card ${show(other)} appears more than once`);
   }
-  for (const text of extras) {
-    if (others.some((other) => String(text).includes(other))) continue;
-    assert.ok(names.some((name) => String(text).includes(name)), `${label}: extra card ${show(text)} names no registered channel`);
+  for (const card of extras) {
+    if (others.some((other) => isOtherCard(card, other))) continue;
+    checkExtraCard(card, allowed, label);
   }
   return extras;
 }
+
+/**
+ * Snapshot-upgrade migration ledger check (M1-41.common.j-snapshot; BD-A2-108 / LD-24):
+ * 1. Every historical ledger entry from `oldLedger` is still present in `newLedger` in its original order
+ *    (each `oldLedger[db]` is a non-empty prefix of `newLedger[db]`), independent of the candidate's files.
+ * 2. `newLedger['cogniate-app/cogniate.db']` includes `012_connection_provider_snapshot.sql`.
+ * 3. Each upgraded ledger equals the candidate's full sorted migration file list (`expectedLtiLedger`, `expectedAppLedger`).
+ */
+export function checkMigrationLedgers(
+  oldLedger,
+  newLedger,
+  { expectedLtiLedger, expectedAppLedger, label = 'M1-41.common.j-snapshot migration ledger' } = {},
+) {
+  for (const db of ['lti-service/lti.db', 'cogniate-app/cogniate.db']) {
+    const oldEntries = oldLedger?.[db];
+    const newEntries = newLedger?.[db];
+    assert.ok(Array.isArray(oldEntries) && oldEntries.length > 0, `${label}: ${db} old ledger is a non-empty list`);
+    assert.ok(Array.isArray(newEntries) && newEntries.length >= oldEntries.length, `${label}: ${db} upgraded ledger is shorter than old ledger`);
+    assert.deepEqual(
+      newEntries.slice(0, oldEntries.length),
+      oldEntries,
+      `${label}: ${db} old ledger is not a prefix of the upgraded ledger`,
+    );
+  }
+  assert.ok(
+    newLedger['cogniate-app/cogniate.db'].includes('012_connection_provider_snapshot.sql'),
+    `${label}: cogniate-app/cogniate.db upgraded ledger is missing 012_connection_provider_snapshot.sql`,
+  );
+  if (expectedLtiLedger !== undefined) {
+    assert.deepEqual(newLedger['lti-service/lti.db'], expectedLtiLedger, `${label}: lti-service/lti.db ledger does not match candidate migrations`);
+  }
+  if (expectedAppLedger !== undefined) {
+    assert.deepEqual(newLedger['cogniate-app/cogniate.db'], expectedAppLedger, `${label}: cogniate-app/cogniate.db ledger does not match candidate migrations`);
+  }
+}
```

### 5.3 Round 2 `git apply --check -v` on `la-gate-test-6` & Host K0 / Typecheck Verification

```text
$ git -C /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end-6 apply --check -v /Users/quangnguyen/cogniate-qa-runs/LA/ld1-overlay-fix-r1/ld9-addendum-r5.patch
Checking patch tests/acceptance/lib/open-world.d.mts...
Checking patch tests/acceptance/lib/open-world.mjs...
Checking patch tests/e2e/M2/01-cards.m2.ts...
Checking patch tests/host/m1-migration.mjs...
Checking patch tests/ltiaas/k0/ld1/open-world.test.mjs...
Checking patch tests/ltiaas/k0/ld1/open-world.test.ts...
Checking patch tests/ltiaas/lib/open-world.d.mts...
Checking patch tests/ltiaas/lib/open-world.mjs...

$ node --test tests/ltiaas/k0/ld1/open-world.test.mjs
✔ the probe card texts equal tests/e2e/M2/lib/m2.ts TEXT, and open-world copies match when present
...
✔ row 6: the G-BASE Kajabi card is allowed, but not twice
✔ row 6 exact membership (A-LA-E0-04-01 / B-LA-E0-04-01): mixed registered and unregistered cards with lti-generic (channelName: LMS)
✔ row 6 loading state (A-LA-E0-04-03): delayed connections settle and pass; permanently unresolved loading fails
✔ row 6 not-ready disabled card with distinct display title (B-LA-E0-04-02): registered passes, unregistered fails
✔ M1-41.common.j-snapshot migration ledger (A-LA-E0-04-02 / LD-24): old ledger is a prefix of upgraded ledger and matches candidate migrations
ℹ tests 44
ℹ pass 44
ℹ fail 0

$ npx vitest run --config tests/ltiaas/k0/vitest.config.mts
 ✓ tests/ltiaas/k0/contract.test.ts (103 tests)
 ✓ tests/ltiaas/k0/ld1/open-world.test.ts (44 tests)
 ✓ tests/ltiaas/k0/smoke.test.ts (2 tests)
 Test Files  3 passed (3)
      Tests  149 passed (149)

$ npm --prefix tests run typecheck
> cogniate-qa-tests@0.0.0 typecheck
> tsc --noEmit -p tsconfig.json
```



---

## Round 3 — `BD-A1-119` `article[data-channel-id]` Card Membership Oracle & `G-BASE` (`1b17261`) Unattributed Parity (`A-LA-E0-04-05`, `B-LA-E0-04-02`, `B-LA-E0-04-03`)

### 6.1 Round 3 Findings Closed & Summary of Hunks Against `la-gate-test-6` (`9de014298fbe133ebbd8d40365da84988ccabf5d`)

In Round 3 (`docs/reviews/LA-E0-04/reviewer-a.md` and `docs/reviews/LA-E0-04/reviewer-b.md`, `## Round 3`), `A-LA-E0-04-01 = B-LA-E0-04-01`, `A-LA-E0-04-02`, `A-LA-E0-04-03`, and `A-LA-E0-04-04` are **CLOSED/APPROVED**. Architect A1 ratified `BD-A1-119` (`docs/architecture/ltiaas/build-decisions-A1.md`, `docs/architecture/ltiaas/tasks/LA-E0-04.md`), and lane P merged `data-channel-id` on `a8bbac53`:

> "(b1) ... add `data-channel-id={item.channel}` for a channel card; a static card (channel null) gets no attribute ... every card of a channel that the page shows has `data-channel-id=\"<manifest id>\"` in every state (loading, not ready, disabled Connect, ready, connected), and no other card has the attribute ... The QA oracle needs no text guessing and no product source: the expected set is the `channel` values of `GET /app-api/lms-providers` (the same visible set as the cards; a simulation-only channel only when the service reports simulations). The M2 check selects `article[data-channel-id]` and compares the values with that set; every other card in the LMS Publishing tab must be one of the frozen static cards."

Per Lead instruction (`msg_dfa13f78dd88`), because intake `1b17261` (`G-BASE`) has no `data-channel-id` attributes while `LA-E0-04` must still prove `LD-1` parity there:
- **When the page has cards with `data-channel-id` (`hasChannelAttrs === true`):** `checkCards` uses A1's `BD-A1-119` oracle **exactly** (the 3 baseline cards in order with `data-channel-id` equal to `moodle`, `canvas`, `blackboard`; every card without `data-channel-id` must be one of the frozen static cards `BASELINE_OTHER_CARDS`, at most once; the non-baseline `data-channel-id` values have no duplicates and equal the exact set of registered non-baseline `channel` values of `GET /app-api/lms-providers`).
- **When no card has `data-channel-id` (`hasChannelAttrs === false`, the unattributed `1b17261` / `G-BASE` baseline page):** `checkCards` uses the exact closed list of the baseline cards (the 3 baseline cards in order, plus `BASELINE_OTHER_CARDS` at most once, with `allowed.size === 0` and zero extra channel cards), **never text guessing**.

| # | File | Hunk / Lines | Finding Closed | Classification | Reason |
| --- | --- | --- | --- | --- | --- |
| 1 | `tests/acceptance/lib/open-world.mjs` (and byte-identical `tests/ltiaas/lib/open-world.mjs`) | `extraChannelNames` (`:41-51`), `cardChannel` + `isLoadingCard` + `isOtherCard` + `checkCards` (`:58-151`), `checkMigrationLedgers` (`:153-186`) | **`A-LA-E0-04-05`** (BLOCKER), **`B-LA-E0-04-02`** (MAJOR), **`B-LA-E0-04-03`** (BLOCKER), plus previously closed `A-LA-E0-04-01 = B-LA-E0-04-01`, `A-LA-E0-04-02`, `A-LA-E0-04-03`, `A-LA-E0-04-04` | **`LD-1` row 6 open-world card membership oracle fix (`BD-A1-119` + `G-BASE` closed-list parity, `LA-E0-04`)** | Removes every text-based card identity path (setup-notice regex, title suffix word stripping, `notReadyLms` guessing, `href`/`id` fallback). `extraChannelNames(lmsProviders)` returns the non-baseline `channel` ids (`entry.channel ?? entry.lms`) of `GET /app-api/lms-providers`. `checkCards` rejects any loading card (`!isLoadingCard(card)`), branches on `hasChannelAttrs = cards.some((card) => cardChannel(card) !== null)` (closed baseline list when `false`; exact `BD-A1-119` `article[data-channel-id]` set equality when `true`), and keeps `checkMigrationLedgers` (`LD-24`). |
| 2 | `tests/acceptance/lib/open-world.d.mts` (and byte-identical `tests/ltiaas/lib/open-world.d.mts`) | `CardDescriptor` (`{ text: string; channel: string \| null; loading?: boolean }`), `CardInput`, `checkCards`, `MigrationLedgerMap`, `checkMigrationLedgers` (`:10-30`) | **`A-LA-E0-04-05` / `B-LA-E0-04-02` / `B-LA-E0-04-03`** | **`LD-1` TypeScript declaration update (`BD-A1-119`, `LA-E0-04`)** | Simplifies `CardDescriptor` to `{ text: string; channel: string \| null; loading?: boolean }` with zero text-guessing fields. |
| 3 | `tests/e2e/M2/01-cards.m2.ts` | `lmsCardTexts` (`:12-38`) | **`A-LA-E0-04-03`** (MAJOR), **`A-LA-E0-04-05`** (BLOCKER), **`B-LA-E0-04-02`** (MAJOR), **`B-LA-E0-04-03`** (BLOCKER) | **`LD-1` row 6 `M2-01.cards` DOM extractor & settlement wait (`BD-A1-119`, `LA-E0-04`)** | Extracts `{ text, channel, loading }` per visible card in the LMS Publishing grid where `channel` is read strictly from `article[data-channel-id]` (`c.matches('article[data-channel-id]') ? c : c.querySelector('article[data-channel-id]')`), and keeps the approved `expect.poll(...)` wait until `cards.length > 0 && cards.every((c) => !c.loading)`. |
| 4 | `tests/host/m1-migration.mjs` | Import and call `checkMigrationLedgers(oldLedger, newLedger, { expectedLtiLedger, expectedAppLedger })` (`:12`, `:341`) | **`A-LA-E0-04-02`** (MAJOR), **`A-LA-E0-04-04`** (MINOR) | **Assertion change on `M1-41.common.j-snapshot` (`BD-A2-108` / `LD-24` / `WE-F5`)** | Unchanged from Round 1/2 (approved in Round 3). |
| 5 | `tests/ltiaas/k0/ld1/open-world.test.mjs` and `tests/ltiaas/k0/ld1/open-world.test.ts` | `MiniElement` DOM builder + `loadM2EvaluateFn` (executes the literal `page.evaluate` callback from `tests/e2e/M2/01-cards.m2.ts`) + 5 `BD-A1-119` & `G-BASE` DOM oracle tests (`:39-778`) | **`A-LA-E0-04-01 = B-LA-E0-04-01`**, **`A-LA-E0-04-02`**, **`A-LA-E0-04-03`**, **`A-LA-E0-04-05`**, **`B-LA-E0-04-02`**, **`B-LA-E0-04-03`** | **`K0` `ld1` DOM probes (`AC-LA-E0-04-05`, `AC-LA-E0-04-06`, `BD-A1-119`)** | Executes the actual `01-cards.m2.ts` DOM extractor against constructed card trees and verifies: (1) unattributed `G-BASE` (`1b17261`) baseline page without `data-channel-id` passes with the 3 baseline cards (and with the static Kajabi card) and fails with any extra card, while an attributed page follows `BD-A1-119`; (2) unregistered `"Sakai"` and `"Campus Cloud"` cards fail in every state (including disabled cards with generic `"LMS is not set up..."` notice, copied notice, or lookalike title); (3) a registered card with custom title `"Teaching Hub"` and custom not-ready text (`"Campus is unavailable until your operator completes setup."`, `"Ask your operator to enable Campus."`) passes; (4) a loading card passes after it settles and a permanently loading card fails; (5) a card with an unknown `data-channel-id`, a static card with `data-channel-id`, a baseline card with missing/wrong `data-channel-id`, or a missing registered card fails. |

### 6.2 Complete Regenerated Diff Against `la-gate-test-6` (`9de014298fbe133ebbd8d40365da84988ccabf5d`)

Saved at `/Users/quangnguyen/cogniate-qa-runs/LA/ld1-overlay-fix-r1/ld9-addendum-r5.patch` (`SHA256 = e6b0c719c4bb7a83762df45b46382012070ebbf70acec16735cab986bb289aec`):

```diff
diff --git a/tests/acceptance/lib/open-world.d.mts b/tests/acceptance/lib/open-world.d.mts
index 2629c41d..d0f6d052 100644
--- a/tests/acceptance/lib/open-world.d.mts
+++ b/tests/acceptance/lib/open-world.d.mts
@@ -26,4 +26,24 @@ export function appLmsProviders(
     Promise<{ status: number; headers: Record<string, any>; body: string }>,
   options: { appUrl: string; ca?: string | null; user: { email: string; password: string } },
 ): Promise<Json>;
-export function checkCards(cards: string[], baselineTexts: string[], options: { names: string[]; others?: string[]; label?: string }): string[];
+export interface CardDescriptor {
+  text: string;
+  channel: string | null;
+  loading?: boolean;
+}
+export type CardInput = string | CardDescriptor;
+export function checkCards<T extends CardInput>(
+  cards: T[],
+  baselineTexts: string[],
+  options: { names: string[]; others?: string[]; label?: string },
+): T[];
+export interface MigrationLedgerMap {
+  'lti-service/lti.db': string[];
+  'cogniate-app/cogniate.db': string[];
+  [db: string]: string[];
+}
+export function checkMigrationLedgers(
+  oldLedger: MigrationLedgerMap,
+  newLedger: MigrationLedgerMap,
+  options?: { expectedLtiLedger?: string[]; expectedAppLedger?: string[]; label?: string },
+): void;
diff --git a/tests/acceptance/lib/open-world.mjs b/tests/acceptance/lib/open-world.mjs
index c38c4e49..8d4c7232 100644
--- a/tests/acceptance/lib/open-world.mjs
+++ b/tests/acceptance/lib/open-world.mjs
@@ -58,11 +58,15 @@ export function registeredChannels(lmsProviders) {
   return new Set(ids);
 }
 
-/** The text names of the registered channels that are not baseline channels (`channelName`, else `label`). */
+/**
+ * The registered channel ids (`channel` of GET /app-api/lms-providers, or `lms` before LA-IC-01)
+ * that are not baseline channels (BD-A1-119).
+ */
 export function extraChannelNames(lmsProviders) {
   assert.ok(Array.isArray(lmsProviders?.lms), 'GET /app-api/lms-providers has an lms list');
-  return lmsProviders.lms.filter((entry) => !BASELINE_LMS.includes(entry.channel ?? entry.lms))
-    .map((entry) => entry.channelName ?? entry.label).filter((name) => typeof name === 'string' && name.length > 0);
+  const ids = lmsProviders.lms.map((entry) => entry.channel ?? entry.lms);
+  for (const id of ids) assert.equal(typeof id, 'string', 'Each lms-providers entry has a channel id');
+  return ids.filter((id) => id.length > 0 && !BASELINE_LMS.includes(id));
 }
 
 /**
@@ -179,20 +183,123 @@ export async function appLmsProviders(request, { appUrl, ca, user }) {
   return JSON.parse(answer.body);
 }
 
+const cardText = (card) => (typeof card === 'string' ? card : String(card?.text ?? ''));
+
+const cardChannel = (card) => {
+  if (!card || typeof card !== 'object') return null;
+  const ch = card.channel ?? null;
+  return ch === null || ch === undefined ? null : String(ch);
+};
+
+const isLoadingCard = (card) => {
+  if (card && typeof card === 'object' && card.loading === true) return true;
+  const raw = cardText(card).trim();
+  return /^(?:[A-Za-z0-9]{1,4}\s*)?Loading(?:…|\.\.\.)/.test(raw);
+};
+
+const isOtherCard = (card, other) => cardChannel(card) === null && cardText(card).includes(other);
+
 /**
- * Row 6: the visible cards of the "LMS Publishing" filter, as card texts in page order. Each baseline card text is
- * in exactly one card, in the baseline order. An extra card is a G-BASE non-channel card (`others`, each at most
- * once) or names a registered channel that is not a baseline channel (`names`, from extraChannelNames).
- * Returns the extra card texts.
+ * Row 6 (BD-A1-119): the visible cards of the "LMS Publishing" filter, in page order.
+ * - When the page has cards with `data-channel-id` (attributed page): each baseline card text is in exactly one card
+ *   in the baseline order with `data-channel-id` equal to the baseline channel id; every non-baseline channel card
+ *   carries `data-channel-id` (`channel`), and the set of those ids equals the non-baseline `channel` values of
+ *   GET /app-api/lms-providers (`names`, from extraChannelNames); every card without `data-channel-id` (`channel: null`)
+ *   must be one of the frozen static cards (`others`, each at most once).
+ * - When no card has `data-channel-id` (the unattributed G-BASE / 1b17261 baseline page): uses the closed baseline
+ *   card list (the 3 baseline cards in order, plus `others` each at most once, with no extra channel cards).
+ * Never uses text guessing. Returns the extra cards.
  */
 export function checkCards(cards, baselineTexts, { names, others = BASELINE_OTHER_CARDS, label = 'LMS Publishing cards' }) {
-  const extras = openList(cards, baselineTexts, { label, matches: (text, expected) => String(text).includes(expected) });
+  assert.ok(Array.isArray(cards), `${label}: the answer is a list`);
+  assert.ok(Array.isArray(names), `${label}: names is a list`);
+  for (const card of cards) {
+    assert.ok(!isLoadingCard(card), `${label}: card ${show(card)} is still loading`);
+  }
+  const allowed = new Set();
+  for (const name of names) {
+    assert.ok(typeof name === 'string' && name.trim().length > 0, `${label}: invalid channel id ${show(name)}`);
+    allowed.add(name.trim());
+  }
+  assert.equal(allowed.size, names.length, `${label}: channel ids are unique`);
+  const hasChannelAttrs = cards.some((card) => cardChannel(card) !== null);
+  let baselineIndex = 0;
+  const extras = openList(cards, baselineTexts, {
+    label,
+    matches: (card, expected) => cardText(card).includes(expected),
+    check: (card) => {
+      const expectedChannel = BASELINE_LMS[baselineIndex++];
+      if (hasChannelAttrs) {
+        const ch = cardChannel(card);
+        assert.equal(ch, expectedChannel, `${label}: baseline card ${show(expectedChannel)} has channel ${show(ch)}`);
+      }
+    },
+  });
   for (const other of others) {
-    assert.ok(extras.filter((text) => String(text).includes(other)).length <= 1, `${label}: the card ${show(other)} appears more than once`);
+    assert.ok(extras.filter((card) => isOtherCard(card, other)).length <= 1, `${label}: the card ${show(other)} appears more than once`);
   }
-  for (const text of extras) {
-    if (others.some((other) => String(text).includes(other))) continue;
-    assert.ok(names.some((name) => String(text).includes(name)), `${label}: extra card ${show(text)} names no registered channel`);
+  if (!hasChannelAttrs) {
+    assert.equal(allowed.size, 0, `${label}: unattributed baseline page cannot satisfy extra registered channels ${show([...allowed])}`);
+    for (const card of extras) {
+      assert.ok(
+        others.some((other) => isOtherCard(card, other)),
+        `${label}: extra card ${show(card)} is not in the closed baseline card list`,
+      );
+    }
+    return extras;
+  }
+  const extraChannels = [];
+  for (const card of extras) {
+    const ch = cardChannel(card);
+    if (ch === null) {
+      assert.ok(
+        others.some((other) => isOtherCard(card, other)),
+        `${label}: card without data-channel-id ${show(card)} is not a frozen static card`,
+      );
+      continue;
+    }
+    const id = ch.trim();
+    assert.ok(id.length > 0 && allowed.has(id), `${label}: extra card ${show(card)} has unregistered channel ${show(ch)}`);
+    extraChannels.push(id);
+  }
+  assert.equal(new Set(extraChannels).size, extraChannels.length, `${label}: duplicate channel card in ${show(extraChannels)}`);
+  for (const expectedId of allowed) {
+    assert.ok(extraChannels.includes(expectedId), `${label}: missing card for registered channel ${show(expectedId)}`);
   }
   return extras;
 }
+
+/**
+ * Snapshot-upgrade migration ledger check (M1-41.common.j-snapshot; BD-A2-108 / LD-24):
+ * 1. Every historical ledger entry from `oldLedger` is still present in `newLedger` in its original order
+ *    (each `oldLedger[db]` is a non-empty prefix of `newLedger[db]`), independent of the candidate's files.
+ * 2. `newLedger['cogniate-app/cogniate.db']` includes `012_connection_provider_snapshot.sql`.
+ * 3. Each upgraded ledger equals the candidate's full sorted migration file list (`expectedLtiLedger`, `expectedAppLedger`).
+ */
+export function checkMigrationLedgers(
+  oldLedger,
+  newLedger,
+  { expectedLtiLedger, expectedAppLedger, label = 'M1-41.common.j-snapshot migration ledger' } = {},
+) {
+  for (const db of ['lti-service/lti.db', 'cogniate-app/cogniate.db']) {
+    const oldEntries = oldLedger?.[db];
+    const newEntries = newLedger?.[db];
+    assert.ok(Array.isArray(oldEntries) && oldEntries.length > 0, `${label}: ${db} old ledger is a non-empty list`);
+    assert.ok(Array.isArray(newEntries) && newEntries.length >= oldEntries.length, `${label}: ${db} upgraded ledger is shorter than old ledger`);
+    assert.deepEqual(
+      newEntries.slice(0, oldEntries.length),
+      oldEntries,
+      `${label}: ${db} old ledger is not a prefix of the upgraded ledger`,
+    );
+  }
+  assert.ok(
+    newLedger['cogniate-app/cogniate.db'].includes('012_connection_provider_snapshot.sql'),
+    `${label}: cogniate-app/cogniate.db upgraded ledger is missing 012_connection_provider_snapshot.sql`,
+  );
+  if (expectedLtiLedger !== undefined) {
+    assert.deepEqual(newLedger['lti-service/lti.db'], expectedLtiLedger, `${label}: lti-service/lti.db ledger does not match candidate migrations`);
+  }
+  if (expectedAppLedger !== undefined) {
+    assert.deepEqual(newLedger['cogniate-app/cogniate.db'], expectedAppLedger, `${label}: cogniate-app/cogniate.db ledger does not match candidate migrations`);
+  }
+}
diff --git a/tests/e2e/M2/01-cards.m2.ts b/tests/e2e/M2/01-cards.m2.ts
index 6d8bc5f2..7bcdc2e4 100644
--- a/tests/e2e/M2/01-cards.m2.ts
+++ b/tests/e2e/M2/01-cards.m2.ts
@@ -9,16 +9,34 @@ import { TEXT, button, card, expect, integrations, m2Case, manageControl, portal
 import { checkCards, extraChannelNames } from '../../acceptance/lib/open-world.mjs';
 
 const squash = (t: string) => t.replace(/\s+/g, ' ').trim();
-/** The visible cards of the grid that holds the Moodle card (the "LMS Publishing" filter), as texts in page order. */
-const lmsCardTexts = (page: Page) => page.evaluate((moodleText) => {
-  const all = Array.from(document.querySelectorAll('body *')) as HTMLElement[];
-  let cell: HTMLElement | null = all.find((el) => el.children.length === 0 && (el.textContent ?? '').includes(moodleText)) ?? null;
-  while (cell && cell.parentElement && getComputedStyle(cell.parentElement).display !== 'grid') cell = cell.parentElement;
-  if (!cell || !cell.parentElement) return [];
-  return (Array.from(cell.parentElement.children) as HTMLElement[])
-    .filter((c) => getComputedStyle(c).display !== 'none' && c.getBoundingClientRect().height > 0)
-    .map((c) => (c.textContent ?? '').replace(/\s+/g, ' ').trim());
-}, TEXT.moodleCard);
+/** The visible cards of the grid that holds the Moodle card (the "LMS Publishing" filter), in page order, after loading settles. */
+const lmsCardTexts = async (page: Page) => {
+  const read = () => page.evaluate((moodleText) => {
+    const all = Array.from(document.querySelectorAll('body *'));
+    let cell = all.find((el) => el.children.length === 0 && (el.textContent ?? '').includes(moodleText)) ?? null;
+    while (cell && cell.parentElement && getComputedStyle(cell.parentElement).display !== 'grid') cell = cell.parentElement;
+    if (!cell || !cell.parentElement) return [];
+    return Array.from(cell.parentElement.children)
+      .filter((c) => getComputedStyle(c).display !== 'none' && c.getBoundingClientRect().height > 0)
+      .map((c) => {
+        const text = (c.textContent ?? '').replace(/\s+/g, ' ').trim();
+        const article = c.matches('article[data-channel-id]') ? c : c.querySelector('article[data-channel-id]');
+        const channel = article ? article.getAttribute('data-channel-id') : null;
+        const controls = Array.from(c.querySelectorAll('a, button, [role="button"], [role="link"]'))
+          .filter((el) => /^(?:Connect|Manage)$/i.test((el.textContent ?? '').replace(/\s+/g, ' ').trim()));
+        const hasLoadingLeaf = Array.from(c.querySelectorAll('*')).some(
+          (el) => el.children.length === 0 && /^Loading(?:…|\.\.\.)$/i.test((el.textContent ?? '').replace(/\s+/g, ' ').trim()),
+        );
+        const loading = controls.length === 0 || hasLoadingLeaf || /^(?:[A-Za-z0-9]{1,4}\s*)?Loading(?:…|\.\.\.)/.test(text);
+        return { text, channel, loading };
+      });
+  }, TEXT.moodleCard);
+  await expect.poll(async () => {
+    const cards = await read();
+    return cards.length > 0 && cards.every((c) => !c.loading);
+  }, { message: 'LMS Publishing cards finished loading' }).toBe(true);
+  return read();
+};
 
 m2Case('M2-01.cards', 'the LMS Publishing filter shows the Moodle, Canvas and Blackboard cards with their texts and initials', async ({ page }) => {
   await sharedPlatform();
@@ -27,8 +45,9 @@ m2Case('M2-01.cards', 'the LMS Publishing filter shows the Moodle, Canvas and Bl
   await expect(page.getByRole('heading', { name: 'Blackboard', exact: true })).toBeVisible();
   const moodle = card(page, TEXT.moodleCard), canvas = card(page, TEXT.canvasCard), bb = card(page, TEXT.blackboardCard);
   for (const c of [moodle, canvas, bb]) await expect(c).toBeVisible();
-  // LD-1 open world (LA-E0-04, row 6): the 3 baseline cards with their texts, in this order; an extra card is the
-  // G-BASE Kajabi card or names a registered channel of GET /app-api/lms-providers.
+  // LD-1 open world (LA-E0-04, row 6; BD-A1-119): the 3 baseline cards with their texts and data-channel-id, in this
+  // order; every channel card carries article[data-channel-id] matching GET /app-api/lms-providers; any card without
+  // data-channel-id is the G-BASE static Kajabi card.
   const providers = await app(await session('A'), 'GET', '/app-api/lms-providers'); ok(providers, 200, 'lms-providers');
   checkCards(await lmsCardTexts(page), [TEXT.moodleCard, TEXT.canvasCard, TEXT.blackboardCard], { names: extraChannelNames(providers.json) });
   await expect(canvas.getByText('Cv', { exact: true })).toBeVisible();
diff --git a/tests/host/m1-migration.mjs b/tests/host/m1-migration.mjs
index ddc459fc..128d2452 100644
--- a/tests/host/m1-migration.mjs
+++ b/tests/host/m1-migration.mjs
@@ -9,6 +9,7 @@ import crypto from 'node:crypto';
 import fs from 'node:fs';
 import path from 'node:path';
 import { allContainers } from './lib.mjs';
+import { checkMigrationLedgers } from '../acceptance/lib/open-world.mjs';
 import { SNAPSHOT_OLD_SHA, assertSnapshotBoundary } from './m1-phases.mjs';
 import { CompatRoute, OLD_OPLOCK, qualifyRow } from './storage-compat-route.mjs';
 import { StorageFail } from './storage-docker.mjs';
@@ -337,8 +338,7 @@ export async function snapshotMigrationRun(r, { installTests, setup, probe, iden
   const expectedAppLedger = fs.existsSync(appMigDir)
     ? fs.readdirSync(appMigDir).filter((n) => n.endsWith('.sql')).sort()
     : [...oldLedger['cogniate-app/cogniate.db'], '012_connection_provider_snapshot.sql'].sort();
-  assert.deepEqual(newLedger['lti-service/lti.db'], expectedLtiLedger);
-  assert.deepEqual(newLedger['cogniate-app/cogniate.db'], expectedAppLedger);
+  checkMigrationLedgers(oldLedger, newLedger, { expectedLtiLedger, expectedAppLedger });
   const problems = qualifyRow(route.steps, { oldSha: SNAPSHOT_OLD_SHA });
   r.saveText('storage/j-snapshot.json', JSON.stringify({ oldSha: SNAPSHOT_OLD_SHA, steps: route.steps.map(({ commands, ...s }) => ({ ...s, commands: commands.length })), problems }, null, 2));
   evidence.push({ id: 'M1-41.common.j-snapshot', environment: 'SIM', status: problems.length ? 'FAIL' : 'PASS', ...identity,
diff --git a/tests/ltiaas/k0/ld1/open-world.test.mjs b/tests/ltiaas/k0/ld1/open-world.test.mjs
index f4dbb5c3..d2fa1bcf 100644
--- a/tests/ltiaas/k0/ld1/open-world.test.mjs
+++ b/tests/ltiaas/k0/ld1/open-world.test.mjs
@@ -5,14 +5,16 @@ import assert from 'node:assert/strict';
 import fs from 'node:fs';
 import path from 'node:path';
 import test from 'node:test';
-import { fileURLToPath } from 'node:url';
-import {
-  BASELINE_PROFILES, BASELINE_REAL_PROFILES, BASELINE_SIMULATION_PROFILES, checkCards, checkLmsEntries, checkProfiles,
-  checkSimulationProfiles, extraChannelNames, registeredChannels,
-} from '../../../acceptance/lib/open-world.mjs';
+import { fileURLToPath, pathToFileURL } from 'node:url';
 
 const here = path.dirname(fileURLToPath(import.meta.url));
 const testsDir = path.resolve(here, '../../..');
+const acceptanceOpenWorldPath = path.join(testsDir, 'acceptance/lib/open-world.mjs');
+const ltiaasOpenWorldPath = path.resolve(here, '../../lib/open-world.mjs');
+const {
+  BASELINE_PROFILES, BASELINE_REAL_PROFILES, BASELINE_SIMULATION_PROFILES, checkCards, checkLmsEntries,
+  checkMigrationLedgers, checkProfiles, checkSimulationProfiles, extraChannelNames, registeredChannels,
+} = await import(pathToFileURL(fs.existsSync(acceptanceOpenWorldPath) ? acceptanceOpenWorldPath : ltiaasOpenWorldPath).href);
 const read = (name) => JSON.parse(fs.readFileSync(path.join(here, 'g-base', name), 'utf8'));
 const copy = (value) => structuredClone(value);
 
@@ -25,15 +27,190 @@ const CARD_TEXTS = [
 
 // A new channel as LA adds it (app API delta §1-§2, LTI delta §4.7), and one that no registry knows.
 const NEW = { id: 'lti-generic', name: 'LMS' };
-const withChannel = (lmsProviders, id = NEW.id, name = NEW.name) => {
+const withChannel = (lmsProviders, id = NEW.id, name = NEW.name, label = name) => {
   const next = copy(lmsProviders);
-  next.lms.push({ lms: id, channel: id, channelName: name, label: name, methods: ['dynamic', 'manual'], profiles: [] });
+  next.lms.push({ lms: id, channel: id, channelName: name, label, methods: ['dynamic', 'manual'], profiles: [] });
   return next;
 };
 const newProfile = (channel, { id = channel, simulation = false } = {}) => ({ id, lms: channel, channel, label: 'New',
   sharing: 'exclusive', issuer: null, authenticationEndpoint: null, accesstokenEndpoint: null, jwksUrl: null,
   siteUrlOn: null, serviceUrl: false, simulation, sharedPlatform: null });
 
+/**
+ * Minimal DOM tree builder so K0 probes execute the exact `page.evaluate` extractor from `tests/e2e/M2/01-cards.m2.ts`
+ * without a browser or external DOM package.
+ */
+class MiniElement {
+  constructor(tagName, attrs = {}, children = [], text = '', { display = 'block', height = 120 } = {}) {
+    this.tagName = tagName.toUpperCase();
+    this.attrs = new Map(Object.entries(attrs).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => [k, String(v)]));
+    this.children = [];
+    this.parentElement = null;
+    this._ownText = text;
+    this._display = display;
+    this._height = height;
+    for (const child of children) this.appendChild(child);
+  }
+  appendChild(child) {
+    child.parentElement = this;
+    this.children.push(child);
+    return child;
+  }
+  get textContent() {
+    return this._ownText + this.children.map((c) => c.textContent).join('');
+  }
+  getAttribute(name) {
+    return this.attrs.has(name) ? this.attrs.get(name) : null;
+  }
+  hasAttribute(name) {
+    return this.attrs.has(name);
+  }
+  getBoundingClientRect() {
+    return { height: this._height, width: 240, top: 0, left: 0, right: 240, bottom: this._height };
+  }
+  matches(selector) {
+    return selector.split(',').some((part) => {
+      const s = part.trim();
+      if (!s) return false;
+      if (s === '*') return true;
+      const m = /^([a-zA-Z0-9_-]+)?(?:\[([a-zA-Z0-9_-]+)(?:="([^"]*)")?\])?$/.exec(s);
+      if (!m) return false;
+      const [, tag, attr, val] = m;
+      if (tag && this.tagName !== tag.toUpperCase()) return false;
+      if (attr) {
+        if (!this.hasAttribute(attr)) return false;
+        if (val !== undefined && this.getAttribute(attr) !== val) return false;
+      }
+      return true;
+    });
+  }
+  querySelectorAll(selector) {
+    const out = [];
+    const walk = (node) => {
+      for (const child of node.children) {
+        if (child === this && selector === 'body *') continue;
+        if (selector === 'body *' || child.matches(selector)) out.push(child);
+        walk(child);
+      }
+    };
+    if (selector === 'body *' && this.tagName === 'DOCUMENT') {
+      const body = this.children.find((c) => c.tagName === 'BODY');
+      if (body) walk(body);
+      return out;
+    }
+    walk(this);
+    return out;
+  }
+  querySelector(selector) {
+    return this.querySelectorAll(selector)[0] ?? null;
+  }
+}
+
+const buildCardElement = ({
+  tag = 'article',
+  channelId = null,
+  initials = '',
+  control = 'connect-link',
+  heading,
+  description,
+  notice = null,
+  display = 'block',
+  height = 120,
+}) => {
+  const children = [];
+  if (initials) children.push(new MiniElement('span', {}, [], initials));
+  if (control === 'connect-link') {
+    const href = channelId ? `/integrations/${channelId}/connect` : '/integrations/connect';
+    children.push(new MiniElement('a', { href, ...(channelId ? { id: `${channelId}-connect` } : {}) }, [], 'Connect'));
+  } else if (control === 'manage-link') {
+    const href = channelId ? `/integrations/${channelId}/con_1` : '/integrations/con_1';
+    children.push(new MiniElement('a', { href, ...(channelId ? { id: `${channelId}-manage` } : {}) }, [], 'Manage'));
+  } else if (control === 'disabled-connect') {
+    children.push(new MiniElement('button', { disabled: 'true' }, [], 'Connect'));
+  } else if (control === 'loading') {
+    children.push(new MiniElement('span', {}, [], 'Loading…'));
+  }
+  children.push(new MiniElement('h2', {}, [], heading));
+  children.push(new MiniElement('p', {}, [], description));
+  if (notice) children.push(new MiniElement('p', {}, [], notice));
+  const attrs = channelId !== null && channelId !== undefined ? { 'data-channel-id': channelId } : {};
+  return new MiniElement(tag, attrs, children, '', { display, height });
+};
+
+const BASELINE_DOM_SPECS = [
+  {
+    channelId: null,
+    initials: 'K',
+    control: 'disabled-connect',
+    heading: 'Kajabi',
+    description: 'Publish and sell your courses directly on Kajabi with seamless content sync.',
+  },
+  {
+    channelId: 'moodle',
+    initials: '',
+    control: 'connect-link',
+    heading: 'Moodle',
+    description: CARD_TEXTS[0],
+  },
+  {
+    channelId: 'canvas',
+    initials: 'Cv',
+    control: 'connect-link',
+    heading: 'Canvas',
+    description: CARD_TEXTS[1],
+  },
+  {
+    channelId: 'blackboard',
+    initials: 'Bb',
+    control: 'disabled-connect',
+    heading: 'Blackboard',
+    description: CARD_TEXTS[2],
+    notice: 'Blackboard is not set up for this Cogniate service yet. Ask your Cogniate operator.',
+  },
+];
+
+const referenceEvaluateCards = (document, getComputedStyle, moodleText) => {
+  const all = Array.from(document.querySelectorAll('body *'));
+  let cell = all.find((el) => el.children.length === 0 && (el.textContent ?? '').includes(moodleText)) ?? null;
+  while (cell && cell.parentElement && getComputedStyle(cell.parentElement).display !== 'grid') cell = cell.parentElement;
+  if (!cell || !cell.parentElement) return [];
+  return Array.from(cell.parentElement.children)
+    .filter((c) => getComputedStyle(c).display !== 'none' && c.getBoundingClientRect().height > 0)
+    .map((c) => {
+      const text = (c.textContent ?? '').replace(/\s+/g, ' ').trim();
+      const article = c.matches('article[data-channel-id]') ? c : c.querySelector('article[data-channel-id]');
+      const channel = article ? article.getAttribute('data-channel-id') : null;
+      const controls = Array.from(c.querySelectorAll('a, button, [role="button"], [role="link"]'))
+        .filter((el) => /^(?:Connect|Manage)$/i.test((el.textContent ?? '').replace(/\s+/g, ' ').trim()));
+      const hasLoadingLeaf = Array.from(c.querySelectorAll('*')).some(
+        (el) => el.children.length === 0 && /^Loading(?:…|\.\.\.)$/i.test((el.textContent ?? '').replace(/\s+/g, ' ').trim()),
+      );
+      const loading = controls.length === 0 || hasLoadingLeaf || /^(?:[A-Za-z0-9]{1,4}\s*)?Loading(?:…|\.\.\.)/.test(text);
+      return { text, channel, loading };
+    });
+};
+
+const loadM2EvaluateFn = () => {
+  const m2CardsPath = path.join(testsDir, 'e2e/M2/01-cards.m2.ts');
+  if (!fs.existsSync(m2CardsPath)) return referenceEvaluateCards;
+  const src = fs.readFileSync(m2CardsPath, 'utf8');
+  const m = /page\.evaluate\(\(moodleText\)\s*=>\s*\{([\s\S]*?)\},\s*TEXT\.moodleCard\)/.exec(src);
+  assert.ok(m, '01-cards.m2.ts defines page.evaluate((moodleText) => { ... }, TEXT.moodleCard)');
+  return new Function('document', 'getComputedStyle', 'moodleText', m[1]);
+};
+
+const evaluateM2Cards = loadM2EvaluateFn();
+
+const extractDomCards = (cardSpecs) => {
+  const grid = new MiniElement('div', {}, cardSpecs.map(buildCardElement), '', { display: 'grid', height: 600 });
+  const body = new MiniElement('body', {}, [grid], '', { display: 'block', height: 800 });
+  const doc = new MiniElement('document', {}, [body], '', { display: 'block', height: 800 });
+  const getComputedStyle = (el) => ({ display: el._display ?? 'block' });
+  const res = evaluateM2Cards(doc, getComputedStyle, CARD_TEXTS[0]);
+  assert.deepEqual(res, referenceEvaluateCards(doc, getComputedStyle, CARD_TEXTS[0]));
+  return res;
+};
+
 /**
  * One entry per rewritten assertion (TEST-STRATEGY §4.3). `answer` is the recorded answer; `call(answer)` runs the
  * check like the call site; `change`, `remove`, `move` make one baseline element changed, removed or out of its
@@ -78,7 +255,17 @@ const rows = [
     move: (a) => { a.cards.push(a.cards.splice(1, 1)[0]); },
     extra: (a, registered) => {
       if (registered) a.lmsProviders = withChannel(a.lmsProviders);
-      a.cards.push(`ConnectYour LMSPublish Cogniate courses to ${registered ? NEW.name : 'Sakai'} with LTI 1.3.`);
+      a.cards = [
+        { channel: null, text: a.cards[0], loading: false },
+        { channel: 'moodle', text: a.cards[1], loading: false },
+        { channel: 'canvas', text: a.cards[2], loading: false },
+        { channel: 'blackboard', text: a.cards[3], loading: false },
+        {
+          channel: registered ? NEW.id : 'zz-unregistered',
+          text: `Connect${registered ? NEW.name : 'Sakai'}Publish Cogniate courses to ${registered ? NEW.name : 'Sakai LMS'} with LTI 1.3.`,
+          loading: false,
+        },
+      ];
     },
   },
   {
@@ -94,10 +281,20 @@ const rows = [
   profileRow(8, 'tests/acceptance/M1/common/90-simulation-gates.test.ts M1-35.common.<profile>-<simulation>', defaults, BASELINE_REAL_PROFILES, true),
 ];
 
-test('the probe card texts equal tests/e2e/M2/lib/m2.ts TEXT', () => {
-  const source = fs.readFileSync(path.join(testsDir, 'e2e/M2/lib/m2.ts'), 'utf8');
-  for (const [key, text] of [['moodleCard', CARD_TEXTS[0]], ['canvasCard', CARD_TEXTS[1]], ['blackboardCard', CARD_TEXTS[2]]]) {
-    assert.ok(source.includes(`${key}: ${JSON.stringify(text).replaceAll('"', "'")}`), key);
+test('the probe card texts equal tests/e2e/M2/lib/m2.ts TEXT, and open-world copies match when present', () => {
+  const m2Path = path.join(testsDir, 'e2e/M2/lib/m2.ts');
+  if (fs.existsSync(m2Path)) {
+    const source = fs.readFileSync(m2Path, 'utf8');
+    for (const [key, text] of [['moodleCard', CARD_TEXTS[0]], ['canvasCard', CARD_TEXTS[1]], ['blackboardCard', CARD_TEXTS[2]]]) {
+      assert.ok(source.includes(`${key}: ${JSON.stringify(text).replaceAll('"', "'")}`), key);
+    }
+  }
+  if (fs.existsSync(acceptanceOpenWorldPath)) {
+    assert.equal(
+      fs.readFileSync(acceptanceOpenWorldPath, 'utf8'),
+      fs.readFileSync(ltiaasOpenWorldPath, 'utf8'),
+      'tests/acceptance/lib/open-world.mjs and tests/ltiaas/lib/open-world.mjs are identical',
+    );
   }
 });
 
@@ -146,3 +343,436 @@ test('row 6: the G-BASE Kajabi card is allowed, but not twice', () => {
   answer.push(answer[0]);
   assert.throws(() => checkCards(answer, CARD_TEXTS, { names: [] }), assert.AssertionError);
 });
+
+test('row 6 G-BASE unattributed parity vs BD-A1-119 attributed branch: baseline page without data-channel-id passes with the 3 baseline cards and fails with an extra card; attributed page follows BD-A1-119', () => {
+  // Branch 1: unattributed baseline page (1b17261 / G-BASE parity — no card has data-channel-id).
+  const unattributedSpecsWithKajabi = BASELINE_DOM_SPECS.map((s) => ({ ...s, channelId: null }));
+  const unattributedThreeBaselineSpecs = unattributedSpecsWithKajabi.slice(1);
+  const unattributedThreeDom = extractDomCards(unattributedThreeBaselineSpecs);
+  const unattributedFourDom = extractDomCards(unattributedSpecsWithKajabi);
+
+  assert.ok(unattributedThreeDom.every((c) => c.channel === null));
+  assert.ok(unattributedFourDom.every((c) => c.channel === null));
+
+  // Unattributed baseline page passes with the 3 baseline cards (and with the G-BASE static Kajabi card).
+  assert.deepEqual(checkCards(unattributedThreeDom, CARD_TEXTS, { names: [] }), []);
+  assert.equal(checkCards(unattributedFourDom, CARD_TEXTS, { names: [] }).length, 1);
+
+  // Unattributed baseline page fails with any extra card (whether registered in lms-providers or not).
+  const extraUnattributedSpec = {
+    channelId: null,
+    initials: 'LTI',
+    control: 'connect-link',
+    heading: 'LTI 1.3',
+    description: 'Publish Cogniate courses to any LMS that supports LTI 1.3 Advantage.',
+  };
+  assert.throws(
+    () => checkCards(extractDomCards([...unattributedThreeBaselineSpecs, extraUnattributedSpec]), CARD_TEXTS, { names: [] }),
+    assert.AssertionError,
+  );
+  assert.throws(
+    () => checkCards(extractDomCards([...unattributedThreeBaselineSpecs, extraUnattributedSpec]), CARD_TEXTS, { names: ['lti-generic'] }),
+    assert.AssertionError,
+  );
+  assert.throws(
+    () => checkCards(extractDomCards([...unattributedSpecsWithKajabi, extraUnattributedSpec]), CARD_TEXTS, { names: [] }),
+    assert.AssertionError,
+  );
+  assert.throws(
+    () => checkCards(unattributedThreeDom, CARD_TEXTS, { names: ['lti-generic'] }),
+    assert.AssertionError,
+  );
+
+  // Branch 2: attributed page (a8bbac53 / BD-A1-119 — cards carry article[data-channel-id]).
+  const attributedThreeDom = extractDomCards(BASELINE_DOM_SPECS.slice(1));
+  const attributedFourDom = extractDomCards(BASELINE_DOM_SPECS);
+  assert.deepEqual(checkCards(attributedThreeDom, CARD_TEXTS, { names: [] }), []);
+  assert.equal(checkCards(attributedFourDom, CARD_TEXTS, { names: [] }).length, 1);
+
+  const genericDomSpec = {
+    channelId: 'lti-generic',
+    initials: 'LTI',
+    control: 'connect-link',
+    heading: 'LTI 1.3',
+    description: 'Publish Cogniate courses to any LMS that supports LTI 1.3 Advantage.',
+  };
+  assert.equal(
+    checkCards(extractDomCards([...BASELINE_DOM_SPECS, genericDomSpec]), CARD_TEXTS, { names: ['lti-generic'] }).length,
+    2,
+  );
+  assert.throws(
+    () => checkCards(extractDomCards([...BASELINE_DOM_SPECS, genericDomSpec]), CARD_TEXTS, { names: [] }),
+    assert.AssertionError,
+  );
+});
+
+test('row 6 BD-A1-119 DOM oracle (A-LA-E0-04-01 / B-LA-E0-04-01 / A-LA-E0-04-05 / B-LA-E0-04-03): unregistered Sakai and Campus Cloud cards fail in every state', () => {
+  const providers = withChannel(
+    withChannel(acceptance.lmsProviders, 'lti-generic', 'LMS', 'Other LTI 1.3 platform'),
+    'campus',
+    'Campus',
+    'Campus LMS',
+  );
+  const names = extraChannelNames(providers);
+  assert.deepEqual(names, ['lti-generic', 'campus']);
+
+  const genericDomSpec = {
+    channelId: 'lti-generic',
+    initials: 'LTI',
+    control: 'connect-link',
+    heading: 'LTI 1.3',
+    description: 'Publish Cogniate courses to any LMS that supports LTI 1.3 Advantage.',
+  };
+  const campusDomSpec = {
+    channelId: 'campus',
+    initials: 'Cp',
+    control: 'disabled-connect',
+    heading: 'Campus Learning',
+    description: 'Publish Cogniate courses to Campus LMS with LTI 1.3.',
+    notice: 'Campus is not set up for this Cogniate service yet. Ask your Cogniate operator.',
+  };
+
+  const validGrid = extractDomCards([...BASELINE_DOM_SPECS, genericDomSpec, campusDomSpec]);
+  assert.equal(checkCards(validGrid, CARD_TEXTS, { names }).length, 3);
+
+  const unregisteredDomSpecs = [
+    // Reviewer-A Round 1 (A-LA-E0-04-01): Sakai card mentioning "LMS" without data-channel-id or with sakai id.
+    {
+      channelId: null,
+      initials: 'Sk',
+      control: 'connect-link',
+      heading: 'Sakai',
+      description: 'Publish Cogniate courses to Sakai LMS with LTI 1.3.',
+    },
+    {
+      channelId: 'sakai',
+      initials: 'Sk',
+      control: 'connect-link',
+      heading: 'Sakai',
+      description: 'Publish Cogniate courses to Sakai LMS with LTI 1.3.',
+    },
+    // Reviewer-B Round 1 (B-LA-E0-04-01): Sakai LMS heading without data-channel-id or with sakai id.
+    {
+      channelId: null,
+      initials: 'Sk',
+      control: 'connect-link',
+      heading: 'Sakai LMS',
+      description: 'Publish Cogniate courses to Sakai with LTI 1.3.',
+    },
+    // Reviewer-A Round 3 (A-LA-E0-04-05 item 1): disabled Sakai card with generic "LMS is not set up..." notice.
+    {
+      channelId: null,
+      initials: 'Sk',
+      control: 'disabled-connect',
+      heading: 'Sakai Learning',
+      description: 'Publish Cogniate courses to Sakai LMS with LTI 1.3.',
+      notice: 'LMS is not set up for this Cogniate service yet. Ask your Cogniate operator.',
+    },
+    // Disabled Sakai card copying registered Campus notice or using display name as data-channel-id.
+    {
+      channelId: null,
+      initials: 'Sk',
+      control: 'disabled-connect',
+      heading: 'Sakai Learning',
+      description: 'Publish Cogniate courses to Sakai LMS with LTI 1.3.',
+      notice: 'Campus is not set up for this Cogniate service yet. Ask your Cogniate operator.',
+    },
+    {
+      channelId: 'LMS',
+      initials: 'Sk',
+      control: 'disabled-connect',
+      heading: 'Sakai Learning',
+      description: 'Publish Cogniate courses to Sakai LMS with LTI 1.3.',
+      notice: 'LMS is not set up for this Cogniate service yet. Ask your Cogniate operator.',
+    },
+    // Reviewer-B Round 3 (B-LA-E0-04-03): unregistered disabled "Campus Cloud" lookalike card (no attribute, unknown id, or display name).
+    {
+      channelId: null,
+      initials: 'Cc',
+      control: 'disabled-connect',
+      heading: 'Campus Cloud',
+      description: 'Publish courses to your platform.',
+      notice: 'Ask your operator to enable Campus Cloud.',
+    },
+    {
+      channelId: 'campus-cloud',
+      initials: 'Cc',
+      control: 'disabled-connect',
+      heading: 'Campus Cloud',
+      description: 'Publish courses to your platform.',
+      notice: 'Ask your operator to enable Campus Cloud.',
+    },
+    {
+      channelId: 'Campus',
+      initials: 'Cc',
+      control: 'disabled-connect',
+      heading: 'Campus Cloud',
+      description: 'Publish courses to your platform.',
+      notice: 'Ask your operator to enable Campus Cloud.',
+    },
+    {
+      channelId: 'Campus LMS',
+      initials: 'Cc',
+      control: 'disabled-connect',
+      heading: 'Campus Cloud',
+      description: 'Publish courses to your platform.',
+      notice: 'Ask your operator to enable Campus Cloud.',
+    },
+    // Duplicate registered data-channel-id on a second card.
+    {
+      channelId: 'campus',
+      initials: 'Cc',
+      control: 'disabled-connect',
+      heading: 'Campus Cloud',
+      description: 'Publish courses to your platform.',
+      notice: 'Ask your operator to enable Campus Cloud.',
+    },
+  ];
+
+  for (const badSpec of unregisteredDomSpecs) {
+    const withBad = extractDomCards([...BASELINE_DOM_SPECS, genericDomSpec, campusDomSpec, badSpec]);
+    assert.throws(() => checkCards(withBad, CARD_TEXTS, { names }), assert.AssertionError);
+  }
+});
+
+test('row 6 BD-A1-119 DOM oracle (A-LA-E0-04-05 / B-LA-E0-04-02): registered card with custom title and custom not-ready text passes', () => {
+  const providers = withChannel(
+    withChannel(acceptance.lmsProviders, 'lti-generic', 'LMS', 'Other LTI 1.3 platform'),
+    'campus',
+    'Campus',
+    'Campus LMS',
+  );
+  const names = extraChannelNames(providers);
+  assert.deepEqual(names, ['lti-generic', 'campus']);
+
+  const genericDomSpec = {
+    channelId: 'lti-generic',
+    initials: 'LTI',
+    control: 'connect-link',
+    heading: 'LTI 1.3',
+    description: 'Publish Cogniate courses to any LMS that supports LTI 1.3 Advantage.',
+  };
+
+  // Reviewer-A Round 3 (A-LA-E0-04-05 item 2): card.title 'Teaching Hub', custom description, custom texts.notReady.
+  const customNotReadyA = {
+    channelId: 'campus',
+    initials: 'Th',
+    control: 'disabled-connect',
+    heading: 'Teaching Hub',
+    description: 'Publish your courses to Campus.',
+    notice: 'Campus is unavailable until your operator completes setup.',
+  };
+  // Reviewer-B Round 3 (B-LA-E0-04-02): card.title 'Teaching Hub', custom description, custom texts.notReady.
+  const customNotReadyB = {
+    channelId: 'campus',
+    initials: 'Th',
+    control: 'disabled-connect',
+    heading: 'Teaching Hub',
+    description: 'Publish courses to your platform.',
+    notice: 'Ask your operator to enable Campus.',
+  };
+  // Ready and connected states with custom title 'Teaching Hub'.
+  const customReady = {
+    channelId: 'campus',
+    initials: 'Th',
+    control: 'connect-link',
+    heading: 'Teaching Hub',
+    description: 'Publish your courses to Campus.',
+  };
+  const customConnected = {
+    channelId: 'campus',
+    initials: 'Th',
+    control: 'manage-link',
+    heading: 'Teaching Hub',
+    description: 'Publish your courses to Campus.',
+  };
+
+  for (const campusSpec of [customNotReadyA, customNotReadyB, customReady, customConnected]) {
+    const domCards = extractDomCards([...BASELINE_DOM_SPECS, genericDomSpec, campusSpec]);
+    assert.equal(checkCards(domCards, CARD_TEXTS, { names }).length, 3);
+  }
+});
+
+test('row 6 loading state (A-LA-E0-04-03 / BD-A1-119): delayed connections settle and pass; permanently unresolved loading fails', async () => {
+  const names = extraChannelNames(withChannel(acceptance.lmsProviders, 'lti-generic', 'LMS', 'Other LTI 1.3 platform'));
+  assert.deepEqual(names, ['lti-generic']);
+
+  const loadingDomCards = extractDomCards([
+    ...BASELINE_DOM_SPECS,
+    {
+      channelId: 'lti-generic',
+      initials: 'LTI',
+      control: 'loading',
+      heading: 'LTI 1.3',
+      description: 'Publish Cogniate courses to any LMS that supports LTI 1.3 Advantage.',
+    },
+  ]);
+  const settledDomCards = extractDomCards([
+    ...BASELINE_DOM_SPECS,
+    {
+      channelId: 'lti-generic',
+      initials: 'LTI',
+      control: 'connect-link',
+      heading: 'LTI 1.3',
+      description: 'Publish Cogniate courses to any LMS that supports LTI 1.3 Advantage.',
+    },
+  ]);
+
+  assert.equal(loadingDomCards.at(-1).channel, 'lti-generic');
+  assert.equal(loadingDomCards.at(-1).loading, true);
+  assert.equal(settledDomCards.at(-1).channel, 'lti-generic');
+  assert.equal(settledDomCards.at(-1).loading, false);
+
+  // Unsettled loading cards (with or without explicit loading: true) are rejected by checkCards.
+  assert.throws(() => checkCards(loadingDomCards, CARD_TEXTS, { names }), assert.AssertionError);
+  assert.throws(
+    () => checkCards(loadingDomCards.map(({ loading, ...rest }) => rest), CARD_TEXTS, { names }),
+    assert.AssertionError,
+  );
+
+  // Delayed connections load: polling waits while loading is true, then passes once settled.
+  let polls = 0;
+  const readDelayed = () => {
+    polls += 1;
+    return polls < 3 ? loadingDomCards : settledDomCards;
+  };
+  const waitUntilSettled = async (readFn, maxAttempts = 5) => {
+    for (let i = 0; i < maxAttempts; i++) {
+      const current = readFn();
+      if (current.length > 0 && current.every((c) => !c.loading)) return current;
+    }
+    throw new assert.AssertionError({ message: 'LMS Publishing cards finished loading' });
+  };
+  const settled = await waitUntilSettled(readDelayed, 5);
+  assert.equal(polls, 3);
+  assert.equal(checkCards(settled, CARD_TEXTS, { names }).length, 2);
+
+  // Permanently unresolved connections load: never settles within the poll bound and fails.
+  await assert.rejects(() => waitUntilSettled(() => loadingDomCards, 5), assert.AssertionError);
+});
+
+test('row 6 BD-A1-119 DOM oracle: unknown data-channel-id and missing registered card fail', () => {
+  const providers = withChannel(
+    withChannel(acceptance.lmsProviders, 'lti-generic', 'LMS', 'Other LTI 1.3 platform'),
+    'campus',
+    'Campus',
+    'Campus LMS',
+  );
+  const names = extraChannelNames(providers);
+  assert.deepEqual(names, ['lti-generic', 'campus']);
+
+  const genericDomSpec = {
+    channelId: 'lti-generic',
+    initials: 'LTI',
+    control: 'connect-link',
+    heading: 'LTI 1.3',
+    description: 'Publish Cogniate courses to any LMS that supports LTI 1.3 Advantage.',
+  };
+  const campusDomSpec = {
+    channelId: 'campus',
+    initials: 'Cp',
+    control: 'connect-link',
+    heading: 'Campus',
+    description: 'Publish Cogniate courses to Campus LMS with LTI 1.3.',
+  };
+
+  // 1. Missing registered card: campus is in GET /app-api/lms-providers, but its card is absent from the DOM.
+  const missingCampusDom = extractDomCards([...BASELINE_DOM_SPECS, genericDomSpec]);
+  assert.throws(() => checkCards(missingCampusDom, CARD_TEXTS, { names }), assert.AssertionError);
+
+  // Missing both extra registered cards when lti-generic is registered.
+  const onlyBaselineDom = extractDomCards(BASELINE_DOM_SPECS);
+  assert.throws(() => checkCards(onlyBaselineDom, CARD_TEXTS, { names: ['lti-generic'] }), assert.AssertionError);
+
+  // 2. Unknown data-channel-id on a channel card fails (replacing campus or added alongside).
+  for (const unknownId of ['unknown-lms', 'sakai', 'campus-cloud', 'LMS', 'Campus', '']) {
+    const unknownSpec = { ...campusDomSpec, channelId: unknownId };
+    const replacedDom = extractDomCards([...BASELINE_DOM_SPECS, genericDomSpec, unknownSpec]);
+    assert.throws(() => checkCards(replacedDom, CARD_TEXTS, { names }), assert.AssertionError);
+    const addedDom = extractDomCards([...BASELINE_DOM_SPECS, genericDomSpec, campusDomSpec, unknownSpec]);
+    assert.throws(() => checkCards(addedDom, CARD_TEXTS, { names }), assert.AssertionError);
+  }
+
+  // 3. Static Kajabi card carrying a data-channel-id attribute fails (BD-A1-119: static cards have no attribute).
+  const kajabiWithAttrSpecs = BASELINE_DOM_SPECS.map((s, i) => (i === 0 ? { ...s, channelId: 'kajabi' } : s));
+  assert.throws(
+    () => checkCards(extractDomCards([...kajabiWithAttrSpecs, genericDomSpec, campusDomSpec]), CARD_TEXTS, { names }),
+    assert.AssertionError,
+  );
+
+  // 4. Baseline card missing data-channel-id or carrying a mismatched data-channel-id fails.
+  const moodleWithoutAttrSpecs = BASELINE_DOM_SPECS.map((s, i) => (i === 1 ? { ...s, channelId: null } : s));
+  assert.throws(
+    () => checkCards(extractDomCards([...moodleWithoutAttrSpecs, genericDomSpec, campusDomSpec]), CARD_TEXTS, { names }),
+    assert.AssertionError,
+  );
+  const moodleWrongAttrSpecs = BASELINE_DOM_SPECS.map((s, i) => (i === 1 ? { ...s, channelId: 'moodle-other' } : s));
+  assert.throws(
+    () => checkCards(extractDomCards([...moodleWrongAttrSpecs, genericDomSpec, campusDomSpec]), CARD_TEXTS, { names }),
+    assert.AssertionError,
+  );
+});
+
+test('M1-41.common.j-snapshot migration ledger (A-LA-E0-04-02 / LD-24): old ledger is a prefix of upgraded ledger and matches candidate migrations', () => {
+  const oldLedger = {
+    'lti-service/lti.db': ['001_init.sql', '005_lti_grants.sql'],
+    'cogniate-app/cogniate.db': ['001_init.sql', '011_lms_types.sql'],
+  };
+  const expectedLtiLedger = ['001_init.sql', '005_lti_grants.sql', '006_lti_provider_selection.sql', '007_lti_channel_columns.sql'];
+  const expectedAppLedger = [
+    '001_init.sql',
+    '011_lms_types.sql',
+    '012_connection_provider_snapshot.sql',
+    '013_connection_channel_columns.sql',
+  ];
+  const newLedger = {
+    'lti-service/lti.db': [...expectedLtiLedger],
+    'cogniate-app/cogniate.db': [...expectedAppLedger],
+  };
+  checkMigrationLedgers(oldLedger, newLedger, { expectedLtiLedger, expectedAppLedger });
+
+  // Missing historical entry in lti.db or cogniate.db fails even if also removed from expected*Ledger.
+  const droppedLti = expectedLtiLedger.slice(1);
+  assert.throws(
+    () =>
+      checkMigrationLedgers(
+        oldLedger,
+        { 'lti-service/lti.db': droppedLti, 'cogniate-app/cogniate.db': expectedAppLedger },
+        { expectedLtiLedger: droppedLti, expectedAppLedger },
+      ),
+    assert.AssertionError,
+  );
+  const droppedApp = expectedAppLedger.filter((m) => m !== '011_lms_types.sql');
+  assert.throws(
+    () =>
+      checkMigrationLedgers(
+        oldLedger,
+        { 'lti-service/lti.db': expectedLtiLedger, 'cogniate-app/cogniate.db': droppedApp },
+        { expectedLtiLedger, expectedAppLedger: droppedApp },
+      ),
+    assert.AssertionError,
+  );
+
+  // Reordered historical prefix fails even if expected*Ledger matches newLedger.
+  const reorderedLti = ['005_lti_grants.sql', '001_init.sql', '006_lti_provider_selection.sql', '007_lti_channel_columns.sql'];
+  assert.throws(
+    () =>
+      checkMigrationLedgers(
+        oldLedger,
+        { 'lti-service/lti.db': reorderedLti, 'cogniate-app/cogniate.db': expectedAppLedger },
+        { expectedLtiLedger: reorderedLti, expectedAppLedger },
+      ),
+    assert.AssertionError,
+  );
+
+  // Unapplied candidate migration file fails exact comparison.
+  assert.throws(
+    () =>
+      checkMigrationLedgers(
+        oldLedger,
+        { 'lti-service/lti.db': expectedLtiLedger.slice(0, -1), 'cogniate-app/cogniate.db': expectedAppLedger },
+        { expectedLtiLedger, expectedAppLedger },
+      ),
+    assert.AssertionError,
+  );
+});
diff --git a/tests/ltiaas/k0/ld1/open-world.test.ts b/tests/ltiaas/k0/ld1/open-world.test.ts
index e54741b2..aed9af8e 100644
--- a/tests/ltiaas/k0/ld1/open-world.test.ts
+++ b/tests/ltiaas/k0/ld1/open-world.test.ts
@@ -7,6 +7,7 @@ import path from 'node:path';
 import { fileURLToPath, pathToFileURL } from 'node:url';
 import { test } from 'vitest';
 import * as ltiaasOpenWorld from '../../lib/open-world.mjs';
+import type { CardDescriptor } from '../../lib/open-world.mjs';
 
 const here = path.dirname(fileURLToPath(import.meta.url));
 const testsDir = path.resolve(here, '../../..');
@@ -23,6 +24,7 @@ const {
   BASELINE_SIMULATION_PROFILES,
   checkCards,
   checkLmsEntries,
+  checkMigrationLedgers,
   checkProfiles,
   checkSimulationProfiles,
   extraChannelNames,
@@ -42,9 +44,9 @@ const CARD_TEXTS = [
 
 // A new channel as LA adds it (app API delta §1-§2, LTI delta §4.7), and one that no registry knows.
 const NEW = { id: 'lti-generic', name: 'LMS' };
-const withChannel = (lmsProviders: Json, id = NEW.id, name = NEW.name): Json => {
+const withChannel = (lmsProviders: Json, id = NEW.id, name = NEW.name, label = name): Json => {
   const next = copy(lmsProviders);
-  next.lms.push({ lms: id, channel: id, channelName: name, label: name, methods: ['dynamic', 'manual'], profiles: [] });
+  next.lms.push({ lms: id, channel: id, channelName: name, label, methods: ['dynamic', 'manual'], profiles: [] });
   return next;
 };
 const newProfile = (channel: string, { id = channel, simulation = false }: { id?: string; simulation?: boolean } = {}): Json => ({
@@ -63,6 +65,218 @@ const newProfile = (channel: string, { id = channel, simulation = false }: { id?
   sharedPlatform: null,
 });
 
+/**
+ * Minimal DOM tree builder so K0 probes execute the exact `page.evaluate` extractor from `tests/e2e/M2/01-cards.m2.ts`
+ * without a browser or external DOM package.
+ */
+class MiniElement {
+  tagName: string;
+  attrs: Map<string, string>;
+  children: MiniElement[];
+  parentElement: MiniElement | null;
+  _ownText: string;
+  _display: string;
+  _height: number;
+
+  constructor(
+    tagName: string,
+    attrs: Record<string, string | null | undefined> = {},
+    children: MiniElement[] = [],
+    text = '',
+    { display = 'block', height = 120 }: { display?: string; height?: number } = {},
+  ) {
+    this.tagName = tagName.toUpperCase();
+    this.attrs = new Map(
+      Object.entries(attrs)
+        .filter(([, v]) => v !== undefined && v !== null)
+        .map(([k, v]) => [k, String(v)]),
+    );
+    this.children = [];
+    this.parentElement = null;
+    this._ownText = text;
+    this._display = display;
+    this._height = height;
+    for (const child of children) this.appendChild(child);
+  }
+  appendChild(child: MiniElement): MiniElement {
+    child.parentElement = this;
+    this.children.push(child);
+    return child;
+  }
+  get textContent(): string {
+    return this._ownText + this.children.map((c) => c.textContent).join('');
+  }
+  getAttribute(name: string): string | null {
+    return this.attrs.has(name) ? (this.attrs.get(name) ?? null) : null;
+  }
+  hasAttribute(name: string): boolean {
+    return this.attrs.has(name);
+  }
+  getBoundingClientRect(): { height: number; width: number; top: number; left: number; right: number; bottom: number } {
+    return { height: this._height, width: 240, top: 0, left: 0, right: 240, bottom: this._height };
+  }
+  matches(selector: string): boolean {
+    return selector.split(',').some((part) => {
+      const s = part.trim();
+      if (!s) return false;
+      if (s === '*') return true;
+      const m = /^([a-zA-Z0-9_-]+)?(?:\[([a-zA-Z0-9_-]+)(?:="([^"]*)")?\])?$/.exec(s);
+      if (!m) return false;
+      const [, tag, attr, val] = m;
+      if (tag && this.tagName !== tag.toUpperCase()) return false;
+      if (attr) {
+        if (!this.hasAttribute(attr)) return false;
+        if (val !== undefined && this.getAttribute(attr) !== val) return false;
+      }
+      return true;
+    });
+  }
+  querySelectorAll(selector: string): MiniElement[] {
+    const out: MiniElement[] = [];
+    const walk = (node: MiniElement): void => {
+      for (const child of node.children) {
+        if (child === this && selector === 'body *') continue;
+        if (selector === 'body *' || child.matches(selector)) out.push(child);
+        walk(child);
+      }
+    };
+    if (selector === 'body *' && this.tagName === 'DOCUMENT') {
+      const body = this.children.find((c) => c.tagName === 'BODY');
+      if (body) walk(body);
+      return out;
+    }
+    walk(this);
+    return out;
+  }
+  querySelector(selector: string): MiniElement | null {
+    return this.querySelectorAll(selector)[0] ?? null;
+  }
+}
+
+interface CardDomSpec {
+  tag?: string;
+  channelId: string | null;
+  initials?: string;
+  control?: 'connect-link' | 'manage-link' | 'disabled-connect' | 'loading';
+  heading: string;
+  description: string;
+  notice?: string | null;
+  display?: string;
+  height?: number;
+}
+
+const buildCardElement = ({
+  tag = 'article',
+  channelId = null,
+  initials = '',
+  control = 'connect-link',
+  heading,
+  description,
+  notice = null,
+  display = 'block',
+  height = 120,
+}: CardDomSpec): MiniElement => {
+  const children: MiniElement[] = [];
+  if (initials) children.push(new MiniElement('span', {}, [], initials));
+  if (control === 'connect-link') {
+    const href = channelId ? `/integrations/${channelId}/connect` : '/integrations/connect';
+    children.push(new MiniElement('a', { href, ...(channelId ? { id: `${channelId}-connect` } : {}) }, [], 'Connect'));
+  } else if (control === 'manage-link') {
+    const href = channelId ? `/integrations/${channelId}/con_1` : '/integrations/con_1';
+    children.push(new MiniElement('a', { href, ...(channelId ? { id: `${channelId}-manage` } : {}) }, [], 'Manage'));
+  } else if (control === 'disabled-connect') {
+    children.push(new MiniElement('button', { disabled: 'true' }, [], 'Connect'));
+  } else if (control === 'loading') {
+    children.push(new MiniElement('span', {}, [], 'Loading…'));
+  }
+  children.push(new MiniElement('h2', {}, [], heading));
+  children.push(new MiniElement('p', {}, [], description));
+  if (notice) children.push(new MiniElement('p', {}, [], notice));
+  const attrs: Record<string, string> = channelId !== null && channelId !== undefined ? { 'data-channel-id': channelId } : {};
+  return new MiniElement(tag, attrs, children, '', { display, height });
+};
+
+const BASELINE_DOM_SPECS: CardDomSpec[] = [
+  {
+    channelId: null,
+    initials: 'K',
+    control: 'disabled-connect',
+    heading: 'Kajabi',
+    description: 'Publish and sell your courses directly on Kajabi with seamless content sync.',
+  },
+  {
+    channelId: 'moodle',
+    initials: '',
+    control: 'connect-link',
+    heading: 'Moodle',
+    description: CARD_TEXTS[0],
+  },
+  {
+    channelId: 'canvas',
+    initials: 'Cv',
+    control: 'connect-link',
+    heading: 'Canvas',
+    description: CARD_TEXTS[1],
+  },
+  {
+    channelId: 'blackboard',
+    initials: 'Bb',
+    control: 'disabled-connect',
+    heading: 'Blackboard',
+    description: CARD_TEXTS[2],
+    notice: 'Blackboard is not set up for this Cogniate service yet. Ask your Cogniate operator.',
+  },
+];
+
+type EvaluateFn = (
+  document: MiniElement,
+  getComputedStyle: (el: MiniElement) => { display: string },
+  moodleText: string,
+) => CardDescriptor[];
+
+const referenceEvaluateCards: EvaluateFn = (document, getComputedStyle, moodleText) => {
+  const all = Array.from(document.querySelectorAll('body *'));
+  let cell = all.find((el) => el.children.length === 0 && (el.textContent ?? '').includes(moodleText)) ?? null;
+  while (cell && cell.parentElement && getComputedStyle(cell.parentElement).display !== 'grid') cell = cell.parentElement;
+  if (!cell || !cell.parentElement) return [];
+  return Array.from(cell.parentElement.children)
+    .filter((c) => getComputedStyle(c).display !== 'none' && c.getBoundingClientRect().height > 0)
+    .map((c) => {
+      const text = (c.textContent ?? '').replace(/\s+/g, ' ').trim();
+      const article = c.matches('article[data-channel-id]') ? c : c.querySelector('article[data-channel-id]');
+      const channel = article ? article.getAttribute('data-channel-id') : null;
+      const controls = Array.from(c.querySelectorAll('a, button, [role="button"], [role="link"]')).filter((el) =>
+        /^(?:Connect|Manage)$/i.test((el.textContent ?? '').replace(/\s+/g, ' ').trim()),
+      );
+      const hasLoadingLeaf = Array.from(c.querySelectorAll('*')).some(
+        (el) => el.children.length === 0 && /^Loading(?:…|\.\.\.)$/i.test((el.textContent ?? '').replace(/\s+/g, ' ').trim()),
+      );
+      const loading = controls.length === 0 || hasLoadingLeaf || /^(?:[A-Za-z0-9]{1,4}\s*)?Loading(?:…|\.\.\.)/.test(text);
+      return { text, channel, loading };
+    });
+};
+
+const loadM2EvaluateFn = (): EvaluateFn => {
+  const m2CardsPath = path.join(testsDir, 'e2e/M2/01-cards.m2.ts');
+  if (!fs.existsSync(m2CardsPath)) return referenceEvaluateCards;
+  const src = fs.readFileSync(m2CardsPath, 'utf8');
+  const m = /page\.evaluate\(\(moodleText\)\s*=>\s*\{([\s\S]*?)\},\s*TEXT\.moodleCard\)/.exec(src);
+  assert.ok(m, '01-cards.m2.ts defines page.evaluate((moodleText) => { ... }, TEXT.moodleCard)');
+  return new Function('document', 'getComputedStyle', 'moodleText', m[1]) as EvaluateFn;
+};
+
+const evaluateM2Cards = loadM2EvaluateFn();
+
+const extractDomCards = (cardSpecs: CardDomSpec[]): CardDescriptor[] => {
+  const grid = new MiniElement('div', {}, cardSpecs.map(buildCardElement), '', { display: 'grid', height: 600 });
+  const body = new MiniElement('body', {}, [grid], '', { display: 'block', height: 800 });
+  const doc = new MiniElement('document', {}, [body], '', { display: 'block', height: 800 });
+  const getComputedStyle = (el: MiniElement) => ({ display: el._display ?? 'block' });
+  const res = evaluateM2Cards(doc, getComputedStyle, CARD_TEXTS[0]);
+  assert.deepEqual(res, referenceEvaluateCards(doc, getComputedStyle, CARD_TEXTS[0]));
+  return res;
+};
+
 interface ProbeRow {
   row: number;
   site: string;
@@ -155,7 +369,17 @@ const rows: ProbeRow[] = [
     },
     extra: (a, registered) => {
       if (registered) a.lmsProviders = withChannel(a.lmsProviders);
-      a.cards.push(`ConnectYour LMSPublish Cogniate courses to ${registered ? NEW.name : 'Sakai'} with LTI 1.3.`);
+      a.cards = [
+        { channel: null, text: a.cards[0], loading: false },
+        { channel: 'moodle', text: a.cards[1], loading: false },
+        { channel: 'canvas', text: a.cards[2], loading: false },
+        { channel: 'blackboard', text: a.cards[3], loading: false },
+        {
+          channel: registered ? NEW.id : 'zz-unregistered',
+          text: `Connect${registered ? NEW.name : 'Sakai'}Publish Cogniate courses to ${registered ? NEW.name : 'Sakai LMS'} with LTI 1.3.`,
+          loading: false,
+        },
+      ];
     },
   },
   {
@@ -184,13 +408,16 @@ const rows: ProbeRow[] = [
 ];
 
 test('the probe card texts equal tests/e2e/M2/lib/m2.ts TEXT, and open-world copies match when present', () => {
-  const source = fs.readFileSync(path.join(testsDir, 'e2e/M2/lib/m2.ts'), 'utf8');
-  for (const [key, text] of [
-    ['moodleCard', CARD_TEXTS[0]],
-    ['canvasCard', CARD_TEXTS[1]],
-    ['blackboardCard', CARD_TEXTS[2]],
-  ] as const) {
-    assert.ok(source.includes(`${key}: ${JSON.stringify(text).replaceAll('"', "'")}`), key);
+  const m2Path = path.join(testsDir, 'e2e/M2/lib/m2.ts');
+  if (fs.existsSync(m2Path)) {
+    const source = fs.readFileSync(m2Path, 'utf8');
+    for (const [key, text] of [
+      ['moodleCard', CARD_TEXTS[0]],
+      ['canvasCard', CARD_TEXTS[1]],
+      ['blackboardCard', CARD_TEXTS[2]],
+    ] as const) {
+      assert.ok(source.includes(`${key}: ${JSON.stringify(text).replaceAll('"', "'")}`), key);
+    }
   }
   if (fs.existsSync(acceptanceOpenWorldPath)) {
     assert.equal(
@@ -259,3 +486,436 @@ test('row 6: the G-BASE Kajabi card is allowed, but not twice', () => {
   answer.push(answer[0]);
   assert.throws(() => checkCards(answer, CARD_TEXTS, { names: [] }), assert.AssertionError);
 });
+
+test('row 6 G-BASE unattributed parity vs BD-A1-119 attributed branch: baseline page without data-channel-id passes with the 3 baseline cards and fails with an extra card; attributed page follows BD-A1-119', () => {
+  // Branch 1: unattributed baseline page (1b17261 / G-BASE parity — no card has data-channel-id).
+  const unattributedSpecsWithKajabi: CardDomSpec[] = BASELINE_DOM_SPECS.map((s) => ({ ...s, channelId: null }));
+  const unattributedThreeBaselineSpecs: CardDomSpec[] = unattributedSpecsWithKajabi.slice(1);
+  const unattributedThreeDom = extractDomCards(unattributedThreeBaselineSpecs);
+  const unattributedFourDom = extractDomCards(unattributedSpecsWithKajabi);
+
+  assert.ok(unattributedThreeDom.every((c) => c.channel === null));
+  assert.ok(unattributedFourDom.every((c) => c.channel === null));
+
+  // Unattributed baseline page passes with the 3 baseline cards (and with the G-BASE static Kajabi card).
+  assert.deepEqual(checkCards(unattributedThreeDom, CARD_TEXTS, { names: [] }), []);
+  assert.equal(checkCards(unattributedFourDom, CARD_TEXTS, { names: [] }).length, 1);
+
+  // Unattributed baseline page fails with any extra card (whether registered in lms-providers or not).
+  const extraUnattributedSpec: CardDomSpec = {
+    channelId: null,
+    initials: 'LTI',
+    control: 'connect-link',
+    heading: 'LTI 1.3',
+    description: 'Publish Cogniate courses to any LMS that supports LTI 1.3 Advantage.',
+  };
+  assert.throws(
+    () => checkCards(extractDomCards([...unattributedThreeBaselineSpecs, extraUnattributedSpec]), CARD_TEXTS, { names: [] }),
+    assert.AssertionError,
+  );
+  assert.throws(
+    () => checkCards(extractDomCards([...unattributedThreeBaselineSpecs, extraUnattributedSpec]), CARD_TEXTS, { names: ['lti-generic'] }),
+    assert.AssertionError,
+  );
+  assert.throws(
+    () => checkCards(extractDomCards([...unattributedSpecsWithKajabi, extraUnattributedSpec]), CARD_TEXTS, { names: [] }),
+    assert.AssertionError,
+  );
+  assert.throws(
+    () => checkCards(unattributedThreeDom, CARD_TEXTS, { names: ['lti-generic'] }),
+    assert.AssertionError,
+  );
+
+  // Branch 2: attributed page (a8bbac53 / BD-A1-119 — cards carry article[data-channel-id]).
+  const attributedThreeDom = extractDomCards(BASELINE_DOM_SPECS.slice(1));
+  const attributedFourDom = extractDomCards(BASELINE_DOM_SPECS);
+  assert.deepEqual(checkCards(attributedThreeDom, CARD_TEXTS, { names: [] }), []);
+  assert.equal(checkCards(attributedFourDom, CARD_TEXTS, { names: [] }).length, 1);
+
+  const genericDomSpec: CardDomSpec = {
+    channelId: 'lti-generic',
+    initials: 'LTI',
+    control: 'connect-link',
+    heading: 'LTI 1.3',
+    description: 'Publish Cogniate courses to any LMS that supports LTI 1.3 Advantage.',
+  };
+  assert.equal(
+    checkCards(extractDomCards([...BASELINE_DOM_SPECS, genericDomSpec]), CARD_TEXTS, { names: ['lti-generic'] }).length,
+    2,
+  );
+  assert.throws(
+    () => checkCards(extractDomCards([...BASELINE_DOM_SPECS, genericDomSpec]), CARD_TEXTS, { names: [] }),
+    assert.AssertionError,
+  );
+});
+
+test('row 6 BD-A1-119 DOM oracle (A-LA-E0-04-01 / B-LA-E0-04-01 / A-LA-E0-04-05 / B-LA-E0-04-03): unregistered Sakai and Campus Cloud cards fail in every state', () => {
+  const providers = withChannel(
+    withChannel(acceptance.lmsProviders, 'lti-generic', 'LMS', 'Other LTI 1.3 platform'),
+    'campus',
+    'Campus',
+    'Campus LMS',
+  );
+  const names = extraChannelNames(providers);
+  assert.deepEqual(names, ['lti-generic', 'campus']);
+
+  const genericDomSpec: CardDomSpec = {
+    channelId: 'lti-generic',
+    initials: 'LTI',
+    control: 'connect-link',
+    heading: 'LTI 1.3',
+    description: 'Publish Cogniate courses to any LMS that supports LTI 1.3 Advantage.',
+  };
+  const campusDomSpec: CardDomSpec = {
+    channelId: 'campus',
+    initials: 'Cp',
+    control: 'disabled-connect',
+    heading: 'Campus Learning',
+    description: 'Publish Cogniate courses to Campus LMS with LTI 1.3.',
+    notice: 'Campus is not set up for this Cogniate service yet. Ask your Cogniate operator.',
+  };
+
+  const validGrid = extractDomCards([...BASELINE_DOM_SPECS, genericDomSpec, campusDomSpec]);
+  assert.equal(checkCards(validGrid, CARD_TEXTS, { names }).length, 3);
+
+  const unregisteredDomSpecs: CardDomSpec[] = [
+    // Reviewer-A Round 1 (A-LA-E0-04-01): Sakai card mentioning "LMS" without data-channel-id or with sakai id.
+    {
+      channelId: null,
+      initials: 'Sk',
+      control: 'connect-link',
+      heading: 'Sakai',
+      description: 'Publish Cogniate courses to Sakai LMS with LTI 1.3.',
+    },
+    {
+      channelId: 'sakai',
+      initials: 'Sk',
+      control: 'connect-link',
+      heading: 'Sakai',
+      description: 'Publish Cogniate courses to Sakai LMS with LTI 1.3.',
+    },
+    // Reviewer-B Round 1 (B-LA-E0-04-01): Sakai LMS heading without data-channel-id or with sakai id.
+    {
+      channelId: null,
+      initials: 'Sk',
+      control: 'connect-link',
+      heading: 'Sakai LMS',
+      description: 'Publish Cogniate courses to Sakai with LTI 1.3.',
+    },
+    // Reviewer-A Round 3 (A-LA-E0-04-05 item 1): disabled Sakai card with generic "LMS is not set up..." notice.
+    {
+      channelId: null,
+      initials: 'Sk',
+      control: 'disabled-connect',
+      heading: 'Sakai Learning',
+      description: 'Publish Cogniate courses to Sakai LMS with LTI 1.3.',
+      notice: 'LMS is not set up for this Cogniate service yet. Ask your Cogniate operator.',
+    },
+    // Disabled Sakai card copying registered Campus notice or using display name as data-channel-id.
+    {
+      channelId: null,
+      initials: 'Sk',
+      control: 'disabled-connect',
+      heading: 'Sakai Learning',
+      description: 'Publish Cogniate courses to Sakai LMS with LTI 1.3.',
+      notice: 'Campus is not set up for this Cogniate service yet. Ask your Cogniate operator.',
+    },
+    {
+      channelId: 'LMS',
+      initials: 'Sk',
+      control: 'disabled-connect',
+      heading: 'Sakai Learning',
+      description: 'Publish Cogniate courses to Sakai LMS with LTI 1.3.',
+      notice: 'LMS is not set up for this Cogniate service yet. Ask your Cogniate operator.',
+    },
+    // Reviewer-B Round 3 (B-LA-E0-04-03): unregistered disabled "Campus Cloud" lookalike card (no attribute, unknown id, or display name).
+    {
+      channelId: null,
+      initials: 'Cc',
+      control: 'disabled-connect',
+      heading: 'Campus Cloud',
+      description: 'Publish courses to your platform.',
+      notice: 'Ask your operator to enable Campus Cloud.',
+    },
+    {
+      channelId: 'campus-cloud',
+      initials: 'Cc',
+      control: 'disabled-connect',
+      heading: 'Campus Cloud',
+      description: 'Publish courses to your platform.',
+      notice: 'Ask your operator to enable Campus Cloud.',
+    },
+    {
+      channelId: 'Campus',
+      initials: 'Cc',
+      control: 'disabled-connect',
+      heading: 'Campus Cloud',
+      description: 'Publish courses to your platform.',
+      notice: 'Ask your operator to enable Campus Cloud.',
+    },
+    {
+      channelId: 'Campus LMS',
+      initials: 'Cc',
+      control: 'disabled-connect',
+      heading: 'Campus Cloud',
+      description: 'Publish courses to your platform.',
+      notice: 'Ask your operator to enable Campus Cloud.',
+    },
+    // Duplicate registered data-channel-id on a second card.
+    {
+      channelId: 'campus',
+      initials: 'Cc',
+      control: 'disabled-connect',
+      heading: 'Campus Cloud',
+      description: 'Publish courses to your platform.',
+      notice: 'Ask your operator to enable Campus Cloud.',
+    },
+  ];
+
+  for (const badSpec of unregisteredDomSpecs) {
+    const withBad = extractDomCards([...BASELINE_DOM_SPECS, genericDomSpec, campusDomSpec, badSpec]);
+    assert.throws(() => checkCards(withBad, CARD_TEXTS, { names }), assert.AssertionError);
+  }
+});
+
+test('row 6 BD-A1-119 DOM oracle (A-LA-E0-04-05 / B-LA-E0-04-02): registered card with custom title and custom not-ready text passes', () => {
+  const providers = withChannel(
+    withChannel(acceptance.lmsProviders, 'lti-generic', 'LMS', 'Other LTI 1.3 platform'),
+    'campus',
+    'Campus',
+    'Campus LMS',
+  );
+  const names = extraChannelNames(providers);
+  assert.deepEqual(names, ['lti-generic', 'campus']);
+
+  const genericDomSpec: CardDomSpec = {
+    channelId: 'lti-generic',
+    initials: 'LTI',
+    control: 'connect-link',
+    heading: 'LTI 1.3',
+    description: 'Publish Cogniate courses to any LMS that supports LTI 1.3 Advantage.',
+  };
+
+  // Reviewer-A Round 3 (A-LA-E0-04-05 item 2): card.title 'Teaching Hub', custom description, custom texts.notReady.
+  const customNotReadyA: CardDomSpec = {
+    channelId: 'campus',
+    initials: 'Th',
+    control: 'disabled-connect',
+    heading: 'Teaching Hub',
+    description: 'Publish your courses to Campus.',
+    notice: 'Campus is unavailable until your operator completes setup.',
+  };
+  // Reviewer-B Round 3 (B-LA-E0-04-02): card.title 'Teaching Hub', custom description, custom texts.notReady.
+  const customNotReadyB: CardDomSpec = {
+    channelId: 'campus',
+    initials: 'Th',
+    control: 'disabled-connect',
+    heading: 'Teaching Hub',
+    description: 'Publish courses to your platform.',
+    notice: 'Ask your operator to enable Campus.',
+  };
+  // Ready and connected states with custom title 'Teaching Hub'.
+  const customReady: CardDomSpec = {
+    channelId: 'campus',
+    initials: 'Th',
+    control: 'connect-link',
+    heading: 'Teaching Hub',
+    description: 'Publish your courses to Campus.',
+  };
+  const customConnected: CardDomSpec = {
+    channelId: 'campus',
+    initials: 'Th',
+    control: 'manage-link',
+    heading: 'Teaching Hub',
+    description: 'Publish your courses to Campus.',
+  };
+
+  for (const campusSpec of [customNotReadyA, customNotReadyB, customReady, customConnected]) {
+    const domCards = extractDomCards([...BASELINE_DOM_SPECS, genericDomSpec, campusSpec]);
+    assert.equal(checkCards(domCards, CARD_TEXTS, { names }).length, 3);
+  }
+});
+
+test('row 6 loading state (A-LA-E0-04-03 / BD-A1-119): delayed connections settle and pass; permanently unresolved loading fails', async () => {
+  const names = extraChannelNames(withChannel(acceptance.lmsProviders, 'lti-generic', 'LMS', 'Other LTI 1.3 platform'));
+  assert.deepEqual(names, ['lti-generic']);
+
+  const loadingDomCards = extractDomCards([
+    ...BASELINE_DOM_SPECS,
+    {
+      channelId: 'lti-generic',
+      initials: 'LTI',
+      control: 'loading',
+      heading: 'LTI 1.3',
+      description: 'Publish Cogniate courses to any LMS that supports LTI 1.3 Advantage.',
+    },
+  ]);
+  const settledDomCards = extractDomCards([
+    ...BASELINE_DOM_SPECS,
+    {
+      channelId: 'lti-generic',
+      initials: 'LTI',
+      control: 'connect-link',
+      heading: 'LTI 1.3',
+      description: 'Publish Cogniate courses to any LMS that supports LTI 1.3 Advantage.',
+    },
+  ]);
+
+  assert.equal(loadingDomCards.at(-1)?.channel, 'lti-generic');
+  assert.equal(loadingDomCards.at(-1)?.loading, true);
+  assert.equal(settledDomCards.at(-1)?.channel, 'lti-generic');
+  assert.equal(settledDomCards.at(-1)?.loading, false);
+
+  // Unsettled loading cards (with or without explicit loading: true) are rejected by checkCards.
+  assert.throws(() => checkCards(loadingDomCards, CARD_TEXTS, { names }), assert.AssertionError);
+  assert.throws(
+    () => checkCards(loadingDomCards.map(({ loading, ...rest }) => rest), CARD_TEXTS, { names }),
+    assert.AssertionError,
+  );
+
+  // Delayed connections load: polling waits while loading is true, then passes once settled.
+  let polls = 0;
+  const readDelayed = () => {
+    polls += 1;
+    return polls < 3 ? loadingDomCards : settledDomCards;
+  };
+  const waitUntilSettled = async (readFn: () => CardDescriptor[], maxAttempts = 5): Promise<CardDescriptor[]> => {
+    for (let i = 0; i < maxAttempts; i++) {
+      const current = readFn();
+      if (current.length > 0 && current.every((c) => !c.loading)) return current;
+    }
+    throw new assert.AssertionError({ message: 'LMS Publishing cards finished loading' });
+  };
+  const settled = await waitUntilSettled(readDelayed, 5);
+  assert.equal(polls, 3);
+  assert.equal(checkCards(settled, CARD_TEXTS, { names }).length, 2);
+
+  // Permanently unresolved connections load: never settles within the poll bound and fails.
+  await assert.rejects(() => waitUntilSettled(() => loadingDomCards, 5), assert.AssertionError);
+});
+
+test('row 6 BD-A1-119 DOM oracle: unknown data-channel-id and missing registered card fail', () => {
+  const providers = withChannel(
+    withChannel(acceptance.lmsProviders, 'lti-generic', 'LMS', 'Other LTI 1.3 platform'),
+    'campus',
+    'Campus',
+    'Campus LMS',
+  );
+  const names = extraChannelNames(providers);
+  assert.deepEqual(names, ['lti-generic', 'campus']);
+
+  const genericDomSpec: CardDomSpec = {
+    channelId: 'lti-generic',
+    initials: 'LTI',
+    control: 'connect-link',
+    heading: 'LTI 1.3',
+    description: 'Publish Cogniate courses to any LMS that supports LTI 1.3 Advantage.',
+  };
+  const campusDomSpec: CardDomSpec = {
+    channelId: 'campus',
+    initials: 'Cp',
+    control: 'connect-link',
+    heading: 'Campus',
+    description: 'Publish Cogniate courses to Campus LMS with LTI 1.3.',
+  };
+
+  // 1. Missing registered card: campus is in GET /app-api/lms-providers, but its card is absent from the DOM.
+  const missingCampusDom = extractDomCards([...BASELINE_DOM_SPECS, genericDomSpec]);
+  assert.throws(() => checkCards(missingCampusDom, CARD_TEXTS, { names }), assert.AssertionError);
+
+  // Missing both extra registered cards when lti-generic is registered.
+  const onlyBaselineDom = extractDomCards(BASELINE_DOM_SPECS);
+  assert.throws(() => checkCards(onlyBaselineDom, CARD_TEXTS, { names: ['lti-generic'] }), assert.AssertionError);
+
+  // 2. Unknown data-channel-id on a channel card fails (replacing campus or added alongside).
+  for (const unknownId of ['unknown-lms', 'sakai', 'campus-cloud', 'LMS', 'Campus', '']) {
+    const unknownSpec: CardDomSpec = { ...campusDomSpec, channelId: unknownId };
+    const replacedDom = extractDomCards([...BASELINE_DOM_SPECS, genericDomSpec, unknownSpec]);
+    assert.throws(() => checkCards(replacedDom, CARD_TEXTS, { names }), assert.AssertionError);
+    const addedDom = extractDomCards([...BASELINE_DOM_SPECS, genericDomSpec, campusDomSpec, unknownSpec]);
+    assert.throws(() => checkCards(addedDom, CARD_TEXTS, { names }), assert.AssertionError);
+  }
+
+  // 3. Static Kajabi card carrying a data-channel-id attribute fails (BD-A1-119: static cards have no attribute).
+  const kajabiWithAttrSpecs = BASELINE_DOM_SPECS.map((s, i) => (i === 0 ? { ...s, channelId: 'kajabi' } : s));
+  assert.throws(
+    () => checkCards(extractDomCards([...kajabiWithAttrSpecs, genericDomSpec, campusDomSpec]), CARD_TEXTS, { names }),
+    assert.AssertionError,
+  );
+
+  // 4. Baseline card missing data-channel-id or carrying a mismatched data-channel-id fails.
+  const moodleWithoutAttrSpecs = BASELINE_DOM_SPECS.map((s, i) => (i === 1 ? { ...s, channelId: null } : s));
+  assert.throws(
+    () => checkCards(extractDomCards([...moodleWithoutAttrSpecs, genericDomSpec, campusDomSpec]), CARD_TEXTS, { names }),
+    assert.AssertionError,
+  );
+  const moodleWrongAttrSpecs = BASELINE_DOM_SPECS.map((s, i) => (i === 1 ? { ...s, channelId: 'moodle-other' } : s));
+  assert.throws(
+    () => checkCards(extractDomCards([...moodleWrongAttrSpecs, genericDomSpec, campusDomSpec]), CARD_TEXTS, { names }),
+    assert.AssertionError,
+  );
+});
+
+test('M1-41.common.j-snapshot migration ledger (A-LA-E0-04-02 / LD-24): old ledger is a prefix of upgraded ledger and matches candidate migrations', () => {
+  const oldLedger = {
+    'lti-service/lti.db': ['001_init.sql', '005_lti_grants.sql'],
+    'cogniate-app/cogniate.db': ['001_init.sql', '011_lms_types.sql'],
+  };
+  const expectedLtiLedger = ['001_init.sql', '005_lti_grants.sql', '006_lti_provider_selection.sql', '007_lti_channel_columns.sql'];
+  const expectedAppLedger = [
+    '001_init.sql',
+    '011_lms_types.sql',
+    '012_connection_provider_snapshot.sql',
+    '013_connection_channel_columns.sql',
+  ];
+  const newLedger = {
+    'lti-service/lti.db': [...expectedLtiLedger],
+    'cogniate-app/cogniate.db': [...expectedAppLedger],
+  };
+  checkMigrationLedgers(oldLedger, newLedger, { expectedLtiLedger, expectedAppLedger });
+
+  // Missing historical entry in lti.db or cogniate.db fails even if also removed from expected*Ledger.
+  const droppedLti = expectedLtiLedger.slice(1);
+  assert.throws(
+    () =>
+      checkMigrationLedgers(
+        oldLedger,
+        { 'lti-service/lti.db': droppedLti, 'cogniate-app/cogniate.db': expectedAppLedger },
+        { expectedLtiLedger: droppedLti, expectedAppLedger },
+      ),
+    assert.AssertionError,
+  );
+  const droppedApp = expectedAppLedger.filter((m) => m !== '011_lms_types.sql');
+  assert.throws(
+    () =>
+      checkMigrationLedgers(
+        oldLedger,
+        { 'lti-service/lti.db': expectedLtiLedger, 'cogniate-app/cogniate.db': droppedApp },
+        { expectedLtiLedger, expectedAppLedger: droppedApp },
+      ),
+    assert.AssertionError,
+  );
+
+  // Reordered historical prefix fails even if expected*Ledger matches newLedger.
+  const reorderedLti = ['005_lti_grants.sql', '001_init.sql', '006_lti_provider_selection.sql', '007_lti_channel_columns.sql'];
+  assert.throws(
+    () =>
+      checkMigrationLedgers(
+        oldLedger,
+        { 'lti-service/lti.db': reorderedLti, 'cogniate-app/cogniate.db': expectedAppLedger },
+        { expectedLtiLedger: reorderedLti, expectedAppLedger },
+      ),
+    assert.AssertionError,
+  );
+
+  // Unapplied candidate migration file fails exact comparison.
+  assert.throws(
+    () =>
+      checkMigrationLedgers(
+        oldLedger,
+        { 'lti-service/lti.db': expectedLtiLedger.slice(0, -1), 'cogniate-app/cogniate.db': expectedAppLedger },
+        { expectedLtiLedger, expectedAppLedger },
+      ),
+    assert.AssertionError,
+  );
+});
diff --git a/tests/ltiaas/lib/open-world.d.mts b/tests/ltiaas/lib/open-world.d.mts
index 2629c41d..d0f6d052 100644
--- a/tests/ltiaas/lib/open-world.d.mts
+++ b/tests/ltiaas/lib/open-world.d.mts
@@ -26,4 +26,24 @@ export function appLmsProviders(
     Promise<{ status: number; headers: Record<string, any>; body: string }>,
   options: { appUrl: string; ca?: string | null; user: { email: string; password: string } },
 ): Promise<Json>;
-export function checkCards(cards: string[], baselineTexts: string[], options: { names: string[]; others?: string[]; label?: string }): string[];
+export interface CardDescriptor {
+  text: string;
+  channel: string | null;
+  loading?: boolean;
+}
+export type CardInput = string | CardDescriptor;
+export function checkCards<T extends CardInput>(
+  cards: T[],
+  baselineTexts: string[],
+  options: { names: string[]; others?: string[]; label?: string },
+): T[];
+export interface MigrationLedgerMap {
+  'lti-service/lti.db': string[];
+  'cogniate-app/cogniate.db': string[];
+  [db: string]: string[];
+}
+export function checkMigrationLedgers(
+  oldLedger: MigrationLedgerMap,
+  newLedger: MigrationLedgerMap,
+  options?: { expectedLtiLedger?: string[]; expectedAppLedger?: string[]; label?: string },
+): void;
diff --git a/tests/ltiaas/lib/open-world.mjs b/tests/ltiaas/lib/open-world.mjs
index c38c4e49..8d4c7232 100644
--- a/tests/ltiaas/lib/open-world.mjs
+++ b/tests/ltiaas/lib/open-world.mjs
@@ -58,11 +58,15 @@ export function registeredChannels(lmsProviders) {
   return new Set(ids);
 }
 
-/** The text names of the registered channels that are not baseline channels (`channelName`, else `label`). */
+/**
+ * The registered channel ids (`channel` of GET /app-api/lms-providers, or `lms` before LA-IC-01)
+ * that are not baseline channels (BD-A1-119).
+ */
 export function extraChannelNames(lmsProviders) {
   assert.ok(Array.isArray(lmsProviders?.lms), 'GET /app-api/lms-providers has an lms list');
-  return lmsProviders.lms.filter((entry) => !BASELINE_LMS.includes(entry.channel ?? entry.lms))
-    .map((entry) => entry.channelName ?? entry.label).filter((name) => typeof name === 'string' && name.length > 0);
+  const ids = lmsProviders.lms.map((entry) => entry.channel ?? entry.lms);
+  for (const id of ids) assert.equal(typeof id, 'string', 'Each lms-providers entry has a channel id');
+  return ids.filter((id) => id.length > 0 && !BASELINE_LMS.includes(id));
 }
 
 /**
@@ -179,20 +183,123 @@ export async function appLmsProviders(request, { appUrl, ca, user }) {
   return JSON.parse(answer.body);
 }
 
+const cardText = (card) => (typeof card === 'string' ? card : String(card?.text ?? ''));
+
+const cardChannel = (card) => {
+  if (!card || typeof card !== 'object') return null;
+  const ch = card.channel ?? null;
+  return ch === null || ch === undefined ? null : String(ch);
+};
+
+const isLoadingCard = (card) => {
+  if (card && typeof card === 'object' && card.loading === true) return true;
+  const raw = cardText(card).trim();
+  return /^(?:[A-Za-z0-9]{1,4}\s*)?Loading(?:…|\.\.\.)/.test(raw);
+};
+
+const isOtherCard = (card, other) => cardChannel(card) === null && cardText(card).includes(other);
+
 /**
- * Row 6: the visible cards of the "LMS Publishing" filter, as card texts in page order. Each baseline card text is
- * in exactly one card, in the baseline order. An extra card is a G-BASE non-channel card (`others`, each at most
- * once) or names a registered channel that is not a baseline channel (`names`, from extraChannelNames).
- * Returns the extra card texts.
+ * Row 6 (BD-A1-119): the visible cards of the "LMS Publishing" filter, in page order.
+ * - When the page has cards with `data-channel-id` (attributed page): each baseline card text is in exactly one card
+ *   in the baseline order with `data-channel-id` equal to the baseline channel id; every non-baseline channel card
+ *   carries `data-channel-id` (`channel`), and the set of those ids equals the non-baseline `channel` values of
+ *   GET /app-api/lms-providers (`names`, from extraChannelNames); every card without `data-channel-id` (`channel: null`)
+ *   must be one of the frozen static cards (`others`, each at most once).
+ * - When no card has `data-channel-id` (the unattributed G-BASE / 1b17261 baseline page): uses the closed baseline
+ *   card list (the 3 baseline cards in order, plus `others` each at most once, with no extra channel cards).
+ * Never uses text guessing. Returns the extra cards.
  */
 export function checkCards(cards, baselineTexts, { names, others = BASELINE_OTHER_CARDS, label = 'LMS Publishing cards' }) {
-  const extras = openList(cards, baselineTexts, { label, matches: (text, expected) => String(text).includes(expected) });
+  assert.ok(Array.isArray(cards), `${label}: the answer is a list`);
+  assert.ok(Array.isArray(names), `${label}: names is a list`);
+  for (const card of cards) {
+    assert.ok(!isLoadingCard(card), `${label}: card ${show(card)} is still loading`);
+  }
+  const allowed = new Set();
+  for (const name of names) {
+    assert.ok(typeof name === 'string' && name.trim().length > 0, `${label}: invalid channel id ${show(name)}`);
+    allowed.add(name.trim());
+  }
+  assert.equal(allowed.size, names.length, `${label}: channel ids are unique`);
+  const hasChannelAttrs = cards.some((card) => cardChannel(card) !== null);
+  let baselineIndex = 0;
+  const extras = openList(cards, baselineTexts, {
+    label,
+    matches: (card, expected) => cardText(card).includes(expected),
+    check: (card) => {
+      const expectedChannel = BASELINE_LMS[baselineIndex++];
+      if (hasChannelAttrs) {
+        const ch = cardChannel(card);
+        assert.equal(ch, expectedChannel, `${label}: baseline card ${show(expectedChannel)} has channel ${show(ch)}`);
+      }
+    },
+  });
   for (const other of others) {
-    assert.ok(extras.filter((text) => String(text).includes(other)).length <= 1, `${label}: the card ${show(other)} appears more than once`);
+    assert.ok(extras.filter((card) => isOtherCard(card, other)).length <= 1, `${label}: the card ${show(other)} appears more than once`);
   }
-  for (const text of extras) {
-    if (others.some((other) => String(text).includes(other))) continue;
-    assert.ok(names.some((name) => String(text).includes(name)), `${label}: extra card ${show(text)} names no registered channel`);
+  if (!hasChannelAttrs) {
+    assert.equal(allowed.size, 0, `${label}: unattributed baseline page cannot satisfy extra registered channels ${show([...allowed])}`);
+    for (const card of extras) {
+      assert.ok(
+        others.some((other) => isOtherCard(card, other)),
+        `${label}: extra card ${show(card)} is not in the closed baseline card list`,
+      );
+    }
+    return extras;
+  }
+  const extraChannels = [];
+  for (const card of extras) {
+    const ch = cardChannel(card);
+    if (ch === null) {
+      assert.ok(
+        others.some((other) => isOtherCard(card, other)),
+        `${label}: card without data-channel-id ${show(card)} is not a frozen static card`,
+      );
+      continue;
+    }
+    const id = ch.trim();
+    assert.ok(id.length > 0 && allowed.has(id), `${label}: extra card ${show(card)} has unregistered channel ${show(ch)}`);
+    extraChannels.push(id);
+  }
+  assert.equal(new Set(extraChannels).size, extraChannels.length, `${label}: duplicate channel card in ${show(extraChannels)}`);
+  for (const expectedId of allowed) {
+    assert.ok(extraChannels.includes(expectedId), `${label}: missing card for registered channel ${show(expectedId)}`);
   }
   return extras;
 }
+
+/**
+ * Snapshot-upgrade migration ledger check (M1-41.common.j-snapshot; BD-A2-108 / LD-24):
+ * 1. Every historical ledger entry from `oldLedger` is still present in `newLedger` in its original order
+ *    (each `oldLedger[db]` is a non-empty prefix of `newLedger[db]`), independent of the candidate's files.
+ * 2. `newLedger['cogniate-app/cogniate.db']` includes `012_connection_provider_snapshot.sql`.
+ * 3. Each upgraded ledger equals the candidate's full sorted migration file list (`expectedLtiLedger`, `expectedAppLedger`).
+ */
+export function checkMigrationLedgers(
+  oldLedger,
+  newLedger,
+  { expectedLtiLedger, expectedAppLedger, label = 'M1-41.common.j-snapshot migration ledger' } = {},
+) {
+  for (const db of ['lti-service/lti.db', 'cogniate-app/cogniate.db']) {
+    const oldEntries = oldLedger?.[db];
+    const newEntries = newLedger?.[db];
+    assert.ok(Array.isArray(oldEntries) && oldEntries.length > 0, `${label}: ${db} old ledger is a non-empty list`);
+    assert.ok(Array.isArray(newEntries) && newEntries.length >= oldEntries.length, `${label}: ${db} upgraded ledger is shorter than old ledger`);
+    assert.deepEqual(
+      newEntries.slice(0, oldEntries.length),
+      oldEntries,
+      `${label}: ${db} old ledger is not a prefix of the upgraded ledger`,
+    );
+  }
+  assert.ok(
+    newLedger['cogniate-app/cogniate.db'].includes('012_connection_provider_snapshot.sql'),
+    `${label}: cogniate-app/cogniate.db upgraded ledger is missing 012_connection_provider_snapshot.sql`,
+  );
+  if (expectedLtiLedger !== undefined) {
+    assert.deepEqual(newLedger['lti-service/lti.db'], expectedLtiLedger, `${label}: lti-service/lti.db ledger does not match candidate migrations`);
+  }
+  if (expectedAppLedger !== undefined) {
+    assert.deepEqual(newLedger['cogniate-app/cogniate.db'], expectedAppLedger, `${label}: cogniate-app/cogniate.db ledger does not match candidate migrations`);
+  }
+}
```

### 6.3 Round 3 `git apply --check -v` on `la-gate-test-6` & Host K0 / Typecheck Verification

```text
$ git -C /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-wave-end-6 apply --check -v /Users/quangnguyen/cogniate-qa-runs/LA/ld1-overlay-fix-r1/ld9-addendum-r5.patch
Checking patch tests/acceptance/lib/open-world.d.mts...
Checking patch tests/acceptance/lib/open-world.mjs...
Checking patch tests/e2e/M2/01-cards.m2.ts...
Checking patch tests/host/m1-migration.mjs...
Checking patch tests/ltiaas/k0/ld1/open-world.test.mjs...
Checking patch tests/ltiaas/k0/ld1/open-world.test.ts...
Checking patch tests/ltiaas/lib/open-world.d.mts...
Checking patch tests/ltiaas/lib/open-world.mjs...

$ node --test tests/ltiaas/k0/ld1/open-world.test.mjs
✔ the probe card texts equal tests/e2e/M2/lib/m2.ts TEXT, and open-world copies match when present
...
✔ row 6: the G-BASE Kajabi card is allowed, but not twice
✔ row 6 G-BASE unattributed parity vs BD-A1-119 attributed branch: baseline page without data-channel-id passes with the 3 baseline cards and fails with an extra card; attributed page follows BD-A1-119
✔ row 6 BD-A1-119 DOM oracle (A-LA-E0-04-01 / B-LA-E0-04-01 / A-LA-E0-04-05 / B-LA-E0-04-03): unregistered Sakai and Campus Cloud cards fail in every state
✔ row 6 BD-A1-119 DOM oracle (A-LA-E0-04-05 / B-LA-E0-04-02): registered card with custom title and custom not-ready text passes
✔ row 6 loading state (A-LA-E0-04-03 / BD-A1-119): delayed connections settle and pass; permanently unresolved loading fails
✔ row 6 BD-A1-119 DOM oracle: unknown data-channel-id and missing registered card fail
✔ M1-41.common.j-snapshot migration ledger (A-LA-E0-04-02 / LD-24): old ledger is a prefix of upgraded ledger and matches candidate migrations
ℹ tests 46
ℹ pass 46
ℹ fail 0

$ npx vitest run --config tests/ltiaas/k0/vitest.config.mts
 ✓ tests/ltiaas/k0/contract.test.ts (103 tests)
 ✓ tests/ltiaas/k0/ld1/open-world.test.ts (46 tests)
 ✓ tests/ltiaas/k0/smoke.test.ts (2 tests)
 Test Files  3 passed (3)
      Tests  151 passed (151)

$ npm --prefix tests run typecheck
> cogniate-qa-tests@0.0.0 typecheck
> tsc --noEmit -p tsconfig.json
```
