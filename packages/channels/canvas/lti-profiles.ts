// Reviewed Canvas profile data (ADR-011 §6). All profiles use one shared LTI engine.
import type { ProfileSource } from '@cogniate/channel-kernel';

const flags = {
  deepLinkingResponseSub: false,
  serviceOriginCheck: true, // F-CV-18; separate page and service origins.
};
const canvas = {
  wireLms: 'canvas', endpoints: 'fixed', privacyFloor: 'allowlist', sharing: 'exclusive', siteUrlOn: 'platform', serviceUrl: true,
  simulation: false, productFamily: 'canvas', // F-CV-22.
  accesstokenEndpoint: '{serviceUrl}/login/oauth2/token', // F-CV-5, F-CV-18.
  platformStorage: { targetFrame: 'from-login', origin: 'authOrigin' }, // LA-ADR-05 D1 rule 1a.
  // LA-ADR-02 D2: fixed endpoints; no Dynamic Registration (BD-A1-83: explicit null). Canvas DR is A2's LA-ADR-05 D6.
  endpointOrigins: null, clientAssertionAud: { value: '{tokenEndpoint}', form: 'string' }, assertionDeploymentId: false, dynamicRegistration: null,
  flags,
} as const;

const profiles = [
  {
    ...canvas, id: 'canvas-cloud-production', listOrder: 10, issuerKind: 'fixed', label: 'Instructure-hosted Canvas (production)',
    issuer: 'https://canvas.instructure.com', // F-CV-1.
    authenticationEndpoint: 'https://sso.canvaslms.com/api/lti/authorize_redirect', // F-CV-3.
    jwksUrl: 'https://sso.canvaslms.com/api/lti/security/jwks', // F-CV-4.
    sources: ['F-CV-1', 'F-CV-3', 'F-CV-4', 'F-CV-5', 'F-CV-18', 'F-CV-22'],
  },
  {
    ...canvas, id: 'canvas-cloud-beta', listOrder: 20, issuerKind: 'fixed', label: 'Instructure-hosted Canvas (beta)',
    issuer: 'https://canvas.beta.instructure.com', // F-CV-1.
    authenticationEndpoint: 'https://sso.beta.canvaslms.com/api/lti/authorize_redirect', // F-CV-3.
    jwksUrl: 'https://sso.beta.canvaslms.com/api/lti/security/jwks', // F-CV-4.
    sources: ['F-CV-1', 'F-CV-3', 'F-CV-4', 'F-CV-5', 'F-CV-18', 'F-CV-22'],
  },
  {
    ...canvas, id: 'canvas-cloud-test', listOrder: 30, issuerKind: 'fixed', label: 'Instructure-hosted Canvas (test)',
    issuer: 'https://canvas.test.instructure.com', // F-CV-1.
    authenticationEndpoint: 'https://sso.test.canvaslms.com/api/lti/authorize_redirect', // F-CV-3.
    jwksUrl: 'https://sso.test.canvaslms.com/api/lti/security/jwks', // F-CV-4.
    sources: ['F-CV-1', 'F-CV-3', 'F-CV-4', 'F-CV-5', 'F-CV-18', 'F-CV-22'],
  },
  {
    ...canvas, id: 'canvas-self-hosted', listOrder: 40, issuerKind: 'per-tenant', label: 'Self-hosted Canvas',
    issuer: '{siteUrl}', // F-CV-2.
    authenticationEndpoint: '{siteUrl}/api/lti/authorize_redirect', // F-CV-2.
    jwksUrl: '{siteUrl}/api/lti/security/jwks', // F-CV-2.
    refusedHostSuffixes: ['instructure.com', 'canvaslms.com'], // ADR-011 §6, site rule 5.
    sources: ['F-CV-2', 'F-CV-18', 'F-CV-22'],
  },
  {
    ...canvas, id: 'canvas-sim-cloud', listOrder: 70, issuerKind: 'fixed', label: 'Canvas cloud (simulation)', simulation: true,
    issuer: 'https://canvas.sim.test',
    authenticationEndpoint: 'https://sso.canvas.sim.test/api/lti/authorize_redirect',
    jwksUrl: 'https://sso.canvas.sim.test/api/lti/security/jwks',
    sources: ['ADR-011 §6 (simulation copy of canvas-cloud-production)'],
  },
] as const satisfies readonly ProfileSource[];

export default profiles;
