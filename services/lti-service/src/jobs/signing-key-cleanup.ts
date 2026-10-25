import type { IntervalJob } from '@cogniate/shared';
import { DAY_MS } from '../store/retention.ts';
import type { StoreSource } from '../store/index.ts';
import { storeFor } from '../store/index.ts';

export function signingKeyCleanupJob(db: StoreSource): IntervalJob {
  return { name: 'signing-key-cleanup', everyMs: DAY_MS, runAtStart: true,
    run: (ctx) => storeFor(db).maintenance.signingKeyCleanup(ctx) };
}
