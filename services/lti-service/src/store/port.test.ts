import { describe, expect, it, vi } from 'vitest';
import { createAccountResolver } from '../accounts/resolver.ts';
import { openDb } from '../db/index.ts';
import type { NewAccount } from './accounts.ts';
import type { AuditBase } from './audited-operations.ts';
import { createSqliteLtiStore, storeFor } from './index.ts';
import type { LtiStore } from './port.ts';
import { prepareToolKey } from './tool-keys.ts';

const input: NewAccount = { id: 'unit', name: 'Unit', launchUrl: 'https://unit.test/launch',
  deepLinkingUrl: 'https://unit.test/deep', registrationUrl: 'https://unit.test/register' };
const base: AuditBase = { actor: { type: 'system', id: 'unit' }, toolAccountId: 'unit', action: 'account.create',
  target: { type: 'account', id: 'unit' }, traceId: 'trace-store-port', clientIp: null };

describe('async LTI store port', () => {
  it('returns promises for a synchronous SQLite success and failure', async () => {
    const db = openDb(':memory:');
    const store = storeFor(db);
    expect(storeFor(db)).toBe(store);
    const success = store.accounts.getAccount('absent');
    expect(success).toBeInstanceOf(Promise);
    await expect(success).resolves.toBeNull();
    db.close();
    // A driver exception is a rejection, so callers have the same error path with an async engine.
    const failure = store.accounts.getAccount('absent');
    expect(failure).toBeInstanceOf(Promise);
    await expect(failure).rejects.toThrow();
  });

  it('injects a store without a database handle into a protocol caller', async () => {
    const db = openDb(':memory:');
    const sqlite = createSqliteLtiStore(db);
    const account = await sqlite.accounts.createAccount(input, 1000);
    db.close();
    const read = vi.fn(async () => { await Promise.resolve(); return account; });
    const store: LtiStore = { ...sqlite, accounts: { ...sqlite.accounts, getAccount: read } };
    const resolver = createAccountResolver(store, 'https://lti.test');
    expect(storeFor(store)).toBe(store);
    await expect(resolver.resolveAccount({ params: { account: 'unit' } })).resolves.toEqual(account);
    expect(read).toHaveBeenCalledExactlyOnceWith('unit');
    expect(resolver.protocolUrls(account).launch).toBe('https://lti.test/lti/launch/unit');
  });

  it('checks a job lease before the audit change and reads the clock again under its transaction', async () => {
    const db = openDb(':memory:');
    const store = createSqliteLtiStore(db);
    try {
      const transactionStates: boolean[] = [];
      await store.audit.request(() => 1000, { ...base, toolAccountId: null, action: 'job.run' }, (operations) =>
        operations.acceptJob('key-rewrap', () => { transactionStates.push(db.isTransaction); return 1000; }));
      expect(transactionStates).toEqual([false, true]);
      expect((await store.audit.listAuditEvents({ limit: 10 })).events).toEqual([
        expect.objectContaining({ action: 'job.run', result: 'ok' }),
      ]);
    } finally { db.close(); }
  });

  it('rolls back the account and first key when audit fails, then observes the successful commit once', async () => {
    const db = openDb(':memory:');
    const store = createSqliteLtiStore(db);
    try {
      const prepared = await prepareToolKey(Buffer.alloc(32, 3), input.id);
      const observed = vi.fn(() => ({
        inTransaction: db.isTransaction,
        account: db.prepare('SELECT id FROM tool_account WHERE id = ?').get(input.id),
        key: db.prepare('SELECT kid FROM tool_key WHERE kid = ?').get(prepared.kid),
      }));
      await store.audit.observeAuditEvents(observed);
      db.exec("CREATE TRIGGER unit_fail_audit BEFORE INSERT ON audit_event BEGIN SELECT RAISE(ABORT, 'audit failed'); END");
      const create = () => store.audit.request(() => 1000, base, async (operations) => {
        // The request may await. The compound store method owns the synchronous transaction.
        await Promise.resolve();
        return operations.createAccount(input, prepared, 1000);
      });
      await expect(create()).rejects.toThrow('audit failed');
      await expect(store.accounts.getAccount(input.id)).resolves.toBeNull();
      expect(db.prepare('SELECT kid FROM tool_key WHERE kid = ?').get(prepared.kid)).toBeUndefined();
      expect(observed).not.toHaveBeenCalled();
      db.exec('DROP TRIGGER unit_fail_audit');
      await expect(create()).resolves.toMatchObject({ id: input.id });
      expect(observed).toHaveBeenCalledExactlyOnceWith('account.create', 'ok');
      expect(observed.mock.results[0]?.value).toEqual({ inTransaction: false, account: { id: input.id }, key: { kid: prepared.kid } });
      const events = await store.audit.listAuditEvents({ limit: 10 });
      expect(events.events).toHaveLength(1);
      expect(events.events[0]).toMatchObject({ action: 'account.create', result: 'ok', traceId: base.traceId });
    } finally { db.close(); }
  });
});
