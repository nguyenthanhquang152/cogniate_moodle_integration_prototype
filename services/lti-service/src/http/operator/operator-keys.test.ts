// Operator listener (LA-ADR-06 D3): the auth hook and the operator-key routes (contract delta §1.2, §3).
import { createLocalKeyProvider, legacyKeyRing } from '@cogniate/shared';
import { describe, expect, it } from 'vitest';
import { openDb } from '../../db/index.ts';
import { issueOperatorKey } from '../../store/operator-keys.ts';
import { URLS, capturingLogger, harness } from '../../testkit.ts';
import { buildOperatorApp, parseOperatorAuthorization } from './index.ts';

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
const T0 = Date.parse('2026-10-22T10:00:00.000Z');

async function operatorHarness() {
  const db = openDb(':memory:');
  const { logger, lines } = capturingLogger();
  const clock = { now: T0 };
  const app = await buildOperatorApp({ urls: URLS, db, logger, now: () => clock.now, keys: createLocalKeyProvider(legacyKeyRing(Buffer.alloc(32, 7))) });
  const first = issueOperatorKey(db, { operator: 'alice', expiresAt: T0 + 90 * DAY }, T0);
  return { db, lines, clock, app, keyId: first.record.id, key: first.operatorKey };
}
type H = Awaited<ReturnType<typeof operatorHarness>>;

const call = (h: H, method: 'GET' | 'POST', url: string, auth: string | undefined, payload?: unknown) =>
  h.app.inject({
    method, url,
    headers: { ...(auth !== undefined ? { authorization: auth } : {}), ...(payload !== undefined ? { 'content-type': 'application/json' } : {}) },
    ...(payload !== undefined ? { payload: JSON.stringify(payload) } : {}),
  });
const op = (key: string) => `OPERATOR-AUTH-V1 ${key}`;
const UNAUTHORIZED = { status: 401, error: 'Unauthorized', details: { message: 'INVALID_OPERATOR_AUTHORIZATION_HEADER', description: 'Missing or invalid operator key.' } };

describe('operator auth (OPERATOR-AUTH-V1)', () => {
  it('parses the scheme case-insensitively and takes the whole credential', () => {
    expect(parseOperatorAuthorization('OPERATOR-AUTH-V1 ltio_x')).toBe('ltio_x');
    expect(parseOperatorAuthorization('  operator-auth-v1   ltio_x ')).toBe('ltio_x');
    expect(parseOperatorAuthorization('Bearer ltio_x')).toBeNull();
    expect(parseOperatorAuthorization('OPERATOR-AUTH-V1 a b')).toBeNull();
    expect(parseOperatorAuthorization(undefined)).toBeNull();
  });

  it('gives the same 401 for no header, another scheme, a tenant API key and an unknown key; logs api_auth_failed', async () => {
    const h = await operatorHarness();
    const tenant = (await harness()).apiKey; // a real ltis_ key of another database: the grammar alone refuses it
    for (const auth of [undefined, `Bearer ${h.key}`, `LTIK-AUTH-V2 ${h.key}:x`, op(tenant), op(`ltio_${'A'.repeat(43)}`), op(`${h.key}x`), op('')]) {
      const res = await call(h, 'GET', '/operator/v1/operator-keys', auth);
      expect([auth, res.statusCode]).toEqual([auth, 401]);
      expect(res.json()).toEqual(UNAUTHORIZED);
    }
    expect(h.lines.filter((l) => l.event === 'api_auth_failed').map((l) => [l.scheme, l.code])[0]).toEqual(['operator', 'INVALID_OPERATOR_AUTHORIZATION_HEADER']);
    expect(JSON.stringify(h.lines)).not.toContain(h.key);
    expect(JSON.stringify(h.lines)).not.toContain(tenant);
  });

  it('AC-LA-E5-01-11: a key passes at expires_at - 1 s and gives the unknown-key 401 at expires_at + 1 s (controlled clock)', async () => {
    const h = await operatorHarness();
    const short = issueOperatorKey(h.db, { operator: 'bob', expiresAt: T0 + 2 * HOUR }, T0);
    h.clock.now = short.record.expiresAt - 1000;
    expect((await call(h, 'GET', '/operator/v1/operator-keys', op(short.operatorKey))).statusCode).toBe(200);
    h.clock.now = short.record.expiresAt + 1000;
    const expired = await call(h, 'GET', '/operator/v1/operator-keys', op(short.operatorKey));
    const unknown = await call(h, 'GET', '/operator/v1/operator-keys', op(`ltio_${'B'.repeat(43)}`));
    expect([expired.statusCode, expired.json()]).toEqual([401, UNAUTHORIZED]);
    expect(expired.json()).toEqual(unknown.json());
  });

  it('an operator key as Bearer on the public /api/platforms is an unknown credential (401)', async () => {
    const h = await harness();
    const { operatorKey } = issueOperatorKey(h.db, { operator: 'alice', expiresAt: Date.now() + DAY }, Date.now());
    const res = await h.app.inject({ method: 'GET', url: '/api/platforms', headers: { authorization: `Bearer ${operatorKey}` } });
    expect(res.statusCode).toBe(401);
  });

  it('the public listener has no operator route (404)', async () => {
    const h = await harness();
    const { operatorKey } = issueOperatorKey(h.db, { operator: 'alice', expiresAt: Date.now() + DAY }, Date.now());
    const res = await h.app.inject({ method: 'GET', url: '/operator/v1/operator-keys', headers: { authorization: op(operatorKey) } });
    expect(res.statusCode).toBe(404);
  });

  it('an unknown path answers 404 NOT_FOUND', async () => {
    const h = await operatorHarness();
    const res = await call(h, 'GET', '/nothing', undefined);
    expect([res.statusCode, res.json().details.message]).toEqual([404, 'NOT_FOUND']);
  });
});

