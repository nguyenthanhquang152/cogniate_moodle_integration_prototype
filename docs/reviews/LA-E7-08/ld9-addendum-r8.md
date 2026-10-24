# LA-E7-08 — LD-9 Addendum Round 8 (LD-29 Re-Gate After B/C Final Merge `78971b03` / `4f10c5fd`)

- **Task**: `LA-E7-08` (LD-9 Addendum Round 8 — Re-gate test overlay after the B/C final merge per `LA-H27` (a) and `LD-29`)
- **Author**: Lead QA (`la-qa`)
- **Date**: 2026-10-24
- **New Baseline Product SHA (`main` B/C Final)**: `78971b0300ab171029e8ce94dbba30db37b23dea` (`78971b03`, tag `la-baseline-product-3`)
- **New Baseline Gate Test SHA (`baseline-3`)**: `d854183f104a5573b83a56e280c088a6bc99c2d4` (`d854183f`, tag `baseline-3` in `/Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-baseline-3`)
- **New Final Product SHA (LA + B/C Merge)**: `4f10c5fd9ca4dd0a5f636b34d7454e0db7b6849c` (`4f10c5fd`, tag `la-final-product-3`)
- **New Final Gate Test SHA (`la-final-test-3`)**: `57b6a78c694e6244ffa0639957249c052345dca9` (`57b6a78c`, tag `la-final-test-3` in `/Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-final-3` and `/Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-final-3-d4`; includes `LD-30` kit tree `d7e50b5dea56382f849b213f006b73bcf5eb71aa` from integration `a3953243`)
- **Addendum r8 Patch File**: `/Users/quangnguyen/cogniate-qa-runs/LA/ld9-addendum-r8/ld9-addendum-r8.patch` (`3,366` bytes, SHA-256 `ddf3f1c3ff38c2e805fa0fdf668f7c0a05efe1dbb76a54c1d102b02c01e3c514`)
- **Prior Addenda**:
  - `docs/reviews/LA-E7-08/ld9-addendum.md` (`r1`–`r4`)
  - `docs/reviews/LA-E7-08/ld9-addendum-r5.md` (`r5`)
  - `docs/reviews/LA-E7-08/ld9-addendum-r6.md` (`r6`)
  - `docs/reviews/LA-E7-08/ld9-addendum-r7.md` (`r7`)

---

## 1. Context & Complete File Audit (`bd368ff..78971b03` vs. `1b17261..la-final-test-2`)

The B/C milestone committed `11` non-doc commits after `G-BASE` `bd368ff39fb4c533fc105e7c5ee81a59e618d99a` (`main` `78971b0300ab171029e8ce94dbba30db37b23dea`, B/C tip `2a186086fb8fedc04e2d85ac7d3be7611ae92af3`), changing `18` non-doc files (`README.md`, `infra/README.md`, `apps/player/src/html/tracker.ts`, `apps/player/src/html/tracker.test.ts`, and `14` frozen-test files under `tests/`). The Lead merged `78971b03` into `quang/ltiaas-milestone` at `4f10c5fd9ca4dd0a5f636b34d7454e0db7b6849c` (`4f10c5fd`).

Every file in the `14` B/C test files (`bd368ff..78971b03`) and every file in the `36` LA gate overlay/addendum files (`1b17261..la-final-test-2` `68b2e909`) was audited against its B/C final (`78971b03` / `4f10c5fd`) version:

### 1.1 B/C-Only Test Files (`9` files — `0` overlap with LA addenda `r1–r7`)

These `9` files were modified in `bd368ff..78971b03` and were never touched by any LA addendum (`r1–r7`). Both `baseline-3` (`src-baseline-3`) and `la-final-test-3` (`src-final-3`) retain the exact `78971b03` / `4f10c5fd` versions verbatim:

