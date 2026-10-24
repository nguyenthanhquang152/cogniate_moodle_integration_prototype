import type { IntervalJob, KeyHandle } from '@cogniate/shared';
import { DAY_MS } from '../store/retention.ts';
import type { StoreSource } from '../store/index.ts';
import { storeFor } from '../store/index.ts';
export { SIGNING_KEY_ROTATE_DAYS, signingKeyRotateDays } from '../store/job-signing-key-rotation.ts';

export function signingKeyRotationJob(db: StoreSource, keys: KeyHandle, options: { rotateDays: number; publishLeadSeconds: number }): IntervalJob {
  return { name: 'signing-key-rotation', everyMs: DAY_MS, runAtStart: true,
    run: (ctx) => storeFor(db).maintenance.signingKeyRotation(keys, options, ctx) };
}
