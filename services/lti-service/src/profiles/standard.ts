// The `standard` profile: today's Moodle rules (security §2.4). Admin values for the issuer and the endpoints; the
// issuer must not be a reserved provider issuer (LTI contract §9.1).
import type { ProviderProfile } from './types.ts';

export const STANDARD_PROFILE_ID = 'standard';

export const STANDARD_PROFILES: readonly ProviderProfile[] = [
  {
    id: STANDARD_PROFILE_ID, lms: null, label: 'Standard LTI 1.3 platform', sharing: 'exclusive',
    issuer: null, authenticationEndpoint: null, accesstokenEndpoint: null, jwksUrl: null,
    siteUrlOn: null, serviceUrl: false, simulation: false, productFamily: null,
    flags: { deepLinkingResponseSub: false, clientAssertionAudArray: false, minimizeClaims: false, serviceOriginCheck: false },
    sources: ['security §2.4'],
  },
];
