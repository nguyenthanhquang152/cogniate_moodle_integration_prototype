// GET /operator/v1/audit and the audit events of the operator-key routes (LA-ADR-06 D4; contract delta §3, §5).
import { createLocalKeyProvider, legacyKeyRing } from '@cogniate/shared';
import { describe, expect, it } from 'vitest';
import { openDb } from '../../db/index.ts';
import { insertAuditEvent, listAuditEvents } from '../../store/audit.ts';
import { issueOperatorKey } from '../../store/operator-keys.ts';
import { URLS, capturingLogger } from '../../testkit.ts';
import { buildOperatorApp } from './index.ts';

const DAY = 24 * 3600 * 1000;
const T0 = Date.parse('2026-10-22T10:00:00.000Z');

async function operatorHarness() {
  const db = openDb(':memory:');
  const { logger } = capturingLogger();
  const clock = { now: T0 };
  const app = await buildOperatorApp({ urls: URLS, db, logger, now: () => clock.now, keys: createLocalKeyProvider(legacyKeyRing(Buffer.alloc(32, 7))) });
  const alice = issueOperatorKey(db, { operator: 'alice', expiresAt: T0 + 90 * DAY }, T0);
  return { db, clock, app, keyId: alice.record.id, key: alice.operatorKey };
}
type H = Awaited<ReturnType<typeof operatorHarness>>;

const call = (h: H, method: 'GET' | 'POST', url: string, payload?: unknown, auth = `OPERATOR-AUTH-V1 ${h.key}`) => {
  h.clock.now += 1; // events of one test sort in call order
  return h.app.inject({
    method, url, headers: { authorization: auth, ...(payload !== undefined ? { 'content-type': 'application/json' } : {}) },
    ...(payload !== undefined ? { payload: JSON.stringify(payload) } : {}),
  });
};
const stored = (h: H) => listAuditEvents(h.db, { limit: 100 }).events.reverse(); // oldest first

describe('audit events of the operator-key routes', () => {
  it('AC-LA-E5-02-04 (API part): POST and revoke each make one event with actor operator:<name>; the key is never in it', async () => {
    const h = await operatorHarness();
    const issued = (await call(h, 'POST', '/operator/v1/operator-keys', { operator: 'bob' })).json() as { id: string; operatorKey: string };
    expect((await call(h, 'POST', `/operator/v1/operator-keys/${issued.id}/revoke`)).statusCode).toBe(200);
    expect(stored(h).map((e) => [e.actor, e.toolAccountId, e.action, e.target, e.result, e.details])).toEqual([
      [{ type: 'operator', id: 'alice' }, null, 'operator_key.issue', { type: 'operator_key', id: issued.id }, 'ok', { operator: 'bob', expiresAt: new Date(T0 + 1 + 90 * DAY).toISOString() }],
      [{ type: 'operator', id: 'alice' }, null, 'operator_key.revoke', { type: 'operator_key', id: issued.id }, 'ok', { operator: 'bob' }],
    ]);
    expect(JSON.stringify(stored(h))).not.toContain(issued.operatorKey);
  });

  it('a refused operator call makes one refused event; an unauthenticated call and a GET of operator keys make none', async () => {
    const h = await operatorHarness();
    expect((await call(h, 'POST', `/operator/v1/operator-keys/${h.keyId}/revoke`)).statusCode).toBe(409);
    expect((await call(h, 'POST', '/operator/v1/operator-keys/opk_nope/revoke')).statusCode).toBe(404);
    expect((await call(h, 'POST', '/operator/v1/operator-keys', { operator: 'bob', expiresAt: 'soon' })).statusCode).toBe(400);
    expect((await call(h, 'POST', '/operator/v1/operator-keys', { operator: 'bob' }, `OPERATOR-AUTH-V1 ltio_${'x'.repeat(43)}`)).statusCode).toBe(401);
    expect((await call(h, 'GET', '/operator/v1/operator-keys')).statusCode).toBe(200);
    expect(stored(h).map((e) => [e.action, e.result, e.code, e.target.id])).toEqual([
      ['operator_key.revoke', 'refused', 'OPERATOR_KEY_IN_USE', h.keyId],
      ['operator_key.revoke', 'refused', 'NOT_FOUND', 'opk_nope'],
      ['operator_key.issue', 'refused', 'INVALID_REQUEST', null],
    ]);
  });
});

