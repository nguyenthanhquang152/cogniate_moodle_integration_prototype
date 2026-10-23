import type { IntervalJob } from '@cogniate/shared';
import type { Db } from '../db/index.ts';
import { DAY_MS } from './retention.ts';

/** Read at runner construction, before any job starts. Never turn a malformed setting into a shorter retention. */
export function auditRetentionDays(value: string | undefined): number {
  if (value === undefined) return 400;
  const days = Number(value);
  if (!/^\d+$/.test(value) || days < 1 || !Number.isSafeInteger(days * DAY_MS)) {
    throw new Error('AUDIT_RETENTION_DAYS must be a positive whole number of days');
  }
  return days;
}

/** The only product module allowed to delete audit rows (LA-ADR-06 D4, fitness F5). */
export function auditRetentionJob(db: Db, days: number): IntervalJob {
  return {
    name: 'audit-retention', everyMs: DAY_MS, runAtStart: true,
    async run(ctx) {
      const deleted = Number(db.prepare('DELETE FROM audit_event WHERE ts < ?').run(ctx.now() - days * DAY_MS).changes);
      return { result: 'ok', counts: { audit_event: deleted } };
    },
  };
}
