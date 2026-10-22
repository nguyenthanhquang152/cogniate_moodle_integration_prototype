import { afterEach, describe, expect, it } from 'vitest';
import { sha256Hex } from '@cogniate/shared';
import { CLAIM } from '../lti/checks.ts';
import { AGS_SCOPES } from '../platform/ags.ts';
import { issueApiKey, revokeApiKey, listApiKeys } from '../store/api-keys.ts';
import { listAuditEvents } from '../store/audit.ts';
import { claimIdempotency } from '../store/idempotency.ts';
import { createLaunch } from '../store/launches.ts';
import { capturingLogger, harness, moodleClaims } from '../testkit.ts';
import type { Harness } from '../testkit.ts';
import { canonicalJson } from './idempotency.ts';
import { rateLimiterFor } from './rate-limit.ts';

const cleanup: Array<() => Promise<void>> = [];
afterEach(async () => { for (const close of cleanup.splice(0)) await close(); });
async function fixture() {
  const h = await harness(); cleanup.push(async () => { await h.app.close(); h.db.close(); }); return h;
}
const platformBody = {
  name: 'Idempotency unit', clientId: 'idem-client', url: 'https://idempotency.example.edu',
  authenticationEndpoint: 'https://idempotency.example.edu/auth', accesstokenEndpoint: 'https://idempotency.example.edu/token',
  authConfig: { method: 'JWK_SET', key: 'https://idempotency.example.edu/jwks' }, deploymentIds: ['one'],
};
const post = (h: Harness, key: string | string[] | undefined = 'request-1', payload: unknown = platformBody,
  url = '/api/platforms', apiKey = h.apiKey) => h.app.inject({
  method: 'POST', url, headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json',
    ...(key === undefined ? {} : { 'idempotency-key': key }) }, payload: typeof payload === 'string' ? payload : JSON.stringify(payload),
});
const count = (h: Harness) => h.db.prepare('SELECT COUNT(*) AS n FROM idempotency_record').get()!.n;
const events = (h: Harness, action: string) => listAuditEvents(h.db, { action, limit: 100 }).events;

it('canonicalizes parsed JSON without changing array order, Unicode or numeric values', () => {
  expect(canonicalJson(JSON.parse('{ "b": {"z":1, "a":2}, "a":[3,2,1], "10":0,"2":0 }')))
    .toBe('{"10":0,"2":0,"a":[3,2,1],"b":{"a":2,"z":1}}');
  expect(canonicalJson(undefined)).toBe('null');
  expect(canonicalJson(JSON.parse('{"n":1.0}'))).toBe(canonicalJson({ n: 1 }));
  expect(canonicalJson({ text: 'é' })).not.toBe(canonicalJson({ text: 'e\u0301' }));
  expect(canonicalJson(JSON.parse('{"__proto__":{"x":1}}'))).toBe('{"__proto__":{"x":1}}');
});

