import type { OutboundClient, OutboundResponse } from '@cogniate/shared';
import { createLogger } from '@cogniate/shared';
import { decodeJwt } from 'jose';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Db } from '../db/index.ts';
import { openDb } from '../db/index.ts';
import type { ProfileRegistry, ProviderProfile } from '../profiles/index.ts';
import { ensureAccount } from '../store/accounts.ts';
import type { NewPlatform } from '../store/platforms.ts';
import { createPlatform } from '../store/platforms.ts';
import { ensureToolKey } from '../store/tool-keys.ts';
import { testProfileRegistry } from '../testkit.ts';
import { createTokenClient } from './token-client.ts';
import type { TokenResultObserver } from './token-client.ts';

const NOW = Date.UTC(2026, 9, 22, 10, 0, 0);
const databases: Db[] = [];
afterEach(() => { for (const db of databases.splice(0)) db.close(); });

function response(status: number, value: unknown, retryAfter?: string): OutboundResponse {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  const body = Buffer.from(text);
  return { status, headers: retryAfter === undefined ? {} : { 'retry-after': retryAfter }, body, text: () => text, json: () => JSON.parse(text) as unknown };
}

async function setup(answer: OutboundResponse, onTokenResult?: TokenResultObserver) {
  const db = openDb(':memory:');
  databases.push(db);
  const masterKey = Buffer.alloc(32, 5);
  ensureAccount(db, { id: 'tool', name: 'Tool', appUrl: 'https://tool.test' });
  await ensureToolKey(db, masterKey, 'tool');
  const platform = createPlatform(db, 'tool', {
    issuer: 'https://platform.test', clientId: 'client', name: 'Platform', authEndpoint: 'https://platform.test/auth',
    tokenEndpoint: 'https://platform.test/token', jwksUrl: 'https://platform.test/jwks', deploymentIds: ['1'], active: true,
  });
  const request = vi.fn<OutboundClient['request']>().mockResolvedValue(answer);
  const lines: Array<Record<string, unknown>> = [];
  const logger = createLogger({ service: 'lti-service', dir: '', write: (line) => lines.push(JSON.parse(line)) });
  const tokens = createTokenClient({ db, masterKey, outbound: { allowlist: [], request }, logger, now: () => NOW, onTokenResult });
  return { platform, request, lines, tokens };
}

describe('token client throttle handling', () => {
  it.each([
    [429, '', undefined, 60],
    [403, 'Rate Limit Exceeded', new Date(NOW + 90_000).toUTCString(), 90],
  ] as const)('shares one failed token request and warning for upstream %i', async (status, body, retryAfter, seconds) => {
    const s = await setup(response(status, body, retryAfter));
    const results = await Promise.allSettled([
      s.tokens.getToken(s.platform, ['scope'], 'trace-a'),
      s.tokens.getToken(s.platform, ['scope'], 'trace-b'),
    ]);
    for (const result of results) {
      expect(result).toMatchObject({ status: 'rejected', reason: { code: 'PLATFORM_RATE_LIMITED', status: 429, details: { retryAfter: seconds } } });
    }
    expect(s.request).toHaveBeenCalledTimes(1);
    expect(s.lines.filter((line) => line.event === 'platform_rate_limited')).toEqual([expect.objectContaining({
      level: 'warn', trace_id: 'trace-a', platform_id: s.platform.id, status, retry_after_s: seconds,
    })]);

    // A later caller can ask again. The failed response leaves neither a cached token nor an in-flight promise.
    s.request.mockResolvedValue(response(200, { access_token: 'new-token', expires_in: 3600 }));
    expect(await s.tokens.getToken(s.platform, ['scope'], 'trace-c')).toBe('new-token');
    expect(await s.tokens.getToken(s.platform, ['scope'], 'trace-d')).toBe('new-token');
    expect(s.request).toHaveBeenCalledTimes(2);
  });

  it.each([400, 403, 409, 422])('keeps non-throttle token failure %i as PLATFORM_ERROR', async (status) => {
    const s = await setup(response(status, 'Token request refused'));
    await expect(s.tokens.getToken(s.platform, ['scope'], 'trace')).rejects.toMatchObject({ code: 'PLATFORM_ERROR', status: 502 });
    expect(s.request).toHaveBeenCalledTimes(1);
    expect(s.lines.filter((line) => line.event === 'platform_rate_limited')).toEqual([]);
  });
});

