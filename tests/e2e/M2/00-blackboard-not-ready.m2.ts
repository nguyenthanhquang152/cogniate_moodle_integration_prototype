// AC-M2-02 (runs first in a fresh M2 stack): the Blackboard card waits for the operator's shared application.
import { THANH } from '../../acceptance/lib/app';
import { BLACKBOARD, check, sharedPlatform } from '../../acceptance/M1/canvas/browser';
import { TEXT, admin, card, connectControl, expect, integrations, m2Case, next, portalSignIn, shot } from './lib/m2';

m2Case('M2-02.not-ready', 'without a blackboard-sim shared platform the Blackboard card shows the not-ready text and a disabled Connect', async ({ page }) => {
  const providers = await admin('GET', '/api/providers');
  const shared = providers.json?.profiles?.find((p: { id: string }) => p.id === BLACKBOARD.profile)?.sharedPlatform;
  if (shared) {
    // A fresh M2 stack has no shared platform. A leftover one without active deployments is removed (API key holder).
    const removed = await admin('DELETE', `/api/platforms/${shared.id}`);
    check(removed.status < 300, `M2-02 needs a fresh stack: DELETE of the shared platform answered ${removed.status}`);
  }
  await portalSignIn(page, THANH); await integrations(page);
  const bb = card(page, TEXT.blackboardCard);
  await expect(bb.getByText(TEXT.blackboardNotReady, { exact: true })).toBeVisible();
  await expect(connectControl(bb).first()).toBeDisabled();
  await shot(page, 'm2-02-blackboard-not-ready');
});

m2Case('M2-02.ready', 'after the shared platform exists, Connect works and step 2 shows the Client ID qa-bb-app', async ({ page }) => {
  await sharedPlatform();
  await portalSignIn(page, THANH); await integrations(page);
  const bb = card(page, TEXT.blackboardCard);
  await expect(bb.getByText(TEXT.blackboardNotReady, { exact: true })).toHaveCount(0);
  await expect(connectControl(bb).first()).toBeEnabled();
  await connectControl(bb).first().click();
  await page.waitForURL(/\/integrations\/blackboard\/connect$/);
  await page.getByLabel('Connection name', { exact: true }).fill('M2-02 ready check');
  await page.getByLabel('Learn URL', { exact: true }).fill(BLACKBOARD.siteA);
  await next(page);
  await expect(page.getByRole('heading', { name: TEXT.blackboardStep2 })).toBeVisible();
  await expect(page.getByText(BLACKBOARD.clientId, { exact: true }).first()).toBeVisible();
  await shot(page, 'm2-02-blackboard-step2');
});
