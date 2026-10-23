// The `lti-generic` profile (LA-ADR-02 D2, D3): admin values for the issuer and every endpoint, one issuer per tenant.
// Endpoints may be on another https host (`any-https`); a value off the issuer origin needs an operator grant (D2a).
import type { ProfileSource } from '@cogniate/channel-kernel';

const profiles = [
  {
    // listOrder above every baseline value (load check 7, BD-A1-23); real profiles sort before the simulations.
    id: 'lti-generic', listOrder: 80, endpoints: 'admin', privacyFloor: 'allowlist', label: 'Other LTI 1.3 platform', sharing: 'exclusive',
    issuer: null, authenticationEndpoint: null, accesstokenEndpoint: null, jwksUrl: null,
    siteUrlOn: null, serviceUrl: false, simulation: false, productFamily: null,
    issuerKind: 'per-tenant', endpointOrigins: 'any-https', clientAssertionAud: { value: '{platformValue}', form: 'string' }, assertionDeploymentId: false,
    dynamicRegistration: { issuerRule: 'path-prefix', registrationToken: 'opaque-bearer' },
    // A2 LA-ADR-05 D1 rule 1a: platform storage with the frame from the login request and the auth origin.
    platformStorage: { targetFrame: 'from-login', origin: 'authOrigin' },
    flags: { deepLinkingResponseSub: false, serviceOriginCheck: false },
    sources: ['LA-ADR-02 D2, D3', 'LA-ADR-05 D1 rule 1a'],
  },
] as const satisfies readonly ProfileSource[];

export default profiles;