describe('idempotency on real admin routes (BD-A2-51)', () => {
  it('replays reordered JSON for either API key of the account and audits the stored target with the current actor', async () => {
    const h = await fixture();
    const first = await post(h);
    expect(first.statusCode, first.body).toBe(201);
    const secondKey = issueApiKey(h.db, 'cogniate', { label: 'second', scopes: ['admin'], createdBy: 'unit' }, h.clock.now);
    const reordered = JSON.stringify(Object.fromEntries(Object.entries(platformBody).reverse()), null, 2);
    const replay = await post(h, 'request-1', reordered, '/api/platforms', secondKey.apiKey);
    expect([replay.statusCode, replay.body]).toEqual([first.statusCode, first.body]);
    expect(count(h)).toBe(1);
    const audit = events(h, 'platform.create');
    expect(audit).toHaveLength(2);
    expect(audit.find((row) => row.details?.idempotentReplay)).toMatchObject({
      result: 'ok', actor: { id: secondKey.record.id }, target: { type: 'platform', id: first.json().id },
      traceId: replay.headers['x-trace-id'], details: { idempotencyKey: 'request-1' },
    });
    const ownPlatforms = h.db.prepare('SELECT id FROM platform WHERE tool_account_id = ? AND client_id = ?').all('cogniate', platformBody.clientId);
    expect(ownPlatforms).toHaveLength(1);
  });

  it('replays deployment creation with decoded params but refuses another platform, route or body', async () => {
    const h = await fixture();
    const created = await post(h, 'create-platform'); const id = created.json().id as string;
    const route = `/api/platforms/${id}/deployments`;
    const first = await post(h, 'deployment', { deploymentId: 'two' }, route);
    expect(first.statusCode).toBe(201);
    const encoded = `/api/platforms/%${id.charCodeAt(0).toString(16)}${id.slice(1)}/deployments`;
    const replay = await post(h, 'deployment', { deploymentId: 'two' }, encoded);
    expect([replay.statusCode, replay.body]).toEqual([first.statusCode, first.body]);
    expect(events(h, 'deployment.create').find((row) => row.details?.idempotentReplay)?.target).toEqual({ type: 'deployment', id: 'two' });
    for (const [url, body] of [
      [`/api/platforms/${h.platform.id}/deployments`, { deploymentId: 'two' }],
      ['/api/platforms', platformBody], [route, { deploymentId: 'three' }],
    ] as const) {
      const response = await post(h, 'deployment', body, url);
      expect([response.statusCode, response.json().details.message]).toEqual([422, 'IDEMPOTENCY_KEY_REUSED']);
      const action = url === '/api/platforms' ? 'platform.create' : 'deployment.create';
      expect(events(h, action).find((row) => row.traceId === response.headers['x-trace-id'])).toMatchObject({
        result: 'refused', code: 'IDEMPOTENCY_KEY_REUSED', details: { idempotencyKey: 'deployment' },
      });
    }
  });

  it('writes a refused admin event for a running claim and mirrors a stored 4xx on replay', async () => {
    const h = await fixture();
    claimIdempotency(h.db, { toolAccountId: 'cogniate', key: 'running', method: 'POST', route: '/api/platforms',
      params: '{}', bodyHash: sha256Hex(canonicalJson(platformBody)) }, h.clock.now);
    const pending = await post(h, 'running');
    expect([pending.statusCode, pending.json().details.message]).toEqual([409, 'IDEMPOTENCY_IN_PROGRESS']);
    expect(events(h, 'platform.create')).toMatchObject([{
      result: 'refused', code: 'IDEMPOTENCY_IN_PROGRESS', details: { idempotencyKey: 'running' },
    }]);
    const first = await post(h, 'invalid-body', {});
    const replay = await post(h, 'invalid-body', {});
    expect([replay.statusCode, replay.body]).toEqual([400, first.body]);
    expect(events(h, 'platform.create').find((row) => row.traceId === replay.headers['x-trace-id'])).toMatchObject({
      result: 'refused', code: first.json().details.message, target: { type: 'platform', id: null }, details: { idempotentReplay: true },
    });
  });

  it('isolates tenants and rechecks authentication before a replay', async () => {
    const h = await fixture();
    const first = await post(h);
    const other = await post(h, 'request-1', platformBody, '/api/platforms', h.otherApiKey);
    expect(other.statusCode).toBe(201); expect(other.json().id).not.toBe(first.json().id);
    expect(count(h)).toBe(2);
    revokeApiKey(h.db, 'cogniate', listApiKeys(h.db, 'cogniate')[0]!.id, h.clock.now);
    const before = events(h, 'platform.create');
    expect((await post(h)).statusCode).toBe(401);
    expect(events(h, 'platform.create')).toEqual(before);
    expect(count(h)).toBe(2);
  });

  it('charges one admin token per original or replay and rate-limits before lookup', async () => {
    const h = await fixture();
    rateLimiterFor(h.db, capturingLogger().logger).replaceSettings({ classes: { admin: { ratePerMinute: 1, burst: 2 } } });
    expect((await post(h)).statusCode).toBe(201);
    expect((await post(h)).statusCode).toBe(201);
    const third = await post(h);
    expect([third.statusCode, third.json().details.message]).toEqual([429, 'RATE_LIMITED']);
    expect(events(h, 'platform.create')).toHaveLength(2);
  });

  it.each(['', 'bad key', 'a'.repeat(65), ['one', 'two'], 'é'])('refuses an invalid header %j with a field error before a claim', async (key) => {
    const h = await fixture(); const response = await post(h, key);
    expect([response.statusCode, response.json().details.message]).toEqual([400, 'INVALID_REQUEST']);
    expect(response.json().details.description).toContain('Idempotency-Key');
    expect(count(h)).toBe(0);
    expect(events(h, 'platform.create')).toMatchObject([{ result: 'refused', code: 'INVALID_REQUEST' }]);
  });

  it('keeps requests without the header and other methods outside the plugin', async () => {
    const h = await fixture();
    const raw = () => h.app.inject({ method: 'POST', url: '/api/platforms', headers: { authorization: `Bearer ${h.apiKey}` }, payload: platformBody });
    expect((await raw()).statusCode).toBe(201);
    expect((await raw()).statusCode).toBe(409);
    expect(count(h)).toBe(0);
    expect((await h.app.inject({ url: '/api/platforms', headers: { authorization: `Bearer ${h.apiKey}`, 'idempotency-key': 'not a valid key' } })).statusCode).toBe(200);
    expect(count(h)).toBe(0);
  });
});

