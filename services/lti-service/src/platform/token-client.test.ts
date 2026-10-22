import type { OutboundClient, OutboundResponse } from '@cogniate/shared';
import { createLogger } from '@cogniate/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Db } from '../db/index.ts';
import { openDb } from '../db/index.ts';
import { ensureAccount } from '../store/accounts.ts';
import { createPlatform } from '../store/platforms.ts';
import { ensureToolKey } from '../store/tool-keys.ts';
import { createTokenClient } from './token-client.ts';

const NOW = Date.UTC(2026, 9, 22, 10, 0, 0);
const databases: Db[] = [];
afterEach(() => { for (const db of databases.splice(0)) db.close(); });

function response(status: number, value: unknown, retryAfter?: string): OutboundResponse {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  const body = Buffer.from(text);
  return { status, headers: retryAfter === undefined ? {} : { 'retry-after': retryAfter }, body, text: () => text, json: () => JSON.parse(text) as unknown };
}

async function setup(answer: OutboundResponse) {
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
  const tokens = createTokenClient({ db, masterKey, outbound: { allowlist: [], request }, logger, now: () => NOW });
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
