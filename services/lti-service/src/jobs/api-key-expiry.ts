// LA-ADR-06 D11 (LA-E5-20, BD-A2-70): at start, then hourly. One warn line per unrevoked API key that expires within
// 14 days (ids and time only, never a key). The lti_api_key_expires_in_seconds gauge stays a scrape-time query.
import type { IntervalJob } from '@cogniate/shared';
import type { Db } from '../db/index.ts';
import { DAY_MS } from '../store/retention.ts';

export const API_KEY_EXPIRY_WARNING_MS = 14 * DAY_MS;

export function apiKeyExpiryJob(db: Db): IntervalJob {
  return {
    name: 'api-key-expiry', everyMs: DAY_MS / 24, runAtStart: true,
    async run(ctx) {
      const now = ctx.now();
      const keys = db.prepare(`SELECT id, tool_account_id, expires_at FROM api_key
        WHERE revoked_at IS NULL AND expires_at > ? AND expires_at <= ? ORDER BY expires_at, id`)
        .all(now, now + API_KEY_EXPIRY_WARNING_MS) as Array<{ id: string; tool_account_id: string; expires_at: number }>;
      for (const key of keys) {
        ctx.logger.warn('api_key_expiring', {
          trace_id: ctx.traceId, tool_account_id: key.tool_account_id, api_key_id: key.id, expires_at: new Date(key.expires_at).toISOString(),
        });
      }
      return { result: 'ok', counts: { expiring: keys.length } };
    },
  };
}
