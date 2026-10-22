import { describe, expect, it } from 'vitest';
import { openDb } from '../db/index.ts';
import { ensureAccount } from '../store/accounts.ts';
import { URLS } from '../testkit.ts';
import { statusGate } from './account-status.ts';

describe('statusGate (contract delta §1.5)', () => {
  const db = openDb(':memory:');
  const { account } = ensureAccount(db, { id: 'cogniate', name: 'Cogniate', appUrl: URLS.app });
  db.close();

  it('passes an active account', () => expect(statusGate(account)).toEqual({ ok: true, account }));
  it.each([
    ['missing', null, 'UNKNOWN_TOOL_ACCOUNT', 'unknown_tool_account'],
    ['closed', { ...account, status: 'closed' as const }, 'UNKNOWN_TOOL_ACCOUNT', 'unknown_tool_account'],
    ['suspended', { ...account, status: 'suspended' as const }, 'TOOL_ACCOUNT_SUSPENDED', 'account_suspended'],
  ])('refuses a %s account with its page code and log detail', (_, value, code, detail) => {
    expect(statusGate(value)).toEqual({ ok: false, code, detail });
  });
});
