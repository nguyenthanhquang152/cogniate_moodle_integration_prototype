// Blackboard Learn profiles (ADR-011 §6). One shared platform per tool account: the Cogniate Application ID is the
// client id of every school; each school is one deployment with its own site URL.

const BLACKBOARD_FLAGS = {
  deepLinkingResponseSub: true, // F-BB-8: Learn needs sub = client id in the Deep Linking response
  clientAssertionAudArray: true, // F-BB-5: aud = [token endpoint]
  serviceOriginCheck: true, // ADR-011 §5
};

const profiles = [
  {
    id: 'blackboard', listOrder: 50, wireLms: 'blackboard', endpoints: 'fixed', privacyFloor: 'allowlist', label: 'Blackboard Learn', sharing: 'shared',
    issuer: 'https://blackboard.com', // F-BB-3
    authenticationEndpoint: 'https://developer.blackboard.com/api/v1/gateway/oidcauth', // F-BB-4
    accesstokenEndpoint: 'https://developer.blackboard.com/api/v1/gateway/oauth2/jwttoken', // F-BB-5
    jwksUrl: 'https://developer.blackboard.com/api/v1/management/applications/{clientId}/jwks.json', // F-BB-4
    siteUrlOn: 'deployment', serviceUrl: false, simulation: false, productFamily: 'blackboardlearn', // F-BB-16
    flags: BLACKBOARD_FLAGS, sources: ['F-BB-3', 'F-BB-4', 'F-BB-5', 'F-BB-16'],
  },
  {
    // Copy of `blackboard` on fixed .sim.test hosts (ADR-011 §6 simulation table, M3 §3.1).
    id: 'blackboard-sim', listOrder: 60, wireLms: 'blackboard', endpoints: 'fixed', privacyFloor: 'allowlist', label: 'Blackboard Learn (simulation)', sharing: 'shared',
    issuer: 'https://blackboard.sim.test',
    authenticationEndpoint: 'https://developer.blackboard.sim.test/api/v1/gateway/oidcauth',
    accesstokenEndpoint: 'https://developer.blackboard.sim.test/api/v1/gateway/oauth2/jwttoken',
    jwksUrl: 'https://developer.blackboard.sim.test/api/v1/management/applications/{clientId}/jwks.json',
    siteUrlOn: 'deployment', serviceUrl: false, simulation: true, productFamily: 'blackboardlearn',
    flags: BLACKBOARD_FLAGS, sources: ['ADR-011 §6 (simulation copy of blackboard)'],
  },
] as const;

export default profiles;
