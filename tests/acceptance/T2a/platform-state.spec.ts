// T2a in-container browser: launches against a changed seed platform. Source: tasks/T2a.md AC-T2-14, AC-T2-15
// (incl. the 8f10cb2 text: switched off between login and launch); security §2.1 (login checks 2 and 3), §2.2
// (check 9, run order 1, 3, 2, ...). Each test restores the seed platform, also on failure.
import type { BrowserContext } from '@playwright/test';
import { ACCOUNT, apiKey, auth, checkErrorPage, LAUNCH_URL, ltiApi, ltiSeed, waitForEvent } from '../lib/lti';
import { type LaunchCapture, launchActivity, newStackContext, postForm } from '../lib/moodle-launch';
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

  test('AC-T2-15 switched off between login and launch (QA holds the id_token POST) → PLATFORM_NOT_ACTIVE, launch_check_failed {check: "platform_active"}, the state is used up', async () => {
    // QA holds Moodle's id_token POST (not the redirect to auth.php: Playwright routes do not see redirected
    // requests). The login has passed, the launch has not reached the service: this is "between login and launch".
    const cmid = ltiSeed().cmids['COGNIATE-DEV-101'];
    const held = await launchActivity(context, seed().users.cg_student, cmid, { hold: true });
    expect(held.login?.status, 'the login ran while the platform was active (302 to auth.php)').toBe(302);
    const fields = { id_token: held.post!.id_token, state: held.post!.state };
    let res: Awaited<ReturnType<typeof postForm>>;
    try {
      await patchSeedPlatform({ active: false });
      res = await postForm(await context.newPage(), LAUNCH_URL, fields);
    } finally {
      await patchSeedPlatform({ active: true });
    }
    expect(checkErrorPage(res, 'PLATFORM_NOT_ACTIVE', { statuses: [400, 401, 403], test: 'AC-T2-15', endpoint: 'launch' })).toEqual([]);
    const event = await waitForEvent('lti-service', (e) => e.event === 'launch_check_failed' && e.trace_id === res.traceId);
    expect(event, `launch_check_failed with trace id ${res.traceId}`).toBeDefined();
    expect(String(event!.check)).toBe('platform_active');
    // The state is used up: the platform is active again, and the same id_token + state + cookie get INVALID_STATE
    // (check 1 runs first). If the state were still unused, this POST would be a normal 303 launch.
    const replay = await postForm(await context.newPage(), LAUNCH_URL, fields);
    expect(checkErrorPage(replay, 'INVALID_STATE', { test: 'AC-T2-15', endpoint: 'launch' })).toEqual([]);
    const replayEvent = await waitForEvent('lti-service', (e) => e.event === 'launch_check_failed' && e.trace_id === replay.traceId);
    expect(String(replayEvent?.check), 'check of the replay').toBe('1');
  });
});
