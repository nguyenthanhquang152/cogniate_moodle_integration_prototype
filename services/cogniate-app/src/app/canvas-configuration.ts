// GET /app-api/connections/:id/canvas-configuration (app contract §4.6): the Canvas developer key JSON. Owner after
// the foundation handoff: the Canvas implementer.
//
// FOUNDATION STUB: only the capability guard (no connection has the `canvasConfiguration` capability yet).
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { getConnection } from '../domain/connections.ts';
import type { ProviderRouteDeps } from '../providers/types.ts';
import { ApiError } from './api-errors.ts';

type IdParams = { Params: { id: string } };

export function registerCanvasConfigurationRoutes(api: FastifyInstance, deps: ProviderRouteDeps): void {
  api.get<IdParams>('/connections/:id/canvas-configuration', async (req: FastifyRequest<IdParams>) => {
    const c = getConnection(deps.db, req.auth!.signedIn.library.id, req.params.id);
    if (!c) throw new ApiError('NOT_FOUND', 'The connection does not exist in your library.');
    throw new ApiError('CAPABILITY_NOT_SUPPORTED', 'This connection has no Canvas configuration.', { details: { capability: 'canvasConfiguration' } });
  });
}
