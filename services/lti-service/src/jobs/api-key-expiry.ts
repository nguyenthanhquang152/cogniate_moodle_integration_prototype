import type { IntervalJob } from '@cogniate/shared';
import { DAY_MS } from '../store/retention.ts';
import type { StoreSource } from '../store/index.ts';
import { storeFor } from '../store/index.ts';
export { API_KEY_EXPIRY_WARNING_MS } from '../store/job-api-key-expiry.ts';

export function apiKeyExpiryJob(db: StoreSource): IntervalJob {
  return { name: 'api-key-expiry', everyMs: DAY_MS / 24, runAtStart: true,
    run: (ctx) => storeFor(db).maintenance.apiKeyExpiry(ctx) };
}
