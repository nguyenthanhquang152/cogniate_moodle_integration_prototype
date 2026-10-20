// M1 LTI service behaviour (contract §9, ADR-011): profiles, platforms, deployments, binding refs, login and launch
// changes, claim allowlist, generations and the providers API. Canvas profile DATA is owned by the Canvas
// implementer; these engine tests use a test copy of the two Canvas rows they need (vi.mock below).
import { decodeJwt } from 'jose';
import { describe, expect, it, vi } from 'vitest';
import type { Harness } from '../../testkit.ts';
import { CLIENT_ID, ISSUER, LAUNCH, MASTER_KEY, URLS, harness, postLaunch, sign } from '../../testkit.ts';
import { CLAIM } from '../../lti/checks.ts';
import { deriveServiceKey } from '../../store/service-keys.ts';
import { createPlatform } from '../../store/platforms.ts';
import { ensureSharedPlatform } from '../../cli/shared-platform.ts';
import type { ProtocolErrorCode } from '../../lti/codes.ts';
import { COOKIE_HELP, protocolAction } from '../../lti/codes.ts';

vi.mock('../../profiles/canvas.ts', () => {
  const flags = { deepLinkingResponseSub: false, clientAssertionAudArray: false, minimizeClaims: true, serviceOriginCheck: true };
  const base = { lms: 'canvas', sharing: 'exclusive', siteUrlOn: 'platform', serviceUrl: true, productFamily: 'canvas', flags, sources: ['test'] };
  return {
    CANVAS_PROFILES: [
      { ...base, id: 'canvas-self-hosted', label: 'Canvas, self-hosted (test copy)', simulation: false, issuer: '{siteUrl}',
        authenticationEndpoint: '{siteUrl}/api/lti/authorize_redirect', accesstokenEndpoint: '{serviceUrl}/login/oauth2/token',
        jwksUrl: '{siteUrl}/api/lti/security/jwks', refusedHostSuffixes: ['instructure.com', 'canvaslms.com'] },
      { ...base, id: 'canvas-sim-cloud', label: 'Canvas cloud (test copy)', simulation: true, issuer: 'https://canvas.sim.test',
        authenticationEndpoint: 'https://sso.canvas.sim.test/api/lti/authorize_redirect', accesstokenEndpoint: '{serviceUrl}/login/oauth2/token',
        jwksUrl: 'https://sso.canvas.sim.test/api/lti/security/jwks' },
    ],
  };
});

const BB_ISS = 'https://blackboard.sim.test';
const BB_CLIENT = 'qa-bb-app';
const LEARN_A = 'https://learn-a.blackboard.sim.test';
const LEARN_B = 'https://learn-b.blackboard.sim.test';
const SCHOOL_A = 'https://school-a.canvas.sim.test';
const LEARNER = 'http://purl.imsglobal.org/vocab/lis/v2/membership#Learner';
const INSTRUCTOR = 'http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

async function api(h: Harness, method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, body?: unknown) {
  const res = await h.app.inject({ method, url, headers: { authorization: `Bearer ${h.apiKey}` }, ...(body !== undefined ? { payload: body as Json } : {}) });
  return { status: res.statusCode, json: (res.body ? res.json() : null) as Json };
}
const code = (r: { json: Json }) => r.json?.details?.message;
const lastFailure = (h: Harness) => h.lines.filter((l) => l.event === 'launch_check_failed').at(-1);

async function sharedSetup(opts: Parameters<typeof harness>[0] = {}) {
  const h = await harness({ simulationProfiles: true, ...opts });
  const shared = await api(h, 'POST', '/api/platforms', { profile: 'blackboard-sim', clientId: BB_CLIENT, name: 'Cogniate' });
  expect(shared.status).toBe(201);
  return { h, shared: shared.json };
}

const bbClaims = (deploymentId: string, over: Json = {}, nowS = Math.floor(Date.now() / 1000)) => ({
  iss: BB_ISS, aud: BB_CLIENT, sub: 'u-1', iat: nowS, exp: nowS + 60, nonce: 'n',
  [CLAIM.deploymentId]: deploymentId, [CLAIM.messageType]: 'LtiResourceLinkRequest', [CLAIM.version]: '1.3.0',
  [CLAIM.targetLinkUri]: `${LAUNCH}?resource=pub_1`, [CLAIM.roles]: [LEARNER],
  [CLAIM.resourceLink]: { id: 'rl-1', title: 'Item' }, [CLAIM.context]: { id: 'c-1', title: 'Course' },
  [CLAIM.toolPlatform]: { product_family_code: 'BlackboardLearn', guid: 'g' },
  [CLAIM.ags]: { scope: ['https://purl.imsglobal.org/spec/lti-ags/scope/score'], lineitems: `${LEARN_A}/learn/api/v1/lti/courses/c1/lineItems`, lineitem: `${LEARN_A}/learn/api/v1/lti/courses/c1/lineItems/7` },
  ...over,
});

/** Login + signed launch; returns the launch answer (and the ltik on success). */
async function launch(h: Harness, login: Record<string, string>, claims: (nonce: string) => Json) {
  const res = await h.app.inject({ method: 'POST', url: '/lti/login/cogniate', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    payload: new URLSearchParams({ login_hint: 'u-1', target_link_uri: `${LAUNCH}?resource=pub_1`, ...login }).toString() });
  if (res.statusCode !== 302) return { login: res, launch: null, ltik: null };
  const loc = new URL(res.headers.location as string);
  const state = loc.searchParams.get('state')!;
  const cookie = String(res.headers['set-cookie']).split(';')[0]!;
  const token = await sign(h.key, claims(loc.searchParams.get('nonce')!));
  const out = await postLaunch(h, { id_token: token, state }, cookie);
  const location = out.headers.location as string | undefined;
  return { login: res, loginLocation: loc, launch: out, ltik: location ? new URL(location).searchParams.get('ltik') : null };
}

