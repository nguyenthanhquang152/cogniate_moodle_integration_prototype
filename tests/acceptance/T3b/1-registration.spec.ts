// T3b: a new dynamic registration from the real Moodle "Add LTI Advantage". QA stands in for the app page.
// Source: tasks/T3b.md AC-T3-01, -02, -03; contract §2.4, §3.8; ADR-009 (registration request, privacy anonymous).
// 2-update.spec.ts and 3-negative.spec.ts use the tool and platform that this file makes (state file).
import crypto from 'node:crypto';
import type { BrowserContext, Page } from '@playwright/test';
import { publicUrls } from '../lib/env';
import { ACCOUNT, apiKey, type ApiResult, auth, ltiApi, saveState } from '../lib/lti';
import { finishInFrame, type HeldRegistration, openManageTools, startRegistration, TOOL_REGISTER, toolSettings, toolTypeId } from '../lib/moodle-reg';
import { newStackContext } from '../lib/moodle-launch';
import { expect, test } from '../lib/pw';
import { seed } from '../lib/seed';

const urls = publicUrls();
const runId = `${Date.now().toString(36)}${crypto.randomBytes(2).toString('hex')}`;
const NAME = `QA dyn ${runId}`;
const REG_URL = `${urls.lti}/lti/register/${ACCOUNT}?ref=qa123`;

test.describe.serial('T3b new dynamic registration', () => {
  let context: BrowserContext;
  let page: Page;
  let held: HeldRegistration;

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(120_000);
    context = await newStackContext(browser);
    page = await context.newPage();
    await openManageTools(page, seed().users.admin);
    held = await startRegistration(context, page, REG_URL, 'new');
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test('AC-T3-01 the registration frame reaches {app}/tool/register?registrationId=…&ref=qa123 without registration_token and openid_configuration', async () => {
    const at = new URL(held.toolUrl);
    expect(`${at.origin}${at.pathname}`).toBe(TOOL_REGISTER);
    expect(held.registrationId, 'registrationId').not.toBe('');
    expect(at.searchParams.get('ref')).toBe('qa123');
    expect(at.searchParams.has('registration_token')).toBe(false);
    expect(at.searchParams.has('openid_configuration')).toBe(false);
    test.info().annotations.push({ type: 'choice page', description: held.sawChoice ? 'Moodle asked; QA chose "register as new"' : 'not shown' });
  });

  test('AC-T3-02 GET /api/registrations/<id> describes Moodle and a new, anonymous registration', async () => {
    const res = await ltiApi<Record<string, unknown>>('GET', `/api/registrations/${encodeURIComponent(held.registrationId)}`, { authorization: auth.bearer(apiKey(ACCOUNT)) });
    expect(res.status, res.body).toBe(200);
    const r = res.json;
    expect(r.url).toBe(urls.moodle);
    expect(r.familyCode).toBe('moodle');
    expect(String(r.version ?? '')).not.toBe('');
    expect(r.supportedScopes as string[]).toContain('https://purl.imsglobal.org/spec/lti-ags/scope/score');
    expect((r.supportedMessages as { type: string }[]).map((m) => m.type)).toContain('LtiDeepLinkingRequest');
    expect(r.privacyLevel).toBe('anonymous');
    expect(r.operation).toBe('new');
    expect(r.existingPlatformId).toBeNull();
  });

  test('AC-T3-03 complete → 200 {platformId, close html}; Moodle has a Pending tool with our URLs and privacy; the platform matches it', async () => {
    const res: ApiResult<{ platformId?: string; html?: string }> = await ltiApi('POST', `/api/registrations/${encodeURIComponent(held.registrationId)}/complete`, {
      authorization: auth.bearer(apiKey(ACCOUNT)),
      body: { platformName: NAME },
    });
    expect(res.status, res.body).toBe(200);
    const platformId = String(res.json.platformId ?? '');
    expect(platformId).not.toBe('');
    expect(String(res.json.html ?? '')).toContain('org.imsglobal.lti.close');
    await finishInFrame(page, held, String(res.json.html));

    const typeId = await toolTypeId(page, NAME);
    expect(typeId, `Moodle tool "${NAME}"`).toBeDefined();
    const t = await toolSettings(page, typeId!);
    await page.screenshot({ path: test.info().outputPath('tool-settings.png'), fullPage: true });
    expect(t.pending, 'the new tool is Pending').toBe(true);
    expect(t.name).toBe(NAME);
    expect(t.toolUrl).toBe(`${urls.lti}/lti/launch/${ACCOUNT}`);
    expect(t.keysetUrl).toBe(`${urls.lti}/lti/keys/${ACCOUNT}`);
    expect(t.loginUrl).toBe(`${urls.lti}/lti/login/${ACCOUNT}`);
    expect(t.deepLinking, 'deep linking on').toBe(true);
    expect(t.gradeSync, 'AGS "grade sync and column management" (2)').toBe('2');
    expect(t.sendName, 'share name Never (0)').toBe('0');
    expect(t.sendEmail, 'share email Never (0)').toBe('0');

    const p = await ltiApi<{ active: boolean; url: string; clientId: string; deploymentIds: string[] }>('GET', `/api/platforms/${encodeURIComponent(platformId)}`, {
      authorization: auth.bearer(apiKey(ACCOUNT)),
    });
    expect(p.status, p.body).toBe(200);
    expect(p.json.active).toBe(true);
    expect(p.json.url).toBe(urls.moodle);
    expect(p.json.clientId).toBe(t.clientId);
    expect(p.json.deploymentIds.map(String)).toEqual([String(typeId)]);
    saveState('T3b', { runId, name: NAME, regUrl: REG_URL, registrationId: held.registrationId, platformId, typeId, clientId: t.clientId, settings: t });
  });
});
