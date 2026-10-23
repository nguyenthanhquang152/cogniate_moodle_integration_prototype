import Fastify from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { openDb } from '../../db/index.ts';
import { ensureAccount } from '../../store/accounts.ts';
import { getPlatform } from '../../store/platforms.ts';
import { ensureToolKey } from '../../store/tool-keys.ts';
import type { ProfileRegistry } from '../../profiles/index.ts';
import { MASTER_KEY, URLS, capturingLogger, testProfileRegistry } from '../../testkit.ts';
import { installApiBasics } from '../app.ts';
import { authenticate } from '../auth.ts';
import { registerPlatformRoutes } from './platforms.ts';

const registry = await testProfileRegistry();
const cleanup: Array<() => Promise<void>> = [];
afterEach(async () => { for (const close of cleanup.splice(0)) await close(); });

async function setup(profileRegistry: ProfileRegistry = registry) {
  const db = openDb(':memory:');
  const account = ensureAccount(db, { id: 'unit', name: 'Unit', appUrl: URLS.app });
  await ensureToolKey(db, MASTER_KEY, 'unit');
  const { logger, lines } = capturingLogger();
  const app = Fastify();
  installApiBasics(app, logger);
  registerPlatformRoutes(app, {
    db, urls: URLS, logger, profiles: { simulation: true, registry: profileRegistry }, now: Date.now,
    auth: (req, schemes) => authenticate(db, req.headers.authorization, schemes, Date.now(), () => {}),
  });
  cleanup.push(async () => { await app.close(); db.close(); });
  const post = (payload: Record<string, unknown>, url = '/api/platforms') => app.inject({ method: 'POST', url, headers: { authorization: `Bearer ${account.apiKey}` }, payload });
  return { db, post, app, lines, headers: { authorization: `Bearer ${account.apiKey}` } };
}

const adminBody = (profile = 'zz-admin') => ({
  profile, name: 'Unit admin', clientId: 'client-admin', url: 'https://admin.example.edu',
  authenticationEndpoint: 'https://admin.example.edu/auth', accesstokenEndpoint: 'https://admin.example.edu/token',
  authConfig: { method: 'JWK_SET', key: 'https://admin.example.edu/jwks' }, deploymentIds: ['1'],
});

