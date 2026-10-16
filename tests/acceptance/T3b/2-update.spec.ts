// T3b: "update existing tool". The service refuses a foreign update before anything goes to Moodle, and accepts the
// update of its own platform. Source: tasks/T3b.md AC-T3-25, -26; security §2.5; contract §3.8.
import type { BrowserContext, Page } from '@playwright/test';
import { ACCOUNT, apiKey, auth, errorCode, loadState, ltiApi, ltiSeed, waitForEvent } from '../lib/lti';
import { finishInFrame, type HeldRegistration, openManageTools, startRegistration, type ToolSettings, toolSettings } from '../lib/moodle-reg';
import { newStackContext } from '../lib/moodle-launch';
import { expect, test } from '../lib/pw';
import { seed } from '../lib/seed';

test.describe.serial('T3b update of the "QA dyn" tool', () => {
  let context: BrowserContext;
  let page: Page;
  let held: HeldRegistration;
  let typeId = 0;
  let platformId = '';
  let before: ToolSettings;

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(120_000);
    const state = loadState('T3b');
    typeId = Number(state.typeId ?? 0);
    platformId = String(state.platformId ?? '');
    expect(typeId && platformId, 'AC-T3-03 made the "QA dyn" tool (1-registration.spec.ts)').toBeTruthy();
    context = await newStackContext(browser);
    page = await context.newPage();
    await openManageTools(page, seed().users.admin);
    before = await toolSettings(page, typeId);
    await page.goto(page.url().replace(/typessettings\.php.*$/, 'toolconfigure.php'));
    await page.locator('#tool-url').waitFor();
    held = await startRegistration(context, page, String(state.regUrl), { updateTypeId: typeId });
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test('AC-T3-25 update of "QA dyn" without the matching updatePlatformId → 409 REGISTRATION_UPDATE_NOT_ALLOWED; Moodle unchanged', async () => {
    expect(held.sawChoice, 'Moodle showed the "update or register new" page').toBe(true);
    const key = apiKey(ACCOUNT);
    const reg = await ltiApi<{ operation: string; existingPlatformId: string | null }>('GET', `/api/registrations/${encodeURIComponent(held.registrationId)}`, { authorization: auth.bearer(key) });
    expect(reg.status, reg.body).toBe(200);
    expect(reg.json.operation).toBe('update');
    expect(reg.json.existingPlatformId).toBe(platformId);

    for (const [label, body] of [
      ['no updatePlatformId', { platformName: before.name }],
      ['another platform id', { platformName: before.name, updatePlatformId: ltiSeed().platformId }],
    ] as const) {
      const res = await ltiApi('POST', `/api/registrations/${encodeURIComponent(held.registrationId)}/complete`, { authorization: auth.bearer(key), body });
      expect(res.status, `${label}: ${res.body}`).toBe(409);
      expect(errorCode(res), label).toBe('REGISTRATION_UPDATE_NOT_ALLOWED');
      const ev = await waitForEvent('lti-service', (e) => e.event === 'registration_rejected' && e.trace_id === res.traceId);
      expect(ev, `${label}: registration_rejected with trace id ${res.traceId}`).toBeDefined();
    }
    const tab = await context.newPage();
    const after = await toolSettings(tab, typeId);
    await tab.close();
    expect(after, 'the Moodle tool is unchanged (name, URLs, privacy, state, client id)').toEqual(before);
  });

  test('AC-T3-26 update with updatePlatformId = existingPlatformId → 200; same client id and platform id; registration_completed {operation: update}', async () => {
    const res = await ltiApi<{ platformId?: string; html?: string }>('POST', `/api/registrations/${encodeURIComponent(held.registrationId)}/complete`, {
      authorization: auth.bearer(apiKey(ACCOUNT)),
      body: { platformName: before.name, updatePlatformId: platformId },
    });
    expect(res.status, res.body).toBe(200);
    expect(res.json.platformId).toBe(platformId);
    const ev = await waitForEvent('lti-service', (e) => e.event === 'registration_completed' && e.trace_id === res.traceId);
    expect(ev?.operation, 'registration_completed operation').toBe('update');
    await finishInFrame(page, held, String(res.json.html));

    const after = await toolSettings(page, typeId);
    expect(after.clientId, 'Moodle keeps the client id').toBe(before.clientId);
    const p = await ltiApi<{ id: string; clientId: string }>('GET', `/api/platforms/${encodeURIComponent(platformId)}`, { authorization: auth.bearer(apiKey(ACCOUNT)) });
    expect(p.status).toBe(200);
    expect(p.json.clientId).toBe(before.clientId);
  });
});
