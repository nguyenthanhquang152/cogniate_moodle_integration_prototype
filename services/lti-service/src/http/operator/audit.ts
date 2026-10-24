// GET /operator/v1/audit (contract delta §3; LA-ADR-06 D4 rule 3): newest first, at most 500 per page, with a cursor.
// The read itself writes one event `audit.read` (rule 1), after the list, in the same transaction.
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ApiError } from '../../api-errors.ts';
import type { AuditEvent, AuditFilter } from '../../store/audit.ts';
import { invalid } from '../validation.ts';
import type { OperatorContext } from './index.ts';

const AuditQuery = z.object({
  toolAccountId: z.string().min(1).max(64).optional(),
  action: z.string().min(1).max(64).optional(),
  actorId: z.string().min(1).max(128).optional(),
  traceId: z.string().regex(/^[A-Za-z0-9-]{16,64}$/).optional(),
  since: z.iso.datetime({ offset: true }).optional(),
  until: z.iso.datetime({ offset: true }).optional(),
  cursor: z.string().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

export const AUDIT_PAGE_DEFAULT = 100;

/** The cursor is the (ts, id) of the last event of the page, as base64url. It is not a secret. */
export const encodeCursor = (c: { ts: number; id: string }): string => Buffer.from(`${c.ts}:${c.id}`, 'utf8').toString('base64url');
function decodeCursor(text: string): { ts: number; id: string } {
  const m = /^(\d{1,15}):(aud_[A-Za-z0-9_-]{1,64})$/.exec(Buffer.from(text, 'base64url').toString('utf8'));
  if (!m) throw new ApiError('INVALID_REQUEST', 'Invalid field: cursor.');
  return { ts: Number(m[1]), id: m[2]! };
}

const toApi = (e: AuditEvent) => ({
  id: e.id, ts: new Date(e.ts).toISOString(), actor: e.actor, toolAccountId: e.toolAccountId, action: e.action, target: e.target,
  result: e.result, code: e.code, traceId: e.traceId, clientIp: e.clientIp, details: e.details,
});

export function registerAuditRoutes(app: FastifyInstance, ctx: OperatorContext): void {
  app.get('/operator/v1/audit', async (req) => (await ctx.audited(req, { action: 'audit.read', target: { type: 'audit', id: null } }, async (audit) => {
    const parsed = AuditQuery.safeParse(req.query ?? {});
    if (!parsed.success) throw invalid(parsed.error);
    const q = parsed.data;
    const filter: AuditFilter = {
      limit: q.limit ?? AUDIT_PAGE_DEFAULT,
      ...(q.toolAccountId !== undefined ? { toolAccountId: q.toolAccountId } : {}),
      ...(q.action !== undefined ? { action: q.action } : {}),
      ...(q.actorId !== undefined ? { actorId: q.actorId } : {}),
      ...(q.traceId !== undefined ? { traceId: q.traceId } : {}),
      ...(q.since !== undefined ? { since: Date.parse(q.since) } : {}),
      ...(q.until !== undefined ? { until: Date.parse(q.until) } : {}),
      ...(q.cursor !== undefined ? { cursor: decodeCursor(q.cursor) } : {}),
    };
    // The event names the filters (not the cursor value) and the number of events shown.
    const query = Object.fromEntries(Object.entries(q).filter(([k]) => k !== 'cursor'));
    const page = (await audit.readAudit(filter, query, q.cursor !== undefined));
    return { events: page.events.map(toApi), ...(page.next ? { next: encodeCursor(page.next) } : {}) };
  })));
}