describe('trusted audiences (LA-E3-12 AC-04)', () => {
  it.each(['standard', 'zz-fixed'])('creates, reads, updates and clears a trusted list for %s', async (profile) => {
    const { db, post, app, headers } = await setup();
    const trustedAudiences = ['https://other.test', 'opaque-audience'];
    const payload = profile === 'standard' ? adminBody(profile) : {
      profile, clientId: 'client-fixed', name: 'Unit fixed', siteUrl: 'https://site.example.edu', deploymentIds: ['1'],
    };
    const created = await post({ ...payload, trustedAudiences });
    expect(created.statusCode).toBe(201);
    const id = created.json<{ id: string }>().id;
    expect(created.json().trustedAudiences).toEqual(trustedAudiences);
    expect(getPlatform(db, 'unit', id)?.trustedAudiences).toEqual(trustedAudiences);
    expect((await app.inject({ url: `/api/platforms/${id}`, headers })).json().trustedAudiences).toEqual(trustedAudiences);
    expect((await app.inject({ url: '/api/platforms', headers })).json().platforms[0].trustedAudiences).toEqual(trustedAudiences);

    const replaced = await app.inject({ method: 'PATCH', url: `/api/platforms/${id}`, headers, payload: { trustedAudiences: ['replacement'] } });
    expect(replaced.statusCode).toBe(200);
    expect(replaced.json().trustedAudiences).toEqual(['replacement']);
    expect(getPlatform(db, 'unit', id)?.trustedAudiences).toEqual(['replacement']);
    const unchanged = await app.inject({ method: 'PATCH', url: `/api/platforms/${id}`, headers, payload: { name: 'Renamed' } });
    expect(unchanged.json().trustedAudiences).toEqual(['replacement']);
    const cleared = await app.inject({ method: 'PATCH', url: `/api/platforms/${id}`, headers, payload: { trustedAudiences: [] } });
    expect(cleared.statusCode).toBe(200);
    expect(cleared.json().trustedAudiences).toEqual([]);
    expect(getPlatform(db, 'unit', id)?.trustedAudiences).toEqual([]);
  });

  it('defaults to an empty list and refuses non-string lists without changing stored trust', async () => {
    const { db, post, app, headers } = await setup();
    const created = await post(adminBody());
    expect(created.statusCode).toBe(201);
    expect(created.json().trustedAudiences).toEqual([]);
    const id = created.json<{ id: string }>().id;
    for (const trustedAudiences of [null, 'https://other.test', {}, [1], ['allowed', null]]) {
      const refused = await post({ ...adminBody(), clientId: 'another-client', trustedAudiences });
      expect([refused.statusCode, refused.json().details.message]).toEqual([400, 'INVALID_REQUEST']);
      const patch = await app.inject({ method: 'PATCH', url: `/api/platforms/${id}`, headers, payload: { trustedAudiences } });
      expect([patch.statusCode, patch.json().details.message]).toEqual([400, 'INVALID_REQUEST']);
      expect(getPlatform(db, 'unit', id)?.trustedAudiences).toEqual([]);
    }
    expect(db.prepare('SELECT COUNT(*) AS n FROM platform').get()?.n).toBe(1);
  });

  it('bounds each entry to 1..2048 characters and the list to 20 entries on create and PATCH (BD-A2-73)', async () => {
    const { db, post, app, headers } = await setup();
    const created = await post(adminBody());
    const id = created.json<{ id: string }>().id;
    const many = (n: number) => Array.from({ length: n }, (_, i) => `aud-${i}`);
    for (const trustedAudiences of [['a'], ['a'.repeat(2048)], many(20)]) {
      const ok = await post({ ...adminBody(), clientId: `client-${trustedAudiences.length}-${trustedAudiences[0]!.length}`, trustedAudiences });
      expect(ok.statusCode).toBe(201);
      expect(ok.json().trustedAudiences).toEqual(trustedAudiences);
      const patched = await app.inject({ method: 'PATCH', url: `/api/platforms/${id}`, headers, payload: { trustedAudiences } });
      expect(patched.statusCode).toBe(200);
      expect(getPlatform(db, 'unit', id)?.trustedAudiences).toEqual(trustedAudiences);
    }
    const stored = getPlatform(db, 'unit', id)?.trustedAudiences;
    for (const trustedAudiences of [[''], ['a'.repeat(2049)], many(21)]) {
      const refused = await post({ ...adminBody(), clientId: 'refused-client', trustedAudiences });
      expect([refused.statusCode, refused.json().details.message]).toEqual([400, 'INVALID_REQUEST']);
      expect(refused.json().details.description).toMatch(/^Invalid field: trustedAudiences/);
      const patch = await app.inject({ method: 'PATCH', url: `/api/platforms/${id}`, headers, payload: { trustedAudiences } });
      expect([patch.statusCode, patch.json().details.message]).toEqual([400, 'INVALID_REQUEST']);
      expect(getPlatform(db, 'unit', id)?.trustedAudiences).toEqual(stored);
    }
    expect(db.prepare("SELECT COUNT(*) AS n FROM platform WHERE client_id = 'refused-client'").get()?.n).toBe(0);
  });
});

