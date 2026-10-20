// AC-M2-11: keyboard-only wizards and add-deployment form, visible focus, announced status, axe (no serious/critical).
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { THANH } from '../../acceptance/lib/app';
import {
  APP, BLACKBOARD, CLOUD, canvasBinding, canvasClientId, canvasDeploymentId, check, issueGrant, session, sharedPlatform, unique,
} from '../../acceptance/M1/canvas/browser';
import {
  ERR, TEXT, blackboardGrantFor, blackboardStep1, canvasGrantFor, canvasStep1, connection, expect, m2Case, newestByName, next,
  pendingWizard, portalSignIn, shot,
} from './lib/m2';

/** Presses Tab (or Shift+Tab) until the focused element matches; checks the focus is visible. */
async function tabTo(page: Page, name: RegExp, back = false, max = 80) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press(back ? 'Shift+Tab' : 'Tab');
    const focused = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return null;
      const label = el.getAttribute('aria-label') ?? (el as HTMLInputElement).labels?.[0]?.textContent ?? el.textContent ?? '';
      const style = getComputedStyle(el);
      const visible = (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0) || style.boxShadow !== 'none';
      return { label: label.replace(/\s+/g, ' ').trim(), visible, tag: el.tagName };
    });
    if (focused && name.test(focused.label)) {
      check(focused.visible, `Visible focus on "${focused.label}"`);
      return;
    }
  }
  throw new Error(`Keyboard focus never reached ${name}`);
}
/** Retrying readiness before the first Tab: the form renders after its data loads. No focus, click or fill. */
async function formReady(page: Page, firstField: string) {
  await expect(page.getByLabel(firstField, { exact: true })).toBeVisible();
}
async function liveText(page: Page, text: string | RegExp) {
  const region = page.locator('[role="status"], [role="alert"], [aria-live]:not([aria-live="off"])').filter({ hasText: text });
  await expect(region.first(), 'Status change is announced').toBeVisible();
}
async function axe(page: Page, label: string) {
  const result = await new AxeBuilder({ page }).analyze();
  const bad = result.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(bad.map((v) => `${v.id} (${v.impact}) on ${label}`)).toEqual([]);
}

