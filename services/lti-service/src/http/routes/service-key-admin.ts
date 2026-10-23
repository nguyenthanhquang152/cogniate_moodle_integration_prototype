import { storeFor } from '../../store/index.ts';
import type { AuditedOperations } from '../../store/audited-operations.ts';
// Tenant service-key revocation (LA-ADR-06 D8). The operator route uses the same body and account-scoped checks.
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ApiError } from '../../api-errors.ts';

import type { RouteContext } from '../context.ts';
import { invalid } from '../validation.ts';

const id = z.string().min(1).max(2048);
// BD-A2-76: an empty context selects launches without a context; omission selects every context.
const RevokeBody = z.object({ platformId: id, deploymentId: id.optional(), contextId: z.string().max(2048).optional(), resourceLinkId: id.optional() }).strict();

/** Untrusted body values never become audit details before validation. */
export function serviceKeyRevokeTarget(body: unknown): { type: string; id: string | null } {
  const parsed = RevokeBody.safeParse(body);
  return { type: 'platform', id: parsed.success ? parsed.data.platformId : null };
}

export async function revokeServiceKeyScope(
  ctx: Pick<RouteContext, 'db' | 'now'>, accountId: string, body: unknown, audit: AuditedOperations,
): Promise<{ revoked: number }> {
  const parsed = RevokeBody.safeParse(body);
  if (!parsed.success) throw invalid(parsed.error);
  const filter = parsed.data;
  const requireScope = async () => {
    if (!(await storeFor(ctx.db).accounts.getAccount(accountId))) throw new ApiError('NOT_FOUND', 'Unknown tool account.');
    if (!(await storeFor(ctx.db).platforms.getPlatform(accountId, filter.platformId))) throw new ApiError('UNREGISTERED_PLATFORM');
  };
  // Check before audit.change so a missing account or platform records a refused event.
  (await requireScope());
  return (await audit.revokeServiceKeys(accountId, filter, ctx.now()));
}

export function registerServiceKeyAdminRoutes(app: FastifyInstance, ctx: Pick<RouteContext, 'db' | 'now' | 'auth'>): void {
  app.post('/api/service-keys/revoke', async (req) => {
    const caller = (await ctx.auth(req, ['bearer']));
    return (await storeFor(ctx.db).audit.request(ctx.now, {
      actor: caller.actor, toolAccountId: caller.account.id, traceId: req.traceId, clientIp: req.ip,
      action: 'service_key.revoke', target: serviceKeyRevokeTarget(req.body),
    }, (audit) => revokeServiceKeyScope(ctx, caller.account.id, req.body, audit)));
  });
}
