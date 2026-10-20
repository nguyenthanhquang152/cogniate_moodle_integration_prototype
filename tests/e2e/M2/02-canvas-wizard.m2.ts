// AC-M2-03 (step 1 and site rules), AC-M2-04 (step 2 export), AC-M2-05 (step 3 approval and errors) for Canvas.
import fs from 'node:fs';
import { THANH } from '../../acceptance/lib/app';
import {
  CLOUD, app, canvasBinding, canvasClientId, canvasDeploymentId, check, hostAction, ok, session, unique, urls, type Json,
} from '../../acceptance/M1/canvas/browser';
import {
  ERR, TEACHER, TEXT, button, canvasGrantFor, canvasStep1, canvasToStep3, clipboardDenied, clipboardText, codeCleared,
  connection, connections, expect, fieldMarked, fillCanvasStep3, gateClear, gateFailNext, m2Case, newestByName, next,
  neutralReadiness, noForbiddenFields, pendingWizard, portalSignIn, save, shot,
} from './lib/m2';

async function canvasLabels(s: Json) {
  const r = await app(s as any, 'GET', '/app-api/lms-providers'); ok(r, 200, 'lms-providers');
  return r.json.lms.find((l: Json) => l.lms === 'canvas').profiles as Json[];
}

// ---------------------------------------------------------------- AC-M2-03
m2Case('M2-03.profile-labels', 'Canvas step 1 lists the Canvas profile labels from lms-providers, with the simulation label last', async ({ page }) => {
  const s = await session('A'), profiles = await canvasLabels(s);
  await portalSignIn(page, THANH);
  await page.goto(`${urls.app}/integrations/canvas/connect`);
  await expect(page.getByText(TEXT.canvasUrlHelp, { exact: true })).toBeVisible();
  await expect(page.getByText(TEXT.canvasServiceHelp, { exact: true })).toBeVisible();
  const options = await page.getByLabel('Canvas type', { exact: true }).locator('option').allTextContents();
  expect(options.map((o) => o.trim())).toEqual(profiles.map((p) => p.label));
  expect(options.at(-1)?.trim()).toMatch(/ \(simulation\)$/);
  await noForbiddenFields(page);
  await shot(page, 'm2-03-canvas-step1');
});
const contentHost = new URL(urls.content).hostname;
const ruleCases: [string, string, number, 'site' | 'service', 'cloud' | 'self'][] = [
  ['rule1-http', 'http://school-a.canvas.sim.test', 1, 'site', 'cloud'],
  ['rule1-path', 'https://school-a.canvas.sim.test/canvas', 1, 'site', 'cloud'],
  ['rule1-query', 'https://school-a.canvas.sim.test/?x=1', 1, 'site', 'cloud'],
  ['rule1-fragment', 'https://school-a.canvas.sim.test/#f', 1, 'site', 'cloud'],
  ['rule1-userinfo', 'https://u:p@school-a.canvas.sim.test', 1, 'site', 'cloud'],
  ['rule2-ipv4', 'https://10.20.30.40', 2, 'site', 'cloud'],
  ['rule2-ipv6', 'https://[::1]', 2, 'site', 'cloud'],
  ['rule2-localhost', 'https://localhost', 2, 'site', 'cloud'],
  ['rule2-sub-localhost', 'https://a.localhost', 2, 'site', 'cloud'],
  ['rule3-lti', `https://${new URL(urls.lti).hostname}`, 3, 'site', 'cloud'],
  ['rule3-app', `https://${new URL(urls.app).hostname}`, 3, 'site', 'cloud'],
  ['rule3-content', `https://${contentHost}`, 3, 'site', 'cloud'],
  ['rule4-sso', 'https://sso.canvas.sim.test', 4, 'site', 'cloud'],
  ['rule4-sso-port', 'https://sso.canvas.sim.test:8443', 4, 'site', 'cloud'],
  ['rule5-instructure', 'https://school.instructure.com', 5, 'site', 'self'],
  ['rule4-service-sso', 'https://sso.canvas.sim.test', 4, 'service', 'cloud'],
];
for (const [variant, input, rule, field, kind] of ruleCases) {
  m2Case(`M2-03.${variant}`, `Canvas step 1 shows the rule ${rule} text on the ${field === 'site' ? 'Canvas URL' : 'service URL'} field and makes no connection`, async ({ page }) => {
    const s = await session('A'), before = await connections(s), profiles = await canvasLabels(s);
    const type = profiles.find((p) => p.id === (kind === 'self' ? 'canvas-self-hosted' : 'canvas-sim-cloud'))!.label;
    await portalSignIn(page, THANH);
    await canvasStep1(page, { name: unique('rule'), site: field === 'site' ? input : CLOUD.siteA, service: field === 'service' ? input : undefined, type });
    await next(page);
    await expect(page.getByText(ERR.rule[rule], { exact: true }).first()).toBeVisible();
    await fieldMarked(page, field === 'site' ? 'Canvas URL' : 'Canvas service URL');
    expect((await connections(s)).length, 'No connection is made').toBe(before.length);
  });
}
for (const [variant, service] of [['valid-split', CLOUD.siteA], ['valid-default-service', '']] as const) {
  m2Case(`M2-03.${variant}`, `a valid Canvas step 1 makes one pending connection (${variant})`, async ({ page }) => {
    const s = await session('A'), name = unique('Canvas M2-03');
    await portalSignIn(page, THANH);
    const site = variant === 'valid-split' ? CLOUD.pageA : CLOUD.siteA;
    await canvasStep1(page, { name, site, service });
    await next(page);
    await expect(page.getByRole('heading', { name: TEXT.canvasStep2 })).toBeVisible();
    const c = await newestByName(s, name, 'canvas');
    expect([c.status, c.siteUrl, c.serviceUrl, c.profile]).toEqual(['pending', site, service || site, CLOUD.profile]);
  });
}

