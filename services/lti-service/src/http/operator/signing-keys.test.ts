import type { LocalKeyProvider } from '@cogniate/shared';
import { createLocalKeyProvider, legacyKeyRing } from '@cogniate/shared';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Db } from '../../db/index.ts';
import { openDb } from '../../db/index.ts';
import { ensureAccount } from '../../store/accounts.ts';
import { listAuditEvents } from '../../store/audit.ts';
import { issueOperatorKey } from '../../store/operator-keys.ts';
import { activePrivateJwk, ensureToolKey, listSigningKeys, publicJwks } from '../../store/tool-keys.ts';
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
  const provider = createLocalKeyProvider(legacyKeyRing(Buffer.alloc(32, 7)));
  const keys: LocalKeyProvider = { ...provider, async seal(plain, aad) {
    sealTransactions.push(db.isTransaction);
    await Promise.resolve();
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
  return { db, keys, app, clock, a, post, events, sealTransactions, lines, operatorKey };
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

    for (const [path, body, account, status, code] of [
      [`/${c}/activate`, { force: true }, 'cogniate', 409, 'SIGNING_KEY_WRONG_STATE'], // active
      [`/${h.a}/activate`, { force: true }, 'cogniate', 409, 'SIGNING_KEY_WRONG_STATE'], // retired
      [`/${b}/activate`, { force: true }, 'cogniate', 409, 'SIGNING_KEY_WRONG_STATE'], // removed
      [`/${b}/retire`, { immediate: true }, 'cogniate', 409, 'SIGNING_KEY_WRONG_STATE'],
      [`/${c}/retire`, { immediate: true }, 'cogniate', 409, 'SIGNING_KEY_ACTIVE'],
      [`/${c}/activate`, { force: true }, 'second', 404, 'NOT_FOUND'],
      [`/${h.a}/retire`, { immediate: true }, 'second', 404, 'NOT_FOUND'],
      ['/missing/activate', { force: true }, 'cogniate', 404, 'NOT_FOUND'],
      [`/${c}/retire`, { immediate: true }, 'missing', 404, 'NOT_FOUND'],
      [`/${h.a}/retire`, {}, 'cogniate', 400, 'INVALID_REQUEST'],
      [`/${h.a}/retire`, { immediate: false }, 'cogniate', 400, 'INVALID_REQUEST'],
      [`/${c}/activate`, { force: 'true' }, 'cogniate', 400, 'INVALID_REQUEST'],
    ] as const) {
      const before = listSigningKeys(h.db, 'cogniate');
      const count = h.events().length;
      const result = await h.post(path, body, account);
      expect([result.statusCode, result.json().details.message]).toEqual([status, code]);
      expect(listSigningKeys(h.db, 'cogniate')).toEqual(before);
      const events = h.events(); expect(events).toHaveLength(count + 1);
      expect(events.find((event) => event.traceId === result.headers['x-trace-id']))
        .toMatchObject({ result: 'refused', code, toolAccountId: account, target: { type: 'signing_key', id: path.split('/')[1] } });
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
});
