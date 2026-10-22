import { createLocalKeyProvider, legacyKeyRing, sha256Hex } from '@cogniate/shared';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import type { Db } from '../../db/index.ts';
import { openDb } from '../../db/index.ts';
import { ensureAccount } from '../../store/accounts.ts';
import { getApiKey, listApiKeys } from '../../store/api-keys.ts';
import { listAuditEvents } from '../../store/audit.ts';
import { issueOperatorKey } from '../../store/operator-keys.ts';
import { capturingLogger, URLS } from '../../testkit.ts';
import { buildOperatorApp } from './index.ts';

const T0 = Date.parse('2026-10-22T10:00:00Z');
const resources: Array<{ db: Db; app: FastifyInstance }> = [];
afterEach(async () => { for (const { db, app } of resources.splice(0)) { await app.close(); db.close(); } });
async function fixture() {
  const db = openDb(':memory:');
  const keys = createLocalKeyProvider(legacyKeyRing(Buffer.alloc(32, 7)));
  ensureAccount(db, { id: 'cogniate', name: 'Cogniate', appUrl: 'https://app.test' });
  const { logger, lines } = capturingLogger();
  const app = await buildOperatorApp({ db, keys, urls: URLS, logger, now: () => T0 });
  resources.push({ db, app });
  const { operatorKey } = issueOperatorKey(db, { operator: 'unit', expiresAt: T0 + 3600_000 }, T0);
  const headers = { authorization: `OPERATOR-AUTH-V1 ${operatorKey}` };
  const post = (path = '', body?: unknown) => app.inject({ method: 'POST', url: `/operator/v1/accounts/cogniate/api-keys${path}`,
    headers: { ...headers, 'content-type': 'application/json' }, ...(body === undefined ? {} : { payload: JSON.stringify(body) }) });
  const events = () => listAuditEvents(db, { limit: 100 }).events;
  return { db, app, post, headers, events, lines };
}

