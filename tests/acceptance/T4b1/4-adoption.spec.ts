// T4b1: no adoption of an existing platform. Source: tasks/T4b1.md AC-T4-36 (2cf7d33); security §2.6 (platform
// ownership: manual connect binds only a platform created in that call); contract cogniate-app-api.md §4
// (PUT …/platform → 409 PLATFORM_IN_USE).
// Runs after 1-connect.spec.ts (Thanh's dynamic tool, library B's manual connection of AC-T4-10). Parts (1) and (2)
// use a fresh pending manual connection of library B, because AC-T4-36 says "library B's connection stays pending".
// Spec note: the contract row also says PUT on a connection that is not pending → 409 CONNECTION_NOT_PENDING, while
// part (3) expects 200 for a repeat of the same call; QA tests the AC (security §2.6 agrees with it).
import { appApi, QA_B, signIn, THANH } from '../lib/app';
import { publicUrls } from '../lib/env';
import { ACCOUNT, apiKey, auth, loadState, ltiApi, ltiSeed } from '../lib/lti';
import { launchActivity, newStackContext } from '../lib/moodle-launch';
import { openManageTools, type ToolDetails, toolDetails } from '../lib/moodle-reg';
import { expect, test } from '../lib/pw';
import { seed } from '../lib/seed';

const urls = publicUrls();
const sixOf = (d: ToolDetails) => ({
  issuer: d.platformId,
  clientId: d.clientId,
  deploymentId: d.deploymentId,
  authenticationEndpoint: d.authRequestUrl,
  accessTokenEndpoint: d.accessTokenUrl,
  jwksUrl: d.publicKeysetUrl,
});

interface Connection {
  id: string;
  status: string;
  platform: { id: string } | null;
}

test('AC-T4-36 no adoption: the seed tool and Thanh\'s tool values → 409 PLATFORM_IN_USE (nothing changes, the seed launch still works); library B\'s own PUT again → 200, same platform', async ({ browser }) => {
  test.setTimeout(240_000);
  const st = loadState('T4b') as { thanhTypeId?: number; thanhConnectionId?: string; thanhPlatformId?: string; bManualConnectionId?: string; bManualTypeId?: number };
  expect(st.thanhTypeId && st.thanhConnectionId && st.bManualConnectionId && st.bManualTypeId, 'T4b1 state (AC-T4-08, AC-T4-10)').toBeTruthy();
  const s = ltiSeed();
  const b = await signIn(QA_B);
  const thanh = await signIn(THANH);
  const key = apiKey(ACCOUNT);
  const context = await newStackContext(browser);
  try {
    const page = await context.newPage();
    await openManageTools(page, seed().users.admin);
    const seedSix = sixOf(await toolDetails(page, s.typeId));
    const thanhSix = sixOf(await toolDetails(page, Number(st.thanhTypeId)));
    const bSix = sixOf(await toolDetails(page, Number(st.bManualTypeId)));
    await page.close();

    const fresh = await appApi<Connection>('POST', '/app-api/connections', { cookie: b.cookie, body: { name: `QA adoption ${Date.now().toString(36)}`, siteUrl: urls.moodle, method: 'manual' } });
    expect(fresh.status, fresh.body).toBe(201);
    const freshId = fresh.json.id;

    // (1) The dev seed tool "Cogniate (seed)".
    const r1 = await appApi('PUT', `/app-api/connections/${freshId}/platform`, { cookie: b.cookie, body: seedSix });
    expect(r1.status, r1.body.slice(0, 200)).toBe(409);
    expect(String((r1.json as { details?: { message?: string } })?.details?.message)).toBe('PLATFORM_IN_USE');
    expect((await appApi<Connection>('GET', `/app-api/connections/${freshId}`, { cookie: b.cookie })).json.status, 'library B\'s connection stays pending').toBe('pending');
    const seedPlatform = await ltiApi<{ active: boolean }>('GET', `/api/platforms/${encodeURIComponent(s.platformId)}`, { authorization: auth.bearer(key) });
    expect(seedPlatform.json.active, 'the seed platform stays active').toBe(true);
    const launch = await launchActivity(context, seed().users.cg_student, s.cmids['COGNIATE-DEV-101']);
    expect(launch.ltik ?? '', 'a seed launch still works').toMatch(/^[A-Za-z0-9_-]{43}$/);

    // (2) Thanh's dynamically registered tool.
    const thanhBefore = (await appApi<Connection>('GET', `/app-api/connections/${st.thanhConnectionId}`, { cookie: thanh.cookie })).json;
    const r2 = await appApi('PUT', `/app-api/connections/${freshId}/platform`, { cookie: b.cookie, body: thanhSix });
    expect(r2.status, r2.body.slice(0, 200)).toBe(409);
    expect(String((r2.json as { details?: { message?: string } })?.details?.message)).toBe('PLATFORM_IN_USE');
    const thanhAfter = (await appApi<Connection>('GET', `/app-api/connections/${st.thanhConnectionId}`, { cookie: thanh.cookie })).json;
    expect({ status: thanhAfter.status, platform: thanhAfter.platform?.id }, 'Thanh\'s connection and platform are unchanged').toEqual({ status: thanhBefore.status, platform: thanhBefore.platform?.id });
    const thanhPlatform = await ltiApi<{ active: boolean }>('GET', `/api/platforms/${encodeURIComponent(String(thanhBefore.platform?.id ?? st.thanhPlatformId))}`, { authorization: auth.bearer(key) });
    expect(thanhPlatform.json.active, 'Thanh\'s platform stays active').toBe(true);

    // (3) Library B's own successful PUT (AC-T4-10) again → 200, the same platform.
    const bBefore = (await appApi<Connection>('GET', `/app-api/connections/${st.bManualConnectionId}`, { cookie: b.cookie })).json;
    const r3 = await appApi<Connection>('PUT', `/app-api/connections/${st.bManualConnectionId}/platform`, { cookie: b.cookie, body: bSix });
    expect(r3.status, r3.body.slice(0, 200)).toBe(200);
    expect(r3.json.platform?.id ?? (await appApi<Connection>('GET', `/app-api/connections/${st.bManualConnectionId}`, { cookie: b.cookie })).json.platform?.id, 'same platform').toBe(bBefore.platform?.id);
  } finally {
    await context.close();
  }
});
