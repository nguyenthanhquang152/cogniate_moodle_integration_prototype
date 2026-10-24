// AC-M2-01: three LMS cards; each card shows only its own LMS's newest status (also with equal names and times);
// the Moodle card and its flow are unchanged.
import type { Page } from '@playwright/test';
import { THANH } from '../../acceptance/lib/app';
import {
  APP, BLACKBOARD, CLOUD, app, canvasClientId, canvasDeploymentId, issueGrant, ok, session, sharedPlatform, unique, urls,
} from '../../acceptance/M1/canvas/browser';
import { TEXT, button, card, expect, integrations, m2Case, manageControl, portalSignIn, shot } from './lib/m2';
import { checkCards, extraChannelNames } from '../../acceptance/lib/open-world.mjs';

const squash = (t: string) => t.replace(/\s+/g, ' ').trim();
/** The visible cards of the grid that holds the Moodle card (the "LMS Publishing" filter), in page order, after loading settles. */
const lmsCardTexts = async (page: Page) => {
  const read = () => page.evaluate((moodleText) => {
    const all = Array.from(document.querySelectorAll('body *')) as HTMLElement[];
    let cell: HTMLElement | null = all.find((el) => el.children.length === 0 && (el.textContent ?? '').includes(moodleText)) ?? null;
    while (cell && cell.parentElement && getComputedStyle(cell.parentElement).display !== 'grid') cell = cell.parentElement;
    if (!cell || !cell.parentElement) return [];
    return (Array.from(cell.parentElement.children) as HTMLElement[])
      .filter((c) => getComputedStyle(c).display !== 'none' && c.getBoundingClientRect().height > 0)
      .map((c) => {
        const text = (c.textContent ?? '').replace(/\s+/g, ' ').trim();
        const name = (c.querySelector('h2, h3, [role="heading"]')?.textContent ?? '').replace(/\s+/g, ' ').trim() || null;
        const controls = Array.from(c.querySelectorAll('a, button, [role="button"], [role="link"]'))
          .filter((el) => /^(?:Connect|Manage)$/i.test((el.textContent ?? '').replace(/\s+/g, ' ').trim()));
        const hasLoadingLeaf = Array.from(c.querySelectorAll('*')).some(
          (el) => el.children.length === 0 && /^Loading(?:…|\.\.\.)$/i.test((el.textContent ?? '').replace(/\s+/g, ' ').trim()),
        );
        const loading = controls.length === 0 || hasLoadingLeaf || /^(?:[A-Za-z0-9]{1,4}\s*)?Loading(?:…|\.\.\.)/.test(text);
        const disabled = controls.length > 0 && controls.every(
          (el) => (el as HTMLButtonElement).disabled === true || el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true',
        );
        let channel: string | null =
          c.getAttribute('data-channel') ?? c.getAttribute('data-channel-id') ?? c.getAttribute('data-lms') ?? null;
        if (!channel) {
          for (const el of Array.from(c.querySelectorAll('[data-channel], [data-channel-id], [data-lms], a[href], [id$="-connect"], [id$="-manage"], [id$="-card"]'))) {
            const dataAttr = el.getAttribute('data-channel') ?? el.getAttribute('data-channel-id') ?? el.getAttribute('data-lms');
            if (dataAttr) { channel = dataAttr; break; }
            const href = el.getAttribute('href') ?? '';
            const m = /^\/integrations\/([^/?#]+)\/(?:connect|con_[^/?#]+)$/.exec(href);
            if (m) { channel = m[1]; break; }
            if (el.id.endsWith('-connect')) { channel = el.id.slice(0, -'-connect'.length); break; }
            if (el.id.endsWith('-manage')) { channel = el.id.slice(0, -'-manage'.length); break; }
            if (el.id.endsWith('-card')) { channel = el.id.slice(0, -'-card'.length); break; }
          }
        }
        let notReadyLms: string | null = null;
        for (const el of Array.from(c.querySelectorAll('p, div, span'))) {
          if (el.children.length > 0) continue;
          const leaf = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
          const notReady = /^(.+?)\s+is not set up for this Cogniate service yet\b/.exec(leaf);
          if (notReady) { notReadyLms = notReady[1].trim(); break; }
        }
        if (!channel && disabled && notReadyLms) channel = notReadyLms;
        return { text, channel, name, disabled, loading, ...(notReadyLms ? { notReadyLms } : {}) };
      });
  }, TEXT.moodleCard);
  await expect.poll(async () => {
    const cards = await read();
    return cards.length > 0 && cards.every((c) => !c.loading);
  }, { message: 'LMS Publishing cards finished loading' }).toBe(true);
  return read();
};

m2Case('M2-01.cards', 'the LMS Publishing filter shows the Moodle, Canvas and Blackboard cards with their texts and initials', async ({ page }) => {
  await sharedPlatform();
  await portalSignIn(page, THANH); await integrations(page);
  await expect(page.getByRole('heading', { name: 'Canvas', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Blackboard', exact: true })).toBeVisible();
  const moodle = card(page, TEXT.moodleCard), canvas = card(page, TEXT.canvasCard), bb = card(page, TEXT.blackboardCard);
  for (const c of [moodle, canvas, bb]) await expect(c).toBeVisible();
  // LD-1 open world (LA-E0-04, row 6): the 3 baseline cards with their texts, in this order; an extra card is the
  // G-BASE Kajabi card or names a registered channel of GET /app-api/lms-providers.
  const providers = await app(await session('A'), 'GET', '/app-api/lms-providers'); ok(providers, 200, 'lms-providers');
  checkCards(await lmsCardTexts(page), [TEXT.moodleCard, TEXT.canvasCard, TEXT.blackboardCard], { names: extraChannelNames(providers.json) });
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
