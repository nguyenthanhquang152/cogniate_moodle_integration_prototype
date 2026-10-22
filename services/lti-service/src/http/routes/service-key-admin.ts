// Tenant service-key revocation (LA-ADR-06 D8). The operator route uses the same body and account-scoped checks.
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ApiError } from '../../api-errors.ts';
import { getAccount } from '../../store/accounts.ts';
import type { AuditedRequest } from '../../store/audit.ts';
import { withAudit } from '../../store/audit.ts';
import { getPlatform } from '../../store/platforms.ts';
import { revokeScopedServiceKeys } from '../../store/service-keys.ts';
import type { RouteContext } from '../context.ts';
import { invalid } from '../validation.ts';

const id = z.string().min(1).max(2048);
const RevokeBody = z.object({ platformId: id, deploymentId: id.optional(), contextId: id.optional(), resourceLinkId: id.optional() }).strict();

/** Untrusted body values never become audit details before validation. */
export function serviceKeyRevokeTarget(body: unknown): { type: string; id: string | null } {
  const parsed = RevokeBody.safeParse(body);
  return { type: 'platform', id: parsed.success ? parsed.data.platformId : null };
}

export function revokeServiceKeyScope(
  ctx: Pick<RouteContext, 'db' | 'now'>, accountId: string, body: unknown, audit: AuditedRequest,
): { revoked: number } {
  const parsed = RevokeBody.safeParse(body);
  if (!parsed.success) throw invalid(parsed.error);
  const filter = parsed.data;
  const requireScope = () => {
    if (!getAccount(ctx.db, accountId)) throw new ApiError('NOT_FOUND', 'Unknown tool account.');
    if (!getPlatform(ctx.db, accountId, filter.platformId)) throw new ApiError('UNREGISTERED_PLATFORM');
  };
  requireScope();
  return audit.change(() => {
    requireScope();
    // BD-A2-12: removing access is allowed even when the operator targets a closed account.
    return { revoked: revokeScopedServiceKeys(ctx.db, accountId, filter, ctx.now()) };
  }, ({ revoked }) => ({ details: { ...filter, revoked } }));
}

export function registerServiceKeyAdminRoutes(app: FastifyInstance, ctx: Pick<RouteContext, 'db' | 'now' | 'auth'>): void {
  app.post('/api/service-keys/revoke', async (req) => {
    const caller = ctx.auth(req, ['bearer']);
    return withAudit(ctx.db, ctx.now, {
      actor: caller.actor, toolAccountId: caller.account.id, traceId: req.traceId, clientIp: req.ip,
      action: 'service_key.revoke', target: serviceKeyRevokeTarget(req.body),
    }, (audit) => revokeServiceKeyScope(ctx, caller.account.id, req.body, audit));
  });
}
