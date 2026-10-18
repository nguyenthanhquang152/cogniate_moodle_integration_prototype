// T3c: AC-T3-19, delete the seed platform. Source: tasks/T3c.md AC-T3-19 ("QA runs this AC last"); contract
// lti-service-api.md §3.9 (DELETE revokes its ltiks and service keys), §1.3 (401 codes); H9 (seed:lti-manual makes the
// platform again). Last file of the T3c pass. The host runner runs `npm run seed:lti-manual` (host channel).
import { hostAction } from '../lib/host-control';
import { ACCOUNT, apiKey, auth, errorCode, loadState, ltiApi, ltiSeed } from '../lib/lti';
import { launchActivity, newStackContext } from '../lib/moodle-launch';
import { expect, test } from '../lib/pw';
import { seed } from '../lib/seed';

test('AC-T3-19 DELETE /api/platforms/<seed platform> → 204; the old service key → 401 INVALID_SERVICE_AUTH_AUTHORIZATION_HEADER, the old ltik → 401; seed:lti-manual makes the platform again and a new launch works', async ({ browser }) => {
  test.setTimeout(900_000);
  const key = apiKey(ACCOUNT);
  const cmid = Number(loadState('T3a').cmid ?? 0);
  expect(cmid, 'T3a made the activity "QA DL"').toBeGreaterThan(0);
  const platformId = ltiSeed().platformId;
  expect(platformId, 'seed platform id').toBeTruthy();
  const context = await newStackContext(browser);
  try {
    const before = await launchActivity(context, seed().users.cg_student, cmid);
    const oldLtik = String(before.ltik ?? '');
    const t = await ltiApi<{ services: { serviceKey?: string } }>('GET', '/api/idtoken', { authorization: auth.ltik(key, oldLtik) });
    expect(t.status, t.body.slice(0, 200)).toBe(200);
    const oldServiceKey = String(t.json.services.serviceKey ?? '');
    expect(oldServiceKey).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const del = await ltiApi('DELETE', `/api/platforms/${encodeURIComponent(platformId)}`, { authorization: auth.bearer(key) });
    expect(del.status, del.body.slice(0, 200)).toBe(204);

    const bySk = await ltiApi('GET', '/api/lineitems', { authorization: auth.service(key, oldServiceKey) });
    expect(bySk.status, `old service key: ${bySk.body.slice(0, 200)}`).toBe(401);
    expect(errorCode(bySk)).toBe('INVALID_SERVICE_AUTH_AUTHORIZATION_HEADER');
    const byLtik = await ltiApi('GET', '/api/idtoken', { authorization: auth.ltik(key, oldLtik) });
    expect(byLtik.status, `old ltik: ${byLtik.body.slice(0, 200)}`).toBe(401);
    const gone = await ltiApi('GET', `/api/platforms/${encodeURIComponent(platformId)}`, { authorization: auth.bearer(key) });
    test.info().annotations.push({ type: 'after delete', description: `GET /api/platforms/<id> → ${gone.status} ${errorCode(gone) ?? ''}; old ltik → ${byLtik.status} ${errorCode(byLtik) ?? ''}` });

    await hostAction('seed-lti-manual', 840_000);
    const after = await launchActivity(context, seed().users.cg_student, cmid);
    const fresh = await ltiApi('GET', '/api/idtoken', { authorization: auth.ltik(key, String(after.ltik ?? '')) });
    expect(fresh.status, `a new launch after seed:lti-manual: ${fresh.body.slice(0, 200)}`).toBe(200);
    test.info().annotations.push({ type: 'platform', description: `before ${platformId}, after ${ltiSeed().platformId}` });
  } finally {
    await context.close();
  }
});