// ---------------------------------------------------------------- AC-M2-04
async function step2(page: import('@playwright/test').Page, s: Json) {
  const name = unique('Canvas M2-04');
  await canvasStep1(page, { name, site: CLOUD.siteA });
  await next(page);
  await pendingWizard(page, 'canvas');
  return newestByName(s as any, name, 'canvas');
}
async function exportBody(s: Json, id: string, inline = false) {
  const r = await app(s as any, 'GET', `/app-api/connections/${id}/canvas-configuration${inline ? '?jwk=inline' : ''}`); ok(r, 200, 'export');
  return { body: r.body, json: r.json, kid: String(r.headers['x-cogniate-key-id'] ?? '') };
}
m2Case('M2-04.rows', 'Canvas step 2 shows the four developer key rows in order, each with Copy', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: urls.app });
  const s = await session('A'); await portalSignIn(page, THANH);
  const c = await step2(page, s);
  const rows = await app(s, 'GET', `/app-api/connections/${c.id}/tool-configuration`); ok(rows, 200, 'rows');
  check(rows.json.length === 4, 'Four Canvas rows');
  let lastY = -1;
  for (const row of rows.json as Json[]) {
    // Each row is a table row: the label as row header, the value, and its own Copy button ("Copy <label>").
    const holder = page.locator('tr', { has: page.getByRole('rowheader', { name: row.label, exact: true }) });
    await expect(holder).toBeVisible();
    await expect(holder).toContainText(row.value);
    const y = (await holder.boundingBox())!.y; expect(y, `Row ${row.key} order`).toBeGreaterThan(lastY); lastY = y;
    await holder.getByRole('button', { name: `Copy ${row.label}`, exact: true }).click();
    expect(await clipboardText(page)).toBe(row.value);
  }
  await shot(page, 'm2-04-canvas-step2');
});
m2Case('M2-04.copy-json', 'Copy JSON puts exactly the canvas-configuration body on the clipboard', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: urls.app });
  const s = await session('A'); await portalSignIn(page, THANH);
  const c = await step2(page, s), expected = await exportBody(s, c.id);
  await button(page, 'Copy JSON').first().click();
  expect(await clipboardText(page)).toBe(expected.body);
});
m2Case('M2-04.download-json', 'Download JSON saves cogniate-canvas-lti.json with the same content', async ({ page }) => {
  const s = await session('A'); await portalSignIn(page, THANH);
  const c = await step2(page, s), expected = await exportBody(s, c.id);
  const [download] = await Promise.all([page.waitForEvent('download'), button(page, 'Download JSON').first().click()]);
  expect(download.suggestedFilename()).toBe('cogniate-canvas-lti.json');
  expect(fs.readFileSync((await download.path())!, 'utf8')).toBe(expected.body);
});
m2Case('M2-04.inline', 'the public key checkbox switches Copy and Download to the inline export and shows its key id', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: urls.app });
  const s = await session('A'); await portalSignIn(page, THANH);
  const c = await step2(page, s), expected = await exportBody(s, c.id, true);
  check(expected.kid, 'X-Cogniate-Key-Id header');
  await page.getByLabel(TEXT.canvasInline, { exact: true }).check();
  await expect(page.getByText(TEXT.canvasInlineText + expected.kid, { exact: true })).toBeVisible();
  await button(page, 'Copy JSON').first().click();
  const copied = await clipboardText(page);
  expect(copied).toBe(expected.body);
  expect(Object.hasOwn(JSON.parse(copied), 'public_jwk')).toBe(true);
  expect(Object.hasOwn(JSON.parse(copied), 'public_jwk_url')).toBe(false);
  const [download] = await Promise.all([page.waitForEvent('download'), button(page, 'Download JSON').first().click()]);
  expect(fs.readFileSync((await download.path())!, 'utf8')).toBe(expected.body);
  await shot(page, 'm2-04-canvas-inline-key');
});
m2Case('M2-04.clipboard-denied', 'with clipboard access denied, a selectable text box shows the same JSON', async ({ page, context }) => {
  await clipboardDenied(context);
  const s = await session('A'); await portalSignIn(page, THANH);
  const c = await step2(page, s), expected = await exportBody(s, c.id);
  await button(page, 'Copy JSON').first().click();
  const box = page.locator('textarea, input[readonly]').filter({ hasNot: page.locator('[type=hidden]') });
  await expect(box.first()).toBeVisible();
  const values = await box.evaluateAll((els) => els.map((e) => (e as HTMLTextAreaElement).value));
  expect(values).toContain(expected.body);
  await shot(page, 'm2-04-clipboard-denied');
});
m2Case('M2-04.download-failure', 'a failed JSON download never shows success', async ({ page, context }) => {
  // The portal builds the file from the loaded export in the browser; the browser refuses the file here.
  await context.addInitScript(() => { URL.createObjectURL = () => { throw new Error('Download refused by the browser'); }; });
  const s = await session('A'); await portalSignIn(page, THANH);
  await step2(page, s);
  let downloaded = false; page.on('download', () => { downloaded = true; });
  await button(page, 'Download JSON').first().click();
  await expect(page.getByRole('alert').first()).toBeVisible();
  await page.waitForTimeout(2000);
  expect(downloaded).toBe(false);
  await expect(page.getByText(/(download(ed)? (is )?(complete|done|ready)|saved)/i)).toHaveCount(0);
});

