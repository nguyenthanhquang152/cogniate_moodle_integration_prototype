import type { IntervalJob, KeyHandle } from '@cogniate/shared';
import type { StoreSource } from '../store/index.ts';
import { storeFor } from '../store/index.ts';
export { KEY_REWRAP_JOB, KEY_REWRAP_BATCH_SIZE } from '../store/key-rewrap.ts';

export function keyRewrapJob(db: StoreSource, keys: KeyHandle): IntervalJob {
  return { name: 'key-rewrap', everyMs: null, runAtStart: false,
    run: (ctx) => storeFor(db).maintenance.keyRewrap(keys, ctx) };
}

export async function keyProviderStatus(db: StoreSource, keys: KeyHandle) {
  return storeFor(db).keyProvider.status(keys);
}