describe('GET, POST /operator/v1/operator-keys', () => {
  it('issues a key with the default expiry now + 90 days; the key is shown once and works at once', async () => {
    const h = await operatorHarness();
    const res = await call(h, 'POST', '/operator/v1/operator-keys', op(h.key), { operator: 'bob' });
    expect(res.statusCode).toBe(201);
    const body = res.json() as Record<string, string>;
    expect(Object.keys(body).sort()).toEqual(['expiresAt', 'id', 'operator', 'operatorKey']);
    expect(body).toMatchObject({ operator: 'bob', expiresAt: new Date(T0 + 90 * DAY).toISOString() });
    expect(body.operatorKey).toMatch(/^ltio_[A-Za-z0-9_-]{43}$/);
    expect(body.id).toMatch(/^opk_/);
    expect((await call(h, 'GET', '/operator/v1/operator-keys', op(body.operatorKey!))).statusCode).toBe(200);
  });

  it('accepts expiresAt from 1 hour to 1 year ahead; 59 minutes or 1 year + 1 day gives 400 with the field expiresAt', async () => {
    const h = await operatorHarness();
    const at = (ms: number) => new Date(ms).toISOString();
    for (const expiresAt of [at(T0 + 59 * 60 * 1000), at(Date.parse('2027-10-23T10:00:00.000Z')), at(T0 - DAY), 'tomorrow', 12345]) {
      const res = await call(h, 'POST', '/operator/v1/operator-keys', op(h.key), { operator: 'bob', expiresAt });
      expect([expiresAt, res.statusCode]).toEqual([expiresAt, 400]);
      expect(res.json().details).toMatchObject({ message: 'INVALID_REQUEST', description: expect.stringContaining('expiresAt') });
    }
    for (const expiresAt of [at(T0 + HOUR), at(Date.parse('2027-10-22T10:00:00.000Z')), '2026-12-01T12:00:00+07:00']) {
      const res = await call(h, 'POST', '/operator/v1/operator-keys', op(h.key), { operator: 'bob', expiresAt });
      expect([expiresAt, res.statusCode]).toEqual([expiresAt, 201]);
      expect(res.json().expiresAt).toBe(new Date(Date.parse(expiresAt)).toISOString());
    }
  });

  it('refuses a missing or bad operator name with the field operator', async () => {
    const h = await operatorHarness();
    for (const payload of [{}, { operator: '' }, { operator: 'a b' }, { operator: 'x'.repeat(65) }, { operator: 5 }]) {
      const res = await call(h, 'POST', '/operator/v1/operator-keys', op(h.key), payload);
      expect(res.statusCode).toBe(400);
      expect(res.json().details.description).toBe('Invalid field: operator.');
    }
  });

  it('lists id, operator, dates and revokedAt, never the key or its hash; lastUsedAt is the last accepted call', async () => {
    const h = await operatorHarness();
    const issued = (await call(h, 'POST', '/operator/v1/operator-keys', op(h.key), { operator: 'bob' })).json() as Record<string, string>;
    h.clock.now = T0 + 5000;
    const res = await call(h, 'GET', '/operator/v1/operator-keys', op(h.key));
    expect(res.statusCode).toBe(200);
    const keys = (res.json() as { operatorKeys: Array<Record<string, unknown>> }).operatorKeys;
    expect(keys).toEqual([
      { id: h.keyId, operator: 'alice', createdAt: new Date(T0).toISOString(), expiresAt: new Date(T0 + 90 * DAY).toISOString(), lastUsedAt: new Date(T0 + 5000).toISOString(), revokedAt: null },
      { id: issued.id, operator: 'bob', createdAt: new Date(T0).toISOString(), expiresAt: issued.expiresAt, lastUsedAt: null, revokedAt: null },
    ].sort((a, b) => (String(a.id) < String(b.id) ? -1 : 1)));
    expect(res.body).not.toContain(issued.operatorKey);
    expect(res.body).not.toContain(h.key);
    expect(res.body).not.toMatch(/[0-9a-f]{64}/);
  });
});

