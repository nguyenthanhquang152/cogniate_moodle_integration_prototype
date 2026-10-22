// LA-E1-09 AC-04 (app API delta §4, LA-ADR-01 D9): the app serves the portal for /integrations/<id>/connect and
// /integrations/<id>/<connectionId> for every registry channel id; an id that is not in the registry keeps the answer
// of an unknown path.
import type { ChannelManifest } from '@cogniate/channel-kernel';
import { buildChannelRegistry } from '@cogniate/channel-kernel';
import { afterEach, expect, it } from 'vitest';
import type { TestApp } from '../testkit.ts';
import { TEST_CHANNELS, THANH, testApp } from '../testkit.ts';

const probe: ChannelManifest = {
  ...TEST_CHANNELS.channel('moodle')!, id: 'zz-portal', names: { text: 'your LMS', label: 'ZZ portal' },
  registration: [{ method: 'manual', authority: 'operatorGrant', profiles: ['zz-portal-profile'], defaultProfile: 'zz-portal-profile' }],
  lti: { guardedFamilies: [], toolConfiguration: 'none' },
};
const channels = buildChannelRegistry([...TEST_CHANNELS.channels(), probe]
  .map((manifest) => ({ folder: `/test/${manifest.id}`, manifest, appAdapter: TEST_CHANNELS.appAdapter(manifest.id) ?? undefined })), { simulations: true });

let t: TestApp;
afterEach(async () => {
  await t?.app.close();
});

const get = (url: string, cookie?: string) => t.app.inject({ method: 'GET', url, headers: cookie ? { cookie } : {} });

it('AC-LA-E1-09-04: every registry channel id, a test channel included, gets the portal routes', async () => {
  t = await testApp({ channels });
  const cookie = await t.login(THANH);
  const ids = channels.channels().map((m) => m.id);
  expect(ids).toEqual(expect.arrayContaining(['moodle', 'canvas', 'blackboard', 'zz-portal']));
  for (const id of ids) {
    for (const path of [`/integrations/${id}/connect`, `/integrations/${id}/con_example`]) {
      const anonymous = await get(path);
      expect([path, anonymous.statusCode, anonymous.headers.location]).toEqual([path, 302, '/signin']);
      const page = await get(path, cookie);
      // 200 with the built portal, 503 "not built" without it: in both cases the portal route answers.
      expect([path, [200, 503].includes(page.statusCode)]).toEqual([path, true]);
      expect(page.headers['content-security-policy']).toContain("frame-ancestors 'none'");
      expect(page.headers['cache-control']).toBe('no-store');
    }
  }
});

it('AC-LA-E1-09-04: an id that is not in the registry keeps the unknown-path answer, with or without a session', async () => {
  t = await testApp();
  const cookie = await t.login(THANH);
  const unknown = await get('/no-such-portal-path');
  expect(unknown.statusCode).toBe(404);
  for (const path of ['/integrations/zz-portal/connect', '/integrations/zz-portal/con_example', '/integrations/__proto__/connect', '/integrations/connect/connect']) {
    for (const session of [undefined, cookie]) {
      const r = await get(path, session);
      expect([path, r.statusCode, r.json()]).toEqual([path, 404, unknown.json()]);
      expect(r.headers.location).toBeUndefined();
      expect(r.headers['content-security-policy']).toBe(unknown.headers['content-security-policy']);
    }
  }
});
