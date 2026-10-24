import { createProvider } from '../core/provider.mjs';

// Clean-room Acme LMS LTI 1.3 / LTI Advantage fixture constants (packages/channels/acme-lms/README.md).
// No production profile or validator is imported. One provider only.
// Primary facts (design; no real Acme site exists):
// - Issuer is the site URL; every endpoint is on the issuer host.
// - The client assertion audience is the token URL (`audience: 'string'`).
// - product_family_code is "acme".
// - Deployment IDs are strings, with multiple deployments per registration.
// - No Dynamic Registration (no `dr`).
export const ACME_LMS_DEPLOYMENTS = ['deploy-acme-lms-1', 'deploy-acme-lms-2'];

export const acmeLms = {
  id: 'acme-lms-sim',
  issuer: 'https://acme-lms.sim.test',
  family: 'acme',
  deployments: ACME_LMS_DEPLOYMENTS,
  auth: { host: 'acme-lms.sim.test', path: '/lti/auth', methods: ['GET', 'POST'] },
  jwks: { host: 'acme-lms.sim.test', path: '/lti/jwks.json' },
  token: { hosts: ['acme-lms.sim.test'], path: '/lti/token', audience: 'string' },
  sites: [{ host: 'acme-lms.sim.test', lineitems: '/lti/courses/course-1/lineitems', nrps: '/lti/courses/course-1/memberships', dlReturn: '/lti/deep-link/return' }],
  pageHosts: [],
  dlData: 'claim',
  dlSubject: false,
  dlWindowHint: true,
  documentTarget: 'iframe',
};

export function createProviders(runtime) {
  return [createProvider(runtime, acmeLms)];
}
