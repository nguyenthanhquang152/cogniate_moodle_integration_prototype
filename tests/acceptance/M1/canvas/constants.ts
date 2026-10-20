// Canvas QA constants. Vitest-free, so Vitest cases, Playwright cases (M1 browser, M2) and the host runner share them.
// Sources: ADR-011 revision 6 §5, §6; M1 "Simulation hosts"; M3 §3.1, §3.2; canvas-lms at the pinned revision (sim/canvas).
import crypto from 'node:crypto';

export const DL = 'https://purl.imsglobal.org/spec/lti-dl/claim/';
export const ROLE = {
  learner: 'http://purl.imsglobal.org/vocab/lis/v2/membership#Learner',
  instructor: 'http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor',
  teachingAssistant: 'http://purl.imsglobal.org/vocab/lis/v2/membership/Instructor#TeachingAssistant',
  institutionInstructor: 'http://purl.imsglobal.org/vocab/lis/v2/institution/person#Instructor',
  institutionAdmin: 'http://purl.imsglobal.org/vocab/lis/v2/institution/person#Administrator',
  testUser: 'http://purl.imsglobal.org/vocab/lti/system/person#TestUser',
};
export const CLOUD = {
  profile: 'canvas-sim-cloud', provider: 'canvas-sim-cloud', issuer: 'https://canvas.sim.test',
  auth: 'https://sso.canvas.sim.test/api/lti/authorize_redirect', jwks: 'https://sso.canvas.sim.test/api/lti/security/jwks',
  siteA: 'https://school-a.canvas.sim.test', siteB: 'https://school-b.canvas.sim.test', pageA: 'https://canvas.school-a.sim.test',
};
export const SELF = {
  profile: 'canvas-self-hosted', provider: 'canvas-sim-self',
  site: 'https://canvas-self.sim.test', service: 'https://api.canvas-self.sim.test',
};
export const BLACKBOARD = {
  profile: 'blackboard-sim', provider: 'blackboard-sim', clientId: 'qa-bb-app',
  siteA: 'https://learn-a.blackboard.sim.test', siteB: 'https://learn-b.blackboard.sim.test',
};
export const PATHS = {
  lineitems: '/api/lti/courses/course-1/line_items',
  nrps: '/api/lti/courses/course-1/names_and_roles',
  dlReturn: '/courses/course-1/deep_linking_response',
  token: '/login/oauth2/token',
};
// Canvas score refusals (scores_controller.rb). The simulator answers with the message that a scenario sets.
export const CANVAS_SCORE = {
  olderTimestamp: 'Provided timestamp of 2026-10-20T08:00:00.000Z before last updated timestamp of 2026-10-20T08:00:01.000Z',
  attemptLimit: 'The maximum number of allowed attempts has been reached for this submission',
};
// Login extras that Canvas sends (lti_advantage_adapter.rb login_request). The tool must accept them.
export const CANVAS_LOGIN = { canvas_environment: 'prod', canvas_region: 'not_configured' };
export const hostOf = (origin: string) => new URL(origin).hostname;
// Canvas developer key ids are numeric; deployment ids are "<n>:<40 hex>" (app contract §4.2 example form).
export const canvasClientId = () => String(10_000_000_000_000 + crypto.randomInt(1, 899_999_999_999));
export const canvasDeploymentId = () => `${crypto.randomInt(1, 99_999)}:${crypto.randomBytes(20).toString('hex')}`;
export const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Faithful Canvas assignment_selection settings (deep_linking_request.rb): data only in the return URL query. */
export function canvasDeepLinking(id: string, pageHost: string, overrides: Record<string, unknown> = {}) {
  return { [DL + 'deep_linking_settings']: {
    deep_link_return_url: `https://${pageHost}${PATHS.dlReturn}?data=${encodeURIComponent('data-' + id)}`,
    accept_types: ['ltiResourceLink'], accept_presentation_document_targets: ['iframe', 'window'],
    accept_media_types: 'application/vnd.ims.lti.v1.ltilink', auto_create: false, accept_multiple: false, ...overrides,
  } };
}
