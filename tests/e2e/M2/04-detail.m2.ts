// AC-M2-07 (badges and Canvas added deployment), AC-M2-08 (Moodle-only features), AC-M2-09 (disconnect dialogs).
import type { Locator, Page } from '@playwright/test';
import { createCourse, THANH, uploadVersion } from '../../acceptance/lib/app';
import {
  APP, BLACKBOARD, CLOUD, app, blackboardBinding, canvasBinding, canvasDeploymentId, canvasPending, fixtureZip, issueGrant, ok,
  session, sharedPlatform, unique, urls, type Bound, type Json,
} from '../../acceptance/M1/canvas/browser';
import { TEXT, button, codeCleared, connection, expect, m2Case, portalSignIn, shot } from './lib/m2';

async function moodleConnection(s: Json) {
  const r = await app(s as any, 'POST', '/app-api/connections', { name: unique('Moodle M2'), siteUrl: urls.moodle, method: 'manual' });
  ok(r, 201, 'Moodle connection'); return r.json as Json;
}
// ---------------------------------------------------------------- AC-M2-07
m2Case('M2-07.badges', 'each connection view shows its LMS badge, and the connection list names the LMS of every connection', async ({ page }) => {
  await sharedPlatform();
  const s = await session('A'), m = await moodleConnection(s), c = (await canvasPending('A')).connection;
  const b = await app(s, 'POST', '/app-api/connections', { name: unique('Blackboard M2'), siteUrl: BLACKBOARD.siteA, method: 'manual', lms: 'blackboard', profile: BLACKBOARD.profile });
  ok(b, 201, 'Blackboard connection');
  const all: [string, string, Json][] = [['moodle', 'Moodle', m], ['canvas', 'Canvas', c], ['blackboard', 'Blackboard', b.json]];
  await portalSignIn(page, THANH);
  for (const [lms, name, conn] of all) {
    await page.goto(`${APP}/integrations/${lms}/${conn.id}`);
    // The connection overview (the portal's connection list) shows the LMS badge of the open connection.
    await expect(page.locator('[data-slot="badge"]', { hasText: new RegExp(`^${name}$`) }).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: conn.name, exact: true }).first()).toBeVisible();
    const options = (await page.getByLabel('LMS connection', { exact: true }).locator('option').allTextContents()).map((o) => o.trim());
    for (const [, otherName, other] of all) expect(options).toContain(`${other.name} (${otherName}, ${new URL(other.siteUrl).host})`);
    await shot(page, `m2-07-badge-${lms}`);
  }
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
async function confirm(page: Page, dialog: Locator) {
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
// Accepted pre-M2 text at 9e24137 (apps/portal/src/connect/DisconnectDialog.tsx, Lead-approved H-3 baseline).
const MOODLE_DISCONNECT = { title: 'Disconnect Moodle?', text: 'This stops launches through this connection. The tool stays in Moodle.' };
m2Case('M2-09.moodle-dialog', 'the Moodle disconnect dialog keeps its exact pre-M2 title and text', async ({ page }) => {
  const s = await session('A'), m = await moodleConnection(s);
  await portalSignIn(page, THANH);
  const dialog = await disconnectDialog(page, 'moodle', m.id);
  await expect(dialog.getByRole('heading', { name: MOODLE_DISCONNECT.title, exact: true })).toBeVisible();
  await expect(dialog.getByText(MOODLE_DISCONNECT.text, { exact: true })).toBeVisible();
  const text = await dialog.innerText();
  expect(text).not.toContain('Canvas'); expect(text).not.toContain('Blackboard');
  await shot(page, 'm2-09-moodle-dialog');
});
