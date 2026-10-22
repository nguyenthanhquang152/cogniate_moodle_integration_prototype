// Admin-value canary channel LTI 1.3 profile definitions (LA-E7-01, LA-E2-03 AC-05, BD-A1-21).
// Uses `endpoints: 'admin'` so the admin supplies the platform endpoints at binding time.
import type { ProfileSource } from '@cogniate/channel-kernel';

const adminValueCanaryProfiles = [
  {
    id: 'zz-canary-admin-sim',
    listOrder: 991,
    endpoints: 'admin',
    privacyFloor: 'allowlist',
    label: 'Canary Admin LMS (simulation)',
    sharing: 'exclusive',
    issuer: null,
    authenticationEndpoint: null,
    accesstokenEndpoint: null,
    jwksUrl: null,
    siteUrlOn: null,
    serviceUrl: false,
    simulation: true,
    productFamily: null,
    flags: {
      deepLinkingResponseSub: false,
      clientAssertionAudArray: false,
      serviceOriginCheck: false,
    },
    sources: ['LA-E7-01 admin-value canary profile (LA-E2-03 AC-05)'],
  },
] as const satisfies readonly ProfileSource[];

export default adminValueCanaryProfiles;
