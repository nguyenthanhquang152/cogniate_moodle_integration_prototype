// LA-ADR-06 D7 scheduled rotation (LA-E5-20; BD-A2-65, BD-A2-68): at start, then daily. Only active accounts with
// autoRotate. Make a next key at active age >= SIGNING_KEY_ROTATE_DAYS - 7; activate it at active age >=
// SIGNING_KEY_ROTATE_DAYS, and only after the publish lead time (never forced). The audit events are the ones of the
// operator routes, with the actor system:signing-key-rotation and the trace id of the run.
import type { IntervalJob, JobContext, KeyHandle } from '@cogniate/shared';
import type { Db } from '../db/index.ts';
import { requireWritableAccount } from '../store/accounts.ts';
import type { AuditContext } from '../store/audit.ts';
import { withAudit } from '../store/audit.ts';
import { DAY_MS } from '../store/retention.ts';
import { activateToolKey, createNextToolKey, prepareToolKey, requireNextKeySlot } from '../store/tool-keys.ts';

export const SIGNING_KEY_ROTATE_DAYS = 90;
/** A next key is made this many days before the rotation day, so it is published long before activation. */
const NEXT_KEY_DAYS_BEFORE = 7;

/** Read when the runner is built. A bad value stops the start (BD-A2-68). */
export function signingKeyRotateDays(value: string | undefined): number {
  if (value === undefined) return SIGNING_KEY_ROTATE_DAYS;
  const days = Number(value);
  if (!/^\d+$/.test(value) || days < NEXT_KEY_DAYS_BEFORE + 1 || !Number.isSafeInteger(days * DAY_MS)) {
    throw new Error('SIGNING_KEY_ROTATE_DAYS must be a whole number of days, at least 8');
  }
  return days;
}

interface KeyRow { kid: string; status: 'active' | 'next'; since: number }

export function signingKeyRotationJob(db: Db, keys: KeyHandle, options: { rotateDays: number; publishLeadSeconds: number }): IntervalJob {
  const makeNextAt = (options.rotateDays - NEXT_KEY_DAYS_BEFORE) * DAY_MS;
  const activateAt = options.rotateDays * DAY_MS;
  const leadMs = options.publishLeadSeconds * 1000;

  async function rotate(ctx: JobContext, accountId: string, now: number): Promise<'created' | 'activated' | null> {
    // active: the time it became active; next: the time it was published.
    const rows = db.prepare(`SELECT kid, status, CASE status WHEN 'active' THEN COALESCE(activated_at, created_at) ELSE published_at END AS since
      FROM tool_key WHERE tool_account_id = ? AND status IN ('active', 'next')`).all(accountId) as unknown as KeyRow[];
    const active = rows.find((row) => row.status === 'active');
    const next = rows.find((row) => row.status === 'next');
    if (!active || now - active.since < makeNextAt) return null;
    const base: AuditContext = { actor: { type: 'system', id: 'signing-key-rotation' }, toolAccountId: accountId, traceId: ctx.traceId, clientIp: null };
    const changed = (kid: string, status: string) => ctx.logger.info('signing_key_changed', { tool_account_id: accountId, kid, status, trace_id: ctx.traceId });
    if (!next) {
      const prepared = await prepareToolKey(keys, accountId);
      const key = await withAudit(db, () => ctx.now(), { ...base, action: 'signing_key.create', target: { type: 'signing_key', id: null } }, (audit) => {
        requireNextKeySlot(db, accountId);
        return audit.change(() => {
          requireWritableAccount(db, accountId);
          return createNextToolKey(db, prepared, now);
        }, (created) => ({ target: { type: 'signing_key', id: created.kid }, details: { status: created.status } }));
      });
      changed(key.kid, key.status);
      return 'created';
    }
    if (now - active.since < activateAt || now - next.since < leadMs) return null;
    const key = await withAudit(db, () => ctx.now(), { ...base, action: 'signing_key.activate', target: { type: 'signing_key', id: next.kid } }, (audit) =>
      audit.change(() => {
        requireWritableAccount(db, accountId);
        return activateToolKey(db, accountId, next.kid, { force: false, publishLeadSeconds: options.publishLeadSeconds }, now);
      }, (activated) => ({ details: { forced: false, retired: activated.retired } })));
    if (key.retired !== null) changed(key.retired, 'retired');
    changed(key.kid, key.status);
    return 'activated';
  }

  return {
    name: 'signing-key-rotation', everyMs: DAY_MS, runAtStart: true,
    async run(ctx) {
      const now = ctx.now();
      const accounts = db.prepare("SELECT id FROM tool_account WHERE auto_rotate = 1 AND status = 'active' ORDER BY id").all() as Array<{ id: string }>;
      const counts = { created: 0, activated: 0, failed: 0 };
      for (const { id } of accounts) {
        if (ctx.signal.aborted) break;
        try {
          const done = await rotate(ctx, id, now);
          if (done) counts[done]++;
        } catch (error) {
          // One account must not stop the others. The class name only; a message can hold key material.
          counts.failed++;
          ctx.logger.warn('signing_key_rotation_failed', { trace_id: ctx.traceId, tool_account_id: id, error: error instanceof Error ? error.name : 'Error' });
        }
      }
      return { result: counts.failed > 0 ? 'failed' : 'ok', counts };
    },
  };
}
