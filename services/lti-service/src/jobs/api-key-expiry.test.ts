import type { JobContext } from '@cogniate/shared';
import { afterEach, expect, it } from 'vitest';
import type { Db } from '../db/index.ts';
import { openDb } from '../db/index.ts';
import { ensureAccount } from '../store/accounts.ts';
import { issueApiKey, revokeApiKey } from '../store/api-keys.ts';
import { DAY_MS } from '../store/retention.ts';
import { capturingLogger } from '../testkit.ts';
import { apiKeyExpiryJob } from './api-key-expiry.ts';

const databases: Db[] = [];
afterEach(() => { for (const db of databases.splice(0)) db.close(); });

it('AC-LA-E5-20-04: api-key-expiry reports a key that expires in 13 days, not one in 15 days, with ids only', async () => {
  const db = openDb(':memory:'); databases.push(db);
  const now = Date.UTC(2026, 9, 23);
  ensureAccount(db, { id: 'cogniate', appUrl: 'https://app.test' });
  ensureAccount(db, { id: 'second', appUrl: 'https://app.test' });
  ensureAccount(db, { id: 'third', appUrl: 'https://app.test' });
  const issue = (account: string, days: number) => issueApiKey(db, account, { label: `in ${days} days`, scopes: ['launch'], createdBy: 'unit', expiresAt: now + days * DAY_MS }, now);
  const soon = issue('cogniate', 13);
  const later = issue('second', 15);
  const revoked = issue('third', 2);
  revokeApiKey(db, 'third', revoked.record.id, now);
  const { logger, lines } = capturingLogger();
  const ctx: JobContext = { instanceId: 'lti-1', bootId: 'test', leaseOwner: 'lti-1/test', traceId: 'api-key-expiry-trace', now: () => now, logger, signal: new AbortController().signal };
  const job = apiKeyExpiryJob(db);
  expect([job.name, job.everyMs, job.runAtStart]).toEqual(['api-key-expiry', 3_600_000, true]);
  expect(await job.run(ctx)).toEqual({ result: 'ok', counts: { expiring: 1 } });
  expect(lines.filter((line) => line.event === 'api_key_expiring')).toEqual([expect.objectContaining({
    level: 'warn', trace_id: 'api-key-expiry-trace', tool_account_id: 'cogniate', api_key_id: soon.record.id, expires_at: new Date(now + 13 * DAY_MS).toISOString(),
  })]);
  for (const value of [soon.apiKey, later.record.id, revoked.record.id]) expect(JSON.stringify(lines)).not.toContain(value);
});