function lineItemAuth(h: Harness): string {
  const { ltik } = createLaunch(h.db, {
    toolAccountId: 'cogniate', platformId: h.platform.id, deploymentId: '1', messageType: 'LtiResourceLinkRequest',
    claims: moodleClaims({ [CLAIM.ags]: { lineitems: 'https://lms.example.edu/lineitems', scope: Object.values(AGS_SCOPES) } }),
  }, 3600, h.clock.now);
  return `LTIK-AUTH-V2 ${h.apiKey}:${ltik}`;
}
const response = (status: number, body: unknown, headers: Record<string, string> = {}) => {
  const bytes = Buffer.from(JSON.stringify(body));
  return { status, body: bytes, headers, text: () => bytes.toString(), json: () => JSON.parse(bytes.toString()) as unknown };
};

it('AC-04: a concurrent line item call gets 409 while the first runs, with no admin audit event', async () => {
  const h = await fixture(); const authorization = lineItemAuth(h);
  const entered = Promise.withResolvers<void>(); const release = Promise.withResolvers<void>();
  let creates = 0;
  h.outbound.request = async (url) => {
    if (url === h.platform.tokenEndpoint) return response(200, { access_token: 'unit-token', expires_in: 3600 });
    creates++; entered.resolve(); await release.promise;
    return response(201, { id: 'https://lms.example.edu/lineitems/1', label: 'Unit', scoreMaximum: 10 });
  };
  const call = () => h.app.inject({ method: 'POST', url: '/api/lineitems', headers: { authorization, 'idempotency-key': 'line-item' }, payload: { label: 'Unit', scoreMaximum: 10 } });
  const first = call().then((result) => result);
  try {
    await Promise.race([entered.promise, first.then((result) => { throw new Error(`First request ended before the platform call: ${result.statusCode}`); })]);
    const second = await call();
    expect([second.statusCode, second.json().details.message]).toEqual([409, 'IDEMPOTENCY_IN_PROGRESS']);
  } finally { release.resolve(); }
  const result = await first;
  const replay = await call();
  expect([replay.statusCode, replay.body]).toEqual([201, result.body]);
  expect(creates).toBe(1);
  expect(listAuditEvents(h.db, { limit: 100 }).events).toEqual([]);
});

it('frees a 5xx claim for retry and preserves Retry-After on a cached platform 429', async () => {
  const h = await fixture(); const authorization = lineItemAuth(h);
  let status = 500; let calls = 0;
  h.outbound.request = async (url) => {
    if (url === h.platform.tokenEndpoint) return response(200, { access_token: 'unit-token', expires_in: 3600 });
    calls++; return response(status, {}, status === 429 ? { 'retry-after': '12' } : {});
  };
  const call = () => h.app.inject({ method: 'POST', url: '/api/lineitems', headers: { authorization, 'idempotency-key': 'line-item' }, payload: { label: 'Unit', scoreMaximum: 10 } });
  expect((await call()).statusCode).toBe(502); expect(count(h)).toBe(0);
  status = 429;
  const limited = await call(); const replay = await call();
  expect([replay.statusCode, replay.body, replay.headers['retry-after']]).toEqual([429, limited.body, limited.headers['retry-after']]);
  expect(replay.headers['retry-after']).toBe('12');
  expect(calls).toBe(2);
  expect(listAuditEvents(h.db, { limit: 100 }).events).toEqual([]);
});
