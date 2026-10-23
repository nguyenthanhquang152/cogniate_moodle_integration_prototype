import type { JobContext } from '@cogniate/shared';
import { afterEach, expect, it } from 'vitest';
import type { Db } from '../db/index.ts';
import { openDb } from '../db/index.ts';
import { ensureAccount } from '../store/accounts.ts';
import { claimIdempotency, completeIdempotency, IDEMPOTENCY_TTL_MS } from '../store/idempotency.ts';
import { DAY_MS } from '../store/retention.ts';
import { capturingLogger } from '../testkit.ts';
import { idempotencyCleanupJob } from './idempotency-cleanup.ts';

const databases: Db[] = [];
afterEach(() => { for (const db of databases.splice(0)) db.close(); });

it('AC-LA-E5-20-06: idempotency-cleanup deletes only records 24 hours old or older, with a controlled clock', async () => {
  const db = openDb(':memory:'); databases.push(db);
  ensureAccount(db, { id: 'cogniate', appUrl: 'https://app.test' });
  const now = 10 * DAY_MS;
  for (const [key, age] of [['old', IDEMPOTENCY_TTL_MS + 1], ['at-limit', IDEMPOTENCY_TTL_MS], ['young', IDEMPOTENCY_TTL_MS - 1], ['running', 0]] as const) {
    const result = claimIdempotency(db, { toolAccountId: 'cogniate', key, method: 'POST', route: '/api/platforms', params: '{}', bodyHash: 'hash' }, now - age);
    if (result.kind !== 'claimed') throw new Error('expected a claim');
    if (key !== 'running') completeIdempotency(db, result.claim, { status: 201, body: '{}', target: null, code: null });
  }
  const { logger, lines } = capturingLogger();
  const ctx: JobContext = { instanceId: 'lti-1', bootId: 'test', leaseOwner: 'lti-1/test', traceId: 'idempotency-cleanup-trace', now: () => now, logger, signal: new AbortController().signal };
  const job = idempotencyCleanupJob(db);
  expect([job.name, job.everyMs, job.runAtStart]).toEqual(['idempotency-cleanup', 3_600_000, true]);
  expect(await job.run(ctx)).toEqual({ result: 'ok', counts: { idempotency_record: 2 } });
  expect(db.prepare('SELECT key FROM idempotency_record ORDER BY key').all().map((row) => row.key)).toEqual(['running', 'young']);
  expect(await job.run(ctx)).toEqual({ result: 'ok', counts: { idempotency_record: 0 } });
  expect(JSON.stringify(lines)).not.toContain('at-limit');
});
