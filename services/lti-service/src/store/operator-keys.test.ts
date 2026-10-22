// Operator keys (LA-ADR-06 D3): storage rules with a controlled clock, init modes, and migration 005.
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openSqlite, sha256Hex } from '@cogniate/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { openDb } from '../db/index.ts';
import { findAccountByApiKey } from './accounts.ts';
import {
  OPERATOR_KEY_DEFAULT_TTL_MS, findActiveOperatorKey, hasActiveOperatorKey, initOperatorKey, issueOperatorKey, listOperatorKeys, operatorKeyExpiryInRange,
  operatorKeyMaxExpiry, revokeOperatorKey,
} from './operator-keys.ts';

const HOUR = 3600 * 1000;
const T0 = Date.parse('2026-10-22T10:00:00.000Z');
const MIGRATIONS = join(dirname(fileURLToPath(import.meta.url)), '..', 'db', 'migrations');
const temps: string[] = [];
afterEach(() => { for (const t of temps.splice(0)) rmSync(t, { recursive: true, force: true }); });

describe('operator key storage', () => {
  it('stores only the SHA-256 hash; a key works until expires_at (AC-LA-E5-01-11, store part) and sets last_used_at', () => {
    const db = openDb(':memory:');
    const { record, operatorKey } = issueOperatorKey(db, { operator: 'alice', expiresAt: T0 + 2 * HOUR }, T0);
    expect(operatorKey).toMatch(/^ltio_[A-Za-z0-9_-]{43}$/);
    const row = db.prepare('SELECT * FROM operator_key').get() as Record<string, unknown>;
    expect(row).toEqual({ id: record.id, operator: 'alice', key_hash: sha256Hex(operatorKey), created_at: T0, expires_at: T0 + 2 * HOUR, last_used_at: null, revoked_at: null });
    expect(JSON.stringify(record)).not.toContain(operatorKey);
    expect(findActiveOperatorKey(db, operatorKey, record.expiresAt - 1000)).toMatchObject({ id: record.id, lastUsedAt: record.expiresAt - 1000 });
    expect(listOperatorKeys(db)[0]!.lastUsedAt).toBe(record.expiresAt - 1000);
    expect(findActiveOperatorKey(db, operatorKey, record.expiresAt)).toBeNull();
    expect(findActiveOperatorKey(db, operatorKey, record.expiresAt + 1000)).toBeNull();
    expect(listOperatorKeys(db)[0]!.lastUsedAt).toBe(record.expiresAt - 1000);
  });

  it('keeps the two credential grammars apart: no tenant lookup of an ltio_ key, no operator lookup of an ltis_ key', () => {
    const db = openDb(':memory:');
    const { operatorKey } = issueOperatorKey(db, { operator: 'alice', expiresAt: T0 + HOUR }, T0);
    expect(findAccountByApiKey(db, operatorKey)).toBeNull();
    // An ltis_ value with the hash of a stored operator key still fails: the grammar check comes first.
    const tenantForm = `ltis_${operatorKey.slice(5)}`;
    db.prepare('UPDATE operator_key SET key_hash = ?').run(sha256Hex(tenantForm));
    expect(findActiveOperatorKey(db, tenantForm, T0)).toBeNull();
  });

  it('revoke keeps the first revoked_at; unknown id gives null', () => {
    const db = openDb(':memory:');
    const { record, operatorKey } = issueOperatorKey(db, { operator: 'alice', expiresAt: T0 + HOUR }, T0);
    expect(revokeOperatorKey(db, record.id, T0 + 1)?.revokedAt).toBe(T0 + 1);
    expect(revokeOperatorKey(db, record.id, T0 + 2)?.revokedAt).toBe(T0 + 1);
    expect(findActiveOperatorKey(db, operatorKey, T0 + 3)).toBeNull();
    expect(revokeOperatorKey(db, 'opk_unknown', T0)).toBeNull();
  });

  it('expiry range: 1 hour to one calendar year (UTC), both ends included', () => {
    expect(operatorKeyExpiryInRange(T0 + HOUR, T0)).toBe(true);
    expect(operatorKeyExpiryInRange(T0 + HOUR - 1, T0)).toBe(false);
    expect(operatorKeyMaxExpiry(T0)).toBe(Date.parse('2027-10-22T10:00:00.000Z'));
    expect(operatorKeyExpiryInRange(operatorKeyMaxExpiry(T0), T0)).toBe(true);
    expect(operatorKeyExpiryInRange(operatorKeyMaxExpiry(T0) + 1, T0)).toBe(false);
    // A year with 29 February has 366 days.
    const t = Date.parse('2027-06-01T00:00:00.000Z');
    expect(operatorKeyMaxExpiry(t) - t).toBe(366 * 24 * HOUR);
  });
});

