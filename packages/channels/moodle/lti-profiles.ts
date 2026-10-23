// The `standard` profile: today's Moodle rules (security §2.4). Admin values for the issuer and the endpoints; the
// issuer must not be a reserved provider issuer (LTI contract §9.1).
import type { ProfileSource } from '@cogniate/channel-kernel';

const profiles = [
  {
    id: 'standard', wireLms: null, endpoints: 'admin', privacyFloor: 'none', listOrder: 0, label: 'Standard LTI 1.3 platform', sharing: 'exclusive',
    issuer: null, authenticationEndpoint: null, accesstokenEndpoint: null, jwksUrl: null,
    siteUrlOn: null, serviceUrl: false, simulation: false, productFamily: null,
    // LA-ADR-02 D2: Moodle has one issuer per site and keeps every endpoint on the issuer origin.
    issuerKind: 'per-tenant', endpointOrigins: 'issuer', clientAssertionAud: { value: '{tokenEndpoint}', form: 'string' }, assertionDeploymentId: false,
    dynamicRegistration: { issuerRule: 'path-prefix', configurationPath: '/mod/lti/openid-configuration.php', registrationToken: 'scope-jwt' },
    flags: { deepLinkingResponseSub: false, serviceOriginCheck: false },
    sources: ['security §2.4'],
  },
] as const satisfies readonly ProfileSource[];

export default profiles;
