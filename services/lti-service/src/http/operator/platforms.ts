import type { FastifyInstance } from 'fastify';
import { ApiError } from '../../api-errors.ts';
import { getAccount } from '../../store/accounts.ts';
import { listPlatforms } from '../../store/platforms.ts';
import type { OperatorContext } from './index.ts';

/** BD-A2-53: let the operator find platform ids for scoped service-key revocation. */
export function registerOperatorPlatformRoutes(app: FastifyInstance, ctx: OperatorContext): void {
  app.get<{ Params: { id: string } }>('/operator/v1/accounts/:id/platforms', async (req) => {
    if (!getAccount(ctx.db, req.params.id)) throw new ApiError('NOT_FOUND', 'Unknown tool account.');
    return { platforms: listPlatforms(ctx.db, req.params.id).map(({ id, name, profile, issuer, clientId, active, deploymentIds }) =>
      ({ id, name, profile, issuer, clientId, active, deploymentIds })) };
  });
}
