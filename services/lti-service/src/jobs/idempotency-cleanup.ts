import type { IntervalJob } from '@cogniate/shared';
import { DAY_MS } from '../store/retention.ts';
import type { StoreSource } from '../store/index.ts';
import { storeFor } from '../store/index.ts';

export function idempotencyCleanupJob(db: StoreSource): IntervalJob {
  return { name: 'idempotency-cleanup', everyMs: DAY_MS / 24, runAtStart: true,
    run: (ctx) => storeFor(db).maintenance.idempotencyCleanup(ctx) };
}
