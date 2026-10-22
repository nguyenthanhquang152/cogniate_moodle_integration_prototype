import type { IntervalJob } from '@cogniate/shared';
import { RETENTION_INTERVAL_MS } from '@cogniate/shared';
import type { Db } from '../db/index.ts';
import { cleanupExpired } from '../store/retention.ts';
import { cleanupStorageChecks } from '../store/storage-checks.ts';

/** Keep the existing cleanup and per-table log lines; the shared runner owns timing and the trace id. */
export function retentionJob(db: Db): IntervalJob {
  return {
    name: 'retention', everyMs: RETENTION_INTERVAL_MS, runAtStart: true,
    async run(ctx) {
      const now = ctx.now();
      const rows = [...cleanupExpired(db, now), cleanupStorageChecks(db, now)];
      for (const { table, deleted } of rows) {
        if (deleted > 0) ctx.logger.info('retention_cleanup', { trace_id: ctx.traceId, table, deleted });
      }
      return { result: 'ok', counts: Object.fromEntries(rows.map(({ table, deleted }) => [table, deleted])) };
    },
  };
}
