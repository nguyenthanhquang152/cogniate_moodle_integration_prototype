import type { FastifyInstance } from 'fastify';
import { revokeServiceKeyScope, serviceKeyRevokeTarget } from '../routes/service-key-admin.ts';
import type { OperatorContext } from './index.ts';

export function registerOperatorServiceKeyRoutes(app: FastifyInstance, ctx: OperatorContext): void {
  app.post<{ Params: { id: string } }>('/operator/v1/accounts/:id/service-keys/revoke', async (req) => (await ctx.audited(req, {
    action: 'service_key.revoke', toolAccountId: req.params.id, target: serviceKeyRevokeTarget(req.body),
  }, (audit) => revokeServiceKeyScope(ctx, req.params.id, req.body, audit))));
}
