import type { IntervalJob } from '@cogniate/shared';
import { DAY_MS } from '../store/retention.ts';
import type { StoreSource } from '../store/index.ts';
import { storeFor } from '../store/index.ts';
export { CLOSED_ACCOUNT_RETENTION_DAYS, closedAccountRetentionDays } from '../store/job-account-purge.ts';

export function accountPurgeJob(db: StoreSource, days: number): IntervalJob {
  return { name: 'account-purge', everyMs: DAY_MS, runAtStart: true,
    run: (ctx) => storeFor(db).maintenance.accountPurge(days, ctx) };
}
