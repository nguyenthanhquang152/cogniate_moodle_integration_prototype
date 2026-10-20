// POST /app-api/connections/:id/deployments (app contract §4.7.2): add a Canvas deployment with an `add_deployment`
// grant. The handler calls the common redemption engine (`deps.redeem`); it has no grant, adoption or cleanup logic.
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { getConnection } from '../domain/connections.ts';
import { parseStrictBody } from '../providers/common.ts';
import type { ProviderRouteDeps } from '../providers/types.ts';
import { ApiError } from './api-errors.ts';

type IdParams = { Params: { id: string } };

export function registerCanvasDeploymentRoutes(api: FastifyInstance, deps: ProviderRouteDeps): void {
  api.post<IdParams>('/connections/:id/deployments', async (req: FastifyRequest<IdParams>) => {
    const library = req.auth!.signedIn.library;
    const c = getConnection(deps.db, library.id, req.params.id);
    if (!c) throw new ApiError('NOT_FOUND', 'The connection does not exist in your library.');
    if (c.lms !== 'canvas')
      throw new ApiError('CAPABILITY_NOT_SUPPORTED', 'This connection cannot add a deployment.', { details: { capability: 'addDeployment' } });
    if (c.status !== 'registered' && c.status !== 'connected') throw new ApiError('CONNECTION_NOT_READY');
    const parsed = parseStrictBody(req.body, { required: ['deploymentId', 'grantCode'] });
    if (!parsed.ok) throw new ApiError('INVALID_PLATFORM_VALUES', undefined, { details: { fields: parsed.fields } });
    const connection = await deps.redeem({
      libraryId: library.id,
      connectionId: c.id,
      purpose: 'add_deployment',
      // The engine gets the existing client id from the connection's own platform.
      values: { clientId: '', deploymentId: parsed.values.deploymentId!, grantCode: parsed.values.grantCode! },
      traceId: req.traceId,
    });
    return deps.connectionDto(connection, library.name);
  });
}