describe('token result observer (LA-E5-17 RQ-1)', () => {
  it('reports each shared request once, including every failure, and does not report cache hits', async () => {
    const observe = vi.fn<TokenResultObserver>();
    const s = await setup(response(503, ''), observe);
    const failures = [
      response(503, ''), response(429, ''), response(403, 'Rate Limit Exceeded'),
      response(200, 'invalid JSON'), response(200, {}),
    ];
    for (const [i, failure] of failures.entries()) {
      s.request.mockResolvedValue(failure);
      const results = await Promise.allSettled([
        s.tokens.getToken(s.platform, ['scope'], 'trace-a'),
        s.tokens.getToken(s.platform, ['scope'], 'trace-b'),
      ]);
      expect(results.map((result) => result.status)).toEqual(['rejected', 'rejected']);
      expect(observe).toHaveBeenCalledTimes(i + 1);
      expect(observe).toHaveBeenLastCalledWith({ platformId: s.platform.id, ok: false });
      expect(s.request).toHaveBeenCalledTimes(i + 1);
    }
    s.request.mockRejectedValueOnce(new Error('connection failed'));
    await expect(s.tokens.getToken(s.platform, ['scope'], 'network')).rejects.toMatchObject({ code: 'PLATFORM_ERROR' });
    expect(observe).toHaveBeenCalledTimes(failures.length + 1);
    expect(observe).toHaveBeenLastCalledWith({ platformId: s.platform.id, ok: false });

    s.request.mockResolvedValue(response(200, { access_token: 'token', expires_in: 3600 }));
    expect(await Promise.all([
      s.tokens.getToken(s.platform, ['scope'], 'success-a'),
      s.tokens.getToken(s.platform, ['scope'], 'success-b'),
    ])).toEqual(['token', 'token']);
    expect(observe).toHaveBeenCalledTimes(failures.length + 2);
    expect(observe).toHaveBeenLastCalledWith({ platformId: s.platform.id, ok: true });
    expect(await s.tokens.getToken(s.platform, ['scope'], 'cached')).toBe('token');
    expect(observe).toHaveBeenCalledTimes(failures.length + 2);
    expect(s.request).toHaveBeenCalledTimes(failures.length + 2);
  });

  it('preserves results with the default observer and with an observer that throws', async () => {
    for (const observer of [undefined, () => { throw new Error('observer failed'); }]) {
      const s = await setup(response(200, { access_token: 'token' }), observer);
      expect(await s.tokens.getToken(s.platform, ['scope'], 'success')).toBe('token');
      expect(await s.tokens.getToken(s.platform, ['scope'], 'cached')).toBe('token');
      s.request.mockResolvedValue(response(503, ''));
      await expect(s.tokens.getToken(s.platform, ['other-scope'], 'failure')).rejects.toMatchObject({ code: 'PLATFORM_ERROR' });
      expect(s.request).toHaveBeenCalledTimes(2);
    }
  });
});

const testRegistry = await testProfileRegistry();