| # | File | B/C Commit | Purpose of B/C Change |
|---|---|---|---|
| 1 | `tests/acceptance/M1/blackboard/50-races.test.ts` | `9eb504f5` | `M1-37.bb.dead-handler` / `dead-handler-post` (`mode: 'kill'`) |
| 2 | `tests/acceptance/M1/blackboard/52-snapshot.test.ts` | `9eb504f5` | `M1-37.bb.dead-handler-dl` / `dead-handler-post` |
| 3 | `tests/acceptance/M1/canvas/51-canvas-races.test.ts` | `9eb504f5` | `M1-37.canvas.dead-handler` / `dead-handler-post` (`mode: 'kill'`) |
| 4 | `tests/acceptance/M1/canvas/52-canvas-snapshot.test.ts` | `9eb504f5` | `M1-37.canvas.dead-handler-dl` |
| 5 | `tests/e2e/2-scenario-b.spec.ts` | `97b68af4` | Secret-scan coverage for `isCloneEnvSecret` |
| 6 | `tests/e2e/M2/06-keyboard-axe.m2.ts` | `5561e8f7` | `routeFocusSettled` + `:focus` `toHaveValue` checks on keyboard flow |
| 7 | `tests/e2e/host/t7-env-secrets.mjs` | `97b68af4` | `isCloneEnvSecret` helper for `.env` secret redaction |
| 8 | `tests/e2e/lib/flows.ts` | `97b68af4` | Secret-scan coverage helper |
| 9 | `tests/host/m1-control.selftest.mjs` | `9eb504f5` | Unit self-tests for `m1-restart` `mode: 'kill'` |

### 1.2 LA Addendum/Overlay-Only Files (`31` files — `0` diff in `bd368ff..78971b03`)

All `31` remaining LA gate overlay/addendum files have `0` diff in `bd368ff..78971b03` (their `78971b03` base is byte-for-byte identical to `bd368ff`):

- **Included in both `baseline-3` (`78971b03`) and `la-final-test-3` (`4f10c5fd`) (`16` non-overlapping files)**:
  - `LD-1` open-world overlay (`7` files; the 8th `LD-1` file `11-canvas-platforms.test.ts` has only its `LD-1` hunk in `baseline-3` and both `LD-1` + `LA-IC-14` in `la-final-test-3`, and `00-profiles.test.ts` has its `LD-1` + `r5` hunk in `baseline-3` and `LD-1` + `r5` + `LA-IC-23` in `la-final-test-3`):
    - `tests/acceptance/M1/common/90-simulation-gates.test.ts`
    - `tests/acceptance/lib/open-world.d.mts`
    - `tests/acceptance/lib/open-world.mjs`
    - `tests/e2e/M2/01-cards.m2.ts`
    - `tests/e2e/host/run-m2.mjs`
    - `tests/host/run-m1.mjs`
  - `qalead` / `qalead-la` runner prefix guard (`7` non-overlapping files):
    - `tests/host/core.mjs`
    - `tests/host/host-control.mjs`
    - `tests/host/p5-fixture.mjs`
    - `tests/host/run-t1.mjs`
    - `tests/host/run-t5.mjs`
    - `tests/host/storage-docker.mjs` (also includes `r6` `BOUND_IDENTITY` Docker `29.9.2` / Compose `5.6.1`)
    - `tests/host/storage-handoff.mjs`
  - `r6` `BOUND_IDENTITY` self-test (`1` file):
    - `tests/host/storage-docker.selftest.mjs`
  - `r4` frozen-test race wait (`1` non-overlapping file):
    - `tests/acceptance/T5b/1-html.spec.ts` (`WE-F10` / `BD-A1-116` `seenPages` wait)
