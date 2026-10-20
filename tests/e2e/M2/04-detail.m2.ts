// AC-M2-07 (badges and Canvas added deployment), AC-M2-08 (Moodle-only features), AC-M2-09 (disconnect dialogs).
import type { Page } from '@playwright/test';
import { createCourse, THANH, uploadVersion } from '../../acceptance/lib/app';
import {
  APP, BLACKBOARD, CLOUD, app, blackboardBinding, canvasBinding, canvasDeploymentId, canvasPending, fixtureZip, issueGrant, ok,
  session, sharedPlatform, unique, urls, type Bound, type Json,
} from '../../acceptance/M1/canvas/browser';
import { TEXT, button, codeCleared, connection, expect, m2Case, portalSignIn, shot, test } from './lib/m2';

async function moodleConnection(s: Json) {
  const r = await app(s as any, 'POST', '/app-api/connections', { name: unique('Moodle M2'), siteUrl: urls.moodle, method: 'manual' });
  ok(r, 201, 'Moodle connection'); return r.json as Json;
}
/** Finds a connection by its unique name on the Integrations page (connection list) and reads the LMS badge next to it. */
async function badgeOf(page: Page, name: string) {
  const row = page.locator('li, tr, article, section, div', { hasText: name })
    .filter({ has: page.getByText(/^(Moodle|Canvas|Blackboard)$/) }).last();
  await expect(row, `Connection list row for ${name}`).toBeVisible();
  return (await row.getByText(/^(Moodle|Canvas|Blackboard)$/).first().innerText()).trim();
}

// ---------------------------------------------------------------- AC-M2-07
m2Case('M2-07.badges', 'the connection list shows the LMS badge of each connection', async ({ page }) => {
  await sharedPlatform();
  const s = await session('A'), m = await moodleConnection(s), c = (await canvasPending('A')).connection;
  const b = await app(s, 'POST', '/app-api/connections', { name: unique('Blackboard M2'), siteUrl: BLACKBOARD.siteA, method: 'manual', lms: 'blackboard', profile: BLACKBOARD.profile });
  ok(b, 201, 'Blackboard connection');
  await portalSignIn(page, THANH); await page.goto(`${APP}/integrations`);
  expect(await badgeOf(page, m.name)).toBe('Moodle');
  expect(await badgeOf(page, c.name)).toBe('Canvas');
  expect(await badgeOf(page, b.json.name)).toBe('Blackboard');
  await shot(page, 'm2-07-badges');
});
m2Case('M2-07.canvas-detail', 'a registered Canvas detail shows site, service URL and adds a deployment with an approval code', async ({ page }) => {
  const bound = await canvasBinding('A', { siteUrl: CLOUD.pageA, serviceUrl: CLOUD.siteA });
  await portalSignIn(page, THANH); await page.goto(`${APP}/integrations/canvas/${bound.connection.id}`);
  await expect(page.getByText('Canvas', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(CLOUD.pageA).first()).toBeVisible();
  await expect(page.getByText(CLOUD.siteA).first()).toBeVisible();
  await expect(page.getByText(bound.deploymentId).first()).toBeVisible();
  const second = canvasDeploymentId();
  const grant = await issueGrant(bound.s, bound.connection, { 'client-id': bound.clientId, 'deployment-id': second,
    'service-url': bound.connection.serviceUrl, purpose: 'add_deployment' });
  await page.getByLabel('Deployment ID', { exact: true }).fill(second);
  await page.getByLabel('Approval code', { exact: true }).fill(grant.code);
  await shot(page, 'm2-07-canvas-add-deployment');
  await button(page, 'Add deployment ID').first().click();
  await expect(page.getByText(second).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(bound.deploymentId).first()).toBeVisible();
  await codeCleared(page, grant.code);
  expect([...(await connection(bound.s, bound.connection.id)).platform.deploymentIds].sort()).toEqual([bound.deploymentId, second].sort());
});
m2Case('M2-07.no-add-elsewhere', 'Moodle and Blackboard details have no Add deployment ID', async ({ page }) => {
  const s = await session('A'), m = await moodleConnection(s), b = await blackboardBinding('A');
  await portalSignIn(page, THANH);
  for (const path of [`/integrations/moodle/${m.id}`, `/integrations/blackboard/${b.connection.id}`]) {
    await page.goto(APP + path);
    await expect(page.getByRole('heading').first()).toBeVisible();
    await expect(button(page, 'Add deployment ID')).toHaveCount(0);
  }
});

// ---------------------------------------------------------------- AC-M2-08
async function publishDialog(page: Page, s: Json, connectionName: string) {
  const course = await createCourse(s as any, unique('M2 publish'));
  ok(await uploadVersion(s as any, course.id, fixtureZip('html')), 201, 'upload');
  await page.goto(`${APP}/libraries/courses/${course.id}`);
  await button(page, TEXT.publishTitle).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: TEXT.publishTitle })).toBeVisible();
  const select = dialog.getByLabel(TEXT.publishSelect, { exact: true });
  const label = await select.evaluate((el, n) => Array.from((el as HTMLSelectElement).options).find((o) => o.text.startsWith(`${n} (`))?.text ?? '', connectionName);
  expect(label, `Option for ${connectionName}`).not.toBe('');
  await select.selectOption({ label });
  return { dialog, course };
}
for (const lms of ['canvas', 'blackboard'] as const) {
  m2Case(`M2-08.${lms}-no-moodle-features`, `a ${lms} connection has no web services section and no empty Moodle course option`, async ({ page }) => {
    const bound: Bound = lms === 'canvas' ? await canvasBinding('A') : await blackboardBinding('A');
    await portalSignIn(page, THANH); await page.goto(`${APP}/integrations/${lms}/${bound.connection.id}`);
    await expect(page.getByRole('heading').first()).toBeVisible();
    await expect(page.getByText(/web services/i)).toHaveCount(0);
    const { dialog } = await publishDialog(page, bound.s, bound.connection.name);
    await expect(dialog.getByText(TEXT.shellCheckbox)).toHaveCount(0);
    await expect(dialog.getByLabel(TEXT.shellCheckbox)).toHaveCount(0);
    await shot(page, `m2-08-${lms}-publish-dialog`);
  });
}
m2Case('M2-08.moodle-controls', 'a Moodle connection keeps its web services section; the .mbz section is labeled Moodle only', async ({ page }) => {
  const s = await session('A'), m = await moodleConnection(s);
  await portalSignIn(page, THANH); await page.goto(`${APP}/integrations/moodle/${m.id}`);
  await expect(page.getByText(/web services/i).first()).toBeVisible();
  const course = await createCourse(s, unique('M2 mbz'));
  ok(await uploadVersion(s, course.id, fixtureZip('scorm12')), 201, 'upload');
  await page.goto(`${APP}/libraries/courses/${course.id}`);
  await expect(page.getByText(TEXT.mbz, { exact: true }).first()).toBeVisible();
  await shot(page, 'm2-08-moodle-controls');
});

