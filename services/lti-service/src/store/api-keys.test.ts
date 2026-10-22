import { sha256Hex } from '@cogniate/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Db } from '../db/index.ts';
import { openDb } from '../db/index.ts';
import { ensureAccount, findAccountByApiKey, getAccount } from './accounts.ts';
import {
  apiKeyExpiryInRange, apiKeyMaxExpiry, findActiveApiKey, getApiKey, issueApiKey, listApiKeys, revokeAccountApiKeys, revokeActiveAccountApiKeys, revokeApiKey,
} from './api-keys.ts';

const T0 = Date.parse('2026-10-22T10:00:00Z');
const HOUR = 3600_000;
const DAY = 24 * HOUR;
const databases: Db[] = [];
afterEach(() => { vi.restoreAllMocks(); for (const db of databases.splice(0)) db.close(); });
function fixture() {
  const db = openDb(':memory:'); databases.push(db);
  // Account creation has no API key. The frozen hash is an unusable value.
  for (const id of ['one', 'two']) db.prepare(`INSERT INTO tool_account
    (id, name, api_key_hash, launch_url, deep_linking_url, registration_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(id, id, sha256Hex(`unusable-${id}`), 'https://app.test/launch', 'https://app.test/deep', 'https://app.test/register', T0);
  const issue = (account = 'one', expiresAt: number | null = null) =>
    issueApiKey(db, account, { label: 'unit', scopes: ['launch', 'admin'], createdBy: 'operator:unit', expiresAt }, T0);
  return { db, issue };
}

describe('API key store', () => {
  it('stores a hash and display prefix, never the secret; metadata is scoped to its account', () => {
    const { db, issue } = fixture();
    const a = issue(); const b = issue('two');
    expect(a.apiKey).toMatch(/^ltis_[A-Za-z0-9_-]{43}$/);
    expect(a.record.id).toMatch(/^key_[A-Za-z0-9_-]+$/);
    expect(a.record.prefix).toBe(a.apiKey.slice(5, 13));
    expect(db.prepare('SELECT hash FROM api_key WHERE id = ?').get(a.record.id)?.hash).toBe(sha256Hex(a.apiKey));
    expect(JSON.stringify(db.prepare('SELECT * FROM api_key').all())).not.toContain(a.apiKey);
    expect(listApiKeys(db, 'one')).toEqual([a.record]);
    expect(getApiKey(db, 'one', b.record.id)).toBeNull();
    expect(revokeApiKey(db, 'one', b.record.id, T0 + 1)).toBeNull();
    expect(getApiKey(db, 'two', b.record.id)).toEqual(b.record);
    expect(JSON.stringify(listApiKeys(db, 'one'))).not.toContain(sha256Hex(a.apiKey));
  });

  it('counts only unrevoked, unexpired keys for the two-key limit', () => {
    const { db, issue } = fixture();
    const a = issue('one', T0 + HOUR); const b = issue();
    expect(() => issue()).toThrow(expect.objectContaining({ code: 'API_KEY_LIMIT', status: 409 }));
    revokeApiKey(db, 'one', b.record.id, T0 + 1);
    issue();
    expect(() => issue()).toThrow(expect.objectContaining({ code: 'API_KEY_LIMIT' }));
    const afterExpiry = issueApiKey(db, 'one', { label: 'new', scopes: ['launch'], createdBy: 'operator:unit' }, T0 + HOUR);
    expect(findActiveApiKey(db, a.apiKey, T0 + HOUR)).toBeNull();
    expect(afterExpiry.record.scopes).toEqual(['launch']);
  });

  it('expiry is inclusive at 1 hour and 2 calendar years; invalid inputs leave no row', () => {
    const { db } = fixture();
    expect(apiKeyMaxExpiry(T0)).toBe(Date.parse('2028-10-22T10:00:00Z'));
    expect(apiKeyMaxExpiry(T0) - T0).toBe(731 * DAY);
    for (const time of [T0 + HOUR, apiKeyMaxExpiry(T0)]) expect(apiKeyExpiryInRange(time, T0)).toBe(true);
    for (const time of [T0 + HOUR - 1, apiKeyMaxExpiry(T0) + 1, NaN, Infinity]) {
      expect(apiKeyExpiryInRange(time, T0)).toBe(false);
      expect(() => issueApiKey(db, 'one', { label: 'unit', scopes: ['launch'], createdBy: 'operator:unit', expiresAt: time }, T0))
        .toThrow(expect.objectContaining({ code: 'INVALID_REQUEST', description: expect.stringContaining('expiresAt') }));
    }
    for (const input of [{ label: ' ', scopes: ['launch'] as const }, { label: 'unit', scopes: [] }, { label: 'unit', scopes: ['launch', 'launch'] as const }]) {
      expect(() => issueApiKey(db, 'one', { ...input, createdBy: 'operator:unit' }, T0)).toThrow(expect.objectContaining({ code: 'INVALID_REQUEST' }));
    }
    expect(listApiKeys(db, 'one')).toEqual([]);
  });

  it('the lookup gives one invalid result for unknown, wrong format, revoked and expired credentials', () => {
    const { db, issue } = fixture(); const a = issue('one', T0 + HOUR);
    expect(findActiveApiKey(db, a.apiKey, T0 + HOUR - 1)?.id).toBe(a.record.id);
    for (const now of [T0 + HOUR, T0 + HOUR + 1000]) expect(findActiveApiKey(db, a.apiKey, now)).toBeNull();
    for (const key of ['', `ltio_${a.apiKey.slice(5)}`, `ltis_${'A'.repeat(43)}`, `${a.apiKey}:x`]) expect(findActiveApiKey(db, key, T0)).toBeNull();
    revokeApiKey(db, 'one', a.record.id, T0 + 2);
    expect(findActiveApiKey(db, a.apiKey, T0 + 3)).toBeNull();
    expect(revokeApiKey(db, 'one', a.record.id, T0 + 4)?.revokedAt).toBe(T0 + 2);
  });

  it('AC-LA-E5-07-10: last_used_at changes at most once per minute under repeated calls', () => {
    const { db, issue } = fixture(); const a = issue();
    db.exec(`CREATE TEMP TABLE usage_probe (ts INTEGER);
      CREATE TEMP TRIGGER record_usage AFTER UPDATE OF last_used_at ON api_key BEGIN INSERT INTO usage_probe VALUES (NEW.last_used_at); END`);
    for (const now of [T0, T0 + 1, T0 + 500, T0 + 59_999]) {
      expect(findActiveApiKey(db, a.apiKey, now)?.lastUsedAt).toBe(T0);
    }
    expect(findActiveApiKey(db, a.apiKey, T0 + 60_000)?.lastUsedAt).toBe(T0 + 60_000);
    expect(findActiveApiKey(db, a.apiKey, T0 + 60_001)?.lastUsedAt).toBe(T0 + 60_000);
    expect(db.prepare('SELECT ts FROM usage_probe').all()).toEqual([{ ts: T0 }, { ts: T0 + 60_000 }]);
  });

  it('account close revokes every row only for that account, including expired rows', () => {
    const { db, issue } = fixture(); const a = issue('one', T0 + HOUR); const b = issue(); const other = issue('two');
    revokeApiKey(db, 'one', b.record.id, T0 + 1);
    expect(revokeAccountApiKeys(db, 'one', T0 + HOUR + 1)).toBe(1);
    expect(revokeAccountApiKeys(db, 'one', T0 + HOUR + 2)).toBe(0);
    expect(getApiKey(db, 'one', a.record.id)?.revokedAt).toBe(T0 + HOUR + 1);
    expect(getApiKey(db, 'one', b.record.id)?.revokedAt).toBe(T0 + 1);
    expect(getApiKey(db, 'two', other.record.id)?.revokedAt).toBeNull();
  });

  it('CLI rotation revokes active keys of all labels, while preserving expired rows and other accounts', () => {
    const { db, issue } = fixture();
    const expired = issue('one', T0 + HOUR); const bootstrap = issue(); const other = issue('two');
    const custom = issueApiKey(db, 'one', { label: 'custom', scopes: ['admin'], createdBy: 'operator:unit' }, T0 + HOUR);
    expect(revokeActiveAccountApiKeys(db, 'one', T0 + HOUR)).toBe(2);
    expect(getApiKey(db, 'one', expired.record.id)?.revokedAt).toBeNull();
    for (const key of [bootstrap, custom]) expect(getApiKey(db, 'one', key.record.id)?.revokedAt).toBe(T0 + HOUR);
    expect(getApiKey(db, 'two', other.record.id)?.revokedAt).toBeNull();
  });
});

describe('bootstrap API key bridge (BD-A2-10)', () => {
  it('new accounts get one bootstrap key; emergency rotation replaces all active keys without changing the frozen hash', () => {
    vi.spyOn(Date, 'now').mockReturnValue(T0);
    const db = openDb(':memory:'); databases.push(db);
    const input = { id: 'cogniate', name: 'Cogniate', appUrl: 'https://app.test' };
    const first = ensureAccount(db, input);
    expect(first.created).toBe(true);
    expect(first.apiKey).toMatch(/^ltis_[A-Za-z0-9_-]{43}$/);
    const frozen = db.prepare('SELECT api_key_hash FROM tool_account WHERE id = ?').get(input.id)?.api_key_hash;
    expect(frozen).not.toBe(sha256Hex(first.apiKey!));
    expect(listApiKeys(db, input.id)).toEqual([expect.objectContaining({ label: 'bootstrap', scopes: ['launch', 'admin'],
      createdBy: 'system:bootstrap', expiresAt: null, createdAt: T0 })]);
    const before = listApiKeys(db, input.id);
    expect(ensureAccount(db, input)).toMatchObject({ created: false, apiKey: null });
    expect(listApiKeys(db, input.id)).toEqual(before);
    const custom = issueApiKey(db, input.id, { label: 'custom', scopes: ['launch'], createdBy: 'operator:unit' }, T0);
    const rotated = ensureAccount(db, { ...input, rotateApiKey: true });
    expect(rotated).toMatchObject({ created: false, apiKey: expect.stringMatching(/^ltis_/) });
    expect(rotated.apiKey).not.toBe(first.apiKey);
    expect(db.prepare('SELECT api_key_hash FROM tool_account WHERE id = ?').get(input.id)?.api_key_hash).toBe(frozen);
    expect(findAccountByApiKey(db, first.apiKey!)).toBeNull();
    expect(findActiveApiKey(db, custom.apiKey, T0)).toBeNull();
    expect(findAccountByApiKey(db, rotated.apiKey!)?.id).toBe(input.id);
    expect(listApiKeys(db, input.id).filter((key) => key.revokedAt === null)).toHaveLength(1);
  });

  it('failure to issue a key rolls back both a new account and a rotation', () => {
    vi.spyOn(Date, 'now').mockReturnValue(T0);
    const db = openDb(':memory:'); databases.push(db);
    const input = { id: 'cogniate', name: 'Cogniate', appUrl: 'https://app.test' };
    const fail = () => db.exec("CREATE TRIGGER unit_fail_issue BEFORE INSERT ON api_key BEGIN SELECT RAISE(ABORT, 'unit fault'); END");
    fail();
    expect(() => ensureAccount(db, input)).toThrow('unit fault');
    expect(getAccount(db, input.id)).toBeNull();
    db.exec('DROP TRIGGER unit_fail_issue');
    const first = ensureAccount(db, input);
    const before = listApiKeys(db, input.id);
    fail();
    expect(() => ensureAccount(db, { ...input, name: 'Changed', rotateApiKey: true })).toThrow('unit fault');
    expect(listApiKeys(db, input.id)).toEqual(before);
    expect(findAccountByApiKey(db, first.apiKey!)?.name).toBe(input.name);
  });
});
