import Fastify from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { openDb } from '../../db/index.ts';
import { ensureAccount } from '../../store/accounts.ts';
import { getPlatform } from '../../store/platforms.ts';
import { ensureToolKey } from '../../store/tool-keys.ts';
import { MASTER_KEY, URLS, capturingLogger, testProfileRegistry } from '../../testkit.ts';
import { installApiBasics } from '../app.ts';
import { authenticate } from '../auth.ts';
import { registerPlatformRoutes } from './platforms.ts';

const registry = await testProfileRegistry();
const cleanup: Array<() => Promise<void>> = [];
afterEach(async () => { for (const close of cleanup.splice(0)) await close(); });

async function setup() {
  const db = openDb(':memory:');
  const account = ensureAccount(db, { id: 'unit', name: 'Unit', appUrl: URLS.app });
  await ensureToolKey(db, MASTER_KEY, 'unit');
  const { logger } = capturingLogger();
  const app = Fastify();
  installApiBasics(app, logger);
  registerPlatformRoutes(app, {
    db, urls: URLS, logger, profiles: { simulation: true, registry }, now: Date.now,
    auth: (req, schemes) => authenticate(db, req.headers.authorization, schemes, Date.now(), () => {}),
  });
  cleanup.push(async () => { await app.close(); db.close(); });
  const post = (payload: Record<string, unknown>, url = '/api/platforms') => app.inject({ method: 'POST', url, headers: { authorization: `Bearer ${account.apiKey}` }, payload });
  return { db, post, app, headers: { authorization: `Bearer ${account.apiKey}` } };
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
