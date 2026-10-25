import { createProvider } from '../core/provider.mjs';
import { json } from '../core/runtime.mjs';

// Canvas fixture constants (ADR-011 revision 6, M3 §3.2). No product module is imported.
// Canvas QA read these files of instructure/canvas-lms at the pinned revision before using them:
// - app/controllers/lti/ims/authentication_controller.rb: REQUIRED_PARAMS (also prompt and response_mode), scope "openid".
// - lib/lti/messages/jwt_message.rb: product_family_code "canvas" (F-CV-22), document_target "iframe" (F-CV-17),
//   AGS and NRPS URLs on the root account domain (F-CV-18).
// - lib/lti/messages/deep_linking_request.rb: return URL on the request host with a `data` query (F-CV-21);
//   assignment_selection settings (ltiResourceLink, targets iframe and window, no data claim).
// - app/controllers/lti/ims/concerns/deep_linking_services.rb: response JWT iss = client id, aud = issuer, nonce.
// - lib/canvas/oauth/client_credentials_provider.rb: assertion aud = the token URL of the request host (a string).
// - app/controllers/lti/ims/scores_controller.rb: 400 for an older timestamp (F-CV-19), 422 for the attempt limit (F-CV-23).
export const CANVAS_SOURCE = {
  repository: 'https://github.com/instructure/canvas-lms',
  revision: '1c9f0bb8013ed69c4f2efe11fd483025469b7e6c',
};
// authentication_controller.rb REQUIRED_PARAMS. Canvas checks that each key is present; `state` is optional.
export const CANVAS_OIDC_REQUIRED = ['client_id', 'login_hint', 'lti_message_hint', 'nonce', 'prompt',
  'redirect_uri', 'response_mode', 'response_type', 'scope'];
// Score messages of scores_controller.rb (verify_valid_timestamp, verify_attempts_for_online_upload).
export const CANVAS_SCORE_MESSAGES = {
  olderTimestamp: 'Provided timestamp of the score before last updated timestamp of the result',
  attemptLimit: 'The maximum number of allowed attempts has been reached for this submission',
};
const sitePaths = {
  lineitems: '/api/lti/courses/course-1/line_items',
  nrps: '/api/lti/courses/course-1/names_and_roles',
  dlReturn: '/courses/course-1/deep_linking_response',
};
// canvas-sim-cloud copies canvas-cloud-production: one issuer, auth and JWKS on the SSO host, token and services
// on each school's account domain, and one extra page host that has no service routes (AC-M1-32, AC-M1-40).
export const canvasCloud = {
  id: 'canvas-sim-cloud',
  issuer: 'https://canvas.sim.test',
  family: 'canvas',
  auth: { host: 'sso.canvas.sim.test', path: '/api/lti/authorize_redirect', methods: ['GET', 'POST'] },
  jwks: { host: 'sso.canvas.sim.test', path: '/api/lti/security/jwks' },
  token: { hosts: ['school-a.canvas.sim.test', 'school-b.canvas.sim.test'], path: '/login/oauth2/token', audience: 'string' },
  dr: {
    hosts: ['sso.canvas.sim.test', 'school-a.canvas.sim.test', 'school-b.canvas.sim.test'],
    configPaths: ['/api/lti/security/openid-configuration', '/.well-known/openid-configuration'],
    registrationPaths: ['/api/lti/registrations'],
    tokenFormat: 'opaque-bearer',
    defaultTokenHost: 'school-a.canvas.sim.test',
  },
  sites: ['school-a.canvas.sim.test', 'school-b.canvas.sim.test'].map((host) => ({ host, ...sitePaths })),
  pageHosts: ['canvas.school-a.sim.test'],
  dlData: 'query',
  dlSubject: false,
  documentTarget: 'iframe',
};
// A self-hosted Canvas (profile canvas-self-hosted): issuer, auth, JWKS and pages on the site host; token and services
// on a separate service host (AC-M1-26). The page host never exposes token, AGS or NRPS routes.
export const canvasSelf = {
  id: 'canvas-sim-self',
  issuer: 'https://canvas-self.sim.test',
  family: 'canvas',
  auth: { host: 'canvas-self.sim.test', path: '/api/lti/authorize_redirect', methods: ['GET', 'POST'] },
  jwks: { host: 'canvas-self.sim.test', path: '/api/lti/security/jwks' },
  token: { hosts: ['api.canvas-self.sim.test'], path: '/login/oauth2/token', audience: 'string' },
  dr: {
    hosts: ['canvas-self.sim.test', 'api.canvas-self.sim.test'],
    configPaths: ['/api/lti/security/openid-configuration', '/.well-known/openid-configuration'],
    registrationPaths: ['/api/lti/registrations'],
    tokenFormat: 'opaque-bearer',
    defaultTokenHost: 'api.canvas-self.sim.test',
  },
  sites: [{ host: 'api.canvas-self.sim.test', ...sitePaths }],
  pageHosts: ['canvas-self.sim.test'],
  dlData: 'query',
  dlSubject: false,
  documentTarget: 'iframe',
};

// Canvas refuses an authentication request without its required keys before it signs anything.
// The record keeps the two OIDC values, so tests can check the tool's values without a token.
function withCanvasAuthRules(runtime, provider, config) {
  return {
    ...provider,
    async handle(request) {
      if (request.host === config.auth.host && request.url.pathname === config.auth.path
        && config.auth.methods.includes(request.method)) {
        const params = request.method === 'GET' ? request.url.searchParams : new URLSearchParams(request.body);
        const missing = CANVAS_OIDC_REQUIRED.filter((name) => !params.has(name));
        runtime.record('canvas-oidc', { provider: config.id, host: request.host, method: request.method,
          prompt: params.get('prompt'), responseMode: params.get('response_mode'),
          hasState: params.has('state'), missing });
        if (missing.length) {
          runtime.record('rejected', { provider: config.id, host: request.host, method: request.method,
            path: request.url.pathname, reason: 'Canvas OIDC parameters missing: ' + missing.join(',') });
          return json(400, { error: 'invalid_request_object',
            error_description: `The following parameters are missing: ${missing.join(',')}` });
        }
      }
      return provider.handle(request);
    },
  };
}

export function createProviders(runtime) {
  return [canvasCloud, canvasSelf].map((config) => withCanvasAuthRules(runtime, createProvider(runtime, config), config));
}