/** zz-admin as a test admin-value profile with `endpointOrigins: any-https` and a stored assertion audience. */
const anyHttps: ProfileRegistry = {
  ...registry,
  listProfiles: (simulation) => registry.listProfiles(simulation).map((p) => (p.id === 'zz-admin'
    ? { ...p, endpointOrigins: 'any-https' as const, clientAssertionAud: { value: '{platformValue}' as const, form: 'string' as const } } : p)),
};
const ISSUER = 'https://lms.school.example.edu/sakai';
const anyBody = (extra: Record<string, unknown> = {}) => ({
  profile: 'zz-admin', name: 'Any https', clientId: 'client-any', url: ISSUER,
  authenticationEndpoint: 'https://lms.school.example.edu/sakai/auth', accesstokenEndpoint: 'https://lms.school.example.edu/sakai/token',
  authConfig: { method: 'JWK_SET', key: 'https://lms.school.example.edu/sakai/jwks' }, deploymentIds: ['1'], ...extra,
});
const refusal = (r: { statusCode: number; json: () => { details: { message: string; description: string } } }) => [r.statusCode, r.json().details.message, r.json().details.description];

describe('admin-value platform rules for endpointOrigins any-https (contract delta §4.6.1)', () => {
  const OFF = 'https://auth.idp.example.org';
  const offOrigin: Array<[string, Record<string, unknown>]> = [
    ['accesstokenEndpoint', { accesstokenEndpoint: `${OFF}/token` }],
    ['authenticationEndpoint', { authenticationEndpoint: `${OFF}/auth` }],
    ['authConfig.key', { authConfig: { method: 'JWK_SET', key: `${OFF}/jwks` } }],
    ['clientAssertionAud', { clientAssertionAud: `${OFF}/token` }],
  ];

  it('creates an active platform when every value is on the issuer origin; the issuer may have a path', async () => {
    const { db, post, lines } = await setup(anyHttps);
    const created = await post(anyBody({ clientAssertionAud: anyBody().accesstokenEndpoint }));
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ url: ISSUER, active: true, siteUrl: null, serviceUrl: null, clientAssertionAud: anyBody().accesstokenEndpoint, grantedScopes: null });
    expect(getPlatform(db, 'unit', created.json<{ id: string }>().id)?.clientAssertionAud).toBe(anyBody().accesstokenEndpoint);
    expect(lines).toContainEqual(expect.objectContaining({ event: 'platform_created', profile: 'zz-admin' }));
  });

  it.each(offOrigin)('AC-LA-E2-01-04: an active create with %s off the issuer origin is refused; a staged create is not', async (field, extra) => {
    const { db, post } = await setup(anyHttps);
    for (const active of [{}, { active: true }, { active: false }]) {
      const refused = await post(anyBody({ ...extra, ...active }));
      expect(refusal(refused).slice(0, 2)).toEqual([400, 'PLATFORM_URL_NOT_ON_ISSUER_ORIGIN']);
      expect(refusal(refused)[2]).toContain(field);
    }
    const staged = await post(anyBody({ ...extra, active: false, bindingRef: 'grant-1' }));
    expect(staged.statusCode).toBe(201);
    const p = getPlatform(db, 'unit', staged.json<{ id: string }>().id)!;
    expect(p).toMatchObject({ active: false, bindingRef: 'grant-1' });
    expect(db.prepare('SELECT COUNT(*) AS n FROM platform').get()?.n).toBe(1);
  });

  it.each([
    ['a fixed host', 'https://sso.canvaslms.com/x'], ['a fixed issuer host', 'https://canvas.instructure.com/x'],
    ['a fixed host with a port', 'https://developer.blackboard.com:8443/x'], ['a fixed issuer host in capitals', 'https://BLACKBOARD.com/x'],
    ['a simulation fixed host (simulations on)', 'https://sso.canvas.sim.test/x'],
  ])('AC-LA-E2-01-05: an endpoint on %s is PLATFORM_URL_NOT_IN_PROFILE, active and staged', async (_, value) => {
    const { post } = await setup(anyHttps);
    for (const field of ['accesstokenEndpoint', 'authenticationEndpoint', 'authConfig.key']) {
      const extra = field === 'authConfig.key' ? { authConfig: { method: 'JWK_SET', key: value } } : { [field]: value };
      for (const mode of [{}, { active: false, bindingRef: 'grant-1' }]) {
        const r = await post(anyBody({ ...extra, ...mode }));
        expect(refusal(r)).toEqual([400, 'PLATFORM_URL_NOT_IN_PROFILE', `${field} is on a reserved host of a hosted LMS profile.`]);
      }
    }
  });

  it('applies site rules 2 and 3 to the endpoint hosts and rules 1 to 4 to the issuer, in the §4.6.1 order', async () => {
    const { post } = await setup(anyHttps);
    const staged = { active: false, bindingRef: 'grant-1' };
    expect(refusal(await post(anyBody({ ...staged, accesstokenEndpoint: 'https://10.0.0.1/token' })))).toEqual([400, 'PLATFORM_URL_NOT_IN_PROFILE', 'accesstokenEndpoint breaks rule 2 of the site rules.']);
    expect(refusal(await post(anyBody({ ...staged, accesstokenEndpoint: `${URLS.lti}/token` })))).toEqual([400, 'PLATFORM_URL_NOT_IN_PROFILE', 'accesstokenEndpoint breaks rule 3 of the site rules.']);
    expect(refusal(await post(anyBody({ ...staged, accesstokenEndpoint: 'http://auth.idp.example.org/token' })))).toEqual([400, 'INVALID_REQUEST', 'Invalid field: accesstokenEndpoint must be an https URL.']);
    // Rule 3 (reserved issuer) before rule 1, and rule 2 before rule 3.
    expect(refusal(await post(anyBody({ url: 'https://canvas.instructure.com' })))[1]).toBe('ISSUER_RESERVED');
    expect(refusal(await post(anyBody({ url: 'https://canvas.instructure.com', accesstokenEndpoint: 'https://sso.canvaslms.com/t' })))[1]).toBe('PLATFORM_URL_NOT_IN_PROFILE');
    for (const [url, rule] of [[`${ISSUER}?x=1`, 1], [`${ISSUER}#f`, 1], ['https://user@lms.school.example.edu/sakai', 1], ['not a url', 1],
      ['https://localhost/sakai', 2], [`${URLS.app}/x`, 3], ['https://sso.canvaslms.com/sakai', 4]] as const) {
      const r = await post(anyBody({ ...staged, url }));
      expect([r.statusCode, r.json().details.message, r.json().details.rule, r.json().details.field], url).toEqual([400, 'INVALID_SITE_URL', rule, 'url']);
    }
    expect(refusal(await post(anyBody({ siteUrl: 'https://lms.school.example.edu' })))).toEqual([400, 'INVALID_REQUEST', 'Invalid field: siteUrl.']);
    expect(refusal(await post(anyBody({ serviceUrl: 'https://lms.school.example.edu' })))).toEqual([400, 'INVALID_REQUEST', 'Invalid field: serviceUrl.']);
    expect(refusal(await post(anyBody({ clientAssertionAud: 'a'.repeat(2049) })))).toEqual([400, 'INVALID_REQUEST', 'Invalid field: clientAssertionAud.']);
  });

  it('keeps the issuer-origin rules of standard; a {tokenEndpoint} profile refuses a stored audience', async () => {
    const { post, lines } = await setup(anyHttps);
    const standard = await post({ ...adminBody('standard'), clientAssertionAud: 'https://admin.example.edu/token' });
    expect(refusal(standard)).toEqual([400, 'INVALID_REQUEST', 'Invalid field: clientAssertionAud.']);
    const off = await post({ ...adminBody('standard'), active: false, bindingRef: 'grant-1', accesstokenEndpoint: 'https://auth.idp.example.org/token' });
    expect(refusal(off)).toEqual([400, 'PLATFORM_URL_NOT_ON_ISSUER_ORIGIN', 'accesstokenEndpoint is not on the issuer origin.']);
    const created = await post(adminBody('standard'));
    expect(created.json()).toMatchObject({ clientAssertionAud: null, grantedScopes: null });
    expect(lines.filter((l) => l.event === 'platform_created')).toEqual([]);
  });
});