describe('GET /api/providers and the simulation gates (§9.3, §9.13)', () => {
  it('lists profiles in order; simulation profiles only when on; sharedPlatform follows the platform', async () => {
    const off = await harness();
    const ids = (await api(off, 'GET', '/api/providers')).json.profiles.map((p: Json) => p.id);
    expect(ids).toEqual(['standard', 'canvas-self-hosted', 'blackboard']);
    expect((await off.app.inject('/healthz')).json().simulation_profiles).toEqual([]);
    for (const profile of ['blackboard-sim', 'canvas-sim-cloud', 'nope']) {
      expect(code(await api(off, 'POST', '/api/platforms', { profile, clientId: 'x', name: 'x', siteUrl: SCHOOL_A, deploymentIds: ['d'] }))).toBe('UNKNOWN_PROFILE');
    }
    const on = await harness({ simulationProfiles: true });
    const list = (await api(on, 'GET', '/api/providers')).json.profiles;
    expect(list.map((p: Json) => p.id)).toEqual(['standard', 'canvas-self-hosted', 'blackboard', 'blackboard-sim', 'canvas-sim-cloud']);
    expect((await on.app.inject('/healthz')).json().simulation_profiles).toEqual(['blackboard-sim', 'canvas-sim-cloud']);
    const bbSim = () => api(on, 'GET', '/api/providers').then((r) => r.json.profiles.find((p: Json) => p.id === 'blackboard-sim'));
    expect((await bbSim()).sharedPlatform).toBeNull();
    const created = await api(on, 'POST', '/api/platforms', { profile: 'blackboard-sim', clientId: BB_CLIENT, name: 'Cogniate' });
    expect((await bbSim()).sharedPlatform).toEqual({ id: created.json.id, clientId: BB_CLIENT, active: true });
    expect(list.find((p: Json) => p.id === 'blackboard')).toMatchObject({
      lms: 'blackboard', sharing: 'shared', issuer: 'https://blackboard.com', siteUrlOn: 'deployment', serviceUrl: false, simulation: false,
      jwksUrl: 'https://developer.blackboard.com/api/v1/management/applications/{clientId}/jwks.json',
    });
  });

  it('a stored simulation row while simulations are off is inactive for login, launch and API calls, and still listed', async () => {
    const off = await harness();
    const p = createPlatform(off.db, 'cogniate', {
      issuer: BB_ISS, clientId: BB_CLIENT, name: 'sim', authEndpoint: 'https://developer.blackboard.sim.test/a', tokenEndpoint: 'https://developer.blackboard.sim.test/t',
      jwksUrl: 'https://developer.blackboard.sim.test/k', deploymentIds: [], active: true, profile: 'blackboard-sim', shared: true,
    });
    off.db.prepare("INSERT INTO deployment (platform_id, deployment_id, site_url, active, binding_generation) VALUES (?, 'dA', ?, 1, 1)").run(p.id, LEARN_A);
    const r = await launch(off, { iss: BB_ISS, client_id: BB_CLIENT, lti_deployment_id: 'dA' }, (nonce) => bbClaims('dA', { nonce }));
    expect(r.login.statusCode).toBe(403);
    expect(r.login.body).toContain('data-error-code="PLATFORM_NOT_ACTIVE"');
    expect(r.login.body).toContain('Blackboard');
    expect((await api(off, 'GET', `/api/platforms?profile=blackboard-sim`)).json.platforms.map((x: Json) => x.id)).toEqual([p.id]);
  });
});

