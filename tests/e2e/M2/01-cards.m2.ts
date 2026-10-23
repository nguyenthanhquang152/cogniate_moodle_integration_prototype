// AC-M2-01: three LMS cards; each card shows only its own LMS's newest status (also with equal names and times);
// the Moodle card and its flow are unchanged.
import { THANH } from '../../acceptance/lib/app';
import {
  APP, BLACKBOARD, CLOUD, app, canvasClientId, canvasDeploymentId, issueGrant, ok, session, sharedPlatform, unique, urls,
} from '../../acceptance/M1/canvas/browser';
import { TEXT, button, card, expect, integrations, m2Case, manageControl, portalSignIn, shot } from './lib/m2';

const squash = (t: string) => t.replace(/\s+/g, ' ').trim();

m2Case('M2-01.cards', 'the LMS Publishing filter shows the Moodle, Canvas and Blackboard cards with their texts and initials', async ({ page }) => {
  await sharedPlatform();
  await portalSignIn(page, THANH); await integrations(page);
  await expect(page.getByRole('heading', { name: 'Canvas', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Blackboard', exact: true })).toBeVisible();
  const moodle = card(page, TEXT.moodleCard), canvas = card(page, TEXT.canvasCard), bb = card(page, TEXT.blackboardCard);
  for (const c of [moodle, canvas, bb]) await expect(c).toBeVisible();
  await expect(canvas.getByText('Cv', { exact: true })).toBeVisible();
  await expect(bb.getByText('Bb', { exact: true })).toBeVisible();
  await shot(page, 'm2-01-cards');
});

m2Case('M2-01.isolated-newest', 'each card follows only its own LMS newest connection, with equal names and creation times', async ({ page }) => {
  await sharedPlatform();
  const s = await session('A'), name = unique('Same name');
  const [m, c, b] = await Promise.all([
    app(s, 'POST', '/app-api/connections', { name, siteUrl: urls.moodle, method: 'dynamic' }),
    app(s, 'POST', '/app-api/connections', { name, siteUrl: CLOUD.siteA, method: 'manual', lms: 'canvas', profile: CLOUD.profile }),
    app(s, 'POST', '/app-api/connections', { name, siteUrl: BLACKBOARD.siteA, method: 'manual', lms: 'blackboard', profile: BLACKBOARD.profile }),
  ]);
  for (const r of [m, c, b]) ok(r, 201, 'connection');
  await portalSignIn(page, THANH); await integrations(page);
  const cards = { moodle: card(page, TEXT.moodleCard), canvas: card(page, TEXT.canvasCard), blackboard: card(page, TEXT.blackboardCard) };
  await expect(cards.moodle.getByText('Waiting for Moodle', { exact: true })).toBeVisible();
  for (const other of [cards.canvas, cards.blackboard]) expect(squash(await other.innerText())).not.toContain('Waiting for Moodle');
  // "Manage" of each card opens that LMS's newest connection.
  for (const [lms, id] of [['moodle', m.json.id], ['canvas', c.json.id], ['blackboard', b.json.id]] as const) {
    await integrations(page);
    await manageControl(cards[lms]).first().click();
    await page.waitForURL(new RegExp(`/integrations/${lms}/${id}$`));
  }
  await integrations(page);
  const before = { moodle: squash(await cards.moodle.innerText()), blackboard: squash(await cards.blackboard.innerText()), canvas: squash(await cards.canvas.innerText()) };
  const clientId = canvasClientId(), deploymentId = canvasDeploymentId();
  const grant = await issueGrant(s, c.json, { 'client-id': clientId, 'deployment-id': deploymentId, 'service-url': c.json.serviceUrl });
  ok(await app(s, 'PUT', `/app-api/connections/${c.json.id}/platform`, { clientId, deploymentId, grantCode: grant.code }), 200, 'register Canvas');
  await page.reload(); await integrations(page);
  expect(squash(await cards.canvas.innerText()), 'The Canvas card follows its own newest status').not.toBe(before.canvas);
  expect(squash(await cards.moodle.innerText())).toBe(before.moodle);
  expect(squash(await cards.blackboard.innerText())).toBe(before.blackboard);
  await shot(page, 'm2-01-isolated-status');
});

m2Case('M2-01.moodle-card', 'the Moodle card text and its connect flow are unchanged', async ({ page }) => {
  await portalSignIn(page, THANH); await integrations(page);
  const moodle = card(page, TEXT.moodleCard);
  await expect(moodle).toBeVisible();
  const open = button(moodle, 'Connect').or(button(page, 'Connect another site'));
  await open.first().click();
  await page.waitForURL(/\/integrations\/moodle\/connect$/);
  await expect(page.getByLabel('Connection name')).toBeVisible();
  await expect(page.getByLabel(/^Moodle site URL/)).toBeVisible();
  await expect(page.getByRole('radio', { name: /^Automatic \(recommended\)/ })).toBeVisible();
  await expect(page.getByRole('radio', { name: /^Manual/ })).toBeVisible();
  expect(page.url().startsWith(APP)).toBe(true);
});
