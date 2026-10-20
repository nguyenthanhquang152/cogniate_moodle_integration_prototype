// AC-M2-13: direct routes, cross-provider "not found", no stale values between details, form state per route,
// and library scoping of connection ids.
import type { Page } from '@playwright/test';
import { QA_B, THANH } from '../../acceptance/lib/app';
import { APP, BLACKBOARD, CLOUD, blackboardBinding, canvasBinding, sharedPlatform, unique, type Bound } from '../../acceptance/M1/canvas/browser';
import { card, expect, m2Case, portalSignIn, shot, TEXT } from './lib/m2';

async function notFound(page: Page, forbidden: string[] = []) {
  await expect(page.getByText(/not found/i).first(), 'Portal not found view').toBeVisible();
  await expect(page.getByLabel('Approval code')).toHaveCount(0);
  const text = await page.locator('body').innerText();
  for (const value of forbidden) expect(text.includes(value), `No value ${value} on a not-found route`).toBe(false);
}
const canvasValues = (b: Bound) => [b.connection.siteUrl, b.connection.serviceUrl, b.deploymentId, b.clientId];

m2Case('M2-13.routes-open', 'the four new routes open the right wizard or detail', async ({ page }) => {
  await sharedPlatform();
  const c = await canvasBinding('A', { siteUrl: CLOUD.pageA, serviceUrl: CLOUD.siteA }), b = await blackboardBinding('A');
  await portalSignIn(page, THANH);
  await page.goto(`${APP}/integrations/canvas/connect`); await expect(page.getByLabel('Canvas URL', { exact: true })).toBeVisible();
  await page.goto(`${APP}/integrations/blackboard/connect`); await expect(page.getByLabel('Learn URL', { exact: true })).toBeVisible();
  await page.goto(`${APP}/integrations/canvas/${c.connection.id}`);
  await expect(page.getByText(CLOUD.pageA).first()).toBeVisible(); await expect(page.getByText(CLOUD.siteA).first()).toBeVisible();
  await page.goto(`${APP}/integrations/blackboard/${b.connection.id}`);
  await expect(page.getByText(BLACKBOARD.siteA).first()).toBeVisible();
});
m2Case('M2-13.cross-provider', 'a Canvas id under the Blackboard route (and the reverse) shows not found', async ({ page }) => {
  const c = await canvasBinding('A'), b = await blackboardBinding('A');
  await portalSignIn(page, THANH);
  await page.goto(`${APP}/integrations/blackboard/${c.connection.id}`); await notFound(page, canvasValues(c));
  await page.goto(`${APP}/integrations/canvas/${b.connection.id}`); await notFound(page, [b.deploymentId]);
  await shot(page, 'm2-13-not-found');
});
m2Case('M2-13.no-stale-values', 'a client-side move from a Canvas detail to a Blackboard detail never shows Canvas values, also after a late Canvas answer', async ({ page }) => {
  const c = await canvasBinding('A', { siteUrl: CLOUD.pageA, serviceUrl: CLOUD.siteA }), b = await blackboardBinding('A');
  await portalSignIn(page, THANH);
  await page.goto(`${APP}/integrations/canvas/${c.connection.id}`); // the only document load of this case
  await expect(page.getByText(CLOUD.pageA).first()).toBeVisible();
  const sentinel = unique('m2-13-document');
  await page.evaluate(({ values, mark }) => {
    const w = window as any;
    w.__m2Sentinel = mark; w.__staleSeen = [];
    w.__staleCheck = () => {
      if (!location.pathname.startsWith('/integrations/blackboard/')) return;
      const text = document.body.innerText;
      for (const v of values) if (text.includes(v)) w.__staleSeen.push(`${v} @ ${location.pathname}`);
    };
    new MutationObserver(() => w.__staleCheck()).observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true });
  }, { values: canvasValues(c), mark: sentinel });
  // Hold every next Canvas connection answer for 3 s, so it lands after the transition (late response).
  const late: string[] = [];
  const canvasData = `**/app-api/connections/${c.connection.id}`;
  await page.route(canvasData, async (route) => {
    late.push(route.request().url());
    await new Promise((resolve) => setTimeout(resolve, 3000));
    await route.continue().catch(() => undefined);
  });
  await page.getByRole('button', { name: 'Refresh status', exact: true }).click(); // a Canvas data request is now in flight
  // Client-side transition through the connection list of the overview (same document).
  await page.getByLabel('LMS connection', { exact: true }).selectOption(b.connection.id);
  await page.waitForURL(new RegExp(`/integrations/blackboard/${b.connection.id}$`));
  await expect(page.getByText(BLACKBOARD.siteA).first()).toBeVisible();
  await page.waitForTimeout(7000); // the held answers and one 5 s poll land after the transition
  await page.evaluate(() => (window as any).__staleCheck());
  expect(await page.evaluate(() => (window as any).__m2Sentinel), 'Same document: no hard navigation').toBe(sentinel);
  expect(late.length, 'A Canvas answer was in flight during the transition').toBeGreaterThan(0);
  expect(await page.evaluate(() => (window as any).__staleSeen)).toEqual([]);
  const text = await page.locator('body').innerText();
  for (const value of canvasValues(c)) expect(text.includes(value), `Canvas value ${value} on the Blackboard page`).toBe(false);
  await page.unroute(canvasData);
  await shot(page, 'm2-13-no-stale-values');
});
m2Case('M2-13.form-state', 'values typed in the Canvas wizard never appear in the Blackboard wizard after a client-side move', async ({ page }) => {
  await sharedPlatform(); await portalSignIn(page, THANH);
  await page.goto(`${APP}/integrations/canvas/connect`); // the only document load of this case
  const typed = [unique('Canvas-only name'), CLOUD.siteA, CLOUD.pageA];
  await page.getByLabel('Connection name', { exact: true }).fill(typed[0]);
  await page.getByLabel('Canvas URL', { exact: true }).fill(typed[1]);
  await page.getByLabel('Canvas service URL', { exact: true }).fill(typed[2]);
  const sentinel = unique('m2-13-form');
  await page.evaluate(({ values, mark }) => {
    const w = window as any;
    w.__m2Sentinel = mark; w.__staleSeen = [];
    w.__staleCheck = () => {
      if (!location.pathname.startsWith('/integrations/blackboard/')) return;
      for (const el of Array.from(document.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea'))) {
        if (values.includes(el.value)) w.__staleSeen.push(`${el.name || el.id}=${el.value}`);
      }
      const text = document.body.innerText;
      for (const v of values) if (text.includes(v)) w.__staleSeen.push(`text ${v}`);
    };
    new MutationObserver(() => w.__staleCheck()).observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true });
    w.__staleTimer = setInterval(() => w.__staleCheck(), 25);
  }, { values: typed, mark: sentinel });
  // Client-side transition: the Integrations link, then the Blackboard card's connect link (same document).
  await page.getByRole('link', { name: 'Integrations', exact: true }).first().click();
  await page.waitForURL(/\/integrations$/);
  const bb = card(page, TEXT.blackboardCard);
  await bb.getByRole('link', { name: /^(Connect|Connect another site)$/ }).first().click();
  await page.waitForURL(/\/integrations\/blackboard\/connect$/);
  await expect(page.getByLabel('Learn URL', { exact: true })).toBeVisible();
  await page.waitForTimeout(1000);
  await page.evaluate(() => (window as any).__staleCheck());
  expect(await page.evaluate(() => (window as any).__m2Sentinel), 'Same document: no hard navigation').toBe(sentinel);
  expect(await page.evaluate(() => (window as any).__staleSeen)).toEqual([]);
  for (const label of ['Connection name', 'Learn URL']) {
    expect(typed).not.toContain(await page.getByLabel(label, { exact: true }).inputValue());
  }
});
m2Case('M2-13.cross-library', 'library B sees not found for library A connection ids', async ({ page }) => {
  const c = await canvasBinding('A'), b = await blackboardBinding('A');
  await portalSignIn(page, QA_B);
  await page.goto(`${APP}/integrations/canvas/${c.connection.id}`); await notFound(page, canvasValues(c));
  await page.goto(`${APP}/integrations/blackboard/${b.connection.id}`); await notFound(page, [b.deploymentId, b.connection.name]);
});