// ---------------------------------------------------------------- AC-M2-09
async function disconnectDialog(page: Page, lms: string, id: string) {
  await page.goto(`${APP}/integrations/${lms}/${id}`);
  await button(page, /^Disconnect/).first().click();
  const dialog = page.getByRole('dialog').or(page.getByRole('alertdialog'));
  await expect(dialog.first()).toBeVisible();
  return dialog.first();
}
async function confirm(page: Page, dialog: import('@playwright/test').Locator) {
  await dialog.getByRole('button', { name: /disconnect/i }).last().click();
  await expect(dialog).toBeHidden({ timeout: 15_000 });
}
m2Case('M2-09.blackboard-dialog', 'the Blackboard disconnect dialog has the exact text; confirm disables the connection', async ({ page }) => {
  const b = await blackboardBinding('A');
  await portalSignIn(page, THANH);
  const dialog = await disconnectDialog(page, 'blackboard', b.connection.id);
  await expect(dialog.getByText(TEXT.blackboardDisconnect, { exact: true })).toBeVisible();
  await shot(page, 'm2-09-blackboard-dialog');
  await confirm(page, dialog);
  expect((await connection(b.s, b.connection.id)).status).toBe('disabled');
});
m2Case('M2-09.canvas-dialog', 'the Canvas disconnect dialog names Canvas; confirm disables the connection', async ({ page }) => {
  const c = await canvasBinding('A');
  await portalSignIn(page, THANH);
  const dialog = await disconnectDialog(page, 'canvas', c.connection.id);
  const text = await dialog.innerText();
  expect(text).toContain('Canvas'); expect(text).not.toContain('Blackboard'); expect(text).not.toContain('Other schools are not affected');
  await shot(page, 'm2-09-canvas-dialog');
  await confirm(page, dialog);
  expect((await connection(c.s, c.connection.id)).status).toBe('disabled');
});
m2Case('M2-09.moodle-dialog', 'the Moodle disconnect dialog stays a Moodle text', async ({ page }) => {
  const s = await session('A'), m = await moodleConnection(s);
  await portalSignIn(page, THANH);
  const dialog = await disconnectDialog(page, 'moodle', m.id);
  const text = await dialog.innerText();
  expect(text).toContain('Moodle'); expect(text).not.toContain('Canvas'); expect(text).not.toContain('Blackboard');
  // The exact pre-M2 Moodle text needs a Lead-supplied baseline (docs/reviews/M2/qa-plan.md, open item H-3).
  // The observed text is attached, so the verification run can compare it with that baseline.
  test.info().annotations.push({ type: 'moodle-disconnect-text', description: text.replace(/\s+/g, ' ').trim() });
  await shot(page, 'm2-09-moodle-dialog');
});