describe('GET /operator/v1/audit', () => {
  it('AC-LA-E5-02-05 (operator part): the read answers newest first and writes one audit.read event after the list', async () => {
    const h = await operatorHarness();
    await call(h, 'POST', '/operator/v1/operator-keys', { operator: 'bob' });
    const res = await call(h, 'GET', '/operator/v1/audit?action=operator_key.issue');
    expect(res.statusCode).toBe(200);
    const answer = res.json() as { events: Array<Record<string, unknown>>; next?: string };
    expect(answer.next).toBeUndefined();
    expect(answer.events).toEqual([{
      id: expect.stringMatching(/^aud_/), ts: new Date(T0 + 1).toISOString(), actor: { type: 'operator', id: 'alice' }, toolAccountId: null,
      action: 'operator_key.issue', target: { type: 'operator_key', id: expect.stringMatching(/^opk_/) }, result: 'ok', code: null,
      traceId: expect.any(String), clientIp: '127.0.0.1', details: { operator: 'bob', expiresAt: expect.any(String) },
    }]);
    const reads = listAuditEvents(h.db, { limit: 10, action: 'audit.read' }).events;
    expect(reads.map((e) => [e.actor.id, e.target, e.result, e.traceId, e.details])).toEqual([
      ['alice', { type: 'audit', id: null }, 'ok', res.headers['x-trace-id'], { query: { action: 'operator_key.issue' }, cursor: false, count: 1 }],
    ]);
  });

  it('AC-LA-E5-02-06: ?toolAccountId=qa-second returns only qa-second events', async () => {
    const h = await operatorHarness();
    for (const [account, ts] of [['cogniate', T0 - 3], ['qa-second', T0 - 2], [null, T0 - 1]] as const) {
      insertAuditEvent(h.db, { actor: { type: 'api_key', id: `bootstrap-${account}` }, toolAccountId: account, traceId: null, clientIp: null, action: 'platform.create', target: { type: 'platform', id: null }, result: 'ok' }, ts);
    }
    const res = await call(h, 'GET', '/operator/v1/audit?toolAccountId=qa-second');
    expect((res.json() as { events: Array<{ toolAccountId: string }> }).events.map((e) => e.toolAccountId)).toEqual(['qa-second']);
  });

  it('pages with limit and the next cursor; filters since, until and actorId', async () => {
    const h = await operatorHarness();
    for (let i = 0; i < 5; i++) insertAuditEvent(h.db, { actor: { type: 'operator', id: i % 2 ? 'bob' : 'carol' }, toolAccountId: null, traceId: null, clientIp: null, action: 'operator_key.issue', target: { type: 'operator_key', id: `opk_${i}` }, result: 'ok' }, T0 - 100 + i);
    const page1 = (await call(h, 'GET', '/operator/v1/audit?action=operator_key.issue&limit=2')).json() as { events: Array<{ target: { id: string } }>; next: string };
    expect(page1.events.map((e) => e.target.id)).toEqual(['opk_4', 'opk_3']);
    const page2 = (await call(h, 'GET', `/operator/v1/audit?action=operator_key.issue&limit=2&cursor=${page1.next}`)).json() as { events: Array<{ target: { id: string } }>; next: string };
    expect(page2.events.map((e) => e.target.id)).toEqual(['opk_2', 'opk_1']);
    const page3 = (await call(h, 'GET', `/operator/v1/audit?action=operator_key.issue&limit=2&cursor=${page2.next}`)).json() as { events: Array<{ target: { id: string } }>; next?: string };
    expect([page3.events.map((e) => e.target.id), page3.next]).toEqual([['opk_0'], undefined]);
    const since = new Date(T0 - 99).toISOString();
    const until = new Date(T0 - 97).toISOString();
    const window = (await call(h, 'GET', `/operator/v1/audit?action=operator_key.issue&since=${since}&until=${until}&actorId=bob`)).json() as { events: Array<{ target: { id: string } }> };
    expect(window.events.map((e) => e.target.id)).toEqual(['opk_3', 'opk_1']);
  });

  it('BD-A2-50: filters traceId together with tenant and action and records the read filters', async () => {
    const h = await operatorHarness();
    const traceId = 'trace-key-rewrap-1234';
    for (const [tenant, trace, action] of [
      ['cogniate', traceId, 'key_provider.rewrap'], ['cogniate', 'another-trace-1234', 'key_provider.rewrap'],
      ['qa-second', traceId, 'key_provider.rewrap'], ['cogniate', traceId, 'settings.rate_limits'],
    ]) insertAuditEvent(h.db, {
      actor: { type: 'system', id: 'key-rewrap' }, toolAccountId: tenant!, traceId: trace!, clientIp: null,
      action: action!, target: { type: 'key_provider', id: null }, result: 'ok',
    }, T0);
    const query = { traceId, toolAccountId: 'cogniate', action: 'key_provider.rewrap' };
    const response = await call(h, 'GET', `/operator/v1/audit?${new URLSearchParams(query)}`);
    expect(response.statusCode).toBe(200);
    expect(response.json().events).toMatchObject([{ traceId, toolAccountId: 'cogniate', action: 'key_provider.rewrap' }]);
    expect(response.json().events).toHaveLength(1);
    expect(stored(h).at(-1)).toMatchObject({ action: 'audit.read', details: { query, count: 1 } });
    expect((await call(h, 'GET', '/operator/v1/audit?traceId=unknown-trace-1234')).json().events).toEqual([]);
  });

  it('refuses a bad query with 400 INVALID_REQUEST naming the field, and records the refused read', async () => {
    const h = await operatorHarness();
    for (const [query, field] of [['limit=501', 'limit'], ['limit=0', 'limit'], ['since=yesterday', 'since'], ['cursor=bm9wZQ', 'cursor'], ['traceId=bad', 'traceId']]) {
      const res = await call(h, 'GET', `/operator/v1/audit?${query}`);
      expect([query, res.statusCode, res.json().details.description]).toEqual([query, 400, `Invalid field: ${field}.`]);
    }
    expect(listAuditEvents(h.db, { limit: 10, action: 'audit.read' }).events.map((e) => [e.result, e.code])).toEqual(Array(5).fill(['refused', 'INVALID_REQUEST']));
    expect((await call(h, 'GET', '/operator/v1/audit', undefined, '')).statusCode).toBe(401);
    expect(listAuditEvents(h.db, { limit: 10, action: 'audit.read' }).events).toHaveLength(5);
  });

  it('an answer holds no key: secret scan of the read after key changes (AP-06-16, unit part)', async () => {
    const h = await operatorHarness();
    const issued = (await call(h, 'POST', '/operator/v1/operator-keys', { operator: 'bob' })).json() as { id: string; operatorKey: string };
    await call(h, 'POST', `/operator/v1/operator-keys/${issued.id}/revoke`);
    const text = (await call(h, 'GET', '/operator/v1/audit?limit=500')).body;
    for (const secret of [issued.operatorKey, h.key]) expect(text).not.toContain(secret);
    expect(text).not.toMatch(/ltio_[A-Za-z0-9_-]{8,}|ltis_[A-Za-z0-9_-]{8,}|"d":"|PRIVATE KEY/);
  });
});
