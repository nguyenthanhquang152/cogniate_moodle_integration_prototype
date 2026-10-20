// AC-M2-13: direct routes, cross-provider "not found", no stale values between details, form state per route,
// and library scoping of connection ids.
import type { Page } from '@playwright/test';
import { QA_B, THANH } from '../../acceptance/lib/app';
import { APP, BLACKBOARD, CLOUD, blackboardBinding, canvasBinding, sharedPlatform, type Bound } from '../../acceptance/M1/canvas/browser';
import { card, expect, integrations, m2Case, manageControl, portalSignIn, shot, TEXT } from './lib/m2';

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
m2Case('M2-13.no-stale-values', 'moving from a Canvas detail to a Blackboard detail never shows Canvas values', async ({ page }) => {
  const c = await canvasBinding('A', { siteUrl: CLOUD.pageA, serviceUrl: CLOUD.siteA }), b = await blackboardBinding('A');
  await portalSignIn(page, THANH);
  await page.goto(`${APP}/integrations/canvas/${c.connection.id}`);
  await expect(page.getByText(CLOUD.pageA).first()).toBeVisible();
  await page.evaluate((values) => {
    (window as any).__staleSeen = [];
    new MutationObserver(() => {
      if (!location.pathname.startsWith('/integrations/blackboard/')) return;
      const text = document.body.innerText;
      for (const v of values) if (text.includes(v)) (window as any).__staleSeen.push(v);
    }).observe(document.body, { subtree: true, childList: true, characterData: true });
  }, canvasValues(c));
  // Client-side move: the Integrations link, then the Blackboard card's Manage (newest Blackboard connection = b).
  await page.getByRole('link', { name: 'Integrations', exact: true }).first().click();
  await integrations(page).catch(() => undefined);
  await manageControl(card(page, TEXT.blackboardCard)).first().click();
  await page.waitForURL(new RegExp(`/integrations/blackboard/${b.connection.id}$`));
  await expect(page.getByText(BLACKBOARD.siteA).first()).toBeVisible();
  const text = await page.locator('body').innerText();
  for (const value of canvasValues(c)) expect(text.includes(value), `Canvas value ${value} on the Blackboard page`).toBe(false);
  expect(await page.evaluate(() => (window as any).__staleSeen as string[])).toEqual([]);
});
m2Case('M2-13.form-state', 'a value typed in the Canvas wizard does not appear in the Blackboard wizard', async ({ page }) => {
  await sharedPlatform(); await portalSignIn(page, THANH);
  await page.goto(`${APP}/integrations/canvas/connect`);
  await page.getByLabel('Connection name', { exact: true }).fill('Canvas-only typed value');
  await page.getByLabel('Canvas URL', { exact: true }).fill(CLOUD.siteA);
  await page.goto(`${APP}/integrations/blackboard/connect`);
  await expect(page.getByLabel('Connection name', { exact: true })).not.toHaveValue('Canvas-only typed value');
  await expect(page.getByLabel('Learn URL', { exact: true })).not.toHaveValue(CLOUD.siteA);
});
m2Case('M2-13.cross-library', 'library B sees not found for library A connection ids', async ({ page }) => {
  const c = await canvasBinding('A'), b = await blackboardBinding('A');
  await portalSignIn(page, QA_B);
  await page.goto(`${APP}/integrations/canvas/${c.connection.id}`); await notFound(page, canvasValues(c));
  await page.goto(`${APP}/integrations/blackboard/${b.connection.id}`); await notFound(page, [b.deploymentId, b.connection.name]);
});
