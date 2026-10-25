import type { JobContext } from '@cogniate/shared';
import { expect, it } from 'vitest';
import { openDb } from '../db/index.ts';
import { insertAuditEvent, listAuditEvents } from '../store/audit.ts';
import { DAY_MS } from '../store/retention.ts';
import { capturingLogger } from '../testkit.ts';
import { auditRetentionDays, auditRetentionJob } from './audit-retention.ts';

it('AC-LA-E5-19-03: deletes only events older than the configured retention, with a controlled clock', async () => {
  const db = openDb(':memory:');
  const now = 500 * DAY_MS;
  const ctx: JobContext = { instanceId: 'lti-1', bootId: 'test', leaseOwner: 'lti-1/test', traceId: 'audit-retention-trace', now: () => now, logger: capturingLogger().logger, signal: new AbortController().signal };
  try {
    const days = auditRetentionDays('7');
    for (const delta of [-1, 0, 1]) insertAuditEvent(db, { actor: { type: 'system', id: 'fixture' }, toolAccountId: null, traceId: `trace-${delta}`, clientIp: null,
      action: 'account.update', target: { type: 'account', id: null }, result: 'ok' }, now - days * DAY_MS + delta);
    db.prepare("INSERT INTO service_setting (key, value) VALUES ('fixture', '{}')").run();
    const job = auditRetentionJob(db, days);
    expect([job.everyMs, job.runAtStart]).toEqual([DAY_MS, true]);
    expect(await job.run(ctx)).toEqual({ result: 'ok', counts: { audit_event: 1 } });
    expect(listAuditEvents(db, { limit: 10 }).events.map((e) => e.ts)).toEqual([now - days * DAY_MS + 1, now - days * DAY_MS]);
    expect(db.prepare('SELECT count(*) AS n FROM service_setting').get()?.n).toBe(1);
    expect(await job.run(ctx)).toEqual({ result: 'ok', counts: { audit_event: 0 } });
    expect(() => db.prepare("UPDATE audit_event SET action = 'changed'").run()).toThrow('append-only');
  } finally { db.close(); }
});

it('uses 400 days by default and refuses invalid retention settings before running', () => {
  expect(auditRetentionDays(undefined)).toBe(400);
  for (const value of ['', '0', '-1', '1.5', 'Infinity', 'days', '999999999999999999']) expect(() => auditRetentionDays(value)).toThrow('AUDIT_RETENTION_DAYS');
});