// ---------------------------------------------------------------- AC-M2-05
m2Case('M2-05.success', 'Canvas steps 1 to 4 with a matching approval code register the connection; the code is cleared', async ({ page }) => {
  const s = await session('A'); await portalSignIn(page, THANH);
  const name = unique('Canvas M2-05');
  await canvasStep1(page, { name, site: CLOUD.siteA }); await shot(page, 'm2-05-canvas-step1');
  await next(page); await pendingWizard(page, 'canvas'); await shot(page, 'm2-05-canvas-step2');
  // Setup (step 2) and approval (step 3) show together on the pending connection page (no second Next).
  await expect(page.getByText(TEXT.canvasOperator, { exact: true })).toBeVisible();
  const c = await newestByName(s, name, 'canvas'), clientId = canvasClientId(), deploymentId = canvasDeploymentId();
  const grant = await canvasGrantFor(s, c, clientId, deploymentId);
  await fillCanvasStep3(page, { clientId, deploymentId, code: grant.code }); await shot(page, 'm2-05-canvas-step3');
  await save(page);
  await expect(page.getByRole('heading', { name: TEXT.canvasStep4 })).toBeVisible({ timeout: 30_000 });
  for (const label of TEACHER.canvas) await expect(page.getByText(label).first(), `Teacher step label ${label}`).toBeVisible();
  await shot(page, 'm2-05-canvas-step4');
  expect((await connection(s, c.id)).status).toBe('registered');
  expect(page.url().includes(grant.code)).toBe(false);
  const storage = await page.evaluate(() => JSON.stringify({ l: { ...localStorage }, s: { ...sessionStorage } }));
  expect(storage.includes(grant.code)).toBe(false);
  await noForbiddenFields(page);
});
async function failingSave(page: import('@playwright/test').Page, s: Json, prepare: (c: Json) => Promise<{ clientId: string; deploymentId: string; code: string }>) {
  const c = await canvasToStep3(page, s as any);
  const values = await prepare(c);
  await fillCanvasStep3(page, values);
  await save(page);
  return { c, values };
}
m2Case('M2-05.grant-invalid', 'a used approval code shows the GRANT_INVALID text and the connection stays pending', async ({ page }) => {
  const used = await canvasBinding('A'), s = await session('A'); await portalSignIn(page, THANH);
  const { c, values } = await failingSave(page, s, async () => ({ clientId: canvasClientId(), deploymentId: canvasDeploymentId(), code: used.grant.code }));
  await expect(page.getByText(ERR.grantInvalid, { exact: true })).toBeVisible();
  expect((await connection(s, c.id)).status).toBe('pending');
  await codeCleared(page, values.code);
});
m2Case('M2-05.grant-mismatch', 'another deployment id shows GRANT_MISMATCH and marks the Deployment ID field', async ({ page }) => {
  const s = await session('A'); await portalSignIn(page, THANH);
  const { c, values } = await failingSave(page, s, async (con) => {
    const clientId = canvasClientId(), grant = await canvasGrantFor(s as any, con, clientId, canvasDeploymentId());
    return { clientId, deploymentId: canvasDeploymentId(), code: grant.code };
  });
  await expect(page.getByText(ERR.grantMismatch, { exact: true })).toBeVisible();
  await fieldMarked(page, 'Deployment ID');
  expect((await connection(s, c.id)).status).toBe('pending');
  await codeCleared(page, values.code);
});
m2Case('M2-05.platform-in-use', 'a developer key that another library uses shows PLATFORM_IN_USE', async ({ page }) => {
  const other = await canvasBinding('B'), s = await session('A'); await portalSignIn(page, THANH);
  const { c, values } = await failingSave(page, s, async (con) => {
    const grant = await canvasGrantFor(s as any, con, other.clientId, other.deploymentId);
    return { clientId: other.clientId, deploymentId: other.deploymentId, code: grant.code };
  });
  await expect(page.getByText(ERR.platformInUse, { exact: true })).toBeVisible();
  expect((await connection(s, c.id)).status).toBe('pending');
  await codeCleared(page, values.code);
});
m2Case('M2-05.invalid-values', 'an empty approval code shows the check text and marks the field', async ({ page }) => {
  const s = await session('A'); await portalSignIn(page, THANH);
  const c = await canvasToStep3(page, s);
  await fillCanvasStep3(page, { clientId: canvasClientId(), deploymentId: canvasDeploymentId(), code: '' });
  await save(page);
  await expect(page.getByText(ERR.invalidValues, { exact: true })).toBeVisible();
  await fieldMarked(page, 'Approval code');
  expect((await connection(s, c.id)).status).toBe('pending');
});
m2Case('M2-05.lti-service-error', 'an LTI service failure shows the retry text with a trace id; the connection stays pending', async ({ page }) => {
  const s = await session('A'); await portalSignIn(page, THANH);
  let profileChanged = false;
  try {
    const { c, values } = await failingSave(page, s, async (con) => {
      const clientId = canvasClientId(), deploymentId = canvasDeploymentId(), grant = await canvasGrantFor(s as any, con, clientId, deploymentId);
      await gateFailNext('POST', '^/api/platforms$');
      return { clientId, deploymentId, code: grant.code };
    });
    await expect(page.getByText(ERR.ltiServiceError).first()).toBeVisible();
    expect((await connection(s, c.id)).status).toBe('pending');
    await codeCleared(page, values.code);
    await shot(page, 'm2-05-canvas-lti-error');
    await gateClear();
    // Applied readiness contract: issue while available, then use the existing
    // AC-M1-35 host control to make Canvas S1 answer UNKNOWN_PROFILE.
    profileChanged = true;
    expect((await hostAction('m1-profile', { profile: 'acceptance', simulation: 'off' })).code).toBe(0);
    await fillCanvasStep3(page, values); await save(page);
    await neutralReadiness(page);
    expect((await connection(s, c.id)).status).toBe('pending');
    await codeCleared(page, values.code);
    await shot(page, 'm2-05-canvas-provider-not-ready');
  } finally {
    await gateClear();
    if (profileChanged) expect((await hostAction('m1-profile', { profile: 'acceptance', simulation: 'on' })).code).toBe(0);
  }
});
