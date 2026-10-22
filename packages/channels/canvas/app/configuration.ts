// Frozen developer key document (app contract §4.6).
import type { ExtensionRoute, PublicJwk } from '../../../../services/cogniate-app/src/kernel/ports.ts';

export const configurationRoute: ExtensionRoute = {
  method: 'GET', path: 'canvas-configuration', capability: 'setup.artifacts', legacyCapabilityName: 'canvasConfiguration',
  async handle(input, ctx) {
    const mode = input.query.jwk ?? 'url';
    if (mode !== 'url' && mode !== 'inline') return { error: { status: 400, code: 'INVALID_REQUEST', message: 'The jwk option must be url or inline.' } };
    const urls = ctx.toolUrls;
    let key: PublicJwk | undefined;
    if (mode === 'inline') {
      const result = await ctx.publicToolKeys();
      key = result.ok ? result.keys[0] : undefined;
      if (!key) return { error: { status: 502, code: 'LTI_SERVICE_ERROR', message: `The current public key is unavailable. Trace id: ${ctx.traceId}` } };
    }
    const document = {
      title: `Cogniate (${ctx.libraryName})`,
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
        domain: new URL(urls.ltiOrigin).host,
        tool_id: ctx.toolAccountId,
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
    return { status: 200, body: document, headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': 'attachment; filename="cogniate-canvas-lti.json"',
      'cache-control': 'no-store',
      ...(key ? { 'x-cogniate-key-id': key.kid } : {}),
    } };
  },
};
