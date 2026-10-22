import type { LocalKeyProvider } from '@cogniate/shared';
import { createLocalKeyProvider, legacyKeyRing } from '@cogniate/shared';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Db } from '../../db/index.ts';
import { openDb } from '../../db/index.ts';
import { ensureAccount } from '../../store/accounts.ts';
import { listAuditEvents } from '../../store/audit.ts';
import { issueOperatorKey } from '../../store/operator-keys.ts';
import { activePrivateJwk, createNextToolKey, ensureToolKey, listSigningKeys, prepareToolKey, publicJwks } from '../../store/tool-keys.ts';
import { URLS, capturingLogger } from '../../testkit.ts';
import { buildOperatorApp } from './index.ts';

const T0 = Date.parse('2026-10-22T10:00:00Z');
const resources: Array<{ db: Db; app: FastifyInstance }> = [];
afterEach(async () => {
  vi.unstubAllEnvs();
  for (const { app, db } of resources.splice(0)) { await app.close(); db.close(); }
});

async function fixture() {
  const db = openDb(':memory:');
  const sealTransactions: boolean[] = [];
  const sealHook = { run: () => {} };
  const provider = createLocalKeyProvider(legacyKeyRing(Buffer.alloc(32, 7)));
  const keys: LocalKeyProvider = { ...provider, async seal(plain, aad) {
    sealTransactions.push(db.isTransaction);
    await Promise.resolve();
    sealHook.run();
    sealTransactions.push(db.isTransaction);
    return provider.seal(plain, aad);
  } };
  for (const id of ['cogniate', 'second']) ensureAccount(db, { id, name: id, appUrl: 'https://app.test' });
  const a = await ensureToolKey(db, keys, 'cogniate');
  const { logger, lines } = capturingLogger();
  const clock = { now: T0 };
  const app = await buildOperatorApp({ urls: URLS, db, keys, logger, now: () => clock.now });
  resources.push({ db, app });
  const { operatorKey } = issueOperatorKey(db, { operator: 'unit', expiresAt: T0 + 3600_000 }, T0);
  const post = (path = '', body?: unknown, account = 'cogniate') => app.inject({
    method: 'POST', url: `/operator/v1/accounts/${account}/signing-keys${path}`,
    headers: { authorization: `OPERATOR-AUTH-V1 ${operatorKey}` }, ...(body === undefined ? {} : { payload: JSON.stringify(body), headers: {
      authorization: `OPERATOR-AUTH-V1 ${operatorKey}`, 'content-type': 'application/json',
    } }),
  });
  const events = () => listAuditEvents(db, { limit: 100 }).events;
  return { db, keys, app, clock, a, post, events, sealTransactions, sealHook, lines, operatorKey };
}