m2Case('M2-11.canvas-keyboard', 'the Canvas wizard works with the keyboard only and announces its status', async ({ page }) => {
  const s = await session('A'), name = unique('Canvas keyboard');
  await portalSignIn(page, THANH); await page.goto(`${APP}/integrations/canvas/connect`);
  await formReady(page, 'Connection name');
  await tabTo(page, /^Connection name/); await page.keyboard.type(name);
  await tabTo(page, /^Canvas URL/); await page.keyboard.type(CLOUD.siteA);
  await tabTo(page, /^Canvas type/); await page.keyboard.press('End');
  await tabTo(page, /^Canvas URL/, true); await tabTo(page, /^Next$/);
  await page.keyboard.press('Enter');
  await pendingWizard(page, 'canvas'); // setup and approval together; no second Next (B-M3-01)
  const c = await newestByName(s, name, 'canvas'), clientId = canvasClientId(), deploymentId = canvasDeploymentId();
  await tabTo(page, /^Client ID/); await page.keyboard.type(clientId);
  await tabTo(page, /^Deployment ID/); await page.keyboard.type(deploymentId);
  await tabTo(page, /^Save$/); await page.keyboard.press('Space');
  await liveText(page, ERR.invalidValues);
  const grant = await canvasGrantFor(s, c, clientId, deploymentId);
  await tabTo(page, /^Approval code/, true); await page.keyboard.type(grant.code);
  await tabTo(page, /^Save$/); await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: TEXT.canvasStep4 })).toBeVisible({ timeout: 30_000 });
  expect((await connection(s, c.id)).status).toBe('registered');
});
m2Case('M2-11.blackboard-keyboard', 'the Blackboard wizard works with the keyboard only and announces its status', async ({ page }) => {
  await sharedPlatform();
  const s = await session('A'), name = unique('Blackboard keyboard');
  await portalSignIn(page, THANH); await page.goto(`${APP}/integrations/blackboard/connect`);
  await formReady(page, 'Connection name');
  await tabTo(page, /^Connection name/); await page.keyboard.type(name);
  await tabTo(page, /^Learn URL/); await page.keyboard.type(BLACKBOARD.siteA);
  await tabTo(page, /^Next$/); await page.keyboard.press('Enter');
  await pendingWizard(page, 'blackboard'); // setup and approval together; no second Next (B-M3-01)
  const c = await newestByName(s, name, 'blackboard'), deploymentId = unique('bb-key');
  await tabTo(page, /^Deployment ID/); await page.keyboard.type(deploymentId);
  await tabTo(page, /^Save$/); await page.keyboard.press('Enter');
  await liveText(page, ERR.invalidValues);
  const grant = await blackboardGrantFor(s, c, deploymentId);
  await tabTo(page, /^Approval code/, true); await page.keyboard.type(grant.code);
  await tabTo(page, /^Save$/); await page.keyboard.press('Space');
  await expect(page.getByRole('heading', { name: TEXT.blackboardStep4 })).toBeVisible({ timeout: 30_000 });
  expect((await connection(s, c.id)).status).toBe('registered');
});
m2Case('M2-11.add-deployment-keyboard', 'the Canvas add-deployment form works with the keyboard only', async ({ page }) => {
  const b = await canvasBinding('A'), second = canvasDeploymentId();
  const grant = await issueGrant(b.s, b.connection, { 'client-id': b.clientId, 'deployment-id': second, 'service-url': b.connection.serviceUrl, purpose: 'add_deployment' });
  await portalSignIn(page, THANH); await page.goto(`${APP}/integrations/canvas/${b.connection.id}`);
  await formReady(page, 'Deployment ID');
  await tabTo(page, /^Deployment ID/); await page.keyboard.type(second);
  await tabTo(page, /^Approval code/); await page.keyboard.type(grant.code);
  await tabTo(page, /^Add deployment ID$/); await page.keyboard.press('Enter');
  await expect(page.getByText(second).first()).toBeVisible({ timeout: 30_000 });
  expect([...(await connection(b.s, b.connection.id)).platform.deploymentIds].sort()).toEqual([b.deploymentId, second].sort());
});
m2Case('M2-11.axe-canvas', 'axe finds no serious or critical issue on Canvas steps 1 to 3', async ({ page }) => {
  await portalSignIn(page, THANH);
  await canvasStep1(page, { name: unique('axe canvas'), site: CLOUD.siteA }); await axe(page, 'Canvas step 1');
  // Steps 2 and 3 render together on the pending connection page; one analysis covers both sections.
  await next(page); await pendingWizard(page, 'canvas'); await axe(page, 'Canvas steps 2 and 3');
  await shot(page, 'm2-11-axe-canvas-step3');
});
m2Case('M2-11.axe-blackboard', 'axe finds no serious or critical issue on Blackboard steps 1 to 3', async ({ page }) => {
  await sharedPlatform(); await portalSignIn(page, THANH);
  await blackboardStep1(page, { name: unique('axe bb'), site: BLACKBOARD.siteA }); await axe(page, 'Blackboard step 1');
  await next(page); await pendingWizard(page, 'blackboard'); await axe(page, 'Blackboard steps 2 and 3');
});
m2Case('M2-11.axe-canvas-detail', 'axe finds no serious or critical issue on the Canvas connection detail', async ({ page }) => {
  const b = await canvasBinding('A');
  await portalSignIn(page, THANH); await page.goto(`${APP}/integrations/canvas/${b.connection.id}`);
  await expect(page.getByText(CLOUD.siteA).first()).toBeVisible();
  await axe(page, 'Canvas connection detail');
});