describe('client assertion and scopes from the profile traits (LA-ADR-02 D2)', () => {
  const ok = response(200, { access_token: 'token', expires_in: 3600 });
  const base = testRegistry;
  /** zz-admin with the given traits: a test admin-value profile ({platformValue}, deployment claim). */
  const registryWith = (traits: Partial<ProviderProfile>): ProfileRegistry => ({
    ...base, listProfiles: (simulation) => base.listProfiles(simulation).map((p) => (p.id === 'zz-admin' ? { ...p, ...traits } : p)),
  });
  async function client(platform: Partial<NewPlatform>, registry?: ProfileRegistry) {
    const db = openDb(':memory:');
    databases.push(db);
    const masterKey = Buffer.alloc(32, 5);
    ensureAccount(db, { id: 'tool', name: 'Tool', appUrl: 'https://tool.test' });
    await ensureToolKey(db, masterKey, 'tool');
    const created = createPlatform(db, 'tool', {
      issuer: 'https://platform.test', clientId: 'client', name: 'Platform', authEndpoint: 'https://platform.test/auth',
      tokenEndpoint: 'https://platform.test/token', jwksUrl: 'https://platform.test/jwks', deploymentIds: ['1'], active: true, ...platform,
    });
    const request = vi.fn<OutboundClient['request']>().mockResolvedValue(ok);
    const tokens = createTokenClient({
      db, masterKey, outbound: { allowlist: [], request }, logger: createLogger({ service: 'lti-service', dir: '', write: () => {} }), now: () => NOW,
      ...(registry ? { profiles: { simulation: true, registry } } : {}),
    });
    const sent = (call = 0) => new URLSearchParams(String(request.mock.calls[call]![1]!.body));
    return { platform: created, tokens, request, sent, assertion: (call = 0) => decodeJwt(sent(call).get('client_assertion')!) };
  }

  it('AC-LA-E2-01-06: aud is the token URL as a string (standard) or as an array (Blackboard)', async () => {
    const standard = await client({});
    await standard.tokens.getToken(standard.platform, ['scope'], 't');
    expect(standard.assertion().aud).toBe('https://platform.test/token');
    const blackboard = await client({ profile: 'blackboard' });
    await blackboard.tokens.getToken(blackboard.platform, ['scope'], 't');
    expect(blackboard.assertion().aud).toEqual(['https://platform.test/token']);
  });

  it('AC-LA-E2-01-06: {platformValue} uses the stored clientAssertionAud, else the token URL', async () => {
    const registry = registryWith({ clientAssertionAud: { value: '{platformValue}', form: 'string' } });
    const stored = await client({ profile: 'zz-admin', clientAssertionAud: 'https://auth.example.test/token' }, registry);
    await stored.tokens.getToken(stored.platform, ['scope'], 't');
    expect(stored.assertion().aud).toBe('https://auth.example.test/token');
    expect(stored.request.mock.calls[0]![0]).toBe('https://platform.test/token');
    const empty = await client({ profile: 'zz-admin' }, registry);
    await empty.tokens.getToken(empty.platform, ['scope'], 't');
    expect(empty.assertion().aud).toBe('https://platform.test/token');
    // A {tokenEndpoint} profile never sends a stored value.
    const standard = await client({ clientAssertionAud: 'https://auth.example.test/token' });
    await standard.tokens.getToken(standard.platform, ['scope'], 't');
    expect(standard.assertion().aud).toBe('https://platform.test/token');
  });

  it('AC-LA-E2-01-06: the deployment_id claim only with assertionDeploymentId, one token per deployment', async () => {
    const claim = 'https://purl.imsglobal.org/spec/lti/claim/deployment_id';
    const on = await client({ profile: 'zz-admin' }, registryWith({ assertionDeploymentId: true }));
    await on.tokens.getToken(on.platform, ['scope'], 't', { deploymentId: '7' });
    expect(on.assertion()[claim]).toBe('7');
    await on.tokens.getToken(on.platform, ['scope'], 't', { deploymentId: '8' });
    expect(on.assertion(1)[claim]).toBe('8');
    await on.tokens.getToken(on.platform, ['scope'], 't', { deploymentId: '7' }); // cached for deployment 7
    expect(on.request).toHaveBeenCalledTimes(2);
    const off = await client({ profile: 'zz-admin' }, registryWith({ assertionDeploymentId: false }));
    await off.tokens.getToken(off.platform, ['scope'], 't', { deploymentId: '7' });
    expect(off.assertion()).not.toHaveProperty([claim]);
    const standard = await client({});
    await standard.tokens.getToken(standard.platform, ['scope'], 't', { deploymentId: '7' });
    expect(standard.assertion()).not.toHaveProperty([claim]);
  });

  it('A-LA-E2-02-03: a changed token URL, client id or audience does not reuse a cached token', async () => {
    const registry = registryWith({ clientAssertionAud: { value: '{platformValue}', form: 'string' } });
    const c = await client({ profile: 'zz-admin', clientAssertionAud: 'https://auth.idp.test/token' }, registry);
    c.request.mockImplementation(async (url) => response(200, { access_token: `token-for-${url}-${c.request.mock.calls.length}`, expires_in: 3600 }));
    const first = await c.tokens.getToken(c.platform, ['scope'], 't1');
    expect(await c.tokens.getToken(c.platform, ['scope'], 't2')).toBe(first); // the same set: cached
    // A registration update keeps the platform id and changes the credentials.
    const moved = { ...c.platform, tokenEndpoint: 'https://platform.test/new-token', clientAssertionAud: null };
    const second = await c.tokens.getToken(moved, ['scope'], 't3');
    expect(second).not.toBe(first);
    expect(c.request.mock.calls.at(-1)![0]).toBe('https://platform.test/new-token');
    expect(c.assertion(1).aud).toBe('https://platform.test/new-token');
    const reissued = { ...moved, clientId: 'client-2' };
    expect(await c.tokens.getToken(reissued, ['scope'], 't4')).not.toBe(second);
    expect(c.request).toHaveBeenCalledTimes(3);
  });

  it('A-LA-E2-02-03: a request in flight for the old credentials does not serve or fill the new ones', async () => {
    const c = await client({});
    let releaseOld!: () => void;
    const held = new Promise<void>((resolve) => { releaseOld = resolve; });
    // The old token URL answers only when the test releases it.
    c.request.mockImplementation(async (url) => {
      if (url === 'https://platform.test/token') { await held; return response(200, { access_token: 'old-token', expires_in: 3600 }); }
      return response(200, { access_token: 'new-token', expires_in: 3600 });
    });
    const oldPending = c.tokens.getToken(c.platform, ['scope'], 'old');
    const moved = { ...c.platform, tokenEndpoint: 'https://platform.test/new-token' };
    expect(await c.tokens.getToken(moved, ['scope'], 'new')).toBe('new-token');
    releaseOld();
    expect(await oldPending).toBe('old-token');
    expect(await c.tokens.getToken(moved, ['scope'], 'new-again')).toBe('new-token');
    expect(c.request.mock.calls.map((call) => call[0]).sort()).toEqual(['https://platform.test/new-token', 'https://platform.test/token']);
  });

  it('AC-LA-E2-01-07: granted scopes limit the token request; NULL asks for the requested scopes', async () => {
    const granted = await client({ grantedScopes: ['score', 'lineitem'] });
    await granted.tokens.getToken(granted.platform, ['score'], 't');
    expect(granted.sent().get('scope')).toBe('score');
    await granted.tokens.getToken(granted.platform, ['score', 'result'], 't2');
    expect(granted.sent(0).get('scope')).toBe('score');
    expect(granted.request).toHaveBeenCalledTimes(1); // the same scope set: cached
    await expect(granted.tokens.getToken(granted.platform, ['result'], 't3')).rejects.toMatchObject({ code: 'SERVICE_NOT_AVAILABLE', status: 403 });
    expect(granted.request).toHaveBeenCalledTimes(1);
    const old = await client({});
    expect(old.platform.grantedScopes).toBeNull();
    await old.tokens.getToken(old.platform, ['score', 'result'], 't');
    expect(old.sent().get('scope')).toBe('result score');
  });
});
