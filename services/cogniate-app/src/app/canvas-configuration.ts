// GET /app-api/connections/:id/canvas-configuration (app contract §4.6): the signed-in Canvas developer key export.
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { LtiToolKey } from '../clients/lti-client.ts';
import { LtiServiceError } from '../clients/lti-client.ts';
import { getConnection } from '../domain/connections.ts';
import { TOOL_ACCOUNT, toolName, toolUrls } from '../providers/common.ts';
import type { ProviderRouteDeps } from '../providers/types.ts';
import { ApiError } from './api-errors.ts';

type ConfigurationRequest = { Params: { id: string }; Querystring: { jwk?: unknown } };

export function registerCanvasConfigurationRoutes(api: FastifyInstance, deps: ProviderRouteDeps): void {
  api.get<ConfigurationRequest>('/connections/:id/canvas-configuration', async (req: FastifyRequest<ConfigurationRequest>, reply) => {
    const library = req.auth!.signedIn.library;
    const c = getConnection(deps.db, library.id, req.params.id);
    if (!c) throw new ApiError('NOT_FOUND', 'The connection does not exist in your library.');
    if (c.lms !== 'canvas')
      throw new ApiError('CAPABILITY_NOT_SUPPORTED', 'This connection has no Canvas configuration.', { details: { capability: 'canvasConfiguration' } });
    const mode = req.query.jwk ?? 'url';
    if (mode !== 'url' && mode !== 'inline')
      throw new ApiError('INVALID_REQUEST', 'The jwk option must be url or inline.');

    const urls = toolUrls(deps.urls);
    let key: LtiToolKey | undefined;
    if (mode === 'inline') {
      try {
        // The public JWKS lists the active signing key first, then retired verification keys.
        key = (await deps.lti.getToolKeys(TOOL_ACCOUNT, req.traceId))[0];
      } catch (error) {
        if (!(error instanceof LtiServiceError)) throw error;
        throw new ApiError('LTI_SERVICE_ERROR', `The current public key is unavailable. Trace id: ${req.traceId}`);
      }
      if (!key) throw new ApiError('LTI_SERVICE_ERROR', `The current public key is unavailable. Trace id: ${req.traceId}`);
    }
    const document = {
      title: toolName(library.name),
      description: 'Cogniate courses (SCORM 1.2 and HTML) with grade return.',
      oidc_initiation_url: urls.login,
      target_link_uri: urls.launch,
      scopes: [
        'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem',
        'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly',
        'https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly',
        'https://purl.imsglobal.org/spec/lti-ags/scope/score',
        'https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly',
      ],
      extensions: [{
        domain: new URL(deps.urls.lti).host,
        tool_id: TOOL_ACCOUNT,
        platform: 'canvas.instructure.com',
        privacy_level: 'anonymous',
        settings: {
          text: 'Cogniate',
          placements: [{ placement: 'assignment_selection', message_type: 'LtiDeepLinkingRequest', target_link_uri: urls.launch, text: 'Cogniate' }],
        },
      }],
      // Copy only public members, even if a future client adds fields to its key type.
      ...(key
        ? { public_jwk: { kty: key.kty, kid: key.kid, alg: key.alg, use: key.use, n: key.n, e: key.e } }
        : { public_jwk_url: urls.keys }),
      custom_fields: {},
    };
    reply.type('application/json; charset=utf-8');
    reply.header('content-disposition', 'attachment; filename="cogniate-canvas-lti.json"');
    reply.header('cache-control', 'no-store');
    if (key) reply.header('x-cogniate-key-id', key.kid);
    return document;
  });
}
