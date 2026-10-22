// Canary channel LTI 1.3 profile definitions (LA-E7-01, LA-ADR-01 D4, D6).
// Non-baseline profiles must omit `wireLms` (BD-A1-06).
const canaryProfiles = [
  {
    id: 'zz-canary-sim',
    listOrder: 990,
    endpoints: 'fixed',
    privacyFloor: 'allowlist',
    label: 'Canary LMS (simulation)',
    sharing: 'exclusive',
    issuer: 'https://canary.sim.test',
    authenticationEndpoint: 'https://canary.sim.test/lti/authorize',
    accesstokenEndpoint: 'https://canary.sim.test/lti/token',
    jwksUrl: 'https://canary.sim.test/lti/jwks.json',
    siteUrlOn: 'platform',
    serviceUrl: false,
    simulation: true,
    productFamily: 'zz-canary-lms',
    flags: {
      deepLinkingResponseSub: false,
      clientAssertionAudArray: false,
      serviceOriginCheck: true,
    },
    sources: ['LA-E7-01 canary profile'],
  },
] as const;

export default canaryProfiles;