describe('POST /api/platforms per profile (§9.4)', () => {
  const stdBody = (over: Json = {}) => ({
    url: ISSUER, clientId: 'c2', name: 'Moodle 2', authenticationEndpoint: `${ISSUER}/mod/lti/auth.php`, accesstokenEndpoint: `${ISSUER}/mod/lti/token.php`,
    authConfig: { method: 'JWK_SET', key: `${ISSUER}/mod/lti/certs.php` }, deploymentIds: ['2'], ...over,
  });

  it('standard: the old body gives profile standard, siteUrl null, deployments active with generation 0', async () => {
    const h = await harness();
    const r = await api(h, 'POST', '/api/platforms', stdBody());
    expect(r.status).toBe(201);
    expect(r.json).toMatchObject({ profile: 'standard', siteUrl: null, serviceUrl: null, bindingRef: null, deploymentIds: ['2'],
      deployments: [{ deploymentId: '2', siteUrl: ISSUER, active: true, bindingGeneration: 0, bindingRef: null }] });
    expect(code(await api(h, 'POST', '/api/platforms', stdBody({ clientId: 'c3', siteUrl: ISSUER })))).toBe('INVALID_REQUEST');
    expect(code(await api(h, 'POST', '/api/platforms', stdBody({ clientId: 'c3', serviceUrl: ISSUER })))).toBe('INVALID_REQUEST');
    expect(code(await api(h, 'POST', '/api/platforms', stdBody({ clientId: 'c3', authenticationEndpoint: 'https://other.test/auth' })))).toBe('PLATFORM_URL_NOT_ON_ISSUER_ORIGIN');
    const missing = await api(h, 'POST', '/api/platforms', { clientId: 'x', name: 'x' });
    expect([missing.status, missing.json.details.description]).toEqual([400, 'Invalid field: url.']);
  });

  it('standard: a reserved issuer origin is refused and nothing is stored', async () => {
    const h = await harness({ simulationProfiles: true });
    for (const origin of ['https://blackboard.com', BB_ISS, 'https://canvas.sim.test']) {
      const r = await api(h, 'POST', '/api/platforms', {
        url: origin, clientId: 'c9', name: 'x', authenticationEndpoint: `${origin}/a`, accesstokenEndpoint: `${origin}/t`, authConfig: { method: 'JWK_SET', key: `${origin}/k` }, deploymentIds: ['1'],
      });
      expect([r.status, code(r)]).toEqual([400, 'ISSUER_RESERVED']);
    }
    expect((await api(h, 'GET', '/api/platforms?clientId=c9')).json.platforms).toEqual([]);
  });

  it('shared: fixed values, one per account, no deployment ids, no deployment PATCH, no DELETE with an active deployment', async () => {
    const { h, shared } = await sharedSetup();
    expect(shared).toMatchObject({
      url: BB_ISS, profile: 'blackboard-sim', deploymentIds: [], deployments: [], siteUrl: null, serviceUrl: null,
      authenticationEndpoint: 'https://developer.blackboard.sim.test/api/v1/gateway/oidcauth',
      accesstokenEndpoint: 'https://developer.blackboard.sim.test/api/v1/gateway/oauth2/jwttoken',
      authConfig: { key: 'https://developer.blackboard.sim.test/api/v1/management/applications/qa-bb-app/jwks.json' },
    });
    expect(code(await api(h, 'POST', '/api/platforms', { profile: 'blackboard-sim', clientId: 'other', name: 'x' }))).toBe('SHARED_PLATFORM_EXISTS');
    expect(code(await api(h, 'POST', '/api/platforms', { profile: 'blackboard', clientId: 'x', name: 'x', deploymentIds: ['x'] }))).toBe('INVALID_REQUEST');
    expect(code(await api(h, 'POST', '/api/platforms', { profile: 'blackboard', clientId: 'x', name: 'x', serviceUrl: LEARN_A }))).toBe('INVALID_REQUEST');
    const wrong = await api(h, 'POST', '/api/platforms', { profile: 'blackboard', clientId: 'x', name: 'x', authenticationEndpoint: 'https://evil.test/auth' });
    expect([wrong.status, code(wrong), wrong.json.details.description]).toEqual([400, 'PLATFORM_URL_NOT_IN_PROFILE', 'authenticationEndpoint is not the value of profile blackboard.']);
    expect(code(await api(h, 'PATCH', `/api/platforms/${shared.id}`, { deploymentIds: ['x'] }))).toBe('SHARED_PLATFORM_DEPLOYMENTS');
    await api(h, 'POST', `/api/platforms/${shared.id}/deployments`, { deploymentId: 'dA', siteUrl: LEARN_A });
    expect(code(await api(h, 'DELETE', `/api/platforms/${shared.id}`))).toBe('SHARED_PLATFORM_IN_USE');
    expect((await api(h, 'GET', `/api/platforms/${shared.id}`)).status).toBe(200);
  });

  it('Canvas (exclusive): fixed endpoints, token on the service URL, NOT_IN_PROFILE names the field, site rules', async () => {
    const h = await harness({ simulationProfiles: true });
    const ok = await api(h, 'POST', '/api/platforms', { profile: 'canvas-sim-cloud', clientId: 'cA', name: 'A', siteUrl: 'HTTPS://School-A.Canvas.Sim.Test:443/', deploymentIds: ['dA'] });
    expect(ok.status).toBe(201);
    expect(ok.json).toMatchObject({
      url: 'https://canvas.sim.test', authenticationEndpoint: 'https://sso.canvas.sim.test/api/lti/authorize_redirect',
      authConfig: { key: 'https://sso.canvas.sim.test/api/lti/security/jwks' }, accesstokenEndpoint: `${SCHOOL_A}/login/oauth2/token`,
      siteUrl: SCHOOL_A, serviceUrl: SCHOOL_A, deployments: [{ deploymentId: 'dA', siteUrl: SCHOOL_A, active: true, bindingGeneration: 0 }],
    });
    for (const [field, value] of [['authenticationEndpoint', 'https://evil.test/auth'], ['url', 'https://evil.test'], ['accesstokenEndpoint', 'https://evil.test/t']] as const) {
      const r = await api(h, 'POST', '/api/platforms', { profile: 'canvas-sim-cloud', clientId: 'cB', name: 'B', siteUrl: SCHOOL_A, deploymentIds: ['d'], [field]: value });
      expect([code(r), r.json.details.description]).toEqual(['PLATFORM_URL_NOT_IN_PROFILE', `${field} is not the value of profile canvas-sim-cloud.`]);
    }
    const key = await api(h, 'POST', '/api/platforms', { profile: 'canvas-sim-cloud', clientId: 'cB', name: 'B', siteUrl: SCHOOL_A, deploymentIds: ['d'], authConfig: { method: 'JWK_SET', key: 'https://evil.test/k' } });
    expect(key.json.details.description).toBe('authConfig.key is not the value of profile canvas-sim-cloud.');
    const split = await api(h, 'POST', '/api/platforms', { profile: 'canvas-sim-cloud', clientId: 'cC', name: 'C', siteUrl: 'https://canvas.school-a.sim.test', serviceUrl: SCHOOL_A, deploymentIds: ['d'] });
    expect(split.json).toMatchObject({ siteUrl: 'https://canvas.school-a.sim.test', serviceUrl: SCHOOL_A, accesstokenEndpoint: `${SCHOOL_A}/login/oauth2/token` });
    const self = await api(h, 'POST', '/api/platforms', { profile: 'canvas-self-hosted', clientId: 'cS', name: 'S', siteUrl: 'https://canvas-self.sim.test', serviceUrl: 'https://api.canvas-self.sim.test', deploymentIds: ['dS'] });
    expect(self.json).toMatchObject({ url: 'https://canvas-self.sim.test', authenticationEndpoint: 'https://canvas-self.sim.test/api/lti/authorize_redirect',
      authConfig: { key: 'https://canvas-self.sim.test/api/lti/security/jwks' }, accesstokenEndpoint: 'https://api.canvas-self.sim.test/login/oauth2/token' });
    const rule = async (profile: string, siteUrl: string, extra: Json = {}) => {
      const r = await api(h, 'POST', '/api/platforms', { profile, clientId: `x-${Math.random()}`, name: 'x', siteUrl, deploymentIds: ['d'], ...extra });
      return [r.status, code(r), r.json.details.rule];
    };
    expect(await rule('canvas-sim-cloud', 'http://school-a.canvas.sim.test')).toEqual([400, 'INVALID_SITE_URL', 1]);
    expect(await rule('canvas-sim-cloud', 'https://10.20.30.40')).toEqual([400, 'INVALID_SITE_URL', 2]);
    expect(await rule('canvas-sim-cloud', URLS.lti)).toEqual([400, 'INVALID_SITE_URL', 3]);
    expect(await rule('canvas-sim-cloud', 'https://sso.canvas.sim.test:8443')).toEqual([400, 'INVALID_SITE_URL', 4]);
    expect(await rule('canvas-sim-cloud', SCHOOL_A, { serviceUrl: 'https://sso.canvas.sim.test' })).toEqual([400, 'INVALID_SITE_URL', 4]);
    expect(await rule('canvas-self-hosted', 'https://school.instructure.com')).toEqual([400, 'INVALID_SITE_URL', 5]);
    expect(code(await api(h, 'POST', '/api/platforms', { profile: 'blackboard-sim', clientId: 'q', name: 'q', serviceUrl: LEARN_A }))).toBe('INVALID_REQUEST');
  });
});

