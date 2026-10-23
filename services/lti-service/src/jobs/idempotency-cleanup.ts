// LA-ADR-06 D9, D11 (LA-E5-20): at start, then hourly. Deletes the idempotency records that claimIdempotency already
// ignores (age 24 h or more). It logs counts only, never a key.
import type { IntervalJob } from '@cogniate/shared';
import type { Db } from '../db/index.ts';
import { IDEMPOTENCY_TTL_MS } from '../store/idempotency.ts';
import { DAY_MS } from '../store/retention.ts';

export function idempotencyCleanupJob(db: Db): IntervalJob {
  return {
    name: 'idempotency-cleanup', everyMs: DAY_MS / 24, runAtStart: true,
    async run(ctx) {
      const deleted = Number(db.prepare('DELETE FROM idempotency_record WHERE created_at <= ?').run(ctx.now() - IDEMPOTENCY_TTL_MS).changes);
      return { result: 'ok', counts: { idempotency_record: deleted } };
    },
  };
}