describe('signing-key operator routes', () => {
  it('AC-LA-E5-10-13: next removal, invalid transitions, cross-account ids and body errors each have one audit event', async () => {
    const h = await fixture();
    const created = await h.post();
    expect(created.statusCode).toBe(201);
    const b = created.json().kid as string;
    expect((await h.post(`/${b}/retire`, { immediate: true })).json()).toEqual({ kid: b, status: 'removed' });
    expect(publicJwks(h.db, 'cogniate', T0).map((key) => key.kid)).toEqual([h.a]);
    const replacement = await h.post(); expect(replacement.statusCode).toBe(201);
    const c = replacement.json().kid as string;
    expect((await h.post(`/${c}/activate`, { force: true })).statusCode).toBe(200);

    for (const [name, path, body, account, status, code] of [
      ['activate active', `/${c}/activate`, { force: true }, 'cogniate', 409, 'SIGNING_KEY_WRONG_STATE'],
      ['activate retired', `/${h.a}/activate`, { force: true }, 'cogniate', 409, 'SIGNING_KEY_WRONG_STATE'],
      ['activate removed', `/${b}/activate`, { force: true }, 'cogniate', 409, 'SIGNING_KEY_WRONG_STATE'],
      ['retire removed', `/${b}/retire`, { immediate: true }, 'cogniate', 409, 'SIGNING_KEY_WRONG_STATE'],
      ['retire active', `/${c}/retire`, { immediate: true }, 'cogniate', 409, 'SIGNING_KEY_ACTIVE'],
      ['activate another account key', `/${c}/activate`, { force: true }, 'second', 404, 'NOT_FOUND'],
      ['retire another account key', `/${h.a}/retire`, { immediate: true }, 'second', 404, 'NOT_FOUND'],
      ['activate unknown key', '/missing/activate', { force: true }, 'cogniate', 404, 'NOT_FOUND'],
      ['retire under unknown account', `/${c}/retire`, { immediate: true }, 'missing', 404, 'NOT_FOUND'],
      ['retire without immediate', `/${h.a}/retire`, {}, 'cogniate', 400, 'INVALID_REQUEST'],
      ['retire with immediate false', `/${h.a}/retire`, { immediate: false }, 'cogniate', 400, 'INVALID_REQUEST'],
      ['activate with string force', `/${c}/activate`, { force: 'true' }, 'cogniate', 400, 'INVALID_REQUEST'],
    ] as const) {
      const before = listSigningKeys(h.db, 'cogniate');
      const count = h.events().length;
      const result = await h.post(path, body, account);
      expect([result.statusCode, result.json().details.message], name).toEqual([status, code]);
      expect(listSigningKeys(h.db, 'cogniate'), name).toEqual(before);
      const events = h.events(); expect(events, name).toHaveLength(count + 1);
      expect(events.find((event) => event.traceId === result.headers['x-trace-id']), name)
        .toMatchObject({ result: 'refused', code, toolAccountId: account, target: { type: 'signing_key', id: path.split('/')[1] } });
      if (name.startsWith('retire without') || name.startsWith('retire with')) {
        expect(result.json().details, name).toEqual({ message: 'INVALID_REQUEST', field: 'immediate',
          description: 'retire needs {"immediate": true} (removes the key at once). A key becomes retired when the next key is activated.' });
      }
    }
    expect(h.events().filter((event) => event.result === 'ok').map((event) => event.action).sort())
      .toEqual(['signing_key.activate', 'signing_key.create', 'signing_key.create', 'signing_key.retire']);
    expect(h.events().find((event) => event.action === 'signing_key.activate' && event.result === 'ok')?.details?.forced).toBe(true);
    const listed = await h.app.inject({ url: '/operator/v1/accounts/cogniate/signing-keys', headers: { authorization: `OPERATOR-AUTH-V1 ${h.operatorKey}` } });
    expect(listed.json().signingKeys).toEqual(listSigningKeys(h.db, 'cogniate').map((key) => ({ ...key,
      publishedAt: new Date(key.publishedAt).toISOString(), activatedAt: key.activatedAt === null ? null : new Date(key.activatedAt).toISOString(),
      retiredAt: key.retiredAt === null ? null : new Date(key.retiredAt).toISOString(), removedAt: key.removedAt === null ? null : new Date(key.removedAt).toISOString(),
    })));
    expect(JSON.stringify(h.lines)).not.toContain(h.operatorKey);
  });

  it('AC-LA-E5-10-14: each signing-key 409 gives only public details and never Retry-After', async () => {
    const h = await fixture();
    const b = (await h.post()).json().kid as string;
    for (const [name, path, body, code, facts] of [
      ['waiting key', '', undefined, 'SIGNING_KEY_NEXT_EXISTS', { kid: b, publishedAt: new Date(T0).toISOString() }],
      ['publish lead', `/${b}/activate`, undefined, 'SIGNING_KEY_NOT_PUBLISHED_LONG_ENOUGH',
        { kid: b, activatableAt: new Date(T0 + 86_400_000).toISOString() }],
      ['activate active', `/${h.a}/activate`, { force: true }, 'SIGNING_KEY_WRONG_STATE', { kid: h.a, keyStatus: 'active' }],
      ['remove active', `/${h.a}/retire`, { immediate: true }, 'SIGNING_KEY_ACTIVE', { kid: h.a }],
    ] as const) {
      const before = listSigningKeys(h.db, 'cogniate');
      const response = await h.post(path, body);
      expect(response.statusCode, name).toBe(409);
      const { message, description, ...details } = response.json().details;
      expect(message, name).toBe(code);
      expect(description, name).toEqual(expect.any(String));
      expect(details, name).toEqual(facts);
      expect(response.headers['retry-after'], name).toBeUndefined();
      expect(listSigningKeys(h.db, 'cogniate'), name).toEqual(before);
      expect(h.events().filter((event) => event.traceId === response.headers['x-trace-id']), name)
        .toEqual([expect.objectContaining({ result: 'refused', code, details: null })]);
    }
    expect((await h.post(`/${b}/activate`, { force: true })).statusCode).toBe(200);
    for (const keyStatus of ['retired', 'removed'] as const) {
      if (keyStatus === 'removed') expect((await h.post(`/${h.a}/retire`, { immediate: true })).statusCode).toBe(200);
      const response = await h.post(`/${h.a}/activate`, { force: true });
      expect(response.statusCode, keyStatus).toBe(409);
      expect(response.json().details, keyStatus).toMatchObject({ message: 'SIGNING_KEY_WRONG_STATE', kid: h.a, keyStatus });
      expect(response.json().details, keyStatus).not.toHaveProperty('retryAfter');
      expect(response.headers['retry-after'], keyStatus).toBeUndefined();
    }
    const removed = await h.post(`/${h.a}/retire`, { immediate: true });
    expect(removed.json().details).toMatchObject({ message: 'SIGNING_KEY_WRONG_STATE', kid: h.a, keyStatus: 'removed' });
  });

  it.each(['empty', 'retired', 'removed'] as const)('AC-LA-E5-10-14: create an active key when only %s key history exists', async (history) => {
    const h = await fixture();
    const account = history === 'empty' ? 'second' : 'cogniate';
    if (history !== 'empty') {
      expect(activePrivateJwk(h.db, h.keys, account, T0)?.kid).toBe(h.a);
      h.db.prepare('UPDATE tool_key SET status = ?, retired_at = ?, removed_at = ? WHERE kid = ?')
        .run(history, T0 - 1, history === 'removed' ? T0 - 1 : null, h.a);
    }
    const response = await h.post('', undefined, account);
    expect(response.statusCode).toBe(201);
    const { kid } = response.json() as { kid: string };
    expect(response.json()).toEqual({ kid, status: 'active', publishedAt: new Date(T0).toISOString() });
    expect(listSigningKeys(h.db, account)[0]).toEqual({ kid, status: 'active', publishedAt: T0, activatedAt: T0, retiredAt: null, removedAt: null });
    expect(publicJwks(h.db, account, T0)[0]?.kid).toBe(kid);
    expect(activePrivateJwk(h.db, h.keys, account, T0)?.kid).toBe(kid);
    expect(h.events()).toEqual([expect.objectContaining({ action: 'signing_key.create', result: 'ok', toolAccountId: account,
      target: { type: 'signing_key', id: kid }, details: { status: 'active' } })]);
    expect(h.sealTransactions.every((inTransaction) => !inTransaction)).toBe(true);
    expect((await h.post('', undefined, account)).json().status).toBe('next');
  });

  it('an audit failure rolls back creation of the first active key', async () => {
    const h = await fixture();
    h.db.exec("CREATE TRIGGER unit_fail_audit BEFORE INSERT ON audit_event BEGIN SELECT RAISE(ABORT, 'unit fault'); END");
    expect((await h.post('', undefined, 'second')).statusCode).toBe(500);
    expect(listSigningKeys(h.db, 'second')).toEqual([]);
    expect(h.events()).toEqual([]);
  });

  it('BD-A2-24: activate a next key without an active key; return retired null and keep audit atomicity', async () => {
    vi.stubEnv('SIGNING_KEY_PUBLISH_LEAD_S', '600');
    const h = await fixture();
    const b = (await h.post()).json().kid as string;
    h.db.prepare("UPDATE tool_key SET status = 'retired', retired_at = ? WHERE kid = ?").run(T0, h.a);
    h.clock.now = T0 + 600_000;
    const before = listSigningKeys(h.db, 'cogniate');
    h.db.exec("CREATE TRIGGER unit_fail_audit BEFORE INSERT ON audit_event BEGIN SELECT RAISE(ABORT, 'unit fault'); END");
    expect((await h.post(`/${b}/activate`)).statusCode).toBe(500);
    expect(listSigningKeys(h.db, 'cogniate')).toEqual(before);
    expect(h.events()).toHaveLength(1);
    h.db.exec('DROP TRIGGER unit_fail_audit');
    const response = await h.post(`/${b}/activate`);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ kid: b, status: 'active', activatedAt: new Date(h.clock.now).toISOString(), retired: null });
    expect(activePrivateJwk(h.db, h.keys, 'cogniate', h.clock.now)?.kid).toBe(b);
    expect(h.events().find((event) => event.traceId === response.headers['x-trace-id']))
      .toMatchObject({ action: 'signing_key.activate', result: 'ok', details: { forced: false, retired: null } });
    expect(JSON.stringify(h.lines)).not.toContain('"kid":null');
  });

  it('rechecks the active key after async preparation before choosing active or next', async () => {
    const h = await fixture();
    const first = await prepareToolKey(h.keys, 'second');
    h.sealHook.run = () => { createNextToolKey(h.db, first, T0); };
    const response = await h.post('', undefined, 'second');
    expect(response.statusCode).toBe(201);
    expect(response.json().status).toBe('next');
    expect(listSigningKeys(h.db, 'second').map(({ kid, status }) => ({ kid, status })))
      .toEqual([{ kid: first.kid, status: 'active' }, { kid: response.json().kid, status: 'next' }]);
    expect(h.events()).toEqual([expect.objectContaining({ action: 'signing_key.create', result: 'ok', details: { status: 'next' } })]);
  });

  it('async seal runs outside the transaction; an audit failure rolls back create, activation and removal', async () => {
    const h = await fixture();
    const fail = () => h.db.exec("CREATE TRIGGER unit_fail_audit BEFORE INSERT ON audit_event BEGIN SELECT RAISE(ABORT, 'unit fault'); END");
    const recover = () => h.db.exec('DROP TRIGGER unit_fail_audit');
    fail();
    expect((await h.post()).statusCode).toBe(500);
    expect(listSigningKeys(h.db, 'cogniate').map((key) => key.kid)).toEqual([h.a]);
    expect(h.events()).toHaveLength(0);
    expect(h.sealTransactions.every((inTransaction) => !inTransaction)).toBe(true);
    recover();
    const b = (await h.post()).json().kid as string;
    expect(activePrivateJwk(h.db, h.keys, 'cogniate', T0)?.kid).toBe(h.a);
    const beforeActivate = listSigningKeys(h.db, 'cogniate');
    fail();
    expect((await h.post(`/${b}/activate`, { force: true })).statusCode).toBe(500);
    expect(listSigningKeys(h.db, 'cogniate')).toEqual(beforeActivate);
    expect(activePrivateJwk(h.db, h.keys, 'cogniate', T0 + 1)?.kid).toBe(h.a);
    expect(h.events()).toHaveLength(1);
    recover();
    expect((await h.post(`/${b}/activate`, { force: true })).statusCode).toBe(200);
    expect(activePrivateJwk(h.db, h.keys, 'cogniate', T0 + 2)?.kid).toBe(b);
    const beforeRemove = h.db.prepare('SELECT * FROM tool_key WHERE kid = ?').get(h.a);
    fail();
    expect((await h.post(`/${h.a}/retire`, { immediate: true })).statusCode).toBe(500);
    expect(h.db.prepare('SELECT * FROM tool_key WHERE kid = ?').get(h.a)).toEqual(beforeRemove);
    expect(h.events()).toHaveLength(2);
  });

  it('reads lead time at registration; invalid settings stop registration', async () => {
    vi.stubEnv('SIGNING_KEY_PUBLISH_LEAD_S', '600');
    const h = await fixture();
    const b = (await h.post()).json().kid as string;
    vi.stubEnv('SIGNING_KEY_PUBLISH_LEAD_S', '86400');
    h.clock.now = T0 + 599_000;
    expect((await h.post(`/${b}/activate`)).statusCode).toBe(409);
    h.clock.now = T0 + 600_000;
    expect((await h.post(`/${b}/activate`)).statusCode).toBe(200);
    vi.stubEnv('SIGNING_KEY_PUBLISH_LEAD_S', '599');
    await expect(buildOperatorApp({ urls: URLS, db: h.db, keys: h.keys, logger: capturingLogger().logger })).rejects.toThrow(/SIGNING_KEY_PUBLISH_LEAD_S/);
  });

  it('BD-A2-12: closed accounts refuse create and activate before other errors; reads and removal still work', async () => {
    const h = await fixture();
    const next = (await h.post()).json().kid as string;
    h.db.prepare("UPDATE tool_account SET status = 'closed' WHERE id = 'cogniate'").run();
    const before = listSigningKeys(h.db, 'cogniate');
    const seals = h.sealTransactions.length;
    for (const response of [await h.post(), await h.post(`/${next}/activate`, { force: 'invalid' })]) {
      expect([response.statusCode, response.json().details.message]).toEqual([409, 'ACCOUNT_CLOSED']);
      expect(h.events().find((event) => event.traceId === response.headers['x-trace-id']))
        .toMatchObject({ result: 'refused', code: 'ACCOUNT_CLOSED' });
    }
    expect(h.sealTransactions).toHaveLength(seals);
    expect(listSigningKeys(h.db, 'cogniate')).toEqual(before);
    const read = await h.app.inject({ url: '/operator/v1/accounts/cogniate/signing-keys',
      headers: { authorization: `OPERATOR-AUTH-V1 ${h.operatorKey}` } });
    expect(read.statusCode).toBe(200);
    expect((await h.post(`/${next}/retire`, { immediate: true })).statusCode).toBe(200);
  });

  it('a close during async sealing prevents publication and records only a refused event', async () => {
    const h = await fixture();
    h.sealHook.run = () => { h.db.prepare("UPDATE tool_account SET status = 'closed' WHERE id = 'cogniate'").run(); };
    const response = await h.post();
    expect([response.statusCode, response.json().details.message]).toEqual([409, 'ACCOUNT_CLOSED']);
    expect(listSigningKeys(h.db, 'cogniate').map((key) => key.kid)).toEqual([h.a]);
    expect(h.events()).toEqual([expect.objectContaining({ action: 'signing_key.create', result: 'refused', code: 'ACCOUNT_CLOSED' })]);
    expect(h.sealTransactions.every((inTransaction) => !inTransaction)).toBe(true);
  });
});