describe('API key operator transactions', () => {
  it.each(['expiresat', 'expires_at', 'unexpected'])('rejects unknown issue field %s without issuing a key', async (field) => {
    const h = await fixture();
    const before = listApiKeys(h.db, 'cogniate');
    const response = await h.post('', { label: 'short-lived', scopes: ['launch'], [field]: new Date(T0 + 7200_000).toISOString() });
    expect(response.statusCode).toBe(400);
    expect(response.json().details).toEqual({ message: 'INVALID_REQUEST', description: `Unknown field: ${field}.`, field });
    expect(response.json()).not.toHaveProperty('apiKey');
    expect(listApiKeys(h.db, 'cogniate')).toEqual(before);
    expect(h.events()).toEqual([expect.objectContaining({ action: 'api_key.issue', result: 'refused', code: 'INVALID_REQUEST',
      target: { type: 'api_key', id: null }, traceId: response.headers['x-trace-id'] })]);
    expect(h.lines.some((line) => line.event === 'api_key_issued')).toBe(false);
  });

  it('keeps the requested expiry when expiresAt is spelled correctly', async () => {
    const h = await fixture();
    const expiresAt = new Date(T0 + 7200_000).toISOString();
    const response = await h.post('', { label: 'short-lived', scopes: ['launch'], expiresAt });
    expect(response.statusCode).toBe(201);
    expect(response.json().expiresAt).toBe(expiresAt);
    expect(getApiKey(h.db, 'cogniate', response.json().id)?.expiresAt).toBe(T0 + 7200_000);
  });

  it('an audit insert failure rolls back issuance and revoke, and does not expose a new secret', async () => {
    const h = await fixture();
    const before = listApiKeys(h.db, 'cogniate');
    const fail = () => h.db.exec("CREATE TRIGGER unit_fail_audit BEFORE INSERT ON audit_event BEGIN SELECT RAISE(ABORT, 'unit fault'); END");
    const recover = () => h.db.exec('DROP TRIGGER unit_fail_audit');
    fail();
    const failed = await h.post('', { label: 'rotation', scopes: ['launch', 'admin'] });
    expect(failed.statusCode).toBe(500);
    expect(failed.json()).not.toHaveProperty('apiKey');
    expect(listApiKeys(h.db, 'cogniate')).toEqual(before);
    expect(h.events()).toHaveLength(0);
    recover();
    const created = await h.post('', { label: 'rotation', scopes: ['launch', 'admin'] });
    expect(created.statusCode).toBe(201);
    const { id, apiKey } = created.json() as { id: string; apiKey: string };
    const issued = getApiKey(h.db, 'cogniate', id);
    fail();
    expect((await h.post(`/${id}/revoke`)).statusCode).toBe(500);
    expect(getApiKey(h.db, 'cogniate', id)).toEqual(issued);
    expect(h.events()).toHaveLength(1);
    recover();
    const revoked = await h.post(`/${id}/revoke`);
    expect(revoked.statusCode).toBe(200);
    expect(h.events()).toHaveLength(2);
    expect(h.lines.filter((line) => line.event === 'api_key_issued' || line.event === 'api_key_revoked')).toEqual([
      expect.objectContaining({ event: 'api_key_issued', tool_account_id: 'cogniate', api_key_id: id, trace_id: created.headers['x-trace-id'] }),
      expect.objectContaining({ event: 'api_key_revoked', tool_account_id: 'cogniate', api_key_id: id, trace_id: revoked.headers['x-trace-id'] }),
    ]);
    const stored = JSON.stringify(h.events());
    for (const secret of [apiKey, sha256Hex(apiKey)]) {
      expect(stored).not.toContain(secret);
      expect(JSON.stringify(h.lines)).not.toContain(secret);
    }
  });

  it('a rejected issue writes one refused audit event without changing any key row', async () => {
    const h = await fixture();
    const before = listApiKeys(h.db, 'cogniate');
    const result = await h.post('', { label: 'unit', scopes: ['launch'], expiresAt: new Date(T0 + 3599_999).toISOString() });
    expect([result.statusCode, result.json().details.message]).toEqual([400, 'INVALID_REQUEST']);
    expect(result.json().details.description).toContain('expiresAt');
    expect(listApiKeys(h.db, 'cogniate')).toEqual(before);
    expect(h.events()).toEqual([expect.objectContaining({ action: 'api_key.issue', result: 'refused', code: 'INVALID_REQUEST',
      actor: { type: 'operator', id: 'unit' }, toolAccountId: 'cogniate', target: { type: 'api_key', id: null },
      traceId: result.headers['x-trace-id'] })]);
  });

  it('BD-A2-12: closed status precedes body errors; reads and idempotent revoke stay available', async () => {
    const h = await fixture();
    const key = listApiKeys(h.db, 'cogniate')[0]!;
    h.db.prepare("UPDATE tool_account SET status = 'closed' WHERE id = 'cogniate'").run();
    const before = listApiKeys(h.db, 'cogniate');
    const refused = await h.post('', { scopes: 'invalid' });
    expect([refused.statusCode, refused.json().details.message]).toEqual([409, 'ACCOUNT_CLOSED']);
    expect(listApiKeys(h.db, 'cogniate')).toEqual(before);
    expect(h.events()).toEqual([expect.objectContaining({ action: 'api_key.issue', result: 'refused', code: 'ACCOUNT_CLOSED' })]);
    const listed = await h.app.inject({ url: '/operator/v1/accounts/cogniate/api-keys', headers: h.headers });
    expect(listed.statusCode).toBe(200);
    const first = await h.post(`/${key.id}/revoke`);
    const again = await h.post(`/${key.id}/revoke`);
    expect([first.statusCode, again.statusCode]).toEqual([200, 200]);
    expect(again.json().revokedAt).toBe(first.json().revokedAt);
    expect(first.json().revokedAt).toBe(new Date(T0).toISOString());
    h.db.prepare("UPDATE tool_account SET status = 'suspended' WHERE id = 'cogniate'").run();
    expect((await h.post('', { label: 'suspended', scopes: ['launch'] })).statusCode).toBe(201);
    const missing = await h.app.inject({ method: 'POST', url: '/operator/v1/accounts/missing/api-keys', headers: h.headers, payload: {} });
    expect([missing.statusCode, missing.json().details.message]).toEqual([404, 'NOT_FOUND']);
  });
});