describe('initOperatorKey (lti:operator init)', () => {
  it('makes the first key with the 90-day default; with an active key, refuse and if-none change nothing', () => {
    const db = openDb(':memory:');
    const first = initOperatorKey(db, { operator: 'alice', mode: 'refuse' }, T0);
    expect(first).toMatchObject({ result: 'issued', revoked: 0, record: { operator: 'alice', expiresAt: T0 + OPERATOR_KEY_DEFAULT_TTL_MS } });
    expect(initOperatorKey(db, { operator: 'qa', mode: 'refuse' }, T0 + 1)).toEqual({ result: 'exists' });
    expect(initOperatorKey(db, { operator: 'qa', mode: 'if-none' }, T0 + 1)).toEqual({ result: 'exists' });
    expect(listOperatorKeys(db)).toHaveLength(1);
  });

  it('replace revokes every key and makes one new key, in one transaction', () => {
    const db = openDb(':memory:');
    const a = issueOperatorKey(db, { operator: 'alice', expiresAt: T0 + HOUR }, T0);
    const b = issueOperatorKey(db, { operator: 'bob', expiresAt: T0 + HOUR }, T0);
    revokeOperatorKey(db, b.record.id, T0);
    const r = initOperatorKey(db, { operator: 'qa', mode: 'replace' }, T0 + 5);
    if (r.result !== 'issued') throw new Error('expected a new key');
    expect([r.revoked, r.record.operator]).toEqual([1, 'qa']);
    expect(findActiveOperatorKey(db, a.operatorKey, T0 + 6)).toBeNull();
    expect(findActiveOperatorKey(db, r.operatorKey, T0 + 6)?.id).toBe(r.record.id);
    expect(listOperatorKeys(db).map((k) => [k.operator, k.revokedAt])).toEqual(expect.arrayContaining([['alice', T0 + 5], ['bob', T0], ['qa', null]]));
  });

  it('counts only active keys: after every key expired, init makes a new one', () => {
    const db = openDb(':memory:');
    issueOperatorKey(db, { operator: 'alice', expiresAt: T0 + HOUR }, T0);
    expect(hasActiveOperatorKey(db, T0 + HOUR - 1)).toBe(true);
    expect(hasActiveOperatorKey(db, T0 + HOUR)).toBe(false);
    expect(initOperatorKey(db, { operator: 'alice', mode: 'refuse' }, T0 + HOUR)).toMatchObject({ result: 'issued', revoked: 0 });
  });

  it('refuses an invalid operator name and writes nothing', () => {
    const db = openDb(':memory:');
    expect(() => initOperatorKey(db, { operator: 'a b', mode: 'replace' }, T0)).toThrow(/invalid operator name/);
    expect(listOperatorKeys(db)).toEqual([]);
  });
});

describe('005_operator_key on a v4 database with rows', () => {
  it('adds the empty operator_key table and keeps the old rows', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lti-mig5-'));
    temps.push(dir);
    const v4 = join(dir, 'v4');
    mkdirSync(v4);
    for (const f of readdirSync(MIGRATIONS).filter((n) => n < '005')) copyFileSync(join(MIGRATIONS, f), join(v4, f));
    const file = join(dir, 'lti.db');
    let db = openSqlite(file, v4);
    db.prepare("INSERT INTO tool_account VALUES ('cogniate', 'C', 'h', 'l', 'd', 'r', 0)").run();
    db.close();
    db = openSqlite(file, MIGRATIONS);
    expect(db.prepare('SELECT id, name FROM tool_account').all()).toEqual([{ id: 'cogniate', name: 'C' }]);
    expect(db.prepare('SELECT COUNT(*) AS n FROM operator_key').get()).toEqual({ n: 0 });
    expect(db.prepare("SELECT name FROM schema_migration WHERE name = '005_operator_key.sql'").all()).toHaveLength(1);
    db.close();
  });
});
