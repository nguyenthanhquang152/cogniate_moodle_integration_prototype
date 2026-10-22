// Reviewed Canvas profile data (ADR-011 §6). All profiles use one shared LTI engine.

const flags = {
  deepLinkingResponseSub: false,
  clientAssertionAudArray: false,
  serviceOriginCheck: true, // F-CV-18; separate page and service origins.
};
const canvas = {
  wireLms: 'canvas', endpoints: 'fixed', privacyFloor: 'allowlist', sharing: 'exclusive', siteUrlOn: 'platform', serviceUrl: true,
  simulation: false, productFamily: 'canvas', // F-CV-22.
  accesstokenEndpoint: '{serviceUrl}/login/oauth2/token', // F-CV-5, F-CV-18.
  flags,
} as const;

const profiles = [
  {
    ...canvas, id: 'canvas-cloud-production', listOrder: 10, label: 'Instructure-hosted Canvas (production)',
    issuer: 'https://canvas.instructure.com', // F-CV-1.
    authenticationEndpoint: 'https://sso.canvaslms.com/api/lti/authorize_redirect', // F-CV-3.
    jwksUrl: 'https://sso.canvaslms.com/api/lti/security/jwks', // F-CV-4.
    sources: ['F-CV-1', 'F-CV-3', 'F-CV-4', 'F-CV-5', 'F-CV-18', 'F-CV-22'],
  },
  {
    ...canvas, id: 'canvas-cloud-beta', listOrder: 20, label: 'Instructure-hosted Canvas (beta)',
    issuer: 'https://canvas.beta.instructure.com', // F-CV-1.
    authenticationEndpoint: 'https://sso.beta.canvaslms.com/api/lti/authorize_redirect', // F-CV-3.
    jwksUrl: 'https://sso.beta.canvaslms.com/api/lti/security/jwks', // F-CV-4.
    sources: ['F-CV-1', 'F-CV-3', 'F-CV-4', 'F-CV-5', 'F-CV-18', 'F-CV-22'],
  },
  {
    ...canvas, id: 'canvas-cloud-test', listOrder: 30, label: 'Instructure-hosted Canvas (test)',
    issuer: 'https://canvas.test.instructure.com', // F-CV-1.
    authenticationEndpoint: 'https://sso.test.canvaslms.com/api/lti/authorize_redirect', // F-CV-3.
    jwksUrl: 'https://sso.test.canvaslms.com/api/lti/security/jwks', // F-CV-4.
    sources: ['F-CV-1', 'F-CV-3', 'F-CV-4', 'F-CV-5', 'F-CV-18', 'F-CV-22'],
  },
  {
    ...canvas, id: 'canvas-self-hosted', listOrder: 40, label: 'Self-hosted Canvas',
    issuer: '{siteUrl}', // F-CV-2.
    authenticationEndpoint: '{siteUrl}/api/lti/authorize_redirect', // F-CV-2.
    jwksUrl: '{siteUrl}/api/lti/security/jwks', // F-CV-2.
    refusedHostSuffixes: ['instructure.com', 'canvaslms.com'], // ADR-011 §6, site rule 5.
    sources: ['F-CV-2', 'F-CV-18', 'F-CV-22'],
  },
  {
    ...canvas, id: 'canvas-sim-cloud', listOrder: 70, label: 'Canvas cloud (simulation)', simulation: true,
    issuer: 'https://canvas.sim.test',
    authenticationEndpoint: 'https://sso.canvas.sim.test/api/lti/authorize_redirect',
    jwksUrl: 'https://sso.canvas.sim.test/api/lti/security/jwks',
    sources: ['ADR-011 §6 (simulation copy of canvas-cloud-production)'],
  },
] as const;

export default profiles;
