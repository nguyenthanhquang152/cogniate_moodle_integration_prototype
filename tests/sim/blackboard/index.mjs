import { createProvider } from '../core/provider.mjs';

// ADR-011 revision 6; Blackboard primary facts F-BB-8 and F-BB-16.
// These are fixture constants. No production profile/validator is imported.
export const blackboard = {
  id: 'blackboard-sim',
  issuer: 'https://blackboard.sim.test',
  family: 'BlackboardLearn',
  auth: { host: 'developer.blackboard.sim.test', path: '/api/v1/gateway/oidcauth', methods: ['GET'] },
  jwks: { host: 'developer.blackboard.sim.test', path: /^\/api\/v1\/management\/applications\/([^/]+)\/jwks\.json$/ },
  token: { hosts: ['developer.blackboard.sim.test'], path: '/api/v1/gateway/oauth2/jwttoken', audience: 'array' },
  sites: ['learn-a.blackboard.sim.test', 'learn-b.blackboard.sim.test'].map((host) => ({
    host, lineitems: '/learn/api/v1/lti/courses/course-1/lineItems',
    nrps: '/learn/api/v1/lti/external/namesandroles/course-1',
    dlReturn: '/webapps/blackboard/controller/lti/v2/deeplinking',
  })),
  pageHosts: [],
  dlData: 'claim',
  dlSubject: true,
  documentTarget: 'window',
};
export function createProviders(runtime) { return [createProvider(runtime, blackboard)]; }
