// LA-ADR-06 D7 scheduled rotation (LA-E5-20; BD-A2-65, BD-A2-68): at start, then daily. Only active accounts with
// autoRotate, checked again in the transaction of each key change. Make a next key at active age >= SIGNING_KEY_ROTATE_DAYS - 7; activate it at active age >=
// SIGNING_KEY_ROTATE_DAYS, and only after the publish lead time (never forced). The audit events are the ones of the
// operator routes, with the actor system:signing-key-rotation and the trace id of the run.
import type { IntervalJob, JobContext, KeyHandle } from '@cogniate/shared';
import type { Db } from '../db/index.ts';
import type { AuditContext } from './audit.ts';
import { withAudit } from './audit.ts';
import { DAY_MS } from './retention.ts';
import { activateToolKey, createNextToolKey, prepareToolKey } from './tool-keys.ts';

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
type Step = { action: 'create' } | { action: 'activate'; kid: string };

/** An account that changed during the async key preparation: skip it, with no key change and no event. */
class AccountChanged extends Error {}

export function signingKeyRotationJob(db: Db, keys: KeyHandle, options: { rotateDays: number; publishLeadSeconds: number }): IntervalJob {
  const makeNextAt = (options.rotateDays - NEXT_KEY_DAYS_BEFORE) * DAY_MS;
  const activateAt = options.rotateDays * DAY_MS;
  const leadMs = options.publishLeadSeconds * 1000;

  /** The next step at `now` from the stored state: eligibility (autoRotate, status active) and the keys. */
  function stepFor(accountId: string, now: number): Step | null {
    const account = db.prepare('SELECT auto_rotate, status FROM tool_account WHERE id = ?').get(accountId) as { auto_rotate: number; status: string } | undefined;
    if (account?.auto_rotate !== 1 || account.status !== 'active') return null;
    // active: the time it became active; next: the time it was published.
    const rows = db.prepare(`SELECT kid, status, CASE status WHEN 'active' THEN COALESCE(activated_at, created_at) ELSE published_at END AS since
      FROM tool_key WHERE tool_account_id = ? AND status IN ('active', 'next')`).all(accountId) as unknown as KeyRow[];
    const active = rows.find((row) => row.status === 'active');
    const next = rows.find((row) => row.status === 'next');
    if (!active || now - active.since < makeNextAt) return null;
    if (!next) return { action: 'create' };
    if (now - active.since < activateAt || now - next.since < leadMs) return null;
    return { action: 'activate', kid: next.kid };
  }

  async function rotate(ctx: JobContext, accountId: string): Promise<'created' | 'activated' | null> {
    const step = stepFor(accountId, ctx.now());
    if (!step) return null;
    const base: AuditContext = { actor: { type: 'system', id: 'signing-key-rotation' }, toolAccountId: accountId, traceId: ctx.traceId, clientIp: null };
    const changed = (kid: string, status: string) => ctx.logger.info('signing_key_changed', { tool_account_id: accountId, kid, status, trace_id: ctx.traceId });
    // A-LA-E5-20-01/-02: inside the write transaction, read the clock and the state again. The account can change during
    // the await, and published_at must be the time when the key really enters the JWKS.
    const recheck = (expected: Step): number => {
      const at = ctx.now();
      if (JSON.stringify(stepFor(accountId, at)) !== JSON.stringify(expected)) throw new AccountChanged();
      return at;
    };
    try {
      if (step.action === 'create') {
        const prepared = await prepareToolKey(keys, accountId);
        const key = await withAudit(db, () => ctx.now(), { ...base, action: 'signing_key.create', target: { type: 'signing_key', id: null } }, (audit) =>
          audit.change(() => createNextToolKey(db, prepared, recheck(step)),
            (created) => ({ target: { type: 'signing_key', id: created.kid }, details: { status: created.status } })));
        changed(key.kid, key.status);
        return 'created';
      }
      const key = await withAudit(db, () => ctx.now(), { ...base, action: 'signing_key.activate', target: { type: 'signing_key', id: step.kid } }, (audit) =>
        audit.change(() => activateToolKey(db, accountId, step.kid, { force: false, publishLeadSeconds: options.publishLeadSeconds }, recheck(step)),
          (activated) => ({ details: { forced: false, retired: activated.retired } })));
      if (key.retired !== null) changed(key.retired, 'retired');
      changed(key.kid, key.status);
      return 'activated';
    } catch (error) {
      // The change rolled back and withAudit wrote no event for this plain error.
      if (error instanceof AccountChanged) return null;
      throw error;
    }
  }

  return {
    name: 'signing-key-rotation', everyMs: DAY_MS, runAtStart: true,
    async run(ctx) {
      const accounts = db.prepare("SELECT id FROM tool_account WHERE auto_rotate = 1 AND status = 'active' ORDER BY id").all() as Array<{ id: string }>;
      const counts = { created: 0, activated: 0, failed: 0 };
      for (const { id } of accounts) {
        if (ctx.signal.aborted) break;
        try {
          const done = await rotate(ctx, id);
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
