// POST /app-api/connections/:id/deployments (app contract §4.7.2): add a Canvas deployment with an `add_deployment`
// grant. The handler calls the common redemption engine (`deps.redeem`); it has no grant, adoption or cleanup logic of
// its own. Owner after the foundation handoff: the Canvas implementer.
//
// FOUNDATION STUB: only the capability guard (no connection has the `addDeployment` capability yet).
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { getConnection } from '../domain/connections.ts';
import type { ProviderRouteDeps } from '../providers/types.ts';
import { ApiError } from './api-errors.ts';

type IdParams = { Params: { id: string } };

export function registerCanvasDeploymentRoutes(api: FastifyInstance, deps: ProviderRouteDeps): void {
  api.post<IdParams>('/connections/:id/deployments', async (req: FastifyRequest<IdParams>) => {
    const c = getConnection(deps.db, req.auth!.signedIn.library.id, req.params.id);
    if (!c) throw new ApiError('NOT_FOUND', 'The connection does not exist in your library.');
    throw new ApiError('CAPABILITY_NOT_SUPPORTED', 'This connection cannot add a deployment.', { details: { capability: 'addDeployment' } });
  });
}
