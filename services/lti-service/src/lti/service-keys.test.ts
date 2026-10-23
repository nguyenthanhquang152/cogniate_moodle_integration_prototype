// LA-E3-03 (LA-ADR-05 D2): a launch without a context gets a service key with context id "" in its scope.
import { afterEach, describe, expect, it } from 'vitest';
import { openDb } from '../db/index.ts';
import { ensureAccount } from '../store/accounts.ts';
import type { LaunchRecord } from '../store/launches.ts';
import { createPlatform } from '../store/platforms.ts';
import { findServiceKey } from '../store/service-keys.ts';
import { ensureToolKey } from '../store/tool-keys.ts';
import { CLIENT_ID, ISSUER, MASTER_KEY, URLS, doLogin, harness, moodleClaims, postLaunch, sign } from '../testkit.ts';
import { CLAIM } from './checks.ts';
import { serviceKeyForLaunch } from './service-keys.ts';

const AGS = { scope: ['https://purl.imsglobal.org/spec/lti-ags/scope/score'], lineitem: `${ISSUER}/mod/lti/services.php/2/lineitems/7/lineitem?type_id=1` };
const NRPS = { context_memberships_url: `${ISSUER}/mod/lti/services.php/CourseSection/2/bindings/1/memberships`, service_versions: ['2.0'] };

async function setup() {
  const db = openDb(':memory:');
  ensureAccount(db, { id: 'cogniate', name: 'Cogniate', appUrl: URLS.app });
  await ensureToolKey(db, MASTER_KEY, 'cogniate');
  const platform = createPlatform(db, 'cogniate', {
    issuer: ISSUER, clientId: CLIENT_ID, name: 'Moodle', authEndpoint: `${ISSUER}/a`, tokenEndpoint: `${ISSUER}/t`, jwksUrl: `${ISSUER}/k`, deploymentIds: ['1', '2'], active: true,
  });
  let n = 0;
  /** A resource link launch of activity rl-3 with AGS and no context claim; `claims` and `over` change it. */
  const launch = (claims: Record<string, unknown> = {}, over: Partial<LaunchRecord> = {}): LaunchRecord => ({
    id: `lch_${++n}`, toolAccountId: 'cogniate', platformId: platform.id, deploymentId: '1', messageType: 'LtiResourceLinkRequest',
    claims: { sub: `user-${n}`, [CLAIM.ags]: AGS, [CLAIM.resourceLink]: { id: 'rl-3' }, ...claims },
    expiresAt: 0, siteOrigin: null, serviceOrigin: null, bindingGeneration: 0, ...over,
  });
  const key = async (l: LaunchRecord) => (await serviceKeyForLaunch(db, MASTER_KEY, l, 1000));
  return { db, platform, launch, key };
}

describe('serviceKeyForLaunch without a context (LA-ADR-05 D2)', () => {
  it('two launches of the same activity get the same key; context "c1" gives another (AC-LA-E3-03-07)', async () => {
    const s = await setup();
    const first = (await s.key(s.launch()));
    const second = (await s.key(s.launch()));
    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(second).toBe(first);
    const withContext = (await s.key(s.launch({ [CLAIM.context]: { id: 'c1' } })));
    expect(withContext).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(withContext).not.toBe(first);
    expect(findServiceKey(s.db, 'cogniate', first!)).toMatchObject({ deploymentId: '1', contextId: '', resourceLinkId: 'rl-3', agsClaim: AGS });
    expect(findServiceKey(s.db, 'cogniate', withContext!)).toMatchObject({ contextId: 'c1', resourceLinkId: 'rl-3' });
  });

  it('the scope keeps the deployment and the resource link: each gives another key', async () => {
    const s = await setup();
    const base = (await s.key(s.launch()));
    const otherDeployment = (await s.key(s.launch({}, { deploymentId: '2' })));
    const otherLink = (await s.key(s.launch({ [CLAIM.resourceLink]: { id: 'rl-4' } })));
    expect(new Set([base, otherDeployment, otherLink]).size).toBe(3);
    expect(s.db.prepare('SELECT deployment_id, context_id, resource_link_id FROM service_key ORDER BY deployment_id, resource_link_id').all()).toEqual([
      { deployment_id: '1', context_id: '', resource_link_id: 'rl-3' },
      { deployment_id: '1', context_id: '', resource_link_id: 'rl-4' },
      { deployment_id: '2', context_id: '', resource_link_id: 'rl-3' },
    ]);
  });

  it('an NRPS claim alone also gives a key; no AGS and no NRPS gives none', async () => {
    const s = await setup();
    expect((await s.key(s.launch({ [CLAIM.ags]: undefined, [CLAIM.nrps]: NRPS })))).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect((await s.key(s.launch({ [CLAIM.ags]: undefined })))).toBeUndefined();
  });

  it('a context claim that is not an object counts as no context, as in GET /api/idtoken', async () => {
    const s = await setup();
    const none = (await s.key(s.launch()));
    expect(none).toMatch(/^[A-Za-z0-9_-]{43}$/);
    for (const context of [null, 'c1', ['c1']]) expect((await s.key(s.launch({ [CLAIM.context]: context })))).toBe(none);
  });

  it('a context object without a string id, or a launch without a resource link id, gives no key (as before)', async () => {
    const s = await setup();
    expect((await s.key(s.launch({ [CLAIM.context]: {} })))).toBeUndefined();
    expect((await s.key(s.launch({ [CLAIM.context]: { id: 7 } })))).toBeUndefined();
    expect((await s.key(s.launch({ [CLAIM.resourceLink]: undefined })))).toBeUndefined();
    expect((await s.key(s.launch({ [CLAIM.resourceLink]: { title: 'x' } })))).toBeUndefined();
    expect(s.db.prepare('SELECT COUNT(*) AS n FROM service_key').get()).toEqual({ n: 0 });
  });
});

describe('GET /api/idtoken of a launch without a context', () => {
  const close: Array<() => Promise<void>> = [];
  afterEach(async () => { for (const fn of close.splice(0)) await fn(); });

  it('has services.serviceKey and no launch.context (AC-LA-E3-03-02 at unit level)', async () => {
    const h = await harness();
    close.push(async () => { await h.app.close(); h.db.close(); });
    const { state, nonce, cookie } = await doLogin(h);
    const claims = moodleClaims({ nonce, [CLAIM.ags]: AGS }, Math.floor(h.clock.now / 1000));
    delete claims[CLAIM.context];
    const res = await postLaunch(h, { state, id_token: await sign(h.key, claims) }, cookie);
    expect(res.statusCode).toBe(303);
    const ltik = new URL(String(res.headers.location)).searchParams.get('ltik')!;
    const token = await h.app.inject({ method: 'GET', url: '/api/idtoken', headers: { authorization: `LTIK-AUTH-V2 ${h.apiKey}:${ltik}` } });
    expect(token.statusCode).toBe(200);
    const body = token.json() as { launch: Record<string, unknown>; services: { serviceKey?: string; assignmentAndGrades: unknown } };
    expect(body.launch).not.toHaveProperty('context');
    expect(body.launch.resourceLink).toMatchObject({ id: '3' });
    expect(body.services.serviceKey).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(body.services.assignmentAndGrades).toEqual({ available: true, lineItemId: AGS.lineitem });
    expect(findServiceKey(h.db, 'cogniate', body.services.serviceKey!)).toMatchObject({ platformId: h.platform.id, deploymentId: '1', contextId: '', resourceLinkId: '3' });
  });
});
