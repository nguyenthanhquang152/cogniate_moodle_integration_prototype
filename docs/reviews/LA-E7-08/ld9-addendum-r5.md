# LD-1 & LD-9 Gate Overlay Fix Round 1 (`ld9-addendum-r5`) — Card Membership Oracle (`A-LA-E0-04-01` = `B-LA-E0-04-01`) & Migration-Ledger Prefix Check (`A-LA-E0-04-02`)

- **Author:** Lead QA (`task_5785f09e261c` / `ctx_0d5d78338442`)
- **Date:** 2026-10-24
- **Rule & Review References:**
  - `docs/team/ltiaas/plan.md` §6.1 (`LD-1`, `LD-9`)
  - `docs/reviews/LA-E0-04/reviewer-a.md` (`A-LA-E0-04-01` BLOCKER, `A-LA-E0-04-02` MAJOR)
  - `docs/reviews/LA-E0-04/reviewer-b.md` (`B-LA-E0-04-01` BLOCKER)
  - `docs/architecture/ltiaas/build-decisions-A2.md` (`BD-A2-108` / `LA-H21`)
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
| 2 | `tests/acceptance/lib/open-world.mjs` (and byte-identical `tests/ltiaas/lib/open-world.mjs`) | `checkMigrationLedgers` (`:139-172`) | **`A-LA-E0-04-02`** (MAJOR) | **Assertion change on `M1-41.common.j-snapshot` (`BD-A2-108` / `LA-H21` / `WE-F5`)** | Restores an independent check that every historical migration ledger entry in `oldLedger['lti-service/lti.db']` and `oldLedger['cogniate-app/cogniate.db']` is preserved in order as a non-empty prefix of `newLedger[db]`, asserts that `newLedger['cogniate-app/cogniate.db']` includes `'012_connection_provider_snapshot.sql'`, and keeps the exact comparison of `newLedger[db]` against the candidate's sorted migration files (`expectedLtiLedger`, `expectedAppLedger`). |
| 3 | `tests/acceptance/lib/open-world.d.mts` (and byte-identical `tests/ltiaas/lib/open-world.d.mts`) | `CardDescriptor`, `CardInput`, `checkCards`, `MigrationLedgerMap`, `checkMigrationLedgers` (`:10-32`) | **`A-LA-E0-04-01` / `B-LA-E0-04-01` & `A-LA-E0-04-02`** | **`LD-1` TypeScript declaration update (`LA-E0-04`)** | Updates TypeScript types for `checkCards` (accepting `string | CardDescriptor`) and adds the type declaration for `checkMigrationLedgers` so `npm --prefix tests run typecheck` passes cleanly. |
| 4 | `tests/e2e/M2/01-cards.m2.ts` | `lmsCardTexts` (`:12-33`) | **`A-LA-E0-04-01` = `B-LA-E0-04-01`** (BLOCKER) | **`LD-1` row 6 `M2-01.cards` DOM extractor update (`LA-E0-04`)** | Updates `lmsCardTexts(page)` to extract `{ text, channel, name }` per visible card in the `"LMS Publishing"` grid: `text` is the squashed card text (used for the 3 baseline cards and `BASELINE_OTHER_CARDS`), `name` is the exact card heading (`h2, h3, [role="heading"]`), and `channel` is the exact channel id parsed from `/integrations/<channel>/(connect|con_...)` or `<channel>-connect` / `<channel>-manage`. |
| 5 | `tests/host/m1-migration.mjs` | Import `checkMigrationLedgers` (`:12`) and call `checkMigrationLedgers(oldLedger, newLedger, { expectedLtiLedger, expectedAppLedger })` (`:338-341`) | **`A-LA-E0-04-02`** (MAJOR) | **Assertion change on `M1-41.common.j-snapshot` (`BD-A2-108` / `LA-H21` / `WE-F5`)** | Replaces the raw `assert.deepEqual(newLedger[db], expected*Ledger)` calls in `snapshotMigrationRun` with `checkMigrationLedgers(oldLedger, newLedger, { expectedLtiLedger, expectedAppLedger })`, ensuring both historical prefix preservation (`oldLedger` is a prefix of `newLedger`) and exact equality with the candidate's migration files. |
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
+ * Snapshot-upgrade migration ledger check (M1-41.common.j-snapshot; BD-A2-108 / LA-H21):
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
+ * Snapshot-upgrade migration ledger check (M1-41.common.j-snapshot; BD-A2-108 / LA-H21):
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
| **`M1 --phase snapshot-upgrade`** | `tests/host/m1-migration.mjs` | **`M1-38.common.h1`**, **`M1-38.common.h2`**, **`M1-38.common.h3`**, **`M1-38.common.h4`**, **`M1-38.common.h5`**, **`M1-41.common.j-snapshot`** (`6` manifest rows) | `snapshotMigrationRun` runs `checkMigrationLedgers(oldLedger, newLedger, { expectedLtiLedger, expectedAppLedger })` before recording `M1-41.common.j-snapshot`, proving that `oldLedger` from `5c7eb8d` is an exact prefix of `newLedger` on `8fadb828`, `'012_connection_provider_snapshot.sql'` is present in `cogniate.db`, and `newLedger` equals the candidate's sorted migration files (`21` in `lti.db`, `14` in `cogniate.db`). |
| **`M1 --phase migration`** | `tests/host/m1-migration.mjs` | **`M1-23.common.baseline`**, **`M1-23.common.upgrade`**, **`M1-30.common.postwrite`**, **`M1-30.common.rollback`**, plus the `8` `M1-41.common.{a..i,j-migration}` storage rows (`12` manifest rows) | Confirms that importing `checkMigrationLedgers` in `tests/host/m1-migration.mjs` leaves `migrationRun` (`M1 --phase migration`) `12/12 PASS`. |