describe('POST /operator/v1/operator-keys/:id/revoke', () => {
  it('409 OPERATOR_KEY_IN_USE for the key of the request; another key: 200, then that key gives 401', async () => {
    const h = await operatorHarness();
    const self = await call(h, 'POST', `/operator/v1/operator-keys/${h.keyId}/revoke`, op(h.key));
    expect([self.statusCode, self.json().details.message]).toEqual([409, 'OPERATOR_KEY_IN_USE']);
    const bob = (await call(h, 'POST', '/operator/v1/operator-keys', op(h.key), { operator: 'bob' })).json() as Record<string, string>;
    h.clock.now = T0 + 1000;
    const res = await call(h, 'POST', `/operator/v1/operator-keys/${bob.id}/revoke`, op(h.key));
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id: bob.id, operator: 'bob', revokedAt: new Date(T0 + 1000).toISOString() });
    expect(res.body).not.toContain(bob.operatorKey);
    expect((await call(h, 'GET', '/operator/v1/operator-keys', op(bob.operatorKey!))).statusCode).toBe(401);
    // Again: 200, the first revokedAt stays. The key of the request still works.
    h.clock.now = T0 + 9000;
    const again = await call(h, 'POST', `/operator/v1/operator-keys/${bob.id}/revoke`, op(h.key));
    expect([again.statusCode, again.json().revokedAt]).toEqual([200, new Date(T0 + 1000).toISOString()]);
    expect((await call(h, 'GET', '/operator/v1/operator-keys', op(h.key))).statusCode).toBe(200);
  });

  it('404 NOT_FOUND for an unknown id; accepts an empty JSON body', async () => {
    const h = await operatorHarness();
    const res = await h.app.inject({ method: 'POST', url: '/operator/v1/operator-keys/opk_nope/revoke', headers: { authorization: op(h.key), 'content-type': 'application/json' } });
    expect([res.statusCode, res.json().details.message]).toEqual([404, 'NOT_FOUND']);
  });

  it('needs the operator key (401 without it)', async () => {
    const h = await operatorHarness();
    const res = await call(h, 'POST', `/operator/v1/operator-keys/${h.keyId}/revoke`, undefined);
    expect([res.statusCode, res.json()]).toEqual([401, UNAUTHORIZED]);
  });
});
