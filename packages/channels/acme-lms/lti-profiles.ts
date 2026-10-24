// The `acme-lms` profile: Acme LMS with admin values and one issuer per tenant (the site URL). Every binding needs an
// operator grant that binds each value (LA-ADR-02 D6). Acme LMS has no Dynamic Registration. Facts and sources:
// README.md.
import type { ProfileSource } from '@cogniate/channel-kernel';

const profiles = [
  {
    // listOrder above every other value (load check 7, BD-A1-23); real profiles sort before the simulations.
    id: 'acme-lms', listOrder: 100, endpoints: 'admin', privacyFloor: 'allowlist', label: 'Acme LMS', sharing: 'exclusive',
    issuer: null, authenticationEndpoint: null, accesstokenEndpoint: null, jwksUrl: null,
    siteUrlOn: null, serviceUrl: false, simulation: false,
    // UNVERIFIED (simulated only): no real Acme site exists. The manifest guards it at the registration level.
    productFamily: 'acme',
    issuerKind: 'per-tenant', endpointOrigins: 'any-https', clientAssertionAud: { value: '{platformValue}', form: 'string' }, assertionDeploymentId: false,
    // Acme LMS has no Dynamic Registration: `null` = no Dynamic Registration (absent = no limit).
    dynamicRegistration: null,
    flags: { deepLinkingResponseSub: false, serviceOriginCheck: false },
    sources: ['LA-ADR-02 D1', 'LA-ADR-02 D4', 'acme-lms README'],
  },
] as const satisfies readonly ProfileSource[];

export default profiles;
