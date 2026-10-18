// Retention job (data-model §2.1, A-T4b2-02): both services run their cleanup at start and then every 10 min, and
// log retention_cleanup {table, deleted} (info) for each table where it deleted something. Shared so that the
// schedule and the log line are the same in both services.
import { randomBytes } from 'node:crypto';
import type { Logger } from './logger.ts';

export interface RetentionResult {
  table: string;
  deleted: number;
}

export const RETENTION_INTERVAL_MS = 10 * 60 * 1000;

export function startRetention(opts: { logger: Logger; run: () => RetentionResult[]; everyMs?: number }): { runOnce: () => RetentionResult[]; stop: () => void } {
  const runOnce = (): RetentionResult[] => {
    const traceId = randomBytes(16).toString('hex');
    try {
      const results = opts.run();
      for (const r of results) if (r.deleted > 0) opts.logger.info('retention_cleanup', { trace_id: traceId, table: r.table, deleted: r.deleted });
      return results;
    } catch (err) {
      opts.logger.error('internal_error', { trace_id: traceId, method: 'JOB', path: 'retention_cleanup', error: (err as Error).name });
      return [];
    }
  };
  runOnce();
  const timer = setInterval(runOnce, opts.everyMs ?? RETENTION_INTERVAL_MS);
  timer.unref();
  return { runOnce, stop: () => clearInterval(timer) };
}
