import type { IntervalJob } from '@cogniate/shared';
import { RETENTION_INTERVAL_MS } from '@cogniate/shared';
import type { StoreSource } from '../store/index.ts';
import { storeFor } from '../store/index.ts';

export function retentionJob(db: StoreSource): IntervalJob {
  return { name: 'retention', everyMs: RETENTION_INTERVAL_MS, runAtStart: true,
    run: (ctx) => storeFor(db).maintenance.retention(ctx) };
}
