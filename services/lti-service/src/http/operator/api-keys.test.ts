import { createLocalKeyProvider, legacyKeyRing, sha256Hex } from '@cogniate/shared';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import type { Db } from '../../db/index.ts';
import { openDb } from '../../db/index.ts';
import { ensureAccount } from '../../store/accounts.ts';
import { getApiKey, issueApiKey, listApiKeys, revokeApiKey } from '../../store/api-keys.ts';
import { listAuditEvents } from '../../store/audit.ts';
import { issueOperatorKey } from '../../store/operator-keys.ts';
import { capturingLogger, URLS } from '../../testkit.ts';
import { authenticate } from '../auth.ts';
import { buildOperatorApp } from './index.ts';

const T0 = Date.parse('2026-10-22T10:00:00Z');
const resources: Array<{ db: Db; app: FastifyInstance }> = [];
afterEach(async () => { for (const { db, app } of resources.splice(0)) { await app.close(); db.close(); } });
async function fixture() {
  const db = openDb(':memory:');
  const keys = createLocalKeyProvider(legacyKeyRing(Buffer.alloc(32, 7)));
  const { apiKey } = ensureAccount(db, { id: 'cogniate', name: 'Cogniate', appUrl: 'https://app.test' });
  const { logger, lines } = capturingLogger();
  const app = await buildOperatorApp({ db, keys, urls: URLS, logger, now: () => T0 });
  resources.push({ db, app });
  const { operatorKey } = issueOperatorKey(db, { operator: 'unit', expiresAt: T0 + 3600_000 }, T0);
  const headers = { authorization: `OPERATOR-AUTH-V1 ${operatorKey}` };
  const post = (path = '', body?: unknown) => app.inject({ method: 'POST', url: `/operator/v1/accounts/cogniate/api-keys${path}`,
    headers: { ...headers, 'content-type': 'application/json' }, ...(body === undefined ? {} : { payload: JSON.stringify(body) }) });
  const events = () => listAuditEvents(db, { limit: 100 }).events;
  return { db, app, post, headers, events, lines, apiKey: apiKey! };
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

  it('BD-A2-33: rotates two active keys at once and records their ids in one issue event', async () => {
    const h = await fixture();
    const second = issueApiKey(h.db, 'cogniate', { label: 'custom', scopes: ['admin'], createdBy: 'operator:unit' }, T0);
    const oldIds = listApiKeys(h.db, 'cogniate').map((key) => key.id);
    const auth = (apiKey: string) => authenticate(h.db, `Bearer ${apiKey}`, ['bearer'], T0, () => {});
    for (const apiKey of [h.apiKey, second.apiKey]) expect(auth(apiKey).account.id).toBe('cogniate');
    const response = await h.post('', { label: 'emergency', scopes: ['launch', 'admin'], revokeOthers: true });
    expect(response.statusCode).toBe(201);
    const created = response.json() as { id: string; apiKey: string };
    for (const id of oldIds) expect(getApiKey(h.db, 'cogniate', id)?.revokedAt).toBe(T0);
    for (const apiKey of [h.apiKey, second.apiKey]) expect(() => auth(apiKey))
      .toThrow(expect.objectContaining({ status: 401, code: 'INVALID_LTIK_AUTH_AUTHORIZATION_HEADER' }));
    expect(auth(created.apiKey).actor).toEqual({ type: 'api_key', id: created.id });
    expect(listApiKeys(h.db, 'cogniate').filter((key) => key.revokedAt === null).map((key) => key.id)).toEqual([created.id]);
    expect(h.events()).toEqual([expect.objectContaining({ action: 'api_key.issue', result: 'ok',
      actor: { type: 'operator', id: 'unit' }, toolAccountId: 'cogniate', target: { type: 'api_key', id: created.id },
      traceId: response.headers['x-trace-id'],
      details: { label: 'emergency', scopes: ['launch', 'admin'], expiresAt: null, revokedKeyIds: oldIds } })]);
    const stored = JSON.stringify({ events: h.events(), logs: h.lines });
    for (const apiKey of [h.apiKey, second.apiKey, created.apiKey]) {
      expect(stored).not.toContain(apiKey);
      expect(stored).not.toContain(sha256Hex(apiKey));
    }
  });

  it.each([undefined, false])('keeps the two-key limit when revokeOthers is %s', async (revokeOthers) => {
    const h = await fixture();
    issueApiKey(h.db, 'cogniate', { label: 'second', scopes: ['admin'], createdBy: 'operator:unit' }, T0);
    const before = listApiKeys(h.db, 'cogniate');
    const response = await h.post('', { label: 'third', scopes: ['admin'], revokeOthers });
    expect([response.statusCode, response.json().details.message]).toEqual([409, 'API_KEY_LIMIT']);
    expect(response.json()).not.toHaveProperty('apiKey');
    expect(listApiKeys(h.db, 'cogniate')).toEqual(before);
    expect(h.events()).toEqual([expect.objectContaining({ action: 'api_key.issue', result: 'refused', code: 'API_KEY_LIMIT' })]);
  });

  it('emergency rotation preserves expired, revoked and other-account keys and omits their ids from the audit', async () => {
    const h = await fixture();
    const input = { label: 'old', scopes: ['admin'] as const, createdBy: 'operator:unit' };
    const expired = issueApiKey(h.db, 'cogniate', { ...input, expiresAt: T0 }, T0 - 3600_000);
    const revoked = issueApiKey(h.db, 'cogniate', input, T0);
    revokeApiKey(h.db, 'cogniate', revoked.record.id, T0 - 1);
    ensureAccount(h.db, { id: 'other', name: 'Other', appUrl: 'https://other.test' });
    const otherBefore = listApiKeys(h.db, 'other');
    const old = listApiKeys(h.db, 'cogniate').find((key) => key.label === 'bootstrap')!;
    const response = await h.post('', { label: 'emergency', scopes: ['admin'], revokeOthers: true });
    expect(response.statusCode).toBe(201);
    expect(getApiKey(h.db, 'cogniate', expired.record.id)).toEqual(expired.record);
    expect(getApiKey(h.db, 'cogniate', revoked.record.id)?.revokedAt).toBe(T0 - 1);
    expect(listApiKeys(h.db, 'other')).toEqual(otherBefore);
    expect(h.events()).toEqual([expect.objectContaining({ details: expect.objectContaining({ revokedKeyIds: [old.id] }) })]);
  });

  it.each(['api_key', 'audit_event'])('a failed %s insert rolls back emergency rotation', async (table) => {
    const h = await fixture();
    issueApiKey(h.db, 'cogniate', { label: 'second', scopes: ['admin'], createdBy: 'operator:unit' }, T0);
    const before = listApiKeys(h.db, 'cogniate');
    h.db.exec(`CREATE TRIGGER unit_fail_rotation BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT, 'unit fault'); END`);
    const response = await h.post('', { label: 'emergency', scopes: ['admin'], revokeOthers: true });
    expect(response.statusCode).toBe(500);
    expect(response.json()).not.toHaveProperty('apiKey');
    expect(listApiKeys(h.db, 'cogniate')).toEqual(before);
    expect(h.events()).toEqual([]);
    expect(h.lines.some((line) => line.event === 'api_key_issued' || line.event === 'api_key_revoked')).toBe(false);
  });

  it.each(['true', null])('rejects a non-boolean revokeOthers (%s) without revoking a key', async (revokeOthers) => {
    const h = await fixture();
    const before = listApiKeys(h.db, 'cogniate');
    const response = await h.post('', { label: 'emergency', scopes: ['admin'], revokeOthers });
    expect([response.statusCode, response.json().details.message]).toEqual([400, 'INVALID_REQUEST']);
    expect(response.json().details.description).toContain('revokeOthers');
    expect(listApiKeys(h.db, 'cogniate')).toEqual(before);
    expect(h.events()).toEqual([expect.objectContaining({ action: 'api_key.issue', result: 'refused', code: 'INVALID_REQUEST' })]);
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
    const result = await h.post('', { label: 'unit', scopes: ['launch'], expiresAt: new Date(T0 + 3599_999).toISOString(), revokeOthers: true });
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
    const refused = await h.post('', { scopes: 'invalid', revokeOthers: true });
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
