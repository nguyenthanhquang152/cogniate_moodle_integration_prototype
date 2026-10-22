import { createHash, randomBytes } from 'node:crypto';
import type * as Crypto from 'node:crypto';
import { afterEach, expect, it, vi } from 'vitest';
import { openDb } from '../db/index.ts';
import { createAccount, DEFAULT_CLAIM_POLICY, ensureAccount, getAccount, requireWritableAccount, updateAccount } from './accounts.ts';
import { useApiKey } from './api-keys.ts';

vi.mock('node:crypto', async (original) => {
  const crypto = await original<typeof Crypto>();
  return { ...crypto, randomBytes: vi.fn(crypto.randomBytes) };
});
afterEach(() => vi.clearAllMocks());
const input = (id: string) => ({ id, name: id, launchUrl: 'https://tool.test/launch', deepLinkingUrl: 'https://tool.test/deep', registrationUrl: 'https://tool.test/register' });

it('AC-LA-E5-04-12: stores distinct SHA-256 hashes of 32 random bytes; no issued API key exists', () => {
  const db = openDb(':memory:');
  try {
    const hashes = [];
    for (const id of ['one', 'two']) {
      const account = createAccount(db, input(id), 1234);
      expect(account).toMatchObject({ status: 'active', createdAt: 1234, statusChangedAt: 1234, claimPolicy: DEFAULT_CLAIM_POLICY });
      expect(vi.mocked(randomBytes).mock.calls.at(-1)).toEqual([32]);
      const bytes = vi.mocked(randomBytes).mock.results.at(-1)!.value as Buffer;
      const hash = db.prepare('SELECT api_key_hash AS hash FROM tool_account WHERE id = ?').get(id)!.hash;
      expect(hash).toBe(createHash('sha256').update(bytes).digest('hex'));
      hashes.push(hash);
      expect(useApiKey(db, `ltis_${bytes.toString('base64url')}`, Date.now())).toBeNull();
    }
    expect(new Set(hashes).size).toBe(2);
    expect(() => createAccount(db, input('one'), 2000)).toThrow('ACCOUNT_ALREADY_EXISTS');
  } finally { db.close(); }
});

it('status time changes only on a transition; close prevents bootstrap rotation and changes only its account', () => {
  const db = openDb(':memory:');
  try {
    const a = ensureAccount(db, { id: 'one', name: 'One', appUrl: 'https://tool.test' });
    const b = ensureAccount(db, { id: 'two', name: 'Two', appUrl: 'https://tool.test' });
    expect(a.account.claimPolicy).toEqual(DEFAULT_CLAIM_POLICY);
    expect(requireWritableAccount(db, 'one')).toEqual(a.account);
    expect(() => requireWritableAccount(db, 'missing')).toThrow('NOT_FOUND');
    updateAccount(db, 'one', { status: 'suspended' }, 100);
    expect(requireWritableAccount(db, 'one').status).toBe('suspended');
    expect(updateAccount(db, 'one', { name: 'Updated', status: 'suspended' }, 200).statusChangedAt).toBe(100);
    updateAccount(db, 'one', { status: 'closed' }, 300);
    expect(() => requireWritableAccount(db, 'one')).toThrow('ACCOUNT_CLOSED');
    expect(useApiKey(db, a.apiKey!, Date.now())).toBeNull();
    expect(useApiKey(db, b.apiKey!, Date.now())?.toolAccountId).toBe('two');
    expect(() => ensureAccount(db, { id: 'one', name: 'Revive', appUrl: 'https://tool.test', rotateApiKey: true })).toThrow('ACCOUNT_CLOSED');
    expect(() => updateAccount(db, 'one', { status: 'active' }, 400)).toThrow('ACCOUNT_CLOSED');
    expect(getAccount(db, 'two')).toEqual(b.account);
  } finally { db.close(); }
});

it('bootstrap supplies a new default name but does not write a name when it was omitted on an existing account', () => {
  const db = openDb(':memory:');
  try {
    const input = { id: 'one', appUrl: 'https://tool.test' };
    expect(ensureAccount(db, input).account.name).toBe('one');
    updateAccount(db, 'one', { name: 'Operator name' }, Date.now());
    db.exec("CREATE TRIGGER protect_omitted_name BEFORE UPDATE OF name ON tool_account BEGIN SELECT RAISE(ABORT, 'unexpected name write'); END");
    expect(ensureAccount(db, { ...input, rotateApiKey: true }).account.name).toBe('Operator name');
  } finally { db.close(); }
});
