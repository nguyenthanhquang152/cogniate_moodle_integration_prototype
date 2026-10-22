import { createLocalKeyProvider, legacyKeyRing } from '@cogniate/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Db } from '../db/index.ts';
import { openDb } from '../db/index.ts';
import { ensureAccount } from './accounts.ts';
import {
  RETIRED_KEEP_MS, activateToolKey, activePrivateJwk, createNextToolKey, ensureToolKey, listSigningKeys, prepareToolKey,
  publicJwks, removeToolKey,
} from './tool-keys.ts';

const DAY = 24 * 3600 * 1000;
const T0 = Date.parse('2026-10-22T10:00:00Z');
const databases: Db[] = [];
afterEach(() => { vi.useRealTimers(); for (const db of databases.splice(0)) db.close(); });

async function fixture() {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(T0);
  const db = openDb(':memory:');
  databases.push(db);
  const keys = createLocalKeyProvider(legacyKeyRing(Buffer.alloc(32, 7)));
  for (const id of ['cogniate', 'second']) ensureAccount(db, { id, name: id, appUrl: 'https://app.test' });
  const a = await ensureToolKey(db, keys, 'cogniate');
  const next = async (now = T0) => createNextToolKey(db, await prepareToolKey(keys, 'cogniate'), now);
  return { db, keys, a, next };
}

describe('signing-key lifecycle', () => {
  it('AC-LA-E5-10-05: lead time 600 s refuses at 599 s and passes at 600 s; the active cache follows the commit', async () => {
    const { db, keys, a, next } = await fixture();
    const b = await next();
    expect(publicJwks(db, 'cogniate', T0).map((key) => key.kid)).toEqual([a, b.kid]);
    expect(activePrivateJwk(db, keys, 'cogniate', T0)?.kid).toBe(a);
    expect(() => activateToolKey(db, 'cogniate', b.kid, { publishLeadSeconds: 600 }, T0 + 599_000))
      .toThrow(expect.objectContaining({ status: 409, code: 'SIGNING_KEY_NOT_PUBLISHED_LONG_ENOUGH' }));
    expect(listSigningKeys(db, 'cogniate').map((key) => key.status)).toEqual(['active', 'next']);
    expect(activateToolKey(db, 'cogniate', b.kid, { publishLeadSeconds: 600 }, T0 + 600_000))
      .toEqual({ kid: b.kid, status: 'active', activatedAt: T0 + 600_000, retired: a });
    expect(activePrivateJwk(db, keys, 'cogniate', T0 + 600_000)?.kid).toBe(b.kid);
    expect(publicJwks(db, 'cogniate', T0 + 600_000).map((key) => key.kid)).toEqual([b.kid, a]);
  });

  it('AC-LA-E5-10-07: a key created 40 days ago stays published for 30 days after retirement', async () => {
    const { db, a, next } = await fixture();
    db.prepare('UPDATE tool_key SET created_at = ?, published_at = ?, activated_at = ? WHERE kid = ?')
      .run(T0 - 40 * DAY, T0 - 40 * DAY, T0 - 40 * DAY, a);
    const b = await next();
    activateToolKey(db, 'cogniate', b.kid, { force: true }, T0);
    for (const now of [T0, T0 + RETIRED_KEEP_MS - 1]) expect(publicJwks(db, 'cogniate', now).map((key) => key.kid)).toEqual([b.kid, a]);
    for (const now of [T0 + RETIRED_KEEP_MS, T0 + RETIRED_KEEP_MS + 1000]) expect(publicJwks(db, 'cogniate', now).map((key) => key.kid)).toEqual([b.kid]);
    expect(listSigningKeys(db, 'cogniate').find((key) => key.kid === a)?.retiredAt).toBe(T0);
  });

  it('AC-LA-E5-10-13: remove a next key at once, clear its private part and leave the active key intact', async () => {
    const { db, keys, a, next } = await fixture();
    const b = await next();
    expect(removeToolKey(db, 'cogniate', b.kid, T0 + 1)).toEqual({ kid: b.kid, status: 'removed' });
    expect(publicJwks(db, 'cogniate', T0 + 1).map((key) => key.kid)).toEqual([a]);
    expect(activePrivateJwk(db, keys, 'cogniate', T0 + 1)?.kid).toBe(a);
    expect(listSigningKeys(db, 'cogniate').find((key) => key.kid === b.kid)).toEqual({
      ...b, status: 'removed', removedAt: T0 + 1, activatedAt: null, retiredAt: null,
    });
    expect(db.prepare('SELECT length(private_jwk_encrypted) AS bytes FROM tool_key WHERE kid = ?').get(b.kid)?.bytes).toBe(0);
    expect((await next(T0 + 2)).status).toBe('next');
  });

  it('refuses wrong states and cross-account ids without changing either account', async () => {
    const { db, a, next } = await fixture();
    const b = await next();
    expect(() => activateToolKey(db, 'cogniate', a, { force: true }, T0)).toThrow(expect.objectContaining({ status: 409, code: 'SIGNING_KEY_WRONG_STATE' }));
    expect(() => removeToolKey(db, 'cogniate', a, T0)).toThrow(expect.objectContaining({ status: 409, code: 'SIGNING_KEY_ACTIVE' }));
    for (const account of ['second', 'missing']) {
      expect(() => activateToolKey(db, account, b.kid, { force: true }, T0)).toThrow(expect.objectContaining({ status: 404, code: 'NOT_FOUND' }));
      expect(() => removeToolKey(db, account, b.kid, T0)).toThrow(expect.objectContaining({ status: 404, code: 'NOT_FOUND' }));
    }
    activateToolKey(db, 'cogniate', b.kid, { force: true }, T0);
    expect(() => activateToolKey(db, 'cogniate', a, { force: true }, T0)).toThrow(expect.objectContaining({ code: 'SIGNING_KEY_WRONG_STATE' }));
    removeToolKey(db, 'cogniate', a, T0);
    for (const action of [() => activateToolKey(db, 'cogniate', a, { force: true }, T0), () => removeToolKey(db, 'cogniate', a, T0)]) {
      expect(action).toThrow(expect.objectContaining({ status: 409, code: 'SIGNING_KEY_WRONG_STATE' }));
    }
    expect(listSigningKeys(db, 'cogniate').map((key) => key.status)).toEqual(['active', 'removed']);
  });

  it('rechecks the next slot after preparation; two prepared keys cannot both publish', async () => {
    const { db, keys } = await fixture();
    const [one, two] = await Promise.all([prepareToolKey(keys, 'cogniate'), prepareToolKey(keys, 'cogniate')]);
    createNextToolKey(db, one, T0);
    expect(() => createNextToolKey(db, two, T0)).toThrow(expect.objectContaining({ status: 409, code: 'SIGNING_KEY_NEXT_EXISTS' }));
    expect(listSigningKeys(db, 'cogniate').map((key) => key.status)).toEqual(['active', 'next']);
  });

  it('concurrent bootstrap calls keep exactly one active key and its timestamps', async () => {
    const { db, keys } = await fixture();
    const [one, two] = await Promise.all([ensureToolKey(db, keys, 'second'), ensureToolKey(db, keys, 'second')]);
    expect(one).toBe(two);
    expect(listSigningKeys(db, 'second')).toEqual([{
      kid: one, status: 'active', publishedAt: T0, activatedAt: T0, retiredAt: null, removedAt: null,
    }]);
  });
});
