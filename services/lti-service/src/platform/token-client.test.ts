import type { OutboundClient, OutboundResponse } from '@cogniate/shared';
import { createLogger } from '@cogniate/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Db } from '../db/index.ts';
import { openDb } from '../db/index.ts';
import { ensureAccount } from '../store/accounts.ts';
import { createPlatform } from '../store/platforms.ts';
import { ensureToolKey } from '../store/tool-keys.ts';
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