- **Included only in `la-final-test-3` (`4f10c5fd`) because they assert candidate-only `LA-IC` / `LD-24` contracts or live under `tests/ltiaas/` (`15` files)**:
  - `tests/acceptance/M1/canvas/11-canvas-platforms.test.ts` (`LA-IC-14` dynamic registration; `baseline-3` has only the `LD-1` hunk)
  - `tests/acceptance/M1/canvas/21-canvas-protocol.test.ts` (`LA-IC-04` + `LA-IC-06`)
  - `tests/acceptance/M1/canvas/31-canvas-grants.test.ts` (`LA-IC-09`)
  - `tests/acceptance/M1/common/00-profiles.test.ts` (`LA-IC-23` NRPS value; `baseline-3` has only the `LD-1` + `r5` hunk)
  - `tests/acceptance/M1/common/99-logs.test.ts` (`LA-IC-22`)
  - `tests/acceptance/T4b1/1-connect.spec.ts` (`LA-IC-23`)
  - `tests/acceptance/T6/2-connect.spec.ts` (`LA-IC-23`)
  - `tests/acceptance/lib/portal.ts` (`LA-IC-23`)
  - `tests/acceptance/run-api.mjs` (`LA-IC-22`)
  - `tests/e2e/lib/steps.ts` (`LA-IC-23`)
  - `tests/host/m1-migration.mjs` (`LD-24` + `LA-E1` migration ledger)
  - `tests/host/storage-fixture-script.mjs` (`LA-IC-09` `record_dispatch`)
  - `tests/ltiaas/k0/ld1/open-world.test.mjs` (`r5` `BD-A1-119`)
  - `tests/ltiaas/k0/ld1/open-world.test.ts` (`r5` `BD-A1-119`)
  - `tests/ltiaas/lib/open-world.d.mts` (`r5` `BD-A1-119`)
  - `tests/ltiaas/lib/open-world.mjs` (`r5` `BD-A1-119`)

---

## 2. The Five Overlapping Files (B/C Change, LA Addendum Change, and Combined Result)

Five files were touched by both B/C (`bd368ff..78971b03`) and LA addenda (`1b17261..la-final-test-2`): the four named in the brief (`tests/acceptance/T8/2-shell.spec.ts`, `tests/host/m1-control.mjs`, `tests/acceptance/T6/5-xss-a11y.spec.ts`, `tests/e2e/host/run-t7.mjs`) plus `tests/acceptance/T6/3-courses.spec.ts` uncovered by the full diff audit. In both `baseline-3` (`d854183f`) and `la-final-test-3` (`57b6a78c`), all five files have **100% identical combined content**.

### 2.1 `tests/acceptance/T8/2-shell.spec.ts` (B/C `e1a057be` + `620c03d0`; LA `r3` + `r7`)

