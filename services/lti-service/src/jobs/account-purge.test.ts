import type { JobContext } from '@cogniate/shared';
import { createLocalKeyProvider, legacyKeyRing } from '@cogniate/shared';
import { afterEach, expect, it } from 'vitest';
import type { Db } from '../db/index.ts';
import { openDb } from '../db/index.ts';
import { ensureAccount, getAccount, updateAccount } from '../store/accounts.ts';
import { insertAuditEvent, listAuditEvents } from '../store/audit.ts';
import { claimIdempotency } from '../store/idempotency.ts';
import { createLaunch } from '../store/launches.ts';
import { createPlatform } from '../store/platforms.ts';
import { DAY_MS } from '../store/retention.ts';
import { issueServiceKey } from '../store/service-keys.ts';
import { createFirstToolKey, prepareToolKey } from '../store/tool-keys.ts';
import { capturingLogger } from '../testkit.ts';
import { accountPurgeJob, closedAccountRetentionDays } from './account-purge.ts';

const NOW = Date.UTC(2026, 9, 23);
const keys = createLocalKeyProvider(legacyKeyRing(Buffer.alloc(32, 7)));
const TABLES = ['deployment', 'launch', 'oidc_state', 'service_key', 'storage_check', 'registration_session', 'platform', 'tool_key', 'api_key', 'idempotency_record'];
const databases: Db[] = [];
afterEach(() => { for (const db of databases.splice(0)) db.close(); });

/** One row (or more) of the account in every table of the purge scope, and one audit event. */
async function tenant(db: Db, id: string) {
  ensureAccount(db, { id, appUrl: 'https://app.test' });
  createFirstToolKey(db, await prepareToolKey(keys, id), NOW - 100 * DAY_MS);
  const platform = createPlatform(db, id, { issuer: `https://${id}.test`, clientId: id, name: id, authEndpoint: `https://${id}.test/auth`,
    tokenEndpoint: `https://${id}.test/token`, jwksUrl: `https://${id}.test/keys`, deploymentIds: ['1'], active: true });
  createLaunch(db, { toolAccountId: id, platformId: platform.id, deploymentId: '1', messageType: 'LtiResourceLinkRequest', claims: {} }, 3600, NOW);
  issueServiceKey(db, keys, { toolAccountId: id, platformId: platform.id, deploymentId: '1', contextId: 'c', resourceLinkId: 'r', agsClaim: null, nrpsClaim: null }, NOW);
  db.prepare(`INSERT INTO oidc_state (state_hash, tool_account_id, platform_id, nonce, target_link_uri, expires_at) VALUES (?, ?, ?, 'n', 'https://app.test', ?)`)
    .run(`state-${id}`, id, platform.id, NOW + 600_000);
  db.prepare(`INSERT INTO storage_check (check_hash, tool_account_id, platform_id, state_hash, prepared_launch, expires_at, created_at) VALUES (?, ?, ?, 's', '{}', ?, ?)`)
    .run(`check-${id}`, id, platform.id, NOW + 120_000, NOW);
  db.prepare(`INSERT INTO registration_session (id, tool_account_id, openid_configuration_url, registration_token_encrypted, platform_configuration,
    operation, privacy_level, passthrough_params, expires_at, created_at) VALUES (?, ?, 'https://lms.test/oidc', NULL, '{}', 'new', 'public', '{}', ?, ?)`)
    .run(`reg-${id}`, id, NOW + 600_000, NOW);
  claimIdempotency(db, { toolAccountId: id, key: `idem-${id}`, method: 'POST', route: '/api/platforms', params: '{}', bodyHash: 'h' }, NOW);
  insertAuditEvent(db, { actor: { type: 'system', id: 'fixture' }, toolAccountId: id, traceId: null, clientIp: null, action: 'account.update',
    target: { type: 'account', id }, result: 'ok' }, NOW - 40 * DAY_MS);
}
const rowsOf = (db: Db, id: string) => Object.fromEntries(TABLES.map((table) => [table, Number(db.prepare(table === 'deployment'
  ? 'SELECT COUNT(*) AS n FROM deployment WHERE platform_id IN (SELECT id FROM platform WHERE tool_account_id = ?)'
  : `SELECT COUNT(*) AS n FROM ${table} WHERE tool_account_id = ?`).get(id)!.n)]));

it('AC-LA-E5-20-06: purges an account closed 31 days ago, keeps one closed 29 days ago, the tombstone and the audit rows', async () => {
  const db = openDb(':memory:'); databases.push(db);
  for (const id of ['old-closed', 'new-closed', 'active']) await tenant(db, id);
  updateAccount(db, 'old-closed', { status: 'closed' }, NOW - 31 * DAY_MS);
  updateAccount(db, 'new-closed', { status: 'closed' }, NOW - 29 * DAY_MS);
  const before = { new: rowsOf(db, 'new-closed'), active: rowsOf(db, 'active') };
  expect(Object.values(before.active).every((n) => n > 0)).toBe(true);
  const { logger, lines } = capturingLogger();
  const ctx: JobContext = { instanceId: 'lti-1', bootId: 'test', leaseOwner: 'lti-1/test', traceId: 'account-purge-trace', now: () => NOW, logger, signal: new AbortController().signal };
  const job = accountPurgeJob(db, closedAccountRetentionDays(undefined));
  expect([job.name, job.everyMs, job.runAtStart]).toEqual(['account-purge', DAY_MS, true]);
  expect(await job.run(ctx)).toEqual({ result: 'ok', counts: { accounts: 1 } });
  expect(rowsOf(db, 'old-closed')).toEqual(Object.fromEntries(TABLES.map((table) => [table, 0])));
  expect(rowsOf(db, 'new-closed')).toEqual(before.new);
  expect(rowsOf(db, 'active')).toEqual(before.active);
  expect(getAccount(db, 'old-closed')).toMatchObject({ id: 'old-closed', status: 'closed' });
  const counts = TABLES.map((table) => ({ table, rows: 1 }));
  const events = listAuditEvents(db, { toolAccountId: 'old-closed', limit: 10 }).events;
  expect(events.map((event) => event.action)).toEqual(['account.purge', 'account.update']);
  expect(events[0]).toMatchObject({ actor: { type: 'system', id: 'account-purge' }, traceId: 'account-purge-trace', target: { type: 'account', id: 'old-closed' },
    result: 'ok', details: { deleted: counts } });
  expect(lines).toContainEqual(expect.objectContaining({ event: 'account_purged', tool_account_id: 'old-closed', counts, trace_id: 'account-purge-trace' }));
  // A second run deletes nothing and writes no second event.
  expect(await job.run(ctx)).toEqual({ result: 'ok', counts: { accounts: 0 } });
  expect(listAuditEvents(db, { action: 'account.purge', limit: 10 }).events).toHaveLength(1);
});

it('reads CLOSED_ACCOUNT_RETENTION_DAYS as a positive whole number (default 30)', () => {
  expect(closedAccountRetentionDays(undefined)).toBe(30);
  expect(closedAccountRetentionDays('1')).toBe(1);
  for (const value of ['', '0', '-1', '1.5', 'month', '999999999999999999']) expect(() => closedAccountRetentionDays(value)).toThrow('CLOSED_ACCOUNT_RETENTION_DAYS');
});