describe('E2 trait fields of GET /api/providers (contract delta §4.7, LA-IC-01)', () => {
  it('shows endpoints, issuerKind and endpointOrigins for every profile', async () => {
    const { app, headers } = await setup();
    const rows = (await app.inject({ url: '/api/providers', headers })).json<{ profiles: Array<Record<string, unknown>> }>().profiles;
    const traits = Object.fromEntries(rows.map((p) => [p.id, [p.endpoints, p.issuerKind, p.endpointOrigins]]));
    expect(traits).toMatchObject({
      standard: ['admin', 'per-tenant', 'issuer'],
      'canvas-cloud-production': ['fixed', 'fixed', null], 'canvas-cloud-beta': ['fixed', 'fixed', null], 'canvas-cloud-test': ['fixed', 'fixed', null],
      'canvas-self-hosted': ['fixed', 'per-tenant', null], 'canvas-sim-cloud': ['fixed', 'fixed', null],
      blackboard: ['fixed', 'fixed', null], 'blackboard-sim': ['fixed', 'fixed', null],
      'zz-admin': ['admin', 'per-tenant', 'issuer'], 'zz-fixed': ['fixed', 'fixed', null],
    });
  });
});

describe('admin and fixed endpoint plans (AC-LA-E1-10-03)', () => {
  it.each(['zz-admin', 'standard'])('uses the admin plan and preserves the selected profile %s', async (profile) => {
    const { db, post } = await setup();
    const response = await post(adminBody(profile));
    expect(response.statusCode).toBe(201);
    const body = response.json<{ id: string; profile: string }>();
    expect(body.profile).toBe(profile);
    expect(getPlatform(db, 'unit', body.id)).toMatchObject({
      profile, issuer: 'https://admin.example.edu', authEndpoint: 'https://admin.example.edu/auth',
      tokenEndpoint: 'https://admin.example.edu/token', jwksUrl: 'https://admin.example.edu/jwks', deploymentIds: ['1'],
    });
    expect((await post({ deploymentId: '2', siteUrl: 'https://site.example.edu' }, `/api/platforms/${body.id}/deployments`)).statusCode).toBe(400);
    expect((await post({ deploymentId: '2' }, `/api/platforms/${body.id}/deployments`)).statusCode).toBe(201);
  });

  it.each(['zz-admin', 'standard'])('keeps required-field errors and URL guards for admin profile %s', async (profile) => {
    const { post } = await setup();
    const missing = await post({ profile });
    expect(missing.statusCode).toBe(400);
    expect(missing.json().details.description).toBe('Invalid field: url.');
    expect((await post({ ...adminBody(profile), authenticationEndpoint: 'https://another.example.edu/auth' })).statusCode).toBe(400);
    expect((await post({ ...adminBody(profile), siteUrl: 'https://site.example.edu' })).statusCode).toBe(400);
    expect((await post({ ...adminBody(profile), serviceUrl: 'https://service.example.edu' })).statusCode).toBe(400);
  });

  it('takes issuer and endpoint values from a new fixed profile', async () => {
    const { db, post } = await setup();
    const body = { profile: 'zz-fixed', clientId: 'client-fixed', name: 'Unit fixed', siteUrl: 'https://site.example.edu', deploymentIds: ['1'] };
    expect((await post({ ...body, siteUrl: undefined })).statusCode).toBe(400);
    expect((await post({ ...body, authenticationEndpoint: 'https://wrong.example.edu/auth' })).statusCode).toBe(400);
    const response = await post(body);
    expect(response.statusCode).toBe(201);
    expect(getPlatform(db, 'unit', response.json<{ id: string }>().id)).toMatchObject({
      profile: 'zz-fixed', issuer: 'https://fixed.example.edu', authEndpoint: 'https://fixed.example.edu/auth',
      tokenEndpoint: 'https://site.example.edu/token', jwksUrl: 'https://fixed.example.edu/jwks', siteUrl: 'https://site.example.edu',
    });
  });
});