1. **B/C change (`bd368ff..78971b03`)**:
   ```diff
   @@ -27,11 +27,12 @@ async function openPublishDialog(page: Page, courseId: string) {
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
   +  await expect(select.locator('option', { hasText: `${conn.json.name} (Moodle, ` }).first()).toBeAttached();
   +  const label = await select.locator('option').evaluateAll((opts, name) => opts.map((o) => o.textContent ?? '').find((t) => t.startsWith(`${name} (Moodle, `)) ?? '', conn.json.name);
      expect(label, `option for the connection "${conn.json.name}"`).toBeTruthy();
      await select.selectOption({ label });
      return dialog;
   ```
2. **LA addendum change (`1b17261..la-final-test-2`, `r3` + `r7`)**:
   ```diff
   @@ -27,11 +27,12 @@ async function openPublishDialog(page: Page, courseId: string) {
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
   +  await expect(select.locator('option', { hasText: `${conn.json.name} (` })).toHaveCount(1);
   +  const label = await select.locator('option').evaluateAll((opts, name) => opts.map((o) => o.textContent ?? '').find((t) => t.startsWith(`${name} (`)) ?? '', conn.json.name);
      expect(label, `option for the connection "${conn.json.name}"`).toBeTruthy();
      await select.selectOption({ label });
      return dialog;
   ```
3. **Combined result in `r8` (diff on top of `78971b03` / `4f10c5fd`)**:
   ```diff
   --- a/tests/acceptance/T8/2-shell.spec.ts
   +++ b/tests/acceptance/T8/2-shell.spec.ts
   @@ -31,7 +31,7 @@ async function openPublishDialog(page: Page, courseId: string) {
      const dialog = page.getByRole('dialog');
      await dialog.waitFor();
      const select = dialog.getByRole('combobox', { name: 'LMS connection' });
   -  await expect(select.locator('option', { hasText: `${conn.json.name} (Moodle, ` }).first()).toBeAttached();
   +  await expect(select.locator('option', { hasText: `${conn.json.name} (Moodle, ` })).toHaveCount(1);
      const label = await select.locator('option').evaluateAll((opts, name) => opts.map((o) => o.textContent ?? '').find((t) => t.startsWith(`${name} (Moodle, `)) ?? '', conn.json.name);
      expect(label, `option for the connection "${conn.json.name}"`).toBeTruthy();
      await select.selectOption({ label });
   ```
   - **Assertion preservation**: Keeps B/C's stronger `${conn.json.name} (Moodle, ` prefix check (`e1a057be` + `620c03d0`) and combines it with `r7`'s stronger `.toHaveCount(1)` cardinality and readiness assertion (`WE-F13`).

---

### 2.2 `tests/host/m1-control.mjs` (B/C `9eb504f5`; LA `qalead-la` runner prefix guard)

1. **B/C change (`bd368ff..78971b03`)**:
   ```diff
   @@ -31,6 +31,27 @@ export function m1HostControl(r, runCommand = run) {
        if (['m1-restart', 'm1-profile'].includes(req.action) && compatMarkerPresent(r.CLONE)) {
          return { code: 2, stdout: '', stderr: 'storage-compat marker present: m1-restart and m1-profile are refused (ADR-012 §11)', durationMs: 0 };
        }
   +    if (req.action === 'm1-restart' && 'mode' in req) {
   +      if (req.mode !== 'kill' || req.service !== 'cogniate-app') {
   +        return { code: 2, stdout: '', stderr: 'Unknown M1 host action', durationMs: 0 };
   +      }
   +      const killStart = new Date().toISOString();
   +      const kill = await runCommand('docker', [...compose, 'kill', '-s', 'SIGKILL', 'cogniate-app'],
   +        { cwd: r.CLONE, env: r.STACK_ENV, timeoutMs: 30_000 });
   +      const killLine = `kill: exit ${kill.code}, ${killStart}–${new Date().toISOString()}`;
   +      if (kill.code !== 0) {
   +        return { ...kill, stdout: [killLine, kill.stdout].filter(Boolean).join('\n') };
   +      }
   +      const restart = await runCommand('npm', ['run', 'stack:restart', '--', 'cogniate-app'], {
   +        cwd: r.CLONE, env: { ...r.STACK_ENV, STACK_PROFILE: 'acceptance' }, timeoutMs: 180_000,
   +      });
   +      return {
   +        code: restart.code,
   +        stdout: [killLine, kill.stdout, restart.stdout].filter(Boolean).join('\n'),
   +        stderr: [kill.stderr, restart.stderr].filter(Boolean).join('\n'),
   +        durationMs: (kill.durationMs ?? 0) + (restart.durationMs ?? 0),
   +      };
   +    }
        if (req.action === 'm1-restart' && ['cogniate-app', 'lti-service'].includes(req.service)) {
   ```
2. **LA addendum change (`1b17261..la-final-test-2`, `qalead` runner prefix guard)**:
   ```diff
   @@ -14,7 +14,7 @@ export function m1HostControl(r, runCommand = run) {
      const compose = ['compose', '-f', 'infra/compose.yaml', '--env-file', '.env'];
      let stopped = false;
      async function execute(req) {
   -    if (!r.state.h1Verified || !/^qa-/.test(r.PROJECT)) return { code: 2, stdout: '', stderr: 'QA project guard', durationMs: 0 };
   +    if (!r.state.h1Verified || !/^(?:qa[234]?|qalead)-[a-z0-9-]+$/.test(r.PROJECT)) return { code: 2, stdout: '', stderr: 'QA project guard', durationMs: 0 };
   ```
3. **Combined result in `r8` (diff on top of `4f10c5fd`, where line 17 had `!/^qa[234]?-[a-z0-9-]+$/` and lines 34–54 had `9eb504f5`)**:
   ```diff
   --- a/tests/host/m1-control.mjs
   +++ b/tests/host/m1-control.mjs
   @@ -14,7 +14,7 @@ export function m1HostControl(r, runCommand = run) {
      const compose = ['compose', '-f', 'infra/compose.yaml', '--env-file', '.env'];
      let stopped = false;
      async function execute(req) {
   -    if (!r.state.h1Verified || !/^qa[234]?-[a-z0-9-]+$/.test(r.PROJECT)) return { code: 2, stdout: '', stderr: 'QA project guard', durationMs: 0 };
   +    if (!r.state.h1Verified || !/^(?:qa[234]?|qalead)-[a-z0-9-]+$/.test(r.PROJECT)) return { code: 2, stdout: '', stderr: 'QA project guard', durationMs: 0 };
   ```
   - **Assertion preservation**: Retains B/C `9eb504f5`'s `m1-restart` `mode: 'kill'` handler at lines 34–54 and the `qalead-*` compose project prefix guard at line 17.

---

### 2.3 `tests/acceptance/T6/5-xss-a11y.spec.ts` (B/C `e1a057be` + `5561e8f7`; LA `r3`)

1. **B/C change (`bd368ff..78971b03`)**:
   - `e1a057be` updated all three `/Publish to Moodle/` locators to `/Publish to an LMS/` (lines 44, 79, 91) and updated the line 97 assertion label `'focus is back on "Publish to Moodle"'` to `'focus is back on "Publish to an LMS"'`.
   - `5561e8f7` added `await routeFocusSettled(page, 'Connect Moodle');`, `:focus` `toHaveValue` assertions at lines 104 and 107, and the `routeFocusSettled` helper at lines 120–125.
2. **LA addendum change (`1b17261..la-final-test-2`, `r3`)**:
   - Updated the same three `/Publish to Moodle/` locators to `/Publish to an LMS/` (lines 44, 79, 91).
3. **Combined result in `r8`**:
   - The B/C final version in `78971b03` and `4f10c5fd` already contains all three `/Publish to an LMS/` locator updates from `r3` plus the `5561e8f7` `routeFocusSettled` synchronization. Therefore, `tests/acceptance/T6/5-xss-a11y.spec.ts` in `baseline-3` and `la-final-test-3` requires `0` additional diff lines on top of `78971b03` / `4f10c5fd`.

---

### 2.4 `tests/e2e/host/run-t7.mjs` (B/C `97b68af4`; LA `qalead-la` runner prefix guard)

1. **B/C change (`bd368ff..78971b03`)**:
   ```diff
   @@ -22,6 +22,7 @@ import path from 'node:path';
    import { fileURLToPath } from 'node:url';
    import { parseArgs } from 'node:util';
    import { allContainers, cidrOverlap, networkSubnets, portFree, projectResources, readEnv, Redactor, run, secretsInFile, sha256File, walkFiles } from '../../host/lib.mjs';
   +import { isCloneEnvSecret } from './t7-env-secrets.mjs';
   ...
   @@ -108,7 +109,7 @@ function step(name, ok, notes = []) {
    function addSecretsFromClone() {
      const env = readEnv(path.join(CLONE, '.env')) ?? {};
   -  for (const [k, v] of Object.entries(env)) if (/PASSWORD|SECRET|KEY|TOKEN/i.test(k) && typeof v === 'string' && v.length >= 6) redact.add(v);
   +  for (const [k, v] of Object.entries(env)) if (isCloneEnvSecret(k, v)) redact.add(v);
      for (const f of walkFiles(path.join(CLONE, 'infra', '.secrets'))) for (const item of secretsInFile(f).items) redact.add(item.value);
    }
   ```
2. **LA addendum change (`1b17261..la-final-test-2`, `qalead-la` runner prefix guard)**:
   ```diff
   @@ -60,7 +60,7 @@ const PROJECT = process.env.COMPOSE_PROJECT_NAME ?? '';
    const PUBLIC_PORT = process.env.PUBLIC_PORT ?? '8543';
    const STACK_SUBNET = process.env.STACK_SUBNET ?? '172.31.0.0/16';
    const FIXTURES = process.env.COURSE_FIXTURES_DIR ?? path.join(SOURCE, 'docs', 'raw', 'data', 'courses');
   -if (!/^qa-e2e[a-z0-9-]*$/.test(PROJECT)) {
   +if (!/^(?:qa-e2e|qalead-la)[a-z0-9-]*$/.test(PROJECT)) {
      console.error(`COMPOSE_PROJECT_NAME must start with "qa-e2e" (got "${PROJECT}").\n\n${HELP}`);
      process.exit(2);
    }
   ```
3. **Combined result in `r8` (diff on top of `78971b03` / `4f10c5fd`)**:
   ```diff
   --- a/tests/e2e/host/run-t7.mjs
   +++ b/tests/e2e/host/run-t7.mjs
   @@ -61,7 +61,7 @@ const PROJECT = process.env.COMPOSE_PROJECT_NAME ?? '';
    const PUBLIC_PORT = process.env.PUBLIC_PORT ?? '8543';
    const STACK_SUBNET = process.env.STACK_SUBNET ?? '172.31.0.0/16';
    const FIXTURES = process.env.COURSE_FIXTURES_DIR ?? path.join(SOURCE, 'docs', 'raw', 'data', 'courses');
   -if (!/^qa-e2e[a-z0-9-]*$/.test(PROJECT)) {
   +if (!/^(?:qa-e2e|qalead-la)[a-z0-9-]*$/.test(PROJECT)) {
      console.error(`COMPOSE_PROJECT_NAME must start with "qa-e2e" (got "${PROJECT}").\n\n${HELP}`);
      process.exit(2);
    }
   ```
   - **Assertion preservation**: Retains B/C `97b68af4`'s `isCloneEnvSecret` import and secret redaction logic and applies the `qalead-la` compose project prefix guard at line 64.

---

### 2.5 `tests/acceptance/T6/3-courses.spec.ts` (B/C `e1a057be` + `620c03d0`; LA `r3` + `r4`)

1. **B/C change (`bd368ff..78971b03`)**:
   ```diff
   @@ -126,9 +126,10 @@ test.describe.serial('T6 Courses (Thanh)', () => {
        test.setTimeout(120_000);
        const t6 = loadState('T6') as { uiScormCourseId?: string; pendingConnectionName?: string };
        await page.goto(`${APP}${PORTAL_ROUTES.course(String(t6.uiScormCourseId))}`);
   -    await page.getByRole('button', { name: /Publish to Moodle/ }).or(page.getByRole('link', { name: /Publish to Moodle/ })).first().click();
   +    await page.getByRole('button', { name: /Publish to an LMS/ }).or(page.getByRole('link', { name: /Publish to an LMS/ })).first().click();
        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();
   +    await expect(dialog, 'the registered/connected connection').toContainText('Dev Moodle');
        const text = (await dialog.innerText()).replace(/\s+/g, ' ');
   ```
2. **LA addendum change (`1b17261..la-final-test-2`, `r3` + `r4`)**:
   ```diff
   @@ -126,9 +126,10 @@ test.describe.serial('T6 Courses (Thanh)', () => {
        test.setTimeout(120_000);
        const t6 = loadState('T6') as { uiScormCourseId?: string; pendingConnectionName?: string };
        await page.goto(`${APP}${PORTAL_ROUTES.course(String(t6.uiScormCourseId))}`);
   -    await page.getByRole('button', { name: /Publish to Moodle/ }).or(page.getByRole('link', { name: /Publish to Moodle/ })).first().click();
   +    await page.getByRole('button', { name: /Publish to an LMS/ }).or(page.getByRole('link', { name: /Publish to an LMS/ })).first().click();
        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();
   +    await expect(dialog.getByText('Loading…')).toHaveCount(0);
        const text = (await dialog.innerText()).replace(/\s+/g, ' ');
   ```
3. **Combined result in `r8` (diff on top of `78971b03` / `4f10c5fd`)**:
   ```diff
   --- a/tests/acceptance/T6/3-courses.spec.ts
   +++ b/tests/acceptance/T6/3-courses.spec.ts
   @@ -129,6 +129,7 @@ test.describe.serial('T6 Courses (Thanh)', () => {
        await page.getByRole('button', { name: /Publish to an LMS/ }).or(page.getByRole('link', { name: /Publish to an LMS/ })).first().click();
        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();
   +    await expect(dialog.getByText('Loading…')).toHaveCount(0);
        await expect(dialog, 'the registered/connected connection').toContainText('Dev Moodle');
        const text = (await dialog.innerText()).replace(/\s+/g, ' ');
   ```
   - **Assertion preservation**: Retains both `r4`'s `Loading…` removal check (`WE-F11` / `BD-A1-117`) and B/C `620c03d0`'s `toContainText('Dev Moodle')` check before capturing `dialog.innerText()`.

---

## 3. Verification of New Gate Sources (`baseline-3` and `la-final-test-3`)

### 3.1 Gate Source 1 — `baseline-3` (`/Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-baseline-3`)

- **Clone provenance**: Fresh `git clone --no-hardlinks` at `78971b0300ab171029e8ce94dbba30db37b23dea` (`la-baseline-product-3`), with one explicit commit (`d854183f104a5573b83a56e280c088a6bc99c2d4`, tag `baseline-3`).
- **Non-test diff proof**:
  ```text
  $ git -C /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-baseline-3 diff --exit-code 78971b0300ab171029e8ce94dbba30db37b23dea baseline-3 -- . ':!tests'
  (exit code 0 — 0 non-test files differ)
  ```
- **Test diff summary (`78971b03..baseline-3`)**:
  `21 files changed, 452 insertions(+), 63 deletions(-)` (`LD-1` open-world overlay + `qalead-la` runner prefix guard + `r4`/`r6`/`r7`/`r8`).
- **Host-only self-tests**:
  - `node --test tests/host/storage-docker.selftest.mjs tests/host/m1-control.selftest.mjs tests/host/m1-migration.selftest.mjs tests/host/storage-fixture-script.selftest.mjs` → `37/37 PASS`.
  - `node tests/e2e/host/run-m2.mjs --harness-only` → `4/4 PASS` + `64 M2 browser cases discovered and accounted; T7 selection unchanged`.

### 3.2 Gate Source 2 — `la-final-test-3` (`/Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-final-3` and `src-final-3-d4`)

- **Clone provenance**: Fresh `git clone --no-hardlinks` at `4f10c5fd9ca4dd0a5f636b34d7454e0db7b6849c` (`la-final-product-3`), with two explicit commits:
  1. `5ee0ebd0f34e398d04cca7788c22c8af6352e159`: `Final gate test overlay on 4f10c5fd (LD-1 + LD-9 addenda r1-r7 non-overlapping files + LD-30 kit d7e50b5d)`
  2. `57b6a78c694e6244ffa0639957249c052345dca9` (tag `la-final-test-3`): `LA-E7-08 (LD-9 addendum r8, LD-29): combine r1-r7 test addenda with B/C final test changes on 4f10c5fd`
- **Non-test diff proof**:
  ```text
  $ git -C /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-final-3 diff --exit-code 4f10c5fd9ca4dd0a5f636b34d7454e0db7b6849c la-final-test-3 -- . ':!tests'
  (exit code 0 — 0 non-test files differ)
  ```
- **Test diff summary (`4f10c5fd..la-final-test-3`)**:
  `39 files changed, 1876 insertions(+), 495 deletions(-)` (`LD-1` open-world overlay + `LD-9` addenda `r1–r8` + `LD-30` `tests/ltiaas/kit` at tree `d7e50b5dea56382f849b213f006b73bcf5eb71aa` from integration `a3953243`).
- **Patch verification**:
  ```text
  $ git -C /Users/quangnguyen/cogniate-qa-runs/LA/GATE/src-final-3 apply --check -R -v /Users/quangnguyen/cogniate-qa-runs/LA/ld9-addendum-r8/ld9-addendum-r8.patch
  Checking patch tests/host/m1-control.mjs...
  Checking patch tests/e2e/host/run-t7.mjs...
  Checking patch tests/acceptance/T8/2-shell.spec.ts...
  Checking patch tests/acceptance/T6/3-courses.spec.ts...
  ```
- **Host-only self-tests**:
  - `node --test tests/host/storage-docker.selftest.mjs tests/host/m1-control.selftest.mjs tests/host/m1-migration.selftest.mjs tests/host/storage-fixture-script.selftest.mjs` → `37/37 PASS`.
  - `node tests/e2e/host/run-m2.mjs --harness-only` → `4/4 PASS` + `64 M2 browser cases discovered and accounted; T7 selection unchanged`.
  - `node --test tests/ltiaas/k0/ld1/open-world.test.mjs` → `46/46 PASS`.
  - `node tests/e2e/ltiaas/run-k2.mjs --harness-only` → `PASS`.
