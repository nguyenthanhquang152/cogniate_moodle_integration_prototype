import type { IntervalJob } from '@cogniate/shared';
import { DAY_MS } from '../store/retention.ts';
import type { StoreSource } from '../store/index.ts';
import { storeFor } from '../store/index.ts';
export { auditRetentionDays } from '../store/audit-retention.ts';

export function auditRetentionJob(db: StoreSource, days: number): IntervalJob {
  return { name: 'audit-retention', everyMs: DAY_MS, runAtStart: true,
    run: (ctx) => storeFor(db).maintenance.auditRetention(days, ctx) };
}
