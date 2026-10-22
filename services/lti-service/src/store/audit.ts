// The audit writer of the LTI service (LA-ADR-06 D4): the only path to the table audit_event. Insert and list only;
// the table is append only (triggers of migrations 007 and 008), and only the audit-retention job (LA-E5-19) deletes rows.
// Other lanes call this module; they never write SQL for the table.
import { ApiErrorBase, randomId, redact } from '@cogniate/shared';
import type { Db } from '../db/index.ts';
import { transaction } from '../db/index.ts';

export type AuditActorType = 'api_key' | 'operator' | 'system' | 'platform';
export interface AuditActor { type: AuditActorType; id: string }
export interface AuditTarget { type: string; id: string | null }

/** Who, on which tenant, from where: the part that is the same for the ok and the refused event of one request. */
export interface AuditContext {
  actor: AuditActor;
  /** The tenant, or null for an operator-global action. */
  toolAccountId: string | null;
  traceId: string | null;
  clientIp: string | null;
}

export interface AuditEventInput extends AuditContext {
  action: string;
  target: AuditTarget;
  result: 'ok' | 'refused';
  code?: string | null;
  /** Changed field names and non-secret values. Stored after redact(), at most 4 KB. */
  details?: Record<string, unknown> | null;
}

export interface AuditEvent {
  id: string;
  ts: number;
  actor: AuditActor;
  toolAccountId: string | null;
  action: string;
  target: AuditTarget;
  result: 'ok' | 'refused';
  code: string | null;
  traceId: string | null;
  clientIp: string | null;
  details: Record<string, unknown> | null;
}

interface AuditRow {
  id: string; ts: number; actor_type: AuditActorType; actor_id: string; tool_account_id: string | null; action: string;
  target_type: string | null; target_id: string | null; result: 'ok' | 'refused'; code: string | null; trace_id: string | null;
  client_ip: string | null; details: string | null;
}

export const AUDIT_DETAILS_MAX_BYTES = 4096;

/** The stored details: redact() first; a text above 4 KB becomes {"truncated":true}. */
export function auditDetailsText(details: Record<string, unknown> | null | undefined): string | null {
  if (!details) return null;
  const text = JSON.stringify(redact(details));
  return Buffer.byteLength(text, 'utf8') <= AUDIT_DETAILS_MAX_BYTES ? text : JSON.stringify({ truncated: true });
}

export function insertAuditEvent(db: Db, input: AuditEventInput, now: number): string {
  const id = randomId('aud_');
  db.prepare(`INSERT INTO audit_event (id, ts, actor_type, actor_id, tool_account_id, action, target_type, target_id, result, code,
                trace_id, client_ip, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, now, input.actor.type, input.actor.id, input.toolAccountId, input.action, input.target.type, input.target.id, input.result,
      input.code ?? null, input.traceId, input.clientIp, auditDetailsText(input.details));
  return id;
}

const toEvent = (r: AuditRow): AuditEvent => ({
  id: r.id, ts: r.ts, actor: { type: r.actor_type, id: r.actor_id }, toolAccountId: r.tool_account_id, action: r.action,
  target: { type: r.target_type ?? '', id: r.target_id }, result: r.result, code: r.code, traceId: r.trace_id, clientIp: r.client_ip,
  details: r.details === null ? null : (JSON.parse(r.details) as Record<string, unknown>),
});

export interface AuditFilter {
  toolAccountId?: string;
  action?: string;
  actorId?: string;
  /** epoch ms, included */
  since?: number;
  /** epoch ms, included */
  until?: number;
  /** The `next` value of the previous page. */
  cursor?: { ts: number; id: string };
  limit: number;
}

/** Newest first (ts, then id). `next` is set when more rows match. */
export function listAuditEvents(db: Db, filter: AuditFilter): { events: AuditEvent[]; next: { ts: number; id: string } | null } {
  const where: string[] = [];
  const args: Array<string | number> = [];
  if (filter.toolAccountId !== undefined) { where.push('tool_account_id = ?'); args.push(filter.toolAccountId); }
  if (filter.action !== undefined) { where.push('action = ?'); args.push(filter.action); }
  if (filter.actorId !== undefined) { where.push('actor_id = ?'); args.push(filter.actorId); }
  if (filter.since !== undefined) { where.push('ts >= ?'); args.push(filter.since); }
  if (filter.until !== undefined) { where.push('ts <= ?'); args.push(filter.until); }
  if (filter.cursor) { where.push('(ts < ? OR (ts = ? AND id < ?))'); args.push(filter.cursor.ts, filter.cursor.ts, filter.cursor.id); }
  const rows = db.prepare(`SELECT * FROM audit_event ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY ts DESC, id DESC LIMIT ?`)
    .all(...args, filter.limit + 1) as unknown as AuditRow[];
  const events = rows.slice(0, filter.limit).map(toEvent);
  const last = events.at(-1);
  return { events, next: rows.length > filter.limit && last ? { ts: last.ts, id: last.id } : null };
}

/** The code of a refused answer: an API error with a 4xx status. Anything else (a 5xx, a bug) writes no event. */
export function refusalCode(err: unknown): string | null {
  return err instanceof ApiErrorBase && err.status >= 400 && err.status < 500 ? err.code : null;
}

export interface AuditedRequest {
  /**
   * Run the change and insert its `ok` event in one transaction (rule 1). The event of `describe` may use the result,
   * for example the id of a new row. A throw rolls back the change and the event together.
   */
  change<T>(fn: () => T, describe?: (result: T) => { target?: AuditTarget; details?: Record<string, unknown> | null }): T;
}

/**
 * One event per authenticated admin request (LA-ADR-06 D4 rule 1): `ok` in the transaction of the change (body calls
 * `change` once), or `refused` with the code after a 4xx API error. Call it only after authentication: an
 * unauthenticated request writes no event.
 */
export async function withAudit<R>(
  db: Db, now: () => number, base: AuditContext & { action: string; target: AuditTarget; details?: Record<string, unknown> | null },
  body: (audit: AuditedRequest) => Promise<R> | R,
): Promise<R> {
  let written = false;
  let changeCalled = false;
  const audit: AuditedRequest = {
    change(fn, describe) {
      if (changeCalled) throw new Error('audit.change() must be called only once per withAudit()');
      changeCalled = true;
      const result = transaction(db, () => {
        const value = fn();
        const extra = describe?.(value) ?? {};
        insertAuditEvent(db, { ...base, target: extra.target ?? base.target, details: extra.details ?? base.details ?? null, result: 'ok' }, now());
        return value;
      });
      written = true;
      return result;
    },
  };
  try {
    const result = await body(audit);
    if (!written) throw new Error('withAudit() body completed without a successful audit.change()');
    return result;
  } catch (err) {
    const code = refusalCode(err);
    if (!written && code !== null) insertAuditEvent(db, { ...base, result: 'refused', code }, now());
    throw err;
  }
}