describe('deployments and binding refs (§9.5, §9.6, §9.15, AC-M1-07)', () => {
  it('shared: generation 1 on create, 409 again, switch off and on with a new site gives generation 2', async () => {
    const { h, shared } = await sharedSetup();
    const base = `/api/platforms/${shared.id}/deployments`;
    const add = await api(h, 'POST', base, { deploymentId: 'dX', siteUrl: LEARN_A });
    expect([add.status, add.json]).toEqual([201, { deploymentId: 'dX', siteUrl: LEARN_A, active: true, bindingGeneration: 1, bindingRef: null }]);
    expect(code(await api(h, 'POST', base, { deploymentId: 'dX', siteUrl: LEARN_A }))).toBe('DEPLOYMENT_ALREADY_EXISTS');
    const off = await api(h, 'PATCH', `${base}/dX`, { active: false });
    expect([off.status, off.json.active, off.json.bindingGeneration]).toEqual([200, false, 1]);
    const view = (await api(h, 'GET', `/api/platforms/${shared.id}`)).json;
    expect([view.deploymentIds, view.deployments[0].active]).toEqual([[], false]);
    const on = await api(h, 'PATCH', `${base}/dX`, { active: true, siteUrl: LEARN_B });
    expect([on.json.active, on.json.bindingGeneration, on.json.siteUrl]).toEqual([true, 2, LEARN_B]);
    expect(code(await api(h, 'PATCH', `${base}/dX`, { siteUrl: LEARN_A }))).toBe('INVALID_REQUEST');
    expect(code(await api(h, 'PATCH', `${base}/dX`, { active: true, siteUrl: LEARN_A }))).toBe('INVALID_REQUEST');
    expect(code(await api(h, 'PATCH', `${base}/unknown`, { active: true }))).toBe('UNKNOWN_DEPLOYMENT');
    expect(code(await api(h, 'POST', base, { deploymentId: 'dY' }))).toBe('INVALID_REQUEST');
    const badSite = await api(h, 'POST', base, { deploymentId: 'dY', siteUrl: 'https://developer.blackboard.sim.test' });
    expect([code(badSite), badSite.json.details.rule]).toEqual(['INVALID_SITE_URL', 4]);
    expect(h.lines.filter((l) => l.event === 'deployment_added').map((l) => [l.platform_id, l.deployment_id])).toEqual([[shared.id, 'dX']]);
    expect(h.lines.filter((l) => l.event === 'deployment_updated').map((l) => [l.active, l.binding_generation])).toEqual([[false, 1], [true, 2]]);
  });

  it('an encoded deployment id round-trips; a space is refused', async () => {
    const { h, shared } = await sharedSetup();
    const base = `/api/platforms/${shared.id}/deployments`;
    expect((await api(h, 'POST', base, { deploymentId: 'a/b:c', siteUrl: LEARN_A })).status).toBe(201);
    const p = await api(h, 'PATCH', `${base}/${encodeURIComponent('a/b:c')}`, { active: false });
    expect([p.status, p.json.deploymentId]).toEqual([200, 'a/b:c']);
    const space = await api(h, 'POST', base, { deploymentId: 'a/b c', siteUrl: LEARN_A });
    expect([space.status, space.json.details.description]).toEqual([400, 'Invalid field: deploymentId.']);
  });

  it('conditional changes: mismatch, rotation, one winner of two, compare with the current value only', async () => {
    const { h, shared } = await sharedSetup();
    const d = `/api/platforms/${shared.id}/deployments/dR`;
    expect((await api(h, 'POST', `/api/platforms/${shared.id}/deployments`, { deploymentId: 'dR', siteUrl: LEARN_A, bindingRef: 'r1' })).json.bindingRef).toBe('r1');
    expect(code(await api(h, 'PATCH', d, { active: false, bindingRef: 'r1b', ifBindingRef: 'r0' }))).toBe('BINDING_REF_MISMATCH');
    for (const body of [{ active: false, ifBindingRef: 'r1' }, { active: false, bindingRef: 'r1', ifBindingRef: 'r1' }]) {
      const r = await api(h, 'PATCH', d, body);
      expect([r.status, r.json.details.description]).toEqual([400, 'Invalid field: bindingRef (a conditional change must write a new bindingRef).']);
    }
    expect((await api(h, 'GET', `/api/platforms/${shared.id}`)).json.deployments[0]).toMatchObject({ active: true, bindingRef: 'r1' });
    expect((await api(h, 'PATCH', d, { active: false, bindingRef: 'r1b', ifBindingRef: 'r1' })).json.bindingRef).toBe('r1b');
    const both = await Promise.all(['r2', 'r3'].map((r) => api(h, 'PATCH', d, { active: true, bindingRef: r, ifBindingRef: 'r1b' })));
    expect(both.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(code(await api(h, 'PATCH', d, { active: false, bindingRef: 'r4', ifBindingRef: 'r1b' }))).toBe('BINDING_REF_MISMATCH');
  });

  it('staging and generation: inactive create gen 0, activation gen 1, adoption gen 2, no-ref and switch-off keep it', async () => {
    const { h, shared } = await sharedSetup();
    const d = `/api/platforms/${shared.id}/deployments/dS`;
    const staged = await api(h, 'POST', `/api/platforms/${shared.id}/deployments`, { deploymentId: 'dS', siteUrl: LEARN_A, active: false, bindingRef: 's1' });
    expect([staged.json.active, staged.json.bindingGeneration]).toEqual([false, 0]);
    expect((await api(h, 'PATCH', d, { active: true, bindingRef: 's2', ifBindingRef: 's1' })).json.bindingGeneration).toBe(1);
    expect((await api(h, 'PATCH', d, { active: true, siteUrl: LEARN_A, bindingRef: 's3', ifBindingRef: 's2' })).json.bindingGeneration).toBe(2);
    expect((await api(h, 'PATCH', d, { active: true })).json.bindingGeneration).toBe(2);
    expect((await api(h, 'PATCH', d, { active: false, bindingRef: 's4', ifBindingRef: 's3' })).json).toMatchObject({ active: false, bindingGeneration: 2, bindingRef: 's4' });
  });

  it('Canvas deployments: site must be the platform site; generation stays 0; PATCH diff keeps rows; conditional DELETE', async () => {
    const h = await harness({ simulationProfiles: true });
    const p = (await api(h, 'POST', '/api/platforms', { profile: 'canvas-sim-cloud', clientId: 'cA', name: 'A', siteUrl: SCHOOL_A, deploymentIds: ['dA'], bindingRef: 'p1' })).json;
    expect(code(await api(h, 'POST', `/api/platforms/${p.id}/deployments`, { deploymentId: 'dB', siteUrl: 'https://school-b.canvas.sim.test' }))).toBe('INVALID_SITE_URL');
    expect((await api(h, 'POST', `/api/platforms/${p.id}/deployments`, { deploymentId: 'dA2' })).json).toMatchObject({ siteUrl: SCHOOL_A, bindingGeneration: 0 });
    await api(h, 'PATCH', `/api/platforms/${p.id}/deployments/dA`, { active: false });
    expect((await api(h, 'PATCH', `/api/platforms/${p.id}/deployments/dA`, { active: true })).json).toMatchObject({ active: true, bindingGeneration: 0 });
    expect(code(await api(h, 'PATCH', `/api/platforms/${p.id}/deployments/dA`, { active: true, siteUrl: SCHOOL_A }))).toBe('INVALID_REQUEST');
    await api(h, 'PATCH', `/api/platforms/${p.id}/deployments/dA`, { active: true, bindingRef: 'dref' });
    const diff = await api(h, 'PATCH', `/api/platforms/${p.id}`, { deploymentIds: ['dA', 'dA3'] });
    expect(diff.json.deployments.map((d: Json) => [d.deploymentId, d.active, d.bindingRef])).toEqual([['dA', true, 'dref'], ['dA3', true, null]]);
    expect(code(await api(h, 'DELETE', `/api/platforms/${p.id}?ifBindingRef=wrong`))).toBe('BINDING_REF_MISMATCH');
    expect((await api(h, 'GET', `/api/platforms/${p.id}`)).status).toBe(200);
    expect((await api(h, 'DELETE', `/api/platforms/${p.id}?ifBindingRef=p1`)).status).toBe(204);
  });

  it('standard: deployment siteUrl refused; a create without active is active with generation 0', async () => {
    const h = await harness();
    expect(code(await api(h, 'POST', `/api/platforms/${h.platform.id}/deployments`, { deploymentId: '9', siteUrl: ISSUER }))).toBe('INVALID_REQUEST');
    expect((await api(h, 'POST', `/api/platforms/${h.platform.id}/deployments`, { deploymentId: '9' })).json).toMatchObject({ active: true, bindingGeneration: 0, siteUrl: ISSUER });
  });
});

describe('login, launch checks 9, 13, 14, claim allowlist and idtoken (§9.7 to §9.9)', () => {
  async function bound() {
    const { h, shared } = await sharedSetup();
    for (const [d, site] of [['dA', LEARN_A], ['dB', LEARN_B]] as const) await api(h, 'POST', `/api/platforms/${shared.id}/deployments`, { deploymentId: d, siteUrl: site });
    return { h, shared };
  }

  it('Blackboard: login goes to the fixed auth endpoint; the launch passes with the allowlist; idtoken has the origins', async () => {
    const { h, shared } = await bound();
    const r = await launch(h, { iss: BB_ISS, client_id: BB_CLIENT, lti_deployment_id: 'dA' }, (nonce) => bbClaims('dA', {
      nonce, name: 'Ann Lee', email: 'ann@x.test', [CLAIM.custom]: { sis: '42' }, 'https://purl.imsglobal.org/spec/lti/claim/lis': { person_sourcedid: 'S1' },
      'https://blackboard.com/lti/claim/one_time_session_token': 'secret-ott', [CLAIM.context]: { id: 'c-1', title: 'Course', extra: 'x' },
      [CLAIM.toolPlatform]: { product_family_code: 'BlackboardLearn', contact_email: 'admin@x.test' },
    }));
    expect(r.loginLocation!.origin + r.loginLocation!.pathname).toBe('https://developer.blackboard.sim.test/api/v1/gateway/oidcauth');
    expect(r.launch!.statusCode).toBe(303);
    const minimized = h.lines.find((l) => l.event === 'launch_claims_minimized')!;
    expect(minimized.claims).toEqual([
      `${CLAIM.context}#extra`, `${CLAIM.toolPlatform}#contact_email`, 'email', 'https://blackboard.com/lti/claim/one_time_session_token',
      CLAIM.custom, 'https://purl.imsglobal.org/spec/lti/claim/lis', 'name',
    ].sort());
    expect(JSON.stringify(h.lines)).not.toContain('secret-ott');
    const auth = { authorization: `LTIK-AUTH-V2 ${h.apiKey}:${r.ltik}` };
    const raw = (await h.app.inject({ method: 'GET', url: '/api/idtoken?raw=true', headers: auth })).json();
    expect(Object.keys(raw).sort()).toEqual(['aud', 'exp', 'iat', 'iss', 'nonce', 'sub', CLAIM.ags, CLAIM.context, CLAIM.deploymentId, CLAIM.messageType,
      CLAIM.resourceLink, CLAIM.roles, CLAIM.targetLinkUri, CLAIM.toolPlatform, CLAIM.version].sort());
    const tok = (await h.app.inject({ method: 'GET', url: '/api/idtoken', headers: auth })).json();
    expect(tok.user.name).toBeUndefined();
    expect(tok.user.email).toBeUndefined();
    expect(tok.launch.custom).toEqual({});
    expect(tok.platform).toMatchObject({ id: shared.id, siteUrl: LEARN_A, serviceUrl: LEARN_A, profile: 'blackboard-sim', deploymentId: 'dA' });
  });

  it('check 9: unknown deployment at login and launch, a token deployment other than the login, an inactive deployment', async () => {
    const { h, shared } = await bound();
    const unknown = await launch(h, { iss: BB_ISS, client_id: BB_CLIENT, lti_deployment_id: 'dZ' }, (nonce) => bbClaims('dZ', { nonce }));
    expect(unknown.login.body).toContain('data-error-code="UNKNOWN_DEPLOYMENT"');
    expect(unknown.login.body).toContain('Blackboard');
    expect(unknown.login.body).not.toContain('Moodle');
    const noHint = await launch(h, { iss: BB_ISS, client_id: BB_CLIENT }, (nonce) => bbClaims('dZ', { nonce }));
    expect(noHint.launch!.body).toContain('data-error-code="UNKNOWN_DEPLOYMENT"');
    const differs = await launch(h, { iss: BB_ISS, client_id: BB_CLIENT, lti_deployment_id: 'dB' }, (nonce) => bbClaims('dA', { nonce }));
    expect(differs.launch!.body).toContain('data-error-code="UNKNOWN_DEPLOYMENT"');
    expect(h.lines.some((l) => l.event === 'launch_check_failed' && l.detail === 'deployment_differs_from_login')).toBe(true);
    await api(h, 'PATCH', `/api/platforms/${shared.id}/deployments/dA`, { active: false });
    const inactiveLogin = await launch(h, { iss: BB_ISS, client_id: BB_CLIENT, lti_deployment_id: 'dA' }, (nonce) => bbClaims('dA', { nonce }));
    expect([inactiveLogin.login.statusCode, inactiveLogin.login.body.includes('data-error-code="DEPLOYMENT_NOT_ACTIVE"')]).toEqual([403, true]);
    expect(inactiveLogin.login.body).toContain('The connection to this Blackboard site is switched off. Ask your Cogniate admin to check the connection in the Cogniate portal.');
    const inactiveLaunch = await launch(h, { iss: BB_ISS, client_id: BB_CLIENT }, (nonce) => bbClaims('dA', { nonce }));
    expect(inactiveLaunch.launch!.statusCode).toBe(403);
    expect(h.lines.some((l) => l.event === 'launch_check_failed' && l.detail === 'deployment_inactive')).toBe(true);
    const b = await launch(h, { iss: BB_ISS, client_id: BB_CLIENT, lti_deployment_id: 'dB' }, (nonce) => bbClaims('dB', { nonce, [CLAIM.ags]: undefined }));
    expect(b.launch!.statusCode).toBe(303);
  });

  it('check 13: service URLs on the deployment site only; the detail names the claim and the host; no ltik', async () => {
    const { h } = await bound();
    const cases: Array<[Json, string]> = [
      [{ [CLAIM.ags]: { lineitems: `${LEARN_B}/learn/api/v1/lti/courses/c1/lineItems`, scope: [] } }, `claim=ags_lineitems host=${LEARN_B}`],
      [{ [CLAIM.ags]: { lineitem: 'https://evil.test/li', scope: [] } }, 'claim=ags_lineitem host=https://evil.test'],
      [{ [CLAIM.nrps]: { context_memberships_url: `${LEARN_B}/nrps` } }, `claim=nrps host=${LEARN_B}`],
      [{ [CLAIM.ags]: { lineitem: 'not a url', scope: [] } }, 'claim=ags_lineitem host=invalid'],
      [{ [CLAIM.ags]: { lineitem: `http://learn-a.blackboard.sim.test/li`, scope: [] } }, 'claim=ags_lineitem host=http://learn-a.blackboard.sim.test'],
    ];
    for (const [over, detail] of cases) {
      const r = await launch(h, { iss: BB_ISS, client_id: BB_CLIENT, lti_deployment_id: 'dA' }, (nonce) => bbClaims('dA', { nonce, ...over }));
      expect(r.launch!.statusCode).toBe(400);
      expect(r.launch!.body).toContain('data-error-code="SERVICE_ORIGIN_MISMATCH"');
      expect(r.launch!.headers.location).toBeUndefined();
      expect(lastFailure(h)).toMatchObject({ event: 'launch_check_failed', check: '13', code: 'SERVICE_ORIGIN_MISMATCH', detail });
    }
    const dl = await launch(h, { iss: BB_ISS, client_id: BB_CLIENT, lti_deployment_id: 'dA' }, (nonce) => bbClaims('dA', {
      nonce, [CLAIM.messageType]: 'LtiDeepLinkingRequest', [CLAIM.resourceLink]: undefined, [CLAIM.roles]: [INSTRUCTOR],
      [CLAIM.deepLinkingSettings]: { deep_link_return_url: `${LEARN_B}/webapps/blackboard/controller/lti/v2/deeplinking` },
    }));
    expect(lastFailure(h)).toMatchObject({ check: '13', detail: `claim=dl_return host=${LEARN_B}` });
    expect(dl.launch!.statusCode).toBe(400);
  });

  it('check 13 does not apply to standard (an AGS URL on another host still gives a ltik)', async () => {
    const h = await harness();
    const r = await launch(h, { iss: ISSUER, client_id: CLIENT_ID, lti_deployment_id: '1' }, (nonce) => ({
      iss: ISSUER, aud: CLIENT_ID, sub: '5', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 60, nonce,
      [CLAIM.deploymentId]: '1', [CLAIM.messageType]: 'LtiResourceLinkRequest', [CLAIM.version]: '1.3.0', [CLAIM.targetLinkUri]: `${LAUNCH}?resource=pub_1`,
      [CLAIM.roles]: [LEARNER], [CLAIM.resourceLink]: { id: '3' }, name: 'Moodle User', [CLAIM.ags]: { lineitem: 'https://evil.test/li', scope: [] },
    }));
    expect(r.launch!.statusCode).toBe(303);
    const tok = (await h.app.inject({ method: 'GET', url: '/api/idtoken', headers: { authorization: `LTIK-AUTH-V2 ${h.apiKey}:${r.ltik}` } })).json();
    expect(tok.user.name).toBe('Moodle User');
    expect(tok.platform).toMatchObject({ siteUrl: ISSUER, serviceUrl: ISSUER, profile: 'standard' });
    expect(h.lines.some((l) => l.event === 'launch_claims_minimized')).toBe(false);
  });

  it('check 14: a Canvas- or Blackboard-signed launch on another profile is refused before storage; other values pass', async () => {
    const h = await harness({ simulationProfiles: true });
    const std = (family: unknown) => (nonce: string) => ({
      iss: ISSUER, aud: CLIENT_ID, sub: '5', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 60, nonce,
      [CLAIM.deploymentId]: '1', [CLAIM.messageType]: 'LtiResourceLinkRequest', [CLAIM.version]: '1.3.0', [CLAIM.targetLinkUri]: `${LAUNCH}?resource=pub_1`,
      [CLAIM.roles]: [LEARNER], [CLAIM.resourceLink]: { id: '3' }, ...(family === undefined ? {} : { [CLAIM.toolPlatform]: { product_family_code: family } }),
    });
    const before = (h.db.prepare('SELECT COUNT(*) AS n FROM launch').get() as { n: number }).n;
    const canvas = await launch(h, { iss: ISSUER, client_id: CLIENT_ID }, std('canvas'));
    expect([canvas.launch!.statusCode, canvas.ltik]).toEqual([400, null]);
    expect(canvas.launch!.body).toContain('data-error-code="PROVIDER_PROFILE_MISMATCH"');
    expect(canvas.launch!.body).toContain('This Canvas site is connected to Cogniate in the wrong way. Ask your Cogniate admin to connect it as Canvas in the Cogniate portal.');
    expect(lastFailure(h)).toMatchObject({ check: '14', code: 'PROVIDER_PROFILE_MISMATCH', detail: 'family=canvas' });
    expect((await launch(h, { iss: ISSUER, client_id: CLIENT_ID }, std('BLACKBOARDLEARN'))).launch!.statusCode).toBe(400);
    expect((h.db.prepare('SELECT COUNT(*) AS n FROM launch').get() as { n: number }).n).toBe(before);
    for (const family of ['moodle', undefined, 'other']) expect((await launch(h, { iss: ISSUER, client_id: CLIENT_ID }, std(family))).launch!.statusCode).toBe(303);
    // A BlackboardLearn-signed launch on a Canvas profile, and family CANVAS on a Canvas profile.
    const c = (await api(h, 'POST', '/api/platforms', { profile: 'canvas-sim-cloud', clientId: 'cA', name: 'A', siteUrl: SCHOOL_A, deploymentIds: ['dA'] })).json;
    const cv = (family: string) => (nonce: string) => ({ ...bbClaims('dA', { nonce, iss: 'https://canvas.sim.test', aud: 'cA', [CLAIM.ags]: undefined }), [CLAIM.toolPlatform]: { product_family_code: family } });
    expect((await launch(h, { iss: 'https://canvas.sim.test', client_id: 'cA' }, cv('BlackboardLearn'))).launch!.body).toContain('PROVIDER_PROFILE_MISMATCH');
    expect((await launch(h, { iss: 'https://canvas.sim.test', client_id: 'cA' }, cv('CANVAS'))).launch!.statusCode).toBe(303);
    expect(c.id).toMatch(/^plt_/);
  });
});

describe('binding generation, service keys and ltiks (§9.14)', () => {
  it('generation 0 keeps the exact key value of the code before M1; a generation above 0 gives another value', () => {
    const scope = { toolAccountId: 'cogniate', platformId: 'plt_fixed', deploymentId: '1', contextId: '2', resourceLinkId: '3' };
    expect(deriveServiceKey(MASTER_KEY, scope)).toBe('VDPJq79pW-qZdgF98I25GFpbUpfSAwarmX0A9TwP1YI');
    expect(deriveServiceKey(MASTER_KEY, scope, 0)).toBe('VDPJq79pW-qZdgF98I25GFpbUpfSAwarmX0A9TwP1YI');
    expect(deriveServiceKey(MASTER_KEY, scope, 1)).not.toBe('VDPJq79pW-qZdgF98I25GFpbUpfSAwarmX0A9TwP1YI');
    expect(deriveServiceKey(MASTER_KEY, scope, 2)).not.toBe(deriveServiceKey(MASTER_KEY, scope, 1));
  });

  it('a disconnect gives 403 DEPLOYMENT_NOT_ACTIVE; a new binding makes the old key and ltik 401; the next launch gets a new key', async () => {
    const { h, shared } = await sharedSetup();
    await api(h, 'POST', `/api/platforms/${shared.id}/deployments`, { deploymentId: 'dA', siteUrl: LEARN_A });
    const first = await launch(h, { iss: BB_ISS, client_id: BB_CLIENT, lti_deployment_id: 'dA' }, (nonce) => bbClaims('dA', { nonce }));
    const ltikAuth = { authorization: `LTIK-AUTH-V2 ${h.apiKey}:${first.ltik}` };
    const k1 = (await h.app.inject({ method: 'GET', url: '/api/idtoken', headers: ltikAuth })).json().services.serviceKey as string;
    const svc = (key: string) => h.app.inject({ method: 'GET', url: '/api/lineitems', headers: { authorization: `SERVICE-AUTH-V1 ${h.apiKey}:${key}` } });
    await api(h, 'PATCH', `/api/platforms/${shared.id}/deployments/dA`, { active: false });
    for (const r of [await svc(k1), await h.app.inject({ method: 'GET', url: '/api/idtoken', headers: ltikAuth })]) {
      expect([r.statusCode, r.json().details.message]).toEqual([403, 'DEPLOYMENT_NOT_ACTIVE']);
    }
    await api(h, 'PATCH', `/api/platforms/${shared.id}/deployments/dA`, { active: true, siteUrl: LEARN_A });
    expect([(await svc(k1)).statusCode, (await svc(k1)).json().details.message]).toEqual([401, 'INVALID_SERVICE_AUTH_AUTHORIZATION_HEADER']);
    const old = await h.app.inject({ method: 'GET', url: '/api/idtoken', headers: ltikAuth });
    expect([old.statusCode, old.json().details.message]).toEqual([401, 'INVALID_LTIK_AUTH_AUTHORIZATION_HEADER']);
    const second = await launch(h, { iss: BB_ISS, client_id: BB_CLIENT, lti_deployment_id: 'dA' }, (nonce) => bbClaims('dA', { nonce }));
    const k2 = (await h.app.inject({ method: 'GET', url: '/api/idtoken', headers: { authorization: `LTIK-AUTH-V2 ${h.apiKey}:${second.ltik}` } })).json().services.serviceKey as string;
    expect(k2).not.toBe(k1);
    expect((h.db.prepare('SELECT COUNT(*) AS n, MAX(binding_generation) AS g FROM service_key').get() as { n: number; g: number })).toEqual({ n: 1, g: 2 });
    expect((await svc(k1)).statusCode).toBe(401);
  });
});

describe('Deep Linking and the token client per profile (§9.10)', () => {
  it('Blackboard: response JWT has sub = client id and goes to the return URL on the deployment site', async () => {
    const { h, shared } = await sharedSetup();
    await api(h, 'POST', `/api/platforms/${shared.id}/deployments`, { deploymentId: 'dA', siteUrl: LEARN_A });
    const ret = `${LEARN_A}/webapps/blackboard/controller/lti/v2/deeplinking?x=1`;
    const r = await launch(h, { iss: BB_ISS, client_id: BB_CLIENT, lti_deployment_id: 'dA' }, (nonce) => bbClaims('dA', {
      nonce, [CLAIM.messageType]: 'LtiDeepLinkingRequest', [CLAIM.resourceLink]: undefined, [CLAIM.roles]: [INSTRUCTOR], [CLAIM.ags]: undefined,
      [CLAIM.deepLinkingSettings]: { deep_link_return_url: ret, accept_types: ['ltiResourceLink'], data: 'opaque' },
    }));
    const dl = await h.app.inject({ method: 'POST', url: '/api/deeplinking', headers: { authorization: `LTIK-AUTH-V2 ${h.apiKey}:${r.ltik}` },
      payload: { contentItems: [{ type: 'ltiResourceLink', title: 'T', url: `${LAUNCH}?resource=pub_1` }] } });
    expect(dl.statusCode).toBe(200);
    expect(dl.json().target).toBe(ret);
    expect(decodeJwt(dl.json().message)).toMatchObject({ iss: BB_CLIENT, aud: BB_ISS, sub: BB_CLIENT, [CLAIM.deploymentId]: 'dA', 'https://purl.imsglobal.org/spec/lti-dl/claim/data': 'opaque' });
  });

  it('Blackboard: the client assertion aud is an array; the token goes to the fixed gateway', async () => {
    const tokenUrl = 'https://developer.blackboard.sim.test/api/v1/gateway/oauth2/jwttoken';
    const { h, shared } = await sharedSetup({
      outbound: (url) => (url === tokenUrl ? { status: 200, body: { access_token: 'tok', expires_in: 3600 } } : url.includes('/lineItems') ? { status: 200, body: [] } : undefined),
    });
    await api(h, 'POST', `/api/platforms/${shared.id}/deployments`, { deploymentId: 'dA', siteUrl: LEARN_A });
    const r = await launch(h, { iss: BB_ISS, client_id: BB_CLIENT, lti_deployment_id: 'dA' }, (nonce) => bbClaims('dA', { nonce,
      [CLAIM.ags]: { scope: ['https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly'], lineitems: `${LEARN_A}/learn/api/v1/lti/courses/c1/lineItems` } }));
    const res = await h.app.inject({ method: 'GET', url: '/api/lineitems', headers: { authorization: `LTIK-AUTH-V2 ${h.apiKey}:${r.ltik}` } });
    expect(res.statusCode).toBe(200);
    const token = h.outbound.requests.find((q) => q.url === tokenUrl)!;
    const assertion = new URLSearchParams(token.body).get('client_assertion')!;
    expect(decodeJwt(assertion)).toMatchObject({ iss: BB_CLIENT, sub: BB_CLIENT, aud: [tokenUrl] });
  });

  it('a platform 422 answer is PLATFORM_REJECTED_REQUEST with status 422', async () => {
    const { h, shared } = await sharedSetup({
      outbound: (url) => (url.endsWith('/jwttoken') ? { status: 200, body: { access_token: 'tok' } } : url.endsWith('/scores') ? { status: 422, body: 'not a student' } : undefined),
    });
    await api(h, 'POST', `/api/platforms/${shared.id}/deployments`, { deploymentId: 'dA', siteUrl: LEARN_A });
    const r = await launch(h, { iss: BB_ISS, client_id: BB_CLIENT, lti_deployment_id: 'dA' }, (nonce) => bbClaims('dA', { nonce }));
    const item = encodeURIComponent(`${LEARN_A}/learn/api/v1/lti/courses/c1/lineItems/7`);
    const res = await h.app.inject({ method: 'POST', url: `/api/lineitems/${item}/scores`, headers: { authorization: `LTIK-AUTH-V2 ${h.apiKey}:${r.ltik}` },
      payload: { userId: 'u-1', activityProgress: 'Completed', gradingProgress: 'FullyGraded', scoreGiven: 7, scoreMaximum: 10 } });
    expect([res.statusCode, res.json().details.message]).toEqual([422, 'PLATFORM_REJECTED_REQUEST']);
  });
});

describe('lti:shared-platform CLI rules (§9.12)', () => {
  it('creates once; the same client id prints the same id; another client id fails and changes nothing', async () => {
    const h = await harness({ simulationProfiles: true });
    const opts = { simulation: true };
    const first = ensureSharedPlatform(h.db, opts, { account: 'cogniate', profile: 'blackboard-sim', clientId: BB_CLIENT });
    expect(first).toMatchObject({ ok: true, created: true });
    expect(ensureSharedPlatform(h.db, opts, { account: 'cogniate', profile: 'blackboard-sim', clientId: BB_CLIENT })).toEqual({ ok: true, platformId: (first as { platformId: string }).platformId, created: false });
    expect(ensureSharedPlatform(h.db, opts, { account: 'cogniate', profile: 'blackboard-sim', clientId: 'other' }).ok).toBe(false);
    expect(ensureSharedPlatform(h.db, { simulation: false }, { account: 'cogniate', profile: 'blackboard-sim', clientId: BB_CLIENT }).ok).toBe(false);
    expect(ensureSharedPlatform(h.db, opts, { account: 'cogniate', profile: 'standard', clientId: BB_CLIENT }).ok).toBe(false);
    const view = (await api(h, 'GET', '/api/platforms?profile=blackboard-sim')).json.platforms;
    expect(view.map((p: Json) => p.clientId)).toEqual([BB_CLIENT]);
  });
});

describe('LMS name text table (security §12): Moodle texts byte for byte', () => {
  it('every protocol action and cookie help text with Moodle equals the text before M1', () => {
    const before: Record<string, string> = {
      UNKNOWN_TOOL_ACCOUNT: 'The tool URL in Moodle names an unknown Cogniate tool account. Ask your Moodle admin to check the tool settings.',
      UNKNOWN_PLATFORM: 'This Moodle site is not connected to Cogniate. Ask your Moodle admin to connect it first.',
      PLATFORM_NOT_ACTIVE: 'The connection to this Moodle site is switched off. Ask your Cogniate admin to switch it on.',
      UNKNOWN_DEPLOYMENT: 'This tool deployment is not known to Cogniate. Ask your Moodle admin to connect the tool again.',
      INVALID_TARGET_LINK_URI: 'The activity link does not point to the Cogniate LTI service. Ask your teacher to add the activity again.',
      INVALID_REQUEST: 'Start again from Moodle. If it happens again, give the trace id to your Cogniate admin.',
      INVALID_STATE: 'This launch was already used or is too old. Start again from Moodle.',
      STATE_COOKIE_MISSING: 'Start again from Moodle.',
      TOKEN_EXPIRED: 'The launch took too long. Start again from Moodle. If it happens again, check the clock of the Moodle server.',
      UNSUPPORTED_MESSAGE_TYPE: 'Cogniate does not support this kind of launch. Start again from Moodle.',
      PLATFORM_ERROR: 'Moodle stopped the launch. Start again from Moodle, or ask your Moodle admin.',
      METHOD_NOT_ALLOWED: 'Open the activity from Moodle.',
    };
    for (const [code, text] of Object.entries(before)) expect(protocolAction(code as ProtocolErrorCode)).toBe(text);
    expect(COOKIE_HELP).toEqual({
      resourceLink: 'Your browser blocked a cookie in an embedded frame. Ask your Moodle admin to set the Cogniate tool to open in a new window.',
      deepLinking: "Your browser blocks cookies in Moodle's content dialog. Use Chrome, Edge or Firefox, or allow cookies for this site.",
      other: 'Start again from Moodle.',
    });
    expect(protocolAction('UNKNOWN_DEPLOYMENT', 'Canvas')).toBe('This tool deployment is not known to Cogniate. Ask your Canvas admin to connect the tool again.');
  });
});
