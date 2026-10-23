// The `brightspace` profile (LA-ADR-02 D4): D2L Brightspace with admin values and one issuer per tenant (the site
// URL). The D2L token host is off the issuer origin (`any-https`), so every binding needs an operator grant that binds
// each value (D2a, D6). Facts and sources: README.md.
import type { ProfileSource } from '@cogniate/channel-kernel';

const profiles = [
  {
    // listOrder above every other value (load check 7, BD-A1-23); real profiles sort before the simulations.
    id: 'brightspace', listOrder: 90, endpoints: 'admin', privacyFloor: 'allowlist', label: 'D2L Brightspace', sharing: 'exclusive',
    issuer: null, authenticationEndpoint: null, accesstokenEndpoint: null, jwksUrl: null,
    siteUrlOn: null, serviceUrl: false, simulation: false,
    // UNVERIFIED (R2-2): the first real launch confirms the family. The manifest guards it at the registration level.
    productFamily: 'desire2learn',
    issuerKind: 'per-tenant', endpointOrigins: 'any-https', clientAssertionAud: { value: '{platformValue}', form: 'string' }, assertionDeploymentId: false,
    // No Dynamic Registration yet (LA-E2-06) and no platform storage until a live check (LA-E2-05 scope).
    flags: { deepLinkingResponseSub: false, clientAssertionAudArray: false, serviceOriginCheck: false },
    sources: ['LA-ADR-02 D4', 'R2 §5.4'],
  },
] as const satisfies readonly ProfileSource[];

export default profiles;
