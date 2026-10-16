// T2a in-container browser: launches against a changed seed platform. Source: tasks/T2a.md AC-T2-14, AC-T2-15;
// security §2.1 (login checks 2 and 3), §2.2 (check 9). Each test restores the seed platform, also on failure.
import type { BrowserContext } from '@playwright/test';
import { ACCOUNT, apiKey, auth, checkErrorPage, ltiApi, ltiSeed } from '../lib/lti';
import { type LaunchCapture, launchActivity, newStackContext } from '../lib/moodle-launch';
import { expect, test } from '../lib/pw';
import { seed } from '../lib/seed';

interface Platform {
  deploymentIds: string[];
  active: boolean;
}

async function patchSeedPlatform(body: Partial<Platform>): Promise<void> {
  const res = await ltiApi('PATCH', `/api/platforms/${encodeURIComponent(ltiSeed().platformId)}`, { authorization: auth.bearer(apiKey(ACCOUNT)), body });
  expect(res.status, `PATCH ${JSON.stringify(body)}: ${res.body}`).toBe(200);
}

async function seedPlatform(): Promise<Platform> {
  const res = await ltiApi<Platform>('GET', `/api/platforms/${encodeURIComponent(ltiSeed().platformId)}`, { authorization: auth.bearer(apiKey(ACCOUNT)) });
  expect(res.status).toBe(200);
  return res.json;
}

function errorProblems(cap: LaunchCapture, code: string, test: string): string[] {
  if (!cap.errorPage) return [`no error page (final URL ${cap.finalUrl ?? 'none'}, launch status ${cap.launch?.status ?? 'none'})`];
  return checkErrorPage(cap.errorPage, code, { statuses: [400, 401, 403], test, endpoint: cap.errorPage.endpoint });
}

test.describe.serial('T2a seed platform state', () => {
  let context: BrowserContext;
  let original: Platform;

  test.beforeAll(async ({ browser }) => {
    context = await newStackContext(browser);
    original = await seedPlatform();
  });

  test.afterAll(async () => {
    if (original) await patchSeedPlatform({ deploymentIds: original.deploymentIds, active: original.active });
    await context?.close();
  });

  test('AC-T2-14 unknown deployment: deploymentIds ["999"] → launch shows UNKNOWN_DEPLOYMENT; restored → launch works', async () => {
    const cmid = ltiSeed().cmids['COGNIATE-DEV-101'];
    try {
      await patchSeedPlatform({ deploymentIds: ['999'] });
      const bad = await launchActivity(context, seed().users.cg_student, cmid, { untilError: true });
      expect(errorProblems(bad, 'UNKNOWN_DEPLOYMENT', 'AC-T2-14')).toEqual([]);
    } finally {
      await patchSeedPlatform({ deploymentIds: original.deploymentIds });
    }
    const good = await launchActivity(context, seed().users.cg_student, cmid);
    expect(good.ltik ?? '').toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  test('AC-T2-15 inactive platform: active=false → launch shows PLATFORM_NOT_ACTIVE; active=true → launch works', async () => {
    const cmid = ltiSeed().cmids['COGNIATE-DEV-101'];
    try {
      await patchSeedPlatform({ active: false });
      const bad = await launchActivity(context, seed().users.cg_student, cmid, { untilError: true });
      expect(errorProblems(bad, 'PLATFORM_NOT_ACTIVE', 'AC-T2-15')).toEqual([]);
    } finally {
      await patchSeedPlatform({ active: true });
    }
    const good = await launchActivity(context, seed().users.cg_student, cmid);
    expect(good.ltik ?? '').toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});
