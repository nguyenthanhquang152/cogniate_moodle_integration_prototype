// LA-ADR-06 D2 purge (LA-E5-20; BD-A2-66, BD-A2-67; LA-H4): at start, then daily. For each account closed at least
// CLOSED_ACCOUNT_RETENTION_DAYS ago, one transaction deletes its tenant rows and writes one account.purge audit event.
// The tool_account row stays as a closed tombstone (the id is never used again), and every audit_event row stays (only
// audit-retention deletes them).
import type { IntervalJob } from '@cogniate/shared';
import type { Db } from '../db/index.ts';
import { transaction } from '../db/index.ts';
import { insertAuditEvent } from './audit.ts';
import { DAY_MS } from './retention.ts';

export const CLOSED_ACCOUNT_RETENTION_DAYS = 30;

/** Read when the runner is built. A bad value stops the start (BD-A2-66). */
export function closedAccountRetentionDays(value: string | undefined): number {
  if (value === undefined) return CLOSED_ACCOUNT_RETENTION_DAYS;
  const days = Number(value);
  if (!/^\d+$/.test(value) || days < 1 || !Number.isSafeInteger(days * DAY_MS)) {
    throw new Error('CLOSED_ACCOUNT_RETENTION_DAYS must be a positive whole number of days');
  }
  return days;
}

// Child rows first, so each table reports its own count (platform deletes would cascade to them).
const PURGE: ReadonlyArray<readonly [table: string, sql: string]> = [
  ['deployment', 'DELETE FROM deployment WHERE platform_id IN (SELECT id FROM platform WHERE tool_account_id = ?)'],
  ['launch', 'DELETE FROM launch WHERE tool_account_id = ?'],
  ['oidc_state', 'DELETE FROM oidc_state WHERE tool_account_id = ?'],
  ['service_key', 'DELETE FROM service_key WHERE tool_account_id = ?'],
  ['storage_check', 'DELETE FROM storage_check WHERE tool_account_id = ?'],
  ['registration_session', 'DELETE FROM registration_session WHERE tool_account_id = ?'],
  ['platform', 'DELETE FROM platform WHERE tool_account_id = ?'],
  ['tool_key', 'DELETE FROM tool_key WHERE tool_account_id = ?'],
  ['api_key', 'DELETE FROM api_key WHERE tool_account_id = ?'],
  ['idempotency_record', 'DELETE FROM idempotency_record WHERE tool_account_id = ?'],
];

export function accountPurgeJob(db: Db, retentionDays: number): IntervalJob {
  return {
    name: 'account-purge', everyMs: DAY_MS, runAtStart: true,
    async run(ctx) {
      const now = ctx.now();
      const closed = db.prepare("SELECT id FROM tool_account WHERE status = 'closed' AND status_changed_at <= ? ORDER BY id")
        .all(now - retentionDays * DAY_MS) as Array<{ id: string }>;
      let purged = 0;
      for (const { id } of closed) {
        if (ctx.signal.aborted) break;
        const counts = transaction(db, () => {
          // A list, not an object keyed by table: redaction hides keys that end with "key" (api_key, service_key, tool_key).
          const deleted = PURGE.map(([table, sql]) => ({ table, rows: Number(db.prepare(sql).run(id).changes) }));
          // A tombstone with no tenant rows left was purged before: no second event.
          if (deleted.every(({ rows }) => rows === 0)) return null;
          insertAuditEvent(db, {
            actor: { type: 'system', id: 'account-purge' }, toolAccountId: id, traceId: ctx.traceId, clientIp: null,
            action: 'account.purge', target: { type: 'account', id }, result: 'ok', details: { deleted },
          }, now);
          return deleted;
        });
        if (!counts) continue;
        purged++;
        ctx.logger.info('account_purged', { trace_id: ctx.traceId, tool_account_id: id, counts });
      }
      return { result: 'ok', counts: { accounts: purged } };
    },
  };
}
